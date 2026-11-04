## 2026-11-04T02:17:55Z
[Message] timestamp=2026-11-04T02:17:55Z sender=3265ab63-b153-484a-b6d7-740defe3b059 priority=MESSAGE_PRIORITY_HIGH content=You are m1_explorer_1, an exploration agent for Milestone 1.
Your working directory is: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_explorer_1
Authoritative user request file: c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md
Master project specification: c:\projetos\ZAPAI-FINAL\PROJECT.md

MANDATORY FIRST STEP:
Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md and c:\projetos\ZAPAI-FINAL\PROJECT.md completely.
Also read the prior survey report at c:\projetos\ZAPAI-FINAL\.agents\teamwork\explorer_survey_1\survey_report.md.

YOUR MISSION:
Focus on Feature F1.1 (Canonical Session Path Alignment & Auto-Migration):
1. Investigate all occurrences of session folder definitions across the backend:
   - `backend/services/whatsapp/connection/stableSession.js` (line 99)
   - `backend/services/sessionManager.legacy.js` (line 20)
   - `backend/services/connectionService.legacy.js` (line 432)
   - `backend/services/whatsapp/connection/sessionPersistenceValidator.js` (line 24)
   - `scripts/qa/run-qa.js` (line 140)
   - Any other files referencing `sessions` path.
2. Formulate the exact, robust fix strategy to unify them to a single canonical path helper (e.g. `process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../../../data/sessions')`).
3. Formulate an automatic backwards-compatible migration check on startup (if `backend/sessions/<session>` has files but `data/sessions/<session>` is empty, safely copy/move them).
4. Recommend exact file changes, functions to modify, and verification commands.
5. Deliver your findings to `survey_report.md` and `handoff.md` in your working directory, and message the orchestrator when finished.

CONSTRAINTS:
- Do NOT modify product code. You are read-only.
- Base all recommendations on verified file lines and code analysis.
