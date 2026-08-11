const cron = require('node-cron');
const { query } = require('../src/infrastructure/config/database');
const { getAgentsSync } = require('../src/ai/agents/services/aiAgentService');
const { sendMessage } = require('./whatsapp/outbound/senders');

// Store active cron tasks
let activeCron = null;

function startCron() {
  if (activeCron) {
    activeCron.stop();
  }

  // Run every 15 minutes
  activeCron = cron.schedule('*/15 * * * *', async () => {
    try {
      console.log('[FollowUpCron] Iniciando varredura de inativos...');
      
      const { rows: conversations } = await query(`
        SELECT c.id, c.remote_jid as phone, c.agent_name, c.company_id, c.updated_at, c.remote_jid, c.session_id
        FROM conversations c
        WHERE c.status = 'open' 
          AND c.updated_at < NOW() - INTERVAL '1 hour'
          AND c.updated_at > NOW() - INTERVAL '7 days'
      `);

      if (!conversations.length) return;

      for (const conv of conversations) {
        const agents = getAgentsSync(conv.company_id);
        const agent = agents.find(a => 
          a.key.toLowerCase() === (conv.agent_name || '').toLowerCase() || 
          a.name.toLowerCase() === (conv.agent_name || '').toLowerCase()
        );

        if (!agent || !agent.followUp?.active) continue;

        const intervalHours = agent.followUp.intervalHours || 8;
        const hoursSinceUpdate = (new Date() - new Date(conv.updated_at)) / (1000 * 60 * 60);

        if (hoursSinceUpdate >= intervalHours) {
          if (agent.followUp.respectBusinessHours) {
            const currentHour = new Date().getHours();
            if (currentHour < 8 || currentHour >= 18) continue;
          }

          console.log(`[FollowUpCron] Disparando follow-up para JID: ${conv.remote_jid}`);

          const aiResponse = agent.followUp.prompt || "Olá! Gostaria de saber se ainda tem alguma dúvida. Posso ajudar em mais alguma coisa?";

          if (global.whatsappSockets && global.whatsappSockets[conv.session_id]) {
            const sock = global.whatsappSockets[conv.session_id];
            await sendMessage(sock, conv.remote_jid, aiResponse);
            await query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conv.id]);
          }
        }
      }
    } catch (error) {
      console.error('[FollowUpCron] Erro na varredura:', error);
    }
  });

  console.log('[FollowUpCron] Cron job ativado (a cada 15 min).');
}

module.exports = { startCron };
