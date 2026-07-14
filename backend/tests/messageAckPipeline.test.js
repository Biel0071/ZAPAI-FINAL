const test = require('node:test');
const assert = require('node:assert/strict');

const pipeline = require('../services/messageAckPipeline');

test('accepts WhatsApp ACKs that skip intermediate states', () => {
  const id = `skip-${Date.now()}`;
  pipeline.transitionAck(id, pipeline.ACK_STATES.SENT);

  const delivered = pipeline.transitionAck(id, pipeline.ACK_STATES.DEVICE_ACK);
  assert.equal(delivered.status, pipeline.ACK_STATES.DEVICE_ACK);

  const lateServerAck = pipeline.transitionAck(id, pipeline.ACK_STATES.SERVER_ACK);
  assert.equal(lateServerAck.status, pipeline.ACK_STATES.DEVICE_ACK);

  const read = pipeline.transitionAck(id, pipeline.ACK_STATES.READ);
  assert.equal(read.status, pipeline.ACK_STATES.READ);
});

test('maps Baileys ERROR status 0 to failed', () => {
  const id = `error-${Date.now()}`;
  const result = pipeline.processBaileysStatusUpdate({
    key: { id, remoteJid: '5511999999999@s.whatsapp.net' },
    update: { status: 0 },
  });

  assert.equal(result.status, pipeline.ACK_STATES.FAILED);
});
