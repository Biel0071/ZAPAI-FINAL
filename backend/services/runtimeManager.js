const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const runtimeLogger = require('./runtimeLogger');

/**
 * Runtime Manager
 * Manages ngrok tunnel and node server processes
 * Performs health checks and auto-restarts on failure
 */

const runtimeState = {
  ngrokProcess: null,
  ngrokConnected: false,
  ngrokUrl: null,
  ngrokStartAttempts: 0,
  lastHealthCheckTime: null,
  lastNgrokRestartTime: null,
  healthCheckInterval: null,
  isMonitoring: false,
};

const CONFIG = {
  NGROK_HEALTH_CHECK_INTERVAL: 5000, // Check every 5 seconds
  NGROK_STARTUP_TIMEOUT: 10000, // Wait 10 seconds for ngrok to start
  NGROK_PORT: process.env.NGROK_PORT || process.env.PORT || 4000,
  NGROK_AUTH_TOKEN: process.env.NGROK_AUTH_TOKEN,
  MAX_RESTART_ATTEMPTS: 3,
  RESTART_DELAY: 2000, // Wait 2 seconds before restart
};

/**
 * Detects ngrok URL from output
 */
function parseNgrokUrl(output) {
  const match = output.match(/(?:https?:\/\/)([a-z0-9-]+\.ngrok(?:-free)?\.dev)/);
  return match ? match[0] : null;
}

/**
 * Starts ngrok tunnel
 */
async function startNgrok(port = CONFIG.NGROK_PORT) {
  return new Promise((resolve, reject) => {
    try {
      const args = ['http', String(port), '--log', 'stdout'];

      // Add auth token if available
      if (CONFIG.NGROK_AUTH_TOKEN) {
        args.unshift('--authtoken', CONFIG.NGROK_AUTH_TOKEN);
      }

      console.log('[RuntimeManager] Starting ngrok with port:', port);
      runtimeLogger.log('Starting ngrok tunnel', { port, args });

      const ngrokProcess = spawn('ngrok', args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let ngrokStarted = false;
      const startTimeout = setTimeout(() => {
        if (!ngrokStarted) {
          ngrokProcess.kill();
          reject(new Error('ngrok startup timeout'));
        }
      }, CONFIG.NGROK_STARTUP_TIMEOUT);

      ngrokProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[ngrok]', output);

        // Detect successful connection
        if (output.includes('established client connection') || output.includes('session established')) {
          if (!ngrokStarted) {
            ngrokStarted = true;
            clearTimeout(startTimeout);

            const ngrokUrl = parseNgrokUrl(output);
            runtimeState.ngrokProcess = ngrokProcess;
            runtimeState.ngrokConnected = true;
            runtimeState.ngrokUrl = ngrokUrl;
            runtimeState.ngrokStartAttempts = 0;

            runtimeLogger.log('ngrok tunnel connected', { url: ngrokUrl });
            console.log('[RuntimeManager] ngrok tunnel connected:', ngrokUrl);

            resolve({
              success: true,
              url: ngrokUrl,
              process: ngrokProcess,
            });
          }
        }
      });

      ngrokProcess.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('[ngrok-error]', error);

        if (!ngrokStarted && error.includes('command not found')) {
          clearTimeout(startTimeout);
          ngrokStarted = true;
          reject(new Error('ngrok is not installed or not in PATH'));
        }
      });

      ngrokProcess.on('error', (err) => {
        clearTimeout(startTimeout);
        console.error('[RuntimeManager] ngrok spawn error:', err);
        runtimeLogger.error('ngrok spawn error', { error: err.message });
        reject(err);
      });

      ngrokProcess.on('exit', (code, signal) => {
        console.log('[RuntimeManager] ngrok process exited with code:', code, 'signal:', signal);
        runtimeLogger.log('ngrok process exited', { code, signal });

        runtimeState.ngrokProcess = null;
        runtimeState.ngrokConnected = false;
        runtimeState.ngrokUrl = null;
      });
    } catch (error) {
      console.error('[RuntimeManager] Failed to spawn ngrok:', error);
      runtimeLogger.error('Failed to spawn ngrok', { error: error.message });
      reject(error);
    }
  });
}

