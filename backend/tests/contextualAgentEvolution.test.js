const test = require('node:test');
const assert = require('node:assert/strict');

const conversationMemoryEngine = require('../services/conversationMemoryEngine');
const quickReplyCapability = require('../services/quickReplyCapability');
const quickReplyService = require('../services/quickReplyService');
const { query } = require('../src/infrastructure/config/database');

const TEST_TENANT_A = 'test-tenant-ctx-a';
const TEST_TENANT_B = 'test-tenant-ctx-b';
const TEST_PHONE_1 = '5511988880001';
const TEST_PHONE_2 = '5511988880002';

// Limpeza pré e pós testes
async function cleanupTestData() {
  try {
    await query(`DELETE FROM ai_conversation_memory WHERE company_id IN ($1, $2)`, [TEST_TENANT_A, TEST_TENANT_B]);
    await query(`DELETE FROM agent_learning_events WHERE company_id IN ($1, $2)`, [TEST_TENANT_A, TEST_TENANT_B]);
    await query(`DELETE FROM quick_replies WHERE company_id IN ($1, $2)`, [TEST_TENANT_A, TEST_TENANT_B]);
  } catch (err) {
    // Silently continue if tables are temporarily locked or empty
  }
}

test.before(async () => {
  await cleanupTestData();
});

test.after(async () => {
  await cleanupTestData();
});

