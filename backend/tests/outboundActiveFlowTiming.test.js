const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(items) {
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/outboundQueueService'), 'utf8') + '\nqueueState.items = testQueueItems;', {
    module: mod, exports: mod.exports, __dirname: path.dirname(require.resolve('../services/outboundQueueService')),
    require: name => (name === 'path' ? path : {}), process: { env: {} }, testQueueItems: items,
  });
  return mod.exports;
}

const base = { companyId: 'c', sessionId: 's', phone: '5511', state: 'queued', createdAt: '2026-01-01T00:00:00.000Z' };
const step = (n, extra = {}) => ({ ...base, id: `i${n}`, nextAttemptAt: new Date(1_800_000_000_000 + n * 5000).toISOString(),
  metadata: { isFlowStep: true, conversationId: 'conv', flowRunId: 'run', currentStep: n, totalSteps: 4, stepDelayMs: 5000, ...extra } });

test('getActiveFlow exposes sent-count, real nextSendAt and step delay', () => {
  const q = load([step(3), step(4), { ...step(1), state: 'sent' }, { ...step(2), state: 'sent' }]);
  const flow = q.getActiveFlow({ companyId: 'c', sessionId: 's', conversationId: 'conv' });
  assert.equal(flow.currentStep, 2); // 2 already sent, step 3 pending
  assert.equal(flow.totalSteps, 4);
  assert.equal(flow.nextSendAt, 1_800_000_000_000 + 3 * 5000);
  assert.equal(flow.stepDelaySeconds, 5);
  assert.equal(flow.isPaused, false);
});

test('getActiveFlow: paused flow has no nextSendAt; other conversation/tenant ignored', () => {
  const q = load([step(1, {}), { ...step(2), isPaused: true }, { ...step(1), id: 'x', companyId: 'other' }]);
  assert.equal(q.getActiveFlow({ companyId: 'c', sessionId: 's', conversationId: 'conv' }).currentStep, 0);
  const paused = load([{ ...step(2), isPaused: true }]).getActiveFlow({ companyId: 'c', sessionId: 's', conversationId: 'conv' });
  assert.equal(paused.nextSendAt, null);
  assert.equal(paused.isPaused, true);
  assert.equal(q.getActiveFlow({ companyId: 'c', sessionId: 's', conversationId: 'nope' }), null);
});
