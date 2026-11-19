# BRIEFING — 2026-11-04T02:47:00Z

## Mission
Implement Milestone 1 (M1): WhatsApp Engine Stability, Canonical Session Paths, Auto-Migration, Boot Auto-Restore, Reconnection State Machine, and Cleanup Teardown.

## 🔒 My Identity
- Archetype: implementer, qa, specialist
- Roles: implementer, qa, specialist
- Working directory: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_worker_1
- Original parent: 3265ab63-b153-484a-b6d7-740defe3b059
- Milestone: Milestone 1 - WhatsApp Engine Stability & Session Architecture

## 🔒 Key Constraints
- Canonical session directory: `data/sessions` (configurable via `WHATSAPP_SESSIONS_DIR`, supports Linux `/data/sessions` and Windows `<root>/data/sessions`).
- Safe auto-migration from legacy `backend/sessions` on boot.
- Fast reconnect for code 515 (`restartRequired`): <= 500ms.
- 401 loggedOut: `isLoggedOut=true`, `isBanned=false` (403 only), wipe canonical session folder, stop auto-reconnect.
- `persistence.js`: line 67 `company_id || 'default'` fallback to prevent "Session owner is missing."
- Socket teardown in `closeSocket()`: detach listeners, clear timers, close ws, remove from Map.
- All implementations must be genuine. No dummy implementations, no hardcoded test assertions.

## Current Parent
- Conversation ID: 3265ab63-b153-484a-b6d7-740defe3b059
- Updated: 2026-11-04T02:47:00Z

## Task Summary
- **What to build**:
  - `backend/services/whatsapp/connection/sessionPaths.js`
  - Update `stableSession.js`, `sessionPersistenceValidator.js`, `persistence.js`, `reconnect.js`, `sessionManager.legacy.js`, `connectionService.legacy.js`, `scripts/qa/run-qa.js`
  - Write test suites: `sessionPathsAndMigration.test.js`, `sessionAutoRestoreAndPersistence.test.js`, `reconnectStateMachine.test.js`
- **Success criteria**: All automated tests pass with exit code 0; validator checks canonical path; clean socket teardown; real-time socket & DB status synchronization.
- **Interface contracts**: PROJECT.md and DISPATCH.md
- **Code layout**: Backend Node.js modules co-located with tests in `backend/tests/`

## Key Decisions Made
- Canonical session directory centralized in `sessionPaths.js`, honoring `process.env.WHATSAPP_SESSIONS_DIR`, Linux `/data/sessions`, and Windows `<root>/data/sessions`.
- Safe auto-migration ignores `.lock`, `.write_lock`, and `.tmp` files.
- `persistence.js` utilizes fallback company ID (`'default'`) instead of throwing errors.
- `reconnect.js` exports `DisconnectReason`, terminal/transient sets, and provides `computeReconnectBackoff` with fast 515 reconnect (<=500ms) and randomized jitter.
- `sessionManager.legacy.js` isolates QR codes using `_qrMap` per session ID.
- `stableSession.js` sets `isLoggedOut = true` and `isBanned = false` on 401, while 403 sets `isBanned = true`.

## Artifact Index
- DISPATCH.md — Initial task assignment
- BRIEFING.md — Situational awareness
- progress.md — Liveness heartbeat and progress tracker
- handoff.md — Comprehensive handoff report

## Change Tracker
- **Files modified**:
  - `backend/services/whatsapp/connection/sessionPaths.js` (NEW)
  - `backend/services/whatsapp/connection/stableSession.js`
  - `backend/services/whatsapp/connection/sessionPersistenceValidator.js`
  - `backend/services/whatsapp/connection/persistence.js`
  - `backend/services/whatsapp/connection/reconnect.js`
  - `backend/services/sessionManager.legacy.js`
  - `backend/services/connectionService.legacy.js`
  - `scripts/qa/run-qa.js`
  - `backend/tests/sessionPathsAndMigration.test.js` (NEW)
  - `backend/tests/sessionAutoRestoreAndPersistence.test.js` (NEW)
  - `backend/tests/reconnectStateMachine.test.js` (NEW)
- **Build status**: 18/18 tests passing (100% green)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 18/18 tests pass across 4 suites in 1.17s
- **Lint status**: Clean
- **Tests added/modified**: 16 new automated test assertions covering paths, migration, auto-restore, persistence fallback, and reconnect state machine.

## Loaded Skills
- None
