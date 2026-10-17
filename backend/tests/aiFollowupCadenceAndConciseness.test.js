const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLeadAlgorithm,
  getProgressiveFollowupHook,
  detectPurchaseStatus,
} = require('../services/leadAnalyzer');
const {
  generateFollowupPlan,
  executeAlgorithmicFollowupForLead,
  deactivateFollowupForConversation,
  resetFollowupOnCustomerResponse,
} = require('../services/aiFollowupEngine');
const {
  enforceResponseWordLimit,
  resolveResponseWordLimit,
  compileSystemPrompt,
} = require('../services/ai.service');

test('AI Follow-up: Progressive Cadence and Multi-Touch Plan', async () => {
  const planResult = await generateFollowupPlan({
    conversationId: 'test-conv-cadence',
    phone: '5511999990001',
  });

  assert.equal(planResult.success, true);
  const { steps, totalSteps } = planResult.data;
  assert.equal(totalSteps, 3);
  assert.equal(steps.length, 3);

  // Attempt 1: 4 to 6 hours (delayMinutes = 240)
  assert.equal(steps[0].delayMinutes, 240);
  assert.match(steps[0].timingLabel, /1º Toque \(4h sem retorno/i);
  assert.match(steps[0].message, /dúvida|orçamento|medidas/i);

  // Attempt 2: 24 hours (delayMinutes = 1440)
  assert.equal(steps[1].delayMinutes, 1440);
  assert.match(steps[1].timingLabel, /2º Toque \(24h/i);
  assert.match(steps[1].message, /frete|condições|pix|cartão/i);

  // Attempt 3: 48 hours (delayMinutes = 2880)
  assert.equal(steps[2].delayMinutes, 2880);
  assert.match(steps[2].timingLabel, /3º Toque \(48h/i);
  assert.match(steps[2].message, /em aberto|obra|chamar|concluindo|contato|mensagem/i);
});

test('AI Follow-up: Progressive Angles across Attempts 1, 2, and 3', () => {
  const algo = buildLeadAlgorithm('quanto fica a churrasqueira trio?', [], {
    name: 'Roberto Carlos',
    lead_name: 'Roberto Carlos',
  });

  assert.ok(algo.getProgressiveHook);

  // Attempt 1: Helpful check-in on the specific product/quote discussed
  const touch1 = algo.getProgressiveHook(1);
  assert.match(touch1, /Roberto/i);
  assert.match(touch1, /Churrasqueira/i);
  assert.match(touch1, /dúvida|orçamento|cotação/i);

  // Attempt 2: Value proposition / freight condition / payment options check
  const touch2 = algo.getProgressiveHook(2);
  assert.match(touch2, /Roberto/i);
  assert.match(touch2, /frete|condiç|pix|cartão/i);

  // Attempt 3: Soft closing ("Estou deixando seu atendimento em aberto...")
  const touch3 = algo.getProgressiveHook(3);
  assert.match(touch3, /Roberto/i);
  assert.match(touch3, /em aberto|incomodando|à disposição|concluindo|inconveniente/i);
});

test('AI Follow-up: Purchase & Terminal Stages Stop Follow-up Immediately', () => {
  // aguardando_pix terminal state
  const resPix = detectPurchaseStatus('pode mandar o pix', [], {
    funnel_stage: 'aguardando_pix',
  });
  assert.equal(resPix.hasPurchased, true);

  // finalizado terminal state
  const resFinal = detectPurchaseStatus('tudo certo', [], {
    funnel_stage: 'finalizado',
  });
  assert.equal(resFinal.hasPurchased, true);

  // tags: followup_esgotado or followup_desativado
  const resEsgotado = detectPurchaseStatus('olá', [], {
    tags: ['followup_esgotado', 'lead_antigo'],
  });
  assert.equal(resEsgotado.hasPurchased, true);

  const resDesativado = detectPurchaseStatus('olá', [], {
    tags: ['followup_desativado'],
  });
  assert.equal(resDesativado.hasPurchased, true);
});

test('Attendant Response Brevity: enforceResponseWordLimit enforces concise WhatsApp length', () => {
  const agent = { responseStyle: 'short_natural' };
  const wordLimit = resolveResponseWordLimit(agent);
  assert.ok(wordLimit <= 50, `Default short_natural limit should be <= 50, got ${wordLimit}`);

  // Test 1: Single sentence stays intact
  const shortMsg = 'Oi Roberto! O milheiro de tijolos está saindo por R$ 720 no PIX. Para qual bairro seria a entrega?';
  const out1 = enforceResponseWordLimit(shortMsg, agent);
  assert.equal(out1, shortMsg);

  // Test 2: Multi-paragraph giant essay is trimmed to max 3 sentences within word limit
  const wordyEssay = `
    Olá prezado cliente! É um imenso prazer atendê-lo em nossa renomada loja de materiais de construção Depósito Mais.
    Temos uma variedade inigualável de itens para a sua reforma e construção residencial ou comercial.
    Trabalhamos com tijolos baianos de altíssima qualidade e procedência garantida de primeira linha.
    Além disso, oferecemos telhas ecológicas, cimento CP II, areia lavada e brita ensacada com preços imperdíveis.
    Podemos parcelar suas compras em até 10 vezes sem juros nos cartões de crédito aceitos.
    Caso prefira pagar à vista via transferência bancária ou PIX, disponibilizamos um desconto exclusivo de 5%.
    Nossos caminhões realizam entregas diárias em todas as regiões e bairros vizinhos com pontualidade britânica.
    Por favor, informe-nos o seu endereço completo com CEP para que possamos calcular o frete com precisão.
  `;
  const out2 = enforceResponseWordLimit(wordyEssay, agent);
  const wordsOut2 = out2.split(/\s+/).filter(Boolean);
  assert.ok(wordsOut2.length <= 55, `Output should have <= 55 words, got ${wordsOut2.length}`);

  // Test 3: Unsolicited bullet points are condensed
  const bulletedMsg = `
    Temos as seguintes opções disponíveis:
    - Modelo A com 500 litros por R$ 400
    - Modelo B com 1000 litros por R$ 700
    - Modelo C com 5000 litros por R$ 2500
    Qual você prefere?
  `;
  const out3 = enforceResponseWordLimit(bulletedMsg, agent);
  assert.ok(!out3.includes('- Modelo A'), 'Bullet list format should be sanitized for WhatsApp');
});

test('System Prompt Grounding: Contains strict anti-delirium & WhatsApp brevity constraints', () => {
  const prompt = compileSystemPrompt(
    { name: 'Camila', responseStyle: 'short_natural' },
    { name: 'Depósito Mais' },
    { name: 'João Silva', phone: '5511988887777' }
  );

  // Strict WhatsApp Brevity
  assert.match(prompt, /MENSAGENS COMPACTAS OBRIGATÓRIAS/i);
  assert.match(prompt, /1 a 3 frases curtas/i);
  assert.match(prompt, /35 a 50 palavras/i);

  // Anti-Delirium and Store Facts Grounding
  assert.match(prompt, /PROTOCOLO ESTRITO ANTI-DELÍRIO E ANTI-ALUCINAÇÃO/i);
  assert.match(prompt, /NUNCA INVENTE PREÇOS/i);
  assert.match(prompt, /NUNCA PROMETA DESCONTOS OU PARCELAMENTOS NÃO AUTORIZADOS/i);
  assert.match(prompt, /ZERO CENÁRIOS FICTÍCIOS OU DELÍRIOS/i);
  assert.match(prompt, /Depósito Mais/i);
});

test('AI Follow-up: Deactivation & Customer Response Reset Logic', async () => {
  const { query } = require('../src/infrastructure/config/database');

  // Insert a mock conversation for testing
  const insertRes = await query(
    `INSERT INTO conversations (remote_jid, status, ai_enabled, tags)
     VALUES ('5511999998877@s.whatsapp.net', 'open', true, ARRAY['followup_ia_ativo', 'lead_novo'])
     RETURNING id`
  );
  const testId = insertRes.rows[0].id;

  try {
    // 1. Test deactivation after exhaustion
    const deactRes = await deactivateFollowupForConversation(testId, 'test_exhausted');
    assert.equal(deactRes.ok, true);
    assert.equal(deactRes.deactivated, true);
    assert.ok(deactRes.tags.includes('followup_esgotado'));
    assert.ok(deactRes.tags.includes('followup_desativado'));
    assert.ok(!deactRes.tags.includes('followup_ia_ativo'));

    // 2. Test reset when customer sends a message
    const resetRes = await resetFollowupOnCustomerResponse(testId);
    assert.equal(resetRes.ok, true);
    assert.equal(resetRes.reset, true);
    assert.ok(!resetRes.tags.includes('followup_esgotado'));
    assert.ok(!resetRes.tags.includes('followup_desativado'));
  } finally {
    // Clean up mock row
    await query(`DELETE FROM conversations WHERE id = $1`, [testId]).catch(() => {});
  }
});

test('AI Follow-up: executeAlgorithmicFollowupForLead auto-deactivates when 3 attempts exceeded', async () => {
  const { query } = require('../src/infrastructure/config/database');

  // Insert mock conversation
  const insertConv = await query(
    `INSERT INTO conversations (remote_jid, status, ai_enabled, tags)
     VALUES ('5511999991122@s.whatsapp.net', 'open', true, ARRAY['followup_ia_ativo'])
     RETURNING id`
  );
  const convId = insertConv.rows[0].id;

  try {
    // Insert 3 consecutive agent messages
    for (let i = 1; i <= 3; i++) {
      await query(
        `INSERT INTO messages (conversation_id, sender, content, timestamp)
         VALUES ($1, 'agent', $2, NOW() - INTERVAL '${4 - i} days')`,
        [convId, `Followup toque ${i}`]
      );
    }

    // Call executeAlgorithmicFollowupForLead: should detect 3 consecutive agent messages and auto-deactivate
    const res = await executeAlgorithmicFollowupForLead({
      conversationId: convId,
      companyId: 'default',
    });

    assert.equal(res.ok, false);
    assert.equal(res.skipped, true);
    assert.equal(res.reason, 'max_attempts_exceeded');
    assert.equal(res.deactivated, true);

    // Verify database tags updated
    const updatedConv = await query(`SELECT tags FROM conversations WHERE id = $1`, [convId]);
    const tags = updatedConv.rows[0].tags;
    assert.ok(tags.includes('followup_esgotado'));
    assert.ok(tags.includes('followup_desativado'));
    assert.ok(!tags.includes('followup_ia_ativo'));
  } finally {
    await query(`DELETE FROM messages WHERE conversation_id = $1`, [convId]).catch(() => {});
    await query(`DELETE FROM conversations WHERE id = $1`, [convId]).catch(() => {});
  }
});

test.after(async () => {
  const { pool } = require('../src/infrastructure/config/database');
  await pool.end().catch(() => {});
});

