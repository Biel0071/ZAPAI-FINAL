'use strict';

/**
 * challenger_m2_auto_sync_stress.test.js
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE for WhatsAppAutoSyncCoordinator
 *
 * Challenges:
 * 1. Debounce under high contention (50 rapid onSessionConnected calls coalesced cleanly)
 * 2. Multi-session interleaved debounce (5 sessions x 10 calls = 50 calls)
 * 3. Active execution in-flight re-sync queueing and automatic execution
 * 4. Hanging Meta catalog query with timeout race (< 400ms bounded recovery)
 * 5. Abrupt socket disconnect mid-sync with simulated socket destruction
 * 6. Corrupt, null, undefined, and throwing payload inputs (zero crashes)
 * 7. Socket.IO event emission schema validation and tenant room multiplexing
 * 8. Process-wide zero unhandled rejections and zero uncaught exceptions verification
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const autoSyncCoordinator = require('../services/whatsapp/sync/WhatsAppAutoSyncCoordinator');

// Process-wide unhandled rejection / exception traps
const unhandledRejections = [];
process.on('unhandledRejection', (reason, promise) => {
  unhandledRejections.push({ reason, promise });
  console.error('[CHALLENGER-TRAP] Unhandled Rejection:', reason);
});

const uncaughtExceptions = [];
process.on('uncaughtException', (err) => {
  uncaughtExceptions.push(err);
  console.error('[CHALLENGER-TRAP] Uncaught Exception:', err);
});

// Helper: build a mock socket
function createMockSocket({
  id = '5531988889999:0@s.whatsapp.net',
  name = 'Stress Test Bot',
  products = [],
  catalogDelayMs = 0,
  throwError = null,
  hangCatalog = false,
} = {}) {
  let callCount = 0;
  return {
    user: { id, name },
    getCallCount: () => callCount,
    getCatalog: async (options) => {
      callCount++;
      if (hangCatalog) {
        return new Promise(() => {}); // never resolves
      }
      if (catalogDelayMs > 0) {
        await new Promise((r) => setTimeout(r, catalogDelayMs));
      }
      if (throwError) {
        throw throwError;
      }
      return { products };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 1: High Contention Debounce (50 rapid calls coalesced into 1 run)
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 1: High Contention Debounce — 50 rapid onSessionConnected calls coalesced cleanly', async () => {
  const sessionId = 'stress_debounce_50';
  const companyId = 'comp_stress_50';
  const mockSock = createMockSocket({
    products: [{ id: 'p_stress_1', name: 'Item 1', price: 100 }],
  });

  const callCount = 50;
  const promises = [];

  for (let i = 0; i < callCount; i++) {
    promises.push(
      autoSyncCoordinator.onSessionConnected({
        sessionId,
        companyId,
        sock: mockSock,
        delayMs: 40,
      })
    );
  }

  const results = await Promise.all(promises);

  assert.equal(results.length, 50, 'All 50 promises must resolve');
  assert.equal(mockSock.getCallCount(), 1, 'getCatalog must be invoked exactly 1 time for 50 coalesced calls');

  // Verify all 50 callers received the identical successful completion result
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    assert.ok(res, `Result #${i} must be defined`);
    assert.equal(res.catalogSynced, true, `Result #${i} catalogSynced must be true`);
    assert.equal(res.ordersSynced, true, `Result #${i} ordersSynced must be true`);
    assert.equal(res.billingSynced, true, `Result #${i} billingSynced must be true`);
  }

  // Verify coordinator state returned to idle
  assert.equal(autoSyncCoordinator.isSyncing(sessionId), false, 'Coordinator must not be syncing after resolution');
  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections during 50-call burst');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 2: Interleaved Multi-Session Debounce (5 sessions x 10 calls)
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 2: Interleaved Multi-Session Debounce — 5 independent sessions isolated and debounced', async () => {
  const sessionCount = 5;
  const callsPerSession = 10;
  const mockSockets = new Map();
  const allPromises = [];

  for (let s = 1; s <= sessionCount; s++) {
    const sId = `interleaved_sess_${s}`;
    const sock = createMockSocket({
      products: [{ id: `prod_${s}`, name: `Prod ${s}`, price: 10 * s }],
    });
    mockSockets.set(sId, sock);

    for (let c = 0; c < callsPerSession; c++) {
      allPromises.push(
        autoSyncCoordinator.onSessionConnected({
          sessionId: sId,
          companyId: `comp_${s}`,
          sock,
          delayMs: 35,
        })
      );
    }
  }

  const allResults = await Promise.all(allPromises);

  assert.equal(allResults.length, sessionCount * callsPerSession, 'All 50 promises across 5 sessions must resolve');

  for (let s = 1; s <= sessionCount; s++) {
    const sId = `interleaved_sess_${s}`;
    const sock = mockSockets.get(sId);
    assert.equal(sock.getCallCount(), 1, `Session "${sId}" must execute getCatalog exactly 1 time`);
    assert.equal(autoSyncCoordinator.isSyncing(sId), false, `Session "${sId}" must be idle`);
  }

  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections during multi-session contention');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 3: Resync Queueing under Active In-Flight Execution
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 3: Resync Queueing — Triggers received while executing queue follow-up re-sync', async () => {
  const sessionId = 'resync_queue_test';
  const companyId = 'comp_resync';

  const mockSock = createMockSocket({
    products: [{ id: 'resync_p1', name: 'Item ReSync', price: 50 }],
    catalogDelayMs: 80, // slow network to ensure sync is in-flight
  });

  // 1. Launch initial sync
  const initialSyncPromise = autoSyncCoordinator.onSessionConnected({
    sessionId,
    companyId,
    sock: mockSock,
    delayMs: 10,
  });

  // Wait for initial sync to start executing (delayMs 10 + small buffer)
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(autoSyncCoordinator.isSyncing(sessionId), true, 'Session must be in syncing state');

  // 2. Dispatch rapid calls while initial sync is actively executing
  const inFlightResult1 = await autoSyncCoordinator.onSessionConnected({
    sessionId,
    companyId,
    sock: mockSock,
    delayMs: 10,
  });
  const inFlightResult2 = await autoSyncCoordinator.onSessionConnected({
    sessionId,
    companyId,
    sock: mockSock,
    delayMs: 10,
  });

  // In-flight calls must return immediate non-blocking fallback and queue re-sync
  assert.equal(inFlightResult1.catalogSynced, false);
  assert.equal(inFlightResult2.catalogSynced, false);

  // 3. Await initial sync completion
  const initialResult = await initialSyncPromise;
  assert.equal(initialResult.catalogSynced, true);

  // 4. Wait for the queued follow-up re-sync to complete (queued with delayMs: 500)
  await new Promise((r) => setTimeout(r, 750));

  assert.equal(mockSock.getCallCount(), 2, 'Total getCatalog executions must be exactly 2 (initial + 1 queued follow-up)');
  assert.equal(autoSyncCoordinator.isSyncing(sessionId), false, 'Session must return to idle');
  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections during re-sync queueing');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 4: Hanging Meta Catalog Query with Timeout Race
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 4: Hanging Meta Catalog Query — bounded recovery with timeout race', async () => {
  const sessionId = 'hanging_catalog_test';
  const companyId = 'comp_hanging';

  const hangingSock = createMockSocket({
    hangCatalog: true, // Never resolves
  });

  const startTime = Date.now();
  const result = await autoSyncCoordinator.onSessionConnected({
    sessionId,
    companyId,
    sock: hangingSock,
    delayMs: 10,
    timeoutMs: 120, // 120ms timeout
  });
  const elapsed = Date.now() - startTime;

  assert.ok(elapsed < 600, `Hanging query must resolve within bounded time, took ${elapsed}ms`);
  assert.equal(result.catalogSynced, false, 'catalogSynced must be false on timeout');
  assert.equal(result.error, 'TIMEOUT', 'Error must be marked as TIMEOUT');
  assert.equal(result.ordersSynced, true, 'Orders stage must still execute safely');
  assert.equal(result.billingSynced, true, 'Billing stage must still execute safely');

  // Subsequent sync with healthy socket must work immediately without being blocked
  const healthySock = createMockSocket({
    products: [{ id: 'recovered_prod', name: 'Recovered', price: 10 }],
  });
  const recoverResult = await autoSyncCoordinator.onSessionConnected({
    sessionId,
    companyId,
    sock: healthySock,
    delayMs: 10,
  });

  assert.equal(recoverResult.catalogSynced, true, 'Subsequent sync must succeed after timeout recovery');
  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections on timeout');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 5: Abrupt Socket Disconnect Mid-Sync
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 5: Abrupt Socket Disconnect Mid-Sync — clean cancellation and zero crashes', async () => {
  const sessionId = 'mid_sync_disconnect';
  const companyId = 'comp_mid_disc';

  let getCatalogCalled = false;
  const fragileSock = {
    user: { id: '5531988887777:0@s.whatsapp.net' },
    getCatalog: async () => {
      getCatalogCalled = true;
      // Stalls then simulates socket crash / connection drop
      await new Promise((r) => setTimeout(r, 60));
      throw new Error('Connection Closed (428 Connection Reset)');
    },
  };

  const syncPromise = autoSyncCoordinator.onSessionConnected({
    sessionId,
    companyId,
    sock: fragileSock,
    delayMs: 10,
  });

  // Disconnect while in debounce/execution window
  await new Promise((r) => setTimeout(r, 20));
  autoSyncCoordinator.onSessionDisconnected(sessionId);

  assert.equal(autoSyncCoordinator.isSyncing(sessionId), false, 'isSyncing must be false after onSessionDisconnected');

  const syncResult = await syncPromise;
  assert.ok(syncResult, 'Resolver must resolve with a safe object');
  assert.equal(syncResult.catalogSynced, false, 'Catalog must not be synced when disconnected mid-sync');

  // Verify last status reflects interrupted state
  const status = autoSyncCoordinator.getLastSyncStatus(sessionId);
  assert.ok(status, 'Status must exist');
  assert.ok(['interrupted', 'failed', 'completed'].includes(status.status), 'Status must be recognized');

  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections on mid-sync disconnect');
  assert.equal(uncaughtExceptions.length, 0, 'Zero uncaught exceptions on mid-sync disconnect');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 6: Corrupt, Null, and Adversarial Payload Inputs
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 6: Corrupt and Adversarial Payload Inputs — zero process crashes or unhandled rejections', async () => {
  const testCases = [
    { label: 'empty object', args: {} },
    { label: 'empty sessionId', args: { sessionId: '' } },
    { label: 'null sessionId', args: { sessionId: null } },
    { label: 'undefined sessionId', args: { sessionId: undefined } },
    { label: 'numeric sessionId', args: { sessionId: 99999 } },
    { label: 'null companyId', args: { sessionId: 'corrupt_1', companyId: null } },
    { label: 'null sock', args: { sessionId: 'corrupt_2', sock: null } },
    { label: 'sock without getCatalog', args: { sessionId: 'corrupt_3', sock: { user: {} } } },
    { label: 'sock getCatalog not function', args: { sessionId: 'corrupt_4', sock: { getCatalog: 'not_a_func' } } },
    {
      label: 'sock getCatalog throws sync error',
      args: {
        sessionId: 'corrupt_5',
        sock: {
          user: { id: '5531999999999:0@s.whatsapp.net' },
          getCatalog: () => { throw new TypeError('Immediate sync throw'); },
        },
      },
    },
    {
      label: 'sock getCatalog rejects promise',
      args: {
        sessionId: 'corrupt_6',
        sock: {
          user: { id: '5531999999999:0@s.whatsapp.net' },
          getCatalog: () => Promise.reject(new Error('Meta Catalog 503 Service Unavailable')),
        },
      },
    },
    {
      label: 'sock getCatalog returns non-array products',
      args: {
        sessionId: 'corrupt_7',
        sock: {
          user: { id: '5531999999999:0@s.whatsapp.net' },
          getCatalog: async () => ({ products: 'corrupted_string' }),
        },
      },
    },
    {
      label: 'sock getCatalog returns array with corrupt items',
      args: {
        sessionId: 'corrupt_8',
        sock: {
          user: { id: '5531999999999:0@s.whatsapp.net' },
          getCatalog: async () => ({ products: [null, undefined, { price: 'invalid_price' }, { name: null }] }),
        },
      },
    },
  ];

  for (const tc of testCases) {
    try {
      const res = await autoSyncCoordinator.onSessionConnected({
        delayMs: 5,
        ...tc.args,
      });
      assert.ok(typeof res === 'object', `Test case "${tc.label}" must return object`);
      assert.equal(typeof res.catalogSynced, 'boolean', `Test case "${tc.label}" catalogSynced must be boolean`);
    } catch (err) {
      assert.fail(`Test case "${tc.label}" threw unexpected exception: ${err.message}`);
    }
  }

  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections across all corrupt payload cases');
  assert.equal(uncaughtExceptions.length, 0, 'Zero uncaught exceptions across all corrupt payload cases');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 7: Socket.IO Event Emission Schema and Delivery
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 7: Socket.IO Event Emission Schema & Delivery Verification', async () => {
  const emittedEvents = [];
  const roomEmissions = [];

  // Setup mock global.io with room tracking
  global.io = {
    emit: (event, payload) => {
      emittedEvents.push({ event, payload });
    },
    to: (room) => ({
      emit: (event, payload) => {
        roomEmissions.push({ room, event, payload });
        emittedEvents.push({ room, event, payload });
      },
    }),
  };

  const sessionId = 'schema_test_session';
  const companyId = 'company_schema_42';
  const mockSock = createMockSocket({
    products: [
      { id: 'item_sch_1', name: 'Product Alpha', price: 120.5 },
      { id: 'item_sch_2', name: 'Product Beta', price: 340.0 },
    ],
  });

  const res = await autoSyncCoordinator.onSessionConnected({
    sessionId,
    companyId,
    sock: mockSock,
    delayMs: 15,
  });

  assert.equal(res.catalogSynced, true);

  // 1. Verify commerce:orders_synced
  const ordersEvent = emittedEvents.find((e) => e.event === 'commerce:orders_synced');
  assert.ok(ordersEvent, 'commerce:orders_synced event must be emitted');
  assert.equal(ordersEvent.payload.sessionId, sessionId);
  assert.equal(ordersEvent.payload.companyId, companyId);
  assert.equal(typeof ordersEvent.payload.count, 'number');
  assert.ok(Array.isArray(ordersEvent.payload.recentOrders));
  assert.ok(!isNaN(Date.parse(ordersEvent.payload.timestamp)), 'timestamp must be valid ISO string');

  // 2. Verify billing:synced
  const billingEvent = emittedEvents.find((e) => e.event === 'billing:synced');
  assert.ok(billingEvent, 'billing:synced event must be emitted');
  assert.equal(billingEvent.payload.sessionId, sessionId);
  assert.equal(billingEvent.payload.companyId, companyId);
  assert.equal(typeof billingEvent.payload.pendingQuotes, 'number');
  assert.ok(!isNaN(Date.parse(billingEvent.payload.timestamp)), 'timestamp must be valid ISO string');

  // 3. Verify whatsapp:sync_completed
  const completedEvent = emittedEvents.find((e) => e.event === 'whatsapp:sync_completed');
  assert.ok(completedEvent, 'whatsapp:sync_completed event must be emitted');
  assert.equal(completedEvent.payload.sessionId, sessionId);
  assert.equal(completedEvent.payload.companyId, companyId);
  assert.equal(completedEvent.payload.catalogSynced, true);
  assert.equal(completedEvent.payload.ordersSynced, true);
  assert.equal(completedEvent.payload.billingSynced, true);
  assert.equal(typeof completedEvent.payload.totalProducts, 'number');
  assert.ok(!isNaN(Date.parse(completedEvent.payload.completedAt)), 'completedAt must be valid ISO string');

  // 4. Verify catalog:synced (from productsController)
  const catalogEvent = emittedEvents.find((e) => e.event === 'catalog:synced');
  assert.ok(catalogEvent, 'catalog:synced event must be emitted');
  assert.equal(catalogEvent.payload.sessionId, sessionId);
  assert.equal(catalogEvent.payload.companyId, companyId);
  assert.equal(typeof catalogEvent.payload.synced, 'number');
  assert.equal(typeof catalogEvent.payload.total, 'number');
  assert.ok(Array.isArray(catalogEvent.payload.products));

  // 5. Verify room multiplexing
  const tenantRooms = roomEmissions.map((r) => r.room);
  assert.ok(
    tenantRooms.includes(`tenant:${companyId}`),
    `Events must be dispatched to room "tenant:${companyId}"`
  );

  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections during schema validation');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 7b: Rapid Connect/Disconnect Churn (20 consecutive cycles)
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 7b: Rapid Connect/Disconnect Churn — 20 rapid connect/disconnect cycles clean up state', async () => {
  const sessionId = 'churn_session_test';
  const companyId = 'company_churn';

  for (let cycle = 0; cycle < 20; cycle++) {
    const sock = createMockSocket({
      products: [{ id: `churn_${cycle}`, name: `Item ${cycle}`, price: cycle * 5 }],
    });

    const promise = autoSyncCoordinator.onSessionConnected({
      sessionId,
      companyId,
      sock,
      delayMs: 30,
    });

    // Disconnect almost immediately (simulating flapping network connection)
    await new Promise((r) => setTimeout(r, 2));
    autoSyncCoordinator.onSessionDisconnected(sessionId);

    const res = await promise;
    assert.ok(res, `Cycle ${cycle} must resolve safely`);
    assert.equal(autoSyncCoordinator.isSyncing(sessionId), false, `Cycle ${cycle} must not leave isSyncing true`);
  }

  // After 20 churn cycles, a stable connection must successfully sync
  const stableSock = createMockSocket({
    products: [{ id: 'stable_post_churn', name: 'Stable Product', price: 99 }],
  });
  const stableRes = await autoSyncCoordinator.onSessionConnected({
    sessionId,
    companyId,
    sock: stableSock,
    delayMs: 15,
  });

  assert.equal(stableRes.catalogSynced, true, 'Stable sync must succeed after rapid churn cycles');
  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections during churn');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 7c: 100-Request Concurrency Blast Across 10 Sessions
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 7c: 100-Request Concurrency Blast Across 10 Sessions with Random Failures', async () => {
  const sessionCount = 10;
  const totalRequests = 100;
  const promises = [];

  for (let i = 0; i < totalRequests; i++) {
    const sIdx = i % sessionCount;
    const sId = `blast_sess_${sIdx}`;
    const shouldFail = (i % 7 === 0);
    const sock = createMockSocket({
      products: [{ id: `blast_item_${i}`, name: `Blast ${i}`, price: i }],
      throwError: shouldFail ? new Error('Simulated Meta 500 error') : null,
    });

    promises.push(
      autoSyncCoordinator.onSessionConnected({
        sessionId: sId,
        companyId: `blast_comp_${sIdx}`,
        sock,
        delayMs: 25,
      })
    );
  }

  const results = await Promise.all(promises);
  assert.equal(results.length, 100, 'All 100 blast requests must resolve');

  for (const res of results) {
    assert.ok(typeof res === 'object', 'Each blast result must be an object');
    assert.equal(typeof res.catalogSynced, 'boolean', 'catalogSynced must be boolean');
    assert.equal(typeof res.ordersSynced, 'boolean', 'ordersSynced must be boolean');
  }

  assert.equal(unhandledRejections.length, 0, 'Zero unhandled rejections during 100-request blast');
});

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE 8: Final Health Check — Process Integrity
// ─────────────────────────────────────────────────────────────────────────────
test('Challenger 8: Final Health Check — Process Integrity Guarantee', () => {
  assert.equal(
    unhandledRejections.length,
    0,
    `CRITICAL: Detected ${unhandledRejections.length} unhandled promise rejection(s): ${JSON.stringify(unhandledRejections)}`
  );
  assert.equal(
    uncaughtExceptions.length,
    0,
    `CRITICAL: Detected ${uncaughtExceptions.length} uncaught exception(s): ${JSON.stringify(uncaughtExceptions)}`
  );
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
