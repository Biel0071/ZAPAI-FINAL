const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mediaService = require('../services/enterprise/media-service');
const { resolveLocalMediaDiskPath } = require('../services/whatsapp/media/payload');
const { sendMediaMessage } = require('../services/whatsapp/outbound/senders');

test('Product Media Access: canAccessMedia permits /assets/ catalog paths', async () => {
  const allowed = await mediaService.canAccessMedia('/assets/catalog/betoneira_csm_400l.png', 'default');
  assert.strictEqual(allowed, true, 'Expected /assets/catalog/... to be allowed for all companies');

  const allowed2 = await mediaService.canAccessMedia('/assets/catalog/caixa_5000l.png', 'company_123');
  assert.strictEqual(allowed2, true, 'Expected /assets/catalog/... to be accessible');
});

test('Product Media Payload: resolveLocalMediaDiskPath finds catalog images on disk', () => {
  const diskPath = resolveLocalMediaDiskPath('/assets/catalog/betoneira_csm_400l.png');
  assert.ok(diskPath, 'Expected disk path to be resolved');
  assert.ok(diskPath.includes('betoneira_csm_400l.png'), 'Expected resolved path to match file name');
});

test('Product Outbound Dispatch: sendMediaMessage handles product type gracefully with mock socket', async () => {
  global.whatsappSession = { connected: true };
  let sentPayload = null;
  let sentJid = null;

  const mockSock = {
    user: { id: '553193672075:0@s.whatsapp.net' },
    ws: { readyState: 1 },
    onWhatsApp: async (jids) => [{ exists: true, jid: Array.isArray(jids) ? jids[0] : jids }],
    sendMessage: async (jid, message) => {
      sentJid = jid;
      sentPayload = message;
      return { key: { id: 'WA_MOCK_MSG_123' } };
    },
  };

  const result = await sendMediaMessage(
    mockSock,
    '553198346078',
    'product',
    '/assets/catalog/betoneira_csm_400l.png',
    {
      caption: 'BETONEIRA - CSM - 400L\nValor: R$ 3.499,00',
      fileName: 'betoneira_csm_400l.png',
    }
  );

  assert.ok(result?.key?.id, 'Expected message to return key.id');
  assert.ok(sentPayload, 'Expected payload to have been sent to mock socket');
  assert.ok(sentPayload.image || sentPayload.product, 'Expected image or native product in payload');
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
