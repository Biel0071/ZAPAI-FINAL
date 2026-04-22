/**
 * Local Runtime Agent for ZapFlow
 * 
 * This agent runs on the user's machine and listens for activation requests
 * from the Lovable frontend. It manages the local runtime (Node.js server)
 * and ngrok tunnel automatically.
 * 
 * Architecture:
 * Lovable Frontend → Supabase API → ngrok tunnel → localRuntimeAgent (RUNTIME_AGENT_PORT)
 * 
 * Endpoint: POST /system/activate
 * - Receives activation request from frontend
 * - Starts local runtime if not running
 * - Starts ngrok tunnel
 * - Returns status
 * 
 * Endpoint: GET /system/runtime/status
 * - Returns current runtime and ngrok status
 * - Frontend polls this to detect connection
 */

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ============================================================================
// Configuration
// ============================================================================

const AGENT_PORT = Number(process.env.RUNTIME_AGENT_PORT) || 4010;
const BACKEND_PORT = Number(process.env.RUNTIME_TARGET_PORT || process.env.PORT) || 4000;
const LOG_DIR = path.join(__dirname, 'logs');
const RUNTIME_LOG_FILE = path.join(LOG_DIR, 'runtime.log');
const NGROK_URL_FILE = path.join(LOG_DIR, 'ngrok_url.json');
const LOCK_FILE = path.join(LOG_DIR, 'runtime.lock');

// Timing configuration
const NGROK_HEALTH_CHECK_INTERVAL = 5000; // 5 seconds
const STARTUP_DELAY = 3000; // 3 seconds before starting ngrok
const MAX_RESTART_ATTEMPTS = 3;
const NGROK_API_URL = 'http://127.0.0.1:4040/api/tunnels';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Ensure logs directory exists
 */
function ensureLogDirectory() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Log runtime events to file and console
 */
function log(level, message, metadata = {}) {
  ensureLogDirectory();

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...metadata,
  };

  const logLine = JSON.stringify(logEntry);
  console.log(`[${level.toUpperCase()}] ${message}`, metadata);

  try {
    fs.appendFileSync(RUNTIME_LOG_FILE, logLine + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

/**
 * Get client IP from request
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

/**
 * Check if a process is already running on a port
 */
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(true)); // Port in use
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Read ngrok tunnel URL from API
 */
async function getNgrokTunnelURL() {
  try {
    const response = await new Promise((resolve, reject) => {
      http.get(NGROK_API_URL, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON from ngrok API'));
          }
        });
      }).on('error', reject);
    });

    if (response.tunnels && response.tunnels.length > 0) {
      const httpsProxy = response.tunnels.find((t) => t.proto === 'https');
      if (httpsProxy) {
        return httpsProxy.public_url;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Save ngrok tunnel URL to file
 */
function saveNgrokURL(url) {
  ensureLogDirectory();
  try {
    const data = {
      url,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(NGROK_URL_FILE, JSON.stringify(data, null, 2));
    log('info', 'ngrok URL saved', { url });
  } catch (error) {
    log('error', 'Failed to save ngrok URL', { error: error.message });
  }
}

// ============================================================================
// Runtime State Management
// ============================================================================

class RuntimeState {
  constructor() {
    this.nodeProcess = null;
    this.ngrokProcess = null;
    this.nodePID = null;
    this.ngrokPID = null;
    this.runtimeRunning = false;
    this.ngrokRunning = false;
    this.ngrokURL = null;
    this.restartAttempts = 0;
    this.lastHealthCheck = null;
    this.healthCheckInterval = null;
  }

  /**
   * Check if runtime is currently running
   */
  isRuntimeRunning() {
    return this.runtimeRunning && this.nodePID !== null;
  }

  /**
   * Check if ngrok is connected
   */
  isNgrokConnected() {
    return this.ngrokRunning && this.ngrokURL !== null;
  }

  /**
   * Create lock file to prevent multiple instances
   */
  createLockFile() {
    ensureLogDirectory();
    if (!fs.existsSync(LOCK_FILE)) {
      fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, timestamp: new Date().toISOString() }));
      log('info', 'Runtime lock file created');
    }
  }

  /**
   * Remove lock file on shutdown
   */
  removeLockFile() {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
        log('info', 'Runtime lock file removed');
      }
    } catch (error) {
      log('error', 'Failed to remove lock file', { error: error.message });
    }
  }

  /**
   * Check if another runtime instance is already running
   */
  isAnotherInstanceRunning() {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const data = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
        const storedPID = data.pid;

        // Check if that PID is still running (Windows: tasklist, Unix: ps)
        try {
          if (process.platform === 'win32') {
            const output = require('child_process').execSync(`tasklist | find "${storedPID}"`).toString();
            if (output.includes(storedPID)) {
              return true;
            }
          } else {
            require('child_process').execSync(`ps -p ${storedPID}`);
            return true;
          }
        } catch {
          // Process not found, lock file is stale
          fs.unlinkSync(LOCK_FILE);
        }
      }
      return false;
    } catch (error) {
      log('error', 'Error checking for another instance', { error: error.message });
      return false;
    }
  }
}

