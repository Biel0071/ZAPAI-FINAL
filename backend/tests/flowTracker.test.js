const assert = require('node:assert/strict');
const test = require('node:test');

test('flow tracker emits one immutable realtime event per state transition', () => {
  const trackerPath = require.resolve('../services/flowTrackerService');
  delete require.cache[trackerPath];
  const tracker = require('../services/flowTrackerService');
  const events = [];
  global.io = { emit: (name, payload) => events.push({ name, payload }) };

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
  delete global.io;
});
