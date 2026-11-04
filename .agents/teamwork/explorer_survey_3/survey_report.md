# Technical Survey Report — Requirement R3, System Architecture, Performance, and Test Infrastructure

**Agent**: `explorer_survey_3`  
**Date**: 2026-11-04  
**Scope**: Requirement R3 (Performance Optimization, Production Polish, and Test Infrastructure), Overall Project Layout, Build/Lint/Test Suites, Bottlenecks, and Module Boundaries.  
**Authoritative Request Reference**: `.agents/teamwork/ORIGINAL_REQUEST.md`

---

## Executive Summary

The ZAPFLOW platform (ZapAI CRM) is an enterprise full-stack WhatsApp automation, CRM, and AI agent platform comprised of an Express/Node.js backend, a Vite/React/TypeScript official frontend (`frontend-official`), and a PostgreSQL persistent store with Baileys WhatsApp multi-device integration.

This investigation evaluated the repository's architecture, existing automated test suites, build/lint/typecheck pipelines, performance bottlenecks, and user-facing workflows across 6 specific dimensions.

### Core Discoveries at a Glance:
1. **Frontend Tests Baseline**: Vitest runs 49 test files with 291 unit tests. Currently, **44 test files pass (281 tests green)** and **5 test files fail (10 failing tests)** due to recent UI component refactoring (e.g. `ChatHeaderBar` extraction and search cancellation).
2. **Frontend Build Health**: `npm run build` succeeds cleanly in ~55s (`dist/assets/index-DmwV8O2i.js`), but produces heavy monolithic chunks (`vendor-icons`: 577 KB, `Inbox`: 471 KB).
3. **Frontend Typecheck & Lint**: `npm run tsc` fails only on test files in `src/test/` because `tsconfig.app.json` includes `src` indiscriminately. `npm run lint` yields 1,155 ESLint warnings/errors due to strict `@typescript-eslint/no-explicit-any` across test suites and specs.
4. **Backend Test Infrastructure**: Backend contains **85 test files** using Node.js's native test runner (`node --test`), but lacks an `npm test` script entry in `backend/package.json`. Tests pass when executed individually, but open database pool handles keep the event loop alive, requiring `setTimeout(() => process.exit(0), 100)` workarounds.
5. **Critical Session Storage Path Discrepancy**: Baileys writes session credentials into `data/sessions/`, while `sessionManager.legacy.js` and `connectionService.legacy.js` read and clean up `backend/sessions/`. This causes phantom session states, broken cleanups, and QA healthcheck false negatives.
6. **Violations of Requirement R2 (Silent Background Sync)**: In `Connections.tsx` (lines 253-264), an automatic `useEffect` listener forcefully pops up the `HistoryBootstrapPanel` modal whenever a session status transitions to `connected`. Additionally, manual sync buttons exist in `WebBridgeCard.tsx`, `AgentTab.tsx`, and `Memory.tsx`.
7. **WebSocket & Queue Performance Bottlenecks**: Duplicate `io.on('connection')` listeners exist in `server.js` and `websocketGateway.js`, resulting in duplicate event bindings and triple-redundant socket emissions. The outbound queue executes disk writes (`fs.writeFile` + `fs.rename`) and synchronous SQL checks on every tick.

---

## 1. Project Structure & Runtime Architecture

