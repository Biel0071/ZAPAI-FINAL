const assert = require('assert');
const {
  analyzeConversationSignals,
  reconcileTags,
  determineFunnelAndTemperature,
  buildExecutiveNotes,
} = require('../services/contactIntelligenceDaemon');

console.log('--- Testing Contact Intelligence Daemon ---');

// Test 1: Delivery Issue Detection ("Ja estava agendado. Mas nao fou entregue")
{
  const messages = [
    { text: 'Oi! Tudo bem? É a Camila aqui do Depósito Vista Alegre...', from_me: true, direction: 'outgoing' },
    { text: 'Ja estava agendado. Mas nao foi entregue', from_me: false, direction: 'incoming' }
  ];

  const signals = analyzeConversationSignals(messages);
  assert.strictEqual(signals.deliveryIssue, true, 'Should detect delivery issue');
  assert.strictEqual(signals.scheduled, true, 'Should detect scheduled order');
  assert.strictEqual(signals.orderStatus, 'atraso_nao_entregue', 'Status should be atraso_nao_entregue');

  const tags = reconcileTags(['new_lead', 'aguardando_resposta'], signals);
  assert(tags.includes('pedido_nao_entregue'), 'Tags must include pedido_nao_entregue');
  assert(tags.includes('suporte_urgente'), 'Tags must include suporte_urgente');
  assert(!tags.includes('aguardando_resposta'), 'Tags must remove aguardando_resposta');

  const { funnel, temp } = determineFunnelAndTemperature(signals, 'new_lead', 'cold');
  assert.strictEqual(funnel, 'suporte', 'Funnel must advance to suporte');
  assert.strictEqual(temp, 'urgente', 'Temperature must be urgente');

  const notes = buildExecutiveNotes('', signals, '553199999999');
  assert(notes.includes('Pedido não entregue / Atraso relatado pelo cliente'), 'Notes must describe delivery delay');
  console.log('✔ Test 1: Delivery Issue & Scheduled Order passed!');
}

// Test 2: Payment Sent / Confirmed
{
  const messages = [
    { text: 'Oi, quanto fica o milheiro de tijolo?', from_me: false },
    { text: 'Fica R$ 890 no PIX!', from_me: true },
    { text: 'Já fiz o pix, segue o comprovante!', from_me: false }
  ];

  const signals = analyzeConversationSignals(messages);
  assert.strictEqual(signals.paymentConfirmed, true, 'Should detect payment confirmed');
  assert.strictEqual(signals.orderStatus, 'pago', 'Status should be pago');

  const tags = reconcileTags(['aguardando_pagamento', 'pix_pendente', 'orcamento'], signals);
  assert(tags.includes('pago'), 'Tags must include pago');
  assert(tags.includes('comprovante_enviado'), 'Tags must include comprovante_enviado');
  assert(!tags.includes('aguardando_pagamento'), 'Must remove aguardando_pagamento');
  assert(!tags.includes('pix_pendente'), 'Must remove pix_pendente');

  const { funnel, temp } = determineFunnelAndTemperature(signals, 'fechamento', 'warm');
  assert.strictEqual(funnel, 'pago', 'Funnel must be pago');
  assert.strictEqual(temp, 'quente', 'Temperature must be quente');

  const notes = buildExecutiveNotes('', signals, '553199999999');
  assert(notes.includes('Pagamento/PIX informado pelo cliente'), 'Notes must record payment');
  console.log('✔ Test 2: Payment Confirmed passed!');
}

// Test 3: Delivered with Success Reconciles Past Complaints
{
  const messages = [
    { text: 'Meu pedido ainda não chegou, está atrasado!', from_me: false, created_at: '2026-10-01T10:00:00Z' },
    { text: 'Poxa, vamos agilizar agora mesmo!', from_me: true, created_at: '2026-10-01T10:05:00Z' },
    { text: 'Chegou certinho, muito obrigado!', from_me: false, created_at: '2026-10-02T09:00:00Z' }
  ];

  const signals = analyzeConversationSignals(messages);
  assert.strictEqual(signals.delivered, true, 'Should detect delivered');
  assert.strictEqual(signals.deliveryIssue, false, 'Recent delivered confirmation should clear deliveryIssue');
  assert.strictEqual(signals.orderStatus, 'entregue', 'Status should be entregue');

  const tags = reconcileTags(['pedido_nao_entregue', 'suporte_urgente'], signals);
  assert(tags.includes('pedido_entregue'), 'Tags must include pedido_entregue');
  assert(!tags.includes('pedido_nao_entregue'), 'Must remove pedido_nao_entregue');
  assert(!tags.includes('suporte_urgente'), 'Must remove suporte_urgente');

  const { funnel, temp } = determineFunnelAndTemperature(signals, 'suporte', 'urgente');
  assert.strictEqual(funnel, 'pos_venda', 'Funnel must advance to pos_venda');
  assert.strictEqual(temp, 'frio', 'Temperature should cool down to frio');
  console.log('✔ Test 3: Order Delivered & Reconciled passed!');
}

console.log('--- ALL CONTACT INTELLIGENCE TESTS PASSED ---');
process.exit(0);
