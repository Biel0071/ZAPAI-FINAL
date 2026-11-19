# Survey Report: WhatsApp Session Instantiation and Connection Stability (Requirement R1)

**Target System**: ZapAI CRM / ZAPFLOW (Baileys WhatsApp Integration)  
**Investigation Date**: 2026-11-04  
**Investigator**: explorer_survey_1 (Read-Only Explorer)  
**Reference Requirement**: `ORIGINAL_REQUEST.md` — Requirement R1  

---

## 1. Executive Summary

Requirement R1 demands that WhatsApp sessions connect and remain stable without unexpected drops, that disconnects trigger automatic reconnection with exponential backoff, that session credentials persist across restarts without requiring QR re-scanning, and that real-time connection states accurately reflect across the frontend and database.

Our deep-dive investigation into the backend architecture revealed **one critical root-cause defect** that directly causes sessions to fail to persist across restarts, alongside **several secondary reliability and concurrency vulnerabilities**:

1. **CRITICAL PATH DIVERGENCE (Session Persistence Breakage)**:
   - `backend/services/whatsapp/connection/stableSession.js` (line 99) creates and persists Baileys multi-file auth credentials to:  
     `path.join(__dirname, '../../../../data/sessions')` (`<root>/data/sessions/<sessionId>/`).
   - Conversely, `backend/services/sessionManager.legacy.js` (line 20), `backend/services/whatsapp/connection/sessionPersistenceValidator.js` (line 24), and `backend/services/connectionService.legacy.js` (line 432) all inspect, list, validate, and clean up:  
     `path.join(__dirname, '../sessions')` (`<root>/backend/sessions/<sessionId>/`).
   - **Impact**: When the server boots or restarts, `sessionManager.restoreSessions()` calls `validateSession(sessionId)`. Because `validateSession` looks in `backend/sessions/` instead of `data/sessions/`, `creds.json` is not found. The system outputs `Skipping auto-restore for session main (no valid/complete creds.json found)` and **refuses to restore the session**, forcing a re-scan of the QR code every time!
2. **Double Backoff / Reconnect Race Condition**:
   - `stableSession.js` implements a reconnect cooldown timer (`computeReconnectDelay`, line 137) and then delegates to `onReconnectRequested`.
   - `sessionManager.legacy.js` (line 492) schedules *another* exponential backoff timer (`5000 * 2^(attempt-1)`).
   - `MAX_RECONNECT_ATTEMPTS` is set to 1000, which can cause excessive retry loops on unrecoverable network issues.
3. **Single Global QR Code Variable**:
   - In `backend/services/sessionManager.legacy.js` (lines 32-49), `_latestQr` is stored in a single module-level variable rather than a per-session map, causing QR collisions in multi-session environments.
4. **Database Insertion Prerequisite Trap**:
   - `safeUpdateSessionStatus` in `backend/services/whatsapp/connection/persistence.js` (line 63) rejects updates with `Session owner is missing.` unless a record already exists with a populated `company_id` in PostgreSQL table `sessions`. If a session is initialized via legacy routes or auto-start without prior DB creation, status updates silently fail.
5. **No Pairing Code Support**:
   - Only QR code pairing is implemented; Baileys `sock.requestPairingCode()` is not integrated.

---

## 2. Architecture & Lifecycle Call Flow

```
[ Frontend: Connections.tsx / socketManager.ts ]
                     │  HTTP (REST) / Socket.IO
                     ▼
[ API Routes: /src/api/routes/sessions.js & whatsapp.js ]
                     │
                     ▼
[ Controller: /src/api/controllers/sessionsController.js ]
                     │
                     ▼
[ Service: /backend/services/connectionService.legacy.js ]
                     │  (normalizes status, inspects active socket state)
                     ▼
[ Manager: /backend/services/sessionManager.legacy.js ]
                     │  (lifecycle state machine, in-flight locks, startup promises)
                     ▼
[ Factory: /backend/services/whatsapp/connection/stableSession.js ]
                     │
     ┌───────────────┴───────────────┐
     ▼                               ▼
[ Baileys makeWASocket ]   [ useMultiFileAuthState ]
(WebSocket to WhatsApp)    (stores creds.json & signal keys)
```

