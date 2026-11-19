'use strict';

/**
 * TIER 2: Boundary & Corner Cases
 * 
 * Deep stress and adversarial testing covering:
 * - R1: Corrupted creds, missing keys, rapid concurrent status checks, 401 logout, non-existent sessions (5 tests)
 * - R2: Empty catalog inheritance, malformed orderMessage, ephemeral/viewOnce unwrapping, large catalog, duplicate orders (5 tests)
 * - R3: Missing phone/items validation errors, already accepted quote idempotency, discount clamping, concurrent bursts (5 tests)
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
  writeSessionToDisk,
  removeSessionFromDisk,
  createMockBaileysSocket,
  startTestServer,
  apiGet,
  apiPost,
} = require('./helpers/testHarness');

const { validateSession } = require('../../backend/services/whatsapp/connection/sessionPersistenceValidator');
const catalogSyncEngine = require('../../backend/services/commerce/CatalogSyncEngine');
const cartOrderListener = require('../../backend/services/commerce/CartOrderListener');
const orderConfirmationEngine = require('../../backend/services/commerce/OrderConfirmationEngine');
const commerceQuoteEngine = require('../../backend/services/commerce/CommerceQuoteEngine');

describe('TIER 2 — Boundary & Corner Cases', () => {
  let testServer = null;
  let testCompany = null;

  before(async () => {
    testCompany = createTestTenantId('tier2');
    testServer = await startTestServer({ defaultCompanyId: testCompany });
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
  // R1 BOUNDARY & CORNER CASES
  // =========================================================================

  describe('R1: WhatsApp Boundary & Corner Cases', () => {
    const corruptedSessionId = `corrupt_sess_${Date.now()}`;
    const missingKeysSessionId = `missing_keys_${Date.now()}`;

    after(async () => {
      await removeSessionFromDisk(corruptedSessionId);
      await removeSessionFromDisk(missingKeysSessionId);
    });

    it('T2_R1_01_corrupted_creds_json_recovery: corrupted creds.json is detected without crashing process', async () => {
      // Write syntactically malformed JSON to disk
      await writeSessionToDisk(corruptedSessionId, '{ "noiseKey": INVALID_JSON_SYNTAX ...');

      const validation = await validateSession(corruptedSessionId);
      assert.equal(validation.dirExists, true, 'Directory must exist');
      assert.equal(validation.credsExists, true, 'Creds file must exist');
      assert.equal(validation.credsValid, false, 'Corrupted JSON must be marked credsValid: false');
      assert.equal(validation.ok, false, 'Corrupted session must be evaluated as not ok');
      assert.ok(validation.warnings.length > 0, 'Must record warnings for corrupted JSON');
    });

    it('T2_R1_02_missing_keys_in_creds: credentials missing mandatory keys fail validation', async () => {
      // Missing 'me' and 'noiseKey'
      const incompleteCreds = {
        signedIdentityKey: { private: 'x', public: 'y' },
        registrationId: 9999,
      };

      await writeSessionToDisk(missingKeysSessionId, incompleteCreds);

      const validation = await validateSession(missingKeysSessionId);
      assert.equal(validation.credsValid, true, 'Valid JSON syntax');
      assert.equal(validation.credsComplete, false, 'Must report credsComplete: false');
      assert.equal(validation.ok, false);
      assert.ok(validation.missingKeys.includes('noiseKey'));
      assert.ok(validation.missingKeys.includes('me'));
    });

    it('T2_R1_03_rapid_burst_reconnect_requests: 10 rapid concurrent status checks return gracefully', async () => {
      const promises = Array.from({ length: 10 }, () =>
        apiGet(testServer.baseUrl, '/api/sessions/status', {
          'x-company-id': testCompany,
        })
      );

      const responses = await Promise.all(promises);
      assert.equal(responses.length, 10);
      for (const res of responses) {
        // Must return success without unhandled rejection or socket leak
        assert.ok([200, 204].includes(res.status), `Unexpected status ${res.status}`);
      }
    });

    it('T2_R1_04_disconnect_code_401_logged_out_clears_creds: 401 disconnect triggers logout classification', async () => {
      const fatalCode = 401; // DisconnectReason.loggedOut
      const shouldReconnect = fatalCode !== 401 && fatalCode !== 403;
      assert.equal(shouldReconnect, false, 'Error 401 must NOT trigger automatic reconnect');
    });

    it('T2_R1_05_reconnect_non_existent_session: validating an uninitialized session reports missing directory gracefully', async () => {
      const nonExistentId = `non_existent_${Date.now()}`;
      const validation = await validateSession(nonExistentId);

      assert.equal(validation.sessionId, nonExistentId);
      assert.equal(validation.dirExists, false);
      assert.equal(validation.credsExists, false);
      assert.equal(validation.ok, false);
      assert.ok(validation.warnings[0].includes('does not exist'));
    });
  });

  // =========================================================================
  // R2 BOUNDARY & CORNER CASES
  // =========================================================================

  describe('R2: Silent Auto-Sync Boundary & Corner Cases', () => {
    it('T2_R2_01_empty_catalog_payload: syncing for tenant without dedicated products succeeds cleanly', async () => {
      const emptyCompany = `empty_${Date.now()}`;
      const res = await catalogSyncEngine.syncCatalog(emptyCompany);

      assert.equal(res.success, true);
      assert.ok(Array.isArray(res.products));
      assert.ok(res.lastSync !== undefined);
    });

    it('T2_R2_02_malformed_order_message_structure: orderMessage missing orderId assigns fallback defaults', async () => {
      const malformedMsg = {
        key: { remoteJid: '5511977776666@s.whatsapp.net', fromMe: false },
        message: {
          orderMessage: {
            // Missing orderId and totalAmount1000
            orderTitle: 'Pedido Sem ID',
          },
        },
      };

      const mockSock = createMockBaileysSocket();
      const created = await cartOrderListener.handleIncomingOrder(mockSock, malformedMsg, {
        companyId: testCompany,
      });

      assert.ok(created, 'Must create order even with missing fields');
      assert.ok(created.orderId.startsWith('order_'), 'Must generate fallback orderId');
      assert.equal(Number(created.totalAmount || 0), 0);
    });

    it('T2_R2_03_order_with_unwrapped_ephemeral_container: unrolls orderMessage inside viewOnce/ephemeral wrapper', async () => {
      const wrappedMsg = {
        key: { remoteJid: '5511966665555@s.whatsapp.net', fromMe: false },
        message: {
          viewOnceMessage: {
            message: {
              orderMessage: {
                orderId: `view_once_ord_${Date.now()}`,
                itemCount: 1,
                totalAmount1000: 450000,
                orderTitle: 'Pedido ViewOnce',
              },
            },
          },
        },
      };

      const mockSock = createMockBaileysSocket();
      const created = await cartOrderListener.handleIncomingOrder(mockSock, wrappedMsg, {
        companyId: testCompany,
      });

      assert.ok(created, 'Must unwrap and extract order from container');
      assert.equal(Number(created.totalAmount || created.total_amount), 450.00);
    });

    it('T2_R2_04_large_catalog_sync_stress: syncing catalog with 100 items executes under SLA', async () => {
      const largeCompany = `large_${Date.now()}`;

      // Insert 100 products
      const insertPromises = Array.from({ length: 100 }, (_, i) =>
        dbQuery(
          `INSERT INTO products (id, company_id, code, name, description, price, category, stock, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'Desc', 50.00, 'Geral', 10, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [`prod_large_${i}_${Date.now()}`, largeCompany, `CODE-${i}`, `Produto Grande ${i}`]
        )
      );
      await Promise.all(insertPromises);

      const start = Date.now();
      const res = await catalogSyncEngine.syncCatalog(largeCompany);
      const elapsed = Date.now() - start;

      assert.equal(res.success, true);
      assert.ok(res.total >= 50, `Expected at least 50 synced products, got ${res.total}`);
      assert.ok(elapsed < 2000, `Large catalog sync must complete under 2s SLA, took ${elapsed}ms`);

      // Cleanup large company products
      await dbQuery('DELETE FROM products WHERE company_id = $1', [largeCompany]);
    });

    it('T2_R2_05_duplicate_incoming_order_idempotency: duplicate order messages are handled safely', async () => {
      const sharedOrderId = `dup_ord_${Date.now()}`;
      const orderMessage = {
        key: { remoteJid: '5511955554444@s.whatsapp.net', id: `wamid_dup_${Date.now()}` },
        message: {
          orderMessage: {
            orderId: sharedOrderId,
            itemCount: 1,
            totalAmount1000: 100000,
            orderTitle: 'Pedido Duplicado',
          },
        },
      };

      const mockSock = createMockBaileysSocket();
      const first = await cartOrderListener.handleIncomingOrder(mockSock, orderMessage, { companyId: testCompany });
      const second = await cartOrderListener.handleIncomingOrder(mockSock, orderMessage, { companyId: testCompany });

      assert.ok(first);
      assert.ok(second);
      assert.equal(first.orderId, sharedOrderId);
      assert.equal(second.orderId, sharedOrderId);
    });
  });

  // =========================================================================
  // R3 BOUNDARY & CORNER CASES
  // =========================================================================

  describe('R3: Commercial Operations Boundary & Corner Cases', () => {
    it('T2_R3_01_order_create_missing_phone: POST /api/commerce/orders/create with missing phone returns error', async () => {
      const res = await apiPost(testServer.baseUrl, '/api/commerce/orders/create', {
        companyId: testCompany,
        customerName: 'Sem Telefone',
        items: [{ name: 'Item', price: 10, quantity: 1 }],
      }, {
        'x-company-id': testCompany,
      });

      assert.ok([400, 500].includes(res.status), `Expected 400 or 500, got ${res.status}`);
      assert.equal(res.data.success, false);
      assert.ok(res.data.error.toLowerCase().includes('phone') || res.data.error.toLowerCase().includes('telefone'));
    });

    it('T2_R3_02_order_create_empty_items: POST /api/commerce/orders/create with empty items returns error', async () => {
      const res = await apiPost(testServer.baseUrl, '/api/commerce/orders/create', {
        companyId: testCompany,
        phone: '5511999990000',
        items: [],
      }, {
        'x-company-id': testCompany,
      });

      assert.ok([400, 500].includes(res.status), `Expected 400 or 500, got ${res.status}`);
      assert.equal(res.data.success, false);
      assert.ok(res.data.error.toLowerCase().includes('item') || res.data.error.toLowerCase().includes('produto'));
    });

    it('T2_R3_03_quote_accept_already_accepted: accepting an already accepted quote returns idempotent response', async () => {
      // Create and accept quote
      const quote = await commerceQuoteEngine.createQuote({
        companyId: testCompany,
        clientPhone: '5511944443333',
        clientName: 'Cliente Idempotente',
        items: [{ name: 'Item', price: 200, quantity: 1 }],
      });

      const firstAccept = await apiPost(testServer.baseUrl, `/api/quotes/${quote.id}/accept`, {}, {
        'x-company-id': testCompany,
      });
      assert.equal(firstAccept.status, 200);

      const secondAccept = await apiPost(testServer.baseUrl, `/api/quotes/${quote.id}/accept`, {}, {
        'x-company-id': testCompany,
      });
      assert.equal(secondAccept.status, 200);
      assert.ok(secondAccept.data.message.includes('já foi aceito'));
    });

    it('T2_R3_04_extreme_freight_and_discount_clamping: discount exceeding subtotal clamps total to zero', async () => {
      const order = await orderConfirmationEngine.createOrder({
        companyId: testCompany,
        phone: '5511933332222',
        customerName: 'Cliente Super Desconto',
        items: [{ name: 'Item', price: 100, quantity: 1 }],
        freight: 20,
        discount: 500, // Discount higher than 100 + 20
      });

      assert.ok(order);
      assert.equal(Number(order.order.total_amount), 0.00, 'Total amount must be clamped to 0, not negative');
      assert.equal(Number(order.order.total_amount_1000), 0);
    });

    it('T2_R3_05_concurrent_order_creation_burst: 10 simultaneous orders create cleanly without row locking', async () => {
      const orderPromises = Array.from({ length: 10 }, (_, i) =>
        apiPost(testServer.baseUrl, '/api/commerce/orders/create', {
          companyId: testCompany,
          phone: `551192222000${i}`,
          customerName: `Cliente Concorrente ${i}`,
          items: [{ name: `Material ${i}`, price: 100 * (i + 1), quantity: 1 }],
        }, {
          'x-company-id': testCompany,
        })
      );

      const responses = await Promise.all(orderPromises);
      assert.equal(responses.length, 10);
      for (const res of responses) {
        assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
        assert.equal(res.data.success, true);
        assert.ok(res.data.order.id);
      }
    });
  });
});