/**
 * Stops ngrok tunnel
 */
async function stopNgrok() {
  return new Promise((resolve) => {
    if (!runtimeState.ngrokProcess) {
      resolve();
      return;
    }

    try {
      console.log('[RuntimeManager] Stopping ngrok...');
      runtimeLogger.log('Stopping ngrok tunnel');

      runtimeState.ngrokProcess.kill('SIGTERM');

      // Force kill after 5 seconds
      const forceKillTimeout = setTimeout(() => {
        if (runtimeState.ngrokProcess) {
          runtimeState.ngrokProcess.kill('SIGKILL');
        }
      }, 5000);

      runtimeState.ngrokProcess.on('exit', () => {
        clearTimeout(forceKillTimeout);
        runtimeState.ngrokProcess = null;
        runtimeState.ngrokConnected = false;
        runtimeState.ngrokUrl = null;
        runtimeLogger.log('ngrok tunnel stopped');
        resolve();
      });
    } catch (error) {
      console.error('[RuntimeManager] Error stopping ngrok:', error);
      runtimeLogger.error('Error stopping ngrok', { error: error.message });
      resolve();
    }
  });
}

/**
 * Health check - verifies ngrok is responsive
 */
async function healthCheckNgrok() {
  if (!runtimeState.ngrokConnected || !runtimeState.ngrokUrl) {
    return false;
  }

  try {
    // Try to access ngrok's local API
    const response = await axios.get('http://127.0.0.1:4040/api/tunnels', {
      timeout: 2000,
    });

    const hasTunnels = response.data?.tunnels?.length > 0;

    if (hasTunnels) {
      runtimeState.lastHealthCheckTime = Date.now();
      return true;
    }

    return false;
  } catch (error) {
    console.log('[RuntimeManager] ngrok health check failed:', error.message);
    return false;
  }
}

/**
 * Auto-restart ngrok if it crashes
 */
async function restartNgrok(port = CONFIG.NGROK_PORT) {
  try {
    runtimeState.ngrokStartAttempts++;

    if (runtimeState.ngrokStartAttempts > CONFIG.MAX_RESTART_ATTEMPTS) {
      console.error(
        '[RuntimeManager] ngrok restart exceeded max attempts (' +
          CONFIG.MAX_RESTART_ATTEMPTS +
          ')'
      );
      runtimeLogger.error('ngrok restart max attempts exceeded', {
        attempts: runtimeState.ngrokStartAttempts,
      });
      return false;
    }

    console.log('[RuntimeManager] Restarting ngrok (attempt', runtimeState.ngrokStartAttempts + '/' + CONFIG.MAX_RESTART_ATTEMPTS + ')');
    runtimeLogger.log('Restarting ngrok tunnel', {
      attempt: runtimeState.ngrokStartAttempts,
      maxAttempts: CONFIG.MAX_RESTART_ATTEMPTS,
    });

    // Wait before restart
    await new Promise((resolve) => setTimeout(resolve, CONFIG.RESTART_DELAY));

    await stopNgrok();
    const result = await startNgrok(port);

    runtimeState.lastNgrokRestartTime = Date.now();
    return result.success;
  } catch (error) {
    console.error('[RuntimeManager] Failed to restart ngrok:', error.message);
    runtimeLogger.error('Failed to restart ngrok', { error: error.message });
    return false;
  }
}

/**
 * Starts monitoring loop for health checks
 */
function startMonitoring(port = CONFIG.NGROK_PORT) {
  if (runtimeState.isMonitoring) {
    console.log('[RuntimeManager] Monitoring already active');
    return;
  }

  runtimeState.isMonitoring = true;
  console.log('[RuntimeManager] Starting health check monitoring');
  runtimeLogger.log('Health check monitoring started');

  // Clear any existing interval
  if (runtimeState.healthCheckInterval) {
    clearInterval(runtimeState.healthCheckInterval);
  }

  runtimeState.healthCheckInterval = setInterval(async () => {
    try {
      const isHealthy = await healthCheckNgrok();

      if (!isHealthy && runtimeState.ngrokConnected) {
        console.warn('[RuntimeManager] ngrok health check failed - attempting restart');
        runtimeLogger.warn('ngrok health check failed', { willRestart: true });

        await restartNgrok(port);
      } else if (isHealthy) {
        // Reset attempt counter on successful check
        if (runtimeState.ngrokStartAttempts > 0) {
          runtimeState.ngrokStartAttempts = 0;
        }
      }
    } catch (error) {
      console.error('[RuntimeManager] Monitoring loop error:', error);
      runtimeLogger.error('Monitoring loop error', { error: error.message });
    }
  }, CONFIG.NGROK_HEALTH_CHECK_INTERVAL);
}

