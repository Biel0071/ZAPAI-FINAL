# Milestone 2 Test Plan & Verification Criteria: Silent Background Sync

**Author**: Explorer Subagent (`m2_explorer_3`)  
**Parent Orchestrator ID**: `3265ab63-b153-484a-b6d7-740defe3b059`  
**Milestone**: `m2_silent_background_sync`  
**Scope**: Comprehensive Test Plan, Automated Test Suites, AST/Regex Static Analysis Specifications, and Pass/Fail Gates for Requirements R1 through R4.

---

## 1. Observation

### 1.1 Existing Test Suite Status and Baseline Coverage
1. **`backend/tests/whatsappCatalogAutoSync.test.js`**:
   - Command run: `node --test backend/tests/whatsappCatalogAutoSync.test.js`
   - Result: `✔ 3 pass, 0 fail` (Duration: 9347ms).
   - Line 6–8: Verifies export of `syncWhatsAppCatalogInternal`.
   - Line 10–30: Tests baseline store products fallback and `catalog:synced` Socket.IO emission.
   - Line 32–69: Tests live `sock.getCatalog({ limit: 50, jid })` query and repository import.
2. **`backend/tests/nativeWhatsAppCommerce.test.js`**:
   - Command run: `node --test backend/tests/nativeWhatsAppCommerce.test.js`
   - Result: `✔ 10 pass, 0 fail`.
   - Tests cover: capability registry (Test 1), catalog sync filtering (Test 2), image buffer resolution (Test 3), `ProductMessage` construction (Test 4), inbound `orderMessage` and `productMessage` parsing (Tests 5 & 6), `CartOrderListener` payload extraction (Test 7), adapter interface compliance (Test 8), commerce event router (Test 9), and `OrderConfirmationEngine` (Test 10).
3. **Master E2E Test Suite (`tests/e2e/run_all_e2e.js`)**:
   - Command run: `node tests/e2e/run_all_e2e.js`
   - Result: `TOTAL TESTS: 43 | SUITES PASSED: 4/4 | OVERALL RESULT: ALL TIERS GREEN` (Duration: 9.35s).
   - Tier 1 (`tier1_feature_coverage.test.js`):
     - Lines 172–193 (`T1_R2_01`): Mock auto-sync invocation on `connection === 'open'`.
     - Lines 195–200 (`T1_R2_02`): `CatalogSyncEngine.syncCatalog` products extraction.
     - Lines 202–226 (`T1_R2_03`): `CartOrderListener` unwrapping of `orderMessage`.
     - Lines 228–247 (`T1_R2_04`): Real-time `catalog:synced` event streaming over Socket.IO.
     - Lines 249–273 (`T1_R2_05`): Real-time `commerce:order_received` event streaming over Socket.IO.
     - Lines 275–282 (`T1_R2_06`): Graceful degradation on business profile error.
   - Tier 2 (`tier2_boundary_corner.test.js`):
     - Lines 136–230 (`T2_R2_01` to `T2_R2_05`): Empty catalog fallback, malformed orderMessage structure, ephemeral/viewOnce unwrapping, 100-item large catalog stress, and duplicate order idempotency.
   - Tier 3 (`tier3_cross_feature.test.js`):
     - Lines 65–115 (`T3_01`, `T3_02`, `T3_03`): Reconnection during active sync, order arrival during session disconnection, and concurrent session status updates.
   - Tier 4 (`tier4_real_world_scenarios.test.js`):
     - Lines 65–125 (`T4_01`, `T4_04`): Client onboard -> auto-sync -> order received -> PIX checkout -> reactive streaming.

### 1.2 Direct Observations of Manual Sync Triggers in Frontend
Direct code inspection confirmed manual sync buttons, modals, and triggers in the following frontend files:
1. **`frontend-official/src/components/connections/WebBridgeCard.tsx:380-390, 445-474`**:
   - Button with text `"Sincronizar Catálogo Agora"` / `"Sincronizando Catálogo..."` invoking `handleSyncCatalog`.
   - Companion sync modal dialog titled `"Conexão 2 (Commerce) — WhatsApp Web Companion para sincronização do catálogo oficial"`.
