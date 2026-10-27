const test = require('node:test');
const assert = require('node:assert/strict');
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
let persisted = { items: [], version: 1 };
let failWrites = false;
let sessionOwner = 'tenant-a';
let sessionStatus = 'connected';
let sessionAutomationPaused = false;
const queueSock = {};
let sendCalls = 0;
stub('fs/promises', { mkdir: async () => {}, access: async () => {}, readFile: async () => JSON.stringify(persisted), writeFile: async (_path, text) => { if (failWrites) throw new Error('disk failed'); persisted = JSON.parse(text); }, rename: async () => {} });
stub('../src/data/store/messageStore', { addMessage: () => ({ id: 'message-a' }) });
stub('../services/sessionManager', { DEFAULT_SESSION: 'main', normalizeSessionName: value => value, isRuntimeActive: () => true, getSession: () => ({ sessionId: 'wa-a', companyId: sessionOwner, status: sessionStatus, automationPaused: sessionAutomationPaused, sock: queueSock }) });
stub('../services/whatsappService', { normalizePhone: value => String(value).split('@')[0], sendMessage: async () => { sendCalls++; return { key: { id: 'wa-message', remoteJid: '5511888888888@s.whatsapp.net' } }; } });
stub('../src/api/controllers/messages', { registerOutgoingMessage: async () => ({ message: { id: 'message-a' } }) });
stub('../src/api/controllers/messagesController', { registerOutgoingMessage: async () => ({ message: { id: 'message-a' } }) });
stub('../services/aiReplyGuard', { getAutomatedReplyPermission: async () => ({ allowed: true }) });
stub('../services/correlationTracker', { generateMessageTraceId: () => Math.random().toString(), traceLog() {}, startTrace: () => ({ traceId: 't-1', finish() {} }), getTrace: () => null, endTrace() {} });
stub('../services/messageAckPipeline', { ACK_STATES: { PENDING: 'pending' }, transitionAck() {}, registerDbMapping() {}, getAckState: () => null, emitAckUpdate() {} });
stub('../src/infrastructure/config/database', { query: async () => ({ rows: [{ session_id: 'wa-a' }] }) });
let mediaAllowed = true;
stub('../services/enterprise/media-service', { normalizeMediaReference: value => value, canAccessMedia: async () => mediaAllowed, findMediaFile: async () => '/owned/file.jpg' });
const queue = require('../services/outboundQueueService');
test.beforeEach(async () => { persisted = { items: [], version: 1 }; failWrites = false; sessionOwner = 'tenant-a'; sessionStatus = 'connected'; sessionAutomationPaused = false; sendCalls = 0; await queue.initializeOutboundQueue({ store: { databaseEnabled: true } }); await queue.shutdownOutboundQueue(); });
const payload = (overrides = {}) => ({ phone: '5511888888888', text: 'Teste', companyId: 'tenant-a', sessionId: 'wa-a', correlationId: 'request-a', nextAttemptAt: new Date(Date.now() + 60000).toISOString(), metadata: { conversationId: 'conv-a', isFlowStep: true, currentStep: 1, totalSteps: 2 }, ...overrides });

test('queue idempotency includes company, session, conversation and individual flow step', async () => {
  const first = await queue.enqueue(payload());
  const duplicate = await queue.enqueue(payload());
  assert.equal(first.id, duplicate.id);
  const otherTenant = await queue.enqueue(payload({ companyId: 'tenant-b' }));
  const otherConversation = await queue.enqueue(payload({ metadata: { conversationId: 'conv-b' } }));
  const secondStep = await queue.enqueue(payload({ correlationId: 'request-a:2' }));
  assert.notEqual(first.id, otherTenant.id);
  assert.notEqual(first.id, otherConversation.id);
  assert.notEqual(first.id, secondStep.id);
  assert.equal(persisted.items.length, 4);
});

test('future scheduled steps are not processed early', async () => {
  await queue.enqueueBatch([payload(), payload({ correlationId: 'request-a:2' })]);
  await queue.processOneItem();
  assert.equal(sendCalls, 0);
  assert.equal(queue.listPending().length, 2);
});

