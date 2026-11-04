# Technical Survey Report: Session Persistence, Auto-Restore on Boot & Real-Time Broadcasting (Features F1.2 & F1.4)

**Target System**: ZapAI CRM / ZAPFLOW (Baileys WhatsApp Integration)  
**Investigation Date**: 2026-11-04  
**Investigator**: m1_explorer_2 (Read-Only Explorer)  
**Milestone Scope**: Milestone 1 (`m1_whatsapp_session_stability`) — Features F1.2 & F1.4  
**Working Directory**: `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_explorer_2`  

---

## 1. Executive Summary & Root Cause Analysis

Requirements R1 and Acceptance Criteria specify:
1. *WhatsApp instance session credentials and state must persist across application restarts without requiring QR re-scanning unless the session is explicitly revoked.*
2. *WhatsApp instance session connects and stays connected without unexpected drops; disconnects trigger automatic reconnection.*
3. *Session connection states (`connecting`, `connected`, `disconnected`, `qr`) must reflect accurately in real time in both the database and the frontend.*

Our read-only code analysis uncovered two fatal bugs and two concurrency/state tracking deficiencies that prevent session persistence, break database updates, and cause sessions to disappear from the UI:

1. **Fatal Path Divergence (Session Auto-Restore Failure)**:
   - `stableSession.js` (line 99) writes auth credentials to `<root>/data/sessions/<sessionId>/creds.json`.
   - `sessionManager.legacy.js` (line 20) and `sessionPersistenceValidator.js` (line 24) look for credentials in `<root>/backend/sessions/<sessionId>/creds.json`.
   - On boot, `sessionManager.restoreSessions()` invokes `validateSession(sessionId)`. Because it inspects `backend/sessions/` instead of `data/sessions/`, `creds.json` is not found (`ENOENT`).
   - The boot routine logs `[WHATSAPP] Skipping auto-restore for session main (no valid/complete creds.json found).` and aborts connection restoration, forcing the user to re-scan a QR code on every single server restart.
2. **Fatal Database Trap (`Session owner is missing.` on Persistence)**:
   - In `backend/services/whatsapp/connection/persistence.js` (line 67), `safeUpdateSessionStatus` queries `SELECT company_id FROM sessions WHERE session_id=$1`. If `!existing.rows[0]?.company_id`, it unconditionally throws `new Error('Session owner is missing.')`.
   - In `safeCreateSessionRecord` (line 57), if the row does not already exist, it throws `new Error('Create the session through authenticated onboarding before connecting.')` rather than creating the row.
   - Consequently, when sessions connect or disconnect, every DB status update throws, marks persistence health as degraded (`persistenceHealth.degraded = true`), and fails to update the PostgreSQL `sessions` row.
   - In `connectionService.legacy.js` line 280, `listConnections()` queries the DB for `companyId`. Because the DB record does not exist or has status `disconnected`, line 280 (`if (companyId && !existing) continue;`) drops the active session from the response list entirely!
3. **Database State Gaps for QR Lifecycle**:
   - `stableSession.js` does not call `safeUpdateSessionStatus` when QR codes are generated or when QR codes time out after 120s, leaving PostgreSQL out of sync with real-time socket events.
4. **Global Single-QR Variable**:
   - `sessionManager.legacy.js` stores `_latestQr` in a single module-level variable rather than a session-keyed `Map`, risking QR code collision in multi-instance setups.

---

## 2. Boot Call Flow & `restoreSessions()` Deep Dive

### Call Sequence on Server Startup:
```
[ backend/server.js ]
         │  line 1831: sessionManager.configureSessionManager(...)
         │  line 1876: systemManager.startSystem(store)
         ▼
[ backend/services/systemManager.js ]
         │  line 138: sessionManager.setRuntimeActive(true)
         │  line 139: await sessionManager.restoreSessions()
         │  line 141: await sessionRecoveryService.recoverSessions()
         │  line 145: await sessionManager.reconcileSessions()
         ▼
[ backend/services/sessionManager.legacy.js ]
         │  restoreSessions()
         │   ├─ listStoredSessionNames()
         │   │   ├─ sessionRepository.getSessions(undefined, { activeOnly: false })
         │   │   └─ fs.readdir(SESSIONS_DIRECTORY)  <-- BUG: Points to backend/sessions
         │   ├─ filters candidates based on WHATSAPP_RESTORE_MODE
         │   └─ for each candidate:
         │       ├─ validation = await validateSession(sessionId) <-- BUG: Looks in backend/sessions
         │       ├─ if (!validation.ok) -> SKIPS auto-restore!
         │       └─ if (validation.ok)  -> startSession(sessionId, { displayName })
```

