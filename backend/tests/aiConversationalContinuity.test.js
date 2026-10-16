const test = require('node:test');
const assert = require('node:assert/strict');

const aiAntiRepetitionService = require('../services/aiAntiRepetitionService');
const conversationMemoryEngine = require('../services/conversationMemoryEngine');
const customerMemoryEngine = require('../src/ai/evolutionary/customerMemoryEngine');
const orchestrator = require('../src/ai/evolutionary/orchestrator');

test.after(async () => {
  const engines = [
    customerMemoryEngine,
    orchestrator.knowledgeEngine,
    orchestrator.playbookEngine,
    orchestrator.experienceEngine,
    orchestrator.learningEngine,
  ];
  for (const eng of engines) {
    try {
      if (eng && eng.pool && typeof eng.pool.end === 'function') {
        await eng.pool.end();
      }
    } catch (_) {}
  }
  try {
    const db = require('../src/infrastructure/config/database');
    if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
  } catch (_) {}
});

test('Anti-Repetition: extracts last 3 bot replies from diverse history formats', () => {
  const history = [
    { role: 'user', content: 'Olá, bom dia!' },
    { role: 'assistant', content: 'Olá! Aqui é a Camila da loja. Como posso te ajudar na obra?' },
    { from: 'client', text: 'Queria saber sobre churrasqueira' },
    { from: 'agent', text: 'Temos o modelo Trio pré-moldado completo. Deseja que eu reserve esse modelo para a sua obra?' },
    { from_me: false, text: 'De 5 mil litros' },
    { from_me: true, text: 'Temos sim em polietileno. Qual o seu bairro para calcularmos o frete?' },
    { role: 'user', content: 'Centro' },
  ];

  const extracted = aiAntiRepetitionService.extractRecentBotReplies(history, 3);
  assert.equal(extracted.length, 3);
  assert.match(extracted[0].text, /Como posso te ajudar/);
  assert.match(extracted[1].text, /reserve esse modelo/);
  assert.match(extracted[2].text, /Qual o seu bairro/);
  assert.equal(extracted[1].cta, 'Deseja que eu reserve esse modelo para a sua obra?');
  assert.equal(extracted[2].cta, 'Qual o seu bairro para calcularmos o frete?');
});

test('Anti-Repetition: strips repetitive greeting and self-introduction mid-conversation cleanly', () => {
  const recentBotReplies = [
    {
      text: 'Olá! Aqui é a Camila da loja. Como posso ajudar com sua obra hoje?',
      cta: 'Como posso ajudar com sua obra hoje?'
    }
  ];

  // Case A: Standard greeting + intro
  const replyA = 'Olá! Aqui é a Camila da loja. Temos a de 5 mil litros em polietileno com tampa de rosca. Qual o seu bairro?';
  const cleanA = aiAntiRepetitionService.sanitizeAndVaryBotReply(replyA, recentBotReplies);
  assert.doesNotMatch(cleanA, /Aqui é a Camila/);
  assert.doesNotMatch(cleanA, /^Olá/);
  assert.match(cleanA, /^Temos a de 5 mil litros em polietileno/);

  // Case B: Conversational pleasantry "tudo bem com você?" + intro
  const replyB = 'Olá! Tudo bem com você? Aqui é a Camila da loja. Temos a de 5 mil litros em estoque.';
  const cleanB = aiAntiRepetitionService.sanitizeAndVaryBotReply(replyB, recentBotReplies);
  assert.doesNotMatch(cleanB, /com você/i);
  assert.doesNotMatch(cleanB, /Aqui é a Camila/i);
  assert.equal(cleanB, 'Temos a de 5 mil litros em estoque.');

  // Case C: "Oi, tudo bom? Sou a Camila da loja."
  const replyC = 'Oi, tudo bom? Sou a Camila da loja. O milheiro está saindo por R$ 720.';
  const cleanC = aiAntiRepetitionService.sanitizeAndVaryBotReply(replyC, recentBotReplies);
  assert.doesNotMatch(cleanC, /tudo bom/i);
  assert.doesNotMatch(cleanC, /Sou a Camila/i);
  assert.equal(cleanC, 'O milheiro está saindo por R$ 720.');
});

