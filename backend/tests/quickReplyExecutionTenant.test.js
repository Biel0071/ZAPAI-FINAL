const test = require('node:test');
const assert = require('node:assert/strict');
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
let available = true;
const calls = [];
stub('../services/quickReplyService', {
  async listQuickReplies(filters) { calls.push({ type: 'list', filters }); return available ? [{ id: 'saved-a', companyId: 'tenant-a', title: 'Salvo', steps: [{ type: 'text', value: 'Texto salvo', delayMs: 0 }, { type: 'text', value: 'Segundo', delayMs: 0 }] }] : []; },
});
stub('../src/api/controllers/messages/shared', { async resolveOutboundContext(req) { if (!req.authTenantId) throw Object.assign(new Error('Auth'), { status: 401 }); return { companyId: req.authTenantId, conversationId: 'conv-a', contactId: 7, targetJidOrPhone: '5511888888888', normalizedPhone: '5511888888888', targetSessionName: 'wa-a' }; } });
stub('../services/outboundQueueService', { async enqueueBatch(payloads) { calls.push({ type: 'enqueue', payloads }); return payloads.map((payload, index) => ({ id: `q${index}`, ...payload })); }, async cancelFlowItems(options) { calls.push({ type: 'cancel', options }); return 2; }, findByCorrelation: () => null });
stub('../services/flowTrackerService', { startFlow: options => calls.push({ type: 'start', options }), cancelFlow: (_phone, options) => calls.push({ type: 'cancelTracker', options }), getRunningFlow: (_phone, options) => { calls.push({ type: 'get', options }); return null; } });
const dedupe = require('../services/messageDedupeService');
const controller = require('../src/api/controllers/quickRepliesController');
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function request(id = 'saved-a') { return { authTenantId: 'tenant-a', params: { id }, body: { phone: '5511888888888', conversationId: 'conv-a', sessionId: 'wa-a', companyId: 'tenant-b', sendId: 'intent-a', overrideDelayMs: 0, item: { text: 'Conteúdo arbitrário', steps: [] } } }; }
test.beforeEach(() => { available = true; calls.length = 0; dedupe.clearNamespace('quick_reply_intent'); });

test('flow execution only uses saved tenant reply and gives each step a distinct queue identity', async () => {
  const res = response();
  await controller.executeQuickReplyFlow(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.stepsCount, 2);
  assert.equal(calls.find(call => call.type === 'list').filters.companyId, 'tenant-a');
  const items = calls.find(call => call.type === 'enqueue').payloads;
  assert.equal(items[0].text, 'Texto salvo');
  assert.equal(items[0].companyId, 'tenant-a');
  assert.equal(items[0].metadata.conversationId, 'conv-a');
  assert.notEqual(items[0].correlationId, items[1].correlationId);
});

test('a missing saved flow is 404 and cannot fall back to item or id as text', async () => {
  available = false;
  const res = response();
  await controller.executeQuickReplyFlow(request('inexistente'), res);
  assert.equal(res.statusCode, 404);
  assert.equal(calls.filter(call => call.type === 'enqueue').length, 0);
  available = true;
  const retry = response();
  await controller.executeQuickReplyFlow(request(), retry);
  assert.equal(retry.body.success, true);
});

test('flow status and cancellation pass authenticated company, connection and conversation', async () => {
  const res = response();
  await controller.cancelQuickReplyFlow(request(), res);
  assert.equal(res.body.cancelled, 2);
  const scoped = calls.find(call => call.type === 'cancel').options;
  assert.equal(scoped.companyId, 'tenant-a');
  assert.equal(scoped.sessionId, 'wa-a');
  assert.equal(scoped.conversationId, 'conv-a');
  const statusRequest = request();
  statusRequest.params = { phone: '5511888888888' };
  await controller.getActiveQuickReplyFlow(statusRequest, response());
  assert.equal(calls.find(call => call.type === 'get').options.companyId, 'tenant-a');
});