### Source Code Analysis: `backend/services/sessionManager.legacy.js`

```javascript
// Line 20: Path defect
const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions'); // Resolves to backend/sessions!

// Lines 710-771: restoreSessions()
async function restoreSessions() {
  const restoredSessions = [];
  const storedSessions = await listStoredSessionNames();
  const restoreMode = String(process.env.WHATSAPP_RESTORE_MODE || '').trim().toLowerCase();
  const defaultRestoreMode = 'active';
  const effectiveRestoreMode = restoreMode || defaultRestoreMode;
  ...
  for (const candidate of sessionsToRestore) {
    const sessionId = normalizeSessionName(candidate?.sessionId || candidate?.sessionName || DEFAULT_SESSION);
    const displayName = candidate?.sessionName || sessionId;

    try {
      const validation = await validateSession(sessionId);
      if (!validation.ok) {
        console.log(`[WHATSAPP] Skipping auto-restore for session ${sessionId} (no valid/complete creds.json found).`);
        continue;
      }

      const session = await startSession(sessionId, { displayName });
      restoredSessions.push({ ... });
    } catch (error) { ... }
  }
  return restoredSessions;
}
```

### Auto-Restore Restoration Modes:
- `active` (default): Restores all candidates found in storage/DB; falls back to `['main']`.
- `persisted`: Restores all candidates found in storage/DB.
- `allowlist`: Restores only sessions matching `WHATSAPP_RESTORE_SESSION_ALLOWLIST`.
- `none`: Disables auto-restore completely.

When `validateSession(sessionId)` returns `{ ok: true }`, `startSession()` is executed:
- Acquires in-flight promise lock (`startupPromises.set(normalizedName, startupPromise)`).
- Initializes `stableSession.js` via `whatsappService.createStableSession()`.
- Baileys connects without prompting for QR scanning.
- Dispatches `'session_connected'` and updates PostgreSQL status to `'connected'`.

---

## 3. Session Persistence Validator (`sessionPersistenceValidator.js`)

Located at `backend/services/whatsapp/connection/sessionPersistenceValidator.js`.

### Line 24 Path Defect:
```javascript
const SESSIONS_ROOT = path.join(__dirname, '..', '..', '..', 'sessions'); // Resolves to backend/sessions!
```

### Credential Validation Rules:
`validateSession(sessionId)` performs a 6-tier inspection:
1. **Directory Existence**: Verifies `path.join(SESSIONS_ROOT, sessionId)` is a valid directory via `fsp.stat`.
2. **creds.json Readability**: Verifies `path.join(sessionPath, 'creds.json')` via `fsp.access(R_OK)`.
3. **JSON Parse Integrity**: Validates `JSON.parse(raw)` passes without syntax errors.
4. **Key Completeness**: Checks `REQUIRED_CRED_KEYS = ['noiseKey', 'signedIdentityKey', 'registrationId', 'me']`.
   - **Crucial Architectural Role of `me`**: When Baileys first creates `creds.json` before pairing, `noiseKey`, `signedIdentityKey`, and `registrationId` are generated, but `creds.me` is `undefined`. Only after WhatsApp scans the QR and completes the handshake does Baileys populate `creds.me = { id: '...', name: '...' }`.
   - Therefore, verifying `creds.me` and `creds.me.id` guarantees that the session was truly paired and authenticated, preventing premature socket generation for orphan unauthenticated directories.
5. **Freshness Check**: Flags warnings if `creds.json` age > 30 days.
6. **Auxiliary Keys Check**: Checks for Signal ratchet keys (`pre-key-*.json`, `sender-key-*.json`).
7. **Result**: `result.ok = result.credsExists && result.credsValid && result.credsComplete`.

When `SESSIONS_ROOT` is aligned to `<root>/data/sessions`, `validateSession('main')` immediately finds the real credentials, enabling seamless auto-restoration.

---

## 4. Persistence Error Line 67 & Company Fallback Deep Dive

Located at `backend/services/whatsapp/connection/persistence.js`.

