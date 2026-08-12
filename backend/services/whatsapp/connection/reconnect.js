/**
 * Pure connection-reason helpers for Baileys sessions.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 *
 * These functions inspect a `lastDisconnect` object produced by Baileys and
 * decide whether the session should attempt to reconnect. They are pure —
 * no timers, no socket state, no side effects.
 *
 * NOTE: folder is named `connection/` (not `sessions/`) because the project
 * `.gitignore` matches any `sessions/` directory as persisted auth data.
 * Source code belongs here.
 */

const DisconnectReason = {
  connectionClosed: 428,
  connectionLost: 408,
  connectionReplaced: 440,
  timedOut: 408,
  loggedOut: 401,
  badSession: 500,
  restartRequired: 515,
  multideviceMismatch: 411,
  forbidden: 403,
  unavailableService: 503
};

// Terminal = credencial realmente invalidada; só volta reescaneando o QR.
// Apenas o logout real (401), replaced (440), multidevice mismatch (411) e
// forbidden (403) são irrecuperáveis. badSession (500) NÃO é logout — é uma
// sessão dessincronizada, quase sempre recuperável reconectando — por isso é
// tratado como transiente (o backoff exponencial evita loop abusivo).
const TERMINAL_DISCONNECT_CODES = new Set(
  [
    DisconnectReason.loggedOut,
    DisconnectReason.connectionReplaced,
    DisconnectReason.multideviceMismatch,
    DisconnectReason.forbidden,
  ].filter((code) => Number.isFinite(code))
);

const TRANSIENT_DISCONNECT_CODES = new Set(
  [
    DisconnectReason.restartRequired,
    DisconnectReason.connectionClosed,
    DisconnectReason.connectionLost,
    DisconnectReason.timedOut,
    DisconnectReason.badSession,
    DisconnectReason.unavailableService,
  ].filter((code) => Number.isFinite(code))
);

function getConnectionCloseCode(lastDisconnect) {
  return (
    lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.data?.statusCode ||
    lastDisconnect?.error?.statusCode ||
    null
  );
}

function shouldReconnect(lastDisconnect) {
  const closeCode = getConnectionCloseCode(lastDisconnect);

  if (closeCode == null) {
    return true;
  }

  if (TERMINAL_DISCONNECT_CODES.has(closeCode)) {
    return false;
  }

  if (TRANSIENT_DISCONNECT_CODES.size === 0) {
    return true;
  }

  return TRANSIENT_DISCONNECT_CODES.has(closeCode) || !TERMINAL_DISCONNECT_CODES.has(closeCode);
}

function isTerminalDisconnect(lastDisconnect) {
  const closeCode = getConnectionCloseCode(lastDisconnect);
  return TERMINAL_DISCONNECT_CODES.has(closeCode);
}

module.exports = {
  getConnectionCloseCode,
  isTerminalDisconnect,
  shouldReconnect,
};
