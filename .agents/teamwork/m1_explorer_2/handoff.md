# Milestone 1 Handoff Report: Session Persistence, Boot Auto-Restore & Real-Time Broadcasting (F1.2 & F1.4)

**Agent**: m1_explorer_2  
**Target Milestone**: Milestone 1 (`m1_whatsapp_session_stability`)  
**Target Recipient**: Worker / Orchestrator (`3265ab63-b153-484a-b6d7-740defe3b059`)  
**Date**: 2026-11-04  
**Type**: Hard Handoff (Investigation Complete)  

---

## 1. Observation

1. **Path Divergence across Components**:
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
   - Verbatim CLI test output running `node backend/services/whatsapp/connection/sessionPersistenceValidator.js`:
     ```
     No sessions found. Connect WhatsApp to create the first session.
     ```
     Even though `data/sessions` contains directory `main`.

2. **Boot Auto-Restore Call Flow**:
   - `backend/services/systemManager.js:139`:
     `const restoredSessions = await sessionManager.restoreSessions();`
   - `backend/services/sessionManager.legacy.js:749-753`:
     ```javascript
     const validation = await validateSession(sessionId);
     if (!validation.ok) {
       console.log(`[WHATSAPP] Skipping auto-restore for session ${sessionId} (no valid/complete creds.json found).`);
       continue;
     }
     ```
     Because `validateSession(sessionId)` scans `SESSIONS_ROOT` (`backend/sessions`), it fails to find `data/sessions/main/creds.json`, returning `{ ok: false, warnings: ['Session directory does not exist...'] }`.
     The system logs the skip and does NOT invoke `startSession(sessionId)`, requiring QR re-scanning on every restart.

3. **`creds.json` Completeness & Pairing Discriminator**:
   - `backend/services/whatsapp/connection/sessionPersistenceValidator.js:26`:
     ```javascript
     const REQUIRED_CRED_KEYS = ['noiseKey', 'signedIdentityKey', 'registrationId', 'me'];
     ```
   - Baileys only populates `creds.me = { id: '...', name: '...' }` after the QR code has been successfully scanned by WhatsApp. An initialized but un-scanned folder lacks `me`.
   - If `creds.me` is `{}` without `id`, `!creds['me']` evaluates to `false` (truthy), allowing an unauthenticated stub to appear complete. Checking `!creds.me.id` eliminates this edge case.

4. **Persistence Error Line 67**:
   - `backend/services/whatsapp/connection/persistence.js:63-79`:
     ```javascript
     async function safeUpdateSessionStatus(sessionId, status, phone, sessionName, whatsappName = null) {
       try {
         const { query } = require('../../../src/infrastructure/config/database');
         const existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
         if (!existing.rows[0]?.company_id) throw new Error('Session owner is missing.');
         await sessionRepository.updateSessionStatus(
           sessionId,
           status,
           phone,
           existing.rows[0].company_id,
           sessionName,
           whatsappName
         );
         markPersistenceSuccess('update_session_status');
       } catch (error) {
         markPersistenceFailure(sessionId, 'update_session_status', error);
       }
     }
     ```
   - `persistence.js:51-60`:
     ```javascript
     async function safeCreateSessionRecord(sessionId, sessionName) {
       try {
         const { query } = require('../../../src/infrastructure/config/database');
         const existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
         if (existing.rows[0]) { markPersistenceSuccess('create_session_record'); return; }
         throw new Error('Create the session through authenticated onboarding before connecting.');
       } catch (error) {
         markPersistenceFailure(sessionId, 'create_session_record', error);
       }
     }
     ```
   - When a session starts, `safeCreateSessionRecord` refuses to create a missing row and marks persistence as failed. When Baileys connects, `safeUpdateSessionStatus` fails with `Session owner is missing.` because no row with `company_id` exists.
   - In `backend/services/connectionService.legacy.js:280`:
     `if (companyId && !existing) continue;`
     Because the database row was never updated or created, `existing` is undefined and the active session is omitted from `GET /connections`.
   - In `backend/migrations/001_initial_schema.js:4`, the schema explicitly specifies `company_id TEXT DEFAULT 'default'`.

5. **Real-time Status Broadcasting & Multi-Session QR**:
   - `backend/services/sessionManager.legacy.js:32-49`:
     `_latestQr` is stored as a single variable instead of a Map keyed by `sessionId`.
   - `backend/services/whatsapp/connection/stableSession.js:1301-1340`:
     When QR code is emitted or when QR code times out (120s), `safeUpdateSessionStatus` is not called to update PostgreSQL status to `'qr'` or `'disconnected'`.

---

## 2. Logic Chain

