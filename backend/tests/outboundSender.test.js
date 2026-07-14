const assert = require('node:assert/strict');
const test = require('node:test');

const { sendMessage } = require('../services/whatsapp/outbound/senders');

test('sendMessage confirms and uses the authoritative WhatsApp LID', async () => {
  global.whatsappSession = { connected: true };
  global.phoneToLidMap = new Map([['553193807167', '111111111111111']]);
  global.lidToPhoneMap = new Map([['111111111111111', '553193807167']]);
  let sentJid = null;

  const sock = {
    user: { id: '5531999999999@s.whatsapp.net' },
    ws: { readyState: 1 },
    onWhatsApp: async () => [{
      exists: true,
      jid: '553193807167@s.whatsapp.net',
      lid: '153343318048786@lid',
    }],
    sendMessage: async (jid) => {
      sentJid = jid;
      return { key: { id: 'MESSAGE-1', remoteJid: jid, fromMe: true } };
    },
  };

  const result = await sendMessage(sock, '553193807167', 'teste');

  assert.equal(sentJid, '153343318048786@lid');
  assert.equal(result.key.id, 'MESSAGE-1');
  assert.equal(global.phoneToLidMap.get('553193807167'), '153343318048786');
});

test('sendMessage rejects an unconfirmed WhatsApp destination', async () => {
  global.whatsappSession = { connected: true };
  global.phoneToLidMap = new Map([['5531900000000', '199999999999999']]);
  global.lidToPhoneMap = new Map([['199999999999999', '5531900000000']]);

  const sock = {
    user: { id: '5531999999999@s.whatsapp.net' },
    ws: { readyState: 1 },
    onWhatsApp: async () => [],
    sendMessage: async () => {
      throw new Error('sendMessage must not be called');
    },
  };

  await assert.rejects(
    () => sendMessage(sock, '5531900000000', 'teste'),
    (error) => error?.code === 'WHATSAPP_NUMBER_NOT_FOUND'
  );
});