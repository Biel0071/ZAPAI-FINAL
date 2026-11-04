# Handoff Report: WhatsApp Session Instantiation and Connection Stability (Requirement R1)

**Agent**: explorer_survey_1 (Teamwork Explorer)  
**Recipient**: orchestrator (`3265ab63-b153-484a-b6d7-740defe3b059`)  
**Mission**: Map and investigate all aspects of Requirement R1: WhatsApp Session Instantiation and Connection Stability.  
**Report Artifact**: `c:\projetos\ZAPAI-FINAL\.agents\teamwork\explorer_survey_1\survey_report.md`  

---

## 1. Observation

1. **Path Divergence across session modules**:
   - `backend/services/whatsapp/connection/stableSession.js:99`:
     ```javascript
     const SESSIONS_DIRECTORY = path.join(__dirname, '..', '..', '..', '..', 'data', 'sessions');
     ```
     Resolves to `c:\projetos\ZAPAI-FINAL\data\sessions`.
   - `backend/services/sessionManager.legacy.js:20`:
     ```javascript
     const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');
     ```
     Resolves to `c:\projetos\ZAPAI-FINAL\backend\sessions`.
   - `backend/services/whatsapp/connection/sessionPersistenceValidator.js:24`:
     ```javascript
     const SESSIONS_ROOT = path.join(__dirname, '..', '..', '..', 'sessions');
     ```
     Resolves to `c:\projetos\ZAPAI-FINAL\backend\sessions`.
   - `backend/services/connectionService.legacy.js:432`:
     ```javascript
     const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');
     ```
     Resolves to `c:\projetos\ZAPAI-FINAL\backend\sessions`.

