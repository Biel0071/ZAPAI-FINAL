const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function fixture() {
  const calls = [];
  const queueModule = { exports: {} };
  const testQueueItems = [
    { id: 'b-pending', companyId: 'tenant-b', state: 'queued', createdAt: '2026-01-01', updatedAt: '2026-01-10' },
    { id: 'a-pending', companyId: 'tenant-a', state: 'queued', createdAt: '2026-01-02', updatedAt: '2026-01-09' },
    { id: 'a-sent', companyId: 'tenant-a', state: 'sent', createdAt: '2026-01-03', updatedAt: '2026-01-09' },
    { id: 'b-dlq', companyId: 'tenant-b', state: 'dead_letter', createdAt: '2026-01-04', updatedAt: '2026-01-10' },
    { id: 'a-dlq', companyId: 'tenant-a', state: 'dead_letter', createdAt: '2026-01-05', updatedAt: '2026-01-09' },
    { id: 'default-pending', companyId: 'default', state: 'failed', createdAt: '2026-01-06', updatedAt: '2026-01-09' },
    { id: 'default-dlq', companyId: 'default', state: 'dead_letter', createdAt: '2026-01-06', updatedAt: '2026-01-08' },
  ];
  // Load the canonical selectors without starting workers or accessing queue files.
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/outboundQueueService'), 'utf8') + '\nqueueState.items = testQueueItems;', {
    module: queueModule, exports: queueModule.exports, __dirname: path.dirname(require.resolve('../services/outboundQueueService')),
    require: name => name === 'path' ? path : {}, process: { env: {} }, testQueueItems,
  });
  const service = Object.fromEntries(['listPending', 'listDeadLetter'].map(method => [method, (limit, companyId) => {
    calls.push({ method, limit, companyId });
    return queueModule.exports[method](limit, companyId);
  }]));
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/api/controllers/outboundQueueController'), 'utf8'), {
    module, exports: module.exports, require: () => service,
  });
  return { controller: module.exports, calls };
}

for (const [method, suffix] of [['listPending', 'pending'], ['listDeadLetter', 'dlq']]) {
  test(method + ' rejects missing authentication without invoking the queue selector', () => {
    for (const authTenantId of [undefined, '', ' ']) {
      const { controller, calls } = fixture();
      const res = response();
      controller[method]({ authTenantId, query: { companyId: 'tenant-a' }, headers: { 'x-company-id': 'tenant-a' } }, res);
      assert.equal(res.statusCode, 401);
      assert.equal(calls.length, 0);
    }
  });

  test(method + ' isolates companies before applying the limit and ignores forged selectors', () => {
    const { controller, calls } = fixture();
    for (const companyId of ['tenant-a', 'tenant-b', 'default']) {
      const res = response();
      controller[method]({ authTenantId: companyId, query: { limit: '1', companyId: 'forged' }, headers: { 'x-company-id': 'forged' } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.items.length, 1);
      assert.equal(res.body.items[0].id, (companyId === 'default' ? 'default' : companyId.slice(-1)) + '-' + suffix);
      assert.equal(res.body.items[0].companyId, companyId);
      assert.equal(calls.at(-1).companyId, companyId);
      assert.equal(calls.at(-1).limit, 1);
    }
  });
}
