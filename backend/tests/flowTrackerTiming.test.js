const assert = require('node:assert/strict');
const test = require('node:test');

test('flow tracker carries sent-count (starts at 0) and real next send time', () => {
  delete require.cache[require.resolve('../services/flowTrackerService')];
  const tracker = require('../services/flowTrackerService');
  const events = [];
  global.io = { to: room => ({ emit: (name, payload) => events.push({ name, payload }) }) };
  const scope = { companyId: 'c', sessionId: 's', conversationId: 'conv', flowRunId: 'run' };

  const started = tracker.startFlow({ chatId: '5511', flowName: 'F', totalSteps: 3, ...scope });
  assert.equal(started.currentStep, 0);
  assert.equal(started.nextSendAt, null);

  const at = Date.now() + 7000;
  tracker.updateFlowStep({ chatId: '5511', currentStep: 1, status: 'delivered', nextSendAt: at, stepDelaySeconds: 7, ...scope });
  const updated = events.find(e => e.name === 'flow:step_updated').payload;
  assert.equal(updated.currentStep, 1);
  assert.equal(updated.nextSendAt, at);
  assert.equal(updated.stepDelaySeconds, 7);

  // omitted timing keeps previous; explicit null clears
  tracker.updateFlowStep({ chatId: '5511', currentStep: 2, ...scope });
  assert.equal(tracker.getRunningFlow('5511', scope).nextSendAt, at);
  tracker.updateFlowStep({ chatId: '5511', currentStep: 2, nextSendAt: null, ...scope });
  assert.equal(tracker.getRunningFlow('5511', scope).nextSendAt, null);
  tracker.finishFlow('5511', scope);
  delete global.io;
});

test('startFlow keeps the first step real send time so the timer is visible from the start', () => {
  delete require.cache[require.resolve('../services/flowTrackerService')];
  const tracker = require('../services/flowTrackerService');
  global.io = { to: () => ({ emit() {} }) };
  const at = Date.now() + 8000;
  const started = tracker.startFlow({ chatId: '5512', flowName: 'F', totalSteps: 2, companyId: 'c', sessionId: 's', conversationId: 'conv2', flowRunId: 'run2', nextSendAt: at, stepDelaySeconds: 8 });
  assert.equal(started.nextSendAt, at);
  assert.equal(started.stepDelaySeconds, 8);
});