### Call Flow on Server Boot:
1. `backend/server.js` (line 1831) runs `sessionManager.configureSessionManager({ io, onIncomingMessage, onSessionConnected })`.
2. `server.listen(4025)` triggers `systemManager.startSystem(store)` (line 1876).
3. `systemManager.js` (line 138):
   - Sets `sessionManager.setRuntimeActive(true)`.
   - Awaits `sessionManager.restoreSessions()`.
   - Awaits `sessionRecoveryService.recoverSessions()`.
   - Awaits `sessionManager.reconcileSessions()`.
4. `sessionManager.restoreSessions()`:
   - Calls `listStoredSessionNames()` to read directories.
   - For each candidate session, calls `validateSession(sessionId)`.
   - Calls `startSession(sessionId, { displayName })`.

---

## 3. Component Breakdown & Source Analysis

### A. Controller & Router Layer
- **Routes (`backend/src/api/routes/sessions.js` & `backend/src/api/routes/whatsapp.js`)**:
  - `POST /session/start`, `POST /session/create`, `POST /sessions/start`, `POST /sessions/create` -> `sessionsController.create`
  - `GET /sessions`, `GET /connections`, `GET /api/whatsapp/sessions` -> `sessionsController.list`
  - `GET /sessions/status`, `GET /session/status`, `GET /sessions/:id/status` -> `sessionsController.getStatus`
  - `GET /sessions/qr`, `GET /sessions/:id/qr` -> `sessionsController.getQr`
  - `POST /sessions/:id/reconnect` -> `sessionsController.reconnect`
  - `POST /sessions/restart` -> `sessionsController.restart`
  - `POST /sessions/logout` -> `sessionsController.logout`
  - `DELETE /sessions/:id` -> `sessionsController.remove`
  - `POST /sessions/reconcile` -> `sessionsController.reconcile`
  - `POST /sessions/recover` -> `sessionsController.recover`
- **Controller (`backend/src/api/controllers/sessionsController.js`)**:
  - Line 33: Checks `req.authTenantId` (JWT tenant verification).
  - Line 38: Inserts into `sessions (company_id, session_id, session_name, status)` on conflict do nothing.
  - Line 50: Verifies `sessionManager.isRuntimeActive()`; if false, auto-activates `systemManager.startSystem()`.
  - Line 61: Delegates to `connectionService.createConnection(targetSessionId, requestedDisplayName)`.
  - Lines 85, 120: Asynchronously triggers `sessionRecoveryService.recoverSessions()` during `list` and `getStatus` calls.

### B. Connection Normalizer (`backend/services/connectionService.legacy.js`)
- Line 75 (`normalizeSession`): Validates actual socket health:
  ```javascript
  const hasSocket = !!(
    session.sock &&
    session.sock.ws &&
    (session.sock.ws.readyState === undefined || session.sock.ws.readyState === 1)
  );
  const isReallyConnected = !!(
    hasSocket &&
    session.sock?.user &&
    (session.connected === true ||
     session.connection === 'open' ||
     session.state === 'CONNECTED' ||
     session.status === 'connected')
  );
  ```
  If `session.status === 'connected'` but `isReallyConnected` is false, it forces status to `'disconnected'` to eliminate phantom/ghost sessions.
- Line 250 (`listConnections`): Joins database records from `sessionRepository.getSessions(companyId)` with memory sessions from `sessionManager.listSessions()`.
- Line 432 (`getSessionHealth`): Inspects socket readyState, user object, and checks filesystem for `creds.json`.

### C. Session Manager (`backend/services/sessionManager.legacy.js`)
- Registry Maps:
  - `sessions = new Map()`: In-memory session objects.
  - `activeSessions`: Shared object reference from `backend/services/whatsapp/state/registry.js` (used directly by `stableSession.js`).
  - `startupPromises = new Map()`: Prevents duplicate concurrent socket initializations for the same session.
  - `reconnectTimers = new Map()`: Active backoff timers.
  - `reconnectAttempts = new Map()`: Reconnect attempt counters per session.
  - `reconnectInFlight = new Set()`: Lock set preventing overlapping reconnect routines.