test('failed persistence rolls back the entire batch so a retry can be accepted', async () => {
  failWrites = true;
  await assert.rejects(queue.enqueueBatch([payload(), payload({ correlationId: 'request-a:2' })]), /disk failed/);
  assert.equal(queue.listPending().length, 0);
  failWrites = false;
  const retried = await queue.enqueueBatch([payload(), payload({ correlationId: 'request-a:2' })]);
  assert.equal(retried.length, 2);
  assert.equal(persisted.items.length, 2);
});

test('cancelling a flow cannot cancel another company or conversation with the same phone', async () => {
  await queue.enqueueBatch([payload(), payload({ companyId: 'tenant-b' }), payload({ metadata: { conversationId: 'conv-b', isFlowStep: true } })]);
  assert.equal(await queue.cancelFlowItems({ companyId: 'tenant-a', sessionId: 'wa-a', conversationId: 'conv-a', phone: '5511888888888' }), 1);
  assert.equal(queue.listPending().length, 2);
  assert.equal(persisted.items.filter(item => item.state === 'cancelled').length, 1);
});

test('worker never uses a socket belonging to a different company', async () => {
  sessionOwner = 'tenant-b';
  const accepted = await queue.enqueue(payload({ nextAttemptAt: new Date().toISOString() }));
  await new Promise(resolve => setTimeout(resolve, 10));
  await queue.processOneItem();
  assert.equal(sendCalls, 0);
  assert.equal(queue.listDeadLetter().find(item => item.id === accepted.id).lastFailure.code, 'SESSION_FORBIDDEN');
});

test('disconnected session queue items stay paused until explicit reactivation', async () => {
  sessionStatus = 'disconnected';
  sessionAutomationPaused = true;
  await queue.enqueue(payload({ nextAttemptAt: new Date().toISOString() }));
  await queue.pauseSessionItems({ companyId: 'tenant-a', sessionId: 'wa-a' });
  sessionStatus = 'connected';
  await queue.processOneItem();
  assert.equal(sendCalls, 0);
  assert.equal(persisted.items[0].sessionPaused, true);
  sessionAutomationPaused = false;
  assert.equal(await queue.resumeSessionItems({ companyId: 'tenant-a', sessionId: 'wa-a' }), 1);
  await queue.processOneItem();
  assert.equal(sendCalls, 1);
});

test('contact approval resumes only matching work while the session remains paused', async () => {
  sessionAutomationPaused = true;
  await queue.enqueue(payload({ correlationId: 'review-a', nextAttemptAt: new Date().toISOString() }));
  await queue.enqueue(payload({ phone: '5511777777777', correlationId: 'review-b', nextAttemptAt: new Date().toISOString() }));
  await queue.pauseSessionItems({ companyId: 'tenant-a', sessionId: 'wa-a' });

  assert.equal(await queue.resumeContactItems({ companyId: 'tenant-a', sessionId: 'wa-a', phone: '5511888888888' }), 1);
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.equal(sendCalls, 1);
  assert.equal(sessionAutomationPaused, true);
  assert.notEqual(persisted.items.find(item => item.correlationId === 'review-a').sessionPaused, true);
  assert.equal(persisted.items.find(item => item.correlationId === 'review-b').sessionPaused, true);
});

test('cancelling a contact leaves other paused contacts untouched', async () => {
  sessionAutomationPaused = true;
  await queue.enqueue(payload({ correlationId: 'cancel-a', nextAttemptAt: new Date().toISOString() }));
  await queue.enqueue(payload({ phone: '5511777777777', correlationId: 'cancel-b', nextAttemptAt: new Date().toISOString() }));
  await queue.pauseSessionItems({ companyId: 'tenant-a', sessionId: 'wa-a' });

  assert.equal(await queue.cancelContactItems({ companyId: 'tenant-a', sessionId: 'wa-a', phone: '5511888888888' }), 1);
  await queue.processOneItem();

  assert.equal(sendCalls, 0);
  assert.equal(persisted.items.find(item => item.correlationId === 'cancel-a').state, 'cancelled');
  assert.equal(persisted.items.find(item => item.correlationId === 'cancel-b').sessionPaused, true);
});

