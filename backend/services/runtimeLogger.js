const fs = require('fs');
const path = require('path');

const RUNTIME_LOG_PATH = path.join(__dirname, '..', 'logs', 'runtime.log');
const MAX_LOG_ENTRIES = 5000;
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const QUIET_CONSOLE =
  String(process.env.LOG_CONSOLE_QUIET || (process.env.NODE_ENV === 'production' ? 'true' : 'false'))
    .trim()
    .toLowerCase() === 'true';

/**
 * Runtime Logger
 * Logs runtime events: ngrok startup, health checks, restarts, errors
 */

/**
 * Ensures the logs directory exists
 */
function ensureLogsDirectory() {
  const logsDir = path.dirname(RUNTIME_LOG_PATH);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * Rotates log file if it exceeds max size
 */
function rotateLogFileIfNeeded() {
  try {
    ensureLogsDirectory();

    if (!fs.existsSync(RUNTIME_LOG_PATH)) {
      return;
    }

    const stats = fs.statSync(RUNTIME_LOG_PATH);

    if (stats.size > MAX_LOG_FILE_SIZE) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = RUNTIME_LOG_PATH.replace('.log', `-backup-${timestamp}.log`);

      fs.renameSync(RUNTIME_LOG_PATH, backupPath);
      console.log('[RuntimeLogger] Log file rotated to:', backupPath);

      // Keep only last 3 backup files
      const logsDir = path.dirname(RUNTIME_LOG_PATH);
      const backupFiles = fs
        .readdirSync(logsDir)
        .filter((f) => f.startsWith('runtime-backup-'))
        .sort()
        .reverse();

      for (let i = 3; i < backupFiles.length; i++) {
        fs.unlinkSync(path.join(logsDir, backupFiles[i]));
      }
    }
  } catch (error) {
    console.error('[RuntimeLogger] Error rotating log file:', error);
  }
}

/**
 * Writes a log entry
 */
function writeLogEntry(level, message, data = {}) {
  try {
    ensureLogsDirectory();
    rotateLogFileIfNeeded();

    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      ...data,
    };

    const logLine = JSON.stringify(entry) + '\n';

    fs.appendFileSync(RUNTIME_LOG_PATH, logLine, 'utf8');

    // Also log to console unless quiet mode is enabled.
    if (!QUIET_CONSOLE) {
      const prefix = `[${timestamp}] [${level}]`;
      if (level === 'error') {
        console.error(prefix, message, data);
      } else if (level === 'warn') {
        console.warn(prefix, message, data);
      } else {
        console.log(prefix, message, data);
      }
    }
  } catch (error) {
    console.error('[RuntimeLogger] Failed to write log entry:', error);
  }
}

/**
 * Logs an info message
 */
function log(message, data) {
  writeLogEntry('info', message, data);
}

/**
 * Logs a warning message
 */
function warn(message, data) {
  writeLogEntry('warn', message, data);
}

/**
 * Logs an error message
 */
function error(message, data) {
  writeLogEntry('error', message, data);
}

/**
 * Reads recent log entries
 */
function getRecentLogs(limit = 100) {
  try {
    ensureLogsDirectory();

    if (!fs.existsSync(RUNTIME_LOG_PATH)) {
      return [];
    }

    const content = fs.readFileSync(RUNTIME_LOG_PATH, 'utf8');
    const lines = content
      .split('\n')
      .filter((line) => line.trim())
      .slice(-limit);

    return lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return {
          timestamp: new Date().toISOString(),
          level: 'unknown',
          message: line,
        };
      }
    });
  } catch (error) {
    console.error('[RuntimeLogger] Failed to read logs:', error);
    return [];
  }
}

/**
 * Gets logs filtered by level
 */
function getLogsByLevel(level, limit = 100) {
  try {
    const allLogs = getRecentLogs(limit * 2); // Get more to ensure we have enough after filtering
    return allLogs.filter((entry) => entry.level === level).slice(-limit);
  } catch (error) {
    console.error('[RuntimeLogger] Failed to filter logs:', error);
    return [];
  }
}

/**
 * Gets error logs
 */
function getErrorLogs(limit = 50) {
  return getLogsByLevel('error', limit);
}

/**
 * Clears all logs
 */
function clearLogs() {
  try {
    ensureLogsDirectory();

    if (fs.existsSync(RUNTIME_LOG_PATH)) {
      fs.unlinkSync(RUNTIME_LOG_PATH);
    }

    console.log('[RuntimeLogger] Logs cleared');
  } catch (error) {
    console.error('[RuntimeLogger] Failed to clear logs:', error);
  }
}

/**
 * Gets log file info
 */
function getLogFileInfo() {
  try {
    ensureLogsDirectory();

    if (!fs.existsSync(RUNTIME_LOG_PATH)) {
      return {
        exists: false,
        size: 0,
        sizeReadable: '0 bytes',
      };
    }

    const stats = fs.statSync(RUNTIME_LOG_PATH);

    return {
      exists: true,
      path: RUNTIME_LOG_PATH,
      size: stats.size,
      sizeReadable: formatBytes(stats.size),
      modifiedAt: new Date(stats.mtime).toISOString(),
    };
  } catch (error) {
    console.error('[RuntimeLogger] Failed to get log file info:', error);
    return { error: error.message };
  }
}

/**
 * Formats bytes to readable format
 */
function formatBytes(bytes) {
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

module.exports = {
  clearLogs,
  error,
  getErrorLogs,
  getLogFileInfo,
  getLogsByLevel,
  getRecentLogs,
  log,
  warn,
};
