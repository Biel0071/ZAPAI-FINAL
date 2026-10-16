const test = require('node:test');
const assert = require('node:assert/strict');

const aiAntiRepetitionService = require('../services/aiAntiRepetitionService');
const conversationMemoryEngine = require('../services/conversationMemoryEngine');
const customerMemoryEngine = require('../src/ai/evolutionary/customerMemoryEngine');
const orchestrator = require('../src/ai/evolutionary/orchestrator');

test('Anti-Repetition: extracts last 3 bot replies from diverse history formats', () => {
  const history = [
    { role: 'user', content: 'Olá, bom dia!' },
    { role: 'assistant', content: 'Olá! Aqui é a Camila da loja. Como posso te ajudar na obra?' },
    { from: 'client', text: 'Queria saber sobre churrasqueira' },
    { from: 'agent', text: 'Temos o modelo Trio pré-moldado completo. Deseja que eu reserve esse modelo para a sua obra?' },
    { role: 'user', content: 'De 5 mil litros' },
    { role: 'assistant', content: 'Temos sim em polietileno. Qual o seu bairro para calcularmos o frete?' },
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

test('Anti-Repetition: strips repetitive greeting if bot already spoke earlier in conversation', () => {
  const recentBotReplies = [
    {
      text: 'Olá! Aqui é a Camila da loja. Como posso ajudar com sua obra hoje?',
      cta: 'Como posso ajudar com sua obra hoje?'
    }
  ];

  const incomingReply = 'Olá! Aqui é a Camila da loja. Temos a de 5 mil litros em polietileno com tampa de rosca. Qual o seu bairro?';
  const sanitized = aiAntiRepetitionService.sanitizeAndVaryBotReply(incomingReply, recentBotReplies);

  // Must strip the redundant greeting and start directly with the product confirmation
  assert.doesNotMatch(sanitized, /Aqui é a Camila/);
  assert.match(sanitized, /^Temos a de 5 mil litros em polietileno/);
});

test('Anti-Repetition: detects and replaces successive identical CTA', () => {
  const recentBotReplies = [
    {
      text: 'A Churrasqueira Trio pré-moldada sai por R$ 990,00. Deseja que eu reserve esse modelo para a sua obra?',
      cta: 'Deseja que eu reserve esse modelo para a sua obra?'
    }
  ];

  const repeatedReply = 'Temos também os dutos e acabamento em inox. Deseja que eu reserve esse modelo para a sua obra?';
  const sanitized = aiAntiRepetitionService.sanitizeAndVaryBotReply(repeatedReply, recentBotReplies);

  // Must replace the repeated CTA with an alternative commercial advance question
  assert.doesNotMatch(sanitized, /reserve esse modelo para a sua obra/i);
  assert.ok(sanitized.includes('?') || sanitized.includes('!'));
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

test('Orchestrator Fallback: never repeats self-introduction when conversation is in progress', async () => {
  const pastHistory = [
    { role: 'user', content: 'Boa tarde' },
    { role: 'assistant', content: 'Olá! Aqui é a Camila da loja. Como posso ajudar com sua obra hoje?' },
  ];

  const result = await orchestrator.orchestrateResponse({
    agent: { name: 'Camila' },
    conversation: { id: 1, phone: '5511999999999' },
    conversationHistory: pastHistory,
    customerMessage: 'De 5 mil litros',
    leadAnalysis: { intent: 'specification' },
    salesStrategy: {},
    store: { activeCompanyId: 'default' },
  });

  assert.ok(result);
  assert.ok(result.response);
  // Must NOT introduce itself again as "Olá! Aqui é a Camila"
  assert.doesNotMatch(result.response, /Aqui é a Camila/);
  // Must directly follow up on the 5 mil litros
  assert.match(result.response, /5 mil litros|5\.000 litros/i);
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
