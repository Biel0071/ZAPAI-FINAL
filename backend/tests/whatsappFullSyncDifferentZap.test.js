const test = require('node:test');
const assert = require('node:assert/strict');
const productsController = require('../src/api/controllers/productsController');
const productRepository = require('../src/data/repositories/productRepository');
const { HistoryRepository } = require('../src/data/repositories/historyRepository');
const { HistorySync } = require('../services/whatsapp/historySync');
const { sendMediaMessage } = require('../services/whatsapp/outbound/senders');
const { pool } = require('../src/infrastructure/config/database');

test('WhatsApp Full Sync: HistoryRepository.owner returns company or default without throwing', async () => {
  const repo = new HistoryRepository(pool);
  const company = await repo.owner('non_existent_random_session_12345');
  assert.strictEqual(typeof company, 'string');
  assert.ok(company.length > 0);
});

test('WhatsApp Full Sync: HistorySync.receive processes with fallbackCompanyId without throwing', async () => {
  const hSync = new HistorySync();
  const testSession = 'test_sess_full_sync';
  const testCompany = 'test_comp_full_sync';

  // Should not throw even if session record doesn't exist in sessions table
  await assert.doesNotReject(async () => {
    await hSync.receive(
      testSession,
      [],
      [{ id: '553199999999@s.whatsapp.net', name: 'Cliente Teste', archived: false }],
      'test_origin',
      testCompany
    );
  });
});

test('WhatsApp Full Sync: syncWhatsAppCatalogInternal with forceClean and connected account phone', async () => {
  const mockSock = {
    user: { id: '553193672075:1@s.whatsapp.net' },
    getCatalog: async () => ({
      products: [
        {
          id: 'prod_betoneira_live',
          name: 'BETONEIRA - CSM - 400L REAL',
          retailerId: 'BET-400',
          description: 'Betoneira oficial Depósito Vista Alegre',
          price: 3499.00,
          imageUrls: ['/assets/catalog/betoneira_csm_400l.png'],
        },
      ],
    }),
  };

  const testCompany = 'test_comp_switch_zap';
  const testSession = 'test_sess_switch_zap';

  const result = await productsController.syncWhatsAppCatalogInternal({
    companyId: testCompany,
    sessionId: testSession,
    sock: mockSock,
    forceClean: true,
  });

  assert.strictEqual(result.success, true);
  assert.ok(result.total >= 1);

  const products = await productRepository.listProducts({ companyId: testCompany });
  const betoneira = products.find((p) => p.name === 'BETONEIRA - CSM - 400L REAL');
  assert.ok(betoneira, 'Expected betoneira to be saved in repository');
  assert.ok(betoneira.whatsapp_url.includes('553193672075'), `Expected url to include connected phone, got ${betoneira.whatsapp_url}`);
});

test('WhatsApp Full Sync: Outbound sendMediaMessage handles product with image or text fallback', async () => {
  let imageSent = null;
  let textSent = null;

  global.whatsappSession = { connected: true };

  const mockSock = {
    user: { id: '553193672075:1@s.whatsapp.net' },
    ws: { readyState: 1 },
    sendMessage: async (jid, content) => {
      if (content.image) {
        imageSent = { jid, content };
      } else if (content.text) {
        textSent = { jid, content };
      }
      return { key: { id: 'msg_123' } };
    },
  };

  // Test 1: with image path -> sends image with caption
  await sendMediaMessage(mockSock, '553199999999', 'product', 'https://example.com/betoneira.png', {
    caption: '*BETONEIRA 400L*\nPreço: R$ 3.499,00',
  });

  assert.ok(imageSent, 'Expected sendMediaMessage to send image for product with image URL');
  assert.strictEqual(imageSent.content.caption, '*BETONEIRA 400L*\nPreço: R$ 3.499,00');

  // Test 2: without image -> fallbacks to text message
  await sendMediaMessage(mockSock, '553199999999', 'product', '', {
    caption: '*TIJOLO 8 FUROS*\nPreço: R$ 780,00',
  });

  assert.ok(textSent, 'Expected sendMediaMessage to send text message for product without image');
  assert.strictEqual(textSent.content.text, '*TIJOLO 8 FUROS*\nPreço: R$ 780,00');
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
