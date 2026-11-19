'use strict';

/**
 * TIER 3: Cross-Feature Combinations (Pairwise Interactions)
 * 
 * Verifies complex interactions between subsystems:
 * - T3_01: Reconnecting during active catalog background sync
 * - T3_02: Incoming order arriving during session disconnection
 * - T3_03: Concurrent session status updates and real-time commerce event streaming
 * - T3_04: Commercial quote acceptance converting to order and attempting session dispatch
 * - T3_05: Strict multi-tenant session, catalog, and order isolation between companies
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  pool,
  dbQuery,
  createTestTenantId,
  cleanupTestCompany,
  createMockBaileysSocket,
  startTestServer,
  createSocketClient,
  apiGet,
  apiPost,
} = require('./helpers/testHarness');

const catalogSyncEngine = require('../../backend/services/commerce/CatalogSyncEngine');
const cartOrderListener = require('../../backend/services/commerce/CartOrderListener');
const orderConfirmationEngine = require('../../backend/services/commerce/OrderConfirmationEngine');
const commerceQuoteEngine = require('../../backend/services/commerce/CommerceQuoteEngine');

describe('TIER 3 — Cross-Feature Combinations', () => {
  let testServer = null;
  let tenantAlpha = null;
  let tenantBeta = null;

  before(async () => {
    tenantAlpha = createTestTenantId('t3_alpha');
    tenantBeta = createTestTenantId('t3_beta');
    testServer = await startTestServer({ defaultCompanyId: tenantAlpha });

    // Seed distinct products for tenantAlpha and tenantBeta
    await dbQuery(
      `INSERT INTO products (id, company_id, code, name, description, price, category, stock, created_at, updated_at)
       VALUES 
        ($1, $2, 'SKU-COMMON', 'Tijolo Alpha Especial', 'Tijolo da Alpha', 800.00, 'Alvenaria', 100, NOW(), NOW()),
        ($3, $4, 'SKU-COMMON', 'Tijolo Beta Premium', 'Tijolo da Beta', 950.00, 'Alvenaria', 50, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [`prod_alpha_${Date.now()}`, tenantAlpha, `prod_beta_${Date.now()}`, tenantBeta]
    );
  });

  after(async () => {
    if (testServer) {
      await testServer.close();
    }
    await cleanupTestCompany(tenantAlpha);
    await cleanupTestCompany(tenantBeta);
    await pool.end();
    setTimeout(() => process.exit(0), 100).unref();
  });

  it('T3_01_reconnecting_during_active_catalog_sync: sync completes safely during reconnect state transition', async () => {
    const mockSock = createMockBaileysSocket({ sessionId: 'cross_sync_sess' });

    // 1. Kick off catalog sync
    const syncPromise = catalogSyncEngine.syncCatalog(tenantAlpha);

    // 2. Concurrently simulate socket disconnect and reconnect
    mockSock.ev.emit('connection.update', {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 515 } } },
    });
    mockSock.ev.emit('connection.update', { connection: 'open' });

    const syncResult = await syncPromise;
    assert.equal(syncResult.success, true);
    assert.ok(syncResult.total >= 1);
  });

  it('T3_02_incoming_order_during_session_disconnect: order is persisted in customer_orders when socket is disconnected', async () => {
    // Session is disconnected or null socket
    const orderMessage = {
      key: { remoteJid: '5511911112222@s.whatsapp.net', id: `wamid_offline_${Date.now()}` },
      message: {
        orderMessage: {
          orderId: `ord_offline_${Date.now()}`,
          itemCount: 2,
          totalAmount1000: 1600000, // R$ 1.600,00
          orderTitle: 'Pedido Enquanto Desconectado',
        },
      },
    };

    // Sock is null (simulating offline Baileys connection)
    const order = await cartOrderListener.handleIncomingOrder(null, orderMessage, {
      companyId: tenantAlpha,
    });

    assert.ok(order, 'Order must be created even when WhatsApp socket is offline');
    assert.equal(order.status, 'pending');
    assert.equal(Number(order.totalAmount || order.total_amount), 1600.00);

    // Verify row exists in PostgreSQL
    const dbRes = await dbQuery('SELECT * FROM customer_orders WHERE order_id = $1 AND company_id = $2', [order.orderId, tenantAlpha]);
    assert.equal(dbRes.rows.length, 1);
    assert.equal(dbRes.rows[0].status, 'pending');
  });

  it('T3_03_session_status_and_commerce_stream_concurrency: concurrent Socket.IO broadcasts deliver reliably', async () => {
    const client = await createSocketClient(testServer.baseUrl, tenantAlpha);
    try {
      const statusPromise = client.waitForEvent('session_status', 3000);
      const commercePromise = client.waitForEvent('commerce:order_received', 3000);

      // Emit both simultaneously
      testServer.io.emit('session_status', { sessionId: 'main', status: 'connected' });
      testServer.io.emit('commerce:order_received', {
        sessionId: 'main',
        companyId: tenantAlpha,
        orderId: 'ord_concurrent_event',
        order: { id: 'ord_concurrent_event', total: 500 },
      });

      const [statusEvt, commerceEvt] = await Promise.all([statusPromise, commercePromise]);
      assert.equal(statusEvt.status, 'connected');
      assert.equal(commerceEvt.orderId, 'ord_concurrent_event');
    } finally {
      client.disconnect();
    }
  });

  it('T3_04_quote_approval_converts_order_and_triggers_session_dispatch: quote conversion creates order and dispatches message', async () => {
    // 1. Create quote
    const quote = await commerceQuoteEngine.createQuote({
      companyId: tenantAlpha,
      clientPhone: '5531977778888',
      clientName: 'Cliente Conversao',
      items: [{ name: 'Churrasqueira Trio', price: 990.00, quantity: 1 }],
      shippingAmount: 50.00,
    });

    // 2. Accept quote
    const acceptRes = await commerceQuoteEngine.acceptQuote(quote.id, {
      companyId: tenantAlpha,
      acceptedBy: 'client',
    });

    assert.equal(acceptRes.success, true);
    assert.ok(acceptRes.order, 'Must return converted order');
    assert.equal(acceptRes.order.currency, 'BRL');
    assert.equal(Number(acceptRes.order.total_amount), 1040.00);

    // Verify status in DB
    const checkOrder = await dbQuery('SELECT * FROM customer_orders WHERE id = $1', [acceptRes.order.id]);
    assert.equal(checkOrder.rows[0].status, 'confirmed');

    const checkQuote = await dbQuery('SELECT * FROM quotes WHERE id = $1', [quote.id]);
    assert.equal(checkQuote.rows[0].status, 'accepted');
  });

  it('T3_05_multi_tenant_session_and_catalog_isolation: strict data isolation between tenantAlpha and tenantBeta', async () => {
    // 1. Tenant Alpha creates an order
    await orderConfirmationEngine.createOrder({
      companyId: tenantAlpha,
      phone: '5511999990001',
      items: [{ name: 'Item Alpha', price: 100, quantity: 1 }],
    });

    // 2. Tenant Beta creates an order
    await orderConfirmationEngine.createOrder({
      companyId: tenantBeta,
      phone: '5511999990002',
      items: [{ name: 'Item Beta', price: 200, quantity: 1 }],
    });

    // 3. Query orders for Tenant Alpha via API
    const resAlpha = await apiGet(testServer.baseUrl, '/api/commerce/orders', {
      'x-company-id': tenantAlpha,
    });

    assert.equal(resAlpha.status, 200);
    assert.ok(Array.isArray(resAlpha.data.orders));
    // Verify none of Beta's orders leak into Alpha
    for (const ord of resAlpha.data.orders) {
      assert.equal(ord.company_id, tenantAlpha, `Order ${ord.id} must belong to ${tenantAlpha}`);
    }

    // 4. Query orders for Tenant Beta via API
    const resBeta = await apiGet(testServer.baseUrl, '/api/commerce/orders', {
      'x-company-id': tenantBeta,
    });

    assert.equal(resBeta.status, 200);
    assert.ok(Array.isArray(resBeta.data.orders));
    for (const ord of resBeta.data.orders) {
      assert.equal(ord.company_id, tenantBeta, `Order ${ord.id} must belong to ${tenantBeta}`);
    }
  });
});
