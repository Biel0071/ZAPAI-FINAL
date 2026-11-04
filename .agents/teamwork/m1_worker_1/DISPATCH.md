## 2026-11-04T02:28:24Z
You are m1_worker_1, the implementation worker for Milestone 1.
Your working directory is: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_worker_1
Authoritative user request file: c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md
Master project specification: c:\projetos\ZAPAI-FINAL\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md and c:\projetos\ZAPAI-FINAL\PROJECT.md completely.
Also read the detailed Explorer findings:
- c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_explorer_1\handoff.md and survey_report.md
- c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_explorer_2\handoff.md and survey_report.md
- c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_explorer_3\handoff.md and survey_report.md

FILES YOU OWN EXCLUSIVELY:
- backend/services/whatsapp/connection/sessionPaths.js (NEW helper)
- backend/services/whatsapp/connection/stableSession.js
- backend/services/whatsapp/connection/sessionPersistenceValidator.js
- backend/services/whatsapp/connection/persistence.js
- backend/services/whatsapp/connection/reconnect.js
- backend/services/sessionManager.legacy.js
- backend/services/connectionService.legacy.js
- scripts/qa/run-qa.js
- backend/tests/sessionPathsAndMigration.test.js (NEW test)
- backend/tests/sessionAutoRestoreAndPersistence.test.js (NEW test)
- backend/tests/reconnectStateMachine.test.js (NEW test)

YOUR IMPLEMENTATION MISSION:
1. Feature F1.1 (Canonical Session Path Alignment & Auto-Migration):
   - Create `backend/services/whatsapp/connection/sessionPaths.js` with `getCanonicalSessionsDirectory()`, `getSessionPath(sessionId)`, `getLegacySessionsDirectory()`, and `migrateLegacySessions()`. Supports env `WHATSAPP_SESSIONS_DIR`, Linux root `/data/sessions`, and Windows `<root>/data/sessions`.
   - Update `stableSession.js`, `sessionManager.legacy.js`, `connectionService.legacy.js`, `sessionPersistenceValidator.js`, and `scripts/qa/run-qa.js` to use `sessionPaths.js`.
   - Add automatic safe migration on boot so any legacy session folders in `backend/sessions` are safely copied to `data/sessions`.
2. Feature F1.2 & F1.4 (Session Persistence, Auto-Restore on Boot, Company Fallback, Real-Time Status):
   - Fix `sessionManager.legacy.js:restoreSessions()` so `validateSession(sessionId)` checks the canonical path and automatically reconnects existing valid sessions on boot.
   - Fix `backend/services/whatsapp/connection/persistence.js` line 67: ensure `company_id || 'default'` so `safeUpdateSessionStatus` never throws `Session owner is missing.`
   - Ensure `session_status`, `session_connected`, `session_disconnected`, `session_qr` broadcast accurately to Socket.IO and persist in the PostgreSQL database.
3. Feature F1.3 (Reconnection State Machine, Error Code Handling & Teardown Cleanup):
   - Fix disconnect reason: 401 loggedOut sets `isLoggedOut = true` and `isBanned = false` (banned is 403 only), cleans canonical folder, and stops auto-reconnecting.
   - Fast reconnect for code 515 (`restartRequired`): reconnect within <= 500ms rather than 5s freeze.
   - Synchronize backoff delay between `stableSession.js` and `sessionManager.legacy.js`, add jitter, cap max retries.
   - Clean up sockets in `closeSocket()`: detach all `sock.ev` listeners, clear `bufferFlushInterval`, `catalogSyncTimer`, `blocklistSyncTimer`, close native WebSocket, and clean from `sessions` Map.
4. Testing & Verification:
   - Create and run automated test suites:
     - `node --test backend/tests/sessionPathsAndMigration.test.js`
     - `node --test backend/tests/sessionAutoRestoreAndPersistence.test.js`
     - `node --test backend/tests/reconnectStateMachine.test.js`
     - Run existing tests: `node --test backend/tests/sessionRecoveryService.test.js`
   - Run `node backend/services/whatsapp/connection/sessionPersistenceValidator.js` to verify it validates sessions at the canonical directory.
   - Ensure all tests pass green with exit code 0.

OUTPUT:
- Write full implementation report and handoff to c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_worker_1\handoff.md following standard Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Send completion message to orchestrator via send_message when done.