- Line 175 (`closeSocket`): Comprehensive socket teardown:
  ```javascript
  session.isClosing = true;
  clearInterval(session.heartbeatTimer);
  clearTimeout(session.qrTimeoutTimer);
  clearTimeout(session.reconnectCooldownTimer);
  clearTimeout(session.reconnectRequestTimer);
  session.sock?.ev?.removeAllListeners?.();
  if (logout && session.sock?.logout) await session.sock.logout();
  if (session.sock?.end) session.sock.end(undefined);
  if (session.sock?.ws?.close) session.sock.ws.close();
  session.isClosing = false;
  ```
- Line 297 (`disposeSession`): Clears timers, pauses automations (`pauseSessionAutomations`), closes socket, deletes from `sessions` and `activeSessions`, updates DB to `disconnected`, and optionally triggers Node.js `global.gc()` to prevent V8 socket memory retention.

### D. Baileys Engine (`backend/services/whatsapp/connection/stableSession.js`)
- Dynamic import of `@whiskeysockets/baileys` (line 1101) to support ESM-in-CJS.
- Baileys Socket Configuration (line 1150):
  - `browser: baileys.Browsers.ubuntu('Chrome')`
  - `syncFullHistory: true`
  - `shouldSyncHistoryMessage: () => true`
  - `fireInitQueries: false`
  - `connectTimeoutMs: 60000`
  - `defaultQueryTimeoutMs: 60000`
  - `keepAliveIntervalMs: 30000`
  - `msgRetryCounterCache: new Map()`
  - `getMessage`: Resolves historical messages via `messageRepository.findByWhatsappMessageId(key.id)`.
- Core Listeners:
  - `creds.update` (line 1253): Calls `saveCreds()`.
  - `connection.update` (line 1267): Handles `connection: 'connecting'`, `qr`, `open`, and `close`.
  - `messaging-history.set` (line 2575): Ingests historical contacts and messages via `historySync`.
  - `messages.upsert` (line 1888): Dispatches inbound messages to enterprise queues and deduplicates via ring buffer.
  - `messages.update` (line 2642): Emits message status updates (read, delivered, sent).

---

## 4. Authentication State & Persistence (The Critical Bug)

### Path Divergence Evidence Table

| Component File | Declared Path Variable | Target Path on Local OS | Target Path in Docker |
|---|---|---|---|
| `backend/services/whatsapp/connection/stableSession.js:99` | `path.join(__dirname, '../../../../data/sessions')` | `c:\projetos\ZAPAI-FINAL\data\sessions` | `/data/sessions` |
| `backend/services/sessionManager.legacy.js:20` | `path.join(__dirname, '../sessions')` | `c:\projetos\ZAPAI-FINAL\backend\sessions` | `/app/sessions` |
| `backend/services/whatsapp/connection/sessionPersistenceValidator.js:24` | `path.join(__dirname, '../../../sessions')` | `c:\projetos\ZAPAI-FINAL\backend\sessions` | `/app/sessions` |
| `backend/services/connectionService.legacy.js:432` | `path.join(__dirname, '../sessions')` | `c:\projetos\ZAPAI-FINAL\backend\sessions` | `/app/sessions` |
| `backend/scripts/protect-whatsapp-sessions.js:7` | `path.join(ROOT, 'sessions')` | `c:\projetos\ZAPAI-FINAL\backend\sessions` | `/app/sessions` |
| `backend/scripts/session_reset_and_qr.js:102` | `path.join(__dirname, '..', 'sessions', sessionId)` | `c:\projetos\ZAPAI-FINAL\backend\sessions\main` | `/app/sessions/main` |

### The Failure Chain on App Restart:
1. When WhatsApp pairs, Baileys `useMultiFileAuthState(sessionPath)` writes `creds.json` and keys into `<root>/data/sessions/main/`.
2. When the backend restarts, `systemManager.startSystem` calls `sessionManager.restoreSessions()`.
3. `sessionManager.legacy.js` executes `listStoredSessionNames()`:
   - Scans `SESSIONS_DIRECTORY` (`backend/sessions/`) -> finds **empty** directory.
   - Falls back to query `sessionRepository.getSessions()` -> retrieves `{ sessionId: 'main' }`.
