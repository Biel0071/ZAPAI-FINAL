const test = require('node:test');
const assert = require('node:assert/strict');

function stubModule(relativePath, exports) {
  const id = require.resolve(relativePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const calls = [];
let failDatabase = false;
let memoryChats = [];
stubModule('../src/data/repositories/conversationRepository', {});
stubModule('../src/data/repositories/messageRepository', {});
stubModule('../services/whatsappService', {});
stubModule('../services/sessionManager', { normalizeSessionName: value => value, getSession: () => null });
stubModule('../src/api/controllers/messagesController', {});
stubModule('../src/data/store/messageStore', { getChats: () => memoryChats });
stubModule('../src/messaging/inbox/inbox/services/ConversationService', {
  listConversations: async payload => { calls.push(payload); if (failDatabase) throw Error('unavailable'); return [{ id: 'older-match' }]; },
});
stubModule('../src/messaging/inbox/inbox/repositories/ConversationRepository', {});
stubModule('../src/messaging/inbox/inbox/events/InboxRealtimeService', {});
stubModule('../src/messaging/inbox/inbox/services/ConversationRuntimeService', { decorateConversation: (_store, value) => value });
const { getConversations } = require('../src/api/controllers/conversationsController');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const request = (query = {}) => ({ authTenantId: 'tenant-a', tenantId: 'tenant-b', query: { companyId: 'tenant-b', sessionId: 'main', ...query }, app: { locals: { store: { databaseEnabled: true } } } });
test.beforeEach(() => { calls.splice(0); failDatabase = false; memoryChats = [{ id: 'unowned', phone: '7167', sessionId: 'main' }]; });

test('forwards bounded search using verified tenant rather than query or middleware hint', async () => {
  const res = response();
  await getConversations(request({ search: '7167', limit: '9999' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].companyId, 'tenant-a');
  assert.equal(calls[0].sessionId, 'main');
  assert.equal(calls[0].search, '7167');
  assert.equal(calls[0].limit, 100);
});

test('requires verified tenant and rejects malformed or oversized search', async () => {
  const noAuth = response();
  await getConversations({ ...request(), authTenantId: undefined }, noAuth);
  assert.equal(noAuth.statusCode, 401);
  for (const search of [{ nested: '7167' }, 'x'.repeat(101)]) {
    const res = response();
    await getConversations(request({ search }), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(calls.length, 0);
});

test('database failure stays visible instead of returning unowned global memory as search results', async () => {
  failDatabase = true;
  const res = response();
  await getConversations(request({ search: '7167' }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'Não foi possível carregar as conversas. Tente novamente.');
});

test('supports verified JWT claim context without accepting query tenant as authentication', async () => {
  const req = { ...request({ search: '7167' }), authTenantId: undefined, auth: { companyId: 'tenant-a' } };
  const res = response();
  await getConversations(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].companyId, 'tenant-a');
});

test('memory search excludes unowned legacy chats and conversations from another tenant or connection', async () => {
  memoryChats.push(
    { id: 'own', phone: '7167', companyId: 'tenant-a', sessionId: 'main' },
    { id: 'other-tenant', phone: '7167', companyId: 'tenant-b', sessionId: 'main' },
    { id: 'other-session', phone: '7167', companyId: 'tenant-a', sessionId: 'other' },
  );
  const req = request({ search: '7167' });
  req.app.locals.store.databaseEnabled = false;
  const res = response();
  await getConversations(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.map(row => row.id), ['own']);

  const inactive = response();
  await getConversations({ ...req, query: { ...req.query, sessionId: 'inactive' } }, inactive);
  assert.deepEqual(inactive.body, []);
});