/**
 * Stops monitoring loop
 */
function stopMonitoring() {
  if (runtimeState.healthCheckInterval) {
    clearInterval(runtimeState.healthCheckInterval);
    runtimeState.healthCheckInterval = null;
  }

  runtimeState.isMonitoring = false;
  console.log('[RuntimeManager] Health check monitoring stopped');
  runtimeLogger.log('Health check monitoring stopped');
}

/**
 * Gets current runtime status
 */
function getStatus() {
  return {
    runtime: 'running', // Node server is always running in this context
    ngrok: runtimeState.ngrokConnected ? 'connected' : 'disconnected',
    port: CONFIG.NGROK_PORT,
    tunnel: runtimeState.ngrokUrl || null,
    ngrokProcess: runtimeState.ngrokProcess ? 'active' : 'inactive',
    lastHealthCheck: runtimeState.lastHealthCheckTime
      ? new Date(runtimeState.lastHealthCheckTime).toISOString()
      : null,
    lastNgrokRestart: runtimeState.lastNgrokRestartTime
      ? new Date(runtimeState.lastNgrokRestartTime).toISOString()
      : null,
    ngrokRestartAttempts: runtimeState.ngrokStartAttempts,
  };
}

/**
 * Gets runtime state for debugging
 */
function getDebugInfo() {
  return {
    ...getStatus(),
    isMonitoring: runtimeState.isMonitoring,
    config: {
      NGROK_PORT: CONFIG.NGROK_PORT,
      NGROK_HEALTH_CHECK_INTERVAL: CONFIG.NGROK_HEALTH_CHECK_INTERVAL,
      NGROK_STARTUP_TIMEOUT: CONFIG.NGROK_STARTUP_TIMEOUT,
      MAX_RESTART_ATTEMPTS: CONFIG.MAX_RESTART_ATTEMPTS,
    },
  };
}

/**
 * Initialize runtime manager
 * Starts ngrok and monitoring
 */
async function initialize(port = CONFIG.NGROK_PORT) {
  // Skip ngrok entirely when disabled (production VPS uses Nginx, not ngrok)
  if (process.env.USE_NGROK !== 'true') {
    console.log('[RuntimeManager] Ngrok disabled (USE_NGROK != true). Skipping tunnel.');
    runtimeLogger.log('Ngrok disabled via USE_NGROK env var');
    return { runtime: 'running', ngrok: 'disabled', port, tunnel: null };
  }

  try {
    console.log('[RuntimeManager] Initializing...');
    runtimeLogger.log('Runtime manager initializing');

    // Start ngrok
    await startNgrok(port);

    // Start health check monitoring
    startMonitoring(port);

    console.log('[RuntimeManager] Initialization complete');
    runtimeLogger.log('Runtime manager initialized');

    return getStatus();
  } catch (error) {
    console.error('[RuntimeManager] Initialization failed:', error.message);
    runtimeLogger.error('Runtime manager initialization failed', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Clean up and shutdown
 */
async function shutdown() {
  try {
    console.log('[RuntimeManager] Shutting down...');
    runtimeLogger.log('Runtime manager shutting down');

    stopMonitoring();
    await stopNgrok();

    console.log('[RuntimeManager] Shutdown complete');
    runtimeLogger.log('Runtime manager shutdown complete');
  } catch (error) {
    console.error('[RuntimeManager] Shutdown error:', error);
    runtimeLogger.error('Runtime manager shutdown error', { error: error.message });
  }
}

module.exports = {
  getDebugInfo,
  getStatus,
  initialize,
  restartNgrok,
  shutdown,
  startMonitoring,
  startNgrok,
  stopMonitoring,
  stopNgrok,
};