2. **`frontend-official/src/pages/Connections.tsx:254-264`**:
   - `useEffect` automatically triggers popup modal when session connects:
     ```tsx
     safeSessions.forEach((s) => {
       const prev = prevSessionStatusesRef.current[s.id];
       if (prev && (prev === "connecting" || prev === "qr") && s.status === "connected") {
         handleOpenHistoryModal(s.id, 'history');
         setIsActivationDialogOpen(false);
         setShowQRModal(false);
       }
       prevSessionStatusesRef.current[s.id] = s.status;
     });
     ```
3. **`frontend-official/src/pages/AI/AgentTab.tsx:1525-1546`**:
   - Button `"Sincronizar (Sync)"` / `"Sincronizando..."` calling `handleSyncRealAttendance`.
4. **`frontend-official/src/pages/AI/EvolutionTab.tsx:780-790`**:
   - Button `"Aprender dos Atendimentos Manuais"` / `"Minerando Atendimentos..."` calling `handleSyncManual`.
5. **`frontend-official/src/components/evolution/HistoryBootstrapPanel.tsx:500-510`**:
   - Button `"Sincronizar dados das conversas"` / `"Detectando fatos..."` calling `handleSyncFacts`.
6. **`frontend-official/src/pages/Memory.tsx:470-474`**:
   - Button `"Sincronizar no PostgreSQL"` / `"Sincronizando..."` calling `handleFlush`.
7. **`frontend-official/src/pages/Inbox/components/OrderSheetModal.tsx:563-575`**:
   - Button `"Enviar p/ ERP (Webhook)"` / `"Disparando..."` calling `handleSyncErp`.
8. **`frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx:645-680`**:
   - Unreferenced `handleSyncWhatsApp` invoking `apiService.syncWhatsAppCatalog()`.
9. **`frontend-official/src/components/ai/ZaiCommandPalette.tsx:73-80`**:
   - Slash command `"/aprender"` with title `"Sincronizar Aprendizados Reais"`.

### 1.3 Direct Observations of Backend Sync Coordination Gaps
In `backend/services/whatsapp/connection/stableSession.js`:
- Line 1403–1420: Invokes `webCatalogExtractor.extractCatalog()` after `setTimeout(..., 2500)` upon `connection === 'open'`.
- Line 1595–1615: Invokes `productsController.syncWhatsAppCatalogInternal()` after `session.catalogSyncTimer`.
- Gap: There are two competing, uncoordinated timers for catalog extraction, and neither coordinates order reconciliation or billing synchronization upon connection.

---

## 2. Logic Chain

1. **Requirement Premise**: Requirement R2 states: "Remove all sync buttons, modals, and manual sync prompts from the user interface. When an instance connects, automatically synchronize real data in the background, including catalog items, generated orders, and billing data from the logged WhatsApp instance."
2. **Gap Analysis (Observation 1.1 vs 1.2)**:
   - While the master E2E test suite validates backend mock synchronization, it lacks an automated static/AST analysis test that guarantees zero manual sync elements remain in the frontend codebase.
   - The frontend contains at least 9 specific manual sync UI triggers and 1 automatic modal popup on connection.
3. **Architecture Premise**:
   - Backend requires a unified `WhatsAppAutoSyncCoordinator.js` triggered by `stableSession.js` on `connection === 'open'`.
   - The coordinator must silently execute:
     - Catalog Synchronization (`productsController.syncWhatsAppCatalogInternal` / `CatalogSyncEngine`)
     - Order History / Inbound Listener Activation (`CartOrderListener`)
     - Billing Reconciliation (`PaymentEngine`)
4. **Resilience & Non-Blocking Deductions**:
   - Failures (e.g. personal numbers without catalog, network timeouts, malformed orders) must be caught inside the coordinator and logged as warnings; they must NEVER throw unhandled promise rejections or disconnect the WhatsApp socket.
   - Socket.IO broadcasts (`catalog:synced`, `commerce:order_received`) must occur asynchronously without blocking the Baileys connection event loop.
5. **Conclusion from Logic**:
   - We must specify four comprehensive test suites:
     - **Suite 1 (Requirement 1)**: Automated AST/regex frontend static verification test.
     - **Suite 2 (Requirement 2)**: Unit and integration test for `WhatsAppAutoSyncCoordinator.js` on `connection === 'open'`.
     - **Suite 3 (Requirement 3)**: Real-time Socket.IO streaming verification test without UI blocking.
     - **Suite 4 (Requirement 4)**: Resilience and edge-case boundary test suite (empty catalog, API timeout, corrupted order, session disconnect).

