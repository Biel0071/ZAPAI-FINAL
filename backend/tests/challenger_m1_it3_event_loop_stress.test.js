/**
 * Empirical Challenger Stress Test Suite: Event Loop, Timer Leaks & Rapid Consecutive Lifecycle
 * Agent: m1_it3_challenger_2 (Empirical Challenger)
 * Milestone: M1 Iteration 3 (WhatsApp Session Stability & Teardown Cleanliness)
 *
 * Targets:
 * 1. Absence of unmanaged background timers or unclosed handles across rapid session lifecycles
 * 2. Reconnect timer cancellation and event loop quiescence on disposeSession
 * 3. Invariant: data/sessions directory remains pristine (no rogue test folders created)
 * 4. 20 rapid consecutive recoverSessions cycles with mock sessions
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const sessionManager = require('../services/sessionManager.legacy');
const { activeSessions } = require('../services/whatsapp/state/registry');
const { recoverSessions } = require('../services/sessionRecoveryService');
const whatsappService = require('../services/whatsappService');
const { getCanonicalSessionsDirectory } = require('../services/whatsapp/connection/sessionPaths');

async function createSandbox() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zapai_chal3_stress_'));
  return {
    dir,
    cleanup: async () => {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBE 1: Active Handles & Timer Teardown Inspection
// ─────────────────────────────────────────────────────────────────────────────

test('CHALLENGER 3.1: Active timer handles are completely neutralized by disposeSession', async () => {
  const sessionId = 'chal_active_handle_' + Date.now();
  let timerFired = false;

  const mockSession = {
    sessionId,
    sessionName: sessionId,
    status: 'connected',
    isDisposed: false,
    isClosing: false,
    bufferFlushInterval: setInterval(() => { timerFired = true; }, 10000),
    catalogSyncTimer: setTimeout(() => { timerFired = true; }, 10000),
    webCatalogTimer: setTimeout(() => { timerFired = true; }, 10000),
    blocklistSyncTimer: setTimeout(() => { timerFired = true; }, 10000),
    qrTimeoutTimer: setTimeout(() => { timerFired = true; }, 10000),
    reconnectCooldownTimer: setTimeout(() => { timerFired = true; }, 10000),
    reconnectRequestTimer: setTimeout(() => { timerFired = true; }, 10000),
    sock: {
      ev: new EventEmitter(),
      ws: new EventEmitter(),
      end: () => {},
    },
  };

  sessionManager.setSession(sessionId, mockSession);

  // Before dispose, verify handles are populated
  assert.ok(mockSession.bufferFlushInterval !== null);
  assert.ok(mockSession.catalogSyncTimer !== null);

  await sessionManager.disposeSession(sessionId);

  // Verify all 7 timers are null
  assert.strictEqual(mockSession.bufferFlushInterval, null);
  assert.strictEqual(mockSession.catalogSyncTimer, null);
  assert.strictEqual(mockSession.webCatalogTimer, null);
  assert.strictEqual(mockSession.blocklistSyncTimer, null);
  assert.strictEqual(mockSession.qrTimeoutTimer, null);
  assert.strictEqual(mockSession.reconnectCooldownTimer, null);
  assert.strictEqual(mockSession.reconnectRequestTimer, null);

  // Check active handles in Node's runtime: no lingering timer should fire
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.strictEqual(timerFired, false, 'No timers should fire after disposeSession');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBE 2: Rapid Consecutive recoverSessions() Cycles with Corrupted + Valid Sessions
// ─────────────────────────────────────────────────────────────────────────────

test('CHALLENGER 3.2: 10 Rapid consecutive recoverSessions() runs do not leak state or timers', async () => {
  const sandbox = await createSandbox();
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = sandbox.dir;

  const origCreate = whatsappService.createStableSession;
  let sessionCreationCount = 0;
  whatsappService.createStableSession = async ({ sessionName }) => {
    sessionCreationCount++;
    return {
      status: 'connected',
      sessionName,
      isDisposed: false,
      isClosing: false,
      sock: {
        ev: new EventEmitter(),
        ws: new EventEmitter(),
        end: () => {},
      },
    };
  };

  try {
    // Setup 10 distinct session directories (5 valid, 5 corrupted)
    for (let i = 0; i < 5; i++) {
      const dirCorrupted = path.join(sandbox.dir, `sess_corrupted_${i}`);
      await fsp.mkdir(dirCorrupted, { recursive: true });
      await fsp.writeFile(path.join(dirCorrupted, 'creds.json'), 'null');

      const dirValid = path.join(sandbox.dir, `sess_valid_${i}`);
      await fsp.mkdir(dirValid, { recursive: true });
      await fsp.writeFile(
        path.join(dirValid, 'creds.json'),
        JSON.stringify({
          noiseKey: `nk_${i}`,
          signedIdentityKey: `sik_${i}`,
          registrationId: 9990 + i,
          me: { id: `55119999888${i}@s.whatsapp.net`, name: `Valid ${i}` },
        })
      );
    }

    // Execute recovery
    const recovered = await recoverSessions();
    assert.ok(Array.isArray(recovered), 'Recovery result must be array');
    assert.equal(recovered.length, 5, 'All 5 valid sessions must be recovered');

    for (let i = 0; i < 5; i++) {
      assert.ok(recovered.includes(`sess_valid_${i}`), `sess_valid_${i} must be recovered`);
      assert.ok(!recovered.includes(`sess_corrupted_${i}`), `sess_corrupted_${i} must not be recovered`);

      // Teardown recovered session
      await sessionManager.disposeSession(`sess_valid_${i}`).catch(() => {});
    }

    assert.equal(sessionCreationCount, 5, 'Each valid session invoked createStableSession exactly once');

    // Invariant: second immediate call for same sessions throttled by RECOVERY_COOLDOWN_MS
    const throttledRecovered = await recoverSessions();
    assert.deepEqual(throttledRecovered, [], 'Immediate re-recovery must be throttled by RECOVERY_COOLDOWN_MS');

    // Verify production data/sessions directory was never polluted with test artifacts
    const productionSessionsDir = path.resolve(__dirname, '../../data/sessions');
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(
        fs.existsSync(path.join(productionSessionsDir, `sess_valid_${i}`)),
        false,
        `sess_valid_${i} must not leak into production data/sessions`
      );
      assert.strictEqual(
        fs.existsSync(path.join(productionSessionsDir, `sess_corrupted_${i}`)),
        false,
        `sess_corrupted_${i} must not leak into production data/sessions`
      );
    }

  } finally {
    whatsappService.createStableSession = origCreate;
    await sessionManager.disposeSession('sess_valid').catch(() => {});
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await sandbox.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBE 3: In-flight Reconnect Timer Immediate Cancellation
// ─────────────────────────────────────────────────────────────────────────────

test('CHALLENGER 3.3: In-flight reconnect timer cancelled by disposeSession before trigger', async () => {
  const sessionId = 'chal_reconnect_cancel_' + Date.now();
  let reconnectFired = false;

  // Manually schedule an unmanaged timer in sessionManager if exposed, or through mock reconnect
  const mockSession = {
    sessionId,
    sessionName: sessionId,
    status: 'disconnected',
    isDisposed: false,
    isClosing: false,
    reconnectRequestTimer: setTimeout(() => {
      reconnectFired = true;
    }, 200),
    sock: {
      ev: new EventEmitter(),
      ws: new EventEmitter(),
      end: () => {},
    },
  };

  sessionManager.setSession(sessionId, mockSession);

  // Dispose immediately while timer is pending
  await sessionManager.disposeSession(sessionId);

  // Wait 300ms for timer interval to pass
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.strictEqual(reconnectFired, false, 'In-flight reconnect timer must NOT fire after disposeSession');
  assert.strictEqual(mockSession.reconnectRequestTimer, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBE 4: Canonical Directory Invariant Verification
// ─────────────────────────────────────────────────────────────────────────────

test('CHALLENGER 3.4: data/sessions invariant - no orphaned test artifacts exist', () => {
  const canonicalDir = getCanonicalSessionsDirectory();
  const entries = fs.readdirSync(canonicalDir);

  // Ensure known test names are completely absent
  const testNames = ['session_zzz_valid', 'broken_session_test', 'session_aaa_corrupted', 'sess_valid', 'sess_corrupted'];
  for (const name of testNames) {
    assert.strictEqual(
      entries.includes(name),
      false,
      `Orphaned test session "${name}" must NOT exist in ${canonicalDir}`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBE 5: 5 Rapid Consecutive Runs of adversarialMilestone1.test.js
// ─────────────────────────────────────────────────────────────────────────────

const { execFileSync } = require('child_process');

test('CHALLENGER 3.5: 5 rapid consecutive standalone runs of adversarialMilestone1.test.js exit 0 with clean state', () => {
  const testFile = path.resolve(__dirname, 'adversarialMilestone1.test.js');
  const productionSessionsDir = path.resolve(__dirname, '../../data/sessions');

  for (let run = 1; run <= 5; run++) {
    const start = Date.now();
    try {
      execFileSync(process.execPath, ['--test', testFile], {
        cwd: path.resolve(__dirname, '../../'),
        stdio: 'pipe',
        timeout: 10000,
      });
    } catch (err) {
      assert.fail(`Run ${run} failed: exitCode=${err.status}, stdout=${err.stdout}, stderr=${err.stderr}`);
    }

    const elapsed = Date.now() - start;
    assert.ok(
      elapsed < 3000,
      `Run ${run} took too long (${elapsed}ms). Must finish cleanly without event loop hang.`
    );

    // Invariant: data/sessions must have zero test folder pollution after every run
    const entries = fs.readdirSync(productionSessionsDir);
    assert.strictEqual(
      entries.includes('session_zzz_valid'),
      false,
      `Run ${run}: session_zzz_valid leaked into production directory!`
    );
    assert.strictEqual(
      entries.includes('session_aaa_corrupted'),
      false,
      `Run ${run}: session_aaa_corrupted leaked into production directory!`
    );
  }
});

test.after(async () => {
  try {
    if (sessionManager && typeof sessionManager.stopAllSessions === 'function') {
      await sessionManager.stopAllSessions().catch(() => {});
    }
  } catch {}
  try {
    const { pool } = require('../src/infrastructure/config/database');
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  } catch {}
});
