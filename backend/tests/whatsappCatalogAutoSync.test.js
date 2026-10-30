const test = require('node:test');
const assert = require('node:assert/strict');
const productsController = require('../src/api/controllers/productsController');
const productRepository = require('../src/data/repositories/productRepository');

test('WhatsApp Catalog Auto-Sync: exports syncWhatsAppCatalogInternal function', () => {
  assert.strictEqual(typeof productsController.syncWhatsAppCatalogInternal, 'function');
});

test('WhatsApp Catalog Auto-Sync: baseline store products and broadcasts catalog:synced event', async () => {
  const events = [];
  global.io = {
    emit: (event, payload) => {
      events.push({ event, payload });
    },
  };

  const result = await productsController.syncWhatsAppCatalogInternal({
    companyId: 'test_comp_auto',
    sessionId: 'test_session_auto',
  });

  assert.strictEqual(result.success, true);
  assert.ok(result.total >= 6, `Expected at least 6 products, got ${result.total}`);

  const broadcast = events.find((e) => e.event === 'catalog:synced');
  assert.ok(broadcast, 'Expected catalog:synced event to be emitted via Socket.IO');
  assert.strictEqual(broadcast.payload.companyId, 'test_comp_auto');
  assert.strictEqual(broadcast.payload.sessionId, 'test_session_auto');
});

test('WhatsApp Catalog Auto-Sync: queries sock.getCatalog({ limit: 50 }) and imports items', async () => {
  let catalogRequestedWith = null;
  const mockProducts = [
    {
      id: 'wa_prod_101',
      name: 'Tubo PVC 100mm Tigre',
      retailerId: 'PVC-100',
      description: 'Tubo de esgoto 100mm barra 6 metros',
      price: 85.5,
      url: 'https://wa.me/p/101',
      imageUrls: ['https://example.com/pvc.png'],
    },
  ];

  const mockSock = {
    user: { id: '553193672075:0@s.whatsapp.net' },
    getCatalog: async (opts) => {
      catalogRequestedWith = opts;
      return { products: mockProducts };
    },
  };

  const result = await productsController.syncWhatsAppCatalogInternal({
    companyId: 'test_comp_wa_import',
    sessionId: 'wa_session_import',
    sock: mockSock,
  });

  assert.strictEqual(catalogRequestedWith.limit, 50);
  assert.strictEqual(catalogRequestedWith.jid, '553193672075@s.whatsapp.net');
  assert.strictEqual(result.success, true);
  assert.ok(result.synced >= 1, `Expected at least 1 item synced, got ${result.synced}`);

  const products = await productRepository.listProducts({ companyId: 'test_comp_wa_import' });
  const importedItem = products.find((p) => p.name === 'Tubo PVC 100mm Tigre');
  assert.ok(importedItem, 'Expected imported product to exist in repository');
  assert.strictEqual(importedItem.price, '85.50');
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
