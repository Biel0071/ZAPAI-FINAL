const assert = require('node:assert/strict');
const test = require('node:test');

test('flow tracker emits one immutable realtime event per state transition', () => {
  const trackerPath = require.resolve('../services/flowTrackerService');
  delete require.cache[trackerPath];
  const tracker = require('../services/flowTrackerService');
  const events = [];
  global.io = { to: room => ({ emit: (name, payload) => events.push({ room, name, payload }) }) };

  tracker.startFlow({ chatId: '5511888888888', flowName: 'QA', totalSteps: 2 });
  tracker.updateFlowStep({ chatId: '5511888888888', currentStep: 1, status: 'sent' });
  tracker.updateFlowStep({ chatId: '5511888888888', currentStep: 1, status: 'delivered' });
  tracker.finishFlow('5511888888888');

  assert.deepEqual(events.map((event) => event.name), [
    'flow:started',
    'flow:step_updated',
    'flow:step_updated',
    'flow:finished',
  ]);
  assert.deepEqual(events.map((event) => event.payload.status), [
    'preparing',
    'sent',
    'delivered',
    'completed',
  ]);
  assert.equal(new Set(events.map((event) => event.name)).size, 3);
  assert.ok(events.every(event => event.room === 'tenant:default'));
  delete global.io;
});

test('same phone flows are isolated by company, session and conversation', () => {
  const tracker = require('../services/flowTrackerService');
  const first = { companyId: 'tenant-a', sessionId: 'wa-a', conversationId: 'conv-a' };
  const second = { companyId: 'tenant-b', sessionId: 'wa-b', conversationId: 'conv-b' };
  const phone = '5511888888888';
  tracker.startFlow({ chatId: phone, ...first, flowName: 'A' });
  tracker.startFlow({ chatId: phone, ...second, flowName: 'B' });
  assert.equal(tracker.getRunningFlow(phone, first).flowName, 'A');
  tracker.cancelFlow(phone, first);
  assert.equal(tracker.getRunningFlow(phone, first), null);
  assert.equal(tracker.getRunningFlow(phone, second).flowName, 'B');
  tracker.finishFlow(phone, second);
});
