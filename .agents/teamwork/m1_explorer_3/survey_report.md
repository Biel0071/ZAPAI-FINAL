# Survey Report: Reconnection State Machine, Error Code Handling & Teardown Cleanup (Feature F1.3)

**Target System**: ZAPFLOW WhatsApp Session Engine (Baileys `@whiskeysockets/baileys` v6.7.23)  
**Investigation Date**: 2026-11-04  
**Investigator**: `m1_explorer_3` (Read-Only Explorer)  
**Reference Requirement**: `PROJECT.md` — Feature F1.3 (`m1_whatsapp_session_stability`)  
**Working Directory**: `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m1_explorer_3`  

---

## 1. Executive Summary

Feature F1.3 requires standardizing disconnect reason codes, coordinating retry delay timers between `stableSession.js` and `sessionManager.legacy.js`, and ensuring existing Baileys socket listeners, timers, and WebSocket connections are cleanly terminated before reconnecting to prevent memory leaks and duplicate sockets.

Our investigation of `backend/services/whatsapp/connection/reconnect.js`, `stableSession.js`, `sessionManager.legacy.js`, `persistence.js`, and related runtime modules uncovered **five critical architectural defects and seven operational race conditions**:

1. **False "Banned" Flagging on User Logout (401)**:
   In `stableSession.js` (line 1702), `if (closeCode === 401 || closeCode === 403) session.isBanned = true;` marks any session logged out by the user (unlinked from mobile WhatsApp) as banned. Frontend components (`Diagnostics.tsx`, `ChatListPanel.tsx`, `Sidebar.tsx`) display an account ban warning when the user simply unlinked the device.
2. **Socket Listener & Connection Memory Leaks on Terminal Disconnects**:
   When a terminal disconnect occurs (e.g. 401 logged out, 403 forbidden, 440 connection replaced) or reconnect limit is reached, `stableSession.js` (lines 1844–1869) deletes the session from `activeSessions` and removes the disk directory, but **never invokes `sock.ev.removeAllListeners()` or closes the WebSocket connection**. Furthermore, `sessionManager.legacy.js`'s `sessions` Map retains the old session object indefinitely.
3. **Dual Competing Backoff Timers & Counter Desynchronization**:
   `stableSession.js` sets a `reconnectCooldownTimer` based on `[5s, 15s, 30s, 60s, 120s] + 5s`, and calls `onReconnectRequested`. Concurrently, `sessionManager.legacy.js` schedules another timer via `5000 * 2^(attempt - 1)`. When `sessionManager` reconnects and creates a new session, `session.reconnectRequestCount` in `stableSession.js` resets to 0 while `sessionManager.legacy.js` preserves `reconnectAttempts`.
4. **5-Second Connection Latency Trap on Code 515 (`restartRequired`)**:
   Baileys issues `DisconnectReason.restartRequired` (515) routinely as part of the initial handshake and stream synchronization. `sessionManager.legacy.js` applies its generic 5-second backoff to 515, introducing artificial delays in WhatsApp pairing and triggering QR timeout or user frustration. Code 515 requires an immediate reconnect (≤ 500ms).
5. **Lack of Backoff Jitter and Excessive Attempt Cap (1000 Retries)**:
   `sessionManager.legacy.js` has zero jitter in its exponential formula, causing thundering-herd reconnect storms when WhatsApp servers recover. `MAX_RECONNECT_ATTEMPTS` is set to 1000 in both files, meaning a failed session loops for over 16 hours instead of failing fast to a supervised error state.

---

## 2. Disconnect Reason Mapping & Error Code Matrix

Baileys emits `connection.update: { connection: 'close', lastDisconnect }` with a Boom error object. The status code must be extracted across `lastDisconnect?.error?.output?.statusCode`, `lastDisconnect?.error?.data?.statusCode`, or `lastDisconnect?.error?.code`.

### Error Classification & Lifecycle Action Matrix

