const test = require('node:test');
const assert = require('node:assert/strict');
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
let persisted = { items: [], version: 1 };
let failWrites = false;
let sessionOwner = 'tenant-a';
let sendCalls = 0;
stub('fs/promises', { mkdir: async () => {}, access: async () => {}, readFile: async () => JSON.stringify(persisted), writeFile: async (_path, text) => { if (failWrites) throw new Error('disk failed'); persisted = JSON.parse(text); }, rename: async () => {} });
stub('../src/data/store/messageStore', { addMessage: () => ({ id: 'message-a' }) });
stub('../services/sessionManager', { DEFAULT_SESSION: 'main', normalizeSessionName: value => value, isRuntimeActive: () => true, getSession: () => ({ sessionId: 'wa-a', companyId: sessionOwner, status: 'connected', sock: {} }) });
stub('../services/whatsappService', { normalizePhone: value => String(value).split('@')[0], sendMessage: async () => { sendCalls++; return { key: { id: 'wa-message', remoteJid: '5511888888888@s.whatsapp.net' } }; } });
stub('../src/api/controllers/messagesController', { registerOutgoingMessage: async () => ({ message: { id: 'message-a' } }) });
stub('../services/aiReplyGuard', { getAutomatedReplyPermission: async () => ({ allowed: true }) });
stub('../services/correlationTracker', { generateMessageTraceId: () => Math.random().toString(), traceLog() {} });
stub('../services/messageAckPipeline', { ACK_STATES: { PENDING: 'pending' }, transitionAck() {}, registerDbMapping() {}, getAckState: () => null, emitAckUpdate() {} });
stub('../src/infrastructure/config/database', { query: async () => ({ rows: [{ session_id: 'wa-a' }] }) });
let mediaAllowed = true;
stub('../services/enterprise/media-service', { normalizeMediaReference: value => value, canAccessMedia: async () => mediaAllowed, findMediaFile: async () => '/owned/file.jpg' });
const queue = require('../services/outboundQueueService');
test.beforeEach(async () => { persisted = { items: [], version: 1 }; failWrites = false; sessionOwner = 'tenant-a'; sendCalls = 0; await queue.initializeOutboundQueue({ store: { databaseEnabled: true } }); await queue.shutdownOutboundQueue(); });
const payload = (overrides = {}) => ({ phone: '5511888888888', text: 'Teste', companyId: 'tenant-a', sessionId: 'wa-a', correlationId: 'request-a', nextAttemptAt: new Date(Date.now() + 60000).toISOString(), metadata: { conversationId: 'conv-a', isFlowStep: true, currentStep: 1, totalSteps: 2 }, ...overrides });

test('queue idempotency includes company, session, conversation and individual flow step', async () => {
  const first = await queue.enqueue(payload());
  const duplicate = await queue.enqueue(payload());
  assert.equal(first.id, duplicate.id);
  const otherTenant = await queue.enqueue(payload({ companyId: 'tenant-b' }));
  const otherConversation = await queue.enqueue(payload({ metadata: { conversationId: 'conv-b' } }));
  const secondStep = await queue.enqueue(payload({ correlationId: 'request-a:2' }));
  assert.notEqual(first.id, otherTenant.id);
  assert.notEqual(first.id, otherConversation.id);
  assert.notEqual(first.id, secondStep.id);
  assert.equal(persisted.items.length, 4);
});

test('future scheduled steps are not processed early', async () => {
  await queue.enqueueBatch([payload(), payload({ correlationId: 'request-a:2' })]);
  await queue.processOneItem();
  assert.equal(sendCalls, 0);
  assert.equal(queue.listPending().length, 2);
});

test('failed persistence rolls back the entire batch so a retry can be accepted', async () => {
  failWrites = true;
  await assert.rejects(queue.enqueueBatch([payload(), payload({ correlationId: 'request-a:2' })]), /disk failed/);
  assert.equal(queue.listPending().length, 0);
  failWrites = false;
  const retried = await queue.enqueueBatch([payload(), payload({ correlationId: 'request-a:2' })]);
  assert.equal(retried.length, 2);
  assert.equal(persisted.items.length, 2);
});

test('cancelling a flow cannot cancel another company or conversation with the same phone', async () => {
  await queue.enqueueBatch([payload(), payload({ companyId: 'tenant-b' }), payload({ metadata: { conversationId: 'conv-b', isFlowStep: true } })]);
  assert.equal(await queue.cancelFlowItems({ companyId: 'tenant-a', sessionId: 'wa-a', conversationId: 'conv-a', phone: '5511888888888' }), 1);
  assert.equal(queue.listPending().length, 2);
  assert.equal(persisted.items.filter(item => item.state === 'cancelled').length, 1);
});

test('worker never uses a socket belonging to a different company', async () => {
  sessionOwner = 'tenant-b';
  const accepted = await queue.enqueue(payload({ nextAttemptAt: new Date().toISOString() }));
  await new Promise(resolve => setTimeout(resolve, 10));
  await queue.processOneItem();
  assert.equal(sendCalls, 0);
  assert.equal(queue.listDeadLetter().find(item => item.id === accepted.id).lastFailure.code, 'SESSION_FORBIDDEN');
});

test('a batch containing another tenant media is never accepted', async () => {
  mediaAllowed = false;
  await assert.rejects(queue.enqueueBatch([payload(), payload({ correlationId: 'media-b', mediaType: 'image', mediaPath: '/upload/private-b.jpg' })]), error => error.code === 'MEDIA_FORBIDDEN');
  assert.equal(persisted.items.length, 0);
  assert.equal(queue.listPending().length, 0);
  mediaAllowed = true;
});
