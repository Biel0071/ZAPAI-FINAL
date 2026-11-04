'use strict';

/**
 * WhatsAppAutoSyncCoordinator.js
 *
 * Unified silent automatic background sync coordinator for WhatsApp connections.
 * Orchestrates catalog extraction, order reconciliation, and billing synchronization
 * when a WhatsApp session reaches 'open' state, without blocking or risking socket stability.
 *
 * Implements Interface Contract from PROJECT.md:
 * - onSessionConnected({ sessionId, companyId, sock, isDifferentAccount, delayMs, timeoutMs }): Promise<{ catalogSynced, ordersSynced, billingSynced, totalProducts?, productsCount?, error? }>
 * - onSessionDisconnected(sessionId): void
 * - isSyncing(sessionId): boolean
 * - getLastSyncStatus(sessionId): object
 */

const EventEmitter = require('events');

class WhatsAppAutoSyncCoordinator extends EventEmitter {
  constructor() {
    super();
    this.scheduledTimers = new Map();   // sessionId -> NodeJS.Timeout
    this.pendingResolvers = new Map();  // sessionId -> Array<Function>
    this.runningSyncs = new Map();      // sessionId -> boolean
    this.pendingReSync = new Map();     // sessionId -> object (args for next run)
    this.syncStates = new Map();        // sessionId -> { status, lastSyncAt, ... }
  }

  /**
   * Primary entry point invoked when Baileys session reaches connection === 'open'
   *
   * @param {Object} params
   * @param {string} [params.sessionId] - Normalized session name (e.g. 'main')
   * @param {string} [params.companyId] - Tenant ID
   * @param {Object} [params.sock] - Baileys socket instance
   * @param {boolean} [params.isDifferentAccount] - Whether account identity changed
   * @param {number} [params.delayMs] - Debounce delay before background work begins
   * @param {number} [params.timeoutMs] - Maximum execution timeout for catalog fetch
   * @returns {Promise<{ catalogSynced: boolean, ordersSynced: boolean, billingSynced: boolean, totalProducts?: number, productsCount?: number, error?: string }>}
   */
  async onSessionConnected({
    sessionId = 'main',
    companyId = process.env.DEFAULT_COMPANY_ID || 'default',
    sock = null,
    isDifferentAccount = false,
    delayMs,
    timeoutMs,
  } = {}) {
    if (!sessionId) {
      return { catalogSynced: false, ordersSynced: false, billingSynced: false, totalProducts: 0, productsCount: 0 };
    }

    // Default debounce: 50ms in test environment, 2500ms in production
    const effectiveDelay = typeof delayMs === 'number'
      ? Math.max(0, delayMs)
      : (process.env.NODE_ENV === 'test' ? 50 : 2500);

    // Cancel existing pending timer for this session (debounces rapid reconnects)
    if (this.scheduledTimers.has(sessionId)) {
      clearTimeout(this.scheduledTimers.get(sessionId));
      this.scheduledTimers.delete(sessionId);
    }

    // If a background sync is actively executing, queue this trigger for follow-up
    if (this.runningSyncs.get(sessionId)) {
      this.pendingReSync.set(sessionId, { companyId, sock, isDifferentAccount, delayMs: 500, timeoutMs });
      console.log(`[WHATSAPP-AUTO-SYNC] Sync already in-flight for "${sessionId}"; queued follow-up re-sync.`);
      return { catalogSynced: false, ordersSynced: false, billingSynced: false, totalProducts: 0, productsCount: 0 };
    }

    return new Promise((resolve) => {
      if (!this.pendingResolvers.has(sessionId)) {
        this.pendingResolvers.set(sessionId, []);
      }
      this.pendingResolvers.get(sessionId).push(resolve);

      const timer = setTimeout(async () => {
        this.scheduledTimers.delete(sessionId);
        let result;
        try {
          result = await this._executeSync({ sessionId, companyId, sock, isDifferentAccount, timeoutMs });
        } catch (err) {
          console.warn(`[WHATSAPP-AUTO-SYNC] Unexpected error caught in scheduled sync for "${sessionId}":`, err?.message || err);
          result = { catalogSynced: false, ordersSynced: false, billingSynced: false, totalProducts: 0, productsCount: 0 };
        }

        const resolvers = this.pendingResolvers.get(sessionId) || [];
        this.pendingResolvers.delete(sessionId);
        for (const res of resolvers) {
          try {
            res(result);
          } catch (_) {}
        }
      }, effectiveDelay);

      this.scheduledTimers.set(sessionId, timer);
    });
  }

