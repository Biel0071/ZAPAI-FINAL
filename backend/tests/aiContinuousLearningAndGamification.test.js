'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/infrastructure/config/database');
const {
  extractAndPersistConversationLearning,
  getAgentEvolutionProfile,
  evaluateConversationMilestones,
} = require('../services/conversationEvolutionService');
const {
  compileSystemPrompt,
  testAIConnection,
} = require('../services/ai.service');

describe('AI Continuous Learning & Gamification System', () => {
  after(async () => {
    try {
      await pool.end();
    } catch (_) {}
  });
  it('extracts and persists practical learnings from conversation milestones and objection handling', async () => {
    const conv = {
      id: 99881,
      company_id: 'test_tenant_learn',
      name: 'Marcos Vinicius',
      phone: '11988887777',
      lead_id: 123,
    };

    const messages = [
      { from_me: false, text: 'Boa tarde! Quero saber da churrasqueira trio, mas posso pagar só na entrega?' },
      { from_me: true, text: 'Olá Marcos! Sim, aceitamos pagamento no ato da entrega! Nosso motorista leva a maquininha para cartão em até 10x sem juros ou PIX à vista com 5% de desconto.' },
      { from_me: false, text: 'Maravilha, moro no bairro Fonseca em Niterói, pode agendar a entrega!' },
    ];

    const evaluation = evaluateConversationMilestones(conv, messages, { hasOrderSheet: true });

    // Should run smoothly without errors and persist to memory
    await extractAndPersistConversationLearning(conv, messages, evaluation, 'test_tenant_learn', 'camila');

    // Retrieve agent profile and verify learnings
    const profile = await getAgentEvolutionProfile('camila', 'test_tenant_learn');
    assert.ok(profile, 'Profile must be returned');
    assert.equal(profile.agentKey, 'camila');
    assert.ok(Array.isArray(profile.badges), 'Badges must be an array');
    assert.ok(profile.badges.length >= 4, 'Must have at least 4 mastery badges');
    assert.ok(Array.isArray(profile.recentLogs), 'Recent logs must be an array');
  });

  it('compileSystemPrompt seamlessly incorporates active evolutionary learnings', () => {
    const agent = { name: 'Camila', role: 'Vendas' };
    const store = { name: 'Arte Concreto' };
    const contact = {
      phone: '5511999990000',
      evolutionaryLearnings: [
        'Cliente confirmou preferência por pagar na entrega com maquininha.',
        'Promoção de 20 sacos de cimento sai a R$ 18,20 a unidade.',
      ],
    };

    const prompt = compileSystemPrompt(agent, store, contact);
    assert.ok(prompt.includes('[APRENDIZADOS RECENTES DOS ATENDIMENTOS DA LOJA (MEMÓRIA EVOLUTIVA ATIVA)]'), 'Must contain evolutionary learnings header');
    assert.ok(prompt.includes('Cliente confirmou preferência por pagar na entrega com maquininha'), 'Must include first learning');
    assert.ok(prompt.includes('Promoção de 20 sacos de cimento sai a R$ 18,20 a unidade'), 'Must include second learning');
  });

  it('testAIConnection simulator awards XP and provides visual feedback metrics', async () => {
    const res = await testAIConnection({
      providerId: 'vps_engine',
      agentKey: 'camila',
      companyId: 'default',
      message: 'Olá, qual o valor da churrasqueira trio e posso pagar na entrega?',
      history: [],
    });

    assert.ok(res, 'Result must exist');
    assert.ok(res.xpEarned, 'Must provide xpEarned in result');
    assert.ok(res.xpEarned.total >= 15, 'Must award at least 15 XP');
    assert.ok(typeof res.xpEarned.reason === 'string', 'Must provide a readable reason for XP');
  });
});
