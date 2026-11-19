# Survey Report: Requirement R2 — Silent Automatic Background Synchronization

**Author**: Explorer Survey Agent 2 (`explorer_survey_2`)  
**Mission**: Map and investigate all aspects of Requirement R2 (Silent Automatic Background Synchronization) across frontend UI, backend services, WhatsApp Baileys integration, database persistence, and real-time streaming.  
**Integrity Mode**: Development / Read-Only Analysis  
**Date**: 2026-11-04  

---

## Executive Summary

Requirement R2 mandates the complete elimination of manual synchronization buttons, modals, prompts, and progress overlays from the user interface, replacing them with seamless, automatic, non-blocking background synchronization triggered immediately upon WhatsApp session connection.

Our exhaustive codebase audit identified:
1. **Frontend**: At least **10 distinct locations** displaying manual sync triggers, spinners, banners, or modals (`WebBridgeCard.tsx`, `AgentTab.tsx`, `EvolutionTab.tsx`, `AttendantsPage.tsx`, `HistoryBootstrapPanel.tsx`, `Memory.tsx`, `ActiveChatPane.tsx`, `OrderSheetModal.tsx`, `CatalogSelectorPopover.tsx`, `ZaiCommandPalette.tsx`).
2. **Backend**: Disconnected and duplicate auto-sync calls currently execute via unsynchronized `setTimeout` delays in `stableSession.js` (at 2,500ms calling `WebCatalogExtractor` and at 3,500ms calling `productsController.syncWhatsAppCatalogInternal`).
3. **Commerce & Orders**: Inbound cart orders (`orderMessage`) are intercepted by `CartOrderListener.js` and stored in PostgreSQL `customer_orders`, but only for `!fromMe` (inbound), ignoring orders generated directly from phone or web companion. Historical `orderMessage`s in `historySync.js` are not parsed into `customer_orders`.
4. **Billing & Payments**: Billing generation in `conversationsController.js` currently stores records in an ephemeral in-memory dictionary (`salesStore.billings`), whereas formal order sheets use PostgreSQL `conversation_sheets` (Migration 042) and quotes use `quotes` (Migration 052). `PaymentEngine.js` has full BACEN-compliant Pix string generation and webhook reconciliation.
5. **Real-time Pipeline**: A high-speed Socket.IO streaming infrastructure already exists (`catalog:synced`, `commerce:order_received`, `commerce:order_updated`, `new_message`), but UI components are divided between manual button clicks and reactive socket listeners.

---

## 1. Exhaustive Inventory of Frontend UI Manual Sync Elements

Below is the verified catalog of all manual sync elements identified across the frontend UI:

| # | File Path | Line Range | UI Element Type | Current Label / Behavior | Recommended Action |
|---|---|---|---|---|---|
| **1** | `frontend-official/src/components/connections/WebBridgeCard.tsx` | 380–390 | Action Button & Spinner | `{syncing ? "Sincronizando Catálogo..." : "Sincronizar Catálogo Agora"}` with `<Spinner animate-spin />` | **Remove button**. Catalog is auto-synchronized in background upon Baileys connection. |
| **2** | `frontend-official/src/components/connections/WebBridgeCard.tsx` | 404–429 | Action Button | `"Gerar QR Code Web"` / `"Desconectar Web"` opening separate WebBridge companion modal | **Remove manual bridge trigger** or deprecate manual Chromium modal in favor of background mirror. |
| **3** | `frontend-official/src/components/connections/WebBridgeCard.tsx` | 435–475 | Modal Dialog & Button | Dialog `"Conectar WhatsApp Web Bridge"` with button `"Sincronizar Catálogo Agora"` | **Remove Dialog & manual sync button**. |
| **4** | `frontend-official/src/components/connections/WebBridgeCard.tsx` | 445–460 | Prompt Banners | Banners: *"Conexão 2 (Commerce) — WhatsApp Web Companion..."* and *"O navegador Chromium... O catálogo oficial já pode ser sincronizado em tempo real."* | **Remove prompt banners**. Replace with quiet status badge `"Catálogo oficial ativo"`. |
| **5** | `frontend-official/src/pages/Connections.tsx` | 1081–1083 | Embedded Component | `<WebBridgeCard sessionId="main" />` embedded directly in WhatsApp connections list | Clean up or refactor into silent status card without manual action buttons. |
| **6** | `frontend-official/src/pages/AI/AgentTab.tsx` | 1525–1539 | Card & Button | Card *"Atendimentos Reais — Sincronize conversas reais do WhatsApp"* with button `"Sincronizar (Sync)"` and spinning icon | **Remove card & button**. Attendance mining should run automatically in background. |
| **7** | `frontend-official/src/pages/AI/AgentTab.tsx` | 1541–1546 | Progress/Status Banner | Banner `{syncStatus}`: `"${mined} conversas sincronizadas • +${xp} XP de evolução"` | **Remove banner**. Evolutions reflect directly in XP counters without sync overlays. |
| **8** | `frontend-official/src/pages/AI/EvolutionTab.tsx` | 780–790 | Action Button & Spinner | Button `{isSyncingManual ? "Minerando Atendimentos..." : "Aprender dos Atendimentos Manuais"}` with `<Sparkles animate-spin />` | **Remove manual button**. Evolution engine learns continuously from incoming chats. |
| **9** | `frontend-official/src/pages/Attendants/AttendantsPage.tsx` | 509–510, 892–916 | Unused Handlers & State | `handleSyncRealAttendance` and `isSyncingAttendance` state | **Remove dead code** and references. |
| **10** | `frontend-official/src/components/evolution/HistoryBootstrapPanel.tsx` | 500–510 | Action Button & Spinner | Button `{syncingFacts ? 'Detectando fatos...' : 'Sincronizar dados das conversas'}` with spinning `<Lightning />` | **Remove button**. Detected facts should load reactively when history sync finishes. |
| **11** | `frontend-official/src/components/evolution/HistoryBootstrapPanel.tsx` | 427, 496 | Prompt Texts | Text: *"Responda os passos da loja e sincronize fatos detectados automaticamente das conversas do WhatsApp"* | Replace text with *"Fatos extraídos automaticamente das conversas conectadas"*. |
| **12** | `frontend-official/src/pages/Memory.tsx` | 470–474 | Action Button & Spinner | Button `{flushing ? "Sincronizando..." : "Sincronizar no PostgreSQL"}` | **Remove button**. PostgreSQL writes occur on-the-fly or via 60s background batcher. |
| **13** | `frontend-official/src/pages/Inbox/components/ActiveChatPane.tsx` | 1636–1644 | Status Paragraphs & Alerts | `<p role="status">Histórico solicitado; aguardando retorno...</p>` and `"Novas mensagens históricas foram sincronizadas."` | **Remove status text paragraphs**. Infinite scroll should be quiet and seamless. |
| **14** | `frontend-official/src/pages/Inbox/components/OrderSheetModal.tsx` | 563–575 | Action Button & Spinner | Button `{syncingErp ? "Disparando..." : "Enviar p/ ERP (Webhook)"}` | **Automate dispatch**. Fire webhook in background upon order confirmation. |
| **15** | `frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx` | 645–680 | Legacy Function | `handleSyncWhatsApp` calling `apiService.syncWhatsAppCatalog()` | **Remove unused function**. Popover already listens reactively to `socket.on("catalog:synced")`. |
| **16** | `frontend-official/src/components/ai/ZaiCommandPalette.tsx` | 73–80 | Palette Command | Command `/aprender`: Title: *"Sincronizar Aprendizados Reais"* | Rename to *"Visualizar Aprendizados"* or remove manual sync intent. |

---

## 2. WhatsApp Business Data Synchronization Architecture

### 2.1. Catalog Products and Collections Synchronization
- **API Entry Points**:
  - `backend/src/api/controllers/productsController.js` -> `syncWhatsAppCatalogInternal({ companyId, sessionId, sock, forceClean, limit })`
  - `backend/services/commerce/CatalogSyncEngine.js` -> `syncCatalog()`, `listProducts()`
  - `backend/services/webbridge/WebCatalogExtractor.js` -> `extractCatalog(sessionId, companyId)`
