'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

function stubModule(modPath, exportsObj) {
  const resolved = require.resolve(modPath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 1 & 2: Outbound Queue Extreme Concurrency, Serialization & File Lock
// ══════════════════════════════════════════════════════════════════════════════

let persistedQueueState = { items: [], version: 1 };
let simulatedRenameErrors = 0;
let simulatedRenameCode = 'EBUSY';
let unlinkedTmpFiles = [];

let activeConcurrentSends = 0;
let peakConcurrentSends = 0;
let perPhoneInFlight = new Map();
let phoneConcurrencyViolations = 0;
let phoneSequenceViolations = 0;
let phoneSequenceMap = new Map();

const mockBaileysSocket = { id: 'mock-baileys-sock-adv' };

// Stub filesystem for deterministic fast queue persistence
stubModule('fs/promises', {
  mkdir: async () => {},
  access: async () => {},
  readFile: async () => JSON.stringify(persistedQueueState),
  writeFile: async (_p, text) => {
    persistedQueueState = JSON.parse(text);
  },
  rename: async (src, dst) => {
    if (simulatedRenameErrors > 0) {
      simulatedRenameErrors--;
      const err = new Error(`Simulated file contention error: ${simulatedRenameCode}`);
      err.code = simulatedRenameCode;
      throw err;
    }
  },
  unlink: async (p) => {
    unlinkedTmpFiles.push(p);
  },
});

stubModule('../src/data/store/messageStore', {
  addMessage: (phone, data) => ({ id: `mem-${phone}-${Date.now()}` }),
});
stubModule('../src/api/controllers/messages', {
  registerOutgoingMessage: async () => ({ message: { id: 'db-msg-id-adv' } }),
});
stubModule('../src/api/controllers/messagesController', {
  registerOutgoingMessage: async () => ({ message: { id: 'db-msg-id-adv' } }),
});
stubModule('../services/aiReplyGuard', {
  getAutomatedReplyPermission: async () => ({ allowed: true }),
});
stubModule('../services/correlationTracker', new Proxy({
  generateMessageTraceId: () => `trace-${Math.random().toString(36).slice(2, 8)}`,
  traceLog: () => {},
  startTrace: () => ({ traceId: 't-adv', finish() {} }),
  getTrace: () => null,
  endTrace: () => {},
}, {
  get: (t, k) => (k in t ? t[k] : () => undefined),
}));
stubModule('../services/messageAckPipeline', {
  ACK_STATES: { PENDING: 'pending', DELIVERED: 'delivered' },
  transitionAck: () => {},
  registerDbMapping: () => {},
  getAckState: () => null,
  emitAckUpdate: () => {},
});

// Database stub supporting session lookup and customer_orders operations
stubModule('../src/infrastructure/config/database', {
  query: async (text, params = []) => {
    if (String(text).includes('sessions')) {
      return { rows: [{ session_id: 'wa-tier5-session' }] };
    }
    if (String(text).includes('INSERT INTO customer_orders')) {
      const totalAmount = params[9] !== undefined ? Number(params[9]) : 0;
      return {
        rows: [{
          id: params[0] || 'ord_stub_1',
          company_id: params[1],
          order_id: params[4],
          phone: params[3],
          total_amount: totalAmount,
          status: 'pending',
        }],
      };
    }
    return { rows: [] };
  },
  closeDatabase: async () => {},
  pool: { ending: false, end: async () => {} },
});

stubModule('../services/enterprise/media-service', {
  normalizeMediaReference: v => v,
  canAccessMedia: async () => true,
  findMediaFile: async () => '/tmp/file.png',
});
stubModule('../services/sessionManager', {
  DEFAULT_SESSION: 'main',
  normalizeSessionName: v => v,
  isRuntimeActive: () => true,
  getSession: () => ({
    sessionId: 'wa-tier5-session',
    companyId: 'tenant-adv-5',
    status: 'connected',
    systemConnected: true,
    automationPaused: false,
    sock: mockBaileysSocket,
  }),
});

let currentSendMessage = async () => ({ key: { id: 'wa-msg-default' } });

stubModule('../services/whatsappService', {
  normalizePhone: v => String(v).split('@')[0],
  sendMessage: async (...args) => currentSendMessage(...args),
});

process.env.OUTBOUND_QUEUE_CONCURRENCY = '4';
process.env.OUTBOUND_QUEUE_ALLOW_TEST_HOOKS = 'true';
const queueService = require('../services/outboundQueueService');

async function resetQueueHarness(initialItems = []) {
  persistedQueueState = { items: initialItems, version: 1 };
  simulatedRenameErrors = 0;
  unlinkedTmpFiles = [];
  activeConcurrentSends = 0;
  peakConcurrentSends = 0;
  perPhoneInFlight = new Map();
  phoneConcurrencyViolations = 0;
  phoneSequenceViolations = 0;
  phoneSequenceMap = new Map();
  await queueService.initializeOutboundQueue({ store: { databaseEnabled: false } });
  await queueService.shutdownOutboundQueue();
}

async function pumpQueue(companyId = 'tenant-adv-5', maxWaitMs = 12000) {
  const start = Date.now();
  while (true) {
    const pending = queueService.listPending(200, companyId);
    if (pending.length === 0) break;
    await Promise.all([
      queueService.processOneItem(),
      queueService.processOneItem(),
      queueService.processOneItem(),
      queueService.processOneItem(),
    ]);
    await new Promise(r => setTimeout(r, 15));
    if (Date.now() - start > maxWaitMs) {
      throw new Error(`Queue drain timed out! Pending: ${JSON.stringify(pending.map(p => p.id))}`);
    }
  }
  await new Promise(r => setTimeout(r, 50));
}

// ─── TEST 1: Extreme load (50 msgs / 10 recipients) ───────────────────────────
test('ADVERSARIAL 1: 50 messages across 10 recipients strictly honors MAX_CONCURRENT_DISPATCHES and per-phone lock', async () => {
  await resetQueueHarness();

  currentSendMessage = async (sock, phone, text) => {
    activeConcurrentSends++;
    if (activeConcurrentSends > peakConcurrentSends) {
      peakConcurrentSends = activeConcurrentSends;
    }

    // Per-phone lock invariant check: NEVER more than 1 in flight to the same phone
    const currentInFlight = perPhoneInFlight.get(phone) || 0;
    if (currentInFlight > 0) {
      phoneConcurrencyViolations++;
    }
    perPhoneInFlight.set(phone, currentInFlight + 1);

    // Sequence check (FIFO per recipient)
    const match = text.match(/seq=(\d+)/);
    const seq = match ? parseInt(match[1], 10) : 0;
    const lastSeq = phoneSequenceMap.get(phone) || 0;
    if (seq !== lastSeq + 1) {
      phoneSequenceViolations++;
    }
    phoneSequenceMap.set(phone, seq);

    // Simulate network latency (20-35ms)
    await new Promise(resolve => setTimeout(resolve, 20 + Math.floor(Math.random() * 15)));

    perPhoneInFlight.set(phone, (perPhoneInFlight.get(phone) || 1) - 1);
    activeConcurrentSends--;
    return { key: { id: `wa-id-${phone}-${seq}`, remoteJid: `${phone}@s.whatsapp.net` } };
  };

  const RECIPIENT_COUNT = 10;
  const MSGS_PER_RECIPIENT = 5;
  const TOTAL_MSGS = RECIPIENT_COUNT * MSGS_PER_RECIPIENT; // 50 messages

  const allPayloads = [];
  for (let r = 1; r <= RECIPIENT_COUNT; r++) {
    const phone = `551199000${String(r).padStart(4, '0')}`;
    for (let m = 1; m <= MSGS_PER_RECIPIENT; m++) {
      allPayloads.push({
        phone,
        text: `BatchLoad message seq=${m} for recipient=${r}`,
        companyId: 'tenant-adv-5',
        sessionId: 'wa-tier5-session',
        correlationId: `corr-recip-${r}-msg-${m}`,
        nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
        metadata: { conversationId: `conv-${r}` },
      });
    }
  }

  // Enqueue in batch (representing 50 incoming messages staged for dispatch)
  await queueService.enqueueBatch(allPayloads);
  assert.equal(persistedQueueState.items.length, TOTAL_MSGS, 'All 50 items persisted in queue');

  // Drain the queue under 4-worker concurrency pump
  await pumpQueue('tenant-adv-5');

  // Verification assertions
  assert.equal(phoneConcurrencyViolations, 0, `Per-phone lock violated! ${phoneConcurrencyViolations} concurrent dispatches to the same phone`);
  assert.equal(phoneSequenceViolations, 0, `Sequence ordering violated! ${phoneSequenceViolations} out-of-order dispatches`);
  assert.ok(peakConcurrentSends <= 4, `Peak dispatches (${peakConcurrentSends}) must not exceed MAX_CONCURRENT_DISPATCHES (4)`);
  assert.ok(peakConcurrentSends > 1, `Parallelism verified: peak concurrent dispatches was ${peakConcurrentSends}`);

  const sentItems = persistedQueueState.items.filter(it => it.state === 'sent');
  assert.equal(sentItems.length, TOTAL_MSGS, 'All 50 items reached terminal state SENT');
  for (let r = 1; r <= RECIPIENT_COUNT; r++) {
    const phone = `551199000${String(r).padStart(4, '0')}`;
    assert.equal(phoneSequenceMap.get(phone), MSGS_PER_RECIPIENT, `Phone ${phone} did not complete all ${MSGS_PER_RECIPIENT} messages`);
  }
});

// ─── TEST 2: File locking simulation (EBUSY contention) ──────────────────────
test('ADVERSARIAL 2: Atomic queue persistence handles transient EBUSY contention via Windows retry and unlinks tmp file on fatal error', async () => {
  await resetQueueHarness();

  // Subcase 2.1: Transient EBUSY (1 failure, then retry succeeds)
  simulatedRenameErrors = 1;
  simulatedRenameCode = 'EBUSY';

  const item1 = await queueService.enqueue({
    phone: '5511988880001',
    text: 'Test transient EBUSY resilience',
    companyId: 'tenant-adv-5',
    sessionId: 'wa-tier5-session',
    correlationId: 'corr-ebusy-adv-1',
  });
  assert.ok(item1.id, 'Enqueue succeeded despite 1 transient EBUSY rename collision');

  // Subcase 2.2: Transient EPERM (1 failure, retry succeeds)
  await new Promise(r => setTimeout(r, 60));
  simulatedRenameErrors = 1;
  simulatedRenameCode = 'EPERM';

  const item2 = await queueService.enqueue({
    phone: '5511988880002',
    text: 'Test transient EPERM resilience',
    companyId: 'tenant-adv-5',
    sessionId: 'wa-tier5-session',
    correlationId: 'corr-eperm-adv-2',
  });
  assert.ok(item2.id, 'Enqueue succeeded despite 1 transient EPERM rename collision');

  // Subcase 2.3: Fatal contention (2 failures exhausts the 1 retry)
  await new Promise(r => setTimeout(r, 60));
  simulatedRenameErrors = 2;
  simulatedRenameCode = 'EBUSY';
  unlinkedTmpFiles = [];

  await assert.rejects(
    queueService.enqueue({
      phone: '5511988880003',
      text: 'Test fatal EBUSY contention',
      companyId: 'tenant-adv-5',
      sessionId: 'wa-tier5-session',
      correlationId: 'corr-fatal-adv-3',
    }),
    /Simulated file contention error: EBUSY/
  );

  assert.ok(unlinkedTmpFiles.length > 0, 'Temporary file was safely unlinked after fatal rename failure');
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 3: Malformed Cart Order Payloads (CartOrderListener & OrderConfirmationEngine)
// ══════════════════════════════════════════════════════════════════════════════

test('ADVERSARIAL 3: Malformed cart order payloads normalize safely without crashes', async () => {
  const cartOrderListener = require('../services/commerce/CartOrderListener');
  const orderConfirmationEngine = require('../services/commerce/OrderConfirmationEngine');

  // Subcase 3.1: CartOrderListener with missing products & IQ lookup error -> produces fallback items
  const mockFailingSock = {
    getOrderDetails: async () => {
      throw new Error('Meta IQ Query Service Unavailable');
    },
  };

  const malformedOrderMsg = {
    key: {
      remoteJid: '5511977665544@s.whatsapp.net',
      id: 'wamid_malformed_1',
    },
    message: {
      orderMessage: {
        orderId: null, // missing orderId
        token: null, // missing token
        itemCount: 0, // zero item count
        totalAmount1000: '0', // zero amount
        totalCurrencyCode: null, // missing currency
        orderTitle: null,
      },
    },
  };

  const parsedOrder = await cartOrderListener.handleIncomingOrder(mockFailingSock, malformedOrderMsg, {
    companyId: 'default',
  });

  assert.ok(parsedOrder !== null, 'Handled without null crash');
  assert.ok(parsedOrder.orderId.startsWith('order_'), 'Auto-generated fallback orderId');
  assert.equal(parsedOrder.currency, 'BRL', 'Defaulted currency to BRL');
  assert.equal(parsedOrder.totalAmount, 0, 'Normalized zero totalAmount');
  assert.equal(parsedOrder.items.length, 1, 'Created 1 fallback item descriptor');
  assert.equal(parsedOrder.items[0].currency, 'BRL');

  // Subcase 3.2: CartOrderListener with negative totalAmount1000
  const negativeAmountMsg = {
    key: {
      remoteJid: '5511977665544@s.whatsapp.net',
      id: 'wamid_neg_1',
    },
    message: {
      orderMessage: {
        orderId: 'ORD_NEG_TEST',
        totalAmount1000: -50000, // Negative amount
        itemCount: -2,
        totalCurrencyCode: 'BRL',
      },
    },
  };

  const parsedNegative = await cartOrderListener.handleIncomingOrder(mockFailingSock, negativeAmountMsg, {
    companyId: 'default',
  });
  assert.equal(parsedNegative.totalAmount, 0, 'Negative amount clamped/normalized to 0');

  // Subcase 3.3: OrderConfirmationEngine.createOrder validation rejection
  await assert.rejects(
    orderConfirmationEngine.createOrder({ phone: '', items: [{ name: 'Item', price: 10 }] }),
    /Customer phone is required/
  );

  await assert.rejects(
    orderConfirmationEngine.createOrder({ phone: '5511999998888', items: [] }),
    /At least one order item is required/
  );

  // Subcase 3.4: OrderConfirmationEngine discount clamping (discount > subtotal)
  // Subtotal = 100, discount = 500 -> totalAmount must clamp to 0
  const createdWithExcessiveDiscount = await orderConfirmationEngine.createOrder({
    companyId: 'default',
    phone: '5511999998888',
    customerName: 'Cliente Desconto',
    items: [{ productId: 'p1', name: 'Tijolo', price: 100, quantity: 1 }],
    freight: 10,
    discount: 500, // Excessive discount
    sessionId: 'main',
  });

  assert.equal(createdWithExcessiveDiscount.order.total_amount, 0, 'Total amount clamped to 0 on excessive discount');
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE 4: Clean Event Loop Teardown (Node.js Process Exit Verification)
// ══════════════════════════════════════════════════════════════════════════════

test('ADVERSARIAL 4: Clean event loop exit — no un-refed timers or database pool handles hang the Node.js process', async () => {
  function spawnChildRunner(codeSnippet, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const child = spawn(process.execPath, ['-e', codeSnippet], {
        cwd: path.resolve(__dirname, '..', '..'),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' },
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Child hung after ${timeoutMs}ms! Stdout: ${stdout}, Stderr: ${stderr}`));
      }, timeoutMs);

      child.on('close', (code, signal) => {
        clearTimeout(timer);
        resolve({
          code,
          signal,
          durationMs: Date.now() - start,
          stdout,
          stderr,
        });
      });

      child.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  const teardownTestScript = `
    const { pool, query, closeDatabase } = require('./backend/src/infrastructure/config/database');
    const gateway = require('./backend/services/websocketGateway');
    const queue = require('./backend/services/outboundQueueService');
    const EventEmitter = require('events');

    async function verifyCleanExit() {
      // 1. Initialize websocket gateway with mocked io
      const io = new EventEmitter();
      io.on = io.addListener;
      io.off = io.removeListener;
      gateway.init(io);

      // 2. Initialize outbound queue worker
      await queue.initializeOutboundQueue({ store: { databaseEnabled: false } });

      // 3. Perform real DB query and close database pool
      await query('SELECT 1 AS probe');
      await closeDatabase();

      // 4. Shutdown gateway
      gateway.shutdown();

      console.log('ALL_SERVICES_TEARDOWN_COMPLETED');
    }

    verifyCleanExit().catch(err => {
      console.error('TEARDOWN_FAIL:', err);
      process.exit(1);
    });
  `;

  const childResult = await spawnChildRunner(teardownTestScript, 5000);
  assert.equal(childResult.code, 0, `Child process exited with non-zero code ${childResult.code}`);
  assert.ok(childResult.stdout.includes('ALL_SERVICES_TEARDOWN_COMPLETED'), 'Teardown completed cleanly');
  assert.ok(childResult.durationMs < 4000, `Child exited promptly in ${childResult.durationMs}ms without hanging on background handles`);
});
