const fs = require('fs/promises');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'logs', 'frontend_errors.log');

function normalizeErrorPayload(payload = {}) {
  return {
    error: String(payload.error || payload.message || 'Unknown frontend error'),
    page: String(payload.page || 'unknown'),
    stack: String(payload.stack || ''),
    timestamp: payload.timestamp || new Date().toISOString(),
  };
}

async function appendErrorLog(payload = {}) {
  const normalized = normalizeErrorPayload(payload);
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.appendFile(LOG_FILE, `${JSON.stringify(normalized)}\n`, 'utf8');
  return normalized;
}

async function readErrorLogs(limit = 50) {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = lines
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return parsed.slice(-Math.max(1, Number(limit) || 50)).reverse();
  } catch {
    return [];
  }
}

module.exports = {
  appendErrorLog,
  readErrorLogs,
};