2. **CLI Output of Session Persistence Validator**:
   - Command: `node backend/services/whatsapp/connection/sessionPersistenceValidator.js`
   - Output: `No sessions found. Connect WhatsApp to create the first session.`
   - Meanwhile, on the filesystem:
     - `c:\projetos\ZAPAI-FINAL\data\sessions\main` exists.
     - `c:\projetos\ZAPAI-FINAL\backend\sessions\` is completely empty.

3. **Session Restore Logic (`backend/services/sessionManager.legacy.js:749-753`)**:
   ```javascript
   const validation = await validateSession(sessionId);
   if (!validation.ok) {
     console.log(`[WHATSAPP] Skipping auto-restore for session ${sessionId} (no valid/complete creds.json found).`);
     continue;
   }
   ```
   Because `validateSession` reads from `SESSIONS_ROOT` (`backend/sessions/`), it fails to locate `creds.json` written by Baileys into `data/sessions/`, skipping restore upon system boot.

4. **Disconnect Codes Classification (`backend/services/whatsapp/connection/reconnect.js:32-50`)**:
   - Terminal codes: 401 (`loggedOut`), 440 (`connectionReplaced`), 411 (`multideviceMismatch`), 403 (`forbidden`).
   - Transient codes: 408 (`timedOut`/`connectionLost`), 428 (`connectionClosed`), 500 (`badSession`), 503 (`unavailableService`), 515 (`restartRequired`).
   - In `stableSession.js:1846`, code 401 triggers `await fs.rm(sessionPath, { force: true, recursive: true })` to delete stale credentials.

5. **Reconnection & Backoff Architecture**:
   - `stableSession.js:137-141`: `computeReconnectDelay(attempt)` returns `[5000, 15000, 30000, 60000, 120000]`.
   - `stableSession.js:1719`: `cooldownMs = computeReconnectDelay(...) + 5000`.
   - `sessionManager.legacy.js:492`: `const backoffMs = Math.min(5000 * Math.pow(2, attempt - 1), 60000)`.
   - `sessionWatchdog.js:20-22`: Checks for connecting > 2 min, reconnect limbo > 5 min, dead heartbeat > 3 min, max 3 restarts/hr.

6. **Real-time Status Broadcasting**:
   - `realtime/events.js:164`: Emits `session_status`, `session:status`, `connection:event`.
   - `stableSession.js:1291, 1352, 1518, 1784`: Emits `connection.update`, `session_qr`, `session_connected`, `session_disconnected`.
   - Frontend `socketManager.ts:883` subscribes to `session_status`, `session_connected`, `session_disconnected`.

7. **Database Tracking**:
   - PostgreSQL table `sessions` updated via `sessionRepository.updateSessionStatus()`.
   - `backend/services/whatsapp/connection/persistence.js:67` throws `Session owner is missing.` if `company_id` is missing.

---

## 2. Logic Chain

1. From Observation 1, `stableSession.js` initializes Baileys multi-file auth at `data/sessions/`, while `sessionManager.legacy.js` and `sessionPersistenceValidator.js` inspect `backend/sessions/`.
2. When a user connects WhatsApp, Baileys creates auth files (`creds.json`, Signal keys) in `data/sessions/main/`.
3. When the server restarts, `sessionManager.restoreSessions()` invokes `validateSession('main')` (Observation 3).
4. Because `validateSession` inspects `backend/sessions/main/` (Observation 1), it cannot find `creds.json` (Observation 2).
5. `validateSession` returns `ok: false`, causing `restoreSessions()` to skip initializing the session.
6. Therefore, the connection is not restored automatically on restart, breaking Requirement R1's acceptance criterion: *"Session credentials and state persist across application restarts without requiring QR re-scanning"*.
7. Furthermore, Observation 5 shows two uncoordinated backoff delay timers between `stableSession` and `sessionManager`, and Observation 1 shows that if `disposeSession({ deleteFolder: true })` is called, it deletes `backend/sessions/`, leaving orphaned files in `data/sessions/`.

---

## 3. Caveats

- We observed that in `docker-compose.production.yml`, volume `zapai_sessions:/data/sessions` is mounted at `/data/sessions`. Inside Docker, `../../../../data/sessions` from `/app/services/whatsapp/connection` also resolves to `/data/sessions`, whereas `../sessions` from `/app/services` resolves to `/app/sessions`. The path divergence defect exists in **both** local development and Docker production environments.
- We did not connect an active mobile WhatsApp device to test live network drops, as the agent is strictly read-only and no physical device is attached.

---

## 4. Conclusion

Requirement R1 has a well-designed event architecture and socket cleanup mechanism, but is **critically broken at the persistence boundary** due to a hardcoded path discrepancy:
- Baileys writes credentials to `<root>/data/sessions/`.
- Session managers, recovery daemons, and persistence validators read from `<root>/backend/sessions/`.

Aligning all session directory references to a single canonical path (e.g. `path.resolve(__dirname, '../../../data/sessions')` or environment variable `WHATSAPP_SESSIONS_DIR`) with an automatic migration check will immediately restore persistent session loading across restarts. Minor coordination fixes in reconnect backoff and multi-session QR caching will complete R1 compliance.

---

## 5. Verification Method

To independently verify these findings:
1. Run the validator CLI:
   `node backend/services/whatsapp/connection/sessionPersistenceValidator.js`
   Notice it returns `No sessions found` despite `data/sessions/main` existing.
2. Inspect line 99 of `backend/services/whatsapp/connection/stableSession.js`:
   Observe `const SESSIONS_DIRECTORY = path.join(__dirname, '..', '..', '..', '..', 'data', 'sessions');`
3. Inspect line 20 of `backend/services/sessionManager.legacy.js`:
   Observe `const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');`
4. Inspect line 24 of `backend/services/whatsapp/connection/sessionPersistenceValidator.js`:
   Observe `const SESSIONS_ROOT = path.join(__dirname, '..', '..', '..', 'sessions');`
5. Test suite verification command:
   `node --test backend/tests/sessionRecoveryService.test.js` (passes due to mock, confirming unit test gap).