### 1.1 Repository Structure
```
c:\projetos\ZAPAI-FINAL\
├── backend/                  # Node.js + Express backend (CommonJS)
│   ├── server.js             # Main server bootstrap (2146 lines, 77 KB)
│   ├── migrations/           # PostgreSQL migration files (001 - 042)
│   ├── services/             # Core business services (WhatsApp, AI, Queues)
│   │   ├── whatsapp/         # Baileys engine (chat, connection, inbound, outbound, realtime)
│   │   ├── sessionManager.legacy.js # WhatsApp session lifecycle manager
│   │   ├── outboundQueueService.js  # Message outbound queuing engine
│   │   └── websocketGateway.js      # Socket.IO gateway
│   ├── src/                  # Controllers, repositories, middleware
│   │   ├── api/controllers/  # Express route controllers
│   │   ├── api/routes/       # Express route definitions
│   │   ├── data/repositories/# PostgreSQL data access repositories
│   │   └── infrastructure/   # Database pools, business hours, storage
│   ├── tests/                # 85 Node.js native test files
│   └── package.json          # Express, Baileys 6.7.23, pg 8.20.0, socket.io 4.8.3
├── frontend-official/        # React 18 + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/       # Radix UI, layout, evolution, connections
│   │   ├── core/             # Adapters, runtime, API client, socket manager
│   │   ├── pages/            # Page components (Inbox, Dashboard, Connections, AI, etc.)
│   │   ├── state/            # Zustand stores (`appStore`) and `RuntimeProvider`
│   │   └── test/             # 49 Vitest unit and integration test files
│   ├── tests/                # Playwright E2E and chaos test specs
│   │   └── ui/               # 9 Playwright spec files
│   ├── playwright.config.ts  # Playwright test config (Chromium, port 8080)
│   ├── vitest.config.ts      # Vitest test config (jsdom)
│   ├── vite.config.ts        # Vite configuration (port 8080, reverse proxy to 4025)
│   └── package.json          # React 18.3, Vite 5.4, Tailwind 3.4, Zustand 5.0
├── data/                     # Persistent local storage
│   ├── json_db/              # JSON state (outbound_queue.json, etc.)
│   ├── logs/                 # Local process logs
│   └── sessions/             # Baileys WhatsApp credentials storage
├── scripts/                  # Operational runtime and QA orchestration
│   ├── runtime-start.mjs     # Production runtime starter
│   ├── runtime-stop.mjs      # Process cleanup
│   ├── runtime-clean.mjs     # Artifact cleanup
│   └── qa/run-qa.js          # Full automated QA orchestrator
└── package.json              # Monorepo root scripts
```

### 1.2 Runtime Component Diagram

```
       ┌────────────────────────────────────────────────────────┐
       │                   Client Browser                       │
       │     (http://localhost:8080 - Vite / Nginx Proxy)       │
       └────────────────────────┬───────────────────────────────┘
                                │
               HTTP Requests    │    WebSocket (Socket.IO)
               /api, /auth, etc.│    ws://localhost:4025
                                ▼
       ┌────────────────────────────────────────────────────────┐
       │                Express Backend (Port 4025)             │
       │   - `server.js` + `src/api/routes/index.js`            │
       │   - Middleware: JWT, RateLimiter, TenantContext        │
       │   - WebSocket Gateway: `websocketGateway.js`           │
       └───────────┬──────────────────────────────┬─────────────┘
                   │                              │
         SQL Queries (pg pool)             Baileys Multi-Device Socket
                   │                              │
                   ▼                              ▼
       ┌────────────────────────┐      ┌────────────────────────┐
       │   PostgreSQL Database  │      │ WhatsApp Network (WA)  │
       │   (zapai_crm on :5432) │      │ Creds: `data/sessions` │
       └────────────────────────┘      └────────────────────────┘
```

---

## 2. Automated Test Infrastructure & Baseline Health

### 2.1 Test Suite Inventory & Commands

| Suite | Runner / Engine | Scope | Execution Command |
|---|---|---|---|
| **Frontend Unit & Component** | Vitest 3.2.4 + JSDOM | 49 test files in `frontend-official/src/test/` | `cd frontend-official && npm test` |
| **Frontend E2E & Visual** | Playwright 1.58.2 | 9 spec files in `frontend-official/tests/ui/` | `cd frontend-official && npx playwright test` |
| **Frontend Fast Chaos** | Playwright | Chaos UI stress testing | `cd frontend-official && npm run test:chaos` |
| **Backend Integration & Unit** | Node.js native `node:test` | 85 test files in `backend/tests/` | `node --test backend/tests/<file>.test.js` |
| **Monorepo System QA** | Node.js runner (`run-qa.js`) | Healthcheck + build + Vitest + crawler | `npm run qa` |

