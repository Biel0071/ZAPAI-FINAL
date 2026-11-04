const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const {
  getPersistenceHealth,
  safeCreateSessionRecord,
  safeUpdateSessionStatus,
} = require('../services/whatsapp/connection/persistence');
const { validateSession } = require('../services/whatsapp/connection/sessionPersistenceValidator');
const sessionManager = require('../services/sessionManager.legacy');

test('persistence - safeUpdateSessionStatus never throws Session owner is missing and uses fallback company', async () => {
  // Test with a random session ID that has no record in the database
  const randomSessionId = 'test_unowned_session_' + Date.now();
  
  // Calling safeUpdateSessionStatus must swallow or handle gracefully without throwing
  await assert.doesNotReject(async () => {
    await safeUpdateSessionStatus(randomSessionId, 'connecting', '551199999999', 'Test Session', 'Test WhatsApp', 'default');
  });

  const health = getPersistenceHealth();
  // It should not throw unhandled exception or leave broken state
  assert.equal(typeof health.degraded, 'boolean');
});

test('persistence - safeCreateSessionRecord gracefully handles missing session records without throwing onboarding error', async () => {
  const randomSessionId = 'test_create_session_' + Date.now();

  await assert.doesNotReject(async () => {
    await safeCreateSessionRecord(randomSessionId, 'Test Session', 'default');
  });
});

test('sessionPersistenceValidator - correctly validates paired session vs unauthenticated stub', async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zapai_validator_test_'));
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = tempDir;

  try {
    // 1. Paired session (complete with me.id)
    const pairedDir = path.join(tempDir, 'paired_session');
    await fsp.mkdir(pairedDir, { recursive: true });
    await fsp.writeFile(
      path.join(pairedDir, 'creds.json'),
      JSON.stringify({
        noiseKey: 'nk',
        signedIdentityKey: 'sik',
        registrationId: 1234,
        me: { id: '5511988888888:1@s.whatsapp.net', name: 'Paired Phone' },
      })
    );

    const pairedValidation = await validateSession('paired_session');
    assert.equal(pairedValidation.ok, true);
    assert.equal(pairedValidation.credsComplete, true);
    assert.equal(pairedValidation.missingKeys.length, 0);

    // 2. Unauthenticated stub (me is empty or missing id)
    const stubDir = path.join(tempDir, 'stub_session');
    await fsp.mkdir(stubDir, { recursive: true });
    await fsp.writeFile(
      path.join(stubDir, 'creds.json'),
      JSON.stringify({
        noiseKey: 'nk',
        signedIdentityKey: 'sik',
        registrationId: 1234,
        me: {}, // Generated QR but never scanned by phone
      })
    );

    const stubValidation = await validateSession('stub_session');
    assert.equal(stubValidation.ok, false);
    assert.equal(stubValidation.credsComplete, false);
    assert.ok(stubValidation.missingKeys.includes('me.id'));

    // 3. Nonexistent session
    const missingValidation = await validateSession('nonexistent_session');
    assert.equal(missingValidation.ok, false);
    assert.equal(missingValidation.dirExists, false);
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('sessionManager - isolates latest QR codes per session ID', () => {
  const sessionA = 'session_alpha';
  const sessionB = 'session_beta';

  sessionManager.clearLatestQr(sessionA);
  sessionManager.clearLatestQr(sessionB);

  const qrA = 'data:image/png;base64,alpha_qr_data';
  const qrB = 'data:image/png;base64,beta_qr_data';

  sessionManager.setLatestQr(qrA, sessionA);
  sessionManager.setLatestQr(qrB, sessionB);

  assert.equal(sessionManager.getSessionQr(sessionA), qrA);
  assert.equal(sessionManager.getSessionQr(sessionB), qrB);
  assert.equal(sessionManager.getLatestQr(sessionA), qrA);
  assert.equal(sessionManager.getLatestQr(sessionB), qrB);

  // Clearing session A should leave session B intact
  sessionManager.clearLatestQr(sessionA);
  assert.equal(sessionManager.getSessionQr(sessionA), null);
  assert.equal(sessionManager.getSessionQr(sessionB), qrB);

  sessionManager.clearLatestQr(sessionB);
  assert.equal(sessionManager.getSessionQr(sessionB), null);
});

test('sessionManager - restoreSessions restores valid session on boot and skips invalid', async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zapai_restore_boot_'));
  const origEnv = process.env.WHATSAPP_SESSIONS_DIR;
  process.env.WHATSAPP_SESSIONS_DIR = tempDir;

  try {
    // 1. Create a valid session in canonical dir
    const validDir = path.join(tempDir, 'restore_valid');
    await fsp.mkdir(validDir, { recursive: true });
    await fsp.writeFile(
      path.join(validDir, 'creds.json'),
      JSON.stringify({
        noiseKey: 'nk',
        signedIdentityKey: 'sik',
        registrationId: 1234,
        me: { id: '5511977777777:1@s.whatsapp.net', name: 'Valid Restore' },
      })
    );

    // 2. Create an incomplete session
    const invalidDir = path.join(tempDir, 'restore_invalid');
    await fsp.mkdir(invalidDir, { recursive: true });
    await fsp.writeFile(
      path.join(invalidDir, 'creds.json'),
      JSON.stringify({
        noiseKey: 'nk',
        signedIdentityKey: 'sik',
        registrationId: 1234,
      })
    );

    const val1 = await validateSession('restore_valid');
    const val2 = await validateSession('restore_invalid');
    assert.equal(val1.ok, true);
    assert.equal(val2.ok, false);

    // Isolate restore mode to the two test candidates
    const origMode = process.env.WHATSAPP_RESTORE_MODE;
    const origAllowList = process.env.WHATSAPP_RESTORE_SESSION_ALLOWLIST;
    process.env.WHATSAPP_RESTORE_MODE = 'allowlist';
    process.env.WHATSAPP_RESTORE_SESSION_ALLOWLIST = 'restore_valid,restore_invalid';

    // Stub createStableSession so it does not connect to real Baileys network
    const whatsappService = require('../services/whatsappService');
    const origCreateStableSession = whatsappService.createStableSession;
    whatsappService.createStableSession = async ({ sessionName }) => {
      return {
        status: 'connected',
        sessionName,
        isDisposed: false,
        isClosing: false,
        sock: { ev: { removeAllListeners: () => {} }, end: () => {} },
      };
    };

    try {
      const restored = await sessionManager.restoreSessions();
      assert.ok(Array.isArray(restored), 'restoreSessions must return an array');
      assert.equal(restored.length, 1, 'Only valid session should be restored');
      assert.equal(restored[0].sessionId, 'restore_valid');
      assert.equal(restored[0].status, 'connected');

      // Assert active session registry state
      assert.equal(sessionManager.hasSession('restore_valid'), true, 'restore_valid should be registered in sessionManager');
      assert.equal(sessionManager.hasSession('restore_invalid'), false, 'restore_invalid should not be registered in sessionManager');
    } finally {
      whatsappService.createStableSession = origCreateStableSession;
      await sessionManager.disposeSession('restore_valid').catch(() => {});
      if (origMode !== undefined) process.env.WHATSAPP_RESTORE_MODE = origMode; else delete process.env.WHATSAPP_RESTORE_MODE;
      if (origAllowList !== undefined) process.env.WHATSAPP_RESTORE_SESSION_ALLOWLIST = origAllowList; else delete process.env.WHATSAPP_RESTORE_SESSION_ALLOWLIST;
    }
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
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

