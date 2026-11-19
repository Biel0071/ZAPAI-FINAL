const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DisconnectReason,
  MAX_RECONNECT_ATTEMPTS,
  TERMINAL_DISCONNECT_CODES,
  TRANSIENT_DISCONNECT_CODES,
  computeReconnectBackoff,
  getConnectionCloseCode,
  isTerminalDisconnect,
  shouldReconnect,
} = require('../services/whatsapp/connection/reconnect');
const sessionManager = require('../services/sessionManager.legacy');

test('reconnect - DisconnectReason constants and classification', () => {
  assert.equal(DisconnectReason.loggedOut, 401);
  assert.equal(DisconnectReason.forbidden, 403);
  assert.equal(DisconnectReason.restartRequired, 515);
  assert.equal(DisconnectReason.timedOut, 408);
  assert.equal(DisconnectReason.connectionClosed, 428);
  assert.equal(DisconnectReason.badSession, 500);

  // Terminal codes
  assert.ok(TERMINAL_DISCONNECT_CODES.has(401));
  assert.ok(TERMINAL_DISCONNECT_CODES.has(403));
  assert.ok(TERMINAL_DISCONNECT_CODES.has(411));
  assert.ok(TERMINAL_DISCONNECT_CODES.has(440));

  // Transient codes
  assert.ok(TRANSIENT_DISCONNECT_CODES.has(515));
  assert.ok(TRANSIENT_DISCONNECT_CODES.has(408));
  assert.ok(TRANSIENT_DISCONNECT_CODES.has(428));
  assert.ok(TRANSIENT_DISCONNECT_CODES.has(500));
  assert.ok(TRANSIENT_DISCONNECT_CODES.has(503));
});

test('reconnect - getConnectionCloseCode extracts code from multiple payload shapes', () => {
  assert.equal(getConnectionCloseCode({ error: { output: { statusCode: 401 } } }), 401);
  assert.equal(getConnectionCloseCode({ error: { data: { statusCode: 515 } } }), 515);
  assert.equal(getConnectionCloseCode({ error: { statusCode: 500 } }), 500);
  assert.equal(getConnectionCloseCode({ statusCode: 408 }), 408);
  assert.equal(getConnectionCloseCode(403), 403);
  assert.equal(getConnectionCloseCode(null), null);
});

test('reconnect - isTerminalDisconnect and shouldReconnect', () => {
  // Terminal
  assert.equal(isTerminalDisconnect({ error: { output: { statusCode: 401 } } }), true);
  assert.equal(isTerminalDisconnect({ error: { output: { statusCode: 403 } } }), true);
  assert.equal(shouldReconnect({ error: { output: { statusCode: 401 } } }), false);
  assert.equal(shouldReconnect({ error: { output: { statusCode: 403 } } }), false);

  // Transient
  assert.equal(isTerminalDisconnect({ error: { output: { statusCode: 515 } } }), false);
  assert.equal(isTerminalDisconnect({ error: { output: { statusCode: 408 } } }), false);
  assert.equal(shouldReconnect({ error: { output: { statusCode: 515 } } }), true);
  assert.equal(shouldReconnect({ error: { output: { statusCode: 500 } } }), true);
  assert.equal(shouldReconnect(null), true);
});

test('reconnect - computeReconnectBackoff fast reconnect for code 515 <= 500ms', () => {
  const delay515 = computeReconnectBackoff(1, 515);
  assert.ok(delay515 >= 0 && delay515 <= 500, `515 delay (${delay515}ms) must be <= 500ms`);

  const customFast = computeReconnectBackoff(2, 515, { fastDelayMs: 300 });
  assert.equal(customFast, 300);
});

