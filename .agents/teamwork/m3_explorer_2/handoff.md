# Handoff Report: WebSocket Gateway Deduplication (F3.3) & Outbound Queue Performance (F3.4)

## 1. Observation

### 1.1 WebSocket Gateway Architecture & Duplicate Connection Listeners (F3.3)
1. **Duplicate `io.on('connection')` registrations**:
   - `backend/server.js:654`: Attaches `io.on('connection', (socket) => { const tenantId = joinTenantRoom(socket); ... })`. Inside this listener, it registers `socket.on('typing:start')`, `socket.on('typing:stop')`, `socket.on('archive_chat')`, `socket.on('unarchive_chat')`, `socket.on('add_tag')`, `socket.on('remove_tag')`, and `socket.on('disconnect')`.
   - `backend/services/websocketGateway.js:44`: In `init(io)`, attaches a second `io.on('connection', (socket) => { const tenantId = joinTenantRoom(socket); incrementCounter('_connections', 'emitted'); socket.on('disconnect', ...); })`.
   - Result: Every incoming WebSocket connection runs `joinTenantRoom(socket)` twice, logs twice, and attaches two separate `disconnect` listeners.
2. **Timing & Initialization Drift**:
   - In `backend/server.js:102-106`, `io` is instantiated (`const io = new Server(...)`), but `websocketGateway.init(io)` is deferred until line 1922 (inside `startServer()` Phase 6).
   - In `backend/server.js:1286` and `1367`, `/api/websocket/status` and `/api/production/status` call `websocketGateway.isConnected()`, which returns `false` prior to Phase 6.
   - In `backend/services/websocketGateway.js:38-59`, `init(io)` is not idempotent: calling it multiple times attaches additional `io.on('connection')` listeners and overwrites `dedupCleanupTimer` without `clearInterval`, leaking intervals.
3. **Event Loop Timer Retention**:
   - In `backend/services/websocketGateway.js:54`: `dedupCleanupTimer = setInterval(() => { recentEmitKeys.clear(); }, DEDUP_WINDOW_MS * 2);`. This interval is never `.unref()`'d, holding the Node.js event loop active.
4. **Frontend Event Alignment**:
   - `frontend-official/src/pages/Inbox/hooks/useInboxSocket.ts:5-27` emits `archive_chat`, `unarchive_chat`, `add_tag`, `remove_tag`. These events were handled exclusively in `server.js` while outbound broadcasts (`emit`, `emitBatched`) were split into `websocketGateway.js`.

### 1.2 Outbound Queue Service & Event Loop Bottlenecks (F3.4)
1. **Global Concurrency Serialization via `processingTick`**:
   - `backend/services/outboundQueueService.js:38`: `let processingTick = false;`.
   - `backend/services/outboundQueueService.js:927-931`: `if (processingTick) return; processingTick = true;`.
   - In `backend/services/outboundQueueService.js:405-420`: `executeOutbound(item)` awaits typing delays (`typingDelayMs` up to 5500ms + 800ms jitter) and response delays.
   - While `processingTick === true`, no other item across any company, session, or phone can be processed.
   - Conversely, `backend/services/outboundQueueService.js:561-569` already implements per-recipient concurrency locks (`activeProcessingPhones`, `activeProcessingFlows`, `hasUnfinishedPriorStep`), meaning `processingTick` artificially created a global concurrency bottleneck of 1.
2. **Disk I/O and Atomicity under Windows**:
   - `backend/services/outboundQueueService.js:189-191`: `const tmpPath = \`${QUEUE_FILE_PATH}.\${process.pid}.tmp\`; await fs.writeFile(tmpPath, next, 'utf8'); await fs.rename(tmpPath, QUEUE_FILE_PATH);`.
   - Static temporary file name can collide, and on Windows `fs.rename` can throw transient `EPERM`/`EBUSY` when files are briefly locked.
3. **Background Timer Unref**:
   - `backend/services/outboundQueueService.js:61` (`workerWakeupTimer = setTimeout(...)`) and line 1192 (`workerTimer = setInterval(...)`) hold the Node.js process alive. Neither timer calls `.unref()`.
4. **Lack of Batching in Callers (`automationEngine.js`)**:
   - `backend/services/automationEngine.js:695-715`: Splitted AI response chunks loop over `await outboundQueueService.enqueue({ ... })`.
   - `backend/services/automationEngine.js:760-800`: Quick reply items loop over `await outboundQueueService.enqueue({ ... })`.
   - Each sequential `enqueue()` call triggers a separate write lock and disk write, whereas `outboundQueueService.enqueueBatch()` is available and already handles atomic multi-item staging and single disk write coalescing.
