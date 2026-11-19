const test = require('node:test');
const assert = require('node:assert/strict');

function stub(modPath, exports) {
  const id = require.resolve(modPath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

// Global in-memory storage for queue persistence simulation
let persistedData = { items: [], version: 1 };
let simulatedRenameErrorCount = 0;
let simulatedRenameErrorsToThrow = 0;
let simulatedRenameErrorCode = 'EBUSY';
let activeConcurrentSends = 0;
let peakConcurrentSends = 0;
let perPhoneInFlight = new Map();
let phoneConcurrencyViolations = 0;
let orderViolations = 0;
let phoneSequenceLog = new Map();
let unlinkedTmpFiles = [];

// Persistent stable mock socket
const sharedMockSock = { id: 'mock-baileys-socket' };

// Stub filesystem for deterministic fast stress testing
stub('fs/promises', {
  mkdir: async () => {},
  access: async () => {},
  readFile: async () => JSON.stringify(persistedData),
  writeFile: async (_p, text) => {
    persistedData = JSON.parse(text);
  },
  rename: async (src, dst) => {
    if (simulatedRenameErrorsToThrow > 0) {
      simulatedRenameErrorsToThrow--;
      simulatedRenameErrorCount++;
      const err = new Error(`Simulated Windows file contention: ${simulatedRenameErrorCode}`);
      err.code = simulatedRenameErrorCode;
      throw err;
    }
  },
  unlink: async (p) => {
    unlinkedTmpFiles.push(p);
  },
});

stub('../src/data/store/messageStore', {
  addMessage: (phone, data) => ({ id: `mem-${phone}-${Date.now()}` }),
});
stub('../src/api/controllers/messages', {
  registerOutgoingMessage: async () => ({ message: { id: 'db-msg-id' } }),
});
stub('../src/api/controllers/messagesController', {
  registerOutgoingMessage: async () => ({ message: { id: 'db-msg-id' } }),
});
stub('../services/aiReplyGuard', {
  getAutomatedReplyPermission: async () => ({ allowed: true }),
});
stub('../services/correlationTracker', new Proxy({
  generateMessageTraceId: () => `trace-${Math.random().toString(36).slice(2, 8)}`,
  traceLog: () => {},
  startTrace: () => ({ traceId: 't-1', finish() {} }),
  getTrace: () => null,
  endTrace: () => {},
}, {
  get: (t, k) => (k in t ? t[k] : () => undefined),
}));
stub('../services/messageAckPipeline', {
  ACK_STATES: { PENDING: 'pending', DELIVERED: 'delivered' },
  transitionAck: () => {},
  registerDbMapping: () => {},
  getAckState: () => null,
  emitAckUpdate: () => {},
});
stub('../src/infrastructure/config/database', {
  query: async () => ({ rows: [{ session_id: 'wa-adversarial' }] }),
});
stub('../services/enterprise/media-service', {
  normalizeMediaReference: v => v,
  canAccessMedia: async () => true,
  findMediaFile: async () => '/tmp/file.png',
});

stub('../services/sessionManager', {
  DEFAULT_SESSION: 'main',
  normalizeSessionName: v => v,
  isRuntimeActive: () => true,
  getSession: () => ({
    sessionId: 'wa-adversarial',
    companyId: 'tenant-adv',
    status: 'connected',
    systemConnected: true,
    automationPaused: false,
    sock: sharedMockSock,
  }),
});

// Dynamic delegate for whatsappService - stubbed BEFORE requiring outboundQueueService
let currentSendMessage = async () => ({ key: { id: 'wa-default-id' } });

stub('../services/whatsappService', {
  normalizePhone: v => String(v).split('@')[0],
  sendMessage: async (...args) => currentSendMessage(...args),
});

process.env.OUTBOUND_QUEUE_CONCURRENCY = '4';
process.env.OUTBOUND_QUEUE_ALLOW_TEST_HOOKS = 'true';
const queue = require('../services/outboundQueueService');

async function resetQueue(initialItems = []) {
  persistedData = { items: initialItems, version: 1 };
  simulatedRenameErrorCount = 0;
  simulatedRenameErrorsToThrow = 0;
  activeConcurrentSends = 0;
  peakConcurrentSends = 0;
  perPhoneInFlight = new Map();
  phoneConcurrencyViolations = 0;
  orderViolations = 0;
  phoneSequenceLog = new Map();
  unlinkedTmpFiles = [];
  await queue.initializeOutboundQueue({ store: { databaseEnabled: false } });
  await queue.shutdownOutboundQueue();
}

async function drainQueue(companyId = 'tenant-adv', maxWaitMs = 10000) {
  const start = Date.now();
  while (true) {
    const pending = queue.listPending(200, companyId);
    if (pending.length === 0) {
      break;
    }
    // Pump parallel workers up to concurrency limit
    await Promise.all([
      queue.processOneItem(),
      queue.processOneItem(),
      queue.processOneItem(),
      queue.processOneItem(),
    ]);
    await new Promise(r => setTimeout(r, 15));
    if (Date.now() - start > maxWaitMs) {
      const summary = pending.map(i => ({ id: i.id, phone: i.phone, state: i.state, lastFailure: i.lastFailure }));
      throw new Error(`Queue drain timed out after ${maxWaitMs}ms! Remaining: ${JSON.stringify(summary)}`);
    }
  }
  // Allow any trailing saveQueueState microtasks to complete
  await new Promise(r => setTimeout(r, 50));
}

test('ADVERSARIAL STRESS 1: Rapid parallel bursts across 30 distinct recipients respects concurrency pool without deadlocks', async () => {
  await resetQueue();

  currentSendMessage = async (sock, phone, text) => {
    activeConcurrentSends++;
    if (activeConcurrentSends > peakConcurrentSends) {
      peakConcurrentSends = activeConcurrentSends;
    }

    // Simulate variable network dispatch latency (15-30ms)
    await new Promise(resolve => setTimeout(resolve, 15 + Math.floor(Math.random() * 15)));

    activeConcurrentSends--;
    return { key: { id: `wa-burst-${phone}`, remoteJid: `${phone}@s.whatsapp.net` } };
  };

  const RECIPIENT_COUNT = 30;
  const payloads = Array.from({ length: RECIPIENT_COUNT }, (_, i) => ({
    phone: `551191000${String(i).padStart(4, '0')}`,
    text: `Adversarial stress message ${i}`,
    companyId: 'tenant-adv',
    sessionId: 'wa-adversarial',
    correlationId: `corr-burst-${i}`,
    nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
    metadata: { conversationId: `conv-burst-${i}` },
  }));

  // Enqueue 30 distinct messages simultaneously
  await Promise.all(payloads.map(p => queue.enqueue(p)));
  assert.equal(persistedData.items.length, RECIPIENT_COUNT, 'All 30 items enqueued');

  // Drain the queue under high concurrency
  await drainQueue('tenant-adv');

  // Verification assertions
  assert.equal(queue.listPending(100, 'tenant-adv').length, 0, 'No items pending');
  const sentItems = persistedData.items.filter(it => it.state === 'sent');
  assert.equal(sentItems.length, RECIPIENT_COUNT, `Expected all ${RECIPIENT_COUNT} messages to reach state SENT`);
  assert.ok(peakConcurrentSends <= 4, `Peak concurrent dispatches (${peakConcurrentSends}) must not exceed MAX_CONCURRENT_DISPATCHES (4)`);
  assert.ok(peakConcurrentSends > 1, `Worker actually processed concurrently (peak concurrent sends: ${peakConcurrentSends})`);
});

test('ADVERSARIAL STRESS 2: Per-phone sequential dispatch invariant strictly maintained under heavy parallel load', async () => {
  await resetQueue();

  const PHONES = ['551199990001', '551199990002', '551199990003', '551199990004'];
  const MSGS_PER_PHONE = 5;

  currentSendMessage = async (sock, phone, text) => {
    // Invariant check: ensure no two concurrent dispatches to the same phone
    const inFlight = perPhoneInFlight.get(phone) || 0;
    if (inFlight > 0) {
      phoneConcurrencyViolations++;
    }
    perPhoneInFlight.set(phone, inFlight + 1);

    // Sequence check: ensure message 1 arrives before 2, 2 before 3, etc.
    const seq = parseInt(text.split('#')[1], 10);
    const prevSeq = phoneSequenceLog.get(phone) || 0;
    if (seq !== prevSeq + 1) {
      orderViolations++;
    }
    phoneSequenceLog.set(phone, seq);

    // Async latency
    await new Promise(r => setTimeout(r, 20 + Math.floor(Math.random() * 20)));

    perPhoneInFlight.set(phone, (perPhoneInFlight.get(phone) || 1) - 1);
    return { key: { id: `wa-phone-${phone}-${seq}`, remoteJid: `${phone}@s.whatsapp.net` } };
  };

  const allPayloads = [];
  for (const phone of PHONES) {
    for (let seq = 1; seq <= MSGS_PER_PHONE; seq++) {
      allPayloads.push({
        phone,
        text: `PhoneMsg #${seq}`,
        companyId: 'tenant-adv',
        sessionId: 'wa-adversarial',
        correlationId: `corr-seq-${phone}-${seq}`,
        nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
        metadata: { conversationId: `conv-${phone}` },
      });
    }
  }

  // Enqueue in batch
  await queue.enqueueBatch(allPayloads);
  assert.equal(persistedData.items.length, PHONES.length * MSGS_PER_PHONE);

  // Drain the queue with concurrent worker pump
  await drainQueue('tenant-adv');

  assert.equal(phoneConcurrencyViolations, 0, `Per-phone serialization invariant violated! ${phoneConcurrencyViolations} concurrent dispatches detected to the same phone`);
  assert.equal(orderViolations, 0, `FIFO order violated! ${orderViolations} out-of-order dispatches detected`);
  for (const phone of PHONES) {
    assert.equal(phoneSequenceLog.get(phone), MSGS_PER_PHONE, `Phone ${phone} did not receive all ${MSGS_PER_PHONE} messages in order`);
  }
});

test('ADVERSARIAL STRESS 3: Windows atomic rename retry survives transient EBUSY / EPERM contention and cleans up on fatal failure', async () => {
  await resetQueue();

  // Test 3.1: Transient EBUSY error on rename succeeds on retry
  simulatedRenameErrorsToThrow = 1;
  simulatedRenameErrorCode = 'EBUSY';

  const item1 = await queue.enqueue({
    phone: '5511988880001',
    text: 'Test transient EBUSY',
    companyId: 'tenant-adv',
    sessionId: 'wa-adversarial',
    correlationId: 'corr-ebusy-1',
  });

  assert.ok(item1.id, 'Item successfully enqueued despite transient EBUSY');
  assert.equal(simulatedRenameErrorCount, 1, 'Rename encountered 1 transient error and successfully retried');

  // Test 3.2: Transient EPERM error on rename succeeds on retry
  simulatedRenameErrorsToThrow = 1;
  simulatedRenameErrorCode = 'EPERM';

  const item2 = await queue.enqueue({
    phone: '5511988880002',
    text: 'Test transient EPERM',
    companyId: 'tenant-adv',
    sessionId: 'wa-adversarial',
    correlationId: 'corr-eperm-2',
  });

  assert.ok(item2.id, 'Item successfully enqueued despite transient EPERM');
  assert.equal(simulatedRenameErrorCount, 2, 'Rename encountered second transient error and successfully retried');

  // Let background microtasks settle
  await new Promise(r => setTimeout(r, 60));

  // Test 3.3: Fatal contention (retry also fails) causes rejection and cleans up temp file
  simulatedRenameErrorsToThrow = 2; // Fails original + retry
  simulatedRenameErrorCode = 'EBUSY';
  unlinkedTmpFiles = [];

  await assert.rejects(
    queue.enqueue({
      phone: '5511988880003',
      text: 'Test permanent failure',
      companyId: 'tenant-adv',
      sessionId: 'wa-adversarial',
      correlationId: 'corr-fatal-3',
    }),
    /Simulated Windows file contention: EBUSY/
  );

  assert.ok(unlinkedTmpFiles.length > 0, 'Temporary file was safely unlinked on fatal rename failure');
});

test('ADVERSARIAL STRESS 4: Worker pool self-heals when a dispatch throws unhandled exception without leaking worker slots', async () => {
  await resetQueue();

  currentSendMessage = async (sock, phone, text) => {
    if (text.includes('CRASH')) {
      throw Object.assign(new Error('Fatal transport connection reset'), {
        code: 'ECONNRESET',
        nonRetryable: true,
      });
    }
    return { key: { id: `wa-ok-${phone}`, remoteJid: `${phone}@s.whatsapp.net` } };
  };

  // Enqueue 1 crashing item, followed by 3 healthy items
  await queue.enqueue({
    phone: '5511977770001',
    text: 'CRASH item',
    companyId: 'tenant-adv',
    sessionId: 'wa-adversarial',
    correlationId: 'corr-crash-1',
    nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
  });

  for (let i = 2; i <= 4; i++) {
    await queue.enqueue({
      phone: `551197777000${i}`,
      text: `Healthy item ${i}`,
      companyId: 'tenant-adv',
      sessionId: 'wa-adversarial',
      correlationId: `corr-healthy-${i}`,
      nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
    });
  }

  // Drain the queue
  await drainQueue('tenant-adv');

  // Assertions: healthy items SENT, crash item DEAD_LETTER, 0 stuck in PROCESSING
  const processing = persistedData.items.filter(it => it.state === 'processing');
  assert.equal(processing.length, 0, 'No item stuck in PROCESSING state (worker slot released)');

  const sent = persistedData.items.filter(it => it.state === 'sent');
  assert.equal(sent.length, 3, 'All 3 healthy items were sent');

  const dlq = persistedData.items.filter(it => it.state === 'dead_letter');
  assert.equal(dlq.length, 1, 'Crashing item cleanly moved to dead_letter');
  assert.equal(dlq[0].lastFailure.code, 'ECONNRESET');
});
