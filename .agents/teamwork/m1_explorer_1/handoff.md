# Handoff Report: Feature F1.1 (Canonical Session Path Alignment & Auto-Migration)

**From**: m1_explorer_1 (Milestone 1 Exploration Agent)  
**To**: Orchestrator (parent `3265ab63-b153-484a-b6d7-740defe3b059`) / Milestone 1 Implementer  
**Date**: 2026-11-04  
**Handoff Type**: Hard Handoff (Investigation Complete)  
**Reference Feature**: F1.1 (Canonical Session Path Alignment & Auto-Migration)  
**Full Investigation Report**: `.agents/teamwork/m1_explorer_1/survey_report.md`

---

## 1. Observation

Direct, verbatim source observations across the codebase:

1. **`backend/services/whatsapp/connection/stableSession.js` (lines 99, 180, 186)**:
   ```javascript
   99: const SESSIONS_DIRECTORY = path.join(__dirname, '..', '..', '..', '..', 'data', 'sessions');
   ...
   180:   await fs.mkdir(SESSIONS_DIRECTORY, { recursive: true });
   ...
   186:   const sessionPath = path.join(SESSIONS_DIRECTORY, normalizedSessionName);
   ```
   *Target on local Windows*: `c:\projetos\ZAPAI-FINAL\data\sessions\<sessionId>`.

2. **`backend/services/sessionManager.legacy.js` (lines 20-22, 240, 749-752, 789)**:
   ```javascript
   20: const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');
   21: const fsSync = require('fs');
   22: fsSync.mkdirSync(SESSIONS_DIRECTORY, { recursive: true });
   ...
   240:   const sessionPath = path.join(SESSIONS_DIRECTORY, normalizedName);
   ...
   749:       const validation = await validateSession(sessionId);
   750:       if (!validation.ok) {
   751:         console.log(`[WHATSAPP] Skipping auto-restore for session ${sessionId} (no valid/complete creds.json found).`);
   752:         continue;
   753:       }
   ...
   789:     const entries = await fs.readdir(SESSIONS_DIRECTORY, { withFileTypes: true });
   ```
   *Target on local Windows*: `c:\projetos\ZAPAI-FINAL\backend\sessions`.

3. **`backend/services/whatsapp/connection/sessionPersistenceValidator.js` (lines 24, 48, 132)**:
   ```javascript
   24: const SESSIONS_ROOT = path.join(__dirname, '..', '..', '..', 'sessions');
   ...
   48:   const sessionPath = path.join(SESSIONS_ROOT, sessionId);
   ...
   132:     const entries = await fsp.readdir(SESSIONS_ROOT, { withFileTypes: true });
   ```
   *Target on local Windows*: `c:\projetos\ZAPAI-FINAL\backend\sessions`.

4. **`backend/services/connectionService.legacy.js` (lines 432-434)**:
   ```javascript
   432:   const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');
   433:   const credsPath = path.join(SESSIONS_DIRECTORY, sessionId, 'creds.json');
   434:   const hasCreds = fs.existsSync(credsPath);
   ```
   *Target on local Windows*: `c:\projetos\ZAPAI-FINAL\backend\sessions\<sessionId>\creds.json`.

5. **`scripts/qa/run-qa.js` (lines 140-162)**:
   ```javascript
   140:   const sessionsDir = path.join(root, "backend/sessions");
   141:   if (!fs.existsSync(sessionsDir)) return;
   ...
   160:       report.pagesStatus.Connections = "Parcial (sem sessões criadas)";
   ```
   *Target on local Windows*: `c:\projetos\ZAPAI-FINAL\backend\sessions`.

6. **`backend/scripts/healthcheck.js` (line 36)**:
   ```javascript
   36: const SESSIONS_DIR = path.join(__dirname, '../sessions');
   ```

7. **`backend/scripts/protect-whatsapp-sessions.js` (line 7)**:
   ```javascript
   7: const SESSIONS_DIR = path.join(ROOT, 'sessions');
   ```

8. **`docker-compose.yml` (line 66) vs `docker-compose.production.yml` (line 163)**:
   - In `docker-compose.yml`: `- dev_sessions:/app/sessions`
   - In `docker-compose.production.yml`: `- zapai_sessions:/data/sessions`
   - In `Dockerfile`: `VOLUME ["/app/backend/.sessions"]`

---

## 2. Logic Chain

1. **Premise 1 (Observation 1)**: When Baileys connects, `stableSession.js` persists multi-file auth credentials (`creds.json` and key files) to `path.join(__dirname, '../../../../data/sessions', sessionId)`, which resolves to `<root>/data/sessions/<sessionId>`.
2. **Premise 2 (Observation 2 & 3)**: When the backend restarts, `systemManager.startSystem()` invokes `sessionManager.restoreSessions()`, which queries session candidates and checks `validateSession(sessionId)` from `sessionPersistenceValidator.js`.
3. **Premise 3 (Observation 3)**: `sessionPersistenceValidator.js` searches for `creds.json` under `SESSIONS_ROOT` defined as `path.join(__dirname, '../../../sessions')`, resolving to `<root>/backend/sessions/<sessionId>/creds.json`.
4. **Premise 4 (Observation 2)**: Because `creds.json` exists in `data/sessions/` and NOT in `backend/sessions/`, `fsp.access` throws `ENOENT`. `validateSession` returns `{ ok: false, warnings: ['creds.json missing...'] }`.
5. **Deduction 1**: `sessionManager.restoreSessions()` evaluates `validation.ok === false` and prints:
   `[WHATSAPP] Skipping auto-restore for session main (no valid/complete creds.json found).`
   The session is never auto-reconnected on startup, requiring a manual QR scan every single time.
