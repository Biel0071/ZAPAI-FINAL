const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

const LOG_DIRECTORY = path.join(__dirname, '..', 'logs');
// Existing CRM categories (preserved for backwards compatibility with
// callers that still invoke getLogger('system') etc.)
const LEGACY_CATEGORIES = [
  'system',
  'database',
  'sessions',
  'messages',
  'ai',
  'campaigns',
  'microtasks',
];
// Top-level operational streams required by the stabilization plan.
// Each one is backed by a dedicated file under `logs/` with automatic
// rotation (10 MB, keep 5 files).
const OPERATIONAL_CATEGORIES = ['backend', 'errors', 'requests', 'whatsapp'];
const loggers = new Map();

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

fs.mkdirSync(LOG_DIRECTORY, { recursive: true });

// ------------------- Sensitive data masking -----------------------------

const SENSITIVE_KEY_PATTERN = /^(authorization|cookie|set-cookie|x-api-key|token|access_token|refresh_token|password|secret|api_key|apikey)$/i;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

function maskSecretString(value) {
  if (typeof value !== 'string' || !value) {
    return value;
  }
  return value
    .replace(BEARER_PATTERN, 'Bearer ***masked***')
    .replace(JWT_PATTERN, '***jwt***');
}

function redact(value, depth = 0) {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return maskSecretString(value);
  }
  if (typeof value !== 'object' || depth > 6) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, depth + 1));
  }
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '***masked***';
      continue;
    }
    output[key] = redact(entry, depth + 1);
  }
  return output;
}

// Mutate the `info` object in place so winston's internal
// `Symbol.for('level')` / `Symbol.for('message')` markers are preserved.
// Returning a fresh object would strip them and silently drop the log.
const PRESERVED_KEYS = new Set(['level', 'message', 'timestamp', 'stack', 'category']);
const redactFormat = format((info) => {
  for (const key of Object.keys(info)) {
    if (PRESERVED_KEYS.has(key)) {
      continue;
    }
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      info[key] = '***masked***';
    } else {
      info[key] = redact(info[key]);
    }
  }
  if (typeof info.message === 'string') {
    info.message = maskSecretString(info.message);
  }
  return info;
})();

// ------------------- Logger factory -------------------------------------

function buildLogger(category) {
  const isConsoleQuiet = String(process.env.LOG_CONSOLE_QUIET || '').toLowerCase() === 'true';
  const fileTransport = new transports.File({
    filename: path.join(LOG_DIRECTORY, `${category}.log`),
    maxsize: MAX_FILE_SIZE_BYTES,
    maxFiles: MAX_FILES,
    tailable: true,
  });
  const consoleTransport = new transports.Console({
    format: format.combine(format.colorize(), format.simple()),
    silent: isConsoleQuiet,
  });

  return createLogger({
    defaultMeta: { category },
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      redactFormat,
      format.json()
    ),
    level: process.env.LOG_LEVEL || 'info',
    transports: [fileTransport, consoleTransport],
  });
}

function getLogger(category = 'system') {
  const normalizedCategory = [
    ...LEGACY_CATEGORIES,
    ...OPERATIONAL_CATEGORIES,
  ].includes(category)
    ? category
    : 'system';

  if (!loggers.has(normalizedCategory)) {
    loggers.set(normalizedCategory, buildLogger(normalizedCategory));
  }

  return loggers.get(normalizedCategory);
}

// ------------------- High-level helpers ---------------------------------
// These are the recommended entry points for new code. They ensure the
// right stream is used and attach a consistent payload shape.

function backendLog(level, message, context = {}) {
  getLogger('backend').log({ level: level || 'info', message, ...context });
}

function errorLog(error, context = {}) {
  const err = error instanceof Error ? error : new Error(String(error || 'unknown error'));
  getLogger('errors').log({
    level: 'error',
    message: err.message,
    stack: err.stack,
    ...context,
  });
}

function requestLog(entry = {}) {
  // entry: { method, path, statusCode, durationMs, requestId, tenantId, ip }
  getLogger('requests').log({
    level: 'info',
    message: `${entry.method || 'GET'} ${entry.path || ''} ${entry.statusCode || 0}`,
    ...entry,
  });
}

function whatsappLog(level, event, message, context = {}) {
  getLogger('whatsapp').log({
    level: level || 'info',
    message: message || event,
    event,
    ...context,
  });
}

module.exports = {
  LOG_DIRECTORY,
  backendLog,
  errorLog,
  getLogger,
  redact,
  requestLog,
  whatsappLog,
};