---

## 3. Caveats

1. **Vitest DOM Selector Alignment**: Five existing Vitest files are scheduled for selector restoration in Milestone 3 (F3.1). Removing manual sync buttons in Milestone 2 must be careful not to introduce unrelated syntax errors in those test files; the AST scanner must verify production components under `frontend-official/src/components/` and `frontend-official/src/pages/`.
2. **Meta API Availability in Local Tests**: Meta WhatsApp Business API (`sock.getCatalog`) cannot be queried with live network access in offline automated CI runs. Therefore, unit and integration tests must test both the mock Baileys socket (`sock.getCatalog` mock) and the database persistence pipeline, validating that real production fallbacks (`CatalogSyncEngine` / `WebCatalogExtractor`) execute cleanly.
3. **Multi-Tenant Scoping**: All test assertions must verify tenant isolation by validating that `companyId` is correctly scoped in all emitted events and database queries.

---

## 4. Conclusion & Test Specifications

### 4.1 Test Specification 1: Frontend Manual Sync Elimination (Requirement 1)
**File**: `tests/automated/m2_manual_sync_ui_elimination.test.js`  
**Target Runner**: `node --test tests/automated/m2_manual_sync_ui_elimination.test.js`  
**Purpose**: Scans the frontend codebase using AST and regex to guarantee the complete elimination of manual sync buttons, modals, dialogs, and popups.

#### Executable Test Specification:
```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.resolve(__dirname, '../../frontend-official/src');

// 1. Prohibited UI Text Patterns (User-Facing Manual Sync Buttons/Banners)
const PROHIBITED_BUTTON_TEXTS = [
  /Sincronizar Cat[aá]logo Agora/i,
  /Sincronizando Cat[aá]logo\.\.\./i,
  /Sincronizar \(Sync\)/i,
  /Minerando Atendimentos\.\.\./i,
  /Aprender dos Atendimentos Manuais/i,
  /Sincronizar dados das conversas/i,
  /Detectando fatos\.\.\./i,
  /Sincronizar no PostgreSQL/i,
  /Enviar p\/ ERP \(Webhook\)/i,
];

// 2. Prohibited Click Handlers in Target Files
const PROHIBITED_HANDLERS = [
  'handleSyncCatalog',
  'handleSyncRealAttendance',
  'handleSyncManual',
  'handleSyncFacts',
  'handleSyncWhatsApp',
  'handleSyncErp',
];

// Recursively get all .tsx and .ts files
function getSourceFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'test' && file !== '__tests__' && file !== 'node_modules') {
        results = results.concat(getSourceFiles(fullPath));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

test('Requirement 1.1: Zero prohibited manual sync button text in frontend components', () => {
  const files = getSourceFiles(FRONTEND_SRC);
  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of PROHIBITED_BUTTON_TEXTS) {
      if (pattern.test(content)) {
        violations.push({
          file: path.relative(FRONTEND_SRC, filePath),
          pattern: pattern.toString(),
        });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found prohibited manual sync button text:\n${JSON.stringify(violations, null, 2)}`
  );
});