4. `sessionManager.legacy.js` (line 749) calls `validateSession('main')`.
5. `sessionPersistenceValidator.js` inspects `SESSIONS_ROOT/main/creds.json` (`backend/sessions/main/creds.json`).
6. Because the file is in `data/sessions/main/creds.json`, `stat` / `access` throws `ENOENT`.
7. `validateSession` returns `{ ok: false, warnings: ['creds.json missing...'] }`.
8. `restoreSessions()` outputs:
   `[WHATSAPP] Skipping auto-restore for session main (no valid/complete creds.json found).`
9. Next, `sessionRecoveryService.recoverSessions()` runs:
   - Calls `listSessionIds()` from `sessionPersistenceValidator.js` (scans `backend/sessions/`) -> returns `[]`.
   - Does nothing.
10. **Result**: The session is never auto-reconnected. The user sees `disconnected` and must generate and scan a new QR code.

---

## 5. Socket Creation, QR Loop, Pairing Codes & State Transitions

### State Machine Diagram

```
                 ┌────────────────────────────────────────────────┐
                 │                                                │
                 ▼                                                │
          [ DISCONNECTED ]                                        │
                 │                                                │
                 │  startSession() / createConnection()           │
                 ▼                                                │
          [ CONNECTING ]                                          │
                 │                                                │
        ┌────────┴────────────────────────┐                       │
        │ update.qr                       │ update.connection === 'open'
        ▼                                 ▼                       │
    [ QR_READY ]                     [ CONNECTED ]                │
        │                                 │                       │
        │ QR timeout (120s)               │ connection === 'close'│
        │ (socket closed,                 │                       │
        │  auth preserved)                ▼                       │
        │                           Is Terminal?                  │
        │                             (401, 403, 411, 440)        │
        │                             ├─ YES ──> [ DISCONNECTED ] ┘
        │                             │          (401: delete creds)
        │                             │
        └─────────────────────────────┴─ NO ───> [ CONNECTING ]
                                                 (backoff schedule)
```

### QR Code Lifecycle:
- Emitted from Baileys as raw string in `update.qr`.
- Converted via `toQrDataUrl(qr)` using `qrcode` library (errorCorrectionLevel `M`, margin `1`, width `320`).
- Timeout Protection:
  - `stableSession.js` line 1315: `QR_TIMEOUT_MS = 120_000` (2 minutes).
  - If not scanned in 2 minutes, timer fires:
    - Status set to `disconnected`.
    - `sock.end(undefined)` closes the socket.
    - Auth files are **preserved** (not deleted).
    - Emits `qr_expired` event to frontend.
- Caching:
  - In `sessionManager.legacy.js`: stored in `_latestQr` with TTL `QR_TTL_MS = 60_000` (60s).

### Pairing Codes:
- `sock.requestPairingCode(phoneNumber)` is **not supported** in current codebase. Only QR scanning is wired up.

---

## 6. Disconnect Handling & Baileys Error Codes

Implemented across `backend/services/whatsapp/connection/reconnect.js` and `stableSession.js`:

```javascript
const DisconnectReason = {
  connectionClosed: 428,
  connectionLost: 408,
  connectionReplaced: 440,
  timedOut: 408,
  loggedOut: 401,
  badSession: 500,
  restartRequired: 515,
  multideviceMismatch: 411,
  forbidden: 403,
  unavailableService: 503
};
```

### Classification Matrix

