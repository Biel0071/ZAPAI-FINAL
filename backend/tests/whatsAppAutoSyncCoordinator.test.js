'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const autoSyncCoordinator = require('../services/whatsapp/sync/WhatsAppAutoSyncCoordinator');

test('Requirement 2.1: WhatsAppAutoSyncCoordinator exports onSessionConnected, isSyncing, and getLastSyncStatus', () => {
  assert.equal(typeof autoSyncCoordinator.onSessionConnected, 'function');
  assert.equal(typeof autoSyncCoordinator.isSyncing, 'function');
  assert.equal(typeof autoSyncCoordinator.getLastSyncStatus, 'function');
  assert.equal(typeof autoSyncCoordinator.onSessionDisconnected, 'function');
});

test('Requirement 2.2: Automatically triggers catalog, order, and billing synchronization silently', async () => {
  const events = [];
  global.io = {
    emit: (event, payload) => events.push({ event, payload }),
    to: (room) => ({
      emit: (event, payload) => events.push({ room, event, payload }),
    }),
  };

  let catalogRequested = false;
  const mockSock = {
    user: { id: '553193672075:0@s.whatsapp.net', name: 'ZAPFLOW Bot' },
    getCatalog: async () => {
      catalogRequested = true;
      return {
        products: [
          {
            id: 'wa_auto_prod_1',
            name: 'Produto Auto Sync Teste',
            price: 150.0,
            description: 'Item de teste',
          },
        ],
      };
    },
  };

  const result = await autoSyncCoordinator.onSessionConnected({
    sessionId: 'test_auto_sync_sess',
    companyId: 'test_company_auto',
    sock: mockSock,
    delayMs: 20,
  });

  assert.ok(result, 'Coordinator must return a result object');
  assert.equal(result.catalogSynced, true, 'Catalog must be synchronized');
  assert.equal(result.ordersSynced, true, 'Orders must be synchronized');
  assert.equal(result.billingSynced, true, 'Billing must be synchronized');
  assert.equal(catalogRequested, true, 'sock.getCatalog must be invoked');

  // Verify real-time broadcast occurred silently
  const catalogEvent = events.find((e) => e.event === 'catalog:synced');
  assert.ok(catalogEvent, 'catalog:synced event must be emitted over Socket.IO');
  assert.equal(catalogEvent.payload.companyId, 'test_company_auto');

  const ordersEvent = events.find((e) => e.event === 'commerce:orders_synced');
  assert.ok(ordersEvent, 'commerce:orders_synced event must be emitted');

  const completedEvent = events.find((e) => e.event === 'whatsapp:sync_completed');
  assert.ok(completedEvent, 'whatsapp:sync_completed event must be emitted');
});

test('Requirement 2.3: Debounces and deduplicates rapid repeated connection open events', async () => {
  let callCount = 0;
  const mockSock = {
    user: { id: '553193672075:0@s.whatsapp.net' },
    getCatalog: async () => {
      callCount++;
      return { products: [] };
    },
  };

  // Dispatch two connection events in parallel for the same session
  const [res1, res2] = await Promise.all([
    autoSyncCoordinator.onSessionConnected({
      sessionId: 'sess_dedupe_test',
      companyId: 'comp_dedupe',
      sock: mockSock,
      delayMs: 30,
    }),
    autoSyncCoordinator.onSessionConnected({
      sessionId: 'sess_dedupe_test',
      companyId: 'comp_dedupe',
      sock: mockSock,
      delayMs: 30,
    }),
  ]);

  assert.ok(res1);
  assert.ok(res2);
  assert.equal(callCount, 1, 'Simultaneous sync requests for the same session must be deduplicated');
});

test('Requirement 2.4: stableSession.js triggers WhatsAppAutoSyncCoordinator on connection open', () => {
  const stableSessionPath = path.resolve(__dirname, '../services/whatsapp/connection/stableSession.js');
  const content = fs.readFileSync(stableSessionPath, 'utf8');

  // Must import or require WhatsAppAutoSyncCoordinator
  assert.ok(
    content.includes('WhatsAppAutoSyncCoordinator'),
    'stableSession.js must reference WhatsAppAutoSyncCoordinator'
  );

  // Must invoke coordinator when connection === "open"
  assert.ok(
    /onSessionConnected\s*\(\s*\{[^}]*sessionId/s.test(content) ||
    /whatsAppAutoSyncCoordinator\.onSessionConnected/s.test(content),
    'stableSession.js must invoke onSessionConnected upon connection === "open"'
  );
});

test('Requirement 2.5: Empty catalog does not drop socket and returns cleanly', async () => {
  const mockSock = {
    user: { id: '553193672075:0@s.whatsapp.net' },
    getCatalog: async () => ({ products: [] }),
  };

  const res = await autoSyncCoordinator.onSessionConnected({
    sessionId: 'sess_empty_cat',
    companyId: 'comp_empty',
    sock: mockSock,
    delayMs: 20,
  });

  assert.equal(res.catalogSynced, true);
  assert.equal(res.totalProducts, 0);
});

test('Requirement 2.6: Hanging Meta catalog API triggers internal timeout and does not block', async () => {
  const hangingSock = {
    user: { id: '553193672075:0@s.whatsapp.net' },
    getCatalog: () => new Promise(() => {}), // Never resolves
  };

  const start = Date.now();
  const res = await autoSyncCoordinator.onSessionConnected({
    sessionId: 'sess_timeout_test',
    companyId: 'comp_timeout',
    sock: hangingSock,
    delayMs: 10,
    timeoutMs: 1000,
  });

  const duration = Date.now() - start;
  assert.ok(duration < 3000, `Expected timeout resolution under 3000ms, took ${duration}ms`);
  assert.equal(res.catalogSynced, false);
  assert.equal(res.error, 'TIMEOUT');
});

test('Requirement 2.7: Teardown cleanly cancels pending sync and timer', () => {
  autoSyncCoordinator.onSessionConnected({
    sessionId: 'sess_teardown_test',
    companyId: 'comp_teardown',
    sock: {},
    delayMs: 5000,
  });

  assert.equal(autoSyncCoordinator.isSyncing('sess_teardown_test'), true);
  autoSyncCoordinator.onSessionDisconnected('sess_teardown_test');
  assert.equal(autoSyncCoordinator.isSyncing('sess_teardown_test'), false);
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
