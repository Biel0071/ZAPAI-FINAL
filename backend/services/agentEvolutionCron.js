const cron = require('node-cron');
const { query } = require('../src/infrastructure/config/database');
const agentEvolutionService = require('./agentEvolutionService');
const aiAgentService = require('../src/ai/agents/services/aiAgentService');
const learningEngine = require('../src/ai/evolutionary/learningEngine');

/**
 * Executa uma rodada completa de aprendizado e mineração evolutiva em background
 */
async function runEvolutionRound() {
  try {
    console.log('[AI EVOLUTION] Iniciando ciclo de aprendizado contínuo e mineração da Camada 5...');

    // Pega todos os tenants / empresas ativas das conversas
    const companiesRes = await query(`
      SELECT DISTINCT company_id 
      FROM conversations 
      WHERE company_id IS NOT NULL
    `).catch(() => ({ rows: [{ company_id: 'default' }] }));

    let companies = (companiesRes.rows || []).map(r => r.company_id).filter(Boolean);
    if (companies.length === 0) companies = ['default'];

    let totalGaps = 0;
    let totalMined = 0;

    for (const companyId of companies) {
      // 1. Mineração contínua de padrões e correções humanas (Camada 5)
      try {
        const mineRes = await learningEngine.minePatterns({ companyId });
        if (mineRes.ok && mineRes.processed > 0) {
          totalMined += mineRes.processed;
          console.log(`[AI EVOLUTION] +${mineRes.processed} padrões/correções minerados para tenant ${companyId}`);
        }
      } catch (mineErr) {
        console.warn(`[AI EVOLUTION] Falha na mineração para ${companyId}:`, mineErr.message);
      }

      // 2. Lista os agentes ativos para varredura de gaps e dúvidas sem resposta
      let agents = [];
      try {
        agents = await aiAgentService.listAgents(companyId);
      } catch (agentListErr) {
        agents = [];
      }

      const activeAgents = (agents || []).filter(a => a && a.active !== false);

      for (const agent of activeAgents) {
        try {
          const count = await agentEvolutionService.detectUnansweredQuestions(agent.key, companyId);
          if (count > 0) {
            totalGaps += count;
            console.log(`[AI EVOLUTION] +${count} gaps encontrados para o agente ${agent.key} (Tenant: ${companyId})`);
          }
        } catch (agentErr) {
          console.warn(`[AI EVOLUTION] Erro na varredura do agente ${agent.key}:`, agentErr.message);
        }
      }
    }

    console.log(`[AI EVOLUTION] Ciclo concluído. Padrões minerados: ${totalMined} | Dúvidas sem resposta: ${totalGaps}`);
  } catch (error) {
    console.error('[AI EVOLUTION] Falha geral no ciclo de evolução:', error.message);
  }
}

/**
 * Inicia o worker de evolução contínua da IA (roda a cada 15 minutos e logo após o startup)
 */
function startEvolutionScan() {
  console.log('[AI EVOLUTION] Agente de Aprendizado Contínuo inicializado (Varredura ativa a cada 15 minutos)');

  // Disparo inicial 15 segundos após startup para aquecer o cérebro
  setTimeout(() => {
    runEvolutionRound().catch(e => console.error('[AI EVOLUTION] Erro no aquecimento inicial:', e.message));
  }, 15000);

  // Roda a cada 15 minutos
  return cron.schedule(
    '*/15 * * * *',
    async () => {
      await runEvolutionRound();
    },
    {
      scheduled: true,
      timezone: 'America/Sao_Paulo',
    }
  );
}

module.exports = {
  startEvolutionScan,
  runEvolutionRound,
};
