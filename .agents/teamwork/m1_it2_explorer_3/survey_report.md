# Milestone 1 Iteration 2 Survey Report — Gate Failure Fix Strategies

**Agent**: `m1_it2_explorer_3` (Explorer / Synthesis)  
**Recipient / Parent**: `3265ab63-b153-484a-b6d7-740defe3b059` (Orchestrator)  
**Milestone**: Milestone 1 (`m1_whatsapp_session_stability`) Iteration 2  
**Date**: 2026-11-04  
**Status**: Read-Only Analysis Complete  

---

## Executive Summary

This survey analyzes the exact root cause and surgical remediation strategy for the three defects identified during the Milestone 1 review gate:

1. **Facade Test in `backend/tests/sessionPathsAndMigration.test.js:89-98`**:
   The test simulated file migration with an ad-hoc `for` loop and `fs.promises.copyFile` rather than executing `migrateLegacySessions()`. The production function must be updated to accept optional custom source and destination directories `(customLegacyDir, customCanonicalDir)` and the test refactored to call `migrateLegacySessions(tempLegacy, tempCanonical)`.
2. **Missing Invocations in `backend/tests/sessionAutoRestoreAndPersistence.test.js:121`**:
   The test titled `restoreSessions restores valid session on boot and skips invalid` only invoked `validateSession()`, never actually executing `sessionManager.restoreSessions()`. The test must stub `whatsappService.createStableSession`, configure `WHATSAPP_RESTORE_MODE='allowlist'`, invoke `sessionManager.restoreSessions()`, and assert that the valid session is restored while the invalid session is skipped.
3. **Unmanaged Background Timer in `backend/services/whatsapp/connection/stableSession.js:1405`**:
   An anonymous `setTimeout(..., 2500)` for `webCatalogExtractor.extractCatalog()` was left unmanaged on connection open. Because line 1591 already uses `session.catalogSyncTimer` for `productsController.syncWhatsAppCatalogInternal`, assigning line 1405 to `session.webCatalogTimer` (with guard check `if (session.isDisposed || session.isClosing) return;`) and cancelling it in both `stableSession.js` and `sessionManager.legacy.js:closeSocket` eliminates the timer leak without colliding with `catalogSyncTimer`.

---

## Detailed Analysis & Surgical Line Replacement Recommendations

### Defect 1: Migrate Legacy Sessions Custom Directory Support & Unit Test Refactor

#### Context & Problem
In `backend/services/whatsapp/connection/sessionPaths.js:96`, `migrateLegacySessions()` currently takes no parameters, hardcoding `legacyDir = getLegacySessionsDirectory()` (`<root>/backend/sessions`) and `canonicalDir = getCanonicalSessionsDirectory()`.
Because of this rigid signature, `backend/tests/sessionPathsAndMigration.test.js:89-98` created temporary test directories (`tempLegacy`, `tempCanonical`) but could not pass them to `migrateLegacySessions()`. The test author instead wrote a manual copy loop in lines 92-98 and asserted against that test-local loop, creating a facade test.

#### Remediation 1.1: Update `sessionPaths.js` to Support Custom Directories
- **File**: `backend/services/whatsapp/connection/sessionPaths.js`
- **Location**: Line 96
- **Before**:
```javascript
async function migrateLegacySessions() {
  const result = {
    migrated: [],
    skipped: [],
    errors: [],
  };

  const legacyDir = getLegacySessionsDirectory();
  const canonicalDir = getCanonicalSessionsDirectory();
```
- **After**:
```javascript
async function migrateLegacySessions(customLegacyDir = null, customCanonicalDir = null) {
  const result = {
    migrated: [],
    skipped: [],
    errors: [],
  };

  const legacyDir = customLegacyDir ? path.resolve(customLegacyDir) : getLegacySessionsDirectory();
  const canonicalDir = customCanonicalDir ? path.resolve(customCanonicalDir) : getCanonicalSessionsDirectory();
```

