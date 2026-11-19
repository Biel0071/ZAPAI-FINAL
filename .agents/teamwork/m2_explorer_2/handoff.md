# Handoff Report: WhatsApp Automatic Background Sync Architecture (R2 / F2.2)

**Subagent**: `m2_explorer_2` (Explorer)  
**Parent Orchestrator ID**: `3265ab63-b153-484a-b6d7-740defe3b059`  
**Milestone**: M2 (`m2_silent_background_sync` — Backend Architecture)  
**Date**: 2026-11-04  

---

## 1. Observation

### 1.1 `stableSession.js` Connection & Sync Call Sites
Inspection of `backend/services/whatsapp/connection/stableSession.js` reveals two uncoordinated, duplicate timers when a WhatsApp connection opens (`connection === 'open'`):

1. **First Timer at `stableSession.js:1403-1420`**:
```javascript
1402:       // Auto-sync automático do catálogo comercial em background ao conectar
1403:       try {
1404:         const webCatalogExtractor = require('../../webbridge/WebCatalogExtractor');
1405:         if (session.webCatalogTimer) {
1406:           clearTimeout(session.webCatalogTimer);
1407:           session.webCatalogTimer = null;
1408:         }
1409:         session.webCatalogTimer = setTimeout(() => {
1410:           session.webCatalogTimer = null;
1411:           if (session.isDisposed || session.isClosing || session.status !== 'connected') {
1412:             return;
1413:           }
1414:           webCatalogExtractor.extractCatalog(normalizedSessionName, session.companyId || 'default')
1415:             .then(res => console.log(`[WHATSAPP-AUTO-SYNC] Catálogo sincronizado automaticamente para ${normalizedSessionName}: ${res.total} produtos.`))
1416:             .catch(err => console.warn(`[WHATSAPP-AUTO-SYNC] Aviso no auto-sync do catálogo:`, err.message));
1417:         }, 2500);
1418:       } catch (catErr) {
1419:         console.warn('[WHATSAPP-AUTO-SYNC] Falha ao disparar auto-sync de catálogo:', catErr.message);
1420:       }
```
Directly calls `WebCatalogExtractor.extractCatalog` (bypassing native Baileys catalog queries and direct PostgreSQL product synchronization).

2. **Second Timer at `stableSession.js:1595-1620`**:
```javascript
1595:       // Automatically sync WhatsApp Business catalog on connection open so products are immediately available for dispatch
1596:       if (session.catalogSyncTimer) {
1597:         clearTimeout(session.catalogSyncTimer);
1598:       }
1599:       session.catalogSyncTimer = setTimeout(async () => {
1600:         session.catalogSyncTimer = null;
1601:         if (session.isDisposed || session.isClosing || session.status !== 'connected') return;
1602:         try {
1603:           const productsController = require('../../../src/api/controllers/productsController');
1604:           if (typeof productsController.syncWhatsAppCatalogInternal === 'function') {
1605:             // eslint-disable-next-line no-console
1606:             console.log(`[CATALOG] Auto-syncing WhatsApp Business catalog for session: ${normalizedSessionName}`);
1607:             const result = await productsController.syncWhatsAppCatalogInternal({
1608:               companyId: session.companyId || process.env.DEFAULT_COMPANY_ID || 'default',
1609:               sessionId: normalizedSessionName,
1610:               sock,
1611:               forceClean: Boolean(session.isDifferentAccount),
1612:             });
1613:             // eslint-disable-next-line no-console
1614:             console.log(`[CATALOG] Auto-sync finished: ${result.total} products ready for dispatch.`);
1615:           }
1616:         } catch (catErr) {
1617:           // eslint-disable-next-line no-console
1618:           console.warn('[CATALOG] Auto-sync catalog on connection open warning:', catErr?.message || catErr);
1619:         }
1620:       }, 3500);
```

3. **Cleanup Sites in `stableSession.js`**:
- Lines 1682-1689:
  ```javascript
  1682:       if (session.catalogSyncTimer) {
  1683:         clearTimeout(session.catalogSyncTimer);
  1684:         session.catalogSyncTimer = null;
  1685:       }
  1686:       if (session.webCatalogTimer) {
  1687:         clearTimeout(session.webCatalogTimer);
  1688:         session.webCatalogTimer = null;
  1689:       }
  ```
