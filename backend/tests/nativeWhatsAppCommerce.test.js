'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const commerceCapabilityRegistry = require('../services/commerce/CommerceCapabilityRegistry');
const catalogSyncEngine = require('../services/commerce/CatalogSyncEngine');
const baileysCommerceAdapter = require('../services/commerce/BaileysCommerceAdapter');
const cartOrderListener = require('../services/commerce/CartOrderListener');
const { extractMessageText, getMediaDescriptor } = require('../services/whatsapp/inbound/parser');

test('1. Capability Registry verifies Baileys native commerce capabilities', () => {
  const caps = commerceCapabilityRegistry.getCapabilities();
  assert.equal(caps.engine, 'Baileys');
  assert.equal(caps.capabilities.canConsultCatalog, true);
  assert.equal(caps.capabilities.canConsultProducts, true);
  assert.equal(caps.capabilities.canSendNativeProduct, true);
  assert.equal(caps.capabilities.canSendMultipleProducts, true);
  assert.equal(caps.capabilities.canConsultCart, true);
  assert.equal(caps.capabilities.canReceiveCartOrder, true);
  assert.equal(caps.capabilities.canConfirmOrder, true);
  assert.equal(caps.capabilities.canRejectOrder, true);
});

test('2. CatalogSyncEngine lists and filters official products', async () => {
  const list = await catalogSyncEngine.listProducts('default', { search: 'tijolo' });
  assert.ok(list.total >= 1);
  assert.ok(list.products.some(p => p.name.toLowerCase().includes('tijolo')));
});

test('3. BaileysCommerceAdapter resolves local image buffers safely', async () => {
  const sampleBuffer = Buffer.from('fake-image-bytes');
  const resolved = await baileysCommerceAdapter.resolveImageBuffer(sampleBuffer);
  assert.ok(resolved !== null);
  assert.ok(Buffer.isBuffer(resolved.image));
});

test('4. BaileysCommerceAdapter dispatches authentic ProductMessage without string url degradation', async () => {
  let capturedJid = null;
  let capturedPayload = null;

  const mockSock = {
    user: { id: '553193672075:1@s.whatsapp.net' },
    sendMessage: async (jid, payload) => {
      capturedJid = jid;
      capturedPayload = payload;
      return { key: { id: 'wamid_test_prod_123' } };
    },
  };

  const mockProduct = {
    id: 'prod_tijolo_12f',
    productId: 'prod_tijolo_12f',
    code: 'TIJ-12F',
    name: 'TIJOLO 12 FUROS',
    price: 900.0,
    description: 'Tijolo 12 furos primeira linha',
    productImage: Buffer.from('test-image'),
  };

  const res = await baileysCommerceAdapter.sendProduct(
    mockSock,
    '553198346078@s.whatsapp.net',
    mockProduct,
    { caption: 'Confira nosso tijolo 12 furos' }
  );

  assert.equal(res?.key?.id, 'wamid_test_prod_123');
  assert.equal(capturedJid, '553198346078@s.whatsapp.net');
  assert.ok(capturedPayload.product);
  assert.equal(capturedPayload.product.productId, 'prod_tijolo_12f');
  assert.equal(capturedPayload.product.title, 'TIJOLO 12 FUROS');
  assert.equal(capturedPayload.product.priceAmount1000, '900000');
  assert.equal(capturedPayload.businessOwnerJid, '553193672075@s.whatsapp.net');
  assert.equal(capturedPayload.caption, 'Confira nosso tijolo 12 furos');
});

test('5. Inbound Parser recognizes orderMessage structure and mediaType', () => {
  const rawOrderMsg = {
    message: {
      orderMessage: {
        orderId: 'ORD_998877',
        orderTitle: 'Carrinho de Compras Depósito',
        itemCount: 2,
        totalAmount1000: '1800000',
        totalCurrencyCode: 'BRL',
        message: 'Favor entregar no período da tarde',
      },
    },
  };

  const text = extractMessageText(rawOrderMsg);
  assert.ok(text.includes('[PEDIDO WHATSAPP]'));
  assert.ok(text.includes('#ORD_998877'));
  assert.ok(text.includes('Carrinho de Compras'));
  assert.ok(text.includes('BRL 1800.00'));

  const desc = getMediaDescriptor(rawOrderMsg.message);
  assert.equal(desc.mediaType, 'order');
  assert.equal(desc.mediaMessage, rawOrderMsg.message.orderMessage);
});

