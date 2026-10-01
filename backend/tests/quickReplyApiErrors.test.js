const test = require('node:test');
const assert = require('node:assert/strict');

function stub(name, exports) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
let failure;
let payload;
stub('../services/quickReplyService', {
  createQuickReply: async value => { payload = value; if (failure) throw failure; return { id: 'saved', ...value }; },
  updateQuickReply: async (_id, value, companyId) => { payload = { ...value, companyId }; if (failure) throw failure; return { id: 'saved', ...payload }; },
});
stub('../services/outboundQueueService', {});
stub('../services/flowTrackerService', {});
stub('../services/messageDedupeService', {});
stub('../src/api/controllers/messages/shared', {});
const controller = require('../src/api/controllers/quickRepliesController');
function response() { return { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } }; }
function request() { return { authTenantId: 'tenant-a', params: { id: 'saved' }, body: { id: 'foreign-id', companyId: 'tenant-b', title: 'Atendimento', content: 'Olá' } }; }

test('saving a quick reply distinguishes unavailable persistence from invalid user data', async () => {
  failure = Object.assign(new Error('relation "quick_replies" does not exist'), { code: '42P01' });
  for (const handler of [controller.createQuickReply, controller.updateQuickReply]) {
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.doesNotMatch(res.body.error, /relation|quick_replies/);
  }
  failure = Object.assign(new Error('Informe o título da resposta rápida.'), { status: 400 });
  const invalid = response();
  await controller.createQuickReply(request(), invalid);
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body.error, /título/);
});

test('media ownership and duplicate errors preserve their status and successful create uses authenticated owner', async () => {
  for (const status of [403, 404, 409]) {
    failure = Object.assign(new Error('Resposta não permitida.'), { status });
    const res = response();
    await controller.createQuickReply(request(), res);
    assert.equal(res.statusCode, status);
  }
  failure = null;
  const res = response();
  await controller.createQuickReply(request(), res);
  assert.equal(res.statusCode, 201);
  assert.equal(payload.companyId, 'tenant-a');
  assert.equal(payload.id, undefined);
});

test('unauthenticated quick reply writes return 401 before accessing persistence', async () => {
  payload = null;
  const req = request(); delete req.authTenantId;
  const res = response();
  await controller.createQuickReply(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(payload, null);
});