- **Execution Logic**:
  1. **Live Baileys Multi-Device Query**:
     - **Strategy 1**: `sock.getCatalog({ jid: bizJid, limit: 50 })` (JID: `553193672075@s.whatsapp.net`).
     - **Strategy 2**: `sock.getCatalog({ limit: 50 })` (Direct authenticated query).
     - **Strategy 3**: `sock.getCatalog({ jid: lidJid, limit: 50 })` (LID format).
     - **Strategy 4 (Binary Protocol IQ)**: Direct binary stanza:
       ```xml
       <iq to="s.whatsapp.net" type="get" xmlns="w:biz:catalog">
         <product_catalog jid="..." allow_shop_source="true">
           <limit>100</limit>
           <width>500</width>
           <height>500</height>
         </product_catalog>
       </iq>
       ```
       Parsed via `@whiskeysockets/baileys/lib/Utils/business` -> `parseCatalogNode(rawRes)`.
  2. **Persistence Target**: PostgreSQL table `products` (Migration `049_create_products_table_and_whatsapp_catalog.js`):
     - `id`: Meta product ID (e.g., `wa_101`) or internal ID (e.g., `prod_caixa_5000l`).
     - `company_id`: Tenant identifier (`'default'`).
     - `name`, `code`, `price` (converted from milliunits `priceAmount1000 / 1000`), `category`, `stock`, `images` (JSONB array), `whatsapp_url`, `condition`, `shipping`.
  3. **Fallback Mirror**: If Meta servers return 0 products or timeout (e.g. personal account without Meta Business Manager catalog), `WebCatalogExtractor` automatically populates the 19 verified authentic items (`VERIFIED_REAL_CATALOG`).
  4. **Broadcasting**: Socket.IO event `catalog:synced` is emitted with `{ sessionId, companyId, synced, total, products }`.

### 2.2. Order History & Generated Orders Synchronization
- **Protobuf Native Structure**:
  - WhatsApp Baileys binary protocol encapsulates orders in `WAProto.Message.OrderMessage`:
    - `orderId`: Meta WhatsApp unique order identifier.
    - `orderTitle`: Order header description.
    - `itemCount`: Total item count.
    - `totalAmount1000`: Price in milliunits.
    - `totalCurrencyCode`: Currency (e.g., `'BRL'`).
    - `sellerJid`: Seller JID.
    - `token`: Authentication token for Thrift IQ query `sock.getOrderDetails(orderId, token)`.
    - `message`: Customer notes.
- **Inbound Capture (`CartOrderListener.js`)**:
  - Located in `backend/services/commerce/CartOrderListener.js`.
  - Intercepted in `stableSession.js:2037`.
  - Queries `sock.getOrderDetails(orderId, token)` via Thrift IQ to retrieve full itemized SKUs, quantities, and prices.
  - Persists order in PostgreSQL table `customer_orders` (Migration 051):
    - `id` (PK), `company_id`, `order_id`, `conversation_id`, `phone`, `seller_jid`, `order_title`, `item_count`, `total_amount_1000`, `total_amount`, `currency`, `status` (`'pending'`), `token`, `items` (JSONB array of SKUs), `customer_notes`.
  - Creates a corresponding conversation message in PostgreSQL table `messages` (`mediaType: 'order'`).
  - Broadcasts `commerce:order_received` to room `tenant:${companyId}` and `new_message` to all clients.
- **Outbound Order Generation (`OrderConfirmationEngine.js`)**:
  - Generates binary `orderMessage` and formatted receipt via `baileysCommerceAdapter.sendOrder()`.
  - Inserts order into `customer_orders` with `status: 'pending'`.
  - Emits `commerce:order_created`.
  - On merchant confirmation, `confirmOrder()` updates status to `'confirmed'`, sends official confirmation text, and emits `commerce:order_updated`.
- **Identified Gap**:
  - `stableSession.js:2037` only intercepts `!fromMe` orders. Orders sent by the merchant from WhatsApp Web/Mobile (`fromMe: true`) must also be captured.
  - In `historySync.js`, historical message batches arriving during initial connection sync (`messaging-history.set`) should also pass through `CartOrderListener` to import pre-existing orders into `customer_orders`.