| Status Code | Baileys Constant | Category | System Behavior & Action Required |
|---|---|---|---|
| **401** | `loggedOut` | **Terminal** | **DO NOT auto-reconnect**. Cleanly terminate Baileys socket (`removeAllListeners`, `sock.end()`, `ws.close()`). Delete canonical auth folder (`<root>/data/sessions/<sessionId>`). Mark `session.isLoggedOut = true` (NOT `isBanned`). Clear credentials in memory and DB. Set DB status to `disconnected`. Emit `session_logged_out` and `session_disconnected`. Remove from `sessions` and `activeSessions`. |
| **403** | `forbidden` | **Terminal** | **DO NOT auto-reconnect**. Cleanly terminate socket. Keep credentials on disk for forensics. Mark `session.isBanned = true`. Set DB status to `disconnected`. Emit `session_disconnected`. Remove from active maps. |
| **411** | `multideviceMismatch` | **Terminal** | **DO NOT auto-reconnect**. Cleanly terminate socket. Keep folder. Set DB status to `disconnected`. Emit `session_disconnected`. Requires user action. |
| **440** | `connectionReplaced` | **Terminal** | **DO NOT auto-reconnect**. Cleanly terminate socket. Another WhatsApp Web/Desktop client connected with the same session. Set DB status to `disconnected`. Keep credentials intact so user can reconnect manually without QR re-scan. |
| **408** | `timedOut` / `connectionLost` | **Transient** | **Auto-reconnect with exponential backoff + jitter**. Transient network timeout or ping dropped. Set DB status to `connecting`. Reconnect schedule: 5s, 10s, 20s... capped at 60s + random jitter [0..1000ms]. |
| **428** | `connectionClosed` | **Transient** | **Auto-reconnect with exponential backoff + jitter**. TCP/TLS connection closed by WhatsApp gateway. Set DB status to `connecting`. |
| **500** | `badSession` | **Transient** | **Auto-reconnect with exponential backoff + jitter**. Signal ratchet synchronization hiccup. Preserve auth folder (do NOT delete). Reconnect allows keys to re-align. |
| **503** | `unavailableService` | **Transient** | **Auto-reconnect with exponential backoff + jitter**. WhatsApp server temporary overload / maintenance. |
| **515** | `restartRequired` | **Transient (Immediate)** | **Immediate auto-reconnect (delay ≤ 500ms, NO backoff)**. Standard Baileys post-handshake stream restart. Immediate reconnection completes the handshake instantly without user-visible lag. |
| **409** | `conflict` | **Special** | Sets `session.hasConflict = true`. Managed via stream negotiation. |
| *Unknown / Network (e.g. ECONNRESET, ETIMEDOUT)* | `null` / custom | **Transient** | Defaults to transient auto-reconnect with standard exponential backoff + jitter. |

---

## 3. Coordinated Backoff Architecture & Eliminating Race Conditions

### The Dual-Timer Flaw in Current Architecture

Currently, two separate layers implement backoff logic:
1. `backend/services/whatsapp/connection/stableSession.js`:
   - Line 137: `computeReconnectDelay(attempt)` with hardcoded array `[5000, 15000, 30000, 60000, 120000]`.
   - Line 1719: Sets `session.reconnectCooldownTimer = setTimeout(..., computeReconnectDelay(...) + 5000)`.
   - Line 1825: Calls `onReconnectRequested(normalizedSessionName, { closeCode, generation })`.
2. `backend/services/sessionManager.legacy.js`:
   - Line 492: Schedules its own timer: `const backoffMs = Math.min(5000 * Math.pow(2, attempt - 1), 60000)`.
   - Line 513: Fires timer -> calls `disposeSession()` -> calls `startSession()`.
   - During `startSession()`, `createStableSession()` instantiates a fresh `session` object whose `reconnectRequestCount` resets to 0.

### The Single-Authority Solution

1. **Centralize Backoff Calculation in `reconnect.js`**:
   Export a pure helper `computeReconnectBackoff(attempt, closeCode, options)`:
   - For `closeCode === 515`: Returns immediate delay: `options.immediateDelayMs || 500` ms.
   - For other transient codes: Computes `Math.min(baseMs * Math.pow(2, attempt - 1), maxMs) + jitterMs` where `jitterMs = Math.floor(Math.random() * 1000)`.
   - Caps max backoff at 60,000ms.
2. **Single Scheduling Authority in `sessionManager.legacy.js`**:
   - `stableSession.js` handles socket lifecycle, extracts `closeCode`, and delegates to `onReconnectRequested(normalizedSessionName, { closeCode })`.
   - `sessionManager.legacy.js` owns the single backoff timer `reconnectTimers.get(normalizedTarget)`.
   - Eliminate redundant cooldown timer in `stableSession.js` that was freezing `session.reconnecting = true` for up to 125 seconds.
3. **Cap Maximum Reconnect Attempts**:
   - Set `MAX_RECONNECT_ATTEMPTS = Math.max(1, Number(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || 25))`.
   - At 25 attempts (5s, 10s, 20s, 40s, 60s x 21), the system retries for approximately 22 minutes before transitioning to `status: 'error'`.
   - This allows `sessionWatchdog.js` to supervise and restart if appropriate, rather than spinning 1000 times.

---

## 4. Socket Teardown & Memory Leak Prevention

When a socket is disconnected (whether preparing for reconnect, logging out, or shutting down), every associated listener, timer, and WebSocket connection must be cleanly detached.

### Teardown Checklist

