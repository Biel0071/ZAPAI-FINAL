const test = require('node:test');
const assert = require('node:assert/strict');
const { sortMessagesAsc } = require('../src/api/controllers/messages/sync/collectionOps');
const { formatApiMessage } = require('../src/api/controllers/messages/shared');

test('Message Ordering: formatApiMessage returns real timestamp and createdAt', () => {
  const oldMessage = {
    id: 252445,
    timestamp: '2026-10-28T09:05:54.000Z',
    createdAt: '2026-10-30T08:29:22.462Z',
    content: 'Bom dia queria esse esse modelo',
    fromMe: false,
  };

  const formatted = formatApiMessage(oldMessage);
  assert.equal(formatted.timestamp, '2026-10-28T09:05:54.000Z');
  assert.equal(formatted.createdAt, '2026-10-28T09:05:54.000Z');
});

test('Message Ordering: sortMessagesAsc sorts older messages before newer messages regardless of created_at insertion time', () => {
  // Simulates bulk WhatsApp import where Oct 28 messages were inserted milliseconds AFTER Oct 30 messages
  const messages = [
    {
      id: 252445,
      timestamp: '2026-10-28T09:05:54.000Z',
      createdAt: '2026-10-30T08:29:22.462Z',
      content: 'Bom dia queria esse esse modelo',
    },
    {
      id: 252209,
      timestamp: '2026-10-30T08:21:43.000Z',
      createdAt: '2026-10-30T08:29:12.637Z',
      content: 'Vou gerar sua cobrança para agendar entrega',
    },
    {
      id: 314400,
      timestamp: '2026-10-30T12:07:05.000Z',
      createdAt: '2026-10-30T12:07:05.341Z',
      content: '00020126870014br.gov.bcb.pix...',
    },
  ];

  const sorted = sortMessagesAsc(messages);

  assert.equal(sorted[0].id, 252445, 'Old message from Oct 28 must be first');
  assert.equal(sorted[1].id, 252209, 'Message from Oct 30 08:21 must be second');
  assert.equal(sorted[2].id, 314400, 'Message from Oct 30 12:07 must be last (at bottom of chat)');
  setTimeout(() => process.exit(0), 50);
});