| Status Code | Baileys Constant | Category | Action Taken by System |
|---|---|---|---|
| **401** | `loggedOut` | **Terminal** | `isBanned = true`. Deletes session folder (`fs.rm(sessionPath)`). Disposes session. Emits `session_logged_out`. Next connect gets fresh QR. |
| **403** | `forbidden` | **Terminal** | `isBanned = true`. Keeps folder. Marks disconnected. |
| **411** | `multideviceMismatch` | **Terminal** | Marks disconnected. Keeps folder. |
| **440** | `connectionReplaced` | **Terminal** | Another WhatsApp Web/Desktop session opened. Disposes session. Marks disconnected. |
| **408** | `timedOut` / `connectionLost` | **Transient** | `willReconnect = true`. Enters backoff reconnect. |
| **428** | `connectionClosed` | **Transient** | `willReconnect = true`. Enters backoff reconnect. |
| **500** | `badSession` | **Transient** | Desynchronized Signal ratchet. Reconnect preserves folder with backoff. |
| **503** | `unavailableService` | **Transient** | WhatsApp server transient 503. Reconnects with backoff. |
| **515** | `restartRequired` | **Transient** | Normal Baileys post-handshake sync. Triggers immediate/clean reconnect. |
| **409** | Conflict | N/A | Sets `session.hasConflict = true`. |

---

## 7. Auto-Reconnection, Backoff, Socket Cleanup & Concurrency

### Dual Backoff Implementation Detail:
1. **Layer 1 (`stableSession.js` lines 1713-1724, 1825)**:
   - Sets cooldown timer: `cooldownMs = computeReconnectDelay(attempt) + 5000` where `delays = [5s, 15s, 30s, 60s, 120s]`.
   - Prevents duplicate close events from triggering concurrent reconnects.
   - Calls callback `onReconnectRequested(normalizedSessionName, { closeCode })`.
2. **Layer 2 (`sessionManager.legacy.js` lines 455-526)**:
   - Receives `onReconnectRequested`.
   - Checks guards: `!runtimeActive`, `reconnectTimers.has()`, `reconnectInFlight.has()`, `targetSession.isDisposed`.
   - Computes backoff: `Math.min(5000 * Math.pow(2, attempt - 1), 60000)` (5s, 10s, 20s, 40s, 60s max).
   - Starts timer -> calls `disposeSession(normalizedTarget, { preserveReconnectAttempts: true })` -> calls `startSession(normalizedTarget, { forceNew: true })`.

### Watchdog Supervisor (`backend/services/sessionWatchdog.js`):
- Runs as background monitor via `workerSupervisor`.
- Detects:
  - Stuck in `connecting` for > 2 minutes (`STALE_CONNECTING_MS = 120_000`).
  - Stale in reconnect limbo for > 5 minutes (`STALE_RECONNECTING_MS = 300_000`).
  - Dead heartbeat (status `connected` but no ping for > 3 minutes, `STALE_HEARTBEAT_MS = 180_000`).
- Auto-restarts up to 3 times per hour (`MAX_AUTO_RESTART_PER_HOUR = 3`) using `canAutoRestart()`.

### Socket Cleanup & Memory Leak Protection:
- `session.sock.ev.removeAllListeners()` is invoked before socket termination.
- Sockets closed in three stages: `sock.logout()` (if requested) -> `sock.end(undefined)` -> `sock.ws.close()`.
- Active references cleaned in both `sessions` Map and `activeSessions` shared object.
- Explicit `global.gc()` called if exposed via Node flag `--expose-gc`.

### Concurrency Vulnerabilities:
- `_latestQr` in `sessionManager.legacy.js` is a single variable, not a Map keyed by `sessionId`.
- `DEFAULT_SESSION = 'main'` is used as a fallback across routes and managers. If multiple sessions run, status queries without explicit query params default to `'main'`.

---

## 8. Real-Time Status Broadcasting & Database Tracking

### Broadcast Events Matrix

| Event Name | Emitter Source | Payload Highlights | Frontend Consumer |
|---|---|---|---|
| `session_status` / `session:status` | `realtime/events.js:164` | `{ sessionId, sessionName, status, connected, phone, qr, updatedAt }` | `socketManager.ts` -> `RuntimeProvider` |
| `connection.update` | `realtime/events.js:141` | `{ connection, qr, hasQr, reasonCode, sessionId }` | `socketManager.ts` |
| `session_qr` / `qr.update` | `stableSession.js:1352` | `{ sessionId, qr, status: 'qr' }` | `Connections.tsx` |
| `session_connected` / `session.connected` | `stableSession.js:1518` | `{ sessionId, phone, status: 'connected', whatsappName }` | `socketManager.ts` -> `Connections.tsx` |
| `session_disconnected` / `session.disconnected` | `stableSession.js:1784` | `{ sessionId, status: 'disconnected' }` | `socketManager.ts` -> `Connections.tsx` |
| `session_logged_out` | `stableSession.js:1862` | `{ sessionId, sessionName }` | `socketManager.ts` -> `Connections.tsx` |
| `system:runtime-status` | `sessionManager.legacy.js:135` | `{ sessions: [...], status: 'online' \| 'offline' }` | `RuntimeProvider.tsx` |

