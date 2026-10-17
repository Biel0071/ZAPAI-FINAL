const test = require('node:test');
const assert = require('node:assert/strict');

const aiAntiRepetitionService = require('../services/aiAntiRepetitionService');
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

test('Full Context Understanding: extracts all bot messages from history up to limit 15 with sentence splitting', () => {
  const history = [
    { role: 'user', content: 'Boa tarde!' },
    { role: 'assistant', content: 'Olá! Aqui é a Camila da loja. Como posso ajudar com sua obra hoje?' },
    { role: 'user', content: 'Vocês vendem caixa d água de 5 mil litros?' },
    { role: 'assistant', content: 'Temos sim! A caixa de 5.000L em polietileno com tampa de rosca sai por R$ 2.490,00. Qual o seu bairro para calcularmos o frete?' },
    { role: 'user', content: 'Moro no Centro' },
    { role: 'assistant', content: 'Para o Centro temos rota diária com frete rápido. Você prefere pagamento no PIX com desconto ou parcelado no cartão?' },
    { role: 'user', content: 'No pix' },
  ];

  const extracted = aiAntiRepetitionService.extractRecentBotReplies(history, 15);
  assert.equal(extracted.length, 3);
  assert.match(extracted[0].text, /Como posso ajudar/);
  assert.match(extracted[1].text, /polietileno com tampa de rosca/);
  assert.match(extracted[2].text, /rota diária/);
  assert.ok(extracted[1].sentences.length >= 1);
  assert.equal(extracted[2].cta, 'Você prefere pagamento no PIX com desconto ou parcelado no cartão?');
});

test('Anti-Echo: detects text similarity and identical sentence repetition across turns', () => {
  const replyA = 'Temos a caixa d água de 5 mil litros em polietileno com tampa de rosca pronta para entrega.';
  const replyB = 'Temos a de 5 mil litros em polietileno com tampa de rosca pronta para entrega na sua obra.';

  const sim = aiAntiRepetitionService.calculateTextSimilarity(replyA, replyB);
  assert.ok(sim >= 0.70, `Expected similarity >= 0.70, got ${sim}`);

  const recentBotReplies = [
    { text: replyA, sentences: [replyA.toLowerCase()] }
  ];

  const isRep = aiAntiRepetitionService.isSentenceRepeated(
    'Temos a de 5 mil litros em polietileno com tampa de rosca pronta para entrega.',
    recentBotReplies
  );
  assert.equal(isRep, true);
});

test('Circuit Breaker: Unknown Catalog Answer trips circuit breaker and provides graceful handoff', () => {
  const candidate = 'Infelizmente não temos esse produto no nosso catálogo da loja.';
  const evalResult = aiAntiRepetitionService.evaluateCandidateReply({
    candidateReply: candidate,
    recentBotReplies: [{ text: 'Olá! Como posso ajudar?' }],
    customerMessage: 'Vocês vendem piscina de fibra de 20 mil litros?',
  });

  assert.equal(evalResult.valid, false);
  assert.equal(evalResult.circuitBreakerTriggered, true);
  assert.equal(evalResult.circuitBreakerReason, 'unknown_answer');
  assert.equal(evalResult.handoffReply, aiAntiRepetitionService.GRACEFUL_HANDOFF_MESSAGE);
  assert.deepEqual(evalResult.tagsToAdd, ['intervencao_humana', 'precisa_humano', 'delirio_evitado']);
  assert.equal(evalResult.action, 'handoff');
});

test('Circuit Breaker: Repetitive Token Delirium trips circuit breaker immediately', () => {
  const deliriousReply = 'Temos caixa caixa caixa caixa d água em estoque para entrega.';
  const evalResult = aiAntiRepetitionService.evaluateCandidateReply({
    candidateReply: deliriousReply,
    recentBotReplies: [{ text: 'Temos opções de reservatório.' }],
    customerMessage: 'Qual o tamanho?',
  });

  assert.equal(evalResult.valid, false);
  assert.equal(evalResult.circuitBreakerTriggered, true);
  assert.equal(evalResult.circuitBreakerReason, 'repetitive_token_delirium');
  assert.equal(evalResult.handoffReply, aiAntiRepetitionService.GRACEFUL_HANDOFF_MESSAGE);
});

