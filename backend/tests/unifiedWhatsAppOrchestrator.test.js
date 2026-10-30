'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  orchestrator,
  capabilityRegistry,
  transportRegistry,
  connectionOrchestrator,
  operationRouter,
  messageDispatcher,
  eventNormalizer,
  commerceEngine,
  paymentEngine,
  healthMonitor,
  recoveryManager,
  webBridgeManager,
} = require('../services/orchestrator');

test('1. CapabilityRegistry defines all supported engines and operations correctly', () => {
  assert.equal(capabilityRegistry.ENGINES.BAILEYS, 'BAILEYS');
  assert.equal(capabilityRegistry.ENGINES.WHATSAPP_WEB_BRIDGE, 'WHATSAPP_WEB_BRIDGE');
  assert.equal(capabilityRegistry.ENGINES.CLOUD_API, 'CLOUD_API');

  // Baileys has native messaging and commerce capabilities
  assert.equal(capabilityRegistry.canExecute('BAILEYS', 'SEND_TEXT'), true);
  assert.equal(capabilityRegistry.canExecute('BAILEYS', 'SEND_MEDIA'), true);
  assert.equal(capabilityRegistry.canExecute('BAILEYS', 'SEND_PRODUCT'), true);
  assert.equal(capabilityRegistry.canExecute('BAILEYS', 'SEND_ORDER'), true);

  // WebBridge requires authenticated session to be marked executable
  assert.equal(capabilityRegistry.canExecute('WHATSAPP_WEB_BRIDGE', 'SEND_TEXT', { webBridgeAuthenticated: false }), false);
  assert.equal(capabilityRegistry.canExecute('WHATSAPP_WEB_BRIDGE', 'SEND_TEXT', { webBridgeAuthenticated: true }), true);
});

test('2. ConnectionOrchestrator registers active Baileys session and exposes unified state', () => {
  const mockSock = {
    user: { id: '553193672075:1@s.whatsapp.net', name: 'Depósito Vista Alegre' },
    ws: { readyState: 1 },
    sendMessage: async (jid, payload) => ({ key: { id: 'wamid_mock_test_1' } }),
  };

  connectionOrchestrator.registerBaileysConnection('test_session', mockSock, {
    phone: '553193672075',
    companyId: 'default',
  });

  const state = connectionOrchestrator.getUnifiedConnectionState('test_session');
  assert.equal(state.status, 'connected');
  assert.equal(state.phone, '553193672075');
  assert.equal(state.primaryEngine, 'BAILEYS');
  assert.ok(state.activeEngines.includes('BAILEYS'));
});

test('3. TransportRegistry dynamically selects optimal engine for each operation', () => {
  const engineForText = transportRegistry.selectEngineForOperation('test_session', 'SEND_TEXT');
  assert.equal(engineForText, 'BAILEYS');

  const engineForProd = transportRegistry.selectEngineForOperation('test_session', 'SEND_PRODUCT');
  assert.equal(engineForProd, 'BAILEYS');
});

test('4. OperationRouter executes SEND_TEXT via BaileysAdapter with standardized envelope', async () => {
  const mockSock = {
    user: { id: '553193672075:1@s.whatsapp.net' },
    ws: { readyState: 1 },
    sendMessage: async (jid, content) => {
      assert.ok(jid.includes('553198346078'));
      assert.equal(content.text, 'Olá, mensagem de teste do Orchestrator');
      return { key: { id: 'wamid_envelope_101' } };
    },
  };

  const result = await operationRouter.execute(
    'SEND_TEXT',
    { phone: '553198346078', text: 'Olá, mensagem de teste do Orchestrator' },
    { sessionId: 'test_session', sock: mockSock }
  );

  assert.equal(result.success, true);
  assert.equal(result.operation, 'SEND_TEXT');
  assert.equal(result.engine, 'BAILEYS');
  assert.equal(result.whatsappMessageId, 'wamid_envelope_101');
  assert.ok(result.durationMs >= 0);
});

