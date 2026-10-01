const test = require('node:test');
const assert = require('node:assert/strict');

function stubModule(relativePath, exports) {
  const id = require.resolve(relativePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const executedQueries = [];
let queryResults = [];

stubModule('../src/infrastructure/config/database', {
  query: async (sql, params) => {
    executedQueries.push({ sql, params });
    if (queryResults.length > 0) {
      return queryResults.shift();
    }
    return { rows: [] };
  },
});

const messageRepository = require('../src/data/repositories/messageRepository');

test.beforeEach(() => {
  executedQueries.length = 0;
  queryResults.length = 0;
});

test('getMessagesByConversation resolves conversation and queries contact-wide history', async () => {
  // First query is conversation metadata lookup
  queryResults.push({
    rows: [{
      id: 42,
      lead_id: 101,
      remote_jid: '5531993807167@s.whatsapp.net',
      session_id: 'main',
      phone: '5531993807167',
    }],
  });

  // Second query is the messages query
  queryResults.push({
    rows: [
      {
        id: 1,
        conversation_id: 42,
        sender: 'client',
        type: 'text',
        content: 'Olá antigo',
        timestamp: new Date('2026-01-01T10:00:00Z'),
        status: 'received',
        created_at: new Date('2026-01-01T10:00:00Z'),
        session_id: 'main',
        phone: '5531993807167',
        whatsapp_message_id: 'WAMID-1',
        from_me: false,
      },
      {
        id: 2,
        conversation_id: 42,
        sender: 'agent',
        type: 'text',
        content: 'Olá resposta',
        timestamp: new Date('2026-01-01T10:01:00Z'),
        status: 'sent',
        created_at: new Date('2026-01-01T10:01:00Z'),
        session_id: 'main',
        phone: '5531993807167',
        whatsapp_message_id: 'WAMID-2',
        from_me: true,
      },
    ],
  });

  const messages = await messageRepository.getMessagesByConversation(42, {
    companyId: 'tenant-test',
    limit: 50,
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[0].content, 'Olá antigo');
  assert.equal(messages[1].content, 'Olá resposta');

  // Verify conversation lookup occurred
  assert.match(executedQueries[0].sql, /SELECT conv\.id, conv\.lead_id/);
  assert.equal(executedQueries[0].params[0], 42);
  assert.equal(executedQueries[0].params[1], 'tenant-test');

  // Verify message query matches contact wide
  const msgQuery = executedQueries[1];
  assert.match(msgQuery.sql, /m\.company_id = \$1/);
  assert.match(msgQuery.sql, /conv\.lead_id/);
  assert.equal(msgQuery.params[0], 'tenant-test');
});

test('getMessagesByConversation deduplicates messages by whatsapp_message_id', async () => {
  queryResults.push({
    rows: [{
      id: 55,
      lead_id: 202,
      remote_jid: '553193672075@s.whatsapp.net',
      session_id: 'main',
      phone: '553193672075',
    }],
  });

  // Simulated query returning two rows with the same whatsapp_message_id
  queryResults.push({
    rows: [
      {
        id: 10,
        conversation_id: 55,
        content: 'Mensagem sincronizada',
        whatsapp_message_id: 'DUPLICATE-WAMID',
        timestamp: new Date('2026-01-02T12:00:00Z'),
      },
      {
        id: 11,
        conversation_id: 55,
        content: 'Mensagem sincronizada (cópia)',
        whatsapp_message_id: 'DUPLICATE-WAMID',
        timestamp: new Date('2026-01-02T12:00:00Z'),
      },
    ],
  });

  const messages = await messageRepository.getMessagesByConversation(55, { companyId: 'tenant-test' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].whatsappMessageId, 'DUPLICATE-WAMID');
});

test('getMessagesByConversation handles non-numeric string identifier without SQL syntax error', async () => {
  // First query (numeric lookup) skipped; secondary lookup by phone/JID
  queryResults.push({
    rows: [{
      id: 99,
      lead_id: 303,
      remote_jid: '553193672075@s.whatsapp.net',
      session_id: 'main',
      phone: '553193672075',
    }],
  });

  queryResults.push({
    rows: [
      {
        id: 20,
        conversation_id: 99,
        content: 'Oi pelo JID',
        timestamp: new Date('2026-01-03T10:00:00Z'),
        whatsapp_message_id: 'JID-MSG-1',
      },
    ],
  });

  const messages = await messageRepository.getMessagesByConversation('553193672075@s.whatsapp.net', { companyId: 'tenant-test' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].conversationId, 99);
  assert.equal(messages[0].content, 'Oi pelo JID');
});

test('getMessagesByPhone matches aliases and deduplicates results', async () => {
  queryResults.push({
    rows: [
      {
        id: 30,
        conversation_id: 88,
        content: 'Via telefone',
        phone: '5531993807167',
        whatsapp_message_id: 'PHONE-MSG-1',
      },
    ],
  });

  const messages = await messageRepository.getMessagesByPhone('31993807167', 'tenant-test', 'main');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, 'Via telefone');
  const query = executedQueries[0];
  assert.match(query.sql, /l\.phone = ANY\(\$2::text\[\]\)/);
  assert.equal(query.params[0], 'tenant-test');
});