test('reconnect - computeReconnectBackoff returns -1 for terminal disconnects and max retries', () => {
  // Terminal
  assert.equal(computeReconnectBackoff(1, 401), -1);
  assert.equal(computeReconnectBackoff(1, 403), -1);
  assert.equal(computeReconnectBackoff(1, 411), -1);
  assert.equal(computeReconnectBackoff(1, 440), -1);

  // Exceeding max attempts (default 25)
  assert.equal(computeReconnectBackoff(26, 408), -1);
  assert.equal(computeReconnectBackoff(10, 408, { maxAttempts: 5 }), -1);
});

test('reconnect - computeReconnectBackoff exponential backoff with jitter for transient codes', () => {
  const delayAtt1 = computeReconnectBackoff(1, 500, { baseMs: 5000, jitterMs: 0 });
  const delayAtt2 = computeReconnectBackoff(2, 500, { baseMs: 5000, jitterMs: 0 });
  const delayAtt3 = computeReconnectBackoff(3, 500, { baseMs: 5000, jitterMs: 0 });

  assert.equal(delayAtt1, 5000);
  assert.equal(delayAtt2, 10000);
  assert.equal(delayAtt3, 20000);

  // With jitter, it should be >= base and < base + jitter
  const jittered = computeReconnectBackoff(1, 500, { baseMs: 5000, jitterMs: 1000 });
  assert.ok(jittered >= 5000 && jittered <= 6000);
});

test('sessionManager - closeSocket completely tears down all intervals, timers, and listeners', async () => {
  let evListenersRemoved = false;
  let wsListenersRemoved = false;
  let wsClosed = false;
  let socketEnded = false;

  let bufferIntervalCleared = false;
  let catalogTimerCleared = false;
  let blocklistTimerCleared = false;
  let qrTimerCleared = false;
  let reconnectTimerCleared = false;

  const mockBufferInterval = setInterval(() => {}, 10000);
  const mockCatalogTimer = setTimeout(() => {}, 10000);
  const mockBlocklistTimer = setTimeout(() => {}, 10000);
  const mockQrTimer = setTimeout(() => {}, 10000);
  const mockReconnectTimer = setTimeout(() => {}, 10000);

  const mockSession = {
    bufferFlushInterval: mockBufferInterval,
    catalogSyncTimer: mockCatalogTimer,
    blocklistSyncTimer: mockBlocklistTimer,
    qrTimeoutTimer: mockQrTimer,
    reconnectCooldownTimer: mockReconnectTimer,
    reconnecting: true,
    sock: {
      ev: {
        removeAllListeners: () => { evListenersRemoved = true; },
      },
      ws: {
        removeAllListeners: () => { wsListenersRemoved = true; },
        close: () => { wsClosed = true; },
      },
      end: () => { socketEnded = true; },
    },
  };

  // We test disposeSession or startSession's internal closeSocket via a session
  // In sessionManager.legacy.js, closeSocket is invoked in disposeSession
  sessionManager.setSession('test_teardown_session', mockSession);
  await sessionManager.disposeSession('test_teardown_session');

  assert.equal(mockSession.bufferFlushInterval, null);
  assert.equal(mockSession.catalogSyncTimer, null);
  assert.equal(mockSession.blocklistSyncTimer, null);
  assert.equal(mockSession.qrTimeoutTimer, null);
  assert.equal(mockSession.reconnectCooldownTimer, null);
  assert.equal(evListenersRemoved, true);
  assert.equal(wsListenersRemoved, true);
  assert.equal(wsClosed, true);
  assert.equal(socketEnded, true);
  assert.equal(mockSession.status, 'disconnected');
  assert.equal(sessionManager.getSession('test_teardown_session'), null);

  // Clean any active timers just in case
  clearInterval(mockBufferInterval);
  clearTimeout(mockCatalogTimer);
  clearTimeout(mockBlocklistTimer);
  clearTimeout(mockQrTimer);
  clearTimeout(mockReconnectTimer);
});

test.after(async () => {
  try {
    const { pool } = require('../src/infrastructure/config/database');
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  } catch {}
});

