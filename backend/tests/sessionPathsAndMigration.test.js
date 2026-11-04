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
const { validateSession } = require('../services/whatsapp/connection/sessionPersistenceValidator');

test('sessionPaths - canonical directory resolution default and env override', () => {
  const originalEnv = process.env.WHATSAPP_SESSIONS_DIR;
  try {
    delete process.env.WHATSAPP_SESSIONS_DIR;
    const defaultDir = getCanonicalSessionsDirectory();
    assert.equal(defaultDir, path.resolve(PROJECT_ROOT, 'data', 'sessions'));

    const customDir = path.resolve(os.tmpdir(), 'custom_sessions_' + Date.now());
    process.env.WHATSAPP_SESSIONS_DIR = customDir;
    const resolvedCustom = getCanonicalSessionsDirectory();
    assert.equal(resolvedCustom, customDir);
  } finally {
    if (originalEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = originalEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
  }
});

test('sessionPaths - getSessionPath normalizes session names', () => {
  const canonicalDir = getCanonicalSessionsDirectory();
  assert.equal(getSessionPath('Main Session'), path.join(canonicalDir, 'main_session'));
  assert.equal(getSessionPath('  CLIENT_A  '), path.join(canonicalDir, 'client_a'));
  assert.equal(getSessionPath(''), path.join(canonicalDir, 'main'));
  assert.equal(getSessionPath(null), path.join(canonicalDir, 'main'));
});

test('sessionPaths - legacy directory points to backend/sessions', () => {
  const legacyDir = getLegacySessionsDirectory();
  assert.equal(legacyDir, path.resolve(PROJECT_ROOT, 'backend', 'sessions'));
});

test('sessionPaths - migrateLegacySessions safely copies files and excludes locks', async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zapai_mig_test_'));
  const tempLegacy = path.join(tempDir, 'legacy_sessions');
  const tempCanonical = path.join(tempDir, 'canonical_sessions');

  await fsp.mkdir(tempLegacy, { recursive: true });
  await fsp.mkdir(tempCanonical, { recursive: true });

  const testSession = 'test_mig_session';
  const legacySessionDir = path.join(tempLegacy, testSession);
  await fsp.mkdir(legacySessionDir, { recursive: true });

  const mockCreds = JSON.stringify({
    noiseKey: 'noise123',
    signedIdentityKey: 'idkey123',
    registrationId: 4321,
    me: { id: '551199999999@s.whatsapp.net', name: 'Test' },
  });

  await fsp.writeFile(path.join(legacySessionDir, 'creds.json'), mockCreds);
  await fsp.writeFile(path.join(legacySessionDir, 'app-state-sync-key-1.json'), '{"key":"value"}');
  await fsp.writeFile(path.join(legacySessionDir, '.lock'), 'lock_content');
  await fsp.writeFile(path.join(legacySessionDir, '.write_lock'), 'write_lock_content');

  // Point env to our test directories
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = tempCanonical;

  try {
    // Execute actual migration between custom test directories
    const result = await migrateLegacySessions(tempLegacy, tempCanonical);
    assert.ok(result);
    assert.ok(Array.isArray(result.migrated));
    assert.ok(result.migrated.includes(testSession), 'testSession must be in migrated list');
    assert.equal(result.errors.length, 0, 'migration must execute without errors');

    const dstSessionDir = path.join(tempCanonical, testSession);
    assert.ok(fs.existsSync(path.join(dstSessionDir, 'creds.json')), 'creds.json should exist');
    assert.ok(fs.existsSync(path.join(dstSessionDir, 'app-state-sync-key-1.json')), 'sync key should exist');
    assert.ok(!fs.existsSync(path.join(dstSessionDir, '.lock')), '.lock file must not be copied');
    assert.ok(!fs.existsSync(path.join(dstSessionDir, '.write_lock')), '.write_lock must not be copied');

    // Test idempotency: subsequent run must skip already migrated session without re-copying
    const secondResult = await migrateLegacySessions(tempLegacy, tempCanonical);
    assert.ok(secondResult.skipped.includes(testSession), 'subsequent migration run must skip existing session');

    // Verify validateSession finds it at tempCanonical
    const validation = await validateSession(testSession);
    assert.equal(validation.ok, true);
    assert.equal(validation.credsComplete, true);
    assert.equal(validation.missingKeys.length, 0);
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});
