const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function fixture({ fail = false } = {}) {
  const calls = [];
  const counts = {
    'tenant-a': { total_conversations: '11', open_conversations: '4', waiting_conversations: '2', closed_conversations: '5', messages_today: '8', incoming_today: '5', outgoing_today: '3' },
    'tenant-b': { total_conversations: '30', open_conversations: '10', waiting_conversations: '7', closed_conversations: '13', messages_today: '19', incoming_today: '12', outgoing_today: '7' },
    default: { total_conversations: '3', open_conversations: '1', waiting_conversations: '0', closed_conversations: '2', messages_today: '2', incoming_today: '1', outgoing_today: '1' },
  };
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (fail) throw new Error('database unavailable');
    const row = /WHERE\s+company_id\s*=\s*\$2/.test(sql) ? counts[params[1]] : { total_conversations: '44', messages_today: '29' };
    return { rows: [row || {}] };
  } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/api/controllers/operationsController'), 'utf8'), {
    module, exports: module.exports, require: () => db, console: { error() {} },
  });
  return { controller: module.exports, calls };
}

test('operations metrics reject missing authentication before reading any company data', async () => {
  for (const authTenantId of [undefined, '', ' ']) {
    const { controller, calls } = fixture();
    const res = response();
    await controller.getOperationsMetrics({ authTenantId, query: { companyId: 'tenant-a' }, headers: { 'x-company-id': 'tenant-a' } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(calls.length, 0);
  }
});

test('conversation and message metrics use the authenticated company and ignore forged selectors', async () => {
  const { controller, calls } = fixture();
  for (const [companyId, conversations, messages] of [['tenant-a', 11, 8], ['tenant-b', 30, 19], ['default', 3, 2]]) {
    const res = response();
    await controller.getOperationsMetrics({ authTenantId: companyId, query: { companyId: 'forged' }, headers: { 'x-company-id': 'forged' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.metrics.totalConversations, conversations);
    assert.equal(res.body.data.metrics.messagesToday, messages);
    const companyQueries = calls.slice(-2);
    assert.equal(companyQueries.length, 2);
    for (const call of companyQueries) {
      assert.match(call.sql, /WHERE\s+company_id\s*=\s*\$2/);
      assert.equal(call.params.length, 2);
      assert.equal(call.params[1], companyId);
    }
  }
});

test('operations expose measured counts and mark unmeasured indicators unavailable', async () => {
  const { controller } = fixture();
  const res = response();
  await controller.getOperationsMetrics({ authTenantId: 'tenant-a' }, res);
  assert.equal(res.statusCode, 200);
  const { data } = res.body;
  assert.equal(data.queue.totalWaiting, 2);
  assert.equal(data.operators.length, 0);
  assert.equal(data.queue.averageWaitSeconds, null);
  assert.equal(data.queue.slaCompliancePercent, null);
  assert.equal(data.queue.slaStatus, 'unavailable');
  for (const metric of ['avgResponseTimeSeconds', 'avgHandlingTimeMinutes', 'slaCompliancePercent', 'transfersToday', 'productivityIndex']) {
    assert.equal(data.metrics[metric], null, metric);
  }
  assert.equal(data.metrics.incomingMessagesToday, 5);
  assert.equal(data.metrics.outgoingMessagesToday, 3);
});

test('open conversation metrics include the canonical open status and legacy active status', async () => {
  const { controller, calls } = fixture();
  await controller.getOperationsMetrics({ authTenantId: 'tenant-a' }, response());
  assert.match(calls[0].sql, /status\s+IN\s*\(\s*'open'\s*,\s*'active'\s*\)/i);
});

test('operations database failures return an error instead of fabricated fallback data', async () => {
  const { controller } = fixture({ fail: true });
  const res = response();
  await controller.getOperationsMetrics({ authTenantId: 'tenant-a' }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data, undefined);
});
