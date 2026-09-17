const cron = require('node-cron');
const { query } = require('../src/infrastructure/config/database');
const agentEvolutionService = require('./agentEvolutionService');

const aiAgentService = require('../src/ai/agents/services/aiAgentService');

/**
 * Inicia o worker que verifica periodicamente falhas de respostas da IA (Unanswered Questions).
 * A rotina passa pelas empresas ativas e aciona a varredura para cada atendente.
 */
function startEvolutionScan() {
  console.log('[AI EVOLUTION] Cronjob de Evolução Real inicializado (Roda a cada 2 horas)');
  
  // Roda a cada 2 horas no minuto 0 (0 */2 * * *)
  return cron.schedule(
    '0 */2 * * *',
    async () => {
      try {
        console.log('[AI EVOLUTION] Iniciando varredura em background...');
        
        // Pega todos os tenants / empresas ativas das conversas
        const companiesRes = await query(`
          SELECT DISTINCT company_id 
          FROM conversations 
          WHERE company_id IS NOT NULL
        `).catch(() => ({ rows: [{ company_id: 'default' }] }));
        
        let companies = (companiesRes.rows || []).map(r => r.company_id).filter(Boolean);
        if (companies.length === 0) companies = ['default'];

        let totalGaps = 0;

        for (const companyId of companies) {
          // Lista os agentes ativos via aiAgentService
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
        
        if (totalGaps > 0) {
          console.log(`[AI EVOLUTION] Varredura concluída. ${totalGaps} novas dúvidas pendentes de treinamento.`);
        } else {
          console.log('[AI EVOLUTION] Varredura concluída. Nenhum novo gap detectado.');
        }

      } catch (error) {
        console.error('[AI EVOLUTION] Falha geral no cronjob de evolução:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: 'America/Sao_Paulo',
    }
  );
}

module.exports = {
  startEvolutionScan,
};