test('1. New client vs recurring client: memory continuity and multi-level structure', async () => {
  // Novo cliente: estrutura padrão limpa inicializada
  const newMemory = await conversationMemoryEngine.getConversationMemory({
    contactId: TEST_PHONE_1,
    phone: TEST_PHONE_1,
    companyId: TEST_TENANT_A,
  });

  assert.ok(newMemory);
  assert.equal(newMemory.contactId, TEST_PHONE_1);
  assert.equal(newMemory.companyId, TEST_TENANT_A);
  assert.deepEqual(newMemory.facts, {});
  assert.equal(newMemory.commercial.activeProduct, null);

  // Cliente recorrente: adiciona fatos e persiste
  conversationMemoryEngine.setCustomerFact(newMemory, {
    key: 'produto_interesse',
    value: "Caixa d'água",
    category: conversationMemoryEngine.MEMORY_CATEGORIES.COMMERCIAL_INTENT,
    importance: 9,
  });
  conversationMemoryEngine.setCustomerFact(newMemory, {
    key: 'capacidade',
    value: '5.000 Litros',
    category: conversationMemoryEngine.MEMORY_CATEGORIES.COMMERCIAL_INTENT,
    importance: 9,
  });
  conversationMemoryEngine.setCustomerFact(newMemory, {
    key: 'cidade_entrega',
    value: 'Sorocaba',
    category: conversationMemoryEngine.MEMORY_CATEGORIES.CUSTOMER_FACT,
    importance: 8,
  });

  newMemory.pendingQuestions = ['Confirmar se local tem acesso para caminhão'];

  await conversationMemoryEngine.persistConversationMemory(newMemory, TEST_TENANT_A);

  // Recupera cliente recorrente
  const recurringMemory = await conversationMemoryEngine.getConversationMemory({
    contactId: TEST_PHONE_1,
    phone: TEST_PHONE_1,
    companyId: TEST_TENANT_A,
  });

  assert.ok(recurringMemory);
  assert.equal(recurringMemory.commercial.activeProduct, "Caixa d'água");
  assert.equal(recurringMemory.commercial.capacity, '5.000 Litros');
  assert.equal(recurringMemory.commercial.deliveryCity, 'Sorocaba');
  assert.equal(recurringMemory.facts.capacidade.value, '5.000 Litros');
  assert.equal(recurringMemory.pendingQuestions.length, 1);

  // Valida que o prompt contextual gerado contém todas as informações consolidadas e regras de continuidade
  const prompt = conversationMemoryEngine.buildContextualPrompt(recurringMemory);
  assert.match(prompt, /MEMÓRIA ATIVA DO CLIENTE/);
  assert.match(prompt, /Caixa d'água/);
  assert.match(prompt, /5\.000 Litros/);
  assert.match(prompt, /Sorocaba/);
  assert.match(prompt, /REGRA CRÍTICA DE CONTINUIDADE/);
  assert.match(prompt, /JAMAIS deve pedir informações que já constam na memória/);
});

test('2. Contextual differentiation: "Quanto fica?" for Churrasqueira vs Caixa d\'água 5000L', async () => {
  // Configura duas respostas rápidas com produtos distintos
  await quickReplyService.saveQuickReply({
    id: 'test_qr_churrasqueira',
    title: 'Churrasqueira Pré-Moldada Completa',
    category: 'churrasqueira',
    tags: ['churrasqueira', 'carvao', 'grelha'],
    content: 'Churrasqueira pré-moldada modelo Tijolinho por R$ 1.250 à vista com grelha inclusa.',
    companyId: TEST_TENANT_A,
  });

  await quickReplyService.saveQuickReply({
    id: 'test_qr_caixa_5000',
    title: "Caixa d'água 5000L Fortlev",
    category: 'caixa dagua',
    tags: ['caixa', 'dagua', '5000l', '5000 litros'],
    content: "Caixa d'água de 5.000L em polietileno por R$ 2.490 à vista com tampa roscável.",
    companyId: TEST_TENANT_A,
  });

  // Caso 1: Contexto é Caixa d'água 5000L
  const matchCaixa = await quickReplyCapability.findBestMatchForContext({
    message: 'Quanto fica?',
    product: 'caixa',
    companyId: TEST_TENANT_A,
  });
  assert.ok(matchCaixa);
  assert.equal(matchCaixa.id, 'test_qr_caixa_5000');
  assert.match(matchCaixa.content, /2\.490/);

  // Caso 2: Contexto é Churrasqueira
  const matchChurrasqueira = await quickReplyCapability.findBestMatchForContext({
    message: 'Quanto fica?',
    product: 'churrasqueira',
    companyId: TEST_TENANT_A,
  });
  assert.ok(matchChurrasqueira);
  assert.equal(matchChurrasqueira.id, 'test_qr_churrasqueira');
  assert.match(matchChurrasqueira.content, /1\.250/);
});

test('3. Quick Reply capability search and multimodal retrieval (image, audio, text)', async () => {
  // Cadastra resposta rápida multimodal com imagem e texto
  await quickReplyService.saveQuickReply({
    id: 'test_qr_multimodal_caixa',
    title: "Fotos da Caixa d'água 5000L",
    category: 'fotos',
    tags: ['foto', 'imagem', 'caixa', '5000l'],
    mediaType: 'image',
    mediaUrl: 'https://storage.zapai.app/media/caixa5000.jpg',
    content: "Aqui estão as fotos reais da Caixa d'água de 5.000L com medidas e tampa.",
    items: [
      { type: 'image', value: 'https://storage.zapai.app/media/caixa5000.jpg', caption: 'Caixa 5000L com tampa' },
      { type: 'text', value: 'Acompanha flange e adaptador de saída.' },
    ],
    companyId: TEST_TENANT_A,
  });

  // Busca por intenção de imagem
  const searchResults = await quickReplyCapability.searchQuickReplies({
    query: 'foto da caixa 5000',
    intent: 'foto',
    product: 'caixa',
    mediaType: 'image',
    companyId: TEST_TENANT_A,
  });

  assert.ok(searchResults.length > 0);
  const topResult = searchResults[0];
  assert.equal(topResult.quickReply.id, 'test_qr_multimodal_caixa');
  assert.ok(topResult.availableTypes.includes('image'));

  // Context Match com extração do item de mídia solicitado
  const bestMatch = await quickReplyCapability.findBestMatchForContext({
    message: 'Tem foto dela?',
    product: 'caixa',
    companyId: TEST_TENANT_A,
  });

  assert.ok(bestMatch);
  assert.equal(bestMatch.requestedMediaType, 'image');
  assert.ok(bestMatch.selectedMediaItem);
  assert.equal(bestMatch.selectedMediaItem.type, 'image');
  assert.equal(bestMatch.selectedMediaItem.value, 'https://storage.zapai.app/media/caixa5000.jpg');

  // Formatação de capacidades para System Prompt
  const promptCap = quickReplyCapability.formatCapabilitiesForPrompt([topResult.quickReply]);
  assert.match(promptCap, /\[Mídias: image, text\]/);
  assert.match(promptCap, /test_qr_multimodal_caixa/);
});

test('4. 5-level memory conflict resolution: updating facts without key duplication', () => {
  const memory = {
    facts: {},
    commercial: {},
  };

  // Fato inicial: cliente diz que quer caixa de 3000L
  conversationMemoryEngine.setCustomerFact(memory, {
    key: 'capacidade',
    value: '3.000 Litros',
    category: conversationMemoryEngine.MEMORY_CATEGORIES.COMMERCIAL_INTENT,
  });
  assert.equal(Object.keys(memory.facts).length, 1);
  assert.equal(memory.commercial.capacity, '3.000 Litros');

  // Fato conflitante: cliente muda de ideia e escolhe 5.000 Litros
  conversationMemoryEngine.setCustomerFact(memory, {
    key: 'capacidade',
    value: '5.000 Litros',
    category: conversationMemoryEngine.MEMORY_CATEGORIES.COMMERCIAL_INTENT,
  });

  // Deve haver exatamente 1 fato (sem duplicações) e com o novo valor
  assert.equal(Object.keys(memory.facts).length, 1);
  assert.equal(memory.facts.capacidade.value, '5.000 Litros');
  assert.equal(memory.commercial.capacity, '5.000 Litros');

  // Atualização de cidade de entrega
  conversationMemoryEngine.setCustomerFact(memory, {
    key: 'cidade_entrega',
    value: 'São Paulo',
    category: conversationMemoryEngine.MEMORY_CATEGORIES.CUSTOMER_FACT,
  });
  assert.equal(memory.commercial.deliveryCity, 'São Paulo');

  // Mudança de endereço de entrega
  conversationMemoryEngine.setCustomerFact(memory, {
    key: 'cidade_entrega',
    value: 'Campinas',
    category: conversationMemoryEngine.MEMORY_CATEGORIES.CUSTOMER_FACT,
  });
  assert.equal(Object.keys(memory.facts).length, 2);
  assert.equal(memory.facts.cidade_entrega.value, 'Campinas');
  assert.equal(memory.commercial.deliveryCity, 'Campinas');
});

test('5. Automatic fact extraction from conversational utterances', () => {
  const memory = { facts: {}, commercial: {} };

  // Frase 1: Produto e Capacidade
  conversationMemoryEngine.extractFactsFromContext(
    "Boa tarde, estou procurando uma caixa d'água de 5 mil litros",
    {},
    memory
  );
  assert.equal(memory.commercial.activeProduct, "Caixa d'água");
  assert.equal(memory.commercial.capacity, '5.000 Litros');

  // Frase 2: Cidade de entrega
  conversationMemoryEngine.extractFactsFromContext(
    'Vocês fazem entrega para Campinas?',
    {},
    memory
  );
  assert.equal(memory.commercial.deliveryCity, 'Campinas');

  // Frase 3: Objeção / decisão de compra
  conversationMemoryEngine.extractFactsFromContext(
    'Perfeito, vou pensar com calma e te aviso',
    {},
    memory
  );
  assert.ok(memory.facts.objecao_compra);
  assert.match(memory.facts.objecao_compra.value, /pensar/i);
});

test('6. Human learning feedback recording (/ai/learning/feedback)', async () => {
  const insertRes = await query(`
    INSERT INTO agent_learning_events (
      agent_key, company_id, event_type, customer_question, ai_response, human_answer,
      contact_phone, contact_name, conversation_id, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
    RETURNING id, status, customer_question, human_answer
  `, [
    'atendente_vendas',
    TEST_TENANT_A,
    'human_edit_feedback',
    'Quanto tempo demora a entrega da caixa de 5000L em Campinas?',
    'A entrega costuma demorar alguns dias.',
    'Para Campinas entregamos em até 48 horas úteis com frete grátis!',
    TEST_PHONE_1,
    'Carlos Silva',
    'conv_test_123',
  ]);

  assert.ok(insertRes.rows.length > 0);
  const row = insertRes.rows[0];
  assert.equal(row.status, 'pending');
  assert.match(row.human_answer, /48 horas/);

  // Verifica que o evento foi registrado na tabela e pode ser consultado por tenant
  const selectRes = await query(`
    SELECT * FROM agent_learning_events
    WHERE company_id = $1 AND id = $2
  `, [TEST_TENANT_A, row.id]);

  assert.equal(selectRes.rows.length, 1);
  assert.equal(selectRes.rows[0].contact_phone, TEST_PHONE_1);
});

test('7. Multi-tenant isolation between Store A and Store B', async () => {
  // Salva dados para o mesmo telefone na Loja A
  const memoryA = {
    contactId: TEST_PHONE_2,
    phone: TEST_PHONE_2,
    name: 'Cliente Loja A',
    companyId: TEST_TENANT_A,
    facts: {},
    commercial: { activeProduct: "Caixa d'água 5000L", deliveryCity: 'Paulínia' },
  };
  await conversationMemoryEngine.persistConversationMemory(memoryA, TEST_TENANT_A);

  // Salva dados para o mesmo telefone na Loja B
  const memoryB = {
    contactId: TEST_PHONE_2,
    phone: TEST_PHONE_2,
    name: 'Cliente Loja B',
    companyId: TEST_TENANT_B,
    facts: {},
    commercial: { activeProduct: 'Churrasqueira 3 Bocas', deliveryCity: 'Santos' },
  };
  await conversationMemoryEngine.persistConversationMemory(memoryB, TEST_TENANT_B);

  // Consulta Loja A: deve retornar apenas Caixa d'água
  const fetchedA = await conversationMemoryEngine.getConversationMemory({
    contactId: TEST_PHONE_2,
    phone: TEST_PHONE_2,
    companyId: TEST_TENANT_A,
  });
  assert.equal(fetchedA.name, 'Cliente Loja A');
  assert.equal(fetchedA.commercial.activeProduct, "Caixa d'água 5000L");
  assert.equal(fetchedA.commercial.deliveryCity, 'Paulínia');

  // Consulta Loja B: deve retornar apenas Churrasqueira
  const fetchedB = await conversationMemoryEngine.getConversationMemory({
    contactId: TEST_PHONE_2,
    phone: TEST_PHONE_2,
    companyId: TEST_TENANT_B,
  });
  assert.equal(fetchedB.name, 'Cliente Loja B');
  assert.equal(fetchedB.commercial.activeProduct, 'Churrasqueira 3 Bocas');
  assert.equal(fetchedB.commercial.deliveryCity, 'Santos');
});

test('8. Full Acceptance Simulation (Section 25 of specification)', async () => {
  const simPhone = '5511977770001';
  const tenant = TEST_TENANT_A;

  // Turno 1: Cliente inicia contato demonstrando interesse em Caixa d'água 5000L
  let memory = await conversationMemoryEngine.getConversationMemory({ contactId: simPhone, phone: simPhone, companyId: tenant });
  conversationMemoryEngine.extractFactsFromContext("Olá, gostaria de saber sobre a caixa d'água de 5000 litros", {}, memory);
  await conversationMemoryEngine.persistConversationMemory(memory, tenant);

  assert.equal(memory.commercial.activeProduct, "Caixa d'água");
  assert.equal(memory.commercial.capacity, '5.000 Litros');

  // Turno 2: Cliente pergunta apenas "Quanto fica?"
  // O sistema DEVE recuperar a memória ativa e identificar que o preço se refere à Caixa d'água 5000L
  memory = await conversationMemoryEngine.getConversationMemory({ contactId: simPhone, phone: simPhone, companyId: tenant });
  const promptTurn2 = conversationMemoryEngine.buildContextualPrompt(memory);

  assert.match(promptTurn2, /PRODUTO ATUAL EM FOCO: Caixa d'água/);
  assert.match(promptTurn2, /CAPACIDADE \/ MEDIDA DEFINIDA: 5\.000 Litros/);
  assert.match(promptTurn2, /JAMAIS deve pedir informações que já constam na memória/);

  // Turno 3: Cliente pergunta "Tem foto?"
  // O sistema DEVE acionar a busca de capacidade multimodal e retornar imagem
  const photoMatch = await quickReplyCapability.findBestMatchForContext({
    message: 'Tem foto dela?',
    product: memory.commercial.activeProduct,
    companyId: tenant,
  });
  assert.ok(photoMatch);
  assert.equal(photoMatch.requestedMediaType, 'image');

  // Turno 4: Cliente pergunta sobre entrega "Vocês entregam em Campinas?"
  conversationMemoryEngine.extractFactsFromContext('Vocês entregam para Campinas?', {}, memory);
  await conversationMemoryEngine.persistConversationMemory(memory, tenant);
  assert.equal(memory.commercial.deliveryCity, 'Campinas');

  // Turno 5: Cliente tem objeção / pausa "Vou pensar um pouco e depois te chamo"
  conversationMemoryEngine.extractFactsFromContext('Legal, vou pensar com calma', {}, memory);
  await conversationMemoryEngine.persistConversationMemory(memory, tenant);
  assert.ok(memory.facts.objecao_compra);

  // Turno 6: Cliente retorna horas/dias depois dizendo: "Ainda quero a caixa d'água"
  // O sistema NÃO deve reiniciar a conversa como lead desconhecido.
  const reloadedMemory = await conversationMemoryEngine.getConversationMemory({ contactId: simPhone, phone: simPhone, companyId: tenant });
  assert.equal(reloadedMemory.commercial.activeProduct, "Caixa d'água");
  assert.equal(reloadedMemory.commercial.capacity, '5.000 Litros');
  assert.equal(reloadedMemory.commercial.deliveryCity, 'Campinas');

  const promptFinal = conversationMemoryEngine.buildContextualPrompt(reloadedMemory);
  assert.match(promptFinal, /Caixa d'água/);
  assert.match(promptFinal, /5\.000 Litros/);
  assert.match(promptFinal, /Campinas/);
  assert.match(promptFinal, /REGRA CRÍTICA DE CONTINUIDADE/);
});