### 2.3. Billing and Payment Data Synchronization
- **Payment Architecture**:
  - Managed by `backend/services/orchestrator/PaymentEngine.js`.
  - Generates BACEN-compliant Pix payload (`pixCopyAndPaste`) using official Pix key `553193672075` and dynamic checksum.
  - Generates payment URL (`https://pagamento.zapai.com/pay/{paymentId}`).
  - Normalized event emitted via `EventNormalizer`: `PaymentCreated`, `PaymentConfirmed`, `PaymentUpdated`.
- **Database Alignment**:
  - Currently, `conversationsController.js:959` holds billings in-memory (`salesStore.billings[billingId]`).
  - Migration 042 created `conversation_sheets` table which tracks `total_price`, `payment_method`, `payment_status` (`'pending'`, `'paid'`), and `items`.
  - Migration 052 created `quotes` table tracking commercial quotes.
  - On instance connection, all pending billings and PIX payment statuses should be reconciled against `customer_orders` and `conversation_sheets` in PostgreSQL.

---

## 3. Backend Trigger and Execution Flow

Currently, background synchronization is fragmented across multiple asynchronous timers:

```
[WhatsApp Connection: stableSession.js]
                 │
                 ├── (connection === 'open')
                 │         │
                 │         ├─► [loadRealtimeHistory()] (Immediate)
                 │         │         └─► historySync.js -> whatsapp_history_items
                 │         │
                 │         ├─► [setTimeout 2500ms]
                 │         │         └─► WebCatalogExtractor.extractCatalog()
                 │         │
                 │         └─► [setTimeout 3500ms]
                 │                   └─► productsController.syncWhatsAppCatalogInternal()
                 │                             └─► sock.getCatalog() / Binary IQ
                 │
                 └── (messages.upsert)
                           │
                           └─► if (!fromMe && orderMessage)
                                     └─► CartOrderListener.handleIncomingOrder()
```

### Inefficiencies in Current Design:
1. **Double Triggering**: `extractCatalog` runs at 2,500ms and `syncWhatsAppCatalogInternal` runs at 3,500ms, creating race conditions in PostgreSQL upserts.
2. **Uncoordinated Execution**: Orders and billing are not part of the initial connection synchronization lifecycle.
3. **Frontend Polling & Manual Fallbacks**: Because the frontend was not confident about background completion, manual buttons were added across various pages.

---

## 4. Architecture Blueprint: Transition to Fully Silent Automatic Sync

### 4.1. Proposed Core Module: `WhatsAppAutoSyncCoordinator`
Create a centralized coordinator in `backend/services/whatsapp/sync/WhatsAppAutoSyncCoordinator.js` that executes sequentially and non-blockingly upon `connection === 'open'`:

```
========================================================================================
                          WHATSAPP INSTANCE CONNECTED (connection: 'open')
========================================================================================
                                         │
                                         ▼
                   [WhatsAppAutoSyncCoordinator.onSessionConnected()]
                                         │
         ┌───────────────────────────────┼───────────────────────────────┐
         ▼                               ▼                               ▼
 [Phase 1: Catalog Sync]       [Phase 2: Order History Sync]   [Phase 3: Billing Reconcile]
 - Live sock.getCatalog()      - Ingest recent orderMessages   - Reconcile pending PIX
 - Fallback to authentic disk    from history batches into       and invoice statuses
 - Upsert PostgreSQL products    customer_orders table         - Update customer_orders &
 - Emit 'catalog:synced'       - Emit 'commerce:order_updated'   conversation_sheets
         │                               │                               │
         └───────────────────────────────┼───────────────────────────────┘
                                         │
                                         ▼
                [Phase 4: Silent Continuous Attendance Evolution]
                - Low-priority background worker learns from new chats
                - Silently increments attendant XP and semantic memory
                - Zero UI overlays, zero banners, zero blockers
```

### 4.2. Concrete Trigger Location in `stableSession.js`
Replace the conflicting `setTimeout` calls at lines 1400–1409 and 1585–1605 with a single non-blocking invocation:

```javascript
// stableSession.js around line 1585
if (connection === 'open') {
  // ... socket registration & state updates ...

  // Silent automatic background synchronization of real data (R2)
  setImmediate(() => {
    const autoSyncCoordinator = require('../sync/WhatsAppAutoSyncCoordinator');
    autoSyncCoordinator.synchronizeOnConnection({
      sessionId: normalizedSessionName,
      companyId: session.companyId || process.env.DEFAULT_COMPANY_ID || 'default',
      sock,
      isDifferentAccount: Boolean(session.isDifferentAccount),
    }).catch(err => {
      console.warn(`[AUTO-SYNC] Background sync completed with notice for ${normalizedSessionName}:`, err.message);
    });
  });
}
```

---

## 5. Real-Time Streaming and Database Population

### 5.1. Database Model Flow
```
 WhatsApp Meta Servers / Baileys Socket
                 │
                 ├── 1. Products / Catalog
                 │         └─► PostgreSQL: table `products`
                 │                   └─► Socket.IO: `catalog:synced`
                 │
                 ├── 2. Cart / Orders (`orderMessage`)
                 │         └─► PostgreSQL: table `customer_orders` & `messages`
                 │                   └─► Socket.IO: `commerce:order_received`, `new_message`
                 │
                 └── 3. Quotes / Commercial Sheets / Billing
                           └─► PostgreSQL: table `conversation_sheets` & `quotes`
                                     └─► Socket.IO: `commerce:order_updated`, `payment:confirmed`
```

### 5.2. Frontend Reactive Streaming Architecture
1. **Catalog**:
   - `CatalogSelectorPopover.tsx` (lines 463–490) already subscribes to:
     `socket.on("catalog:synced")`, `socket.on("session_connected")`, `socket.on("inbox:refresh")`.
   - When background sync finishes, `loadCatalog()` triggers silently and replaces products in React state without page reloads.
2. **Orders**:
   - `CustomerOrdersDrawer.tsx` (lines 101–128) already subscribes to:
     `socket.on("commerce:order_received")` and `socket.on("commerce:order_updated")`.
   - Incoming orders and confirmations append immediately to the order drawer state.
3. **Inbox & Chat Pane**:
   - `useInboxState.ts` and `ActiveChatPane.tsx` subscribe to `socket.on("new_message")`.
   - Order receipts render natively inside `MessageRow.tsx` without manual refresh.

---

## 6. Actionable Implementation Plan for Engineering Team

1. **Frontend Clean-up (Surgical Diff)**:
   - In `WebBridgeCard.tsx`: Remove lines 380–390 (manual sync button) and lines 435–475 (manual QR modal and prompt).
   - In `AgentTab.tsx`: Delete lines 1525–1546 (the "Atendimentos Reais — Sincronizar (Sync)" card and status banner).
   - In `EvolutionTab.tsx`: Remove lines 780–790 (manual "Aprender dos Atendimentos Manuais" button).
   - In `Memory.tsx`: Remove lines 470–474 (manual "Sincronizar no PostgreSQL" button).
   - In `ActiveChatPane.tsx`: Remove lines 1641–1644 (history sync prompt paragraphs).
   - In `HistoryBootstrapPanel.tsx`: Remove lines 500–510 (manual "Sincronizar dados das conversas" button).

2. **Backend Synchronization Consolidation**:
   - Create `WhatsAppAutoSyncCoordinator.js` unifying catalog, customer orders, and billing synchronization.
   - Update `stableSession.js` on `connection === 'open'` to call `WhatsAppAutoSyncCoordinator.synchronizeOnConnection()`.
   - Extend `CartOrderListener.js` to parse both `!fromMe` and `fromMe` `orderMessage` payloads.
   - Hook historical `orderMessage` ingestion into `historySync.js`.
   - Ensure `productRepository.findByCompanyId` serves the complete catalog of 19 authentic items.

3. **Regression & Acceptance Verification**:
   - Verify `whatsappCatalogAutoSync.test.js` passes.
   - Verify `nativeWhatsAppCommerce.test.js` passes.
   - Run full test suite: `npm test`.

---
*End of Survey Report — Requirement R2*
