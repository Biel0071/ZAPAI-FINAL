'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const zaiEngine = require('../services/zai');
const protocolIntelligence = require('../services/zai/ProtocolIntelligence');
const compatibilityEngine = require('../services/zai/CompatibilityEngine');
const cartOrderListener = require('../services/commerce/CartOrderListener');

test('ZAI Communication Engine — Core Architecture & Commerce Certification', async (t) => {
  await t.test('1. ZAI Communication Engine initializes with all required subsystems', () => {
    assert.ok(zaiEngine, 'ZAI Engine should be defined');
    assert.equal(zaiEngine.name, 'ZAI Communication Engine');
    assert.ok(zaiEngine.orchestrator, 'Orchestrator core must be present');
    assert.ok(zaiEngine.protocolIntelligence, 'Protocol Intelligence must be present');
    assert.ok(zaiEngine.compatibilityEngine, 'Compatibility Engine must be present');
    assert.ok(zaiEngine.capabilities, 'Capability Registry must be present');
    assert.ok(zaiEngine.transports, 'Transport Registry must be present');
    assert.ok(zaiEngine.webBridge, 'Web Bridge Manager must be present');
    assert.ok(zaiEngine.commerce, 'Commerce Engine must be present');
  });

  await t.test('2. Protocol Intelligence correctly detects and extracts productMessage payload', () => {
    const rawProductMessage = {
      productMessage: {
        product: {
          productId: 'prod_tijolo_12_furos',
          title: 'TIJOLO 12 FUROS',
          priceAmount1000: '900000',
          currencyCode: 'BRL',
        },
        businessOwnerJid: '553193672075@s.whatsapp.net',
      }
    };

    const analysis = protocolIntelligence.inspectMessagePayload(rawProductMessage);
    assert.equal(analysis.isCommercial, true);
    assert.equal(analysis.protocolType, 'productMessage');
    assert.equal(analysis.hasProduct, true);
    assert.equal(analysis.details.productId, 'prod_tijolo_12_furos');
    assert.equal(analysis.details.title, 'TIJOLO 12 FUROS');
    assert.equal(analysis.details.priceAmount1000, '900000');
  });

  await t.test('3. Protocol Intelligence correctly detects and extracts orderMessage payload', () => {
    const rawOrderMessage = {
      orderMessage: {
        orderId: 'ord_meta_98127391',
        token: 'token_sample_abc123',
        itemCount: 3,
        totalAmount1000: 2700000,
        totalCurrencyCode: 'BRL',
        orderTitle: 'Pedido Materiais de Construção',
        sellerJid: '553193672075@s.whatsapp.net',
        message: 'Entregar com urgência',
      }
    };

    const analysis = protocolIntelligence.inspectMessagePayload(rawOrderMessage);
    assert.equal(analysis.isCommercial, true);
    assert.equal(analysis.protocolType, 'orderMessage');
    assert.equal(analysis.hasOrder, true);
    assert.equal(analysis.details.orderId, 'ord_meta_98127391');
    assert.equal(analysis.details.itemCount, 3);
    assert.equal(analysis.details.totalAmount1000, 2700000);
  });

  await t.test('4. Compatibility Engine normalizes catalog product for Baileys protobuf injection', () => {
    const internalProduct = {
      id: 'prod_cimento_cp3',
      name: 'CIMENTO CP-III 50KG (RS)',
      price: 37.50,
      description: 'Cimento resistente a sulfatos',
      images: ['/assets/catalog/cimento_cp3.png'],
      code: 'CIMENTO_CP3',
    };

    const normalized = compatibilityEngine.normalizeProductPayload(internalProduct, 'Baileys');
    assert.equal(normalized.productId, 'prod_cimento_cp3');
    assert.equal(normalized.title, 'CIMENTO CP-III 50KG (RS)');
    assert.equal(normalized.priceAmount1000, '37500');
    assert.equal(normalized.currencyCode, 'BRL');
    assert.equal(normalized.retailerId, 'CIMENTO_CP3');
    assert.deepEqual(normalized.images, ['/assets/catalog/cimento_cp3.png']);
  });

  await t.test('5. Capability Registry validates operations across registered engines', () => {
    const cap = zaiEngine.capabilities;
    assert.ok(cap.canExecute(cap.ENGINES.BAILEYS, cap.OPERATIONS.SEND_TEXT), 'Baileys should support SEND_TEXT');
    assert.ok(cap.canExecute(cap.ENGINES.BAILEYS, cap.OPERATIONS.SEND_PRODUCT), 'Baileys should support SEND_PRODUCT');
    assert.ok(cap.canExecute(cap.ENGINES.WHATSAPP_WEB_BRIDGE, cap.OPERATIONS.GET_CATALOG, { webBridgeAuthenticated: true }), 'WhatsAppWebBridge should support GET_CATALOG');
  });

  await t.test('6. CartOrderListener unrolls incoming order into standardized CRM structure', async () => {
    const fakeSock = {
      getOrderDetails: async (orderId, token) => ({
        products: [
          { id: 'item_1', name: 'TIJOLO 12 FUROS', quantity: 2, price: 900.00 },
          { id: 'item_2', name: 'CIMENTO CP-III', quantity: 5, price: 37.50 },
        ],
        price: { total: 1987.50 }
      })
    };

    const fakeIncomingMsg = {
      key: { remoteJid: '5531987654321@s.whatsapp.net', id: 'WAMID_ORDER_123' },
      message: {
        orderMessage: {
          orderId: 'test_order_999',
          token: Buffer.from('token_val').toString('base64'),
          itemCount: 2,
          totalAmount1000: 1987500,
          totalCurrencyCode: 'BRL',
          orderTitle: 'Pedido Cliente VIP',
          sellerJid: '553193672075@s.whatsapp.net',
          message: 'Entregar na obra',
        }
      }
    };

    // Process order payload without crashing
    const result = await cartOrderListener.handleIncomingOrder(fakeSock, fakeIncomingMsg, {
      companyId: 'test_company',
      sessionId: 'main',
    });

    assert.ok(result, 'Result should be returned');
    assert.equal(result.orderId, 'test_order_999');
    assert.equal(result.phone, '5531987654321');
    assert.equal(result.itemCount, 2);
    assert.equal(result.totalAmount, 1987.50);
    assert.equal(result.items.length, 2);
  });
});
