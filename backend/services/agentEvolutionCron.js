const cron = require('node-cron');
const { query } = require('../src/infrastructure/config/database');
const agentEvolutionService = require('./agentEvolutionService');

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
        
        // Pega todos os tenants / empresas ativas
        const companiesRes = await query(`
          SELECT DISTINCT company_id 
          FROM ai_agents 
          WHERE status = 'active' OR active = true
        `).catch(() => ({ rows: [{ company_id: 'default' }] }));
        
        let companies = companiesRes.rows.map(r => r.company_id);
        if (companies.length === 0) companies = ['default'];

        let totalGaps = 0;

        for (const companyId of companies) {
          // Lista os agentes ativos
          const agentsRes = await query(`
            SELECT key 
            FROM ai_agents 
            WHERE company_id = $1 AND (status = 'active' OR active = true)
          `, [companyId]).catch(() => ({ rows: [] }));

          for (const agentRow of agentsRes.rows) {
            try {
              const count = await agentEvolutionService.detectUnansweredQuestions(agentRow.key, companyId);
              if (count > 0) {
                totalGaps += count;
                console.log(`[AI EVOLUTION] +${count} gaps encontrados para o agente ${agentRow.key} (Tenant: ${companyId})`);
              }
            } catch (agentErr) {
              console.warn(`[AI EVOLUTION] Erro na varredura do agente ${agentRow.key}:`, agentErr.message);
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
