const test = require('node:test');
const assert = require('node:assert/strict');
const { HistoryRepository } = require('../src/data/repositories/historyRepository');

test('persisted history media notifies only its tenant after updating the message', async () => {
  const queries = [];
  const events = [];
  const repository = new HistoryRepository({ query: async (sql, params) => {
    queries.push({ sql, params });
    return { rows: sql.startsWith('UPDATE messages') ? [{ conversation_id: 9 }] : [] };
  } });
  const previous = global.io;
  global.io = { to: room => ({ emit: (event, payload) => events.push({ room, event, payload, queryCount: queries.length }) }) };
  try {
    await repository.saveMedia({ id: 1, message_id: 2, company_id: 'tenant-a', session_id: 'main' }, '/media/saved.jpg', null, 'downloaded');
    assert.equal(events.length, 1);
    assert.equal(events[0].room, 'tenant:tenant-a');
    assert.equal(events[0].event, 'whatsapp:history_imported');
    assert.deepEqual(events[0].payload, { sessionId: 'main', conversationIds: ['9'] });
    assert.equal(events[0].queryCount, 2);
    assert.deepEqual(queries[1].params, [2, 'tenant-a', 'main', '/media/saved.jpg']);
  } finally { global.io = previous; }
});
