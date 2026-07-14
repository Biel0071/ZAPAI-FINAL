const assert = require('node:assert/strict');
const test = require('node:test');

const {
  extractMessageText,
  getMediaDescriptor,
  unwrapMessageContent,
} = require('../services/whatsapp/inbound/parser');

test('unwraps a device-sent text message', () => {
  const message = {
    deviceSentMessage: {
      message: { conversation: 'envio teste' },
    },
  };

  assert.equal(extractMessageText(message), 'envio teste');
  assert.deepEqual(unwrapMessageContent(message), { conversation: 'envio teste' });
});

test('unwraps document-with-caption media without losing its descriptor', () => {
  const message = {
    documentWithCaptionMessage: {
      message: {
        documentMessage: {
          caption: 'orcamento',
          fileName: 'orcamento.pdf',
        },
      },
    },
  };

  assert.equal(extractMessageText(message), 'orcamento');
  assert.equal(getMediaDescriptor(message).mediaType, 'document');
});

test('keeps revoke protocol messages available to the session listener', () => {
  const protocolMessage = { type: 0, key: { id: 'WA-123' } };
  const message = {
    ephemeralMessage: {
      message: { protocolMessage },
    },
  };

  assert.equal(unwrapMessageContent(message).protocolMessage, protocolMessage);
  assert.equal(extractMessageText(message), '');
  assert.equal(getMediaDescriptor(message).mediaType, null);
});