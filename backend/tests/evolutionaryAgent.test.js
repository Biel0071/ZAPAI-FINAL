/**
 * Evolutionary Agent Comprehensive Integration Tests
 *
 * Tests all 5 layers against real PostgreSQL database (zero mocks):
 * 1. Layer 1: Official Knowledge retrieval & price consistency
 * 2. Layer 2: Customer structured memory & fact extraction
 * 3. Layer 3: Playbook selection & step checklists
 * 4. Layer 4: Experience event tracking, customer reaction & human takeover
 * 5. Layer 5: Pattern mining, suggestions & approval workflow
 * 6. Orchestrator: Unified 5-layer prompt synthesis
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

const knowledgeEngine = require('../src/ai/evolutionary/knowledgeEngine');
const customerMemoryEngine = require('../src/ai/evolutionary/customerMemoryEngine');
const playbookEngine = require('../src/ai/evolutionary/playbookEngine');
const experienceEngine = require('../src/ai/evolutionary/experienceEngine');
const learningEngine = require('../src/ai/evolutionary/learningEngine');
const orchestrator = require('../src/ai/evolutionary/orchestrator');

describe('Evolutionary AI — 5-Layer System Tests (Real PostgreSQL)', () => {

  const testPhone = '5511999887766';
  const testConvId = 'test_conv_evo_' + Date.now();

  before(async () => {
    // Ensure test knowledge item exists
    await pool.query(`
      INSERT INTO company_official_knowledge 
        (company_id, category, key, title, content, raw_text, tags, is_active)
      VALUES 
        ('test_tenant', 'products', 'test_prod_trio', 'Churrasqueira Trio Pré-Moldada Teste', '{"name":"Churrasqueira Trio","price":990.00,"pix_discount_price":940.50}'::jsonb, 'Preço oficial R$ 990,00 ou R$ 940,50 no PIX.', ARRAY['churrasqueira', 'trio', 'preco'], TRUE)
      ON CONFLICT (company_id, key) DO UPDATE SET is_active = TRUE;
    `);

    // Ensure test playbook exists
    await pool.query(`
      INSERT INTO ai_playbooks
        (company_id, name, slug, trigger_condition, goal, steps, recommended_cta, confidence, status)
      VALUES
        ('test_tenant', 'Playbook Teste Frete', 'pb_teste_frete', 'frete', 'Qualificar bairro', '["Pedir bairro", "Calcular rota"]'::jsonb, 'Qual o seu bairro?', 0.95, 'approved')
      ON CONFLICT (company_id, slug) DO UPDATE SET status = 'approved';
    `);
  });

  after(async () => {
    // Clean up test data
    await pool.query(`DELETE FROM ai_experience_events WHERE company_id = 'test_tenant'`);
    await pool.query(`DELETE FROM ai_learning_suggestions WHERE company_id = 'test_tenant'`);
    await pool.query(`DELETE FROM ai_playbooks WHERE company_id = 'test_tenant'`);
    await pool.query(`DELETE FROM company_official_knowledge WHERE company_id = 'test_tenant'`);
    await pool.end();
  });

  // ─── LAYER 1: OFFICIAL KNOWLEDGE ───
  it('Layer 1: should search and retrieve official knowledge from PostgreSQL', async () => {
    const results = await knowledgeEngine.searchOfficialKnowledge('test_tenant', 'churrasqueira trio', 'products');
    assert.ok(results.length > 0, 'Should find at least 1 official knowledge item');
    assert.strictEqual(results[0].key, 'test_prod_trio');
    assert.strictEqual(results[0].content.price, 990.00);
  });

  it('Layer 1: should validate prices and detect hallucinations', async () => {
    // Text matches official price
    const goodVal = await knowledgeEngine.validateAgainstOfficialRules('test_tenant', 'A Churrasqueira Trio sai por R$ 990,00.');
    assert.strictEqual(goodVal.isValid, true, 'Correct price should be valid');

    // Text has invented price
    const badVal = await knowledgeEngine.validateAgainstOfficialRules('test_tenant', 'A Churrasqueira Trio sai por R$ 400,00 apenas hoje!');
    assert.strictEqual(badVal.isValid, false, 'Hallucinated price should be invalid');
    assert.ok(badVal.issues.length > 0, 'Should return at least 1 issue');
  });

  // ─── LAYER 2: CUSTOMER STRUCTURED MEMORY ───
  it('Layer 2: should extract customer facts and persist to PostgreSQL', async () => {
    await customerMemoryEngine.extractAndSaveFacts({
      companyId: 'test_tenant',
      phone: testPhone,
      conversationId: testConvId,
      messageText: 'Oi, eu moro no bairro Taquaral e queria saber sobre a churrasqueira trio no pix'
    });

    const ctx = await customerMemoryEngine.loadCustomerContext({
      companyId: 'test_tenant',
      phone: testPhone,
      conversationId: testConvId
    });

    assert.ok(ctx, 'Customer context should load');
    assert.strictEqual(ctx.phone, testPhone);
    assert.strictEqual(ctx.paymentPreference, 'PIX');
  });

  // ─── LAYER 3: PLAYBOOKS ───
  it('Layer 3: should match active playbook based on trigger keywords', async () => {
    const matched = await playbookEngine.matchPlaybook({
      companyId: 'test_tenant',
      message: 'quanto custa o frete para entregar aqui?',
      intent: 'freight_inquiry'
    });

    assert.ok(matched, 'Should match a playbook for freight');
    assert.strictEqual(matched.slug, 'pb_teste_frete');
    assert.strictEqual(matched.recommended_cta, 'Qual o seu bairro?');

    const prompt = playbookEngine.compilePlaybookPrompt(matched);
    assert.ok(prompt.includes('Playbook Teste Frete'), 'Compiled prompt should contain playbook name');
    assert.ok(prompt.includes('Qual o seu bairro?'), 'Compiled prompt should contain CTA');
  });

  // ─── LAYER 4: EXPERIENCE ENGINE ───
  it('Layer 4: should record experience event and track customer reaction', async () => {
    const eventId = await experienceEngine.recordExperienceEvent({
      conversationId: testConvId,
      companyId: 'test_tenant',
      customerUtterance: 'Qual o valor do frete?',
      intentDetected: 'freight_inquiry',
      strategyApplied: 'pb_teste_frete',
      aiReply: 'Olá! Nosso frete é grátis acima de R$ 500. Qual o seu bairro?'
    });

    assert.ok(eventId, 'Event ID should be returned');

    // Customer replies back
    await experienceEngine.registerCustomerReaction({
      conversationId: testConvId,
      companyId: 'test_tenant',
      responseTimeSeconds: 15
    });

    // Check PostgreSQL
    const res = await pool.query(
      `SELECT customer_replied, customer_replied_seconds FROM ai_experience_events WHERE id = $1`,
      [eventId]
    );
    assert.strictEqual(res.rows[0].customer_replied, true);
    assert.strictEqual(res.rows[0].customer_replied_seconds, 15);
  });

  it('Layer 4: should record human intervention and operator takeover', async () => {
    await experienceEngine.registerHumanIntervention({
      conversationId: testConvId,
      companyId: 'test_tenant',
      humanText: 'Olá! O frete para o Taquaral sai R$ 45,00.',
      reason: 'manual_phone_takeover'
    });

    const res = await pool.query(
      `SELECT human_intervened, human_correction_text, feedback_rating FROM ai_experience_events WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1`,
      [testConvId]
    );
    assert.strictEqual(res.rows[0].human_intervened, true);
    assert.strictEqual(res.rows[0].feedback_rating, 'corrected');
    assert.ok(res.rows[0].human_correction_text.includes('Taquaral'));
  });

  // ─── LAYER 5: LEARNING ENGINE ───
  it('Layer 5: should mine patterns and allow 1-click approval of new playbook', async () => {
    // 1. Mine patterns
    await learningEngine.minePatterns({ companyId: 'test_tenant' });

    // 2. Query suggestions
    const suggestions = await learningEngine.listSuggestions({ companyId: 'test_tenant' });
    assert.ok(suggestions.length > 0, 'Should have mined at least 1 suggestion from human correction');

    const suggId = suggestions[0].id;

    // 3. Approve suggestion -> converts to playbook
    const approval = await learningEngine.approveSuggestion({
      suggestionId: suggId,
      companyId: 'test_tenant',
      approvedBy: 'supervisor_test'
    });

    assert.strictEqual(approval.ok, true);
    assert.ok(approval.playbookId, 'Playbook ID must be returned');

    // Verify playbook exists in PostgreSQL
    const pbRes = await pool.query(`SELECT status FROM ai_playbooks WHERE id = $1`, [approval.playbookId]);
    assert.strictEqual(pbRes.rows[0].status, 'approved');
  });

  // ─── ORCHESTRATOR ───
  it('Orchestrator: should compile unified 5-layer prompt adhering to strict hierarchy', async () => {
    const evoData = await orchestrator.buildEvolutionaryPrompt({
      companyId: 'test_tenant',
      contact: { phone: testPhone, conversationId: testConvId },
      message: 'Quanto custa a churrasqueira trio e o frete?',
      conversationId: testConvId,
    });

    assert.ok(evoData.prompt.includes('CAMADA 1: VERDADE OFICIAL DA LOJA'), 'Must contain Layer 1');
    assert.ok(evoData.prompt.includes('CAMADA 2: MEMÓRIA DO CLIENTE'), 'Must contain Layer 2');
    assert.ok(evoData.prompt.includes('CAMADA 3: PLAYBOOK OPERACIONAL'), 'Must contain Layer 3');
    assert.ok(evoData.prompt.includes('HIERARQUIA DE AUTORIDADE'), 'Must enforce strict hierarchy');
  });
});
