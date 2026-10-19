const test = require('node:test');
const assert = require('node:assert/strict');
const customerMemoryEngine = require('../src/ai/evolutionary/customerMemoryEngine');
const conversationMemoryEngine = require('../services/conversationMemoryEngine');
const {
  detectCustomerArchetype,
  buildLeadAlgorithm,
} = require('../services/leadAnalyzer');

test('CustomerMemoryEngine: extracts rich facts (name, quantity, urgency, address, objection)', () => {
  // Test 1: Declared name
  const facts1 = customerMemoryEngine.extractFactsLocally('Olá, me chamo Marcos e queria ver sobre churrasqueira');
  assert.equal(facts1.customerName, 'Marcos');
  assert.equal(facts1.product, 'Churrasqueira Trio');

  // Test 2: Quantity and product
  const facts2 = customerMemoryEngine.extractFactsLocally('Preciso de 3 milheiros de tijolo baiano para entrega no Centro');
  assert.equal(facts2.quantity, '3 milheiros');
  assert.equal(facts2.product, 'Tijolo 8 Furos (Milheiro)');
  assert.equal(facts2.neighborhood, 'Centro');

  // Test 3: Urgency
  const facts3 = customerMemoryEngine.extractFactsLocally('A concretagem é amanhã, obra parada preciso pra hoje de cimento');
  assert.equal(facts3.product, 'Cimento CP II 50kg');
  assert.equal(facts3.urgency, 'Alta Urgência (Hoje/Amanhã)');

  // Test 4: Address
  const facts4 = customerMemoryEngine.extractFactsLocally('Pode entregar na Rua das Palmeiras 120, bairro Industrial?');
  assert.ok(facts4.address.includes('Rua das Palmeiras 120'));
  assert.equal(facts4.neighborhood, 'Industrial');

  // Test 5: Objection
  const facts5 = customerMemoryEngine.extractFactsLocally('Gostei do modelo, mas vou falar com meu pedreiro antes');
  assert.ok(facts5.objection.toLowerCase().includes('pensar') || facts5.objection.toLowerCase().includes('consult'));
});

test('LeadAnalyzer: correctly classifies customer archetypes', () => {
  // 1. Builder / Contractor
  const arch1 = detectCustomerArchetype('Aqui é o mestre de obras Carlos, preciso de faturamento e nota fiscal no CNPJ');
  assert.equal(arch1.archetype, 'builder_contractor');
  assert.ok(arch1.archetypeGuidance.includes('técnica'));

  // 2. Urgent / Emergency
  const arch2 = detectCustomerArchetype('Acabou o cimento aqui, obra parada preciso pra hoje com urgência');
  assert.equal(arch2.archetype, 'urgent_emergency');
  assert.ok(arch2.archetypeGuidance.includes('prontidão'));

  // 3. Price Negotiator
  const arch3 = detectCustomerArchetype('Qual o desconto para fechar à vista no pix ou consegue parcelar em 10x?');
  assert.equal(arch3.archetype, 'price_negotiator');
  assert.ok(arch3.archetypeGuidance.includes('PIX'));

  // 4. Homeowner / Retail
  const arch4 = detectCustomerArchetype('Quero colocar uma churrasqueira bonita na varanda da minha casa para fazer churrasco');
  assert.equal(arch4.archetype, 'homeowner_retail');
  assert.ok(arch4.archetypeGuidance.includes('acolhedora'));
});

test('CustomerMemoryEngine: compiles prompt with rich facts and archetype guidance', () => {
  const context = {
    name: 'Carlos',
    stage: 'negotiation',
    leadTemperature: 'hot',
    neighborhood: 'Industrial',
    address: 'Rua das Palmeiras 120',
    quantity: '3 milheiros',
    urgency: 'Alta Urgência (Hoje/Amanhã)',
    objection: 'Sensível a preço',
    paymentPreference: 'PIX',
    leadAlgorithm: {
      algorithmCode: 'ALGO-01',
      algorithmName: 'Fechamento Rápido & PIX',
      styleLabel: 'Direto & Objetivo',
      conversationStyle: 'direct_objective',
      customerArchetype: 'builder_contractor',
      customerArchetypeLabel: 'Profissional da Construção (Mestre/Empreiteiro/Engenheiro)',
      archetypeGuidance: 'Comunicação prática, técnica e ágil.',
      storeStandardRule: 'Padrão da Loja: Tabela oficial + PIX à vista.',
      directive: 'Responda em 1 a 2 frases curtas com o valor exato.',
    },
  };

  const compiledPrompt = customerMemoryEngine.compileCustomerMemoryPrompt(context);
  assert.ok(compiledPrompt.includes('Carlos'));
  assert.ok(compiledPrompt.includes('3 milheiros'));
  assert.ok(compiledPrompt.includes('Rua das Palmeiras 120'));
  assert.ok(compiledPrompt.includes('Alta Urgência'));
  assert.ok(compiledPrompt.includes('Sensível a preço'));
  assert.ok(compiledPrompt.includes('Profissional da Construção'));
  assert.ok(compiledPrompt.includes('Comunicação prática, técnica e ágil'));
});

test('ConversationMemoryEngine: extracts quantity and customer name into active memory', () => {
  const memory = {
    facts: {},
    commercial: {},
    metrics: {},
  };

  conversationMemoryEngine.extractFactsFromContext(
    'Olá, me chamo Marcos e preciso de 2 milheiros de tijolos pra entregar no Centro',
    {},
    memory
  );

  assert.equal(memory.name, 'Marcos');
  assert.equal(memory.commercial.quantity, '2 milheiros');
  assert.equal(memory.facts.quantidade_solicitada?.value, '2 milheiros');
  assert.equal(memory.facts.nome_cliente?.value, 'Marcos');
});
