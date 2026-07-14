const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveRegisteredJid,
} = require('../services/whatsapp/outbound/senders');

test('reuses a confirmed LID for consecutive messages without a second USync lookup', async () => {
  const lid = '9876500012345';
  const phone = '553193807167';
  const previousLidMap = global.lidToPhoneMap;
  const previousPhoneMap = global.phoneToLidMap;
  global.lidToPhoneMap = new Map([[lid, phone]]);
  global.phoneToLidMap = new Map([[phone, lid]]);
  let lookups = 0;
  const sock = {
    onWhatsApp: async () => {
      lookups += 1;
      return [{ exists: true, jid: `${phone}@s.whatsapp.net`, lid: `${lid}@lid` }];
    },
  };

  try {
    assert.equal(await resolveRegisteredJid(sock, `${lid}@lid`), `${lid}@lid`);
    assert.equal(await resolveRegisteredJid(sock, `${lid}@lid`), `${lid}@lid`);
    assert.equal(lookups, 1);
  } finally {
    global.lidToPhoneMap = previousLidMap;
    global.phoneToLidMap = previousPhoneMap;
  }
});

test('keeps a known LID when WhatsApp confirmation has a transient miss', async () => {
  const lid = '9876500099999';
  const phone = '5531999999999';
  const previousLidMap = global.lidToPhoneMap;
  const previousPhoneMap = global.phoneToLidMap;
  global.lidToPhoneMap = new Map([[lid, phone]]);
  global.phoneToLidMap = new Map([[phone, lid]]);
  const sock = { onWhatsApp: async () => [] };

  try {
    assert.equal(await resolveRegisteredJid(sock, `${lid}@lid`), `${lid}@lid`);
  } finally {
    global.lidToPhoneMap = previousLidMap;
    global.phoneToLidMap = previousPhoneMap;
  }
});