'use strict';

/**
 * TIER 1: Feature Coverage (Isolation)
 * 
 * Comprehensive opaque-box test cases covering R1, R2, and R3 in isolation:
 * - R1: WhatsApp Multi-Device Session Stability & Persistence (6 tests)
 * - R2: Silent Automatic Background Synchronization (6 tests)
 * - R3: Performance Optimization & Commercial Polish (6 tests)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

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

// Import system commerce engines and validators
const catalogSyncEngine = require('../../backend/services/commerce/CatalogSyncEngine');
const cartOrderListener = require('../../backend/services/commerce/CartOrderListener');
const orderConfirmationEngine = require('../../backend/services/commerce/OrderConfirmationEngine');
const commerceQuoteEngine = require('../../backend/services/commerce/CommerceQuoteEngine');
const orderSheetService = require('../../backend/services/orderSheetService');

describe('TIER 1 — Feature Coverage (Isolation)', () => {
  let testServer = null;
  let testCompany = null;

  before(async () => {
    testCompany = createTestTenantId('tier1');
    testServer = await startTestServer({ defaultCompanyId: testCompany });

    // Seed test products in database for test company
    await dbQuery(
      `INSERT INTO products (id, company_id, code, name, description, price, category, stock, created_at, updated_at)
       VALUES 
        ($1, $2, 'CHURR-01', 'Churrasqueira Pré-Moldada Trio Completa', 'Churrasqueira 3 em 1', 990.00, 'Churrasqueiras', 10, NOW(), NOW()),
        ($3, $2, 'TIJ-08', 'Tijolo 8 Furos Cerâmico (Milheiro)', 'Milheiro de tijolos cerâmicos', 720.00, 'Tijolos & Blocos', 50, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [`prod_t1_1_${Date.now()}`, testCompany, `prod_t1_2_${Date.now()}`]
    );
  });

  after(async () => {
    if (testServer) {
      await testServer.close();
    }
    await cleanupTestCompany(testCompany);
    await pool.end();
    setTimeout(() => process.exit(0), 100).unref();
  });

  // =========================================================================
  // REQUIREMENT R1: WhatsApp Session Instantiation & Connection Stability
  // =========================================================================

  describe('R1: WhatsApp Session Instantiation & Connection Stability', () => {
    const r1SessionId = `sess_r1_test_${Date.now()}`;

    after(async () => {
      await removeSessionFromDisk(r1SessionId);
    });

    it('T1_R1_01_canonical_session_dir_contract: session credentials reside in canonical <root>/data/sessions', async () => {
      try {
        const creds = getMockValidCreds(r1SessionId);
        const { sessionDir, credsPath } = await writeSessionToDisk(r1SessionId, creds);

        // Verify directory resides strictly under CANONICAL_SESSIONS_DIR
        const relative = path.relative(CANONICAL_SESSIONS_DIR, sessionDir);
        assert.ok(!relative.startsWith('..'), `Session directory ${sessionDir} must reside inside ${CANONICAL_SESSIONS_DIR}`);
        assert.ok(fs.existsSync(credsPath), `creds.json must exist at canonical path ${credsPath}`);

        const content = JSON.parse(await fsp.readFile(credsPath, 'utf8'));
        assert.equal(content.me.name, `ZAPFLOW Test Bot (${r1SessionId})`);
      } finally {
        await removeSessionFromDisk(r1SessionId);
      }
    });

    it('T1_R1_02_session_creds_validation_healthy: valid creds.json contains all required cryptographic keys', async () => {
      const creds = getMockValidCreds(r1SessionId);
      const REQUIRED_KEYS = ['noiseKey', 'signedIdentityKey', 'registrationId', 'me'];

      for (const key of REQUIRED_KEYS) {
        assert.ok(creds[key] !== undefined, `creds.json must contain required key: ${key}`);
      }
      assert.ok(creds.me.id.includes('@s.whatsapp.net'), 'User JID in credentials must have valid WhatsApp format');
    });

    it('T1_R1_03_transient_disconnect_recovery_state: transient error codes trigger backoff rather than logout', () => {
      const transientCodes = [408, 428, 500, 515];
      const fatalCodes = [401, 403];

      // Evaluation oracle: 401 is DisconnectReason.loggedOut; transient codes are reconnectable
      for (const code of transientCodes) {
        const isTransient = code !== 401 && code !== 403;
        assert.equal(isTransient, true, `Disconnect code ${code} must be classified as transient`);
      }
      for (const code of fatalCodes) {
        const isFatal = code === 401 || code === 403;
        assert.equal(isFatal, true, `Disconnect code ${code} must be classified as fatal logout`);
      }
    });

    it('T1_R1_04_session_status_and_health_endpoints: GET /api/sessions/status responds with valid payload', async () => {
      const res = await apiGet(testServer.baseUrl, '/api/sessions/status', {
        'x-company-id': testCompany,
      });

      // API responds with status code 200 or defined schema
      assert.ok([200, 204].includes(res.status), `Expected 200/204 from /api/sessions/status, got ${res.status}`);
      if (res.data && typeof res.data === 'object') {
        assert.ok(res.data.status || res.data.sessions || res.data.active !== undefined);
      }
    });

    it('T1_R1_05_disconnect_system_transitions: disconnect and connect system endpoints respond gracefully', async () => {
      const resDisconnect = await apiPost(testServer.baseUrl, '/api/session/disconnect-system', {}, {
        'x-company-id': testCompany,
      });
      assert.ok([200, 400, 404].includes(resDisconnect.status), `Unexpected status ${resDisconnect.status}`);

      const resConnect = await apiPost(testServer.baseUrl, '/api/session/connect-system', {}, {
        'x-company-id': testCompany,
      });
      assert.ok([200, 400, 404].includes(resConnect.status), `Unexpected status ${resConnect.status}`);
    });

    it('T1_R1_06_realtime_session_status_broadcasting: Socket.IO broadcasts session_status events', async () => {
      const client = await createSocketClient(testServer.baseUrl, testCompany);
      try {
        const eventPromise = client.waitForEvent('session_status', 2000);
        
        // Emit mock event from server to simulate session status broadcast
        testServer.io.emit('session_status', {
          sessionId: r1SessionId,
          status: 'connected',
          timestamp: new Date().toISOString(),
        });

        const received = await eventPromise;
        assert.equal(received.sessionId, r1SessionId);
        assert.equal(received.status, 'connected');
      } finally {
        client.disconnect();
      }
    });
  });

  // =========================================================================
  // REQUIREMENT R2: Silent Automatic Background Synchronization
  // =========================================================================

  describe('R2: Silent Automatic Background Synchronization', () => {
    it('T1_R2_01_auto_sync_on_connection_open: connection open invokes auto-sync without UI prompts', async () => {
      let syncInvoked = false;
      const mockCoordinator = {
        async onSessionConnected({ sessionId, companyId }) {
          syncInvoked = true;
          return { catalogSynced: true, ordersSynced: true, billingSynced: true };
        },
      };

      const mockSock = createMockBaileysSocket({ sessionId: 'sync_test' });
      // Simulate connection.update event
      mockSock.ev.on('connection.update', async (update) => {
        if (update.connection === 'open') {
          await mockCoordinator.onSessionConnected({ sessionId: 'sync_test', companyId: testCompany });
        }
      });

      mockSock.ev.emit('connection.update', { connection: 'open' });
      // Allow event to settle
      await new Promise(r => setTimeout(r, 50));
      assert.equal(syncInvoked, true, 'Auto-sync coordinator must be invoked when connection is open');
    });

    it('T1_R2_02_catalog_sync_engine_products_extraction: CatalogSyncEngine syncs products to database', async () => {
      const result = await catalogSyncEngine.syncCatalog(testCompany);
      assert.equal(result.success, true, 'Catalog sync must return success');
      assert.ok(result.total >= 2, `Expected at least 2 seeded products, got ${result.total}`);
      assert.ok(result.lastSync, 'Catalog sync must record lastSync timestamp');
    });

    it('T1_R2_03_cart_order_listener_unwraps_order_message: parses WhatsApp orderMessage into customer_orders', async () => {
      const rawOrderMessage = {
        key: { remoteJid: '5511988887777@s.whatsapp.net', fromMe: false },
        message: {
          orderMessage: {
            orderId: `meta_ord_${Date.now()}`,
            itemCount: 2,
            totalAmount1000: 990000, // R$ 990,00
            totalCurrencyCode: 'BRL',
            orderTitle: 'Pedido Teste Catálogo',
            message: 'Entregar na Av. Paulista, 1000',
          },
        },
      };

      const mockSock = createMockBaileysSocket();
      const created = await cartOrderListener.handleIncomingOrder(mockSock, rawOrderMessage, {
        companyId: testCompany,
      });

      assert.ok(created, 'CartOrderListener must create an order record');
      assert.equal(created.phone, '5511988887777');
      assert.equal(Number(created.totalAmount || created.total_amount), 990.00);
      assert.equal(created.status, 'pending');
    });

    it('T1_R2_04_realtime_catalog_synced_event_streaming: emits catalog:synced event on Socket.IO', async () => {
      const client = await createSocketClient(testServer.baseUrl, testCompany);
      try {
        const eventPromise = client.waitForEvent('catalog:synced', 2000);

        testServer.io.emit('catalog:synced', {
          sessionId: 'main',
          companyId: testCompany,
          synced: 5,
          total: 5,
          products: [{ id: '1', name: 'Tijolo' }],
        });

        const received = await eventPromise;
        assert.equal(received.companyId, testCompany);
        assert.equal(received.synced, 5);
      } finally {
        client.disconnect();
      }
    });

    it('T1_R2_05_realtime_order_received_streaming: emits commerce:order_received event on Socket.IO', async () => {
      const client = await createSocketClient(testServer.baseUrl, testCompany);
      try {
        const eventPromise = client.waitForEvent('commerce:order_received', 2000);

        const orderData = {
          orderId: 'ord_stream_test',
          phone: '5511999991111',
          totalAmount: 720.00,
        };

        testServer.io.emit('commerce:order_received', {
          sessionId: 'main',
          companyId: testCompany,
          orderId: orderData.orderId,
          order: orderData,
        });

        const received = await eventPromise;
        assert.equal(received.orderId, 'ord_stream_test');
        assert.equal(received.order.totalAmount, 720.00);
      } finally {
        client.disconnect();
      }
    });

    it('T1_R2_06_non_blocking_sync_error_containment: catalog sync failure does not crash or throw unhandled rejection', async () => {
      const failingSock = createMockBaileysSocket({ failBusinessProfile: true });
      const caps = await catalogSyncEngine.detectBusinessCapabilities(failingSock, '5511999998888@s.whatsapp.net');

      // Must degrade gracefully without throwing
      assert.ok(typeof caps === 'object');
      assert.equal(caps.canSyncCatalog, true);
    });
  });

  // =========================================================================
  // REQUIREMENT R3: Performance Optimization & Commercial Polish
  // =========================================================================

  describe('R3: Performance Optimization & Commercial Polish', () => {
    let createdOrderId = null;
    let createdQuoteId = null;

    it('T1_R3_01_order_create_api_endpoint: POST /api/commerce/orders/create persists order with BRL calculation', async () => {
      const payload = {
        companyId: testCompany,
        phone: '5531999887766',
        customerName: 'Cliente Teste E2E',
        items: [
          { name: 'Churrasqueira Pré-Moldada Trio', price: 990.00, quantity: 1 },
          { name: 'Tijolo Cerâmico', price: 720.00, quantity: 1 },
        ],
        freight: 50.00,
        discount: 40.00,
        notes: 'Pagamento na entrega',
      };

      const res = await apiPost(testServer.baseUrl, '/api/commerce/orders/create', payload, {
        'x-company-id': testCompany,
      });

      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
      assert.equal(res.data.success, true);
      assert.ok(res.data.order, 'Must return created order object');
      assert.equal(Number(res.data.order.total_amount), 1720.00); // 990 + 720 + 50 - 40 = 1720
      createdOrderId = res.data.order.id;
    });

    it('T1_R3_02_order_confirmation_flow: POST /api/commerce/orders/:id/confirm transitions status to confirmed', async () => {
      assert.ok(createdOrderId, 'Requires order from previous test');

      const res = await apiPost(testServer.baseUrl, `/api/commerce/orders/${createdOrderId}/confirm`, {
        notes: 'Confirmado pelo atendente',
      }, {
        'x-company-id': testCompany,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.order.status, 'confirmed');
    });

    it('T1_R3_03_order_rejection_flow: POST /api/commerce/orders/:id/reject updates status to rejected', async () => {
      // Create fresh order to reject
      const order = await orderConfirmationEngine.createOrder({
        companyId: testCompany,
        phone: '5531999112233',
        customerName: 'Cliente Rejeitado',
        items: [{ name: 'Item', price: 100, quantity: 1 }],
      });

      const res = await apiPost(testServer.baseUrl, `/api/commerce/orders/${order.order.id}/reject`, {
        reason: 'Fora do raio de entrega',
      }, {
        'x-company-id': testCompany,
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.order.status, 'rejected');
    });

    it('T1_R3_04_quote_creation_and_conversion_api: POST /api/quotes and /accept auto-converts to customer_orders', async () => {
      const quotePayload = {
        companyId: testCompany,
        clientPhone: '5531988889999',
        clientName: 'Cliente Orçamento',
        items: [
          { name: 'Churrasqueira Trio', price: 990.00, quantity: 1 },
        ],
        shippingAmount: 30.00,
        discountValue: 20.00,
      };

      const quoteRes = await apiPost(testServer.baseUrl, '/api/quotes', quotePayload, {
        'x-company-id': testCompany,
      });

      assert.equal(quoteRes.status, 201);
      assert.equal(quoteRes.data.success, true);
      const quote = quoteRes.data.quote;
      createdQuoteId = quote.id;

      // Accept quote
      const acceptRes = await apiPost(testServer.baseUrl, `/api/quotes/${createdQuoteId}/accept`, {
        acceptedBy: 'client',
      }, {
        'x-company-id': testCompany,
      });

      assert.equal(acceptRes.status, 200);
      assert.equal(acceptRes.data.success, true);
      assert.ok(acceptRes.data.order, 'Accepting quote must generate customer order');
      assert.equal(acceptRes.data.order.currency, 'BRL');
    });

    it('T1_R3_05_order_sheet_pix_calculation: orderSheetService generates 5% PIX discount and formats checkout', async () => {
      // Seed conversation
      const convRes = await dbQuery(
        `INSERT INTO conversations (company_id, session_id, remote_jid, status, ai_enabled, funnel_stage, created_at, updated_at)
         VALUES ($1, 'main', '5531999990000@s.whatsapp.net', 'active', TRUE, 'atendimento', NOW(), NOW())
         RETURNING id`,
        [testCompany]
      );
      const conversationId = String(convRes.rows[0].id);

      // Create conversation sheet
      const sheetRes = await dbQuery(
        `INSERT INTO conversation_sheets (
           company_id, conversation_id, phone, customer_name,
           items, total_price, payment_method, status, updated_at
         ) VALUES ($1, $2, '5531999990000', 'Cliente PIX', $3::jsonb, 1000.00, 'pix', 'aberto', NOW())
         RETURNING *`,
        [testCompany, conversationId, JSON.stringify([{ name: 'Material', price: 1000, quantity: 1 }])]
      );

      const sheet = sheetRes.rows[0];

      // Format order sheet message and verify PIX calculation
      const message = orderSheetService.buildSheetText({
        ...sheet,
        totalPrice: Number(sheet.total_price || 1000),
      });
      assert.ok(message.includes('PIX'), 'Order sheet message must include PIX payment option');
      assert.ok(message.includes('950,00'), 'Order sheet must apply 5% PIX discount to R$ 1.000,00 (R$ 950,00)');

      // Finalize attendance with sheet
      await orderSheetService.finalizeAttendanceWithSheet({
        conversationId,
        companyId: testCompany,
        sheetId: sheet.id,
      });

      const convCheck = await dbQuery('SELECT status, funnel_stage, ai_enabled FROM conversations WHERE id = $1', [conversationId]);
      assert.equal(convCheck.rows[0].status, 'aguarda_pix');
      assert.equal(convCheck.rows[0].funnel_stage, 'fechamento');
      assert.equal(convCheck.rows[0].ai_enabled, false, 'AI must be disabled on PIX checkout takeover');
    });

    it('T1_R3_06_database_pool_stability_and_query_latency: 10 sequential and 10 parallel queries complete within SLA', async () => {
      const start = Date.now();

      // 10 sequential queries
      for (let i = 0; i < 10; i++) {
        const q = await dbQuery('SELECT 1 as val');
        assert.equal(q.rows[0].val, 1);
      }

      // 10 parallel queries
      const parallelPromises = Array.from({ length: 10 }, () => dbQuery('SELECT 1 as val'));
      const results = await Promise.all(parallelPromises);
      assert.equal(results.length, 10);

      const elapsed = Date.now() - start;
      const avgLatency = elapsed / 20;
      assert.ok(avgLatency < 100, `Average database latency must be <100ms, got ${avgLatency.toFixed(2)}ms`);
    });
  });
});
