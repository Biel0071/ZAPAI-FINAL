const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compileSystemPrompt,
  enforceResponseWordLimit,
  resolveResponseWordLimit
} = require('../services/ai.service');
const {
  resetFollowupOnCustomerResponse,
  deactivateFollowupForConversation
} = require('../services/aiFollowupEngine');
const { query } = require('../src/infrastructure/config/database');

test('Zap GPT Parity: 50-word strict ceiling enforced for all response styles', () => {
  const agentShort = { responseStyle: 'short_natural' };
  const agentElaborate = { responseStyle: 'elaborate' };
  const agentCustomHigh = { responseStyle: 'short_natural', maxWords: 120 };

  assert.ok(resolveResponseWordLimit(agentShort) <= 50, 'short_natural must be <= 50 words');
  assert.ok(resolveResponseWordLimit(agentElaborate) <= 50, 'elaborate must be <= 50 words');
  assert.ok(resolveResponseWordLimit(agentCustomHigh) <= 50, 'custom maxWords must be capped at 50 words');

  // Verify text enforcement truncation
  const longEssay = 'Temos a Churrasqueira Trio pré-moldada completa a pronta entrega na loja com frete facilitado para toda a região metropolitana. Esse modelo acompanha forno em ferro fundido, fogão a lenha acoplado com chapa de 3 bocas, grelha inox reforçada, gaveta cinzeiro e duto de saída. Podemos parcelar em até 10 vezes no cartão de crédito sem juros ou conceder 5% de desconto para pagamento à vista no PIX com entrega rápida e agendada na sua obra.';
  const enforced = enforceResponseWordLimit(longEssay, agentShort);
  const words = enforced.split(/\s+/).filter(Boolean);
  assert.ok(words.length <= 50, `Enforced text must have <= 50 words, got ${words.length}`);
});

test('Zap GPT Parity: System prompt injects Golden WhatsApp Rules', () => {
  const agent = { name: 'Camila', role: 'Vendas' };
  const store = { name: 'Depósito Mais' };
  const prompt = compileSystemPrompt(agent, store, { phone: '5511999998888' });

  assert.ok(prompt.includes('[DIRETRIZES DE OURO DE ATENDIMENTO WHATSAPP]'), 'Must include Golden WhatsApp Rules header');
  assert.ok(prompt.includes('SEMPRE limite as respostas a no máximo 35 a 50 palavras!'), 'Must include 50 words rule');
  assert.ok(prompt.includes('NUNCA dê "Olá" ou "Oi" mais de uma vez na mesma conversa'), 'Must include no repeated greeting rule');
  assert.ok(prompt.includes('PROIBIDO responder em formato de lista ou Markdown'), 'Must prohibit lists/markdown');
});

test('Zap GPT Parity: Contact name is injected on turn 1, but omitted on subsequent turns', () => {
  const agent = { name: 'Camila', role: 'Vendas' };
  const store = { name: 'Depósito Mais' };

  // Turn 1: No previous bot messages
  const turn1Prompt = compileSystemPrompt(agent, store, {
    name: 'Carlos Oliveira',
    phone: '5511999991111',
    hasPastBotMessages: false
  });
  assert.ok(turn1Prompt.includes('Nome do Cliente (Apenas 1º contato): Carlos Oliveira'), 'Turn 1 must inject contact name');

  // Turn 2+: Attendant has already spoken in conversation
  const turn2Prompt = compileSystemPrompt(agent, store, {
    name: 'Carlos Oliveira',
    phone: '5511999991111',
    hasPastBotMessages: true
  });
  assert.ok(!turn2Prompt.includes('Nome do Cliente (Apenas 1º contato): Carlos Oliveira'), 'Subsequent turns must NOT inject contact name');
});

test('Zap GPT Parity: Inbound customer reply immediately resets follow-up state', async () => {
  const testPhone = '5511988882233@s.whatsapp.net';
  const ins = await query(
    `INSERT INTO conversations (remote_jid, status, ai_enabled, tags)
     VALUES ($1, 'open', true, ARRAY['followup_ia_ativo', 'followup_toque_1', 'lead_quente'])
     RETURNING id`,
    [testPhone]
  );
  const convId = ins.rows[0].id;

  try {
    const res = await resetFollowupOnCustomerResponse(convId);
    assert.equal(res.ok, true);
    assert.equal(res.reset, true);

    const check = await query(`SELECT tags FROM conversations WHERE id = $1`, [convId]);
    const tags = check.rows[0].tags || [];
    assert.ok(!tags.includes('followup_ia_ativo'), 'followup_ia_ativo must be cleared');
    assert.ok(!tags.includes('followup_toque_1'), 'followup_toque_1 must be cleared');
    assert.ok(tags.includes('lead_quente'), 'other tags must remain intact');
  } finally {
    await query(`DELETE FROM conversations WHERE id = $1`, [convId]);
  }
});