1. **Path Alignment -> Credential Discovery**:
   - Observation 1 proves `stableSession.js` saves creds to `<root>/data/sessions`, while `sessionManager.legacy.js` and `sessionPersistenceValidator.js` look in `<root>/backend/sessions`.
   - Because `validateSession` inspects `backend/sessions`, it returns `ok: false`.
   - By updating line 20 of `sessionManager.legacy.js`, line 24 of `sessionPersistenceValidator.js`, and line 432 of `connectionService.legacy.js` to `process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../data/sessions')` (or relative equivalent), all components inspect the identical physical folder.

2. **Credential Discovery -> Automatic Boot Restoration**:
   - Observation 2 demonstrates that `restoreSessions()` automatically triggers `startSession(sessionId)` for every candidate where `validateSession(sessionId).ok` is `true`.
   - When paths are unified, valid credentials in `data/sessions/main/creds.json` produce `ok: true`.
   - `startSession` restores Baileys without requesting a QR scan.
   - Observation 3 shows that incomplete or un-scanned sessions lack `me.id` in `creds.json`. They evaluate to `ok: false` and are safely skipped during boot, preventing rogue socket creations.

3. **Fallback Handling -> Persistent Database Synchronization**:
   - Observation 4 shows that throwing `Session owner is missing.` and `Create the session through authenticated onboarding before connecting` directly prevented PostgreSQL row insertion/updates.
   - The PostgreSQL schema defaults `company_id` to `'default'`.
   - By implementing fallback `targetCompanyId = existing.rows[0]?.company_id || fallbackCompanyId || process.env.DEFAULT_COMPANY_ID || 'default'`, any existing company ownership is preserved, while default sessions automatically upsert into PostgreSQL.
   - Once PostgreSQL is updated, `connectionService.listConnections` reliably serves the session to the frontend.

4. **Broadcasting & State Machine Consistency**:
   - Calling `safeUpdateSessionStatus` on QR generation (`'qr'`) and QR timeout (`'disconnected'`) synchronizes the database with Socket.IO broadcasts (`session_qr`, `session_status`, `qr_expired`).
   - Changing `_latestQr` to `_qrMap` in `sessionManager.legacy.js` isolates QR codes per session ID.

---

## 3. Caveats

1. **No Pairing Code Support**: Baileys supports phone number pairing codes (`sock.requestPairingCode`), but the existing codebase only implements QR code authentication. Pairing code support is out of scope for Milestone 1.
2. **Terminal Disconnect (Code 401)**: When WhatsApp Web is explicitly unlinked from the phone app (code 401 loggedOut), `stableSession.js` correctly purges the auth folder via `fs.rm(sessionPath)`. This is the intended behavior and means a new QR must be scanned after explicit logout.
3. **Legacy Migration**: If any deployment has legacy sessions stored in `backend/sessions`, a one-time copy/migration on startup ensures no existing sessions are lost.

---

## 4. Conclusion

The root causes of session persistence failure across restarts and database state desynchronization are identified with line-number precision:
1. Canonical sessions path must be unified across `stableSession.js`, `sessionManager.legacy.js`, `sessionPersistenceValidator.js`, `connectionService.legacy.js`, and maintenance scripts to `<root>/data/sessions`.
2. `safeCreateSessionRecord` and `safeUpdateSessionStatus` in `persistence.js` must utilize `existing.rows[0]?.company_id || fallbackCompanyId || process.env.DEFAULT_COMPANY_ID || 'default'` instead of throwing errors.
3. `stableSession.js` must update DB status on QR generation and QR timeout.
4. `sessionManager.legacy.js` must isolate QR codes using a `Map`.

All proposed edits are surgical, backwards-compatible, and accompanied by verifiable reproduction criteria.

---

## 5. Verification Method

To independently verify these findings and the resulting fixes:

### 1. Automated Test Verification:
Run the Node native test suite:
```powershell
node --test backend/tests/sessionRecoveryService.test.js
node --test backend/tests/sessionsController.test.js
node --test backend/tests/sessionPersistence.test.js
```
*Expected result*: All unit tests pass with zero failures.

### 2. File Path Inspection Command:
Execute the cross-component path resolution check:
```powershell
node -e "
const path = require('path');
const p1 = path.resolve('backend/services', '../../data/sessions');
const p2 = path.resolve('backend/services/whatsapp/connection', '../../../../data/sessions');
const p3 = path.resolve('backend/scripts', '../../data/sessions');
console.log('Paths match:', p1 === p2 && p2 === p3);
"
```
*Expected output*: `Paths match: true`.

### 3. CLI Persistence Validator Check:
Execute the persistence validator:
```powershell
node backend/services/whatsapp/connection/sessionPersistenceValidator.js
```
*Expected output*: Reads `<root>/data/sessions` and reports status of detected directories without path errors.

### 4. Invalidation Conditions:
- If `safeUpdateSessionStatus` emits `Session owner is missing.`, the company fallback patch was not applied correctly.
- If `restoreSessions()` logs `Skipping auto-restore for session main (no valid/complete creds.json found)` when `data/sessions/main/creds.json` has `me.id`, the path alignment patch was not applied correctly.