### 2.2 Empirical Baseline Health Results

#### A. Frontend Unit Tests (Vitest)
Execution: `cd frontend-official && npm test`
- **Total Test Files**: 49
- **Total Tests**: 291
- **Passed**: 44 files, 281 tests
- **Failed**: 5 files, 10 tests
- **Duration**: ~108s

**Detailed Failure Breakdown**:
1. `src/test/activeChatSheet.test.tsx` (5 failed tests):
   - *Failure*: `document.querySelector('button[aria-label="Gerar Ficha"]')` returns null; missing text `O WhatsApp só permite buscar mensagens anteriores...`.
   - *Root Cause*: `ActiveChatPane.tsx` had its header extracted into `ChatHeaderBar.tsx` and buttons reorganized. The test queries obsolete DOM selectors.
2. `src/test/inboxReconstruction.test.tsx` (2 failed tests):
   - *Failure*: Expected toolbar buttons `Buscar na conversa`, `Gerar Ficha`, `Transferir atendimento`, `Finalizar atendimento`.
   - *Root Cause*: Action buttons moved into sub-menus or popovers (`AttachmentActionMenu`, `OrderSheetModal`).
3. `src/test/conversationSearch.test.tsx` (1 failed test):
   - *Failure*: `ignores delayed responses from previous terms or sessions`. Expected `onResults` called 1 time, got 2 times.
   - *Root Cause*: Lack of active session change cancellation token in `useConversationSearch` hook.
4. `src/test/historyBootstrap.test.tsx` (1 failed test):
   - *Failure*: Expected button `Revisar e ativar atendente` to become enabled after filling fields.
   - *Root Cause*: Form validation constraints in `HistoryBootstrapPanel.tsx` require additional state before enabling the button.
5. `src/test/runtimeProviderRealtimeMessage.test.tsx` (1 failed test):
   - *Failure*: `AssertionError: expected "spy" to be called 1 times, but got 2 times` on `mocks.getConversations`.
   - *Root Cause*: In `RuntimeProvider.tsx` line 762, `onNewMessage` triggers `debouncedRefreshConversations` because the incoming session ID resolution triggers an unsolicited re-fetch.

#### B. Backend Node.js Tests
Execution: `node --test backend/tests/orderSheetAndAttendantQuality.test.js`
- **Result**: 9/9 passed in 2.3s.
Execution: `node --test backend/tests/whatsappCatalogAutoSync.test.js backend/tests/messageAckPipeline.test.js`
- **Result**: 5/5 passed in 30.9s.
- **Architectural Flaw**:
  Backend test files lack an automatic pool shutdown hook. Tests leave open pg pool connections or background timers alive, necessitating workarounds like `setTimeout(() => process.exit(0), 100)` at the end of test files. When running multiple test files in a batch, calling `process.exit(0)` inside one file aborts the remaining suite prematurely.

---

## 3. Build, Lint, and Typecheck Analysis

### 3.1 Build Command (`frontend-official`)
- **Command**: `npm run build` (`node --max-old-space-size=4096 ./node_modules/vite/bin/vite.js build`)
- **Status**: **PASS (0 compilation errors)**
- **Duration**: ~55.87s
- **Bundle Chunk Sizes**:
  - `dist/assets/vendor-icons-DD2J4AA5.js`: 577.08 kB
  - `dist/assets/Inbox-COuVlFBm.js`: 471.55 kB
  - `dist/assets/native-B5Vb9Oiz.js`: 380.35 kB
  - `dist/assets/AreaChart-DqZtbExP.js`: 378.53 kB
  - `dist/assets/Dashboard-0-wh4eYN.js`: 250.28 kB
  - `dist/assets/Memory-DABbGMPB.js`: 231.23 kB
  - `dist/assets/index-DmwV8O2i.js`: 231.86 kB
- **Assessment**: The production build compiles cleanly. However, `Inbox` and `vendor-icons` are disproportionately large, causing initial page load and route-switching latency.

