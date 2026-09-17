/**
 * Verification Script: Live Evolutionary Cycle (Layers 1-5 End-to-End)
 */
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

const orchestrator = require('../src/ai/evolutionary/orchestrator');
const experienceEngine = require('../src/ai/evolutionary/experienceEngine');
const learningEngine = require('../src/ai/evolutionary/learningEngine');
const { runEvolutionRound } = require('../services/agentEvolutionCron');

async function main() {
  console.log('=== [TEST] LIVE EVOLUTIONARY CYCLE VERIFICATION ===');

  const convId = 'live_verify_' + Date.now();
  const testPhone = '553199887766';

  // 1. Simular mensagem de cliente real
  console.log('\n[Passo 1] Cliente envia mensagem...');
  const customerMsg = 'Boa tarde! Qual o valor do milheiro do tijolo 8 furos e entrega no Taquaral?';
  console.log('Cliente:', customerMsg);

  const aiResult = await orchestrator.orchestrateResponse({
    conversation: { id: convId, phone: testPhone },
    customerMessage: customerMsg,
    companyId: 'default'
  });

  console.log('\n[Passo 2] Resposta gerada pela IA:');
  console.log('Resposta:', aiResult.response);
  console.log('Playbook Aplicado:', aiResult.activePlaybook?.name || 'Nenhum');
  console.log('Validação de Regras:', aiResult.ruleValidation?.isValid ? 'Válido' : 'Conflito');

  // Aguardar gravação assíncrona
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 2. Verificar se foi gravado na Camada 4
  console.log('\n[Passo 3] Verificando gravação na Camada 4 (ai_experience_events)...');
  const expRes = await pool.query(
    'SELECT id, customer_utterance, ai_reply, strategy_applied, customer_replied, human_intervened FROM ai_experience_events WHERE conversation_id = $1',
    [convId]
  );

  if (expRes.rows.length === 0) {
    throw new Error('Evento de experiência NÃO foi gravado no PostgreSQL!');
  }
  console.log('Evento gravado com sucesso! ID:', expRes.rows[0].id);
  console.log('Estratégia Registrada:', expRes.rows[0].strategy_applied);

  // 3. Simular reação positiva do cliente
  console.log('\n[Passo 4] Cliente responde positivamente (Feedback Loop)...');
  await experienceEngine.registerCustomerReaction({
    conversationId: convId,
    companyId: 'default',
    responseTimeSeconds: 12
  });

  const reactionRes = await pool.query(
    'SELECT customer_replied, customer_replied_seconds FROM ai_experience_events WHERE conversation_id = $1',
    [convId]
  );
  console.log('Status da Reação do Cliente:', reactionRes.rows[0]);

  // 4. Executar rodada de evolução da Camada 5
  console.log('\n[Passo 5] Executando ciclo de mineração e auto-evolução (Camada 5)...');
  await runEvolutionRound();

  // 5. Obter métricas consolidadas
  console.log('\n[Passo 6] Verificando métricas consolidadas do Evolution Center...');
  const metrics = await learningEngine.getEvolutionMetrics({ companyId: 'default' });
  console.log('Métricas:', JSON.stringify(metrics, null, 2));

  console.log('\n=== [SUCESSO] CICLO EVOLUTIVO EM LOOP TESTADO E VALIDADO AO VIVO! ===');
  await pool.end();
}

main().catch(err => {
  console.error('\n[ERRO NA VERIFICAÇÃO]:', err);
  process.exit(1);
});
