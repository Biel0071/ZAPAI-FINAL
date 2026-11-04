/**
 * Pure connection-reason helpers for Baileys sessions.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 * Feature F1.3 (Milestone 1).
 *
 * These functions inspect a `lastDisconnect` object produced by Baileys and
 * decide whether the session should attempt to reconnect, calculate backoff delay,
 * and classify error codes. They are pure — no timers, no socket state, no side effects.
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
  unavailableService: 503,
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

const MAX_RECONNECT_ATTEMPTS = 25;

function getConnectionCloseCode(lastDisconnect) {
  if (typeof lastDisconnect === 'number' && Number.isFinite(lastDisconnect)) {
    return lastDisconnect;
  }
  return (
    lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.data?.statusCode ||
    lastDisconnect?.error?.statusCode ||
    lastDisconnect?.statusCode ||
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
  return closeCode != null && TERMINAL_DISCONNECT_CODES.has(closeCode);
}

/**
 * Computes backoff delay in milliseconds for reconnection attempt.
 *
 * Requirements:
 * - Code 515 (restartRequired): Fast reconnect <= 500ms.
 * - Terminal codes (401, 403, etc.): returns -1 (no reconnect).
 * - Exceeding max attempts: returns -1.
 * - Transient codes: exponential backoff with randomized jitter.
 *
 * @param {number} attempt - 1-based reconnect attempt count.
 * @param {number|object|null} closeCodeOrDisconnect - Status code or lastDisconnect object.
 * @param {object} [options]
 * @param {number} [options.baseMs=5000] - Base backoff in ms.
 * @param {number} [options.maxMs=60000] - Max backoff in ms.
 * @param {number} [options.maxAttempts=25] - Max reconnect attempts.
 * @param {number} [options.jitterMs=1000] - Max randomized jitter in ms.
 * @param {number} [options.fastDelayMs=200] - Fixed delay for code 515 in ms (<= 500).
 * @returns {number} Delay in milliseconds, or -1 if no reconnection should occur.
 */
function computeReconnectBackoff(attempt = 1, closeCodeOrDisconnect = null, options = {}) {
  const closeCode = getConnectionCloseCode(closeCodeOrDisconnect);
  const maxAttempts = options.maxAttempts || MAX_RECONNECT_ATTEMPTS;

  if (closeCode != null && TERMINAL_DISCONNECT_CODES.has(closeCode)) {
    return -1;
  }

  const normalizedAttempt = Math.max(1, Number(attempt) || 1);
  if (normalizedAttempt > maxAttempts) {
    return -1;
  }

  // Fast reconnect for Baileys restartRequired (code 515)
  if (closeCode === DisconnectReason.restartRequired) {
    const fastDelay = options.fastDelayMs !== undefined
      ? Math.min(500, Math.max(0, options.fastDelayMs))
      : 200;
    return fastDelay;
  }

  const baseMs = options.baseMs || 5000;
  const maxMs = options.maxMs || 60000;
  const expDelay = Math.min(baseMs * Math.pow(2, normalizedAttempt - 1), maxMs);

  const jitterRange = options.jitterMs !== undefined ? options.jitterMs : 1000;
  const jitter = jitterRange > 0 ? Math.floor(Math.random() * jitterRange) : 0;

  return Math.round(expDelay + jitter);
}

module.exports = {
  DisconnectReason,
  MAX_RECONNECT_ATTEMPTS,
  TERMINAL_DISCONNECT_CODES,
  TRANSIENT_DISCONNECT_CODES,
  computeReconnectBackoff,
  getConnectionCloseCode,
  isTerminalDisconnect,
  shouldReconnect,
};
