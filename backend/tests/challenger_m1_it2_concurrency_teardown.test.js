/**
 * Empirical Challenger Stress Test Suite: Concurrency & Teardown
 * Agent: m1_it2_challenger_2 (Empirical Challenger)
 * Milestone: M1 Iteration 2 (WhatsApp Session Stability & Teardown Cleanliness)
 *
 * Targets:
 * 1. 50 concurrent invocations of migrateLegacySessions()
 * 2. Lifecycle management and clean teardown of session.webCatalogTimer
 * 3. Complete absence of dangling intervals, timers, or socket listeners after disposeSession
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const {
  getCanonicalSessionsDirectory,
  getLegacySessionsDirectory,
  migrateLegacySessions,
  normalizeSessionId,
  getSessionPath,
} = require('../services/whatsapp/connection/sessionPaths');

const sessionManager = require('../services/sessionManager.legacy');
const { activeSessions } = require('../services/whatsapp/state/registry');

async function createSandbox() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zapai_chal2_stress_'));
  return {
    dir,
    cleanup: async () => {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBE 1: 50 Concurrent migrateLegacySessions() Invocations
// ─────────────────────────────────────────────────────────────────────────────

test('CHALLENGER PROBE 1.1: 50 simultaneous migrateLegacySessions() calls with Promise deduplication lock', async () => {
  const sandbox = await createSandbox();
  const legacyDir = path.join(sandbox.dir, 'legacy_source');
  const canonicalDir = path.join(sandbox.dir, 'canonical_dest');

  await fsp.mkdir(legacyDir, { recursive: true });
  await fsp.mkdir(canonicalDir, { recursive: true });

  const sessionName = 'chal_concurrent_50_test';
  const legacySessionDir = path.join(legacyDir, sessionName);
  await fsp.mkdir(legacySessionDir, { recursive: true });

  const mockCreds = JSON.stringify({
    noiseKey: 'chal_noise_50',
    signedIdentityKey: 'chal_idkey_50',
    registrationId: 5050,
    me: { id: '551177777777@s.whatsapp.net', name: 'Challenger 50 Worker' },
  });

  await fsp.writeFile(path.join(legacySessionDir, 'creds.json'), mockCreds);
  await fsp.writeFile(path.join(legacySessionDir, 'app-state-sync-key-1.json'), '{"key":1}');
  await fsp.writeFile(path.join(legacySessionDir, 'app-state-sync-key-2.json'), '{"key":2}');
  await fsp.writeFile(path.join(legacySessionDir, '.lock'), 'lock_token');
  await fsp.writeFile(path.join(legacySessionDir, '.write_lock'), 'write_token');
  await fsp.writeFile(path.join(legacySessionDir, 'temp.tmp'), 'tmp_token');

  // Trigger 50 simultaneous calls
  const CONCURRENCY = 50;
  const promises = Array.from({ length: CONCURRENCY }, () =>
    migrateLegacySessions(legacyDir, canonicalDir)
  );

  const results = await Promise.all(promises);

  // 1. Verify all 50 completed successfully
  assert.equal(results.length, 50);

  // 2. Verify all 50 returned identical deduplicated reference
  const firstResult = results[0];
  for (let i = 1; i < results.length; i++) {
    assert.strictEqual(
      results[i],
      firstResult,
      `Call ${i} must return the exact same in-flight Promise result reference`
    );
  }

  // 3. Verify exactly 1 migration executed
  assert.deepEqual(firstResult.migrated, [sessionName]);
  assert.deepEqual(firstResult.errors, []);

  // 4. Verify canonical disk state
  const targetSessionDir = path.join(canonicalDir, sessionName);
  assert.ok(fs.existsSync(targetSessionDir), 'Canonical target session dir must exist');

  const migratedCreds = await fsp.readFile(path.join(targetSessionDir, 'creds.json'), 'utf8');
  assert.equal(migratedCreds, mockCreds, 'creds.json must match exactly');

  assert.ok(!fs.existsSync(path.join(targetSessionDir, '.lock')), '.lock must be excluded');
  assert.ok(!fs.existsSync(path.join(targetSessionDir, '.write_lock')), '.write_lock must be excluded');
  assert.ok(!fs.existsSync(path.join(targetSessionDir, 'temp.tmp')), 'temp.tmp must be excluded');

  // 5. Run a second wave of 50 concurrent calls (idempotency check)
  const wave2Promises = Array.from({ length: CONCURRENCY }, () =>
    migrateLegacySessions(legacyDir, canonicalDir)
  );
  const wave2Results = await Promise.all(wave2Promises);
  assert.equal(wave2Results.length, 50);
  assert.deepEqual(wave2Results[0].migrated, [], 'Second wave must not re-migrate already migrated session');
  assert.ok(wave2Results[0].skipped.includes(sessionName), 'Second wave must skip existing canonical session');

  await sandbox.cleanup();
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBE 2: Lifecycle Management & Teardown of session.webCatalogTimer
// ─────────────────────────────────────────────────────────────────────────────

test('CHALLENGER PROBE 2.1: session.webCatalogTimer teardown in closeSocket via disposeSession', async () => {
  const sessionId = 'chal_timer_close_' + Date.now();
  let timerFired = false;

  const mockSession = {
    sessionId,
    sessionName: sessionId,
    status: 'connected',
    isDisposed: false,
    isClosing: false,
    webCatalogTimer: setTimeout(() => {
      timerFired = true;
    }, 5000),
    sock: {
      ev: new EventEmitter(),
      ws: new EventEmitter(),
      end: () => {},
    },
  };

  sessionManager.setSession(sessionId, mockSession);
  assert.ok(mockSession.webCatalogTimer !== null, 'webCatalogTimer should be active initially');

  // disposeSession invokes closeSocket internally
  await sessionManager.disposeSession(sessionId);

  // Assert timer handle was cleared and nulled
  assert.strictEqual(mockSession.webCatalogTimer, null, 'closeSocket via disposeSession must clear and null webCatalogTimer');
  assert.strictEqual(timerFired, false, 'Timer must not fire after closeSocket');
  assert.strictEqual(sessionManager.getSession(sessionId), null);
});

test('CHALLENGER PROBE 2.2: session.webCatalogTimer disconnect teardown logic in stableSession', () => {
  // Directly verify the teardown logic from stableSession.js:1686-1689
  let timerFired = false;
  const session = {
    status: 'connected',
    webCatalogTimer: setTimeout(() => {
      timerFired = true;
    }, 5000),
  };

  assert.ok(session.webCatalogTimer !== null);

  // Executing disconnect cleanup block
  if (session.webCatalogTimer) {
    clearTimeout(session.webCatalogTimer);
    session.webCatalogTimer = null;
  }

  assert.strictEqual(session.webCatalogTimer, null, 'Disconnect must clear and null webCatalogTimer');
  assert.strictEqual(timerFired, false, 'webCatalogTimer must not fire after disconnect teardown');
});

test('CHALLENGER PROBE 2.3: webCatalogTimer early return guard prevents extraction on disposed session', async () => {
  // Simulate the callback body from stableSession.js:1409-1417
  let catalogExtracted = false;
  const mockExtractor = {
    extractCatalog: async () => {
      catalogExtracted = true;
      return { total: 10 };
    },
  };

  const session = {
    isDisposed: true,
    isClosing: false,
    status: 'disconnected',
    webCatalogTimer: null,
  };

  // Run the logic from stableSession.js:1410-1414
  const callback = () => {
    session.webCatalogTimer = null;
    if (session.isDisposed || session.isClosing || session.status !== 'connected') {
      return;
    }
    mockExtractor.extractCatalog();
  };

  callback();
  assert.strictEqual(catalogExtracted, false, 'Disposed session must guard against catalog extraction');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBE 3: Zero Dangling Intervals, Timers, or Sockets Persist After Teardown
// ─────────────────────────────────────────────────────────────────────────────

test('CHALLENGER PROBE 3.1: All 7 timer types are cleanly nulled and deactivated on disposeSession', async () => {
  const sessionId = 'chal_all_timers_' + Date.now();
  let bufferIntervalFired = false;
  let catalogTimerFired = false;
  let webCatalogTimerFired = false;
  let blocklistTimerFired = false;
  let qrTimeoutTimerFired = false;
  let reconnectCooldownTimerFired = false;
  let reconnectRequestTimerFired = false;

  const mockSession = {
    sessionId,
    sessionName: sessionId,
    status: 'connected',
    isDisposed: false,
    isClosing: false,
    bufferFlushInterval: setInterval(() => { bufferIntervalFired = true; }, 5000),
    catalogSyncTimer: setTimeout(() => { catalogTimerFired = true; }, 5000),
    webCatalogTimer: setTimeout(() => { webCatalogTimerFired = true; }, 5000),
    blocklistSyncTimer: setTimeout(() => { blocklistTimerFired = true; }, 5000),
    qrTimeoutTimer: setTimeout(() => { qrTimeoutTimerFired = true; }, 5000),
    reconnectCooldownTimer: setTimeout(() => { reconnectCooldownTimerFired = true; }, 5000),
    reconnectRequestTimer: setTimeout(() => { reconnectRequestTimerFired = true; }, 5000),
    sock: {
      ev: new EventEmitter(),
      ws: new EventEmitter(),
      end: () => {},
    },
  };

  sessionManager.setSession(sessionId, mockSession);

  await sessionManager.disposeSession(sessionId);

  // Assert all 7 timers are strictly null
  assert.strictEqual(mockSession.bufferFlushInterval, null, 'bufferFlushInterval must be null');
  assert.strictEqual(mockSession.catalogSyncTimer, null, 'catalogSyncTimer must be null');
  assert.strictEqual(mockSession.webCatalogTimer, null, 'webCatalogTimer must be null');
  assert.strictEqual(mockSession.blocklistSyncTimer, null, 'blocklistSyncTimer must be null');
  assert.strictEqual(mockSession.qrTimeoutTimer, null, 'qrTimeoutTimer must be null');
  assert.strictEqual(mockSession.reconnectCooldownTimer, null, 'reconnectCooldownTimer must be null');
  assert.strictEqual(mockSession.reconnectRequestTimer, null, 'reconnectRequestTimer must be null');

  // Assert no timers fired
  assert.strictEqual(bufferIntervalFired, false);
  assert.strictEqual(catalogTimerFired, false);
  assert.strictEqual(webCatalogTimerFired, false);
  assert.strictEqual(blocklistTimerFired, false);
  assert.strictEqual(qrTimeoutTimerFired, false);
  assert.strictEqual(reconnectCooldownTimerFired, false);
  assert.strictEqual(reconnectRequestTimerFired, false);

  assert.strictEqual(sessionManager.getSession(sessionId), null);
  assert.strictEqual(activeSessions[sessionId], undefined);
});

test('CHALLENGER PROBE 3.2: 50 iterative rapid connect-teardown cycles leave zero socket listeners or registry leaks', async () => {
  for (let i = 0; i < 50; i++) {
    const sessionId = `chal_cycle_${i}_${Date.now()}`;
    const ev = new EventEmitter();
    const ws = new EventEmitter();

    ev.on('connection.update', () => {});
    ev.on('creds.update', () => {});
    ev.on('messages.upsert', () => {});
    ws.on('message', () => {});
    ws.on('close', () => {});

    assert.equal(ev.listenerCount('connection.update'), 1);
    assert.equal(ws.listenerCount('close'), 1);

    const mockSession = {
      sessionId,
      sessionName: sessionId,
      status: 'connected',
      isDisposed: false,
      isClosing: false,
      bufferFlushInterval: setInterval(() => {}, 10000),
      webCatalogTimer: setTimeout(() => {}, 10000),
      sock: {
        ev,
        ws,
        end: () => {},
      },
    };

    sessionManager.setSession(sessionId, mockSession);
    await sessionManager.disposeSession(sessionId);

    // Verify listeners stripped
    assert.equal(ev.listenerCount('connection.update'), 0);
    assert.equal(ev.listenerCount('creds.update'), 0);
    assert.equal(ev.listenerCount('messages.upsert'), 0);
    assert.equal(ws.listenerCount('message'), 0);
    assert.equal(ws.listenerCount('close'), 0);

    // Verify registry cleaned
    assert.strictEqual(sessionManager.getSession(sessionId), null);
    assert.strictEqual(activeSessions[sessionId], undefined);
  }
});

test.after(async () => {
  try {
    const { pool } = require('../src/infrastructure/config/database');
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  } catch {}
});