test('Circuit Breaker: Hallucinated policy (e.g. 48x installments or free shipping to all Brazil) trips circuit breaker', () => {
  const hallucinatedReply = 'Parcelamos em até 48x sem juros e entregamos com frete grátis para todo o Brasil!';
  const evalResult = aiAntiRepetitionService.evaluateCandidateReply({
    candidateReply: hallucinatedReply,
    recentBotReplies: [],
    customerMessage: 'Quais as formas de pagamento?',
  });

  assert.equal(evalResult.valid, false);
  assert.equal(evalResult.circuitBreakerTriggered, true);
  assert.equal(evalResult.circuitBreakerReason, 'hallucinated_policy');
  assert.equal(evalResult.handoffReply, aiAntiRepetitionService.GRACEFUL_HANDOFF_MESSAGE);
});

test('Circuit Breaker: Re-asking fact already provided by customer trips circuit breaker', () => {
  const recentBotReplies = [
    {
      text: 'Para o Centro nossa entrega é rápida. Qual a forma de pagamento?',
      cta: 'Qual a forma de pagamento?'
    }
  ];

  // Customer already answered "no pix" and neighborhood is "Centro"
  const candidate = 'Qual a forma de pagamento que você prefere: pix ou cartão?';

  const loopResult = aiAntiRepetitionService.detectRepetitionLoop({
    candidateReply: candidate,
    recentBotReplies,
    customerMessage: 'no pix',
    knownPreferences: {
      neighborhood: 'Centro',
      paymentPreference: 'PIX (à vista com desconto)',
    }
  });

  assert.equal(loopResult.loopDetected, true);
  assert.equal(loopResult.reason, 'repetition_reasking_known_fact');
});

test('Circuit Breaker: Repetitive Echo of previous bot reply trips circuit breaker', () => {
  const previousBotText = 'O milheiro do tijolo 8 furos está saindo por R$ 720,00 com desconto no PIX. Para qual bairro seria a entrega?';
  const recentBotReplies = [
    {
      text: previousBotText,
      cta: 'Para qual bairro seria a entrega?'
    }
  ];

  // AI model generates almost identical echo
  const candidate = 'O milheiro do tijolo 8 furos está saindo por R$ 720,00 com desconto no PIX. Para qual bairro seria a entrega da sua obra?';

  const loopResult = aiAntiRepetitionService.detectRepetitionLoop({
    candidateReply: candidate,
    recentBotReplies,
    customerMessage: 'Qual o valor do milheiro de tijolo?',
    knownPreferences: {},
  });

  assert.equal(loopResult.loopDetected, true);
  assert.equal(loopResult.reason, 'repetition_last_message');
});

test('Circuit Breaker: Handoff message is sent ONCE; subsequent turns stop responding silently', () => {
  const previousBotRepliesWithHandoff = [
    {
      text: aiAntiRepetitionService.GRACEFUL_HANDOFF_MESSAGE,
      cta: '',
    }
  ];

  const evalResult = aiAntiRepetitionService.evaluateCandidateReply({
    candidateReply: 'Infelizmente não tenho essa informação sobre esse produto.',
    recentBotReplies: previousBotRepliesWithHandoff,
    customerMessage: 'E vocês tem areia lavada?',
  });

  assert.equal(evalResult.valid, false);
  assert.equal(evalResult.circuitBreakerTriggered, true);
  assert.equal(evalResult.handoffReply, null, 'Must be null so bot stays silent and does not repeat handoff');
  assert.equal(evalResult.action, 'silent_deactivate');
});

test('Natural Attendant Flow: Valid candidate reply is cleanly sanitized and varied without tripping circuit breaker', () => {
  const recentBotReplies = [
    {
      text: 'Olá! Aqui é a Camila. Temos a caixa de 5.000L em polietileno. Qual o seu bairro para o frete?',
      cta: 'Qual o seu bairro para o frete?'
    }
  ];

  // Mid-conversation: bot starts with greeting, but has real content
  const candidate = 'Olá! Para o Centro temos entrega rápida com caminhão próprio. Você prefere pagamento à vista no PIX com desconto?';

  const evalResult = aiAntiRepetitionService.evaluateCandidateReply({
    candidateReply: candidate,
    recentBotReplies,
    customerMessage: 'Centro',
    knownPreferences: { neighborhood: 'Centro', capacity: '5.000 Litros' },
  });

  assert.equal(evalResult.valid, true);
  assert.equal(evalResult.circuitBreakerTriggered, false);
  assert.doesNotMatch(evalResult.sanitizedReply, /^Olá/i);
  assert.match(evalResult.sanitizedReply, /Para o Centro temos entrega rápida/);
});

