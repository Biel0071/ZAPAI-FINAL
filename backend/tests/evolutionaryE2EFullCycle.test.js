/**
 * Evolutionary AI — Complete 8-Scenario E2E Integration Test Suite
 *
 * Validates the strict criteria from Sections 26 & 27 of the project specification:
 * - Scenario 1: New customer asks about product -> Official Knowledge consulted (R$ 990 / R$ 940,50 PIX).
 * - Scenario 2: Customer returns days later -> Customer context recovered without repeating questions.
 * - Scenario 3: Human corrects AI -> System logs the human correction & feedback category.
 * - Scenario 4: Another customer arrives with similar situation -> AI retrieves past experience.
 * - Scenario 5: Multiple conversations present the same pattern -> Learning Engine detects pattern.
 * - Scenario 6: System proposes new playbook -> Human approves in 1-click.
 * - Scenario 7: Playbook used in new conversations -> Experience Engine measures outcome.
 * - Scenario 8: Result compared -> Evolution Engine updates metrics and verifies persistence after restart.
 *
 * Requirements: Real PostgreSQL, Zero Mock Data, Strict Layer Hierarchy.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

const knowledgeEngine = require('../src/ai/evolutionary/knowledgeEngine');
const customerMemoryEngine = require('../src/ai/evolutionary/customerMemoryEngine');
const playbookEngine = require('../src/ai/evolutionary/playbookEngine');
const experienceEngine = require('../src/ai/evolutionary/experienceEngine');
const learningEngine = require('../src/ai/evolutionary/learningEngine');
const evolutionaryOrchestrator = require('../src/ai/evolutionary/orchestrator');

const TEST_COMPANY = 'e2e_full_test_' + Date.now();
const CONV_A = 'e2e_conv_a_' + Date.now();
const CONV_B = 'e2e_conv_b_' + Date.now();
const CONV_C = 'e2e_conv_c_' + Date.now();

describe('Evolutionary AI — Complete 8-Scenario E2E Lifecycle (Zero Mocks, Real PostgreSQL)', () => {

  before(async () => {
    // Setup clean environment for TEST_COMPANY
    await pool.query(
      `INSERT INTO company_official_knowledge
        (company_id, category, key, title, content, raw_text, tags, is_active, created_at, updated_at)
       VALUES
        ($1, 'catalog', 'churrasqueira_trio', 'Churrasqueira Pré-Moldada Trio', '{"price": 990, "pix_price": 940.50, "installments": "10x sem juros"}'::jsonb, 'Churrasqueira Trio Pré-Moldada com forno e fogão a lenha. Preço R$ 990 ou R$ 940,50 no PIX.', ARRAY['churrasqueira', 'trio', 'fogão'], TRUE, NOW(), NOW()),
        ($1, 'rules', 'freight_rules', 'Política Oficial de Frete e Entregas', '{"free_shipping_min": 500, "radius_km": 15}'::jsonb, 'Frete grátis para compras acima de R$ 500 até 15km. Demais localidades sob consulta.', ARRAY['frete', 'entrega'], TRUE, NOW(), NOW())
       ON CONFLICT (company_id, key) DO UPDATE SET is_active = TRUE`,
      [TEST_COMPANY]
    );
  });

  after(async () => {
    // Cleanup test company records
    try {
      await pool.query('DELETE FROM ai_learning_suggestions WHERE company_id = $1', [TEST_COMPANY]);
      await pool.query('DELETE FROM ai_experience_events WHERE company_id = $1', [TEST_COMPANY]);
      await pool.query('DELETE FROM ai_playbooks WHERE company_id = $1', [TEST_COMPANY]);
      await pool.query('DELETE FROM company_official_knowledge WHERE company_id = $1', [TEST_COMPANY]);
      await pool.query('DELETE FROM ai_context WHERE company_id = $1', [TEST_COMPANY]);
      await pool.query('DELETE FROM ai_conversation_memory WHERE company_id = $1', [TEST_COMPANY]);
    } catch (e) {}
  });

  // =========================================================================
  // CENÁRIO 1: Cliente novo pergunta sobre produto -> IA consulta conhecimento oficial
  // =========================================================================
  it('Cenário 1: Cliente novo pergunta sobre produto -> IA consulta e valida conhecimento oficial', async () => {
    const customerQuery = 'Quanto custa a churrasqueira trio e tem desconto no pix?';
    
    // 1. Search official knowledge
    const knowledgeResults = await knowledgeEngine.searchOfficialKnowledge(TEST_COMPANY, 'churrasqueira trio', null, 5);
    assert.ok(knowledgeResults.length > 0, 'Deve retornar ao menos 1 item oficial');
    
    const trio = knowledgeResults.find(k => k.key === 'churrasqueira_trio');
    assert.ok(trio, 'Deve encontrar a chave churrasqueira_trio');
    assert.equal(trio.content.price, 990, 'Preço oficial deve ser R$ 990');
    assert.equal(trio.content.pix_price, 940.50, 'Preço PIX deve ser R$ 940,50');

    // 2. Validate price rule - Anti-hallucination check
    const validDraft = 'A Churrasqueira Trio sai por R$ 990,00 ou R$ 940,50 à vista no PIX.';
    const validCheck = await knowledgeEngine.validateAgainstOfficialRules(TEST_COMPANY, validDraft);
    assert.equal(validCheck.valid, true, 'Resposta com preço oficial exato deve ser aprovada');

    const hallucinatedDraft = 'A Churrasqueira Trio sai por apenas R$ 750,00 hoje!';
    const invalidCheck = await knowledgeEngine.validateAgainstOfficialRules(TEST_COMPANY, hallucinatedDraft);
    assert.equal(invalidCheck.valid, false, 'Preço com divergência > R$ 50 deve ser barrado pela Camada 1');
  });

  // =========================================================================
  // CENÁRIO 2: Cliente retorna dias depois -> IA recupera contexto
  // =========================================================================
  it('Cenário 2: Cliente retorna dias depois -> IA recupera contexto sem perguntar tudo de novo', async () => {
    // 1. Save customer facts from initial interaction
    await customerMemoryEngine.saveCustomerFacts({
      companyId: TEST_COMPANY,
      conversationId: CONV_A,
      phone: '5524998881111',
      facts: {
        customerName: 'Carlos Engenharia',
        neighborhood: 'Centro',
        city: 'Barra do Piraí',
        quotedItems: [{ item: 'Churrasqueira Trio', price: 990 }],
        paymentPreference: 'PIX',
        purchaseStage: 'cotacao'
      }
    });

    // 2. Customer returns later
    const returningContext = await customerMemoryEngine.loadCustomerContext({
      companyId: TEST_COMPANY,
      conversationId: CONV_A,
      phone: '5524998881111'
    });

    assert.ok(returningContext, 'Contexto do cliente deve existir');
    assert.equal(returningContext.name, 'Carlos Engenharia');
    assert.equal(returningContext.neighborhood, 'Centro');
    assert.equal(returningContext.city, 'Barra do Piraí');
    assert.equal(returningContext.paymentPreference, 'PIX');

    // 3. Verify that the compiled prompt informs the AI not to repeat redundant questions
    const compiledPrompt = customerMemoryEngine.compileCustomerMemoryPrompt(returningContext);
    assert.match(compiledPrompt, /Carlos Engenharia/);
    assert.match(compiledPrompt, /Barra do Piraí/);
    assert.match(compiledPrompt, /Churrasqueira Trio/);
    assert.match(compiledPrompt, /NÃO pergunte/);
  });

  // =========================================================================
  // CENÁRIO 3: Humano corrige a IA -> Sistema registra a correção
  // =========================================================================
  it('Cenário 3: Humano corrige a IA -> Sistema registra a correção e intervenção na Camada 4', async () => {
    // 1. AI sends a generic/suboptimal reply
    const eventId = await experienceEngine.recordExperienceEvent({
      conversationId: CONV_A,
      companyId: TEST_COMPANY,
      customerUtterance: 'Vocês entregam churrasqueira em Ipiabas?',
      intentDetected: 'delivery_inquiry',
      strategyApplied: 'direct_answer',
      aiReply: 'Sim, nós entregamos na região.'
    });

    assert.ok(eventId, 'Deve gerar um ID de evento de experiência');

    // 2. Human operator takes over and provides high-converting response
    const humanInterventionText = 'Sim, atendemos Ipiabas! Me passa seu bairro ou ponto de referência que já calculo o frete certinho para você.';
    await experienceEngine.registerHumanIntervention({
      conversationId: CONV_A,
      companyId: TEST_COMPANY,
      humanText: humanInterventionText,
      reason: 'freight_qualification_improvement'
    });

    // 3. Verify in PostgreSQL that human_intervened and correction_text were persisted
    const checkRes = await pool.query(
      `SELECT human_intervened, human_correction_text, feedback_rating, feedback_category
       FROM ai_experience_events WHERE id = $1`,
      [eventId]
    );

    assert.equal(checkRes.rows[0].human_intervened, true, 'Flag human_intervened deve ser TRUE');
    assert.equal(checkRes.rows[0].human_correction_text, humanInterventionText);
    assert.equal(checkRes.rows[0].feedback_rating, 'corrected');
    assert.equal(checkRes.rows[0].feedback_category, 'freight_qualification_improvement');
  });

  // =========================================================================
  // CENÁRIO 4: Outro cliente apresenta situação semelhante -> IA recupera a experiência anterior
  // =========================================================================
  it('Cenário 4: Outro cliente apresenta situação semelhante -> IA recupera a experiência anterior', async () => {
    // 1. Record a positive past experience in the database
    await experienceEngine.recordExperienceEvent({
      conversationId: 'historical_conv_success',
      companyId: TEST_COMPANY,
      customerUtterance: 'Qual o valor da entrega para Barra do Piraí?',
      intentDetected: 'delivery_quote',
      strategyApplied: 'ask_neighborhood_and_quantity',
      aiReply: 'Olá! Entregamos sim em Barra do Piraí. Qual é o seu bairro e qual produto você precisa para calcularmos o frete certinho?',
      metadata: { customer_replied: true }
    });
    
    // Simulate customer reply to make it a successful experience
    await experienceEngine.registerCustomerReaction({
      conversationId: 'historical_conv_success',
      companyId: TEST_COMPANY,
      responseTimeSeconds: 15
    });

    // 2. Customer B asks similar delivery question
    const similarExps = await experienceEngine.findSimilarExperiences({
      companyId: TEST_COMPANY,
      message: 'Entrega em Barra do Piraí?',
      limit: 2
    });

    assert.ok(similarExps.length > 0, 'Deve encontrar ao menos 1 experiência anterior bem-sucedida');
    assert.match(similarExps[0].ai_reply, /Qual é o seu bairro/);

    const expPrompt = experienceEngine.compileExperiencePrompt(similarExps);
    assert.match(expPrompt, /CAMADA 4: EXPERIÊNCIAS ANTERIORES DE SUCESSO/);
  });

  // =========================================================================
  // CENÁRIO 5: Várias conversas apresentam o mesmo padrão -> Learning Engine detecta
  // =========================================================================
  it('Cenário 5: Várias conversas apresentam o mesmo padrão de correção -> Learning Engine detecta padrão', async () => {
    // Simulate multiple recurring human corrections for chimney extension inquiry
    const patternUtterance = 'Vocês têm duto ou extensão para churrasqueira?';
    const patternCorrection = 'Temos sim! Trabalhamos com dutos galvanizados de 50cm e 1m sob medida. Quantos metros precisa subir?';

    for (let i = 1; i <= 3; i++) {
      const conv = `pattern_conv_${i}_${Date.now()}`;
      await experienceEngine.recordExperienceEvent({
        conversationId: conv,
        companyId: TEST_COMPANY,
        customerUtterance: patternUtterance,
        intentDetected: 'chimney_extension_inquiry',
        aiReply: 'Não sei informar sobre extensões.'
      });
      await experienceEngine.registerHumanIntervention({
        conversationId: conv,
        companyId: TEST_COMPANY,
        humanText: patternCorrection,
        reason: 'chimney_extension_upsell'
      });
    }

    // Run pattern mining
    const mineResult = await learningEngine.minePatterns({ companyId: TEST_COMPANY });
    assert.equal(mineResult.ok, true, 'Mineração deve executar com sucesso');

    // Verify that a suggestion was generated in ai_learning_suggestions
    const suggs = await learningEngine.listSuggestions({ companyId: TEST_COMPANY, status: 'pending' });
    assert.ok(suggs.length > 0, 'Deve ter gerado ao menos 1 sugestão pendente');

    const chimneySugg = suggs.find(s => s.situation_summary.includes('extensão'));
    assert.ok(chimneySugg, 'Deve encontrar a sugestão de duto e extensão para churrasqueira');
    assert.ok(chimneySugg.observed_frequency >= 1, 'Frequência observada deve ser >= 1');
  });

  // =========================================================================
  // CENÁRIO 6: Sistema propõe novo playbook -> Humano aprova
  // =========================================================================
  it('Cenário 6: Sistema propõe novo playbook -> Humano aprova em 1 clique', async () => {
    const suggs = await learningEngine.listSuggestions({ companyId: TEST_COMPANY, status: 'pending' });
    const targetSugg = suggs[0];
    assert.ok(targetSugg, 'Deve haver sugestão para aprovação');

    // Human (Manager) approves the suggestion
    const approval = await learningEngine.approveSuggestion({
      suggestionId: targetSugg.id,
      companyId: TEST_COMPANY,
      approvedBy: 'gerente_loja'
    });

    assert.equal(approval.ok, true, 'Aprovação deve ter sucesso');
    assert.ok(approval.playbookId, 'Deve gerar um ID para o novo playbook criado');

    // Verify in database that suggestion is approved and playbook exists with status = approved
    const suggCheck = await pool.query('SELECT status, proposed_playbook_id FROM ai_learning_suggestions WHERE id = $1', [targetSugg.id]);
    assert.equal(suggCheck.rows[0].status, 'approved');
    assert.equal(suggCheck.rows[0].proposed_playbook_id, approval.playbookId);

    const pbCheck = await pool.query('SELECT name, status, approved_by, recommended_cta FROM ai_playbooks WHERE id = $1', [approval.playbookId]);
    assert.equal(pbCheck.rows[0].status, 'approved');
    assert.equal(pbCheck.rows[0].approved_by, 'gerente_loja');
    assert.ok(pbCheck.rows[0].recommended_cta, 'Playbook deve possuir CTA comercial definido');
  });

  // =========================================================================
  // CENÁRIO 7: Playbook passa a ser utilizado -> Experience Engine mede resultado
  // =========================================================================
  it('Cenário 7: Playbook recém-aprovado passa a ser utilizado e medido em nova conversa', async () => {
    // 1. Customer C asks matching question
    const matched = await playbookEngine.matchPlaybook({
      companyId: TEST_COMPANY,
      message: 'Vocês vendem extensão de duto para a churrasqueira?',
      conversationId: CONV_C
    });

    assert.ok(matched, 'Deve corresponder ao playbook recém-aprovado ou ativo');

    // 2. Experience event is recorded using this playbook
    const eventId = await experienceEngine.recordExperienceEvent({
      conversationId: CONV_C,
      companyId: TEST_COMPANY,
      customerUtterance: 'Vocês vendem extensão de duto para a churrasqueira?',
      intentDetected: 'chimney_extension_inquiry',
      strategyApplied: matched.name,
      playbookId: matched.id,
      aiReply: `Temos sim! ${matched.recommended_cta}`
    });

    assert.ok(eventId, 'Deve registrar evento com o novo playbook');

    // 3. Customer replies positively (Customer Reaction recorded)
    await experienceEngine.registerCustomerReaction({
      conversationId: CONV_C,
      companyId: TEST_COMPANY,
      responseTimeSeconds: 22
    });

    const eventCheck = await pool.query(
      'SELECT customer_replied, customer_replied_seconds, playbook_id FROM ai_experience_events WHERE id = $1',
      [eventId]
    );
    assert.equal(eventCheck.rows[0].customer_replied, true, 'Reação do cliente deve ser confirmada');
    assert.equal(eventCheck.rows[0].customer_replied_seconds, 22);
    assert.equal(eventCheck.rows[0].playbook_id, matched.id);
  });

  // =========================================================================
  // CENÁRIO 8: Resultado é comparado -> Evolution Engine atualiza métricas e persiste após restart
  // =========================================================================
  it('Cenário 8: Resultado é comparado -> Métricas consolidadas e integridade persistente após restart', async () => {
    // 1. Get evolution metrics
    const metrics = await learningEngine.getEvolutionMetrics({ companyId: TEST_COMPANY });
    assert.ok(metrics.officialKnowledgeCount >= 2, 'Contagem de conhecimento oficial >= 2');
    assert.ok(metrics.activePlaybooks >= 1, 'Ao menos 1 playbook ativo');
    assert.ok(metrics.totalExperiences >= 3, 'Total de experiências registradas >= 3');
    assert.equal(typeof metrics.responseContinuityRate, 'number', 'Taxa de continuidade calculada');

    // 2. Simulate complete restart: Disconnect and create a fresh database connection pool
    const newPool = new Pool({ connectionString });
    const freshLearningEngine = new learningEngine.constructor(newPool);

    const freshMetrics = await freshLearningEngine.getEvolutionMetrics({ companyId: TEST_COMPANY });
    assert.equal(freshMetrics.officialKnowledgeCount, metrics.officialKnowledgeCount, 'Conhecimento deve persistir intacto');
    assert.equal(freshMetrics.activePlaybooks, metrics.activePlaybooks, 'Playbooks devem persistir intactos');
    assert.equal(freshMetrics.totalExperiences, metrics.totalExperiences, 'Experiências devem persistir intactas');

    await newPool.end();
  });

  // =========================================================================
  // VALIDAÇÕES ADICIONAIS: Hierarquia Estrita e Anti-Alucinação
  // =========================================================================
  it('Validação de Hierarquia: OFFICIAL_KNOWLEDGE > PLAYBOOK > EXPERIENCE', async () => {
    const compiled = await evolutionaryOrchestrator.buildEvolutionaryPrompt({
      companyId: TEST_COMPANY,
      conversationId: CONV_A,
      message: 'Qual o valor da churrasqueira trio?',
      contact: { phone: '5524998881111' }
    });

    const l1Idx = compiled.prompt.indexOf('CAMADA 1: VERDADE OFICIAL DA LOJA');
    const l2Idx = compiled.prompt.indexOf('CAMADA 2: MEMÓRIA DO CLIENTE');
    const l3Idx = compiled.prompt.indexOf('CAMADA 3:');

    assert.ok(l1Idx !== -1, 'Camada 1 deve estar presente no prompt');
    assert.ok(l2Idx !== -1, 'Camada 2 deve estar presente no prompt');
    assert.ok(l3Idx !== -1, 'Camada 3 deve estar presente no prompt');

    // Order: Layer 1 before Layer 2 before Layer 3
    assert.ok(l1Idx < l2Idx, 'Camada 1 (Verdade Oficial) deve ter precedência sobre Camada 2');
    assert.ok(l2Idx < l3Idx, 'Camada 2 (Cliente) deve ter precedência sobre Camada 3 (Playbook)');
  });
});
