const fs = require('fs');
const path = require('path');

const systemManager = require('../services/systemManager');
const bugWatcher = require('../services/bugWatcher');
const metricsTracker = require('../services/metricsTracker');
const AIDiagnosticsService = require('../services/aiDiagnosticsService');
const activationConfirmationService = require('../services/activationConfirmationService');
const activationLoggerService = require('../services/activationLoggerService');
const runtimeManager = require('../services/runtimeManager');
const runtimeLogger = require('../services/runtimeLogger');

const RUNTIME_ERROR_LOG = path.join(__dirname, '..', 'logs', 'runtime_errors.log');
const aiDiagnosticsService = new AIDiagnosticsService(
  systemManager,
  bugWatcher,
  metricsTracker
);

function getStore(req) {
  return req.app.locals.store;
}

async function start(req, res) {
  try {
    const result = await systemManager.startSystem(getStore(req));
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to start system.',
    });
  }
}

async function stop(req, res) {
  try {
    await systemManager.shutdownSystem(getStore(req));
    return res.status(200).json(await systemManager.getStatus(getStore(req)));
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to stop system.',
    });
  }
}

async function status(req, res) {
  return res.status(200).json(await systemManager.getStatus(getStore(req)));
}

async function getAIDiagnostics(req, res) {
  try {
    const diagnostics = await aiDiagnosticsService.runAnalysis(getStore(req));
    return res.status(200).json(diagnostics);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to run AI diagnostics.',
    });
  }
}

function errorLog(_req, res) {
  try {
    if (!fs.existsSync(RUNTIME_ERROR_LOG)) {
      return res.status(200).json({
        entries: [],
        logFile: 'logs/runtime_errors.log',
      });
    }

    const rawContent = fs.readFileSync(RUNTIME_ERROR_LOG, 'utf8');
    const entries = rawContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-100)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_error) {
          return {
            message: line,
            timestamp: null,
            type: 'unparsed',
          };
        }
      });

    return res.status(200).json({
      entries,
      logFile: 'logs/runtime_errors.log',
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to read system error log.',
    });
  }
}

/**
 * Handles activation requests with local user confirmation
 * - Shows PowerShell confirmation prompt to local user
 * - If confirmed: triggers startup sequence (Node.js + ngrok)
 * - If rejected: returns cancelled status
 * - Logs all activation requests with timestamp and IP
 */
async function activate(req, res) {
  const clientIP = activationConfirmationService.getClientIP(req);

  try {
    console.log('[Activation] Request received from IP:', clientIP);

    // Log the activation request attempt
    activationLoggerService.logActivationRequest({
      ip: clientIP,
      action: 'activation_requested',
      userResponse: null,
      status: 'pending',
    });

    // Show the confirmation prompt to the local user
    console.log('[Activation] Showing confirmation prompt to local user...');
    const userConfirmed = await activationConfirmationService.showConfirmationDialog();

    if (!userConfirmed) {
      // User clicked NO or prompt timed out
      activationLoggerService.logActivationRequest({
        ip: clientIP,
        action: 'activation_requested',
        userResponse: 'NO',
        status: 'cancelled',
      });

      return res.status(200).json({
        status: 'cancelled',
        message: 'Activation cancelled by user',
      });
    }

    // User confirmed YES - Start the runtime processes
    activationLoggerService.logActivationRequest({
      ip: clientIP,
      action: 'activation_requested',
      userResponse: 'YES',
      status: 'starting',
    });

    console.log('[Activation] User confirmed - starting runtime processes...');

    // Execute the startup sequence (Node.js server + ngrok tunnel)
    const startupSuccess = await activationConfirmationService.startRuntimeProcesses();

    if (!startupSuccess) {
      activationLoggerService.logActivationRequest({
        ip: clientIP,
        action: 'startup_sequence',
        userResponse: 'YES',
        status: 'error',
        error: 'Runtime processes failed to start',
      });

      return res.status(500).json({
        status: 'error',
        message: 'Failed to start runtime processes',
      });
    }

    activationLoggerService.logActivationRequest({
      ip: clientIP,
      action: 'startup_sequence',
      userResponse: 'YES',
      status: 'success',
    });

    return res.status(200).json({
      status: 'starting',
      message: 'System activation confirmed. Runtime and ngrok tunnel starting.',
    });
  } catch (error) {
    console.error('[Activation] Error during activation:', error);

    activationLoggerService.logActivationRequest({
      ip: clientIP,
      action: 'activation_requested',
      userResponse: null,
      status: 'error',
      error: error.message,
    });

    return res.status(500).json({
      status: 'error',
      message: error.message || 'Activation process failed',
    });
  }
}

/**
 * Gets recent activation logs
 */
function getActivationLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = activationLoggerService.getRecentLogs(limit);

    return res.status(200).json({
      logs,
      total: logs.length,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to retrieve activation logs',
    });
  }
}

/**
 * Gets runtime status including ngrok tunnel info
 */
async function getRuntimeStatus(req, res) {
  try {
    const status = runtimeManager.getStatus();
    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to get runtime status',
    });
  }
}

/**
 * Gets runtime debug information
 */
async function getRuntimeDebug(req, res) {
  try {
    const debug = runtimeManager.getDebugInfo();
    return res.status(200).json(debug);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to get runtime debug info',
    });
  }
}

/**
 * Manually restarts ngrok tunnel
 */
async function restartNgrok(req, res) {
  try {
    const port = parseInt(req.body.port) || parseInt(process.env.NGROK_PORT || process.env.PORT || '4000', 10);

    console.log('[SystemController] Manual ngrok restart requested, port:', port);
    runtimeLogger.log('Manual ngrok restart requested', { port, ip: req.ip });

    const success = await runtimeManager.restartNgrok(port);

    if (!success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to restart ngrok',
      });
    }

    const status = runtimeManager.getStatus();
    return res.status(200).json({
      status: 'restarting',
      runtimeStatus: status,
      message: 'ngrok restart initiated',
    });
  } catch (error) {
    runtimeLogger.error('Manual ngrok restart failed', { error: error.message });
    return res.status(500).json({
      error: error.message || 'Failed to restart ngrok',
    });
  }
}

/**
 * Gets runtime logs
 */
async function getRuntimeLogs(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level || null;

    let logs;
    if (level === 'error') {
      logs = runtimeLogger.getErrorLogs(limit);
    } else if (level === 'warn') {
      logs = runtimeLogger.getLogsByLevel('warn', limit);
    } else {
      logs = runtimeLogger.getRecentLogs(limit);
    }

    const fileInfo = runtimeLogger.getLogFileInfo();

    return res.status(200).json({
      logs,
      total: logs.length,
      fileInfo,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to retrieve runtime logs',
    });
  }
}

/**
 * Clears runtime logs
 */
async function clearRuntimeLogs(req, res) {
  try {
    runtimeLogger.clearLogs();
    runtimeLogger.log('Runtime logs cleared by user');

    return res.status(200).json({
      message: 'Runtime logs cleared',
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to clear runtime logs',
    });
  }
}

module.exports = {
  activate,
  clearRuntimeLogs,
  errorLog,
  getActivationLogs,
  getAIDiagnostics,
  getRuntimeDebug,
  getRuntimeLogs,
  getRuntimeStatus,
  restartNgrok,
  start,
  stop,
  status,
};