test('Circuit Breaker: All-sentence duplicates trigger repetition_exhaustion circuit breaker', () => {
  const recentBotReplies = [
    { text: 'A caixa de 5.000L em polietileno com tampa de rosca está disponível pronta entrega.' },
    { text: 'Para o Centro temos rota diária com frete rápido e seguro.' }
  ];

  // Bot candidate repeats sentences from recent replies
  const candidate = 'A caixa de 5.000L em polietileno com tampa de rosca está disponível pronta entrega. Para o Centro temos rota diária com frete rápido e seguro.';

  const evalResult = aiAntiRepetitionService.evaluateCandidateReply({
    candidateReply: candidate,
    recentBotReplies,
    customerMessage: 'Vocês entregam?',
    knownPreferences: { neighborhood: 'Centro', capacity: '5.000L' },
  });

  assert.equal(evalResult.valid, false);
  assert.equal(evalResult.circuitBreakerTriggered, true);
  assert.equal(evalResult.circuitBreakerReason, 'repetition_exhaustion');
  assert.equal(evalResult.handoffReply, aiAntiRepetitionService.GRACEFUL_HANDOFF_MESSAGE);
});

test('Circuit Breaker: Phrase repetition delirium triggers circuit breaker', () => {
  const deliriousReply = 'Temos o produto sim com certeza com certeza com certeza temos sim.';
  const evalResult = aiAntiRepetitionService.evaluateCandidateReply({
    candidateReply: deliriousReply,
    recentBotReplies: [{ text: 'Olá!' }],
    customerMessage: 'Tem a pronta entrega?',
  });

  assert.equal(evalResult.valid, false);
  assert.equal(evalResult.circuitBreakerTriggered, true);
  assert.equal(evalResult.circuitBreakerReason, 'repetitive_token_delirium');
});

test('Circuit Breaker: Re-asking known fact anywhere in candidate message triggers repetition_reasking_known_fact', () => {
  const recentBotReplies = [
    { text: 'Temos a pronta entrega na loja.' }
  ];

  const candidate = 'Temos a caixa de 5.000L disponível. Qual o seu bairro para calcularmos o frete? O pagamento pode ser no PIX.';

  const loopResult = aiAntiRepetitionService.detectRepetitionLoop({
    candidateReply: candidate,
    recentBotReplies,
    customerMessage: 'Moro no Centro',
    knownPreferences: { neighborhood: 'Centro' },
  });

  assert.equal(loopResult.loopDetected, true);
  assert.equal(loopResult.reason, 'repetition_reasking_known_fact');
});

test('aiReplyGuard: permits circuit breaker handoff even when conversation AI toggle is off', async () => {
  const { getAutomatedReplyPermission } = require('../services/aiReplyGuard');
  const handoffItem = {
    companyId: 'default',
    phone: '5531999990001',
    sessionId: 'main',
    metadata: {
      ai_response: true,
      circuitBreakerHandoff: true,
      conversationId: 'conv-cb-123',
    },
  };

  const permission = await getAutomatedReplyPermission(handoffItem, {
    isAIEnabled: () => true,
    getAutomationScope: async () => ({ mode: 'all', sessionId: null, phones: [] }),
    sessionManager: { getSession: () => null },
    conversationRepository: {
      getConversationById: async () => ({ aiEnabled: false, companyId: 'default', sessionId: 'main' }),
      getConversationByPhone: async () => null,
    },
  });

  assert.deepEqual(permission, { allowed: true, reason: 'ai_enabled' });
});

test('aiReplyGuard: blocks regular AI reply when conversation AI toggle is off', async () => {
  const { getAutomatedReplyPermission } = require('../services/aiReplyGuard');
  const regularAiItem = {
    companyId: 'default',
    phone: '5531999990001',
    sessionId: 'main',
    metadata: {
      ai_response: true,
      conversationId: 'conv-cb-123',
    },
  };

  const permission = await getAutomatedReplyPermission(regularAiItem, {
    isAIEnabled: () => true,
    getAutomationScope: async () => ({ mode: 'all', sessionId: null, phones: [] }),
    sessionManager: { getSession: () => null },
    conversationRepository: {
      getConversationById: async () => ({ aiEnabled: false, companyId: 'default', sessionId: 'main' }),
      getConversationByPhone: async () => null,
    },
  });

  assert.deepEqual(permission, { allowed: false, reason: 'conversation_ai_off' });
});