6. **Premise 5 (Observation 4 & 5)**: `connectionService.legacy.js` and `run-qa.js` also read `<root>/backend/sessions`. Therefore, session health metrics report `hasCreds: false` and QA reports "Parcial (sem sessões criadas)".
7. **Premise 6 (Observation 2)**: When a user calls `DELETE /sessions/:id` or logs out, `sessionManager.legacy.js` calls `deleteSessionFolder`, which executes `fs.rm` on `backend/sessions/<sessionId>`. It does not remove `data/sessions/<sessionId>`, leaving stale authentication files behind.
8. **Deduction 2**: Unifying all components to a canonical helper (`sessionPaths.js`) that defaults to `<root>/data/sessions` (configurable via `process.env.WHATSAPP_SESSIONS_DIR`), combined with an automatic copy-migration from legacy `backend/sessions` on startup, will eliminate the bug permanently without breaking existing deployments.

---

## 3. Caveats

1. **Docker Environment Variables**: In `docker-compose.production.yml`, the volume `- zapai_sessions:/data/sessions` is mounted at the root `/data/sessions`. On Linux containers, `sessionPaths.js` must check `process.env.WHATSAPP_SESSIONS_DIR` and fallback to `/data/sessions` if mounted.
2. **File Permissions**: In Unix/Linux containers, ensure the directory created by `mkdirSync` / `fsp.mkdir` has read/write permissions for the user running the Node.js process.
3. **Locks**: Stale lock files (`.lock`, `.write_lock`) should never be copied during migration to prevent socket acquisition deadlocks.

---

## 4. Conclusion

The root cause of WhatsApp session loss on reboot is a path divergence between `stableSession.js` (`data/sessions`) and `sessionManager.legacy.js` / `sessionPersistenceValidator.js` (`backend/sessions`).

### Actionable Solution:
1. Create `backend/services/whatsapp/connection/sessionPaths.js` with:
   - `getCanonicalSessionsDirectory()`: honors `process.env.WHATSAPP_SESSIONS_DIR`, Linux `/data/sessions`, and `<root>/data/sessions`.
   - `getSessionPath(sessionId)`: canonical per-session folder path.
   - `getLegacySessionsDirectory()`: `<root>/backend/sessions`.
   - `migrateLegacySessions()`: startup auto-migration copying unmigrated sessions from legacy to canonical.
2. Align imports in:
   - `backend/services/whatsapp/connection/stableSession.js`
   - `backend/services/sessionManager.legacy.js`
   - `backend/services/whatsapp/connection/sessionPersistenceValidator.js`
   - `backend/services/connectionService.legacy.js`
   - `backend/scripts/healthcheck.js`
   - `backend/scripts/protect-whatsapp-sessions.js`
   - `backend/scripts/session_reset_and_qr.js`
   - `scripts/qa/run-qa.js`
3. Update `docker-compose.yml` and `docker-compose.production.yml` to specify `WHATSAPP_SESSIONS_DIR`.
4. Create test suite `backend/tests/sessionPathsAndMigration.test.js`.

---

## 5. Verification Method

To independently verify the implementation:

1. **Unit & Path Integration Test**:
   Execute:
   ```powershell
   node --test backend/tests/sessionPathsAndMigration.test.js
   ```
   Assert:
   - Canonical path defaults to `<root>/data/sessions`.
   - Custom `WHATSAPP_SESSIONS_DIR` overrides the path correctly.
   - `sessionManager`, `stableSession`, `sessionPersistenceValidator`, and `connectionService` resolve the identical directory.
   - `migrateLegacySessions()` copies mock `creds.json` from legacy to canonical when canonical is empty, and is idempotent on repeat execution.
   - `validateSession()` reports `{ ok: true }` when credentials exist in the canonical directory.

2. **Session Recovery Regression Test**:
   Execute:
   ```powershell
   node --test backend/tests/sessionRecoveryService.test.js
   ```
   Assert: All tests pass (2/2).

3. **QA Script Verification**:
   Execute:
   ```powershell
   node scripts/qa/run-qa.js
   ```
   Assert: `checkWhatsAppSessions()` checks `data/sessions` and outputs accurate status.

4. **Invalidation Conditions**:
   The fix is invalid if:
   - `sessionPersistenceValidator.js` and `stableSession.js` resolve to different directories.
   - Existing credentials in `backend/sessions/` are ignored or lost on boot.
   - Stale `.lock` files are copied during migration.
