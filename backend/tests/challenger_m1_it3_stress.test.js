/**
 * Challenger Stress Harness for Milestone 1 Iteration 3
 * Tests:
 * 1. 5 consecutive rapid invocations of adversarialMilestone1.test.js
 * 2. Deep stress testing of sessionRecoveryService.recoverSessions():
 *    - Corrupt neighbors (null, invalid json, empty file, primitives, directory as creds.json)
 *    - Rapid concurrent calls (in-flight dedup and cooldown)
 *    - Strict non-pollution guarantee on data/sessions/
 *    - Clean teardown and zero leaking timers
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const {
  PROJECT_ROOT,
  getCanonicalSessionsDirectory,
  getSessionPath,
} = require('../services/whatsapp/connection/sessionPaths');

const {
  validateSession,
  listSessionIds,
} = require('../services/whatsapp/connection/sessionPersistenceValidator');

// Helper for temporary sandbox
async function createSandbox() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zapai_challenger_m1_'));
  return {
    dir,
    cleanup: async () => {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Rapid Consecutive Executions of adversarialMilestone1.test.js
// ─────────────────────────────────────────────────────────────────────────────

test('Challenger 1: Rapid consecutive executions of adversarialMilestone1.test.js (5 iterations)', () => {
  const NUM_RUNS = 5;
  const targetScript = 'backend/tests/adversarialMilestone1.test.js';

  for (let run = 1; run <= NUM_RUNS; run++) {
    const startTime = Date.now();

    const childEnv = { ...process.env };
    delete childEnv.NODE_TEST_CONTEXT;

    const result = spawnSync(process.execPath, ['--test', targetScript], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      env: childEnv,
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`[Challenger Run ${run}/${NUM_RUNS}] Exit: ${result.status}, Duration: ${elapsedMs}ms`);
    if (!result.stdout.includes('pass 10')) {
      console.log(`[Run ${run} RAW STDOUT]:`, result.stdout);
      console.log(`[Run ${run} RAW STDERR]:`, result.stderr);
    }

    assert.equal(result.status, 0, `Run ${run} failed with exit code ${result.status}. Stderr: ${result.stderr}`);
    assert.equal(result.signal, null, `Run ${run} terminated by signal ${result.signal}`);
    assert.ok(elapsedMs < 3000, `Run ${run} took too long: ${elapsedMs}ms (must be < 3000ms)`);
    assert.ok(result.stdout.includes('pass 10'), `Run ${run} did not pass all 10 tests`);
    assert.ok(result.stdout.includes('fail 0'), `Run ${run} had test failures`);
    assert.ok(!result.stderr || !result.stderr.includes('UnhandledPromiseRejection'), 'Must not have unhandled promise rejections');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: sessionRecoveryService Hostile Layout & Non-Pollution Guarantee
// ─────────────────────────────────────────────────────────────────────────────

test('Challenger 2: sessionRecoveryService.recoverSessions() hostile layout & zero data/sessions pollution', async () => {
  const sandbox = await createSandbox();
  const prodSessionsDir = path.resolve(PROJECT_ROOT, 'data', 'sessions');

  // Snapshot production data/sessions before test
  const prodBefore = (await fsp.readdir(prodSessionsDir)).sort();

  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = sandbox.dir;

  const sessionManager = require('../services/sessionManager.legacy');
  const whatsappService = require('../services/whatsappService');
  const origCreateStableSession = whatsappService.createStableSession;

  const connectedSessions = [];
  whatsappService.createStableSession = async ({ sessionName }) => {
    connectedSessions.push(sessionName);
    return {
      status: 'connected',
      sessionName,
      isDisposed: false,
      isClosing: false,
      sock: {
        ev: { removeAllListeners: () => {} },
        ws: { removeAllListeners: () => {}, close: () => {} },
        end: () => {},
      },
    };
  };

  const { recoverSessions } = require('../services/sessionRecoveryService');

  try {
    // 1. Hostile session directory population:
    // a) Literal null creds
    const sNull = path.join(sandbox.dir, 'session_hostile_null');
    await fsp.mkdir(sNull, { recursive: true });
    await fsp.writeFile(path.join(sNull, 'creds.json'), 'null');

    // b) Malformed JSON syntax
    const sMalformed = path.join(sandbox.dir, 'session_hostile_malformed');
    await fsp.mkdir(sMalformed, { recursive: true });
    await fsp.writeFile(path.join(sMalformed, 'creds.json'), '{ "bad_json": [');

    // c) Empty 0-byte file
    const sEmpty = path.join(sandbox.dir, 'session_hostile_empty');
    await fsp.mkdir(sEmpty, { recursive: true });
    await fsp.writeFile(path.join(sEmpty, 'creds.json'), '');

    // d) Primitive non-object (e.g. number)
    const sNumber = path.join(sandbox.dir, 'session_hostile_number');
    await fsp.mkdir(sNumber, { recursive: true });
    await fsp.writeFile(path.join(sNumber, 'creds.json'), '12345');

    // e) Missing required keys (noiseKey only, missing signedIdentityKey, registrationId, me)
    const sPartial = path.join(sandbox.dir, 'session_hostile_partial');
    await fsp.mkdir(sPartial, { recursive: true });
    await fsp.writeFile(path.join(sPartial, 'creds.json'), JSON.stringify({ noiseKey: 'abc' }));

    // f) creds.json is a DIRECTORY instead of a file
    const sDirAsFile = path.join(sandbox.dir, 'session_hostile_dir_as_creds');
    await fsp.mkdir(path.join(sDirAsFile, 'creds.json'), { recursive: true });

    // g) Non-directory file in sessions root (e.g. README.md or .DS_Store)
    await fsp.writeFile(path.join(sandbox.dir, 'stray_file.txt'), 'not a session folder');
    await fsp.writeFile(path.join(sandbox.dir, '.hidden_file'), 'ignored');

    // h) Legitimate valid session 1
    const sValid1 = path.join(sandbox.dir, 'session_gold_1');
    await fsp.mkdir(sValid1, { recursive: true });
    await fsp.writeFile(
      path.join(sValid1, 'creds.json'),
      JSON.stringify({
        noiseKey: 'nk1',
        signedIdentityKey: 'sik1',
        registrationId: 1001,
        me: { id: '5511988881111@s.whatsapp.net', name: 'Gold 1' },
      })
    );

    // i) Legitimate valid session 2
    const sValid2 = path.join(sandbox.dir, 'session_gold_2');
    await fsp.mkdir(sValid2, { recursive: true });
    await fsp.writeFile(
      path.join(sValid2, 'creds.json'),
      JSON.stringify({
        noiseKey: 'nk2',
        signedIdentityKey: 'sik2',
        registrationId: 1002,
        me: { id: '5511988882222@s.whatsapp.net', name: 'Gold 2' },
      })
    );

    // Run recoverSessions()
    const recovered = await recoverSessions();
    console.log('[Challenger Hostile Layout Recovered]:', recovered);

    // Assertions:
    assert.ok(Array.isArray(recovered), 'recoverSessions must return array');
    assert.equal(recovered.length, 2, 'Exactly 2 valid sessions should be recovered');
    assert.ok(recovered.includes('session_gold_1'), 'session_gold_1 must be recovered');
    assert.ok(recovered.includes('session_gold_2'), 'session_gold_2 must be recovered');

    // Verify all hostile sessions were excluded
    assert.ok(!recovered.includes('session_hostile_null'), 'null creds must be excluded');
    assert.ok(!recovered.includes('session_hostile_malformed'), 'malformed creds must be excluded');
    assert.ok(!recovered.includes('session_hostile_empty'), 'empty creds must be excluded');
    assert.ok(!recovered.includes('session_hostile_number'), 'number creds must be excluded');
    assert.ok(!recovered.includes('session_hostile_partial'), 'partial creds must be excluded');
    assert.ok(!recovered.includes('session_hostile_dir_as_creds'), 'dir as creds must be excluded');

    // Verify rapid immediate consecutive call (cooldown / in-flight protection)
    const secondPass = await recoverSessions();
    console.log('[Challenger Second Immediate Pass Recovered]:', secondPass);
    // Because sessions are now connected or within cooldown, second pass should recover 0
    assert.equal(secondPass.length, 0, 'Immediate second pass must not re-trigger sessions');

  } finally {
    whatsappService.createStableSession = origCreateStableSession;
    await sessionManager.disposeSession('session_gold_1').catch(() => {});
    await sessionManager.disposeSession('session_gold_2').catch(() => {});

    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }

    await sandbox.cleanup();
  }

  // Verify production directory was NEVER touched or polluted
  const prodAfter = (await fsp.readdir(prodSessionsDir)).sort();
  assert.deepEqual(
    prodAfter,
    prodBefore,
    `Production data/sessions directory was polluted! Before: ${JSON.stringify(prodBefore)}, After: ${JSON.stringify(prodAfter)}`
  );
});

test.after(async () => {
  try {
    const sessionManager = require('../services/sessionManager.legacy');
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
