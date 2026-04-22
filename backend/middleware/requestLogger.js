const { requestLog } = require('../services/logger');

const LOGGED_PREFIXES = [
  '/api',
  '/auth',
  '/sessions',
  '/session',
  '/messages',
  '/conversations',
  '/metrics',
  '/health',
  '/status-whatsapp',
  '/system',
];

function shouldLogRequest(pathname = '') {
  return LOGGED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function createRequestLogger() {
  return function requestLogger(req, res, next) {
    const startedAt = Date.now();

    res.on('finish', () => {
      const pathToLog = String(req.path || req.originalUrl || '');
      if (!shouldLogRequest(pathToLog)) {
        return;
      }

      const durationMs = Date.now() - startedAt;
      const payload = {
        durationMs,
        method: req.method,
        path: req.originalUrl,
        requestId: req.requestId || '-',
        scope: 'api_request',
        statusCode: res.statusCode,
        tenantId: req.tenantId || req.companyId || null,
        ip: req.ip || req.socket?.remoteAddress || null,
        timestamp: new Date().toISOString(),
      };

      // Persist to logs/requests.log (JSON Lines, rotation + masking
      // applied by the central logger).
      requestLog(payload);
    });

    next();
  };
}

module.exports = {
  createRequestLogger,
};
