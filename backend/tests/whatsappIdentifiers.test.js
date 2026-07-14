const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureWhatsAppJid } = require('../services/whatsapp/shared/identifiers');

function withLidMaps(lidToPhone, phoneToLid, callback) {
  const previousLidToPhone = global.lidToPhoneMap;
  const previousPhoneToLid = global.phoneToLidMap;
  global.lidToPhoneMap = lidToPhone;
  global.phoneToLidMap = phoneToLid;
  try {
    callback();
  } finally {
    global.lidToPhoneMap = previousLidToPhone;
    global.phoneToLidMap = previousPhoneToLid;
  }
}

test('preserves an explicit LID as the outbound transport address', () => {
  withLidMaps(
    new Map([['153343318048786', '553193807167']]),
    new Map([['553193807167', '153343318048786']]),
    () => assert.equal(ensureWhatsAppJid('153343318048786@lid'), '153343318048786@lid'),
  );
});

test('routes a canonical phone through its known WhatsApp LID', () => {
  withLidMaps(
    new Map([['153343318048786', '553193807167']]),
    new Map([['553193807167', '153343318048786']]),
    () => assert.equal(ensureWhatsAppJid('553193807167'), '153343318048786@lid'),
  );
});

test('falls back to a phone JID when no LID mapping is known', () => {
  withLidMaps(new Map(), new Map(), () => {
    assert.equal(ensureWhatsAppJid('5511999999999'), '5511999999999@s.whatsapp.net');
  });
});
test('adds Brazil country code for local DDD numbers before creating the JID', () => {
  withLidMaps(new Map(), new Map(), () => {
    assert.equal(ensureWhatsAppJid('3199307167'), '553199307167@s.whatsapp.net');
  });
});