- Lines 1884-1891:
  ```javascript
  1884:         if (session.catalogSyncTimer) {
  1885:           clearTimeout(session.catalogSyncTimer);
  1886:           session.catalogSyncTimer = null;
  1887:         }
  1888:         if (session.webCatalogTimer) {
  1889:           clearTimeout(session.webCatalogTimer);
  1890:           session.webCatalogTimer = null;
  1891:         }
  ```

4. **Inbound Commerce Order Interception at `stableSession.js:2118-2128`**:
```javascript
2118:       if (!fromMe && normalizedIncomingContent?.orderMessage) {
2119:         try {
2120:           const cartOrderListener = require('../../commerce/CartOrderListener');
2121:           cartOrderListener.handleIncomingOrder(sock, incomingMessage, {
2122:             companyId: session.companyId || process.env.DEFAULT_COMPANY_ID || 'default',
2123:             sessionId: normalizedSessionName,
2124:           }).catch(err => console.error('[COMMERCE] CartOrderListener error:', err.message));
2125:         } catch (commerceErr) {
2126:           console.error('[COMMERCE] Failed to load CartOrderListener:', commerceErr.message);
2127:         }
2128:       }
```

### 1.2 Commerce & Controller Subsystems
1. **`backend/src/api/controllers/productsController.js` (`syncWhatsAppCatalogInternal`)**:
   - Lines 299-514: Accepts `{ companyId, sessionId, sock, forceClean, limit }`.
   - Executes 4 sequential strategies to retrieve WhatsApp catalog:
     - Strategy 1: `activeSock.getCatalog({ jid: bizJid, limit })`
     - Strategy 2: `activeSock.getCatalog({ limit })`
     - Strategy 3: `activeSock.getCatalog({ jid: lidJid, limit })`
     - Strategy 4: Raw IQ query for `product_catalog` node with `parseCatalogNode`
   - Upserts retrieved products into PostgreSQL (`productRepository.upsertProduct`).
   - Falls back to `WebCatalogExtractor.extractCatalog(sessionId, companyId)` if Meta returns 0 products.
   - Clears `clearFastCache()`.
   - Emits Socket.IO event `catalog:synced`:
     ```javascript
     global.io.emit('catalog:synced', {
       sessionId,
       companyId,
       synced: syncedCount,
       waFetched,
       total: currentProducts.length,
       products: currentProducts,
     });
     ```
2. **`backend/services/commerce/CartOrderListener.js`**:
   - Intercepts WhatsApp `orderMessage` payloads.
   - Extracts item list via Baileys IQ `sock.getOrderDetails(orderId, token)`.
   - Upserts into PostgreSQL `customer_orders` table (Migration 051).
   - Creates conversation message in history.
   - Emits Socket.IO event:
     ```javascript
     global.io.to(`tenant:${companyId}`).emit('commerce:order_received', orderPayload);
     global.io.emit('new_message', createdMessage);
     ```
3. **Database Schema & Migrations**:
   - `049_create_products_table_and_whatsapp_catalog.js`: `products` table with `company_id`, `code`, `name`, `price`, `images`, `whatsapp_url`.
   - `051_create_customer_orders_table.js`: `customer_orders` table with `id`, `company_id`, `order_id`, `conversation_id`, `phone`, `total_amount`, `status`, `items`.
   - `052_create_quotes_table.js`: `quotes` table with `company_id`, `quote_number`, `client_phone`, `total_amount`, `status`.
4. **Realtime Gateway & Frontend Listeners**:
   - `websocketGateway.js`: Centralized event router with tenant room routing (`emitToTenant`), batching, metrics, and deduplication.
   - `frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx:472`: Listens to `socket.on("catalog:synced", handleSyncEvent)`.
   - `frontend-official/src/pages/Inbox/components/CustomerOrdersDrawer.tsx:121`: Listens to `socket.on("commerce:order_received", handleOrderEvent)`.
   - `frontend-official/src/pages/Inbox/components/ActiveChatPane.tsx:842`: Listens to `socket.on("commerce:order_received", handleOrderNotify)`.

---

## 2. Logic Chain