### Pathology Analysis:
```javascript
// Lines 51-61
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

// Lines 63-80
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

### Why This Broke the Entire System:
1. In PostgreSQL table `sessions`, the column definition (from `backend/migrations/001_initial_schema.js:4`) is:
   `company_id TEXT DEFAULT 'default'`.
2. In `sessionRepository.js:3`:
   ```javascript
   function getCompanyId(companyId) {
     return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
   }
   ```
3. When `safeCreateSessionRecord` was called during socket initialization (line 1248 of `stableSession.js`), it checked if the row existed. If not, it threw an error and refused to create it!
4. When `safeUpdateSessionStatus` was called on connection open/close, `existing.rows[0]?.company_id` was undefined. It threw `Session owner is missing.`, incremented `persistenceHealth.consecutiveFailures`, set `degraded = true`, and aborted!
5. When `connectionService.listConnections(companyId)` ran, line 280 dropped the session because no matching DB row existed.

### Robust Remediation:
- In `safeCreateSessionRecord(sessionId, sessionName, fallbackCompanyId)`:
  - If existing row with `company_id` exists: maintain it (never overwrite a tenant's company).
  - If not: create initial row using `sessionRepository.createSession` with `fallbackCompanyId || process.env.DEFAULT_COMPANY_ID || 'default'`.
- In `safeUpdateSessionStatus(sessionId, status, phone, sessionName, whatsappName, fallbackCompanyId)`:
  - Resolve company: `const targetCompany = existing.rows[0]?.company_id || fallbackCompanyId || process.env.DEFAULT_COMPANY_ID || 'default';`
  - Invoke `sessionRepository.updateSessionStatus(sessionId, status, phone, targetCompany, sessionName, whatsappName)`.
  - If the row does not exist, `sessionRepository.updateSessionStatus` automatically executes `createSession`.
  - Mark persistence success.

---

## 5. Real-Time Status Broadcasting Matrix

### Event Catalog:

| Event Name | Emitter File & Line | Trigger Condition | Payload Contract | Frontend Consumer |
|---|---|---|---|---|
| `session_qr` | `stableSession.js:1352` | Baileys emits new QR string | `{ sessionId, sessionName, name, status: 'qr', type: 'qr', qr: string, eventAt: number }` | `socketManager.ts:869` -> `RuntimeProvider.tsx` -> `Connections.tsx` |
| `session_status` / `session:status` | `realtime/events.js:164` | Any lifecycle state change (`connecting`, `qr_ready`, `connected`, `disconnected`) | `{ connected: boolean, status: string, sessionId: string, sessionName: string, phone: string\|null, qr: string\|null, eventAt: number, updatedAt: string }` | `socketManager.ts:883` -> `RuntimeProvider.tsx:468` (`store.upsertSession`) |
| `session_connected` | `stableSession.js:1518` | Baileys `connection === 'open'` | `{ sessionId, sessionName, name, status: 'connected', phone: string, whatsappName: string\|null, eventAt: number }` | `socketManager.ts:871` -> `RuntimeProvider.tsx:474` (clears QR, loads data) |
| `session_disconnected` | `stableSession.js:1784` | Baileys `connection === 'close'` | `{ sessionId, sessionName, name, status: 'disconnected', type: 'status', eventAt: number }` | `socketManager.ts:875` -> `RuntimeProvider.tsx:457` (`store.upsertSession`, clears cache) |
| `system:runtime-status` | `sessionManager.legacy.js:135` | Runtime activate/deactivate or session set | `{ sessions: Array<object>, status: 'online' \| 'offline' }` | `RuntimeProvider.tsx` |

### Database & WebSocket Sync Harmonization:
- **Missing QR state in DB**: Add `safeUpdateSessionStatus(normalizedSessionName, 'qr', null, session.sessionName, null, session.companyId)` inside `update.qr` in `stableSession.js:1301`.
- **Missing QR timeout state in DB**: Add `safeUpdateSessionStatus(normalizedSessionName, 'disconnected', null, session.sessionName, null, session.companyId)` inside `qrTimeoutTimer` in `stableSession.js:1320`.
- **Multi-Session QR Isolation**: Replace `_latestQr` singleton in `sessionManager.legacy.js:32` with `_qrMap = new Map()` keyed by `normalizeSessionName(sessionId)`.

---

## 6. Exact Line-by-Line File Modifications for Worker

### Modification 1: `backend/services/whatsapp/connection/persistence.js`
- **File**: `backend/services/whatsapp/connection/persistence.js`
- **Lines 51 to 80**: Replace `safeCreateSessionRecord` and `safeUpdateSessionStatus` with:
```javascript
const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID || 'default';