const runtimeState = new RuntimeState();

// ============================================================================
// Process Management
// ============================================================================

/**
 * Start the local Node.js runtime server
 */
async function startNodeRuntime() {
  return new Promise((resolve, reject) => {
    try {
      log('info', 'Starting Node.js runtime...', { action: 'startup_sequence' });

      const nodeProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        detached: true,
        env: {
          ...process.env,
          PORT: String(BACKEND_PORT),
        },
        stdio: 'ignore', // Don't inherit parent's stdio
        windowsHide: true,
      });

      runtimeState.nodeProcess = nodeProcess;
      runtimeState.nodePID = nodeProcess.pid;
      runtimeState.runtimeRunning = true;

      nodeProcess.unref(); // Allow parent to exit independently

      log('info', 'Node.js runtime started', {
        action: 'startup_sequence',
        nodePID: nodeProcess.pid,
      });

      // Give server time to start
      setTimeout(() => {
        resolve(true);
      }, 1000);
    } catch (error) {
      log('error', 'Failed to start Node.js runtime', {
        action: 'startup_sequence',
        error: error.message,
      });
      reject(error);
    }
  });
}

/**
 * Start ngrok tunnel
 */
async function startNgrokTunnel() {
  return new Promise((resolve, reject) => {
    try {
      log('info', 'Starting ngrok tunnel...', { action: 'ngrok_startup' });

      const ngrokProcess = spawn('ngrok', ['http', String(BACKEND_PORT)], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });

      runtimeState.ngrokProcess = ngrokProcess;
      runtimeState.ngrokPID = ngrokProcess.pid;
      runtimeState.ngrokRunning = true;

      ngrokProcess.unref();

      log('info', 'ngrok tunnel started', {
        action: 'ngrok_startup',
        backendPort: BACKEND_PORT,
        ngrokPID: ngrokProcess.pid,
      });

      // Wait for tunnel to be ready
      let attempts = 0;
      const checkTunnel = async () => {
        attempts++;
        const url = await getNgrokTunnelURL();

        if (url) {
          runtimeState.ngrokURL = url;
          saveNgrokURL(url);
          log('info', 'ngrok tunnel connected', { url, attempts });
          resolve(true);
        } else if (attempts < 30) {
          setTimeout(checkTunnel, 500);
        } else {
          log('error', 'ngrok tunnel failed to connect', { attempts });
          reject(new Error('ngrok tunnel connection timeout'));
        }
      };

      checkTunnel();
    } catch (error) {
      log('error', 'Failed to start ngrok tunnel', {
        action: 'ngrok_startup',
        error: error.message,
      });
      reject(error);
    }
  });
}

/**
 * Health check for ngrok tunnel
 */