test('a batch containing another tenant media is never accepted', async () => {
  mediaAllowed = false;
  await assert.rejects(queue.enqueueBatch([payload(), payload({ correlationId: 'media-b', mediaType: 'image', mediaPath: '/upload/private-b.jpg' })]), error => error.code === 'MEDIA_FORBIDDEN');
  assert.equal(persisted.items.length, 0);
  assert.equal(queue.listPending().length, 0);
  mediaAllowed = true;
});

test('manual messages and quick replies are never paused when session automation is paused', async () => {
  sessionAutomationPaused = true;
  const manual = await queue.enqueue(payload({
    correlationId: 'manual-human-1',
    nextAttemptAt: new Date().toISOString(),
    metadata: { conversationId: 'conv-a', isManual: true, source: 'human' }
  }));
  const quick = await queue.enqueue(payload({
    correlationId: 'quick-reply-1',
    nextAttemptAt: new Date().toISOString(),
    metadata: { conversationId: 'conv-a', isQuickReply: true, source: 'quick_reply' }
  }));

  // Even if pauseSessionItems is invoked:
  await queue.pauseSessionItems({ companyId: 'tenant-a', sessionId: 'wa-a' });

  assert.equal(manual.sessionPaused, false);
  assert.equal(quick.sessionPaused, false);

  const manualPending = persisted.items.find(i => i.correlationId === 'manual-human-1');
  const quickPending = persisted.items.find(i => i.correlationId === 'quick-reply-1');

  assert.equal(manualPending?.sessionPaused, false);
  assert.equal(quickPending?.sessionPaused, false);

  await new Promise(resolve => setTimeout(resolve, 50));
  await queue.processOneItem();
  assert.equal(sendCalls, 2);
});



test('flow steps strictly execute sequentially and dynamically reschedule subsequent steps', async () => {
  const now = new Date().toISOString();
  const step1 = payload({
    correlationId: 'flow-seq-step-1',
    nextAttemptAt: now,
    metadata: { conversationId: 'conv-a', flowRunId: 'seq-run-1', isFlowStep: true, currentStep: 1, totalSteps: 2, stepDelayMs: 200 }
  });
  const step2 = payload({
    correlationId: 'flow-seq-step-2',
    nextAttemptAt: now,
    metadata: { conversationId: 'conv-a', flowRunId: 'seq-run-1', isFlowStep: true, currentStep: 2, totalSteps: 2, stepDelayMs: 200 }
  });

  await queue.enqueueBatch([step1, step2]);

  // Give the immediate queue microtask time to process step 1
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(sendCalls, 1);

  const queuedStep2 = queue.listPending().find(item => item.correlationId === 'flow-seq-step-2');
  assert.ok(queuedStep2, 'Step 2 must remain pending');
  assert.equal(queuedStep2.state, 'queued');

  // Verify dynamic rescheduling: step 2's nextAttemptAt was rescheduled after step 1 finished
  const scheduledTime = new Date(queuedStep2.nextAttemptAt).getTime();
  assert.ok(scheduledTime >= Date.now() - 50, 'Step 2 must be scheduled relative to Step 1 completion');
});

test('concurrency lock prevents picking a second message for the same phone while one is in-flight', async () => {
  const item1 = await queue.enqueue(payload({
    correlationId: 'in-flight-1',
    nextAttemptAt: new Date().toISOString()
  }));

  // Simulate item 1 entering PROCESSING state
  const rawItem1 = persisted.items.find(i => i.id === item1.id);
  rawItem1.state = 'processing';

  const item2 = await queue.enqueue(payload({
    correlationId: 'in-flight-2',
    nextAttemptAt: new Date().toISOString()
  }));

  // Trying to process another item for the same phone should not pick item2
  const initialSendCalls = sendCalls;
  await queue.processOneItem();
  assert.equal(sendCalls, initialSendCalls, 'Must not dispatch second message to same phone while first is processing');

  const pendingItem2 = queue.listPending().find(i => i.id === item2.id);
  assert.equal(pendingItem2.state, 'queued');
});