### Database Tracking:
- PostgreSQL Table `sessions`:
  - Columns: `id`, `company_id`, `session_id`, `session_name`, `status`, `phone_number`, `whatsapp_name`, `automation_paused`, `created_at`.
- Updated via `sessionRepository.updateSessionStatus()`:
  - On connection open: status = `'connected'`, phone = `session.phone`, whatsapp_name = `resolvedWhatsAppName`.
  - On connection close: status = `'connecting'` (if reconnect scheduled) or `'disconnected'`.
  - On session dispose: status = `'disconnected'`.

---

## 9. Existing Test Coverage & Failure Points

### Audit of Existing Backend Tests:
- `backend/tests/sessionRecoveryService.test.js`:
  - Passes (2 tests), but **mocks** `sessionManager` and `sessionPersistenceValidator`. Does not touch the filesystem or test real path resolution.
- `backend/tests/sessionsController.test.js`:
  - Tests `checkNumber` and `assignAttendant` in a VM sandbox with mocked dependencies.
- `backend/tests/sessionMemory.test.js`:
  - Tests agent memory graph, not WhatsApp session connectivity.

### Untested & Fragile Areas:
1. **Zero Tests for Credential Persistence Across Restarts**: No test verifies that credentials written to disk are successfully loaded by `sessionManager.restoreSessions()` or `sessionRecoveryService.recoverSessions()`.
2. **Zero Tests for Baileys Disconnect Reason Handling**: No test asserts that a 515 restartRequired code results in auto-reconnection while a 401 results in session folder deletion.
3. **Zero Tests for QR Code Expiration & Cleanup**: No test verifies that an unscanned QR properly transitions to `disconnected` after 120s without deleting auth files.

---

## 10. Recommended Remediation Plan for Requirement R1

To achieve full production stability for Requirement R1, the implementation plan should address:

1. **Unify Sessions Directory Path (Fix Persistence)**:
   - Define a single authoritative constant or environment variable (e.g. `process.env.WHATSAPP_SESSIONS_DIR` defaulting to a canonical resolved path like `path.resolve(__dirname, '../../../data/sessions')`).
   - Align `sessionManager.legacy.js`, `sessionPersistenceValidator.js`, `connectionService.legacy.js`, and `stableSession.js` to use the **exact same** sessions directory.
   - Automatically inspect both `data/sessions` and `backend/sessions` on startup and migrate/symlink any existing credentials so no user session is lost.
2. **Harmonize Reconnection Timers**:
   - Consolidate the reconnect backoff into one authoritative layer (either `sessionManager` or `stableSession`), removing redundant backoff delays while maintaining exponential backoff capped at 60s.
   - Adjust `MAX_RECONNECT_ATTEMPTS` to a sensible production ceiling (e.g., 20 attempts before requiring manual operator intervention or watchdog reset).
3. **Multi-Session QR Isolation**:
   - Replace the single `_latestQr` variable in `sessionManager.legacy.js` with a `Map<string, { qr: string, expiresAt: number }>` to support multi-session concurrency safely.
4. **Resilient Database Status Synchronization**:
   - Ensure `safeCreateSessionRecord` and `safeUpdateSessionStatus` gracefully auto-upsert sessions with fallback to default company if unassigned, preventing persistence health degradation.
5. **Add Automated Regression Tests**:
   - Implement integration tests using `node:test` that verify:
     - Real filesystem `validateSession` with mock `creds.json`.
     - `sessionManager.restoreSessions()` correctly reads and validates real on-disk sessions.
     - `shouldReconnect()` correctly discriminates between 401 (terminal) and 515/428/408 (transient).