```javascript
async function teardownSessionSocket(session, { logout = false } = {}) {
  if (!session) return;
  session.isClosing = true;

  // 1. Clear all intervals and timeouts
  if (session.heartbeatTimer) {
    clearInterval(session.heartbeatTimer);
    session.heartbeatTimer = null;
  }
  if (session.bufferFlushInterval) {
    clearInterval(session.bufferFlushInterval);
    session.bufferFlushInterval = null;
  }
  if (session.qrTimeoutTimer) {
    clearTimeout(session.qrTimeoutTimer);
    session.qrTimeoutTimer = null;
  }
  if (session.reconnectCooldownTimer) {
    clearTimeout(session.reconnectCooldownTimer);
    session.reconnectCooldownTimer = null;
  }
  if (session.reconnectRequestTimer) {
    clearTimeout(session.reconnectRequestTimer);
    session.reconnectRequestTimer = null;
  }
  if (session.catalogSyncTimer) {
    clearTimeout(session.catalogSyncTimer);
    session.catalogSyncTimer = null;
  }
  if (session.blocklistSyncTimer) {
    clearTimeout(session.blocklistSyncTimer);
    session.blocklistSyncTimer = null;
  }

  session.reconnecting = false;
  session.reconnectRequestPending = false;

  // 2. Remove all Baileys EventEmitter listeners
  try {
    session.sock?.ev?.removeAllListeners?.();
  } catch (_) {}

  // 3. Remove all native WebSocket listeners and close connection
  try {
    session.sock?.ws?.removeAllListeners?.();
  } catch (_) {}

  // 4. Logout if explicitly requested (e.g. user initiated logout)
  try {
    if (logout && session.sock?.logout) {
      await session.sock.logout();
    }
  } catch (_) {}

  // 5. Terminate socket and close WS
  try {
    if (session.sock?.end) {
      session.sock.end(undefined);
    }
  } catch (_) {}

  try {
    if (session.sock?.ws?.close) {
      session.sock.ws.close();
    }
  } catch (_) {}

  // 6. Null out socket reference to enable garbage collection
  session.sock = null;
  session.isClosing = false;
}
```

### Complete Teardown on Terminal Disconnects
In `stableSession.js`, on `connection === 'close'` where `terminalDisconnect === true`:
1. Execute `await teardownSessionSocket(session)`.
2. Delete canonical session folder for 401: `await fs.rm(sessionPath, { force: true, recursive: true })`.
3. Inform `sessionManager` to dispose the session from memory:
   `await require('../../sessionManager').disposeSession(normalizedSessionName, { deleteFolder: closeCode === 401, logout: false })`.
4. Update database status to `'disconnected'` with resilience fallback.

---

## 5. Database Status & Persistence Resilience

### Root Cause of `Session owner is missing.` Failure
In `backend/services/whatsapp/connection/persistence.js` (line 67):
```javascript
const existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
if (!existing.rows[0]?.company_id) throw new Error('Session owner is missing.');
```
If a session was initialized via legacy routes, auto-start, or before onboarding completed, `existing.rows[0]` is undefined, causing `safeUpdateSessionStatus` to fail and mark persistence degraded.

However, `backend/src/data/repositories/sessionRepository.js` (line 71) already implements automatic fallback to `process.env.DEFAULT_COMPANY_ID || 'default'` and creates the row on conflict if it doesn't exist.

### Remedy
In `persistence.js`:
```javascript
async function safeUpdateSessionStatus(sessionId, status, phone, sessionName, whatsappName = null) {
  try {
    const { query } = require('../../../src/infrastructure/config/database');
    const existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
    const companyId = existing.rows[0]?.company_id || process.env.DEFAULT_COMPANY_ID || 'default';
    await sessionRepository.updateSessionStatus(
      sessionId,
      status,
      phone,
      companyId,
      sessionName,
      whatsappName
    );
    markPersistenceSuccess('update_session_status');
  } catch (error) {
    markPersistenceFailure(sessionId, 'update_session_status', error);
  }
}
```

---

## 6. Concrete File Modifications for Implementation Worker

### File 1: `backend/services/whatsapp/connection/reconnect.js`
- **Line 52–59**: Enhance `getConnectionCloseCode(lastDisconnect)` to robustly extract code from `output?.statusCode`, `data?.statusCode`, `output?.payload?.statusCode`, `statusCode`, `code`, and return a finite integer or `null`.
- **Line 84–89**: Export `DisconnectReason`, `TERMINAL_DISCONNECT_CODES`, `TRANSIENT_DISCONNECT_CODES`, alongside `computeReconnectBackoff`.
- **Add**: Pure function `computeReconnectBackoff(attempt, closeCode, options = {})`:
  ```javascript
  function computeReconnectBackoff(attempt, closeCode = null, options = {}) {
    if (closeCode === DisconnectReason.restartRequired || closeCode === 515) {
      return options.immediateDelayMs ?? 500;
    }
    const safeAttempt = Math.max(1, Number(attempt) || 1);
    const baseMs = Math.max(500, Number(options.baseMs || 5000));
    const maxMs = Math.max(baseMs, Number(options.maxMs || 60000));
    const expDelay = Math.min(baseMs * Math.pow(2, safeAttempt - 1), maxMs);
    const jitterMax = Math.min(1000, Math.floor(expDelay * 0.2));
    const jitter = Math.floor(Math.random() * (jitterMax + 1));
    return Math.min(expDelay + jitter, maxMs);
  }
  ```

