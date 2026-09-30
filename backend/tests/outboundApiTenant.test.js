const test = require('node:test');
const assert = require('node:assert/strict');

function stubModule(relativePath, exports) {
  const id = require.resolve(relativePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const calls = [];
let enqueueError = null;
let enqueuePending = null;
const session = { companyId: 'tenant-a', sessionId: 'wa-a', status: 'connected', sock: {}, phone: '5511999999999' };
const context = { companyId: 'tenant-a', conversationId: 'conv-a', contactId: 7, targetJidOrPhone: '5511888888888@s.whatsapp.net', normalizedPhone: '5511888888888', targetSessionName: 'wa-a', session };
stubModule('../src/infrastructure/config/database', { query: async (sql, params) => { calls.push({ type: 'query', sql, params }); return { rows: [] }; } });
stubModule('../services/sessionManager', { DEFAULT_SESSION: 'main', listSessions: () => [session], isRuntimeActive: () => true, normalizeSessionName: value => value });
stubModule('../services/messageService', { resolveOutboundMediaPath: async () => null, toPublicMediaPath: value => value });
stubModule('../services/whatsappService', { normalizePhone: value => String(value || '').split('@')[0] });
stubModule('../services/messageAuditService', { log() {} });
stubModule('../services/correlationTracker', { generateMessageTraceId: () => 'request-a', traceLog() {} });
stubModule('../services/messageAckPipeline', { ACK_STATES: {} });
stubModule('../services/outboundQueueService', {
  async enqueue(payload) {
    calls.push({ type: 'enqueue', payload });
    if (enqueuePending) await enqueuePending;
    if (enqueueError) throw enqueueError;
    return { id: 'queue-a', state: 'queued' };
  },
  findByCorrelation: () => null,
});
for (const mod of ['webhookService', 'aiIntelligenceService']) stubModule(`../services/${mod}`, {});
stubModule('../src/data/repositories/conversationRepository', {});
stubModule('../src/data/repositories/messageRepository', {});
stubModule('../src/data/store/messageStore', {});
stubModule('../src/api/controllers/messages', {
  getStore: req => req.app.locals.store,
  toExactMessageText: value => value || '',
  normalizeChatId: value => `${value}@s.whatsapp.net`,
  inferMediaType: () => null,
  formatApiMessage: value => value,
  emitInboxRealtimeEvent() {},
  emitSocketEvent() {},
  async registerOutgoingMessage(_store, payload) { calls.push({ type: 'persist', payload }); return { message: { id: 'message-a', conversationId: 'conv-a', status: 'pending' } }; },
});
stubModule('../src/api/controllers/messages/shared', {
  async resolveOutboundContext(req) {
    if (!req.authTenantId) throw Object.assign(new Error('Autenticação da empresa obrigatória.'), { status: 401 });
    return context;
  },
});
const dedupe = require('../services/messageDedupeService');
const { sendMessage } = require('../src/api/controllers/messagesController');

function response() {
  return { statusCode: 200, sent: false, status(code) { this.statusCode = code; return this; }, json(body) { this.sent = true; this.body = body; return this; } };
}
function request(overrides = {}) {
  return { authTenantId: 'tenant-a', body: { text: 'Olá', companyId: 'tenant-b', conversationId: 'conv-a', requestId: 'request-a' }, app: { locals: { store: { databaseEnabled: true, io: { to: room => ({ emit: (event, payload) => calls.push({ type: 'event', room, event, payload }) }) } } } }, ...overrides };
}
test.beforeEach(() => { calls.length = 0; enqueueError = null; enqueuePending = null; dedupe.clearNamespace('outbound_request'); });

test('manual send requires authentication before persisting or queueing', async () => {
  const res = response();
  await sendMessage(request({ authTenantId: undefined }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('manual send waits for queue acceptance and uses authenticated tenant for persistence, queue and AI pause', async () => {
  let accept;
  enqueuePending = new Promise(resolve => { accept = resolve; });
  const res = response();
  const sending = sendMessage(request(), res);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(res.sent, false);
  accept();
  await sending;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.queueId, 'queue-a');
  assert.equal(res.body.message.status, 'pending');
  assert.equal(calls.find(call => call.type === 'persist').payload.companyId, 'tenant-a');
  assert.equal(calls.find(call => call.type === 'enqueue').payload.companyId, 'tenant-a');
  const pause = calls.find(call => call.type === 'query' && call.sql.includes('UPDATE conversations'));
  assert.match(pause.sql, /company_id/);
  assert.ok(pause.params.includes('tenant-a'));
  assert.equal(calls.find(call => call.type === 'event').room, 'tenant:tenant-a');
});

test('failed queue acceptance persists error, returns failure and permits retry with the same intent', async () => {
  enqueueError = new Error('disk unavailable');
  const failed = response();
  await sendMessage(request(), failed);
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.body.success, false);
  assert.equal(failed.body.message.status, 'error');
  const persistError = calls.find(call => call.type === 'query' && call.sql.includes('UPDATE messages'));
  assert.ok(persistError.params.includes('tenant-a'));
  assert.ok(persistError.params.includes('error'));
  enqueueError = null;
  const retry = response();
  await sendMessage(request(), retry);
  assert.equal(retry.body.success, true);
  assert.equal(calls.filter(call => call.type === 'enqueue').length, 2);
});