test('5. OperationRouter protects against duplicate dispatch via Idempotency cache', async () => {
  let callCount = 0;
  const mockSock = {
    user: { id: '553193672075:1@s.whatsapp.net' },
    ws: { readyState: 1 },
    sendMessage: async () => {
      callCount++;
      return { key: { id: `wamid_idem_${callCount}` } };
    },
  };

  const idemKey = 'idempotent_test_token_999';

  // First call
  const first = await operationRouter.execute(
    'SEND_TEXT',
    { phone: '553198346078', text: 'Mensagem única' },
    { sessionId: 'test_session', sock: mockSock, idempotencyKey: idemKey }
  );

  // Second duplicate call with same idempotencyKey
  const second = await operationRouter.execute(
    'SEND_TEXT',
    { phone: '553198346078', text: 'Mensagem única repetida' },
    { sessionId: 'test_session', sock: mockSock, idempotencyKey: idemKey }
  );

  assert.equal(callCount, 1, 'Underlying send must be called only once');
  assert.equal(first.whatsappMessageId, second.whatsappMessageId);
});

test('6. EventNormalizer standardizes and deduplicates incoming and outgoing events', () => {
  let emittedCount = 0;
  const listener = () => emittedCount++;
  eventNormalizer.on('MessageReceived', listener);

  const raw1 = { id: 'msg_dup_test_1', phone: '553198346078', text: 'Oi' };
  const res1 = eventNormalizer.normalizeMessageReceived('BAILEYS', raw1);
  assert.ok(res1 !== null);
  assert.equal(res1.type, 'MessageReceived');
  assert.equal(res1.messageId, 'msg_dup_test_1');

  // Exact duplicate should return null and not emit
  const res2 = eventNormalizer.normalizeMessageReceived('BAILEYS', raw1);
  assert.equal(res2, null);
  assert.equal(emittedCount, 1);

  eventNormalizer.off('MessageReceived', listener);
});

test('7. PaymentEngine creates Pix charge and verifies Webhook confirmation', async () => {
  const payment = await paymentEngine.createPayment({
    companyId: 'default',
    amount: 150.0,
    customerPhone: '553198346078',
    customerName: 'Carlos Silva',
    description: '1 Milheiro de Tijolo 8 Furos',
  });

  assert.ok(payment.paymentId.startsWith('pay_'));
  assert.equal(payment.amount, 150.0);
  assert.equal(payment.status, 'pending');
  assert.ok(payment.pixCode.includes('DEPOSITO VISTA ALEGRE'));

  // Webhook confirmation
  const webhookResult = await paymentEngine.handleWebhook({
    paymentId: payment.paymentId,
    status: 'paid',
  });

  assert.equal(webhookResult.success, true);
  assert.equal(webhookResult.isConfirmed, true);
  assert.equal(webhookResult.status, 'paid');

  const updatedPayment = paymentEngine.getPayment(payment.paymentId);
  assert.equal(updatedPayment.status, 'paid');
});

test('8. RecoveryManager circuit breaker protects system on consecutive failures', () => {
  const brokenSessionId = 'broken_session_test';
  assert.equal(recoveryManager.isCircuitOpen(brokenSessionId), false);

  const origRecovery = recoveryManager.attemptSessionRecovery;
  recoveryManager.attemptSessionRecovery = async () => {};

  try {
    // Trigger 5 failures
    for (let i = 0; i < 5; i++) {
      recoveryManager.recordFailure(brokenSessionId, new Error('Simulated network timeout'));
    }

    assert.equal(recoveryManager.isCircuitOpen(brokenSessionId), true);

    // Recovery resets
    recoveryManager.recordSuccess(brokenSessionId);
    assert.equal(recoveryManager.isCircuitOpen(brokenSessionId), false);
  } finally {
    recoveryManager.attemptSessionRecovery = origRecovery;
  }
});

test('9. HealthMonitor provides telemetry snapshot of engines and latencies', () => {
  healthMonitor.recordOperation(45, true, true);
  healthMonitor.recordOperation(60, false, true);

  const snapshot = healthMonitor.getSnapshot();
  assert.ok(snapshot.system.memoryRssMb > 0);
  assert.ok(snapshot.performance.totalOperations >= 2);
  assert.ok(snapshot.performance.commercialOperations >= 1);
  assert.equal(snapshot.status, 'healthy');
});

test('10. UnifiedWhatsAppOrchestrator master facade coordinates complete flow', async () => {
  assert.equal(orchestrator.isEnabled, true);

  const health = orchestrator.getHealth();
  assert.equal(health.status, 'healthy');

  const capabilities = orchestrator.capabilityRegistry.getFullMatrix();
  assert.ok(capabilities.engines.includes('BAILEYS'));
  
  // Clean exit so open db pool does not hang test runner
  setTimeout(() => process.exit(0), 100);
});
