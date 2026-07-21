const test = require('node:test');
const assert = require('node:assert/strict');

const { emitAIResponseProgress } = require('../services/aiResponseProgressService');

test('emits AI progress only to the conversation tenant room', () => {
  const emitted = [];
  const io = {
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        },
      };
    },
  };

  const event = emitAIResponseProgress(io, {
    companyId: 'store-42',
    conversationId: 'conv-7',
    status: 'typing',
    estimatedMs: 5000,
    message: 'Digitando resposta.',
  });

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].room, 'tenant:store-42');
  assert.equal(emitted[0].event, 'ai:progress');
  assert.equal(emitted[0].payload.conversationId, 'conv-7');
  assert.equal(event.status, 'typing');
  assert.ok(new Date(event.estimatedCompletionAt).getTime() > Date.now());
});

test('does not emit progress without a conversation target', () => {
  let emitted = false;
  const io = { to: () => ({ emit: () => { emitted = true; } }) };

  assert.equal(emitAIResponseProgress(io, { companyId: 'store-42' }), null);
  assert.equal(emitted, false);
});
