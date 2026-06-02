/**
 * Connection/session logging helpers.
 * Extracted from whatsappService.legacy.js (Phase 2b-1).
 *
 * - `pushConnectionLog` mutates the `session` object passed in (legacy
 *   contract).
 * - `logSessionEvent` writes a structured log line to the console AND
 *   to `logs/whatsapp.log` via the central logger (stabilization phase 1).
 *
 * No module-scoped mutable state.
 */

const { whatsappLog } = require('../../logger');

function pushConnectionLog(session, level, event, message) {
  if (!session) {
    return;
  }

  if (!Array.isArray(session.connectionLogs)) {
    session.connectionLogs = [];
  }

  session.connectionLogs.push({
    event,
    level,
    message,
    timestamp: new Date().toISOString(),
  });

  if (session.connectionLogs.length > 50) {
    session.connectionLogs = session.connectionLogs.slice(-50);
  }
}

function logSessionEvent(level, event, session, details = {}) {
  const normalizedLevel = String(level || 'info').toLowerCase();
  const payload = {
    timestamp: new Date().toISOString(),
    level: normalizedLevel,
    scope: 'whatsapp_session',
    event,
    sessionId: session?.sessionId || null,
    sessionName: session?.sessionName || session?.displayName || null,
    status: session?.status || null,
    ...details,
  };

  // Persist to logs/whatsapp.log (JSON, rotated + masked by central logger).
  whatsappLog(normalizedLevel, event, event, {
    sessionId: payload.sessionId,
    sessionName: payload.sessionName,
    status: payload.status,
    ...details,
  });

}

module.exports = {
  logSessionEvent,
  pushConnectionLog,
};