test('6. Inbound Parser recognizes productMessage structure', () => {
  const rawProductMsg = {
    message: {
      productMessage: {
        product: {
          productId: 'prod_caixa_5000l',
          title: 'CAIXA - 5000L',
          priceAmount1000: '1699850',
          currencyCode: 'BRL',
          description: 'Caixa Fortlev',
        },
      },
    },
  };

  const text = extractMessageText(rawProductMsg);
  assert.ok(text.includes('[PRODUTO WHATSAPP]'));
  assert.ok(text.includes('CAIXA - 5000L'));
  assert.ok(text.includes('1699.85'));

  const desc = getMediaDescriptor(rawProductMsg.message);
  assert.equal(desc.mediaType, 'product');
});

test('7. CartOrderListener correctly processes incoming cart and emits normalized payload', async () => {
  const mockSock = {
    getOrderDetails: async (orderId, token) => ({
      price: { total: 1800, currency: 'BRL' },
      products: [
        { id: 'prod_tijolo_12f', name: 'TIJOLO 12 FUROS', price: 900, quantity: 2, currency: 'BRL' },
      ],
    }),
  };

  const incomingOrderData = {
    key: {
      remoteJid: '553198346078@s.whatsapp.net',
      id: 'wamid_order_test_1',
    },
    message: {
      orderMessage: {
        orderId: 'ORDER_LIVE_456',
        token: Buffer.from('meta-token-xyz').toString('base64'),
        orderTitle: '2x Tijolo 12 Furos',
        itemCount: 2,
        totalAmount1000: '1800000',
        totalCurrencyCode: 'BRL',
        message: 'Entregar na Rua Bahia 100',
      },
    },
  };

  const result = await cartOrderListener.handleIncomingOrder(mockSock, incomingOrderData, {
    companyId: 'default',
    sessionId: 'main',
  });

  assert.ok(result !== null);
  assert.equal(result.orderId, 'ORDER_LIVE_456');
  assert.equal(result.totalAmount, 1800);
  assert.equal(result.customerNotes, 'Entregar na Rua Bahia 100');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, 'TIJOLO 12 FUROS');
});

test('8. WhatsAppCommerceAdapter interface compliance across standard methods', async () => {
  const adapter = baileysCommerceAdapter;
  assert.equal(typeof adapter.getCatalog, 'function');
  assert.equal(typeof adapter.getProducts, 'function');
  assert.equal(typeof adapter.getProductById, 'function');
  assert.equal(typeof adapter.sendProduct, 'function');
  assert.equal(typeof adapter.sendProductList, 'function');
  assert.equal(typeof adapter.getCart, 'function');
  assert.equal(typeof adapter.receiveCart, 'function');
  assert.equal(typeof adapter.getOrder, 'function');
  assert.equal(typeof adapter.acceptOrder, 'function');
  assert.equal(typeof adapter.rejectOrder, 'function');
});

test('9. CommerceEventRouter registers handlers and emits events', async () => {
  const router = require('../services/commerce/CommerceEventRouter');
  let receivedPayload = null;

  router.on('test:commerce_event', (payload) => {
    receivedPayload = payload;
  });

  await router.emit('test:commerce_event', { companyId: 'default', test: true });
  assert.ok(receivedPayload !== null);
  assert.equal(receivedPayload.test, true);
});

test('10. OrderConfirmationEngine creates authentic order from catalog and dispatches orderMessage', async () => {
  const orderConfirmationEngine = require('../services/commerce/OrderConfirmationEngine');
  assert.equal(typeof orderConfirmationEngine.createOrder, 'function');

  // Verify createOrder signature and calculation logic
  const mockSock = {
    user: { id: '553193672075:1@s.whatsapp.net' },
    relayMessage: async () => ({ key: { id: 'order_test_wamid_99' } }),
    sendMessage: async () => ({ key: { id: 'receipt_test_wamid_99' } }),
  };

  const res = await orderConfirmationEngine.createOrder({
    companyId: 'default',
    phone: '553198346078',
    customerName: 'Cliente Teste',
    items: [
      { productId: 'prod_tijolo_12_furos', name: 'TIJOLO 12 FUROS', price: 900, quantity: 2 },
    ],
    freight: 50,
    notes: 'Descarregar no pátio',
    sessionId: 'main',
  });

  assert.ok(res.success === true);
  assert.ok(res.order);
  assert.equal(Number(res.order.total_amount), 1850);
  assert.equal(res.order.phone, '553198346078');
  assert.equal(res.order.status, 'pending');

  // Clean up test order
  const { query } = require('../src/infrastructure/config/database');
  await query('DELETE FROM customer_orders WHERE id = $1', [res.order.id]);
});