test('Anti-Repetition: detects semantic CTA repetition (intent-based) and replaces with fresh question', () => {
  const recentBotReplies = [
    {
      text: 'A Churrasqueira Trio pré-moldada sai por R$ 990,00. Deseja que eu reserve esse modelo para a sua obra?',
      cta: 'Deseja que eu reserve esse modelo para a sua obra?'
    }
  ];

  // Paraphrased version with same intent (RESERVA)
  const repeatedReply = 'Temos também os dutos e acabamento em inox. Quer que eu reserve para a sua obra?';
  
  assert.equal(aiAntiRepetitionService.areCtasSimilar(
    'Deseja que eu reserve esse modelo para a sua obra?',
    'Quer que eu reserve para a sua obra?'
  ), true);

  const sanitized = aiAntiRepetitionService.sanitizeAndVaryBotReply(repeatedReply, recentBotReplies);

  // Must replace the repeated CTA with a different advance question
  assert.doesNotMatch(sanitized, /reserve para a sua obra/i);
  assert.doesNotMatch(sanitized, /reserve esse modelo/i);
  assert.ok(sanitized.includes('?') || sanitized.includes('!'));
});

test('Anti-Repetition: sentence-level deduplication drops repeated substantive sentences', () => {
  const recentBotReplies = [
    {
      text: 'Nosso frete é grátis para pedidos acima de R$ 500 num raio de até 15km da loja.',
      cta: 'Qual o seu bairro?'
    }
  ];

  const incomingReply = 'Nosso frete é grátis para pedidos acima de R$ 500 num raio de até 15km da loja. Para o Centro a entrega leva 2 dias úteis. Posso agendar a entrega?';
  const sanitized = aiAntiRepetitionService.sanitizeAndVaryBotReply(incomingReply, recentBotReplies);

  assert.doesNotMatch(sanitized, /Nosso frete é grátis para pedidos acima de R\$ 500 num raio de até 15km da loja\./);
  assert.match(sanitized, /Para o Centro a entrega leva 2 dias/);
});