#### Remediation 1.2: Refactor `sessionPathsAndMigration.test.js`
- **File**: `backend/tests/sessionPathsAndMigration.test.js`
- **Location**: Lines 80–105
- **Before**:
```javascript
  try {
    // Manually run migration logic for custom directory test
    // We verify our sessionPaths module handles the migration
    const result = await migrateLegacySessions();
    assert.ok(result);
    assert.ok(Array.isArray(result.migrated));
    assert.ok(Array.isArray(result.skipped));
    assert.ok(Array.isArray(result.errors));

    // Test specific copy behavior
    const dstSessionDir = path.join(tempCanonical, testSession);
    await fsp.mkdir(dstSessionDir, { recursive: true });

    // Copy using the same exclusion filter as migrateLegacySessions
    const files = await fsp.readdir(legacySessionDir);
    for (const file of files) {
      if (!['.lock', '.write_lock', '.tmp'].includes(file) && !file.endsWith('.lock')) {
        await fsp.copyFile(path.join(legacySessionDir, file), path.join(dstSessionDir, file));
      }
    }

    assert.ok(fs.existsSync(path.join(dstSessionDir, 'creds.json')), 'creds.json should exist');
    assert.ok(fs.existsSync(path.join(dstSessionDir, 'app-state-sync-key-1.json')), 'sync key should exist');
    assert.ok(!fs.existsSync(path.join(dstSessionDir, '.lock')), '.lock file must not be copied');
    assert.ok(!fs.existsSync(path.join(dstSessionDir, '.write_lock')), '.write_lock must not be copied');
```
- **After**:
```javascript
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
```

---

### Defect 2: Real Invocation of `sessionManager.restoreSessions()` in Test Suite

#### Context & Problem
In `backend/tests/sessionAutoRestoreAndPersistence.test.js:121–164`, the test is titled:
`test('sessionManager - restoreSessions restores valid session on boot and skips invalid', async () => { ... })`
However, the test only creates files and calls `validateSession('restore_valid')` and `validateSession('restore_invalid')`. It **never executes `sessionManager.restoreSessions()`**.
Two obstacles prevented the author from invoking `restoreSessions()`:
1. `sessionManager.legacy.js:30` had `const SESSIONS_DIRECTORY = getCanonicalSessionsDirectory();` evaluated once at module load time. Changing `process.env.WHATSAPP_SESSIONS_DIR` dynamically inside the test was not observed by `listStoredSessionNames()` unless reading dynamically.
2. `restoreSessions()` calls `startSession()`, which attempts to instantiate a real Baileys socket via `whatsappService.createStableSession()`.

#### Remediation 2.1: Dynamic Session Directory in `sessionManager.legacy.js`
- **File**: `backend/services/sessionManager.legacy.js`
- **Location**: Line 30 and directory references
- **Change**: Replace module-level cached `SESSIONS_DIRECTORY` with dynamic `getCanonicalSessionsDirectory()`:
```javascript
// In sessionManager.legacy.js line 439 (listStoredSessionNames):
const entries = await fs.readdir(getCanonicalSessionsDirectory(), { withFileTypes: true });

// In line 841, 846 (cleanupZombieSessions):
const entries = await fs.readdir(getCanonicalSessionsDirectory(), { withFileTypes: true });
const sessionDir = path.join(getCanonicalSessionsDirectory(), entry.name);

// In line 890:
const sessionDir = path.join(getCanonicalSessionsDirectory(), sessionName);
```

#### Remediation 2.2: Refactor `sessionAutoRestoreAndPersistence.test.js` to Call `restoreSessions()`
- **File**: `backend/tests/sessionAutoRestoreAndPersistence.test.js`
- **Location**: Lines 121–164
- **Before**:
```javascript
    const val1 = await validateSession('restore_valid');
    const val2 = await validateSession('restore_invalid');
    assert.equal(val1.ok, true);
    assert.equal(val2.ok, false);
  } finally {
    if (origEnv !== undefined) {
      process.env.WHATSAPP_SESSIONS_DIR = origEnv;
    } else {
      delete process.env.WHATSAPP_SESSIONS_DIR;
    }
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});
```
- **After**:
```javascript
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
```

---

### Defect 3: Unmanaged Timer at `stableSession.js:1405` & Teardown Cleanliness

#### Context & Problem
In `backend/services/whatsapp/connection/stableSession.js:1405`:
```javascript
setTimeout(() => {
  webCatalogExtractor.extractCatalog(normalizedSessionName, session.companyId || 'default')
    .then(res => console.log(`[WHATSAPP-AUTO-SYNC] Catálogo sincronizado automaticamente para ${normalizedSessionName}: ${res.total} produtos.`))
    .catch(err => console.warn(`[WHATSAPP-AUTO-SYNC] Aviso no auto-sync do catálogo:`, err.message));
}, 2500);
```
- Investigation revealed that line 1591 in `stableSession.js` **already** uses `session.catalogSyncTimer` for `productsController.syncWhatsAppCatalogInternal` (3500ms delay).
- If line 1405 also wrote to `session.catalogSyncTimer`, they would overwrite each other's timer handles.
- Therefore, allocating `session.webCatalogTimer` at line 1405 gives both auto-sync timers independent lifecycle management.
- Guard check `if (session.isDisposed || session.isClosing || session.status !== 'connected') return;` prevents async execution on closed sessions.
- Teardown handlers in both `stableSession.js` and `sessionManager.legacy.js:closeSocket` must clear both `catalogSyncTimer` and `webCatalogTimer`.