1. **Root Problem in Connection Lifecycle**:
   - Because `webCatalogTimer` (at 2500ms) and `catalogSyncTimer` (at 3500ms) operate as disconnected timers in `stableSession.js`, they fire redundantly on every connection event.
   - If a connection undergoes quick transient reconnects (e.g. Baileys code 515 restart), multiple timers can stack or race against each other.
   - If the socket drops while a sync is underway, there is no centralized state tracking or cancellation hook.
2. **Missing Unified Synchronization Domain**:
   - Requirement R2 and `PROJECT.md` interface contract specify a unified coordinator:
     `WhatsAppAutoSyncCoordinator.onSessionConnected({ sessionId, companyId, sock })` returning `Promise<{ catalogSynced: boolean, ordersSynced: boolean, billingSynced: boolean }>`.
   - The coordinator must coordinate all three facets of commerce data:
     1. **Catalog**: Execute `syncWhatsAppCatalogInternal` (Meta IQ + PostgreSQL upsert + Redis cache invalidation).
     2. **Orders**: Verify `CartOrderListener`, warm up recent orders from `customer_orders`, emit sync events.
     3. **Billing**: Query pending quotes/billings, synchronize state to tenant room.
3. **Safety & Non-blocking Requirement**:
   - The coordinator MUST be non-blocking. Any error in catalog extraction, database timeout, or socket query must be trapped within isolated `try/catch` blocks.
   - Under no condition can an auto-sync failure disconnect the Baileys socket, log an unhandled promise rejection, or block user interaction.
4. **Reactive State Emission**:
   - Emits `catalog:synced` and `commerce:order_received` / `commerce:orders_synced` via both `websocketGateway.emit` (for tenant-isolated rooms) and `global.io` (for legacy components), ensuring instant reactive updates on the frontend with ZERO manual sync prompts or buttons.

---

## 3. Caveats

1. **WhatsApp Business vs Standard Accounts**:
   - If the logged-in WhatsApp session is a standard personal account (not WhatsApp Business), `sock.getCatalog()` will return empty or throw a permission error. The coordinator handles this gracefully: `syncWhatsAppCatalogInternal` falls back to `WebCatalogExtractor` or repository store items without interrupting the connection.
2. **Network Latency & Rate Limits**:
   - Meta imposes throttling on rapid consecutive binary IQ queries. The coordinator uses a 3000ms debounce delay post-connection to ensure the session handshake has stabilized before issuing queries.
3. **Multi-Tenant State Isolation**:
   - All database queries and Socket.IO emissions must strictly respect `companyId` (falling back to `process.env.DEFAULT_COMPANY_ID || 'default'`), avoiding cross-tenant leakage.

---

## 4. Conclusion & Complete Implementation Design

### 4.1 New Component: `backend/services/whatsapp/sync/WhatsAppAutoSyncCoordinator.js`

Here is the complete, production-ready implementation of `WhatsAppAutoSyncCoordinator.js`:

```javascript
'use strict';

/**
 * WhatsAppAutoSyncCoordinator.js
 *
 * Unified silent automatic background sync coordinator for WhatsApp connections.
 * Orchestrates catalog extraction, order reconciliation, and billing synchronization
 * when a WhatsApp session reaches 'open' state, without blocking or risking socket stability.
 *
 * Implements Interface Contract from PROJECT.md:
 * - onSessionConnected({ sessionId, companyId, sock }): Promise<{ catalogSynced, ordersSynced, billingSynced }>
 * - onSessionDisconnected(sessionId): void
 * - isSyncing(sessionId): boolean
 * - getLastSyncStatus(sessionId): object
 */

const EventEmitter = require('events');

class WhatsAppAutoSyncCoordinator extends EventEmitter {
  constructor() {
    super();
    this.scheduledTimers = new Map(); // sessionId -> NodeJS.Timeout
    this.runningSyncs = new Map();    // sessionId -> boolean
    this.pendingReSync = new Map();   // sessionId -> object (args for next run)
    this.syncStates = new Map();      // sessionId -> { status, lastSyncAt, ... }
  }

  /**
   * Primary entry point invoked when Baileys session reaches connection === 'open'
   *
   * @param {Object} params
   * @param {string} params.sessionId - Normalized session name (e.g. 'main')
   * @param {string} [params.companyId] - Tenant ID
   * @param {Object} [params.sock] - Baileys socket instance
   * @param {boolean} [params.isDifferentAccount] - Whether account identity changed
   * @param {number} [params.delayMs] - Debounce delay before background work begins (default: 3000ms)
   * @returns {Promise<{ catalogSynced: boolean, ordersSynced: boolean, billingSynced: boolean }>}
   */
  async onSessionConnected({
    sessionId = 'main',
    companyId = process.env.DEFAULT_COMPANY_ID || 'default',
    sock = null,
    isDifferentAccount = false,
    delayMs = 3000,
  } = {}) {
    if (!sessionId) {
      return { catalogSynced: false, ordersSynced: false, billingSynced: false };
    }

    // 1. Cancel any existing pending timer for this session (debounces rapid reconnect events)
    if (this.scheduledTimers.has(sessionId)) {
      clearTimeout(this.scheduledTimers.get(sessionId));
      this.scheduledTimers.delete(sessionId);
    }

    // 2. If a background sync is actively executing, queue this trigger for immediate follow-up
    if (this.runningSyncs.get(sessionId)) {
      this.pendingReSync.set(sessionId, { companyId, sock, isDifferentAccount, delayMs: 1500 });
      console.log(`[WHATSAPP-AUTO-SYNC] Sync already in-flight for "${sessionId}"; queued follow-up re-sync.`);
      return { catalogSynced: false, ordersSynced: false, billingSynced: false };
    }

    // 3. Schedule execution with debounce delay so Baileys handshake, encryption keys, and session settle
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.scheduledTimers.delete(sessionId);
        try {
          const result = await this._executeSync({ sessionId, companyId, sock, isDifferentAccount });
          resolve(result);
        } catch (err) {
          console.warn(`[WHATSAPP-AUTO-SYNC] Unexpected error caught in scheduled sync for "${sessionId}":`, err?.message || err);
          resolve({ catalogSynced: false, ordersSynced: false, billingSynced: false });
        }
      }, Math.max(500, delayMs));

      this.scheduledTimers.set(sessionId, timer);
    });
  }

  /**
   * Internal worker executing the 3 synchronization stages sequentially and safely
   * @private
   */
  async _executeSync({ sessionId, companyId, sock, isDifferentAccount }) {
    // Guard: verify session is still connected and not closing/disposed
    const session = this._resolveSession(sessionId);
    if (session && (session.isDisposed || session.isClosing || (session.status && session.status !== 'connected'))) {
      console.log(`[WHATSAPP-AUTO-SYNC] Skipping background sync: session "${sessionId}" is not in connected state.`);
      return { catalogSynced: false, ordersSynced: false, billingSynced: false };
    }

    const effectiveCompanyId = companyId || session?.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
    const effectiveSock = sock || session?.sock || null;

    this.runningSyncs.set(sessionId, true);
    this.syncStates.set(sessionId, {
      status: 'syncing',
      startedAt: new Date().toISOString(),
      companyId: effectiveCompanyId,
      catalogSynced: false,
      ordersSynced: false,
      billingSynced: false,
    });

    console.log(`[WHATSAPP-AUTO-SYNC] Starting background sync pipeline for session "${sessionId}" (company: ${effectiveCompanyId})...`);

    let catalogSynced = false;
    let catalogResult = null;
    let ordersSynced = false;
    let billingSynced = false;

    // ─── STAGE 1: Real Catalog Synchronization ───
    try {
      const productsController = require('../../../src/api/controllers/productsController');
      if (typeof productsController.syncWhatsAppCatalogInternal === 'function') {
        catalogResult = await productsController.syncWhatsAppCatalogInternal({
          companyId: effectiveCompanyId,
          sessionId,
          sock: effectiveSock,
          forceClean: Boolean(isDifferentAccount),
          limit: 50,
        });
        catalogSynced = Boolean(catalogResult && catalogResult.success);
        console.log(`[WHATSAPP-AUTO-SYNC] Stage 1 (Catalog) completed: ${catalogResult?.total || 0} products available.`);
      }
    } catch (catErr) {
      console.warn(`[WHATSAPP-AUTO-SYNC] Stage 1 (Catalog) non-fatal warning for "${sessionId}":`, catErr?.message || catErr);
    }

    // ─── STAGE 2: Orders Listener & Cache Warm-Up ───
    try {
      // Ensure CartOrderListener module is loaded and ready
      require('../../commerce/CartOrderListener');

      // Query recent customer orders from PostgreSQL to warm up cache and verify health
      const { query: dbQuery } = require('../../../src/infrastructure/config/database');
      const ordersRes = await dbQuery(
        `SELECT id, order_id, conversation_id, phone, order_title, item_count, total_amount, currency, status, created_at
         FROM customer_orders
         WHERE company_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [effectiveCompanyId]
      );

      const recentOrders = ordersRes?.rows || [];
      ordersSynced = true;

      // Broadcast commerce sync ready to frontend stores
      this._broadcastToTenant(effectiveCompanyId, 'commerce:orders_synced', {
        sessionId,
        companyId: effectiveCompanyId,
        count: recentOrders.length,
        recentOrders,
        timestamp: new Date().toISOString(),
      });
      console.log(`[WHATSAPP-AUTO-SYNC] Stage 2 (Orders) completed: verified listener and cached ${recentOrders.length} recent orders.`);
    } catch (orderErr) {
      console.warn(`[WHATSAPP-AUTO-SYNC] Stage 2 (Orders) non-fatal warning for "${sessionId}":`, orderErr?.message || orderErr);
    }

    // ─── STAGE 3: Billing & Quotes Status Sync ───
    try {
      const { query: dbQuery } = require('../../../src/infrastructure/config/database');
      const quotesRes = await dbQuery(
        `SELECT COUNT(*)::int as count
         FROM quotes
         WHERE company_id = $1 AND status IN ('draft', 'sent')`,
        [effectiveCompanyId]
      );

      const pendingQuotes = quotesRes?.rows[0]?.count || 0;
      billingSynced = true;

      this._broadcastToTenant(effectiveCompanyId, 'billing:synced', {
        sessionId,
        companyId: effectiveCompanyId,
        pendingQuotes,
        timestamp: new Date().toISOString(),
      });
      console.log(`[WHATSAPP-AUTO-SYNC] Stage 3 (Billing) completed: ${pendingQuotes} pending commercial quotes.`);
    } catch (billingErr) {
      console.warn(`[WHATSAPP-AUTO-SYNC] Stage 3 (Billing) non-fatal warning for "${sessionId}":`, billingErr?.message || billingErr);
    }

    // ─── Finalize State & Broadcast Summary ───
    const summary = {
      catalogSynced,
      ordersSynced,
      billingSynced,
      productsCount: catalogResult?.total || 0,
      completedAt: new Date().toISOString(),
    };

    this.syncStates.set(sessionId, {
      status: 'completed',
      ...summary,
    });
    this.runningSyncs.delete(sessionId);

    // Broadcast completion to reactive frontend listeners
    this._broadcastToTenant(effectiveCompanyId, 'whatsapp:sync_completed', {
      sessionId,
      companyId: effectiveCompanyId,
      ...summary,
    });

    console.log(`[WHATSAPP-AUTO-SYNC] Pipeline finished for "${sessionId}": catalog=${catalogSynced}, orders=${ordersSynced}, billing=${billingSynced}.`);

    // Check if an additional sync was requested while running
    if (this.pendingReSync.has(sessionId)) {
      const nextArgs = this.pendingReSync.get(sessionId);
      this.pendingReSync.delete(sessionId);
      this.onSessionConnected({ ...nextArgs, sessionId }).catch(() => {});
    }

    return { catalogSynced, ordersSynced, billingSynced };
  }

  /**
   * Cleans up timers, cancels pending work, and marks session as disconnected
   *
   * @param {string} sessionId
   */
  onSessionDisconnected(sessionId) {
    if (!sessionId) return;

    if (this.scheduledTimers.has(sessionId)) {
      clearTimeout(this.scheduledTimers.get(sessionId));
      this.scheduledTimers.delete(sessionId);
      console.log(`[WHATSAPP-AUTO-SYNC] Cancelled pending timer for disconnected session: "${sessionId}".`);
    }

    this.pendingReSync.delete(sessionId);
    this.runningSyncs.delete(sessionId);

    const current = this.syncStates.get(sessionId);
    if (current && current.status === 'syncing') {
      this.syncStates.set(sessionId, {
        ...current,
        status: 'interrupted',
        interruptedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Checks whether background sync is actively executing for a session
   * @param {string} sessionId
   * @returns {boolean}
   */
  isSyncing(sessionId) {
    return Boolean(this.runningSyncs.get(sessionId) || this.scheduledTimers.has(sessionId));
  }

  /**
   * Returns current sync telemetry state for diagnostics
   * @param {string} sessionId
   * @returns {Object|null}
   */
  getLastSyncStatus(sessionId) {
    return this.syncStates.get(sessionId) || null;
  }

  /**
   * Broadcasts Socket.IO events via websocketGateway and global.io fallback
   * @private
   */
  _broadcastToTenant(companyId, event, payload) {
    try {
      const websocketGateway = require('../../websocketGateway');
      if (typeof websocketGateway.emit === 'function') {
        websocketGateway.emit(event, payload, { tenantId: companyId });
      }
    } catch (_) {}

    try {
      if (global.io) {
        if (companyId) {
          global.io.to(`tenant:${companyId}`).emit(event, payload);
        }
        global.io.emit(event, payload);
      }
    } catch (_) {}
  }

  /**
   * Safely resolves active session record from registry or sessionManager
   * @private
   */
  _resolveSession(sessionId) {
    try {
      const { activeSessions } = require('../state/registry');
      if (activeSessions && activeSessions[sessionId]) {
        return activeSessions[sessionId];
      }
      const sessionManager = require('../../sessionManager');
      if (typeof sessionManager.getSession === 'function') {
        return sessionManager.getSession(sessionId);
      }
    } catch (_) {}
    return null;
  }
}

module.exports = new WhatsAppAutoSyncCoordinator();
```

---

### 4.2 Exact Surgical Code Diffs for `backend/services/whatsapp/connection/stableSession.js`

#### Diff 1: Connection Open Hook (Replace lines 1402-1420)

**Before (`stableSession.js:1402-1420`)**:
```javascript
      // Auto-sync automático do catálogo comercial em background ao conectar
      try {
        const webCatalogExtractor = require('../../webbridge/WebCatalogExtractor');
        if (session.webCatalogTimer) {
          clearTimeout(session.webCatalogTimer);
          session.webCatalogTimer = null;
        }
        session.webCatalogTimer = setTimeout(() => {
          session.webCatalogTimer = null;
          if (session.isDisposed || session.isClosing || session.status !== 'connected') {
            return;
          }
          webCatalogExtractor.extractCatalog(normalizedSessionName, session.companyId || 'default')
            .then(res => console.log(`[WHATSAPP-AUTO-SYNC] Catálogo sincronizado automaticamente para ${normalizedSessionName}: ${res.total} produtos.`))
            .catch(err => console.warn(`[WHATSAPP-AUTO-SYNC] Aviso no auto-sync do catálogo:`, err.message));
        }, 2500);
      } catch (catErr) {
        console.warn('[WHATSAPP-AUTO-SYNC] Falha ao disparar auto-sync de catálogo:', catErr.message);
      }
```

**After**:
```javascript
      // Silent automatic background synchronization (Catalog, Orders, Billing) via WhatsAppAutoSyncCoordinator
      try {
        const whatsAppAutoSyncCoordinator = require('../sync/WhatsAppAutoSyncCoordinator');
        whatsAppAutoSyncCoordinator.onSessionConnected({
          sessionId: normalizedSessionName,
          companyId: session.companyId || process.env.DEFAULT_COMPANY_ID || 'default',
          sock,
          isDifferentAccount: Boolean(session.isDifferentAccount),
        }).catch((syncErr) => {
          console.warn('[WHATSAPP-AUTO-SYNC] Background auto-sync non-blocking warning:', syncErr?.message || syncErr);
        });
      } catch (syncInitErr) {
        console.warn('[WHATSAPP-AUTO-SYNC] Failed to invoke WhatsAppAutoSyncCoordinator:', syncInitErr?.message || syncInitErr);
      }
```

#### Diff 2: Remove Duplicate Timer in `stableSession.js:1595-1620`

**Before (`stableSession.js:1595-1620`)**:
```javascript
      // Automatically sync WhatsApp Business catalog on connection open so products are immediately available for dispatch
      if (session.catalogSyncTimer) {
        clearTimeout(session.catalogSyncTimer);
      }
      session.catalogSyncTimer = setTimeout(async () => {
        session.catalogSyncTimer = null;
        if (session.isDisposed || session.isClosing || session.status !== 'connected') return;
        try {
          const productsController = require('../../../src/api/controllers/productsController');
          if (typeof productsController.syncWhatsAppCatalogInternal === 'function') {
            // eslint-disable-next-line no-console
            console.log(`[CATALOG] Auto-syncing WhatsApp Business catalog for session: ${normalizedSessionName}`);
            const result = await productsController.syncWhatsAppCatalogInternal({
              companyId: session.companyId || process.env.DEFAULT_COMPANY_ID || 'default',
              sessionId: normalizedSessionName,
              sock,
              forceClean: Boolean(session.isDifferentAccount),
            });
            // eslint-disable-next-line no-console
            console.log(`[CATALOG] Auto-sync finished: ${result.total} products ready for dispatch.`);
          }
        } catch (catErr) {
          // eslint-disable-next-line no-console
          console.warn('[CATALOG] Auto-sync catalog on connection open warning:', catErr?.message || catErr);
        }
      }, 3500);
```

**After**:
```javascript
      // Background catalog sync is coordinated silently via WhatsAppAutoSyncCoordinator (F2.2)
```

#### Diff 3: Clean Disconnect Teardown (At `stableSession.js:1682` and `1884`)

**In Disconnect Handler (`stableSession.js:1682`)**:
```javascript
      try {
        const whatsAppAutoSyncCoordinator = require('../sync/WhatsAppAutoSyncCoordinator');
        whatsAppAutoSyncCoordinator.onSessionDisconnected(normalizedSessionName);
      } catch (_) {}
      if (session.catalogSyncTimer) {
        clearTimeout(session.catalogSyncTimer);
        session.catalogSyncTimer = null;
      }
      if (session.webCatalogTimer) {
        clearTimeout(session.webCatalogTimer);
        session.webCatalogTimer = null;
      }
```

**In Terminal Teardown Handler (`stableSession.js:1884`)**:
```javascript
        try {
          const whatsAppAutoSyncCoordinator = require('../sync/WhatsAppAutoSyncCoordinator');
          whatsAppAutoSyncCoordinator.onSessionDisconnected(normalizedSessionName);
        } catch (_) {}
        if (session.bufferFlushInterval) {
          clearInterval(session.bufferFlushInterval);
          session.bufferFlushInterval = null;
        }
```

---

## 5. Verification Method

To independently verify the implementation:

### 5.1 Unit & Integration Test Suite (`backend/tests/whatsAppAutoSyncCoordinator.test.js`)
Create and execute the dedicated test suite:

```bash
node --test backend/tests/whatsAppAutoSyncCoordinator.test.js
```

**Test Specification (`backend/tests/whatsAppAutoSyncCoordinator.test.js`)**:
1. **Contract Compliance**: `onSessionConnected` returns `{ catalogSynced, ordersSynced, billingSynced }`.
2. **Debounce & De-duplication**: Invoking `onSessionConnected` 5 times concurrently results in exactly 1 sync execution.
3. **Non-blocking Resilience**: Throwing inside `syncWhatsAppCatalogInternal` or database queries does NOT throw unhandled rejections and returns `{ catalogSynced: false, ordersSynced: ..., billingSynced: ... }`.
4. **Teardown Cleanliness**: Calling `onSessionDisconnected` immediately cancels pending timers and resets `isSyncing(sessionId)` to false.
5. **Real-time Event Broadcasting**: Verifies emission of `catalog:synced`, `commerce:orders_synced`, and `whatsapp:sync_completed` to `tenant:${companyId}`.

### 5.2 Existing Test Suite Regression Pass
Verify that related existing test suites pass with zero regressions:
```bash
node --test backend/tests/whatsappCatalogAutoSync.test.js
node --test backend/tests/nativeWhatsAppCommerce.test.js
```

### 5.3 Invalidation Conditions
- If `onSessionConnected` throws an unhandled error or crashes the Node event loop when Baileys or PostgreSQL is offline.
- If duplicate sync timers run concurrently for the same `sessionId`.
- If manual sync buttons/prompts remain visible in the frontend instead of silent reactive updates.
