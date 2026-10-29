const test = require('node:test');
const assert = require('node:assert/strict');
const { compileSystemPrompt, testAIConnection } = require('../services/ai.service');
const { TIER_DEFINITIONS } = require('../src/ai/evolutionary/humanAttendanceLearner');

test('Tier Definitions: contains 5 structured progression tiers with capabilities', () => {
  assert.equal(TIER_DEFINITIONS.length, 5);
  assert.equal(TIER_DEFINITIONS[0].level, 1);
  assert.equal(TIER_DEFINITIONS[0].title, 'Aprendiz Inicial');
  assert.equal(TIER_DEFINITIONS[4].level, 5);
  assert.equal(TIER_DEFINITIONS[4].title, 'Master Closer de Elite');
});

test('compileSystemPrompt: dynamically injects cognitive level directives based on agent level', () => {
  const store = { name: 'Arte Concreto' };
  
  // Level 1 Agent
  const agentL1 = { name: 'Camila', level: 1 };
  const promptL1 = compileSystemPrompt(agentL1, store);
  assert.match(promptL1, /CAPACIDADES COGNITIVAS ATIVAS DA IA - NÍVEL 1/);
  assert.match(promptL1, /NÍVEL 1 \(CONSULTA DE CATÁLOGO & HORÁRIOS\)/);
  assert.doesNotMatch(promptL1, /NÍVEL 3 \(PRECISÃO ARITMÉTICA & VOLUMES\)/);
  assert.doesNotMatch(promptL1, /NÍVEL 5\+ \(CONDUÇÃO AO FECHAMENTO & EXPEDIÇÃO\)/);

  // Level 3 Agent
  const agentL3 = { name: 'Camila', level: 3 };
  const promptL3 = compileSystemPrompt(agentL3, store);
  assert.match(promptL3, /CAPACIDADES COGNITIVAS ATIVAS DA IA - NÍVEL 3/);
  assert.match(promptL3, /NÍVEL 1 \(CONSULTA DE CATÁLOGO & HORÁRIOS\)/);
  assert.match(promptL3, /NÍVEL 2 \(CONDIÇÕES COMERCIAIS & LOGÍSTICA\)/);
  assert.match(promptL3, /NÍVEL 3 \(PRECISÃO ARITMÉTICA & VOLUMES\)/);
  assert.doesNotMatch(promptL3, /NÍVEL 4 \(DESAMBIGUAÇÃO TÉCNICA & OBJEÇÕES\)/);

  // Level 5+ Agent (Master Closer)
  const agentL5 = { name: 'Camila', level: 9, levelTitle: 'Master Closer Nível 9' };
  const promptL5 = compileSystemPrompt(agentL5, store);
  assert.match(promptL5, /CAPACIDADES COGNITIVAS ATIVAS DA IA - NÍVEL 9/);
  assert.match(promptL5, /NÍVEL 1 \(CONSULTA DE CATÁLOGO & HORÁRIOS\)/);
  assert.match(promptL5, /NÍVEL 3 \(PRECISÃO ARITMÉTICA & VOLUMES\)/);
  assert.match(promptL5, /NÍVEL 5\+ \(CONDUÇÃO AO FECHAMENTO & EXPEDIÇÃO\)/);
});

test('Anti-Farming & Diminishing Returns: repetitive queries do not score the same flat XP', async () => {
  const store = { name: 'Arte Concreto', aiConfig: { memorySettings: { enabled: false } } };
  const agent = { name: 'Camila', key: 'camila', level: 3 };

  // Turn 1: Initial greeting
  const resTurn1 = await testAIConnection({
    providerId: 'vps_engine',
    model: 'qwen2.5:3b',
    message: 'oi',
    history: [],
    store,
    agent,
  });
  assert.equal(resTurn1.xpEarned.total, 2);
  assert.match(resTurn1.xpEarned.reason, /Saudação Inicial Cortês/);

  // Turn 2: Repeated greeting with history
  const historyTurn2 = [
    { role: 'user', content: 'oi' },
    { role: 'assistant', content: 'Olá! Sou a Camila da Arte Concreto.' }
  ];
  const resTurn2 = await testAIConnection({
    providerId: 'vps_engine',
    model: 'qwen2.5:3b',
    message: 'oi de novo',
    history: historyTurn2,
    store,
    agent,
  });
  assert.equal(resTurn2.xpEarned.total, 0);
  assert.match(resTurn2.xpEarned.reason, /Saudação Repetida \(Sem XP adicional\)/);

  // Turn 3: First quote on bricks
  const historyTurn3 = [
    ...historyTurn2,
    { role: 'user', content: 'vocês vendem tijolo?' },
    { role: 'assistant', content: 'Temos sim! Tijolo cerâmico 8 e 12 furos.' }
  ];
  const resTurn3 = await testAIConnection({
    providerId: 'vps_engine',
    model: 'qwen2.5:3b',
    message: '12 furos 1500 tijolos quanto fica',
    history: historyTurn3,
    store,
    agent,
  });
  assert.equal(resTurn3.xpEarned.total, 15);
  assert.match(resTurn3.xpEarned.reason, /Cotação & Condições Comerciais/);

  // Turn 4: Repeated quote for the same product ("tijolo")
  const historyTurn4 = [
    ...historyTurn3,
    { role: 'user', content: '12 furos 1500 tijolos quanto fica' },
    { role: 'assistant', content: '1.500 tijolos 12 furos fica R$ 1.275,00.' }
  ];
  const resTurn4 = await testAIConnection({
    providerId: 'vps_engine',
    model: 'qwen2.5:3b',
    message: 'tijolo 12 furos qual valor',
    history: historyTurn4,
    store,
    agent,
  });
  assert.equal(resTurn4.xpEarned.total, 2);
  assert.match(resTurn4.xpEarned.reason, /Anti-Farming/);

  // Turn 5: Real closure & delivery data
  const historyTurn5 = [
    ...historyTurn4,
    { role: 'user', content: 'tijolo 12 furos qual valor' },
    { role: 'assistant', content: 'R$ 850 o milheiro.' }
  ];
  const resTurn5 = await testAIConnection({
    providerId: 'vps_engine',
    model: 'qwen2.5:3b',
    message: 'pode fechar o pedido, meu nome é Carlos e o endereço é rua central no bairro jardins',
    history: historyTurn5,
    store,
    agent,
  });
  assert.equal(resTurn5.xpEarned.total, 35);
  assert.match(resTurn5.xpEarned.reason, /Fechamento & Ficha Cadastral/);
});
