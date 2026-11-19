## 2026-11-04T03:06:04Z
You are m1_worker_2, the implementation worker for Milestone 1 Iteration 2.
Your working directory is: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_worker_2
Authoritative user request file: c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md
Master project specification: c:\projetos\ZAPAI-FINAL\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md and c:\projetos\ZAPAI-FINAL\PROJECT.md completely.
Also read the detailed Explorer findings:
- c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_it2_explorer_1\handoff.md and survey_report.md
- c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_it2_explorer_2\handoff.md and survey_report.md
- c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_it2_explorer_3\handoff.md and survey_report.md

FILES YOU OWN EXCLUSIVELY:
- backend/services/whatsapp/connection/sessionPaths.js
- backend/services/whatsapp/connection/sessionPersistenceValidator.js
- backend/services/whatsapp/connection/sessionRecoveryService.js
- backend/services/whatsapp/connection/stableSession.js
- backend/services/sessionManager.legacy.js
- backend/tests/sessionPathsAndMigration.test.js
- backend/tests/sessionAutoRestoreAndPersistence.test.js
- backend/tests/adversarialMilestone1.test.js

YOUR IMPLEMENTATION MISSION:
Apply the surgical code remediations formulated by the Iteration 2 Explorers:
1. Path Traversal & Sandbox Defense (`sessionPaths.js`):
   - In `normalizeSessionId`: sanitize input with `path.posix.basename(String(sessionId).replace(/[\\/]/g, '/'))`, apply whitelist regex `/^[a-zA-Z0-9_\-]+$/`. Reject or replace invalid characters so `..`, `../`, `..\\`, null bytes never escape.
   - In `getSessionPath`: ensure resolved path starts with canonical directory using `path.relative` check (throw Error if escaped).
   - In `sessionManager.legacy.js`: delegate `normalizeSessionName` to `sessionPaths.normalizeSessionId`.
2. Concurrency Lock & Custom Dir Support (`sessionPaths.js`):
   - In `migrateLegacySessions(customLegacyDir = null, customCanonicalDir = null)`: maintain an `inFlightMigrations` Promise Map keyed by `${legacyDir}->${canonicalDir}` to deduplicate concurrent calls.
   - Allow custom directory parameters so unit tests can invoke `migrateLegacySessions(tempLegacy, tempCanonical)` directly.
3. Creds Null Guard & Recovery Isolation:
   - In `backend/services/whatsapp/connection/sessionPersistenceValidator.js:validateSession`: add safe guard `if (!creds || typeof creds !== 'object' || Array.isArray(creds)) return { ok: false, credsValid: false, reason: 'creds_not_object', missingKeys: [...REQUIRED_CRED_KEYS] };`
   - In `backend/services/whatsapp/connection/sessionRecoveryService.js:recoverSessions`: wrap each session in a per-session `try/catch` block so one corrupted session logs a warning and does not abort recovery for other sessions.
   - In `backend/tests/adversarialMilestone1.test.js:204`: update test assertion from expecting a crash to asserting that `validateSession` returns `{ ok: false, credsValid: false }` gracefully with zero crashes.
4. Test Assertions & Timer Cleanup:
   - In `backend/tests/sessionPathsAndMigration.test.js:89-98`: replace the ad-hoc for-loop with a direct call to `sessionPaths.migrateLegacySessions(tempLegacyDir, tempCanonicalDir)`.
   - In `backend/tests/sessionAutoRestoreAndPersistence.test.js:121`: execute `sessionManager.restoreSessions()` in the test case with stubbed socket creation to assert `restore_valid` restores and `restore_invalid` skips.
   - In `backend/services/whatsapp/connection/stableSession.js:1405`: assign the setTimeout to `session.webCatalogTimer` with an early-return teardown guard (`if (session.isDisposed || session.isClosing || session.status !== 'connected') return;`) and clear in teardown/`closeSocket`.
5. Testing & Verification:
   - Execute:
     `node --test backend/tests/adversarialMilestone1.test.js`
     `node --test backend/tests/sessionPathsAndMigration.test.js backend/tests/sessionAutoRestoreAndPersistence.test.js backend/tests/reconnectStateMachine.test.js backend/tests/sessionRecoveryService.test.js backend/tests/adversarialReconnectionAndTeardown.test.js`
     `node tests/e2e/run_all_e2e.js`
   - Ensure all tests pass 100% green with exit code 0.

OUTPUT:
- Write full handoff to c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_worker_2\handoff.md following standard Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Send completion message to orchestrator via send_message when done.