### 3.2 TypeScript Typecheck (`frontend-official`)
- **Command**: `npm run tsc` (`tsc --noEmit -p tsconfig.app.json`)
- **Status**: **FAIL (Exit code 1)**
- **Errors**: ~10 TypeScript errors, **all located exclusively in `src/test/` test files**:
  - `src/test/attendantsComprehensiveSimulation.test.tsx`: missing property `agentsList` on `AgentTabProps`.
  - `src/test/inboxCatalogPopover.test.tsx`: property `sender` does not exist on `ChatMessage`.
  - `src/test/inboxCircuitBreakerFlashingRed.test.tsx`: property `data` does not exist on `ConversationRowData`.
  - `src/test/inboxOrderCard.test.tsx`: type `"order"` not assignable to media type enum.
- **Assessment**: Production source code in `src/` (outside `src/test/`) has zero type errors. The issue is that `tsconfig.app.json` includes `"include": ["src"]`, inadvertently typechecking mock-heavy test files against strict production contracts.

### 3.3 ESLint (`frontend-official`)
- **Command**: `npm run lint` (`eslint .`)
- **Status**: **FAIL (1155 problems: 982 errors, 173 warnings)**
- **Errors**: Dominated by `@typescript-eslint/no-explicit-any` across tests and UI views.
- **Assessment**: `eslint.config.js` applies `tseslint.configs.recommended` globally without a test-file override, preventing CI gate usage without `--quiet` or rule suppression.

---

## 4. Performance Bottlenecks & Critical Path Flaws

### 4.1 Bottleneck 1: Session Path Discrepancy & State Divergence
- **File 1**: `backend/services/whatsapp/connection/stableSession.js` (Line 99)
  ```javascript
  const SESSIONS_DIRECTORY = path.join(__dirname, '..', '..', '..', '..', 'data', 'sessions');
  // Resolves to: c:\projetos\ZAPAI-FINAL\data\sessions
  ```
- **File 2**: `backend/services/sessionManager.legacy.js` (Line 20)
  ```javascript
  const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');
  // Resolves to: c:\projetos\ZAPAI-FINAL\backend\sessions
  ```
- **File 3**: `backend/services/connectionService.legacy.js` (Line 432)
  ```javascript
  const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');
  // Resolves to: c:\projetos\ZAPAI-FINAL\backend\sessions
  ```
- **File 4**: `scripts/qa/run-qa.js` (Line 140)
  ```javascript
  const sessionsDir = path.join(root, "backend/sessions");
  ```
- **Impact**:
  1. Baileys stores active authentication keys and credentials under `data/sessions/main/`.
  2. The `sessionManager` and `connectionService` inspect `backend/sessions/`, which is completely empty.
  3. Reconnection checks, session counts, and QA healthcheck scripts report that zero sessions exist on disk (`_Nenhuma sessão de WhatsApp criada no disco ainda._`).
  4. Deleting or recycling a session fails to purge real credentials from `data/sessions/`, leading to persistent ghost sessions and authentication desynchronization.

### 4.2 Bottleneck 2: Duplicate WebSocket Handlers & Event Flooding
- **Location 1**: `backend/server.js` (Line 654)
  `io.on('connection', (socket) => { ... })` attaches handlers for `typing:start`, `typing:stop`, `archive_chat`, `unarchive_chat`, `add_tag`, `remove_tag`.
- **Location 2**: `backend/services/websocketGateway.js` (Line 44)
  `io.on('connection', (socket) => { ... })` also binds `joinTenantRoom(socket)` and tracks connections.
- **Redundant Event Emission**:
  When archiving a chat in `server.js` (lines 728-732):
  ```javascript
  io.emit('chat_archived', eventPayload);
  io.emit('conversation:update', { ...conv, status: 'archived' });
  io.emit('conversation_updated', { ...conv, status: 'archived' });
  ```
  Three separate events are fired for a single action, causing multiple re-renders across all active client browsers.

