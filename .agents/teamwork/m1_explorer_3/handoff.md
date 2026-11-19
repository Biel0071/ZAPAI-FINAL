# Handoff Report — Feature F1.3 (Reconnection State Machine, Error Code Handling & Teardown Cleanup)

**Author**: `m1_explorer_3` (Explorer Agent)  
**Recipient**: `m1_worker_3` / Orchestrator (`3265ab63-b153-484a-b6d7-740defe3b059`)  
**Target Milestone**: Milestone 1 (`m1_whatsapp_session_stability`)  
**Scope**: `backend/services/whatsapp/connection/reconnect.js`, `backend/services/whatsapp/connection/stableSession.js`, `backend/services/sessionManager.legacy.js`, `backend/services/whatsapp/connection/persistence.js`  

---

## 1. Observation

1. **Baileys Disconnect Reason Definition**:
   In `backend/node_modules/@whiskeysockets/baileys/lib/Types/index.js` (lines 14–25):
   ```javascript
   DisconnectReason["connectionClosed"] = 428;
   DisconnectReason["connectionLost"] = 408;
   DisconnectReason["connectionReplaced"] = 440;
   DisconnectReason["timedOut"] = 408;
   DisconnectReason["loggedOut"] = 401;
   DisconnectReason["badSession"] = 500;
   DisconnectReason["restartRequired"] = 515;
   DisconnectReason["multideviceMismatch"] = 411;
   DisconnectReason["forbidden"] = 403;
   DisconnectReason["unavailableService"] = 503;
   ```
2. **Pure Disconnect Logic & Unexported Constants**:
   In `backend/services/whatsapp/connection/reconnect.js` (lines 32–50, 84–88):
   - `TERMINAL_DISCONNECT_CODES`: Set of `[401, 440, 411, 403]`.
   - `TRANSIENT_DISCONNECT_CODES`: Set of `[515, 428, 408, 500, 503]`.
   - Lines 84–88 export only `{ getConnectionCloseCode, isTerminalDisconnect, shouldReconnect }`. Neither `DisconnectReason` nor the code sets are exported.
3. **False "Banned" Assignment on 401 Logout**:
   In `backend/services/whatsapp/connection/stableSession.js` (line 1701–1703):
   ```javascript
   if (closeCode === 401 || closeCode === 403) {
     session.isBanned = true;
   }
   ```
   When a user legitimately unlinks WhatsApp via their phone (401 loggedOut), `session.isBanned` is set to `true`. In `frontend-official/src/components/layout/Sidebar.tsx` (line 271) and `frontend-official/src/pages/Inbox/components/ChatListPanel.tsx` (line 546), `isBanned` renders an account ban alert to the user.
4. **Socket Leak on Terminal Disconnects**:
   In `backend/services/whatsapp/connection/stableSession.js` (lines 1844–1869):
   On terminal disconnects (`closeCode === 401`, `403`, etc.), `stableSession.js` runs:
   ```javascript
   delete activeSessions[normalizedSessionName];
   if (closeCode === 401) {
     await fs.rm(sessionPath, { force: true, recursive: true });
   }
   ```
   Neither `session.sock?.ev?.removeAllListeners?.()` nor `session.sock?.ws?.close?.()` nor `sessionManager.disposeSession` is invoked. The old socket listeners and WebSocket connection remain retained in memory, and `sessionManager.legacy.js`'s `sessions` Map retains the orphaned session object.
5. **Dual Backoff & Reconnect Count Desynchronization**:
   - `stableSession.js` (line 1719): Sets `cooldownMs = computeReconnectDelay(session.reconnectRequestCount) + 5000` (`computeReconnectDelay` uses `[5s, 15s, 30s, 60s, 120s]`).
   - `sessionManager.legacy.js` (line 492): Schedules its own exponential backoff: `Math.min(5000 * Math.pow(2, attempt - 1), 60000)`.
   - When `sessionManager`'s timer fires (line 513), it calls `disposeSession` and `startSession`. In `createStableSession`, a new session object is created where `session.reconnectRequestCount` resets to 0.
6. **Handshake Delay on Code 515 (`restartRequired`)**:
   In `sessionManager.legacy.js` (line 492), code 515 is treated identically to network drops, forcing a 5000ms delay. In Baileys, code 515 is standard post-handshake stream sync and requires immediate reconnection (≤ 500ms).
7. **Zero Jitter and Excessive 1000-Attempt Ceiling**:
   In `sessionManager.legacy.js` (line 29, 492) and `stableSession.js` (line 109), `MAX_RECONNECT_ATTEMPTS = 1000`. The backoff formula `5000 * 2^(attempt - 1)` has zero random jitter.
8. **Incomplete Cleanup in `closeSocket` (`sessionManager.legacy.js`)**:
   Lines 175–236 do not clear `session.bufferFlushInterval` (created on line 1553 of `stableSession.js`), `session.catalogSyncTimer`, `session.blocklistSyncTimer`, or `session.sock?.ws?.removeAllListeners?.()`.
9. **`Session owner is missing.` Failure in `persistence.js`**:
   In `backend/services/whatsapp/connection/persistence.js` (line 67):
   ```javascript
   const existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
   if (!existing.rows[0]?.company_id) throw new Error('Session owner is missing.');
   ```
   If a session does not have an existing DB record with `company_id`, updates fail silently and mark persistence degraded.