  /**
   * Internal worker executing the 3 synchronization stages sequentially and safely
   * @private
   */
  async _executeSync({ sessionId, companyId, sock, isDifferentAccount, timeoutMs }) {
    // Guard: verify session is still connected and not closing/disposed
    const session = this._resolveSession(sessionId);
    if (session && (session.isDisposed || session.isClosing || (session.status && session.status !== 'connected'))) {
      console.log(`[WHATSAPP-AUTO-SYNC] Skipping background sync: session "${sessionId}" is not in connected state.`);
      return { catalogSynced: false, ordersSynced: false, billingSynced: false, totalProducts: 0, productsCount: 0 };
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
    let syncError = null;

    // ─── STAGE 1: Real Catalog Synchronization ───
    try {
      const productsController = require('../../../src/api/controllers/productsController');
      if (typeof productsController.syncWhatsAppCatalogInternal === 'function') {
        const catalogPromise = productsController.syncWhatsAppCatalogInternal({
          companyId: effectiveCompanyId,
          sessionId,
          sock: effectiveSock,
          forceClean: Boolean(isDifferentAccount),
          limit: 50,
          skipWebBridge: true,
        });

        if (typeof timeoutMs === 'number' && timeoutMs > 0) {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => {
              const err = new Error('TIMEOUT');
              err.code = 'TIMEOUT';
              reject(err);
            }, timeoutMs)
          );
          catalogResult = await Promise.race([catalogPromise, timeoutPromise]);
        } else {
          catalogResult = await catalogPromise;
        }

        catalogSynced = Boolean(catalogResult && catalogResult.success);
        console.log(`[WHATSAPP-AUTO-SYNC] Stage 1 (Catalog) completed: ${catalogResult?.total || 0} products available.`);
      }
    } catch (catErr) {
      if (catErr?.message === 'TIMEOUT' || catErr?.code === 'TIMEOUT') {
        syncError = 'TIMEOUT';
        catalogSynced = false;
        console.warn(`[WHATSAPP-AUTO-SYNC] Stage 1 (Catalog) timed out for "${sessionId}".`);
      } else {
        console.warn(`[WHATSAPP-AUTO-SYNC] Stage 1 (Catalog) non-fatal warning for "${sessionId}":`, catErr?.message || catErr);
      }
    }

    // ─── STAGE 2: Orders Listener & Cache Warm-Up ───
    try {
      require('../../commerce/CartOrderListener');

      let recentOrders = [];
      try {
        const { query: dbQuery } = require('../../../src/infrastructure/config/database');
        if (typeof dbQuery === 'function') {
          const ordersRes = await dbQuery(
            `SELECT id, order_id, conversation_id, phone, order_title, item_count, total_amount, currency, status, created_at
             FROM customer_orders
             WHERE company_id = $1
             ORDER BY created_at DESC
             LIMIT 20`,
            [effectiveCompanyId]
          );
          recentOrders = ordersRes?.rows || [];
        }
      } catch (dbErr) {
        console.warn(`[WHATSAPP-AUTO-SYNC] Orders query fallback notice:`, dbErr?.message || dbErr);
      }

      ordersSynced = true;

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
      let pendingQuotes = 0;
      try {
        const { query: dbQuery } = require('../../../src/infrastructure/config/database');
        if (typeof dbQuery === 'function') {
          const quotesRes = await dbQuery(
            `SELECT COUNT(*)::int as count
             FROM quotes
             WHERE company_id = $1 AND status IN ('draft', 'sent')`,
            [effectiveCompanyId]
          );
          pendingQuotes = quotesRes?.rows[0]?.count || 0;
        }
      } catch (dbErr) {
        console.warn(`[WHATSAPP-AUTO-SYNC] Billing query fallback notice:`, dbErr?.message || dbErr);
      }

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
    const totalProducts = (effectiveSock && typeof catalogResult?.waFetched === 'number')
      ? catalogResult.waFetched
      : (catalogResult?.total || 0);
    const summary = {
      catalogSynced,
      ordersSynced,
      billingSynced,
      totalProducts,
      productsCount: totalProducts,
      total: totalProducts,
      error: syncError || undefined,
      completedAt: new Date().toISOString(),
    };

    this.syncStates.set(sessionId, {
      status: syncError ? 'failed' : 'completed',
      ...summary,
    });
    this.runningSyncs.delete(sessionId);

    // Broadcast completion to reactive frontend listeners
    this._broadcastToTenant(effectiveCompanyId, 'whatsapp:sync_completed', {
      sessionId,
      companyId: effectiveCompanyId,
      ...summary,
    });

    console.log(`[WHATSAPP-AUTO-SYNC] Pipeline finished for "${sessionId}": catalog=${catalogSynced}, orders=${ordersSynced}, billing=${billingSynced}, products=${totalProducts}.`);

    // Check if an additional sync was requested while running
    if (this.pendingReSync.has(sessionId)) {
      const nextArgs = this.pendingReSync.get(sessionId);
      this.pendingReSync.delete(sessionId);
      this.onSessionConnected({ ...nextArgs, sessionId }).catch(() => {});
    }

    return {
      catalogSynced,
      ordersSynced,
      billingSynced,
      totalProducts,
      productsCount: totalProducts,
      error: syncError || undefined,
    };
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

    if (this.pendingResolvers.has(sessionId)) {
      const resolvers = this.pendingResolvers.get(sessionId) || [];
      this.pendingResolvers.delete(sessionId);
      for (const res of resolvers) {
        try {
          res({ catalogSynced: false, ordersSynced: false, billingSynced: false, totalProducts: 0, productsCount: 0 });
        } catch (_) {}
      }
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
   * Checks whether background sync is actively executing or scheduled for a session
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
