/**
 * Adversarial Stress Test Suite for Milestone 1
 * Targets:
 * - sessionPaths.js (canonical resolution, path traversal, normalization)
 * - sessionPersistenceValidator.js (corrupted JSON, primitive JSON, missing keys, directories as files)
 * - migrateLegacySessions() (concurrency, race conditions, file integrity)
 * - session restoration resilience (corrupted sessions mixed with valid ones)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const {
  PROJECT_ROOT,
  getCanonicalSessionsDirectory,
  getLegacySessionsDirectory,
  getSessionPath,
  migrateLegacySessions,
  normalizeSessionId,
} = require('../services/whatsapp/connection/sessionPaths');

const {
  validateSession,
  validateAll,
} = require('../services/whatsapp/connection/sessionPersistenceValidator');

// Helper to create isolated temporary sandbox
async function createSandbox() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zapai_adv_m1_'));
  return {
    dir,
    cleanup: async () => {
      await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Pathological WHATSAPP_SESSIONS_DIR & Path Resolution Probes
// ─────────────────────────────────────────────────────────────────────────────

test('Adversarial 1.1: WHATSAPP_SESSIONS_DIR with trailing slashes, whitespace, and relative paths', () => {
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  try {
    // Trailing slashes and spaces
    process.env.WHATSAPP_SESSIONS_DIR = '   ' + path.join(PROJECT_ROOT, 'data', 'sessions') + '///\\   ';
    const resolved = getCanonicalSessionsDirectory();
    assert.equal(resolved, path.resolve(PROJECT_ROOT, 'data', 'sessions'));

    // Empty or whitespace only -> fallback to default
    process.env.WHATSAPP_SESSIONS_DIR = '     ';
    const fallback = getCanonicalSessionsDirectory();
    assert.equal(fallback, path.resolve(PROJECT_ROOT, 'data', 'sessions'));

    // Relative path resolution
    process.env.WHATSAPP_SESSIONS_DIR = './custom_relative_sessions';
    const relResolved = getCanonicalSessionsDirectory();
    assert.equal(relResolved, path.resolve('./custom_relative_sessions'));
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
  }
});

test('Adversarial 1.2: Path Traversal probing in normalizeSessionId and getSessionPath', () => {
  const canonicalDir = getCanonicalSessionsDirectory();

  // Attack input: relative parent traversal
  const attackInputs = [
    '../../../etc/passwd',
    '..\\..\\windows\\system32',
    'session/../../secret',
    'session\\..\\..\\secret',
    './session_a',
  ];

  for (const attack of attackInputs) {
    const sessionPath = getSessionPath(attack);
    const normalized = normalizeSessionId(attack);
    
    // Check whether sessionPath escapes canonicalDir
    const relativeToCanonical = path.relative(canonicalDir, sessionPath);
    const escapes = relativeToCanonical.startsWith('..') || path.isAbsolute(relativeToCanonical);

    console.log(`[Path Traversal Probe] input="${attack}" -> normalized="${normalized}" -> escapes=${escapes} (${sessionPath})`);
    assert.equal(escapes, false, `Attack input "${attack}" must not escape canonicalDir`);
  }
});

test('Adversarial 1.3: Non-existent directory handling in validateSession and validateAll', async () => {
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  const nonExistentDir = path.join(os.tmpdir(), 'non_existent_dir_' + Date.now());
  process.env.WHATSAPP_SESSIONS_DIR = nonExistentDir;

  try {
    const single = await validateSession('non_existent_session');
    assert.equal(single.ok, false);
    assert.equal(single.dirExists, false);
    assert.ok(single.warnings.some((w) => w.includes('does not exist')));

    const all = await validateAll();
    assert.ok(typeof all.ok === 'boolean');
    assert.equal(all.sessions.length, 0);
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
  }
});

test('Adversarial 1.4: WHATSAPP_SESSIONS_DIR pointing to a regular file instead of a directory', async () => {
  const sandbox = await createSandbox();
  const filePath = path.join(sandbox.dir, 'sessions_as_file.txt');
  await fsp.writeFile(filePath, 'i am a file not a directory');

  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = filePath;

  try {
    const single = await validateSession('test_session');
    assert.equal(single.ok, false);

    const all = await validateAll();
    // When rootDir is a file, fsp.readdir throws ENOTDIR, which is caught and returns []
    assert.equal(all.sessions.length, 0);
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await sandbox.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Corrupted and Partial JSON Stress Testing against validateSession
// ─────────────────────────────────────────────────────────────────────────────

test('Adversarial 2.1: validateSession resilience against empty, truncated, and corrupted creds.json', async () => {
  const sandbox = await createSandbox();
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = sandbox.dir;

  try {
    // 2.1.1: 0-byte creds.json
    const zeroByteDir = path.join(sandbox.dir, 'zero_byte');
    await fsp.mkdir(zeroByteDir, { recursive: true });
    await fsp.writeFile(path.join(zeroByteDir, 'creds.json'), '');
    const resZero = await validateSession('zero_byte');
    assert.equal(resZero.ok, false);
    assert.equal(resZero.credsExists, true);
    assert.equal(resZero.credsValid, false);
    assert.ok(resZero.warnings.some((w) => w.includes('parse error')));

    // 2.1.2: Truncated JSON
    const truncDir = path.join(sandbox.dir, 'truncated_json');
    await fsp.mkdir(truncDir, { recursive: true });
    await fsp.writeFile(path.join(truncDir, 'creds.json'), '{"noiseKey": "partial');
    const resTrunc = await validateSession('truncated_json');
    assert.equal(resTrunc.ok, false);
    assert.equal(resTrunc.credsExists, true);
    assert.equal(resTrunc.credsValid, false);
    assert.ok(resTrunc.warnings.some((w) => w.includes('parse error')));

    // 2.1.3: Binary garbage
    const binDir = path.join(sandbox.dir, 'binary_garbage');
    await fsp.mkdir(binDir, { recursive: true });
    await fsp.writeFile(path.join(binDir, 'creds.json'), Buffer.from([0x00, 0xff, 0xfe, 0x12, 0x34]));
    const resBin = await validateSession('binary_garbage');
    assert.equal(resBin.ok, false);
    assert.equal(resBin.credsValid, false);

    // 2.1.4: creds.json is a directory instead of a file
    const dirAsCreds = path.join(sandbox.dir, 'creds_is_dir');
    await fsp.mkdir(path.join(dirAsCreds, 'creds.json'), { recursive: true });
    const resDirCreds = await validateSession('creds_is_dir');
    assert.equal(resDirCreds.ok, false);
    assert.equal(resDirCreds.credsValid, false);
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await sandbox.cleanup();
  }
});

test('Adversarial 2.2: validateSession with JSON primitive and non-object values (null, boolean, number, string, array)', async () => {
  const sandbox = await createSandbox();
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = sandbox.dir;

  const primitives = [
    { name: 'json_null', content: 'null', expectedCrash: false },
    { name: 'json_bool', content: 'true', expectedCrash: false },
    { name: 'json_number', content: '12345', expectedCrash: false },
    { name: 'json_string', content: '"hello world"', expectedCrash: false },
    { name: 'json_array', content: '["noiseKey", "signedIdentityKey"]', expectedCrash: false },
  ];

  const crashReport = [];

  try {
    for (const item of primitives) {
      const sessionDir = path.join(sandbox.dir, item.name);
      await fsp.mkdir(sessionDir, { recursive: true });
      await fsp.writeFile(path.join(sessionDir, 'creds.json'), item.content);

      try {
        const res = await validateSession(item.name);
        assert.equal(res.ok, false, `Primitive JSON "${item.content}" should not be marked ok`);
        assert.equal(res.credsValid, false, `Primitive JSON "${item.content}" should have credsValid: false`);
      } catch (err) {
        crashReport.push({ session: item.name, error: err.message, stack: err.stack });
      }
    }

    // Verify graceful handling: zero primitives crash validateSession
    assert.equal(crashReport.length, 0, 'No primitive should crash validateSession');
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await sandbox.cleanup();
  }
});

test('Adversarial 2.3: validateSession with missing, partial, or malformed me object', async () => {
  const sandbox = await createSandbox();
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = sandbox.dir;

  const cases = [
    {
      name: 'missing_noise_key',
      creds: { signedIdentityKey: 'k', registrationId: 1, me: { id: 'user@s.whatsapp.net' } },
      expectedMissing: 'noiseKey',
    },
    {
      name: 'missing_signed_identity_key',
      creds: { noiseKey: 'k', registrationId: 1, me: { id: 'user@s.whatsapp.net' } },
      expectedMissing: 'signedIdentityKey',
    },
    {
      name: 'missing_registration_id',
      creds: { noiseKey: 'k', signedIdentityKey: 'k', me: { id: 'user@s.whatsapp.net' } },
      expectedMissing: 'registrationId',
    },
    {
      name: 'missing_me_entirely',
      creds: { noiseKey: 'k', signedIdentityKey: 'k', registrationId: 1 },
      expectedMissing: 'me',
    },
    {
      name: 'empty_me_object',
      creds: { noiseKey: 'k', signedIdentityKey: 'k', registrationId: 1, me: {} },
      expectedMissing: 'me.id',
    },
    {
      name: 'me_id_as_number',
      creds: { noiseKey: 'k', signedIdentityKey: 'k', registrationId: 1, me: { id: 551199999999 } },
      expectedMissing: 'me.id',
    },
    {
      name: 'me_id_as_null',
      creds: { noiseKey: 'k', signedIdentityKey: 'k', registrationId: 1, me: { id: null } },
      expectedMissing: 'me.id',
    },
    {
      name: 'me_id_empty_string',
      creds: { noiseKey: 'k', signedIdentityKey: 'k', registrationId: 1, me: { id: '' } },
      expectedMissing: 'me.id',
    },
  ];

  try {
    for (const c of cases) {
      const sessionDir = path.join(sandbox.dir, c.name);
      await fsp.mkdir(sessionDir, { recursive: true });
      await fsp.writeFile(path.join(sessionDir, 'creds.json'), JSON.stringify(c.creds));

      const res = await validateSession(c.name);
      assert.equal(res.ok, false, `Session ${c.name} should fail validation`);
      assert.equal(res.credsValid, true, `Session ${c.name} JSON is syntactically valid`);
      assert.equal(res.credsComplete, false, `Session ${c.name} must be incomplete`);
      assert.ok(
        res.missingKeys.includes(c.expectedMissing),
        `Session ${c.name} should identify missing key "${c.expectedMissing}", got: ${JSON.stringify(res.missingKeys)}`
      );
    }
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await sandbox.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Concurrent migrateLegacySessions() Stress Testing
// ─────────────────────────────────────────────────────────────────────────────

test('Adversarial 3.1: Concurrent migrateLegacySessions() execution under multi-worker contention', async () => {
  const sandbox = await createSandbox();
  const legacyDir = getLegacySessionsDirectory();
  const canonicalDir = path.join(sandbox.dir, 'canonical_target');

  // Point canonical sessions to sandbox target
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = canonicalDir;

  const testSessionName = 'adv_concurrent_mig_' + Date.now();
  const testLegacySessionDir = path.join(legacyDir, testSessionName);

  let legacyCreated = false;
  try {
    await fsp.mkdir(testLegacySessionDir, { recursive: true });
    legacyCreated = true;

    const mockCreds = JSON.stringify({
      noiseKey: 'noise_concurrent_test',
      signedIdentityKey: 'idkey_concurrent_test',
      registrationId: 9876,
      me: { id: '551188888888@s.whatsapp.net', name: 'Concurrent Test' },
    });

    await fsp.writeFile(path.join(testLegacySessionDir, 'creds.json'), mockCreds);
    await fsp.writeFile(path.join(testLegacySessionDir, 'app-state-sync-key-1.json'), '{"state":1}');
    await fsp.writeFile(path.join(testLegacySessionDir, 'app-state-sync-key-2.json'), '{"state":2}');
    await fsp.writeFile(path.join(testLegacySessionDir, '.lock'), 'lock_token');
    await fsp.writeFile(path.join(testLegacySessionDir, '.write_lock'), 'write_token');
    await fsp.writeFile(path.join(testLegacySessionDir, 'temp.tmp'), 'tmp_token');

    // Run 10 concurrent migration invocations simultaneously
    const CONCURRENCY = 10;
    const migrationPromises = Array.from({ length: CONCURRENCY }, () => migrateLegacySessions());

    const results = await Promise.allSettled(migrationPromises);

    for (let i = 0; i < results.length; i++) {
      assert.equal(results[i].status, 'fulfilled', `Concurrent migration worker ${i} rejected`);
    }

    const targetSessionDir = path.join(canonicalDir, testSessionName);
    assert.ok(fs.existsSync(targetSessionDir), 'Canonical destination directory must exist');

    const credsContent = await fsp.readFile(path.join(targetSessionDir, 'creds.json'), 'utf8');
    assert.equal(credsContent, mockCreds, 'Migrated creds.json content must match original exactly');

    assert.ok(!fs.existsSync(path.join(targetSessionDir, '.lock')), '.lock must not be copied');
    assert.ok(!fs.existsSync(path.join(targetSessionDir, '.write_lock')), '.write_lock must not be copied');
    assert.ok(!fs.existsSync(path.join(targetSessionDir, 'temp.tmp')), 'temp.tmp must not be copied');

    const validation = await validateSession(testSessionName);
    assert.equal(validation.ok, true, 'Migrated session must validate successfully');
    assert.equal(validation.credsComplete, true);
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    if (legacyCreated) {
      await fsp.rm(testLegacySessionDir, { recursive: true, force: true }).catch(() => {});
    }
    await sandbox.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Session Recovery & Auto-Restore Resilience Under Corrupted Files
// ─────────────────────────────────────────────────────────────────────────────

test('Adversarial 4.1: sessionRecoveryService.recoverSessions() when a session has null creds.json', async () => {
  const sandbox = await createSandbox();
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = sandbox.dir;

  const sessionManager = require('../services/sessionManager.legacy');
  const whatsappService = require('../services/whatsappService');
  const origCreateStableSession = whatsappService.createStableSession;
  whatsappService.createStableSession = async ({ sessionName }) => ({
    status: 'connected',
    sessionName,
    isDisposed: false,
    isClosing: false,
    sock: {
      ev: { removeAllListeners: () => {} },
      ws: { removeAllListeners: () => {}, close: () => {} },
      end: () => {},
    },
  });

  const { recoverSessions } = require('../services/sessionRecoveryService');

  try {
    // Session 1: corrupted with literal null
    const dirNull = path.join(sandbox.dir, 'session_aaa_corrupted');
    await fsp.mkdir(dirNull, { recursive: true });
    await fsp.writeFile(path.join(dirNull, 'creds.json'), 'null');

    // Session 2: perfectly valid
    const dirValid = path.join(sandbox.dir, 'session_zzz_valid');
    await fsp.mkdir(dirValid, { recursive: true });
    await fsp.writeFile(
      path.join(dirValid, 'creds.json'),
      JSON.stringify({
        noiseKey: 'nk',
        signedIdentityKey: 'sik',
        registrationId: 1234,
        me: { id: '551199999999@s.whatsapp.net', name: 'Valid' },
      })
    );

    // Call recoverSessions()
    // With validateSession null guard and per-session try/catch, recoverSessions survives without crashing
    let recovered;
    try {
      recovered = await recoverSessions();
      console.log('[recoverSessions Result with corrupted neighbor]:', recovered);
      assert.ok(Array.isArray(recovered), 'recoverSessions should return an array without crashing');
      assert.ok(recovered.includes('session_zzz_valid'), 'Valid session should be recovered');
      assert.ok(!recovered.includes('session_aaa_corrupted'), 'Corrupted session should not be recovered');
    } catch (err) {
      console.error('[recoverSessions CRASHED!]:', err.message);
      throw err;
    }
  } finally {
    whatsappService.createStableSession = origCreateStableSession;
    await sessionManager.disposeSession('session_zzz_valid').catch(() => {});
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await sandbox.cleanup();
  }
});

test('Adversarial 4.2: Path Traversal Arbitrary Deletion Probe in deleteSessionFolder', async () => {
  const sandbox = await createSandbox();
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  const canonicalSessions = path.join(sandbox.dir, 'sessions');
  const victimDir = path.join(sandbox.dir, 'victim_critical_data');

  await fsp.mkdir(canonicalSessions, { recursive: true });
  await fsp.mkdir(victimDir, { recursive: true });
  await fsp.writeFile(path.join(victimDir, 'do_not_delete.txt'), 'CRITICAL BUSINESS DATA');

  process.env.WHATSAPP_SESSIONS_DIR = canonicalSessions;

  try {
    // Relative attack payload trying to delete victimDir
    const traversalAttackSession = '../victim_critical_data';
    const resolvedSessionPath = getSessionPath(traversalAttackSession);

    console.log(`[Path Traversal Deletion Probe] Attack input: "${traversalAttackSession}"`);
    console.log(`[Path Traversal Deletion Probe] Resolved path: "${resolvedSessionPath}"`);
    console.log(`[Path Traversal Deletion Probe] Victim path:   "${victimDir}"`);

    // Ensure getSessionPath does NOT escape to external victim directory
    assert.notEqual(
      path.resolve(resolvedSessionPath),
      path.resolve(victimDir),
      'Path traversal prevented: getSessionPath must NEVER resolve to external victim directory!'
    );

    const relativeToCanonical = path.relative(canonicalSessions, resolvedSessionPath);
    assert.ok(
      !relativeToCanonical.startsWith('..') && !path.isAbsolute(relativeToCanonical),
      'Resolved session path must remain strictly inside canonical sessions directory'
    );
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await sandbox.cleanup();
  }
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