10. **Test Coverage**:
    Running `node --test backend/tests/sessionRecoveryService.test.js` passes in 143ms, but there are zero automated tests covering `reconnect.js` or the reconnection state machine.

---

## 2. Logic Chain

1. **Terminal vs. Transient Classification (Observations 1, 2, 3)**:
   - Observation 1 and 2 establish that 401 (`loggedOut`), 403 (`forbidden`), 411 (`multideviceMismatch`), and 440 (`connectionReplaced`) are terminal codes where credentials cannot reconnect automatically.
   - For 401 specifically, WhatsApp credentials have been invalidated by the WhatsApp server/phone. Auto-reconnecting with invalidated credentials causes repeated connection rejections. Therefore, deleting `<root>/data/sessions/<sessionId>`, setting status to `'disconnected'`, clearing credentials, and halting reconnection is the only correct behavior.
   - Observation 3 proves that setting `session.isBanned = true` on 401 is an erroneous conflation of logout with account bans. Separating `isLoggedOut = true` from `isBanned = true` (403 only) ensures accurate UI feedback.
2. **Elimination of Socket and Memory Leaks (Observations 4, 8)**:
   - When a connection terminates (either permanently or before reconnecting), retaining listeners on `sock.ev` and WebSocket connections retains the full closure scope (`session`, `store`, buffers).
   - Augmenting `closeSocket` and calling `teardownSessionSocket` on all terminal disconnects guarantees that `sock.ev.removeAllListeners()`, `sock.ws.removeAllListeners()`, `sock.end(undefined)`, `sock.ws.close()`, and all interval/timeout timers (`bufferFlushInterval`, `catalogSyncTimer`, `blocklistSyncTimer`) are cleared.
3. **Single Authoritative Backoff Scheduler (Observations 5, 6, 7)**:
   - Dual timers across `stableSession.js` and `sessionManager.legacy.js` create overlapping cooldown windows and desynchronized attempt counters.
   - Centralizing the backoff formula into a pure function `computeReconnectBackoff` in `reconnect.js` and letting `sessionManager.legacy.js` be the sole timer owner resolves this race condition.
   - Providing an immediate delay (500ms) for code 515 eliminates the 5-second handshake freeze.
   - Introducing randomized jitter `[0..1000ms]` disperses reconnect spikes, and capping `MAX_RECONNECT_ATTEMPTS` at 25 prevents infinite 16-hour retry loops.
4. **Persistence Resilience (Observation 9)**:
   - `sessionRepository.updateSessionStatus` already supports auto-upserting records defaulting to `process.env.DEFAULT_COMPANY_ID || 'default'`. Passing this fallback in `safeUpdateSessionStatus` prevents status update dropouts.

---

## 3. Caveats

- **Network-Level Disconnect Simulation**: In unit tests, WebSocket connections and Baileys Boom errors can be simulated with high fidelity using mock error objects; real physical network disconnections (e.g. WiFi interface drops) rely on Baileys translating those to 408/428 errors.
- **Canonical Session Path Dependency**: This feature assumes Milestone 1 Feature F1.1 unifies the session path to `<root>/data/sessions`. If F1.1 is implemented in parallel or sequentially, the path in `deleteSessionFolder` must point to `<root>/data/sessions`.

---

## 4. Conclusion

Feature F1.3 requires four targeted file modifications:
1. `backend/services/whatsapp/connection/reconnect.js`: Export `DisconnectReason`, `TERMINAL_DISCONNECT_CODES`, `TRANSIENT_DISCONNECT_CODES`; enhance `getConnectionCloseCode`; add pure `computeReconnectBackoff(attempt, closeCode, options)` with 515 immediate handling and randomized jitter.
2. `backend/services/whatsapp/connection/stableSession.js`: Fix `isBanned` on 401; invoke full socket teardown and notify `sessionManager` on terminal disconnects; clean all timers (including `bufferFlushInterval` and post-connection sync timers).
3. `backend/services/sessionManager.legacy.js`: Use `computeReconnectBackoff` in `onReconnectRequested`; cap `MAX_RECONNECT_ATTEMPTS` at 25; enhance `closeSocket` with complete listener, timer, and WebSocket cleanup.
4. `backend/services/whatsapp/connection/persistence.js`: Provide default company fallback in `safeUpdateSessionStatus`.

Create a comprehensive automated test suite in `backend/tests/reconnectStateMachine.test.js` to ensure 100% test coverage and prevent future regressions.

---

## 5. Verification Method

### Test Suite Execution
Execute the new test suite via native Node.js test runner:
```powershell
node --test backend/tests/reconnectStateMachine.test.js
```

### Existing Backend Regression Suite
```powershell
node --test backend/tests/sessionRecoveryService.test.js
```

### Invalidation Conditions
- A 401 disconnect triggers an auto-reconnect attempt.
- A 401 disconnect sets `session.isBanned = true`.
- A 515 disconnect waits ≥ 5000ms instead of ≤ 500ms.
- Any Baileys socket listeners or interval timers remain active after `disposeSession` or 401 logout.
- Reconnection attempts exceed 25 retries without transitioning to `status: 'error'`.