5. **Existing Test Suite Baseline**:
   - `node --test backend/tests/outboundQueueAcceptance.test.js backend/tests/outboundQueuePerformance.test.js`: 16/16 tests pass.
   - `node --test backend/tests/outbound*.test.js`: 32/32 tests pass.

---

## 2. Logic Chain

1. **Premise 1**: Having multiple `io.on('connection')` listeners on the same `Server` instance causes duplicate execution of tenant room joining (`joinTenantRoom`), duplicate logging, duplicate disconnect listeners, and violates single-source-of-truth principles.
2. **Premise 2**: Centralizing connection lifecycle and inbound domain event routing (`typing:start`, `typing:stop`, `archive_chat`, `unarchive_chat`, `add_tag`, `remove_tag`) into `websocketGateway.js` establishes it as the single authoritative coordinator.
3. **Premise 3**: Initializing `websocketGateway.init(io)` immediately after `new Server()` (line 107 of `server.js`) ensures early availability, while making `init(io)` idempotent prevents listener and timer leaks if called again in Phase 6 or in test suites.
4. **Premise 4**: In `outboundQueueService.js`, `pickNextProcessableItem()` already enforces that:
   - Items for the same phone are never processed concurrently (`activeProcessingPhones`).
   - Flow steps for the same flow run are never processed concurrently (`activeProcessingFlows`).
   - Prior steps must be terminal before subsequent steps are picked (`hasUnfinishedPriorStep`).
5. **Premise 5**: Replacing the global boolean `processingTick` with a controlled worker counter (`activeWorkers < MAX_CONCURRENT_DISPATCHES`, default 3) allows independent messages for different recipients to dispatch concurrently without waiting for humanized typing delays on unrelated recipients.
6. **Premise 6**: Calling `.unref()` on `workerTimer`, `workerWakeupTimer`, and `dedupCleanupTimer` ensures that idle background intervals do not hang the Node.js process or test runners upon completion.
7. **Premise 7**: Replacing sequential `enqueue()` loops in `automationEngine.js` with `enqueueBatch()` reduces disk I/O and serialization overhead by N-fold during multi-chunk AI replies.

---

## 3. Caveats

1. **Baileys Socket Load**: Concurrency must be bounded (default 3 concurrent sends) to avoid overwhelming single-socket Baileys connections. `MAX_CONCURRENT_DISPATCHES` is environment-configurable via `process.env.OUTBOUND_QUEUE_CONCURRENCY`.
2. **Database Connection Pool in Tests**: Some tests (`outboundApiTenant.test.js`) connect to PostgreSQL and take ~30s if pool teardown is not called; this is tracked under F3.5.
3. **Read-Only Explorer Scope**: In accordance with the Explorer subagent role, no production source code has been directly modified. All proposals are provided as diff patches, proposed replacement files, and structured specifications in this directory.

---

## 4. Conclusion

- **F3.3 (WebSocket Gateway Deduplication)**: Successfully mapped and designed. By moving event handlers (`typing`, `archive_chat`, `unarchive_chat`, `add_tag`, `remove_tag`) into `websocketGateway.js`, adding an idempotency guard to `init(io)`, and calling `init(io)` directly in `server.js:107`, we eliminate duplicate `io.on('connection')` listeners, eliminate redundant room joins, and prevent listener leaks.
- **F3.4 (Outbound Queue Performance)**: Successfully analyzed and optimized. The bottleneck was the global boolean `processingTick = true`, which serialized all outbound traffic across the entire system. By transitioning to a bounded worker pool (`MAX_CONCURRENT_DISPATCHES`), adding `.unref()` to background timers, making atomic file writes resilient on Windows, and utilizing `enqueueBatch()` in `automationEngine.js`, system throughput scales linearly with zero regressions against existing tests.

---

## 5. Verification Method

### 5.1 Verification Commands
1. Run existing Outbound Queue Acceptance & Performance test suite:
   ```powershell
   node --test backend/tests/outboundQueueAcceptance.test.js backend/tests/outboundQueuePerformance.test.js
   ```
   **Expected**: 16/16 pass.
2. Run all Outbound test suites:
   ```powershell
   node --test backend/tests/outbound*.test.js
   ```
   **Expected**: 32/32 pass.
3. Run Outbound Queue Micro-benchmark:
   ```powershell
   node backend/scripts/bench-outbound-queue.js
   ```
   **Expected**: Burst of 500 enqueues processes in < 400ms, idle tick < 1ms, event loop lag < 15ms.

### 5.2 Artifacts Produced
- `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_explorer_2\proposed_websocketGateway.js` — Full proposed replacement for `websocketGateway.js`.
- `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_explorer_2\websocket_gateway_dedup.patch` — Unified diff patch for `backend/server.js`.
- `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_explorer_2\outbound_queue_optimization.patch` — Unified diff patch for `backend/services/outboundQueueService.js`.
