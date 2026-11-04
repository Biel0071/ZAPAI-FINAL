## 2026-11-04T02:18:07Z
You are m1_explorer_3, an exploration agent for Milestone 1.
Your working directory is: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_explorer_3
Authoritative user request file: c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md
Master project specification: c:\projetos\ZAPAI-FINAL\PROJECT.md

MANDATORY FIRST STEP:
Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md and c:\projetos\ZAPAI-FINAL\PROJECT.md completely.
Also read the prior survey report at c:\projetos\ZAPAI-FINAL\.agents\teamwork\explorer_survey_1\survey_report.md.

YOUR MISSION:
Focus on Feature F1.3 (Reconnection State Machine, Error Code Handling & Teardown Cleanup):
1. Investigate `backend/services/whatsapp/connection/reconnect.js` and `backend/services/whatsapp/connection/stableSession.js`.
2. Map disconnect reason handling:
   - 401 logged out / loggedOut: Delete canonical session folder, update DB status to `disconnected`, clear credentials, do NOT auto-reconnect.
   - 408 timedOut, 428 connectionClosed, 500 badSession, 503 unavailableService, 515 restartRequired: Auto-reconnect with exponential backoff and jitter.
   - Coordinated backoff: harmonize retry delay timers between `stableSession.js` and `sessionManager.legacy.js` to prevent race conditions or duplicate socket creation.
3. Socket cleanup and memory leak prevention: ensure existing Baileys socket listeners, timers, and WS connections are cleanly terminated before reconnecting.
4. Formulate exact file modifications and verification commands for the Worker.
5. Deliver your findings to `survey_report.md` and `handoff.md` in your working directory, and message the orchestrator when finished.

CONSTRAINTS:
- Do NOT modify product code. You are read-only.
- Base all recommendations on verified file lines and code analysis.
