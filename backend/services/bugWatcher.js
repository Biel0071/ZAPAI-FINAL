const fs = require('fs');
const path = require('path');
const { getLogger, LOG_DIRECTORY } = require('./logger');

const runtimeLogger = getLogger('system');
const RUNTIME_ERRORS_FILE = path.join(LOG_DIRECTORY, 'runtime_errors.log');
const recentBugs = [];
let initialized = false;

fs.mkdirSync(LOG_DIRECTORY, { recursive: true });

function emitSystemError(payload) {
  global.io?.emit('system_error', payload);
}

function appendRuntimeError(payload) {
  fs.appendFileSync(RUNTIME_ERRORS_FILE, `${JSON.stringify(payload)}\n`);
}

function buildPayload(type, error) {
  return {
    message: error?.message || String(error),
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    type,
  };
}

function captureError(type, error, options = {}) {
  const payload = buildPayload(type, error);
  recentBugs.unshift(payload);

  if (recentBugs.length > 50) {
    recentBugs.length = 50;
  }

  runtimeLogger.error(`[${type}] ${payload.message}`, payload);
  appendRuntimeError(payload);
  emitSystemError(payload);

  if (options.recoverable && typeof options.onRetry === 'function') {
    setTimeout(() => {
      Promise.resolve(options.onRetry()).catch((retryError) => {
        const retryPayload = buildPayload(`${type}_retry_failed`, retryError);
        runtimeLogger.error(`[${type}] retry failed`, retryPayload);
        appendRuntimeError(retryPayload);
        emitSystemError(retryPayload);
      });
    }, Number(options.retryDelayMs) || 2000);
  }
}

function initializeBugWatcher() {
  if (initialized) {
    return;
  }

  initialized = true;

  process.on('unhandledRejection', (error) => {
    captureError('unhandled_promise_rejection', error);
  });

  process.on('uncaughtException', (error) => {
    captureError('uncaught_exception', error);
  });
}

function getRecentBugs(limit = 20) {
  return recentBugs.slice(0, Math.max(0, Number(limit) || 20));
}

module.exports = {
  captureError,
  getRecentBugs,
  initializeBugWatcher,
};
