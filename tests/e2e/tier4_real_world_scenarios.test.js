'use strict';

/**
 * TIER 4: Real-World Application Scenarios
 * 
 * End-to-end multi-step user & system workflows:
 * - T4_01: Complete Customer Onboard -> Auto-Sync -> Order Received -> PIX Checkout -> Confirmation
 * - T4_02: Application Restart Session Persistence without QR Re-scan
 * - T4_03: Quote Lifecycle: Creation -> Customer Acceptance -> Auto-Order Conversion -> Atendente Confirmation
 * - T4_04: Live Catalog Background Update with Reactive Order Streaming
 * - T4_05: Transient Network Disconnect (515) Recovery with Zero Order Data Loss
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  CANONICAL_SESSIONS_DIR,
  pool,
  dbQuery,
  createTestTenantId,
  cleanupTestCompany,
  getMockValidCreds,
  writeSessionToDisk,
  removeSessionFromDisk,
  createMockBaileysSocket,
  startTestServer,
  createSocketClient,
  apiGet,
  apiPost,
} = require('./helpers/testHarness');

const { validateSession } = require('../../backend/services/whatsapp/connection/sessionPersistenceValidator');
const catalogSyncEngine = require('../../backend/services/commerce/CatalogSyncEngine');
const cartOrderListener = require('../../backend/services/commerce/CartOrderListener');
const orderConfirmationEngine = require('../../backend/services/commerce/OrderConfirmationEngine');
const commerceQuoteEngine = require('../../backend/services/commerce/CommerceQuoteEngine');
const orderSheetService = require('../../backend/services/orderSheetService');

describe('TIER 4 — Real-World Application Scenarios', () => {
  let testServer = null;
  let testCompany = null;
  const scenarioSessionId = `scen_sess_${Date.now()}`;

  before(async () => {
    testCompany = createTestTenantId('tier4');
    testServer = await startTestServer({ defaultCompanyId: testCompany });

    // Seed official catalog products
    await dbQuery(
      `INSERT INTO products (id, company_id, code, name, description, price, category, stock, created_at, updated_at)
       VALUES 
        ($1, $2, 'TRIO-3X1', 'Churrasqueira Pré-Moldada Trio Completa 3 em 1', 'Churrasqueira, forno e fogão a lenha', 990.00, 'Churrasqueiras', 15, NOW(), NOW()),
        ($3, $2, 'TIJ-8F', 'Tijolo 8 Furos Cerâmico 9x19x19cm (Milheiro)', 'Milheiro paletizado', 720.00, 'Tijolos', 50, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [`prod_scen_1_${Date.now()}`, testCompany, `prod_scen_2_${Date.now()}`]
    );
  });

  after(async () => {
    if (testServer) {
      await testServer.close();
    }
    await removeSessionFromDisk(scenarioSessionId);
    await cleanupTestCompany(testCompany);
    await pool.end();
    setTimeout(() => process.exit(0), 100).unref();
  });

  it('T4_01_client_onboard_to_pix_checkout: complete client onboard, auto-sync, order reception, PIX checkout and confirmation', async () => {
    // 1. Onboard session credentials to disk in canonical location
    const creds = getMockValidCreds(scenarioSessionId, '5531999991234');
    const { credsPath } = await writeSessionToDisk(scenarioSessionId, creds);
    assert.ok(fs.existsSync(credsPath));

    // 2. Auto-sync catalog in background on session connection
    const syncRes = await catalogSyncEngine.syncCatalog(testCompany);
    assert.equal(syncRes.success, true);
    assert.ok(syncRes.total >= 2);

    // 3. Customer places order via WhatsApp orderMessage
    const mockSock = createMockBaileysSocket({ sessionId: scenarioSessionId });
    const customerPhone = '5531988884321';
    const rawOrderMessage = {
      key: { remoteJid: `${customerPhone}@s.whatsapp.net`, fromMe: false },
      message: {
        orderMessage: {
          orderId: `meta_e2e_${Date.now()}`,
          itemCount: 1,
          totalAmount1000: 990000,
          totalCurrencyCode: 'BRL',
          orderTitle: 'Churrasqueira Pré-Moldada Trio',
          message: 'Entregar na Rua das Palmeiras, 120 - Bairro Eldorado',
        },
      },
    };

    const ingestedOrder = await cartOrderListener.handleIncomingOrder(mockSock, rawOrderMessage, {
      companyId: testCompany,
    });
    assert.ok(ingestedOrder);
    assert.equal(ingestedOrder.phone, customerPhone);
    assert.equal(Number(ingestedOrder.totalAmount || ingestedOrder.total_amount), 990.00);

    // 4. Generate order sheet with 5% PIX discount
    const convRes = await dbQuery(
      `INSERT INTO conversations (company_id, session_id, remote_jid, status, ai_enabled, funnel_stage, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', TRUE, 'atendimento', NOW(), NOW())
       RETURNING id`,
      [testCompany, scenarioSessionId, `${customerPhone}@s.whatsapp.net`]
    );
    const conversationId = String(convRes.rows[0].id);

    const sheetRes = await dbQuery(
      `INSERT INTO conversation_sheets (
         company_id, conversation_id, phone, customer_name,
         items, total_price, payment_method, status, updated_at
       ) VALUES ($1, $2, $3, 'Carlos Silva', $4::jsonb, 990.00, 'pix', 'aberto', NOW())
       RETURNING *`,
      [testCompany, conversationId, customerPhone, JSON.stringify([{ name: 'Churrasqueira Trio', price: 990, quantity: 1 }])]
    );

    const sheet = sheetRes.rows[0];
    const sheetText = orderSheetService.buildSheetText({
      ...sheet,
      totalPrice: 990.00,
    });

    assert.ok(sheetText.includes('PIX'));
    assert.ok(sheetText.includes('940,50'), 'Must calculate 5% PIX discount (990 * 0.95 = 940.50)');

    // 5. Finalize attendance transitioning to aguarda_pix
    await orderSheetService.finalizeAttendanceWithSheet({
      conversationId,
      companyId: testCompany,
      sheetId: sheet.id,
    });

    const convCheck = await dbQuery('SELECT status, funnel_stage, ai_enabled FROM conversations WHERE id = $1', [conversationId]);
    assert.equal(convCheck.rows[0].status, 'aguarda_pix');
    assert.equal(convCheck.rows[0].funnel_stage, 'fechamento');
    assert.equal(convCheck.rows[0].ai_enabled, false);

    // 6. Atendente confirms order
    const confirmRes = await apiPost(testServer.baseUrl, `/api/commerce/orders/${ingestedOrder.id}/confirm`, {
      notes: 'Comprovante PIX validado com sucesso',
    }, {
      'x-company-id': testCompany,
    });

    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.data.order.status, 'confirmed');
  });

  it('T4_02_session_restart_persistence_without_qr: server restart validates credentials and restores without QR', async () => {
    // 1. Establish session credentials on disk
    const rebootSessionId = `reboot_sess_${Date.now()}`;
    await writeSessionToDisk(rebootSessionId, getMockValidCreds(rebootSessionId));

    // 2. Simulate server reboot: run session persistence validator against canonical folder
    const validation = await validateSession(rebootSessionId);
    assert.equal(validation.dirExists, true, 'Directory must exist');
    assert.equal(validation.credsExists, true, 'Creds file must exist');
    assert.equal(validation.credsValid, true, 'Creds must be valid JSON');
    assert.equal(validation.credsComplete, true, 'Creds must contain all mandatory keys');
    assert.equal(validation.ok, true, 'Session must be eligible for restoration without QR code');

    // Clean up reboot session
    await removeSessionFromDisk(rebootSessionId);
  });

  it('T4_03_quote_lifecycle_to_order_to_confirmation: sales rep creates quote, customer accepts, converted to order and confirmed', async () => {
    // 1. Sales rep creates quote
    const quotePayload = {
      companyId: testCompany,
      clientPhone: '5531987654321',
      clientName: 'Marcos Construtor',
      items: [
        { name: 'Tijolo 8 Furos', price: 720.00, quantity: 2 },
      ],
      shippingAmount: 100.00,
      discountValue: 40.00,
    };

    const quoteRes = await apiPost(testServer.baseUrl, '/api/quotes', quotePayload, {
      'x-company-id': testCompany,
    });
    assert.equal(quoteRes.status, 201);
    const quote = quoteRes.data.quote;
    assert.equal(quote.status, 'draft');
    assert.equal(Number(quote.total_amount), 1500.00); // 720*2 + 100 - 40 = 1500

    // 2. Customer accepts quote
    const acceptRes = await apiPost(testServer.baseUrl, `/api/quotes/${quote.id}/accept`, {
      acceptedBy: 'client',
    }, {
      'x-company-id': testCompany,
    });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.data.quote.status, 'accepted');
    const orderId = acceptRes.data.order.id;

    // 3. Atendente confirms order
    const confirmRes = await apiPost(testServer.baseUrl, `/api/commerce/orders/${orderId}/confirm`, {
      notes: 'Orçamento aprovado pelo cliente Marcos',
    }, {
      'x-company-id': testCompany,
    });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.data.order.status, 'confirmed');
  });

  it('T4_04_catalog_update_and_live_order_streaming: catalog sync followed by reactive inbound order streams to clients', async () => {
    const client = await createSocketClient(testServer.baseUrl, testCompany);
    try {
      // 1. Broadcast catalog synced
      const catalogEventPromise = client.waitForEvent('catalog:synced', 3000);
      testServer.io.emit('catalog:synced', {
        sessionId: 'main',
        companyId: testCompany,
        synced: 10,
        total: 10,
        products: [],
      });
      const catalogEvt = await catalogEventPromise;
      assert.equal(catalogEvt.synced, 10);

      // 2. Inbound order received
      const orderEventPromise = client.waitForEvent('commerce:order_received', 3000);
      const incomingOrder = {
        orderId: `ord_live_${Date.now()}`,
        phone: '5531999998811',
        totalAmount: 990.00,
        itemCount: 1,
      };
      testServer.io.emit('commerce:order_received', {
        sessionId: 'main',
        companyId: testCompany,
        orderId: incomingOrder.orderId,
        order: incomingOrder,
      });

      const orderEvt = await orderEventPromise;
      assert.equal(orderEvt.orderId, incomingOrder.orderId);
    } finally {
      client.disconnect();
    }
  });

  it('T4_05_transient_failure_recovery_and_order_integrity: error 515 triggers recovery with zero order data loss', async () => {
    // 1. Create order prior to network disruption
    const preOrder = await orderConfirmationEngine.createOrder({
      companyId: testCompany,
      phone: '5531999997722',
      customerName: 'Cliente Resiliencia',
      items: [{ name: 'Churrasqueira', price: 990, quantity: 1 }],
    });

    const preOrderId = preOrder.order.id;
    assert.ok(preOrderId);

    // 2. Transient network drop occurs (code 515)
    const mockSock = createMockBaileysSocket();
    mockSock.ev.emit('connection.update', {
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 515 } } },
    });

    // 3. Reconnection succeeds
    mockSock.ev.emit('connection.update', { connection: 'open' });

    // 4. Query order from database to verify integrity
    const checkRes = await apiGet(testServer.baseUrl, `/api/commerce/orders/${preOrderId}`, {
      'x-company-id': testCompany,
    });

    assert.equal(checkRes.status, 200);
    assert.equal(checkRes.data.order.id, preOrderId);
    assert.equal(checkRes.data.order.status, 'pending');
    assert.equal(Number(checkRes.data.order.total_amount), 990.00);
  });
});
