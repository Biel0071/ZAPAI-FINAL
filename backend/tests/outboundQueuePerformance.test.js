const test = require('node:test');
const assert = require('node:assert/strict');
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
let persisted = { items: [], version: 1 };
let writes = 0;
stub('fs/promises', { mkdir: async () => {}, access: async () => {}, readFile: async () => JSON.stringify(persisted), writeFile: async (_p, text) => { writes++; await new Promise(r => setImmediate(r)); persisted = JSON.parse(text); }, rename: async () => {} });
stub('../src/data/store/messageStore', { addMessage: () => ({ id: 'm' }) });
stub('../services/sessionManager', { DEFAULT_SESSION: 'main', normalizeSessionName: v => v, isRuntimeActive: () => true, getSession: () => ({ sessionId: 'wa-a', companyId: 'tenant-a', status: 'connected', sock: sharedSock }) });
const sharedSock = {};
let sent = [];
stub('../services/whatsappService', { normalizePhone: v => String(v).split('@')[0], sendMessage: async (...a) => { sent.push(a); return { key: { id: 'wa-' + sent.length, remoteJid: 'x@s.whatsapp.net' } }; } });
stub('../src/api/controllers/messagesController', { registerOutgoingMessage: async () => ({ message: { id: 'm' } }) });
stub('../services/aiReplyGuard', { getAutomatedReplyPermission: async () => ({ allowed: true }) });
stub('../services/correlationTracker', new Proxy({ generateMessageTraceId: () => Math.random().toString() }, { get: (t, k) => (k in t ? t[k] : () => undefined) }));
stub('../services/messageAckPipeline', { ACK_STATES: { PENDING: 'pending' }, transitionAck() {}, registerDbMapping() {}, getAckState: () => null, emitAckUpdate() {} });
stub('../src/infrastructure/config/database', { query: async () => ({ rows: [{ session_id: 'wa-a' }] }) });
stub('../services/enterprise/media-service', { normalizeMediaReference: v => v, canAccessMedia: async () => true, findMediaFile: async () => '/f' });
const queue = require('../services/outboundQueueService');

const old = (state, i, ageMs) => { const at = new Date(Date.now() - ageMs).toISOString(); return { id: `o${state}${i}`, companyId: 'tenant-a', sessionId: 'wa-a', phone: '551100000' + i, text: 't', state, correlationId: `c-${state}-${i}`, createdAt: at, updatedAt: at, metadata: {}, failureHistory: [] }; };
const payload = (i, extra = {}) => ({ phone: '5511888' + String(i).padStart(6, '0'), text: 'm' + i, companyId: 'tenant-a', sessionId: 'wa-a', correlationId: 'k' + i, nextAttemptAt: new Date(Date.now() + 3600e3).toISOString(), metadata: { conversationId: 'cv' + i }, ...extra });
async function boot(items) { persisted = { items, version: 1 }; writes = 0; sent = []; await queue.initializeOutboundQueue({ store: { databaseEnabled: true } }); await queue.shutdownOutboundQueue(); }

test('terminal items are pruned on persist; pending, recent terminal and dead letters survive', async () => {
  await boot([old('sent', 1, 3600e3), old('cancelled', 2, 3600e3), old('sent', 3, 1000), old('dead_letter', 4, 3600e3), old('dead_letter', 5, 8 * 24 * 3600e3), old('queued', 6, 3600e3)]);
  await queue.enqueue(payload(1));
  const ids = persisted.items.map(i => i.id);
  assert.ok(!ids.includes('osent1') && !ids.includes('ocancelled2'), 'old sent/cancelled pruned');
  assert.ok(ids.includes('osent3'), 'recent sent kept for idempotency');
  assert.ok(ids.includes('odead_letter4'), 'recent dead letter kept');
  assert.ok(!ids.includes('odead_letter5'), 'week-old dead letter pruned');
  assert.ok(ids.includes('oqueued6'), 'pending work is never pruned');
});

test('a burst of concurrent enqueues shares coalesced writes and dedupes identical correlation ids', async () => {
  await boot([]);
  const results = await Promise.all([...Array.from({ length: 60 }, (_, i) => queue.enqueue(payload(i))), queue.enqueue(payload(0)), queue.enqueue(payload(1))]);
  assert.equal(new Set(results.map(r => r.id)).size, 60, 'duplicates in the same burst return the same item');
  assert.equal(persisted.items.length, 60);
  assert.ok(writes < 10, `expected coalesced writes, got ${writes}`);
});

test('earliest-due eligible item is picked first and future items are left alone', async () => {
  await boot([]);
  const now = Date.now();
  await queue.enqueueBatch([
    payload(1, { correlationId: 'late', nextAttemptAt: new Date(now - 1000).toISOString(), text: 'late' }),
    payload(2, { correlationId: 'early', nextAttemptAt: new Date(now - 60000).toISOString(), text: 'early' }),
    payload(3, { correlationId: 'future', text: 'future' }),
  ]);
  for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 5)); await queue.processOneItem(); }
  const order = sent.map(call => JSON.stringify(call));
  assert.ok(order.length >= 2, 'both due items were sent');
  assert.ok(order.every(s => !s.includes('future')), 'future item untouched');
  assert.ok(order.findIndex(s => s.includes('early')) < order.findIndex(s => s.includes('late')), 'earliest due first');
});

test('wasSentBySystem is backed by persisted queue items (survives restart)', async () => {
  const sentItem = { ...old('sent', 9, 1000), whatsappMessageId: 'WAID-1' };
  await boot([sentItem]);
  assert.equal(queue.wasSentBySystem('WAID-1'), true);
  assert.equal(queue.wasSentBySystem('OTHER'), false);
  assert.equal(queue.wasSentBySystem(''), false);
});