async function safeCreateSessionRecord(sessionId, sessionName, fallbackCompanyId = null) {
  try {
    const { query } = require('../../../src/infrastructure/config/database');
    const existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
    if (existing.rows[0]?.company_id) {
      markPersistenceSuccess('create_session_record');
      return existing.rows[0].company_id;
    }
    const targetCompanyId = fallbackCompanyId || DEFAULT_COMPANY_ID;
    await sessionRepository.createSession({
      companyId: targetCompanyId,
      sessionId,
      sessionName: sessionName || sessionId,
      status: 'connecting',
    });
    markPersistenceSuccess('create_session_record');
    return targetCompanyId;
  } catch (error) {
    markPersistenceFailure(sessionId, 'create_session_record', error);
  }
}

async function safeUpdateSessionStatus(sessionId, status, phone, sessionName, whatsappName = null, fallbackCompanyId = null) {
  try {
    const { query } = require('../../../src/infrastructure/config/database');
    const existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
    const targetCompanyId = existing.rows[0]?.company_id || fallbackCompanyId || DEFAULT_COMPANY_ID;
    await sessionRepository.updateSessionStatus(
      sessionId,
      status,
      phone,
      targetCompanyId,
      sessionName,
      whatsappName
    );
    markPersistenceSuccess('update_session_status');
  } catch (error) {
    markPersistenceFailure(sessionId, 'update_session_status', error);
  }
}
```

### Modification 2: `backend/services/whatsapp/connection/sessionPersistenceValidator.js`
- **File**: `backend/services/whatsapp/connection/sessionPersistenceValidator.js`
- **Line 24**: Change `SESSIONS_ROOT`:
```javascript
// BEFORE (Line 24):
const SESSIONS_ROOT = path.join(__dirname, '..', '..', '..', 'sessions');

// AFTER:
const SESSIONS_ROOT =
  process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../../../data/sessions');
```
- **Lines 94-102**: Tighten key check to verify `me.id`:
```javascript
// BEFORE:
  const missingKeys = REQUIRED_CRED_KEYS.filter((key) => !creds[key]);

// AFTER:
  const missingKeys = REQUIRED_CRED_KEYS.filter((key) => {
    if (!creds[key]) return true;
    if (key === 'me' && typeof creds.me === 'object' && !creds.me.id) return true;
    return false;
  });
```

### Modification 3: `backend/services/sessionManager.legacy.js`
- **File**: `backend/services/sessionManager.legacy.js`
- **Line 20**: Change `SESSIONS_DIRECTORY`:
```javascript
// BEFORE (Line 20):
const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');

// AFTER:
const SESSIONS_DIRECTORY =
  process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../data/sessions');
```
- **Line 29**: Cap `MAX_RECONNECT_ATTEMPTS`:
```javascript
// BEFORE (Line 29):
const MAX_RECONNECT_ATTEMPTS = 1000;

// AFTER:
const MAX_RECONNECT_ATTEMPTS = Math.max(1, Number(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || 20));
```
- **Lines 31-50**: Multi-session QR isolation:
```javascript
// BEFORE:
let _latestQr = null;
let _qrExpiresAt = 0;
const QR_TTL_MS = 60_000;

function setLatestQr(qr) {
  _latestQr = qr;
  _qrExpiresAt = Date.now() + QR_TTL_MS;
}

function clearLatestQr() {
  _latestQr = null;
  _qrExpiresAt = 0;
}

function getLatestQr() {
  if (!_latestQr || Date.now() > _qrExpiresAt) return null;
  return _latestQr;
}

// AFTER:
const _qrMap = new Map();
const QR_TTL_MS = 60_000;

function setLatestQr(qr, sessionId = DEFAULT_SESSION) {
  const normalized = normalizeSessionName(sessionId);
  _qrMap.set(normalized, {
    qr,
    expiresAt: Date.now() + QR_TTL_MS,
  });
}

function clearLatestQr(sessionId = DEFAULT_SESSION) {
  if (!sessionId) {
    _qrMap.clear();
    return;
  }
  _qrMap.delete(normalizeSessionName(sessionId));
}

