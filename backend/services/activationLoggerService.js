const fs = require('fs');
const path = require('path');

const ACTIVATION_LOG_PATH = path.join(__dirname, '..', 'logs', 'activation_log.json');

/**
 * Ensures the logs directory exists
 */
function ensureLogsDirectory() {
  const logsDir = path.dirname(ACTIVATION_LOG_PATH);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * Loads existing activation logs
 * @returns {Array} - Array of activation log entries
 */
function loadActivationLogs() {
  ensureLogsDirectory();

  if (!fs.existsSync(ACTIVATION_LOG_PATH)) {
    return [];
  }

  try {
    const content = fs.readFileSync(ACTIVATION_LOG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[ActivationLogger] Failed to load logs:', error);
    return [];
  }
}

/**
 * Logs an activation request
 * @param {Object} logEntry - Log entry with timestamp, ip, action, result
 */
function logActivationRequest(logEntry) {
  try {
    ensureLogsDirectory();

    const logs = loadActivationLogs();

    const entry = {
      timestamp: new Date().toISOString(),
      ip: logEntry.ip || 'unknown',
      action: logEntry.action || 'request',
      userResponse: logEntry.userResponse || null,
      status: logEntry.status || null,
      error: logEntry.error || null,
    };

    logs.push(entry);

    // Keep only last 1000 entries to avoid huge log files
    const recentLogs = logs.slice(-1000);

    fs.writeFileSync(
      ACTIVATION_LOG_PATH,
      JSON.stringify(recentLogs, null, 2),
      'utf8'
    );

    console.log(
      `[ActivationLogger] ${entry.action} from ${entry.ip}: ${entry.userResponse}`
    );
  } catch (error) {
    console.error('[ActivationLogger] Failed to log activation request:', error);
  }
}

/**
 * Gets recent activation logs
 * @param {number} limit - Number of logs to retrieve (default 50)
 * @returns {Array} - Recent activation logs
 */
function getRecentLogs(limit = 50) {
  const logs = loadActivationLogs();
  return logs.slice(-limit);
}

/**
 * Clears all activation logs
 */
function clearLogs() {
  try {
    ensureLogsDirectory();
    fs.writeFileSync(ACTIVATION_LOG_PATH, JSON.stringify([], null, 2), 'utf8');
    console.log('[ActivationLogger] Logs cleared');
  } catch (error) {
    console.error('[ActivationLogger] Failed to clear logs:', error);
  }
}

module.exports = {
  logActivationRequest,
  getRecentLogs,
  clearLogs,
  loadActivationLogs,
};