### 4.3 Bottleneck 3: Outbound Queue Disk I/O & Synchronous SQL Starvation
- **Location**: `backend/services/outboundQueueService.js` (Lines 184-206)
  Every state transition of every outbound message executes an atomic write (`fs.writeFile` to tmp followed by `fs.rename` to `data/json_db/outbound_queue.json`).
- **Location**: `backend/services/outboundQueueService.js` (Line 211)
  On every dequeue tick, the worker executes:
  ```javascript
  SELECT session_id FROM sessions WHERE company_id = $1 AND session_id = $2 LIMIT 1
  ```
  Under a campaign dispatch burst (e.g. 500 messages), this produces 500 disk write serializations and 500 synchronous database round-trips for the same session metadata.

### 4.4 Bottleneck 4: Redundant API Polling & Hydration Floods
- **Location**: `frontend-official/src/state/providers/RuntimeProvider.tsx` (Lines 352-370, 760-763)
  When an incoming message arrives for a conversation that is not yet present in the store's in-memory array, line 762 calls `debouncedRefreshConversations()`, triggering an HTTP GET request to `/api/conversations?limit=100`.
  In active WhatsApp groups or high-traffic inboxes, incoming message bursts trigger continuous cascading HTTP calls that stall the browser event loop.

---

## 5. WhatsApp Session Management Actions & UI Lag/Freezing

### 5.1 Violation of Requirement R2: Intrusive Auto-Opening Modals
In `frontend-official/src/pages/Connections.tsx` (Lines 253-264):
```tsx
// Auto-open modal when connection connects
useEffect(() => {
  safeSessions.forEach((s) => {
    const prev = prevSessionStatusesRef.current[s.id];
    if (prev && (prev === "connecting" || prev === "qr") && s.status === "connected") {
      handleOpenHistoryModal(s.id, 'history');
      setIsActivationDialogOpen(false);
      setShowQRModal(false);
    }
    prevSessionStatusesRef.current[s.id] = s.status;
  });
}, [safeSessions, handleOpenHistoryModal]);
```
- **Direct Conflict**: Requirement R2 explicitly commands:
  *"Remove all sync buttons, modals, and manual sync prompts from the user interface. When an instance connects, automatically synchronize real data in the background... without blocking user interaction."*
- **Problem**: As soon as a WhatsApp instance connects, the UI forcibly opens `HistoryBootstrapPanel` (`handleOpenHistoryModal(s.id, 'history')`), popping up an onboarding overlay in front of the user.

### 5.2 Manual Sync Prompts in the Interface
Manual sync buttons and overlays remain scattered in several user-facing views:
1. `WebBridgeCard.tsx` (Lines 389, 472): "Sincronizar Catálogo Agora" button and companion popup modal.
2. `AgentTab.tsx` (Line 1537): "Sincronizar (Sync)" button with sync status toasts.
3. `AttendantsPage.tsx` (Line 900): Manual attendance mining triggers.
4. `Memory.tsx` (Line 472): "Sincronizar no PostgreSQL" button.
5. `HistoryBootstrapPanel.tsx` (Line 508): "Sincronizar dados das conversas" button.

### 5.3 Monolithic Component Size & UI Freezing
The core communication views suffer from UI lag and frame drops during message reception due to massive component files:
- `ActiveChatPane.tsx`: 2429 lines (115 KB)
- `SidebarPanel.tsx`: 103 KB
- `Connections.tsx`: 1486 lines (74 KB)
- `Inbox.tsx`: 1366 lines (71 KB)
- `utils.tsx`: 64 KB

When large conversation lists (>100 active chats) update, re-rendering un-memoized components blocks the React rendering pipeline.

---

## 6. Recommended Code Layout & Module Decomposition

To establish clear architectural boundaries for production polish and satisfy `PROJECT.md` standards, the following layout and layer decomposition is recommended:

### 6.1 Target Directory Layout (`PROJECT.md`)
```
c:\projetos\ZAPAI-FINAL\
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── controllers/      # Thin HTTP request handlers
│   │   │   ├── middleware/       # Auth, rate-limiting, error envelope
│   │   │   └── routes/           # Domain router definitions
│   │   ├── domain/               # Pure business domain entities & logic
│   │   │   ├── session/          # WhatsApp session rules & connection states
│   │   │   ├── commerce/         # Catalog, orders, quotes, billing
│   │   │   └── messaging/        # Message ordering, deduplication, ACK
│   │   ├── infrastructure/       # External service adapters
│   │   │   ├── database/         # PG pool, migration runner, transaction helper
│   │   │   ├── queues/           # BullMQ / In-memory queue with batching
│   │   │   └── websocket/        # Socket.IO emitter & room manager
│   │   └── services/             # Orchestration services
│   │       ├── sessionManager.js # Canonical session manager (single path: data/sessions)
│   │       ├── backgroundSync.js # Silent background sync worker (catalog, orders, billing)
│   │       └── outboundQueue.js  # Batch-flushed outbound message sender
│   └── tests/
│       ├── unit/                 # Pure unit tests (isolated mocks)
│       └── integration/          # DB/Socket integration tests with teardown
├── frontend-official/
│   ├── src/
│   │   ├── components/           # Reusable UI primitives (Radix UI)
│   │   ├── core/
│   │   │   ├── api/              # Strongly typed API client functions
│   │   │   ├── runtime/          # Socket.IO client & heartbeat manager
│   │   │   └── utils/            # Pure helpers (formatters, date, sanitization)
│   │   ├── features/             # Feature-sliced modular domains
│   │   │   ├── inbox/            # Chat list, active chat, message bubbles, composer
│   │   │   ├── connections/      # Connection cards, QR display, status pill
│   │   │   ├── commerce/         # Catalog view, orders drawer, quotes
│   │   │   └── ai-attendants/    # Agent config, memory graph, evolution
│   │   ├── state/                # Zustand domain stores with atomic slices
│   │   └── test/                 # Vitest component & store tests
│   └── tests/                    # Playwright E2E specs
```

### 6.2 Key Decomposition Principles
1. **Unified Session Storage**: Eliminate the discrepancy between `data/sessions` and `backend/sessions`. Set `data/sessions` as the single canonical path via environment configuration (`SESSIONS_DIR`).
2. **Dedicated Silent Background Sync Worker**:
   - Extract all catalog, order, and billing fetching from UI buttons into a backend service: `backend/services/backgroundSyncService.js`.
   - On Baileys `connection.update` (`status === 'open'`), automatically trigger `backgroundSyncService.syncAll(sessionId)` asynchronously.
   - Emit progress and completion silently via Socket.IO (`catalog:synced`, `orders:synced`).
3. **UI Sync Cleanliness**:
   - Remove lines 253-264 in `Connections.tsx` to stop auto-opening modals on connect.
   - Remove manual sync buttons from `WebBridgeCard.tsx`, `AgentTab.tsx`, and `Memory.tsx`.
4. **Test Infrastructure Normalization**:
   - Add `"test": "node --test tests/**/*.test.js"` to `backend/package.json`.
   - Implement global teardown (`pool.end()`) in backend tests to eliminate `process.exit(0)` workarounds.
   - Update `tsconfig.app.json` to exclude `src/test` from the production compile pass, or create a dedicated `tsconfig.test.json` for Vitest.
   - Fix outdated DOM selectors in the 5 failing Vitest tests (`activeChatSheet.test.tsx`, `inboxReconstruction.test.tsx`, `conversationSearch.test.tsx`, `historyBootstrap.test.tsx`, `runtimeProviderRealtimeMessage.test.tsx`).

---

## Conclusion & Next Steps

The system contains robust architectural engines, high-performing native Baileys handling, and complete business workflows. However, production readiness is hindered by:
1. Divergent session directory configurations between `sessionManager` and `stableSession`.
2. Intrusive modal popups and manual sync buttons conflicting with silent background operation.
3. Minor test selector drift in 5 Vitest files causing 10 test failures.
4. Heavy monolithic frontend components and duplicate WebSocket event listeners.

Resolving these issues in a structured, surgical manner will elevate the codebase to full production reliability and performance.