#### Remediation 3.1: Timer Assignment in `stableSession.js:1403-1412`
- **File**: `backend/services/whatsapp/connection/stableSession.js`
- **Location**: Lines 1403–1412
- **Before**:
```javascript
      // Auto-sync automático do catálogo comercial em background ao conectar
      try {
        const webCatalogExtractor = require('../../webbridge/WebCatalogExtractor');
        setTimeout(() => {
          webCatalogExtractor.extractCatalog(normalizedSessionName, session.companyId || 'default')
            .then(res => console.log(`[WHATSAPP-AUTO-SYNC] Catálogo sincronizado automaticamente para ${normalizedSessionName}: ${res.total} produtos.`))
            .catch(err => console.warn(`[WHATSAPP-AUTO-SYNC] Aviso no auto-sync do catálogo:`, err.message));
        }, 2500);
      } catch (catErr) {
        console.warn('[WHATSAPP-AUTO-SYNC] Falha ao disparar auto-sync de catálogo:', catErr.message);
      }
```
- **After**:
```javascript
      // Auto-sync automático do catálogo comercial em background ao conectar
      try {
        const webCatalogExtractor = require('../../webbridge/WebCatalogExtractor');
        if (session.webCatalogTimer) {
          clearTimeout(session.webCatalogTimer);
          session.webCatalogTimer = null;
        }
        session.webCatalogTimer = setTimeout(() => {
          session.webCatalogTimer = null;
          if (session.isDisposed || session.isClosing || session.status !== 'connected') {
            return;
          }
          webCatalogExtractor.extractCatalog(normalizedSessionName, session.companyId || 'default')
            .then(res => console.log(`[WHATSAPP-AUTO-SYNC] Catálogo sincronizado automaticamente para ${normalizedSessionName}: ${res.total} produtos.`))
            .catch(err => console.warn(`[WHATSAPP-AUTO-SYNC] Aviso no auto-sync do catálogo:`, err.message));
        }, 2500);
      } catch (catErr) {
        console.warn('[WHATSAPP-AUTO-SYNC] Falha ao disparar auto-sync de catálogo:', catErr.message);
      }
```

#### Remediation 3.2: Teardown in `stableSession.js:1868-1875`
- **File**: `backend/services/whatsapp/connection/stableSession.js`
- **Location**: Lines 1868–1875
- **Before**:
```javascript
        if (session.catalogSyncTimer) {
          clearTimeout(session.catalogSyncTimer);
          session.catalogSyncTimer = null;
        }
        if (session.blocklistSyncTimer) {
```
- **After**:
```javascript
        if (session.catalogSyncTimer) {
          clearTimeout(session.catalogSyncTimer);
          session.catalogSyncTimer = null;
        }
        if (session.webCatalogTimer) {
          clearTimeout(session.webCatalogTimer);
          session.webCatalogTimer = null;
        }
        if (session.blocklistSyncTimer) {
```

#### Remediation 3.3: Teardown in `sessionManager.legacy.js:closeSocket`
- **File**: `backend/services/sessionManager.legacy.js`
- **Location**: Lines 217–221
- **Before**:
```javascript
  if (session.catalogSyncTimer) {
    clearTimeout(session.catalogSyncTimer);
    session.catalogSyncTimer = null;
  }

  if (session.blocklistSyncTimer) {
```
- **After**:
```javascript
  if (session.catalogSyncTimer) {
    clearTimeout(session.catalogSyncTimer);
    session.catalogSyncTimer = null;
  }

  if (session.webCatalogTimer) {
    clearTimeout(session.webCatalogTimer);
    session.webCatalogTimer = null;
  }

  if (session.blocklistSyncTimer) {
```

---

## Verification Commands & Expected Results

1. **Verify Unit Test Suite**:
   ```powershell
   node --test backend/tests/sessionPathsAndMigration.test.js backend/tests/sessionAutoRestoreAndPersistence.test.js backend/tests/reconnectStateMachine.test.js backend/tests/sessionRecoveryService.test.js
   ```
   *Expected Result*: All 18 tests pass with 0 failures, exit code 0.

2. **Verify Adversarial Stress Suite**:
   ```powershell
   node --test backend/tests/adversarialMilestone1.test.js
   ```
   *Expected Result*: All 10 adversarial tests pass with 0 failures, exit code 0.

3. **Verify Full E2E Test Suite**:
   ```powershell
   node tests/e2e/run_all_e2e.js
   ```
   *Expected Result*: All 4 tiers pass (43/43 tests green).
