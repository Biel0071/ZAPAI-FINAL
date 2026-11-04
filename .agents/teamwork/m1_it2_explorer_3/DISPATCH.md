## 2026-11-04T02:57:25Z
You are m1_it2_explorer_3, an exploration agent for Milestone 1 Iteration 2.
Your working directory is: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_it2_explorer_3
Authoritative user request file: c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md
Master project specification: c:\projetos\ZAPAI-FINAL\PROJECT.md

MANDATORY FIRST STEP:
Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md, c:\projetos\ZAPAI-FINAL\PROJECT.md, and the gate failure reports:
- c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_reviewer_2\handoff.md
- c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_challenger_1\handoff.md

YOUR MISSION:
Analyze the exact fix strategy for:
1. `backend/tests/sessionPathsAndMigration.test.js:89-98`:
   - Replace the simulated copy loop with an actual call to `sessionPaths.migrateLegacySessions(sourceDir, targetDir)`.
2. `backend/tests/sessionAutoRestoreAndPersistence.test.js:121`:
   - Ensure the test case titled `restoreSessions restores valid session...` actually executes `sessionManager.restoreSessions()`.
3. `stableSession.js:1405`:
   - Assign the `setTimeout` to `session.catalogSyncTimer` or `session.webCatalogTimer` so `closeSocket` cancels it on teardown.
4. Deliver concrete line replacement recommendations and verification commands in `survey_report.md` and `handoff.md`.
5. Message orchestrator via send_message when complete.

CONSTRAINTS:
- Do NOT edit product code. You are read-only.