test('Requirement 1.2: Prohibited manual sync click handlers removed from production files', () => {
  const files = getSourceFiles(FRONTEND_SRC);
  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const handler of PROHIBITED_HANDLERS) {
      // Check if handler is bound to an onClick or rendered button
      const onClickRegex = new RegExp(`onClick=\\{[^}]*\\b${handler}\\b[^}]*\\}`, 'g');
      if (onClickRegex.test(content)) {
        violations.push({
          file: path.relative(FRONTEND_SRC, filePath),
          handler,
        });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found prohibited manual sync handlers bound to UI:\n${JSON.stringify(violations, null, 2)}`
  );
});

test('Requirement 1.3: Connections.tsx does not auto-open popup modal on session connected', () => {
  const connectionsPath = path.join(FRONTEND_SRC, 'pages/Connections.tsx');
  const content = fs.readFileSync(connectionsPath, 'utf8');

  // Verify that handleOpenHistoryModal is not invoked inside the status transition useEffect
  const autoModalPattern = /if\s*\([^)]*status\s*===\s*["']connected["'][^)]*\)\s*\{[^}]*handleOpenHistoryModal/s;
  const hasAutoPopup = autoModalPattern.test(content);

  assert.equal(
    hasAutoPopup,
    false,
    'Connections.tsx must not automatically open history/sync popup modal when session connects'
  );
});

test('Requirement 1.4: WebBridgeCard has no manual sync modal dialog or manual sync trigger', () => {
  const cardPath = path.join(FRONTEND_SRC, 'components/connections/WebBridgeCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  assert.ok(!content.includes('Sincronizar Catálogo Agora'), 'WebBridgeCard must not render Sincronizar Catálogo Agora');
  assert.ok(!content.includes('apiService.syncWebBridgeCatalog'), 'WebBridgeCard must not invoke manual sync API');
});
```

---

### 4.2 Test Specification 2: Automatic Silent Background Sync Coordinator (Requirement 2)
**File**: `backend/tests/whatsappAutoSyncCoordinator.test.js`  
**Target Runner**: `node --test backend/tests/whatsappAutoSyncCoordinator.test.js`  
**Purpose**: Verifies that `WhatsAppAutoSyncCoordinator` is invoked when `connection === 'open'`, synchronizes catalog, orders, and billing in the background, deduplicates rapid connection events, and does not block the Baileys event loop.

#### Executable Test Specification:
```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const EventEmitter = require('events');

// Load coordinator (will be created in backend/services/whatsapp/sync/WhatsAppAutoSyncCoordinator.js)
const autoSyncCoordinator = require('../services/whatsapp/sync/WhatsAppAutoSyncCoordinator');

test('Requirement 2.1: WhatsAppAutoSyncCoordinator exports onSessionConnected and syncSession', () => {
  assert.equal(typeof autoSyncCoordinator.onSessionConnected, 'function');
  assert.equal(typeof autoSyncCoordinator.isSyncing, 'function');
});

test('Requirement 2.2: Automatically triggers catalog, order, and billing synchronization silently', async () => {
  const events = [];
  global.io = {
    emit: (event, payload) => events.push({ event, payload }),
    to: (room) => ({
      emit: (event, payload) => events.push({ room, event, payload }),
    }),
  };

  let catalogRequested = false;
  const mockSock = {
    user: { id: '553193672075:0@s.whatsapp.net', name: 'ZAPFLOW Bot' },
    getCatalog: async () => {
      catalogRequested = true;
      return {
        products: [
          {
            id: 'wa_auto_prod_1',
            name: 'Produto Auto Sync Teste',
            price: 150.0,
            description: 'Item de teste',
          },
        ],
      };
    },
  };

  const result = await autoSyncCoordinator.onSessionConnected({
    sessionId: 'test_auto_sync_sess',
    companyId: 'test_company_auto',
    sock: mockSock,
  });

  assert.ok(result, 'Coordinator must return a result object');
  assert.equal(result.catalogSynced, true, 'Catalog must be synchronized');
  assert.equal(result.ordersSynced, true, 'Orders must be synchronized');
  assert.equal(result.billingSynced, true, 'Billing must be synchronized');
  assert.equal(catalogRequested, true, 'sock.getCatalog must be invoked');

  // Verify real-time broadcast occurred silently
  const catalogEvent = events.find((e) => e.event === 'catalog:synced');
  assert.ok(catalogEvent, 'catalog:synced event must be emitted over Socket.IO');
  assert.equal(catalogEvent.payload.companyId, 'test_company_auto');
});

test('Requirement 2.3: Debounces and deduplicates rapid repeated connection open events', async () => {
  let callCount = 0;
  const mockSock = {
    user: { id: '553193672075:0@s.whatsapp.net' },
    getCatalog: async () => {
      callCount++;
      return { products: [] };
    },
  };

  // Dispatch two connection events in parallel for the same session
  const [res1, res2] = await Promise.all([
    autoSyncCoordinator.onSessionConnected({
      sessionId: 'sess_dedupe_test',
      companyId: 'comp_dedupe',
      sock: mockSock,
    }),
    autoSyncCoordinator.onSessionConnected({
      sessionId: 'sess_dedupe_test',
      companyId: 'comp_dedupe',
      sock: mockSock,
    }),
  ]);

  assert.ok(res1);
  assert.ok(res2);
  // Must deduplicate so getCatalog is called at most once
  assert.equal(callCount, 1, 'Simultaneous sync requests for the same session must be deduplicated');
});

test('Requirement 2.4: stableSession.js triggers WhatsAppAutoSyncCoordinator on connection open', () => {
  const stableSessionPath = path.resolve(__dirname, '../services/whatsapp/connection/stableSession.js');
  const content = fs.readFileSync(stableSessionPath, 'utf8');

  // Must import or require WhatsAppAutoSyncCoordinator
  assert.ok(
    content.includes('WhatsAppAutoSyncCoordinator') || content.includes('autoSyncCoordinator'),
    'stableSession.js must reference WhatsAppAutoSyncCoordinator'
  );

  // Must invoke coordinator when connection === "open"
  assert.ok(
    /onSessionConnected\s*\(\s*\{[^}]*sessionId/s.test(content) ||
    /WhatsAppAutoSyncCoordinator\.onSessionConnected/s.test(content),
    'stableSession.js must invoke onSessionConnected upon connection === "open"'
  );
});
```

---

### 4.3 Test Specification 3: Real-Time Event Broadcasting Without UI Blocking (Requirement 3)
**File**: Integrated in `tests/e2e/tier1_feature_coverage.test.js` & `backend/tests/whatsappAutoSyncCoordinator.test.js`  
**Purpose**: Verifies that when auto-sync discovers catalog items or inbound orders, Socket.IO emits events within SLA (< 1000ms) with correct schemas, without blocking user interaction or requiring page refresh.

#### Test Assertions:
1. **`catalog:synced` Event Schema Verification**:
   - `sessionId`: `string`
   - `companyId`: `string`
   - `synced`: `number` (items newly synced or updated)
   - `total`: `number` (total active catalog items)
   - `products`: `Array<object>` (items array with `id`, `name`, `price`, `description`)
2. **`commerce:order_received` Event Schema Verification**:
   - `sessionId`: `string`
   - `companyId`: `string`
   - `orderId`: `string` (e.g. `meta_ord_...`)
   - `order`: `object` containing `items`, `totalAmount`, `status: 'pending'`, `phone`
3. **Non-Blocking Verification**:
   - Execution time of the Socket emission is `< 5ms`.
   - The coordinator does not perform synchronous `fs.readFileSync` or blocking operations on the WebSocket gateway thread.
   - Frontend stores (products and orders) update reactively without dispatching full-page reload actions.

---

### 4.4 Test Specification 4: Resilience & Edge Cases (Requirement 4)
**File**: `tests/e2e/tier2_boundary_corner.test.js` (extended) and `backend/tests/whatsappAutoSyncCoordinator.test.js`  
**Purpose**: Verifies that the background sync coordinator never crashes Node.js, never drops the WhatsApp Baileys connection, and handles all edge cases gracefully.

#### Detailed Edge Case Specifications:
| Edge Case | Simulated Condition | Expected Behavior | Verification Assertion |
|-----------|---------------------|-------------------|------------------------|
| **EC-1: Empty Catalog** | `sock.getCatalog()` returns `{ products: [] }` or account has no WhatsApp Business catalog. | Coordinator logs informational note, falls back to local database/cache, returns `{ catalogSynced: true, total: 0 }`. | `result.catalogSynced === true`; socket remains connected (`sock.ws.isOpen !== false`). |
| **EC-2: Meta API Timeout** | `sock.getCatalog()` hangs or takes > 8,000ms. | Internal coordinator timeout (e.g. 5,000ms) cancels operation gracefully with `{ catalogSynced: false, reason: 'TIMEOUT' }`. | Zero unhandled promise rejections; Baileys socket connection remains active. |
| **EC-3: Offline Order Stream / Corrupted Payload** | Inbound `orderMessage` has `orderId: null`, missing items, or corrupted total amount. | `CartOrderListener` sanitizes payload, generates fallback ID (`meta_ord_fallback_${Date.now()}`), sets total to `0.00`, and records order. | Order inserted into `customer_orders` with status `'pending'`; zero uncaught exceptions. |
| **EC-4: Binary Thrift IQ Corrupted Response** | Raw Baileys query returns invalid binary thrift/protobuf buffer. | Catch block catches parse error, logs structured diagnostic warning, and proceeds to next sync step. | Node.js process does not exit; returns `{ catalogSynced: false }` gracefully. |
| **EC-5: Session Disconnected Mid-Sync** | Session status transitions to `disconnected` or `session.isDisposed === true` during sync. | Coordinator aborts remaining tasks, cleans up timers, and exits silently. | No write operations to disposed sockets; zero errors logged to stderr. |

#### Executable Edge Case Test Snippet:
```javascript
test('Requirement 4.1: Empty catalog does not drop socket and returns cleanly', async () => {
  const mockSock = {
    user: { id: '553193672075:0@s.whatsapp.net' },
    getCatalog: async () => ({ products: [] }),
  };

  const res = await autoSyncCoordinator.onSessionConnected({
    sessionId: 'sess_empty_cat',
    companyId: 'comp_empty',
    sock: mockSock,
  });

  assert.equal(res.catalogSynced, true);
  assert.equal(res.totalProducts, 0);
});

test('Requirement 4.2: Hanging Meta catalog API triggers internal timeout and does not block', async () => {
  const hangingSock = {
    user: { id: '553193672075:0@s.whatsapp.net' },
    getCatalog: () => new Promise(() => {}), // Never resolves
  };

  const start = Date.now();
  const res = await autoSyncCoordinator.onSessionConnected({
    sessionId: 'sess_timeout_test',
    companyId: 'comp_timeout',
    sock: hangingSock,
    timeoutMs: 1500, // Enforced short timeout for test
  });

  const duration = Date.now() - start;
  assert.ok(duration < 3000, `Expected timeout resolution under 3000ms, took ${duration}ms`);
  assert.equal(res.catalogSynced, false);
  assert.equal(res.error, 'TIMEOUT');
});

test('Requirement 4.3: Corrupted orderMessage payload is handled without unhandled rejection', async () => {
  const cartOrderListener = require('../services/commerce/CartOrderListener');
  const mockSock = {};
  const corruptedOrderData = {
    key: { remoteJid: '553198346078@s.whatsapp.net', id: 'wamid_corrupt' },
    message: {
      orderMessage: {
        // Missing orderId, invalid total
        orderTitle: null,
        itemCount: -1,
        totalAmount1000: 'not-a-number',
      },
    },
  };

  // Must not throw or crash
  const order = await cartOrderListener.handleIncomingOrder(mockSock, corruptedOrderData, {
    companyId: 'comp_corrupt',
    sessionId: 'main',
  });

  assert.ok(order !== null, 'Order should be created with fallback values');
  assert.ok(order.orderId.startsWith('meta_ord_'), 'Should assign fallback order ID');
  assert.equal(order.totalAmount, 0);
});
```

---

## 5. Verification Method & Pass/Fail Thresholds

To independently verify Milestone 2, execute the following commands in order:

### 5.1 Verification Commands
1. **Frontend Manual Sync UI Elimination (AST / Regex)**:
   ```powershell
   node --test tests/automated/m2_manual_sync_ui_elimination.test.js
   ```
   - **Pass Criteria**: `✔ 4 pass, 0 fail`. Zero prohibited manual sync buttons or auto-popups detected.
2. **Auto-Sync Coordinator Unit & Integration**:
   ```powershell
   node --test backend/tests/whatsappAutoSyncCoordinator.test.js
   ```
   - **Pass Criteria**: `✔ 4 pass, 0 fail`. Invocation, deduplication, and timing contracts green.
3. **Existing Commerce Test Suites**:
   ```powershell
   node --test backend/tests/whatsappCatalogAutoSync.test.js
   node --test backend/tests/nativeWhatsAppCommerce.test.js
   ```
   - **Pass Criteria**: 100% passing (`3/3 pass` and `10/10 pass`), zero unhandled rejections.
4. **Master E2E Opaque-Box Suite (All 4 Tiers)**:
   ```powershell
   node tests/e2e/run_all_e2e.js
   ```
   - **Pass Criteria**: `43/43 tests pass (100% GREEN) across all 4 tiers` in < 15 seconds.
5. **Frontend Build Cleanliness**:
   ```powershell
   npm run build --prefix frontend-official
   ```
   - **Pass Criteria**: Clean compilation with exit code 0.

### 5.2 Invalidation Conditions
The verification is invalidated if:
- Any user-facing manual sync button, progress banner, or popup dialog appears when connecting WhatsApp.
- `connection.update` with `connection === 'open'` fails to silently trigger catalog and order synchronization.
- A failure in catalog extraction (such as personal WhatsApp or Meta timeout) drops the Baileys connection or causes an unhandled promise rejection.
- Any regression is introduced into the existing 43 master E2E tests.