function getLatestQr(sessionId = DEFAULT_SESSION) {
  const normalized = normalizeSessionName(sessionId);
  const entry = _qrMap.get(normalized);
  if (!entry || Date.now() > entry.expiresAt) {
    _qrMap.delete(normalized);
    return null;
  }
  return entry.qr;
}
```
- **Lines 448 & 535**:
  - Line 448: `setLatestQr(qr, normalizedName);`
  - Line 535: `clearLatestQr(normalizedName);`
  - Line 1002: `getSessionQr: (sessionId) => getLatestQr(sessionId),`

### Modification 4: `backend/services/whatsapp/connection/stableSession.js`
- **File**: `backend/services/whatsapp/connection/stableSession.js`
- **Line 99**:
```javascript
// BEFORE:
const SESSIONS_DIRECTORY = path.join(__dirname, '..', '..', '..', '..', 'data', 'sessions');

// AFTER:
const SESSIONS_DIRECTORY =
  process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../../../data/sessions');
```
- **Line 1248**:
```javascript
// Pass companyId to safeCreateSessionRecord
await safeCreateSessionRecord(normalizedSessionName, session.sessionName, session.companyId || historyOwner);
```
- **Line 1308**:
```javascript
// Persist 'qr' status to DB
await safeUpdateSessionStatus(normalizedSessionName, 'qr', null, session.sessionName, null, session.companyId);
```
- **Line 1321**:
```javascript
// Persist 'disconnected' status to DB on QR timeout
await safeUpdateSessionStatus(normalizedSessionName, 'disconnected', null, session.sessionName, null, session.companyId);
```
- **Line 1495**:
```javascript
// Pass session.companyId to safeUpdateSessionStatus on connection open
await safeUpdateSessionStatus(
  normalizedSessionName,
  'connected',
  session.phone,
  session.sessionName,
  resolvedWhatsAppName,
  session.companyId
);
```
- **Line 1772**:
```javascript
// Pass session.companyId to safeUpdateSessionStatus on connection close
await safeUpdateSessionStatus(
  normalizedSessionName,
  willReconnect ? 'connecting' : 'disconnected',
  session.phone,
  session.sessionName,
  null,
  session.companyId
);
```

### Modification 5: `backend/services/connectionService.legacy.js`
- **File**: `backend/services/connectionService.legacy.js`
- **Line 432**:
```javascript
// BEFORE:
  const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');

// AFTER:
  const SESSIONS_DIRECTORY =
    process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../data/sessions');
```

### Modification 6: Scripts Path Alignment
- `backend/scripts/protect-whatsapp-sessions.js` (line 7):
  `const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR || path.resolve(ROOT, '../data/sessions');`
- `backend/scripts/healthcheck.js` (line 36):
  `const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../data/sessions');`
- `backend/scripts/session_reset_and_qr.js` (line 102):
  `const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../data/sessions');`
  `const sessionDir = path.join(SESSIONS_DIR, sessionId);`

---

## 7. Verification Method & Proposed Automated Unit Test Suite

### New Test Suite: `backend/tests/sessionPersistence.test.js`
A dedicated Node native test file (`node:test`) verifying:
1. Canonical Path Resolution: Assert `path.resolve` across `sessionManager`, `sessionPersistenceValidator`, `connectionService`, and `stableSession` yields the identical string `.../data/sessions`.
2. Credential Validation:
   - Returns `{ ok: false }` when directory is missing.
   - Returns `{ ok: false }` when `creds.json` is missing or corrupt JSON.
   - Returns `{ ok: false }` when `creds.me` is missing or empty (`{}`).
   - Returns `{ ok: true }` when `creds.json` contains `noiseKey`, `signedIdentityKey`, `registrationId`, and `me: { id: '551199999999@s.whatsapp.net' }`.
3. Safe Persistence Fallback:
   - `safeCreateSessionRecord` and `safeUpdateSessionStatus` resolve missing `company_id` to `'default'` without throwing `Session owner is missing.`
   - Existing tenant company ID is preserved and not overwritten.
4. Multi-Session QR Isolation:
   - Storing QR for `session_a` does not overwrite or expire `session_b`.

### Verification Commands:
```bash
# 1. Run the session persistence unit tests
node --test backend/tests/sessionRecoveryService.test.js
node --test backend/tests/sessionsController.test.js
node --test backend/tests/sessionPersistence.test.js

# 2. Run session persistence CLI validator
node backend/services/whatsapp/connection/sessionPersistenceValidator.js
```