async function healthCheckNgrok() {
  try {
    const url = await getNgrokTunnelURL();

    if (url) {
      runtimeState.ngrokURL = url;
      runtimeState.ngrokRunning = true;
      runtimeState.restartAttempts = 0; // Reset on success
      runtimeState.lastHealthCheck = new Date().toISOString();
      return true;
    } else {
      runtimeState.ngrokRunning = false;
      return false;
    }
  } catch (error) {
    log('warn', 'ngrok health check failed', { error: error.message });
    runtimeState.ngrokRunning = false;
    return false;
  }
}

/**
 * Start health check loop for ngrok
 */
function startHealthCheckLoop() {
  if (runtimeState.healthCheckInterval) {
    clearInterval(runtimeState.healthCheckInterval);
  }

  runtimeState.healthCheckInterval = setInterval(async () => {
    const isHealthy = await healthCheckNgrok();

    if (!isHealthy && runtimeState.ngrokRunning) {
      log('warn', 'ngrok tunnel down, attempting restart...', {
        restartAttempts: runtimeState.restartAttempts,
      });

      if (runtimeState.restartAttempts < MAX_RESTART_ATTEMPTS) {
        runtimeState.restartAttempts++;
        await startNgrokTunnel().catch((error) => {
          log('error', 'Failed to restart ngrok', { error: error.message });
        });
      } else {
        log('error', 'Max ngrok restart attempts exceeded', {
          maxAttempts: MAX_RESTART_ATTEMPTS,
        });
      }
    }
  }, NGROK_HEALTH_CHECK_INTERVAL);
}

/**
 * Stop ngrok tunnel
 */
function stopNgrok() {
  try {
    if (runtimeState.ngrokPID) {
      process.kill(-runtimeState.ngrokPID); // Kill process group
      runtimeState.ngrokRunning = false;
      log('info', 'ngrok tunnel stopped');
    }
  } catch (error) {
    log('error', 'Failed to stop ngrok', { error: error.message });
  }
}

/**
 * Stop Node.js runtime
 */
function stopNodeRuntime() {
  try {
    if (runtimeState.nodePID) {
      process.kill(-runtimeState.nodePID);
      runtimeState.runtimeRunning = false;
      log('info', 'Node.js runtime stopped');
    }
  } catch (error) {
    log('error', 'Failed to stop Node.js runtime', { error: error.message });
  }
}

// ============================================================================
// Express Setup
// ============================================================================

const app = express();
app.use(express.json());

/**
 * POST /system/activate
 * Receives activation request and starts runtime if not running
 */
app.post('/system/activate', async (req, res) => {
  const clientIP = getClientIP(req);

  log('info', 'Activation request received', {
    ip: clientIP,
    action: 'activation_requested',
    status: 'pending',
  });

  try {
    // Check if another instance already running
    if (runtimeState.isAnotherInstanceRunning()) {
      log('warn', 'Another runtime instance already running', {
        ip: clientIP,
        action: 'activation_requested',
        status: 'already_running',
      });

      return res.status(409).json({
        status: 'already_running',
        message: 'Runtime is already running',
      });
    }

    // Check if runtime already running in this process
    if (runtimeState.isRuntimeRunning() && runtimeState.isNgrokConnected()) {
      log('info', 'Runtime already running, returning status', {
        ip: clientIP,
        action: 'activation_requested',
        status: 'already_running',
      });

      return res.json({
        status: 'already_running',
        message: 'Runtime already running',
        ngrok: runtimeState.ngrokURL,
      });
    }

    // Start runtime and ngrok
    log('info', 'Starting processes...', {
      ip: clientIP,
      action: 'startup_sequence',
    });

    // Start Node.js server
    await startNodeRuntime();

    // Wait before starting ngrok
    await new Promise((resolve) => setTimeout(resolve, STARTUP_DELAY));

    // Start ngrok tunnel
    await startNgrokTunnel();

    // Start health check loop
    startHealthCheckLoop();

    log('info', 'Runtime startup complete', {
      ip: clientIP,
      action: 'startup_sequence',
      status: 'success',
      ngrokURL: runtimeState.ngrokURL,
    });

    res.json({
      status: 'starting',
      message: 'Runtime and ngrok tunnel starting',
      ngrok: runtimeState.ngrokURL,
    });
  } catch (error) {
    log('error', 'Failed to start runtime', {
      ip: clientIP,
      action: 'startup_sequence',
      status: 'error',
      error: error.message,
    });

    res.status(500).json({
      status: 'error',
      message: `Failed to start runtime: ${error.message}`,
    });
  }
});