### File 2: `backend/services/whatsapp/connection/stableSession.js`
- **Line 109**: Replace `MAX_RECONNECT_REQUESTS = 1000` with `Number(process.env.WHATSAPP_MAX_RECONNECT_REQUESTS || 25)`.
- **Lines 1585, 1608**: Store catalog and blocklist sync timers on `session` (`session.catalogSyncTimer`, `session.blocklistSyncTimer`).
- **Line 1701–1703**: Fix `isBanned` defect:
  ```javascript
  if (closeCode === 401) {
    session.isLoggedOut = true;
    session.isBanned = false;
  } else if (closeCode === 403) {
    session.isBanned = true;
  }
  ```
- **Lines 1673–1689**: Clean up `session.bufferFlushInterval`, `session.catalogSyncTimer`, `session.blocklistSyncTimer`.
- **Lines 1844–1870**: On terminal disconnect (including 401):
  - Cleanly teardown socket and listeners: `sock?.ev?.removeAllListeners()`, `sock?.ws?.removeAllListeners()`, `sock?.end(undefined)`, `sock?.ws?.close()`.
  - For 401, remove canonical session folder: `await fs.rm(sessionPath, { force: true, recursive: true })`.
  - Notify `sessionManager`:
    ```javascript
    try {
      const sessionManager = require('../../sessionManager');
      await sessionManager.disposeSession(normalizedSessionName, {
        deleteFolder: closeCode === 401,
        logout: false,
      });
    } catch (_) {}
    ```

### File 3: `backend/services/sessionManager.legacy.js`
- **Line 29**: Replace `const MAX_RECONNECT_ATTEMPTS = 1000;` with `const MAX_RECONNECT_ATTEMPTS = Math.max(1, Number(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || 25));`.
- **Line 175–236 (`closeSocket`)**: Enhance `closeSocket` to:
  - Clear `session.bufferFlushInterval`, `session.catalogSyncTimer`, `session.blocklistSyncTimer`.
  - Clean `session.sock?.ws?.removeAllListeners?.()`.
  - Null out `session.sock` after closure.
- **Lines 491–494**: Replace naive exponential backoff with `computeReconnectBackoff(attempt, closeCode)` from `reconnect.js` (including fast 500ms delay for 515 and randomized jitter).

### File 4: `backend/services/whatsapp/connection/persistence.js`
- **Lines 63–80**: Fix `safeUpdateSessionStatus` so missing `company_id` defaults to `process.env.DEFAULT_COMPANY_ID || 'default'`, preventing unhandled rejections during auto-start or reconnects.

---

## 7. Verification Strategy & Test Implementation

### Test Suite: `backend/tests/reconnectStateMachine.test.js`
Create a dedicated `node:test` suite verifying:
1. `getConnectionCloseCode`:
   - Correctly parses Boom `output.statusCode`, `data.statusCode`, and raw integer/string codes.
2. `shouldReconnect`:
   - Returns `false` for 401 (`loggedOut`), 403 (`forbidden`), 411 (`multideviceMismatch`), 440 (`connectionReplaced`).
   - Returns `true` for 515 (`restartRequired`), 428 (`connectionClosed`), 408 (`timedOut`), 500 (`badSession`), 503 (`unavailableService`), and unknown network errors (`null`).
3. `computeReconnectBackoff`:
   - Code 515 returns immediate delay ≤ 500ms regardless of attempt number.
   - Transient codes produce exponential backoff (e.g. ~5s for attempt 1, ~10s for attempt 2, capped at 60s).
   - Jitter is strictly within expected bounds `[0..1000ms]`.
4. Socket Teardown:
   - Verifies `closeSocket` removes all listeners from mock `sock.ev` and mock `sock.ws`, terminates timers, and sets `session.isClosing = false`.
5. 401 Logout Lifecycle:
   - Verifies that 401 disconnect deletes session directory, marks `isLoggedOut = true` and `isBanned = false`, and prevents auto-reconnection.

### Verification Execution Command
```powershell
node --test backend/tests/reconnectStateMachine.test.js
```
Expected output: 100% green tests with 0 failures.