test('Seguimento Real: extracts 5.000 Litros and Caixa d\'água from "De 5 mil litros"', () => {
  const memory = {
    facts: {},
    commercial: {},
    pendingQuestions: [],
  };

  conversationMemoryEngine.extractFactsFromContext('De 5 mil litros', {}, memory);

  assert.equal(memory.commercial.capacity, '5.000 Litros');
  assert.equal(memory.commercial.activeProduct, "Caixa d'água");

  const prompt = conversationMemoryEngine.buildContextualPrompt(memory);
  assert.match(prompt, /5\.000 Litros/);
  assert.match(prompt, /Caixa d'água/);
  assert.match(prompt, /REGRA CRÍTICA DE CONTINUIDADE E SEGUIMENTO REAL/);
});

test('Seguimento Real: accurately extracts 10.000L without corrupting to 1.000L', () => {
  const memory = {
    facts: {},
    commercial: {},
    pendingQuestions: [],
  };

  conversationMemoryEngine.extractFactsFromContext('Quero uma caixa de 10000 litros', {}, memory);
  assert.equal(memory.commercial.capacity, '10.000 Litros');
  assert.notEqual(memory.commercial.capacity, '1.000 Litros');

  const facts10k = customerMemoryEngine.extractFactsLocally('De 10 mil litros');
  assert.equal(facts10k.capacity, '10.000 Litros');

  const facts3k = customerMemoryEngine.extractFactsLocally('De 3 mil litros');
  assert.equal(facts3k.capacity, '3.000 Litros');

  const facts500 = customerMemoryEngine.extractFactsLocally('caixa de 500 litros');
  assert.equal(facts500.capacity, '500 Litros');
});

test('Contexto Total: extracts payment preference and delivery location without re-asking', () => {
  const memory = {
    facts: {},
    commercial: {},
    pendingQuestions: [],
  };

  conversationMemoryEngine.extractFactsFromContext('Vou pagar no pix e a entrega é em Jacarepaguá', {}, memory);

  assert.match(memory.commercial.paymentPreference, /PIX/);
  assert.match(memory.commercial.deliveryCity, /Jacarepagu/);

  const prompt = conversationMemoryEngine.buildContextualPrompt(memory);
  assert.match(prompt, /PIX/);
  assert.match(prompt, /Jacarepagu/);
});

test('CustomerMemoryEngine: updates facts with capacity and payment preference', async () => {
  const memoryContext = {
    name: 'Roberto',
    stage: 'negotiation',
    leadTemperature: 'hot',
    neighborhood: 'Centro',
    capacity: '5.000 Litros',
    paymentPreference: 'PIX (à vista com desconto)',
  };

  const compiledPrompt = customerMemoryEngine.compileCustomerMemoryPrompt(memoryContext);
  assert.match(compiledPrompt, /5\.000 Litros/);
  assert.match(compiledPrompt, /NÃO pergunte o tamanho novamente/);
  assert.match(compiledPrompt, /PIX/);
  assert.match(compiledPrompt, /NÃO pergunte forma de pagamento novamente/);
});

test('Orchestrator Fallback: dynamic capacity acknowledgment on "De 3 mil litros"', async () => {
  const pastHistory = [
    { role: 'user', content: 'Boa tarde' },
    { role: 'assistant', content: 'Olá! Aqui é a Camila da loja. Como posso ajudar com sua obra hoje?' },
  ];

  const result = await orchestrator.orchestrateResponse({
    agent: { name: 'Camila' },
    conversation: { id: 1, phone: '5511999999999' },
    conversationHistory: pastHistory,
    customerMessage: 'De 3 mil litros',
    leadAnalysis: { intent: 'specification' },
    salesStrategy: {},
    store: { activeCompanyId: 'default' },
  });

  assert.ok(result);
  assert.ok(result.response);
  // Must NOT introduce itself again
  assert.doesNotMatch(result.response, /Aqui é a Camila/);
  // Must address 3 mil / 3.000 litros directly, NOT 5 mil litros!
  assert.match(result.response, /3\.000 Litros|3 mil litros/i);
  assert.doesNotMatch(result.response, /5 mil litros|5\.000 litros/i);
});

test('Orchestrator Prompt: Layer 5 enforces anti-repetition and direct follow-up hierarchy', async () => {
  const evoData = await orchestrator.buildEvolutionaryPrompt({
    companyId: 'default',
    contact: { phone: '5511888888888' },
    message: 'De 5 mil litros',
    history: [
      { role: 'assistant', content: 'Olá! Qual capacidade procura? Deseja que eu reserve esse modelo para a sua obra?' }
    ]
  });

  assert.ok(evoData.prompt);
  assert.match(evoData.prompt, /RASTREAMENTO DE RESPOSTAS DO ATENDENTE & DIRETRIZ ANTI-REPETIÇÃO/);
  assert.match(evoData.prompt, /PROIBIDO REPETIR O MESMO CTA/);
  assert.match(evoData.prompt, /SEGUIMENTO DIRETO NA LINHA DE RACIOCÍNIO/);
});

test('Multi-Turn Continuity: progresses dynamically across 3 turns without repeating greetings or CTAs', async () => {
  // Turn 1: Customer specifies capacity
  const r1 = await orchestrator.orchestrateResponse({
    agent: { name: 'Camila' },
    conversation: { id: 2, phone: '5511999990001' },
    conversationHistory: [{ role: 'assistant', content: 'Olá! Aqui é a Camila da loja. Como posso ajudar com sua obra?' }],
    customerMessage: 'De 3 mil litros',
    leadAnalysis: { intent: 'specification' },
    salesStrategy: {},
    store: { activeCompanyId: 'default' },
  });

  assert.ok(r1.response);
  assert.doesNotMatch(r1.response, /Aqui é a Camila/);
  assert.match(r1.response, /3\.000 Litros|3 mil litros/i);

  // Turn 2: Customer specifies neighborhood
  const r2 = await orchestrator.orchestrateResponse({
    agent: { name: 'Camila' },
    conversation: { id: 2, phone: '5511999990001' },
    conversationHistory: [
      { role: 'assistant', content: 'Olá! Aqui é a Camila da loja.' },
      { role: 'user', content: 'De 3 mil litros' },
      { role: 'assistant', content: r1.response },
    ],
    customerMessage: 'Sou do Centro',
    leadAnalysis: { intent: 'location' },
    salesStrategy: {},
    store: { activeCompanyId: 'default' },
  });

  assert.ok(r2.response);
  assert.doesNotMatch(r2.response, /Aqui é a Camila/);
  assert.match(r2.response, /Centro/);
  assert.doesNotMatch(r2.response, /Qual o seu bairro/i);

  // Turn 3: Customer specifies payment
  const r3 = await orchestrator.orchestrateResponse({
    agent: { name: 'Camila' },
    conversation: { id: 2, phone: '5511999990001' },
    conversationHistory: [
      { role: 'assistant', content: r1.response },
      { role: 'user', content: 'Sou do Centro' },
      { role: 'assistant', content: r2.response },
    ],
    customerMessage: 'Vou pagar no PIX',
    leadAnalysis: { intent: 'payment' },
    salesStrategy: {},
    store: { activeCompanyId: 'default' },
  });

  assert.ok(r3.response);
  assert.doesNotMatch(r3.response, /Aqui é a Camila/);
  assert.match(r3.response, /PIX/i);
  // Must NOT re-ask payment method
  assert.doesNotMatch(r3.response, /Prefere pagar no PIX|Qual forma de pagamento/i);
});