/**
 * GET /system/runtime/status
 * Returns current runtime and ngrok status
 * Frontend polls this endpoint to detect connection
 */
app.get('/system/runtime/status', async (req, res) => {
  const runtime = runtimeState.isRuntimeRunning() ? 'running' : 'stopped';
  const ngrok = runtimeState.isNgrokConnected() ? 'connected' : runtimeState.ngrokRunning ? 'connecting' : 'offline';

  res.json({
    runtime,
    ngrok,
    ngrokURL: runtimeState.ngrokURL || null,
    nodePID: runtimeState.nodePID || null,
    ngrokPID: runtimeState.ngrokPID || null,
    uptime: runtimeState.lastHealthCheck,
  });
});

/**
 * GET /system/runtime/logs
 * Returns recent log entries
 */
app.get('/system/runtime/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    if (!fs.existsSync(RUNTIME_LOG_FILE)) {
      return res.json({ logs: [] });
    }

    const logs = fs
      .readFileSync(RUNTIME_LOG_FILE, 'utf8')
      .split('\n')
      .filter((line) => line.trim())
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });

    res.json({ logs });
  } catch (error) {
    log('error', 'Failed to read logs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /system/stop
 * Manually stop runtime and ngrok
 */
app.post('/system/stop', (req, res) => {
  try {
    log('info', 'Stop request received');

    stopNgrok();
    stopNodeRuntime();

    if (runtimeState.healthCheckInterval) {
      clearInterval(runtimeState.healthCheckInterval);
    }

    res.json({
      status: 'stopped',
      message: 'Runtime and ngrok tunnel stopped',
    });
  } catch (error) {
    log('error', 'Failed to stop runtime', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// Server Startup
// ============================================================================

function startRuntimeAgent() {
  ensureLogDirectory();
  runtimeState.createLockFile();

  const server = app.listen(AGENT_PORT, '127.0.0.1', () => {
    log('info', `Local Runtime Agent started on port ${AGENT_PORT}`, {
      action: 'agent_startup',
      backendPort: BACKEND_PORT,
      port: AGENT_PORT,
      timestamp: new Date().toISOString(),
    });

    console.log(`
╔════════════════════════════════════════════════════════════╗
║         ZapFlow Local Runtime Agent                       ║
║         Listening on http://127.0.0.1:${AGENT_PORT}                    ║
╚════════════════════════════════════════════════════════════╝

Endpoints:
  POST /system/activate    - Start runtime and ngrok
  GET  /system/runtime/status - Check runtime status
  GET  /system/runtime/logs   - View recent logs
  POST /system/stop        - Stop runtime
  GET  /health            - Health check

Log file: ${RUNTIME_LOG_FILE}
Backend target port: ${BACKEND_PORT}
`);
  });

  // Graceful shutdown
  function shutdown() {
    log('info', 'Shutdown signal received');

    stopNgrok();
    stopNodeRuntime();
    runtimeState.removeLockFile();

    if (runtimeState.healthCheckInterval) {
      clearInterval(runtimeState.healthCheckInterval);
    }

    server.close(() => {
      log('info', 'Runtime Agent stopped');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      log('error', 'Forced shutdown');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ============================================================================
// Exports
// ============================================================================

if (require.main === module) {
  startRuntimeAgent();
}

module.exports = {
  app,
  startRuntimeAgent,
  runtimeState,
  startNodeRuntime,
  startNgrokTunnel,
  stopNgrok,
  stopNodeRuntime,
  getNgrokTunnelURL,
};
