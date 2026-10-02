const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/infrastructure/config/database');
const { enableAI, getAIEnabled, isAIEnabled, getAutomationScope } = require('../src/infrastructure/config/aiToggle');
const aiAgentService = require('../src/ai/agents/services/aiAgentService');

async function main() {
  console.log('====================================================');
  console.log('🚀 ATIVANDO AGENTE IA E CONVERSAS DE HOJE NO BANCO');
  console.log('====================================================\n');

  // 1. Ativar Toggle Global de IA
  console.log('1. Ativando toggle global de IA para tenant "default"...');
  await enableAI('default');
  await pool.query(
    "INSERT INTO system_settings (key, value, updated_at) VALUES ('ai_enabled', 'true', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()"
  );
  await pool.query(
    "INSERT INTO system_settings (key, value, updated_at) VALUES ('ai_enabled_v2:default', 'true', NOW()) ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()"
  );

  const globalActive = await getAIEnabled('default');
  console.log('   -> isAIEnabled("default"):', globalActive);

  // 2. Atualizar Configuração do Agente Camila com sessões conectadas
  console.log('\n2. Garantindo configuração ativa e sessões do agente Camila...');
  const agentsRes = await pool.query(
    "SELECT value FROM system_settings WHERE key = 'ai_agents_config_v2:default'"
  );
  if (agentsRes.rows.length > 0) {
    try {
      const agents = JSON.parse(agentsRes.rows[0].value);
      if (Array.isArray(agents) && agents.length > 0) {
        agents.forEach(agent => {
          agent.active = true;
          agent.sessionIds = ['main', 'material'];
        });
        await pool.query(
          "UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = 'ai_agents_config_v2:default'",
          [JSON.stringify(agents)]
        );
        console.log('   -> Agente(s) atualizado(s) com sessionIds: [\'main\', \'material\'] e active: true');
      }
    } catch (e) {
      console.warn('   -> Aviso ao atualizar agente:', e.message);
    }
  }

  // 3. Atualizar Conversas Ativas Hoje
  console.log('\n3. Ativando IA para todas as conversas com atividade hoje...');
  const updateRes = await pool.query(`
    UPDATE conversations
    SET ai_enabled = true,
        agent_name = COALESCE(NULLIF(agent_name, ''), 'Camila'),
        updated_at = NOW()
    WHERE company_id = 'default'
      AND (
        updated_at >= CURRENT_DATE 
        OR EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = conversations.id 
            AND m.created_at >= CURRENT_DATE
        )
      )
    RETURNING id, remote_jid, agent_name, ai_enabled;
  `);

  console.log(`   -> Total de conversas de hoje atualizadas: ${updateRes.rowCount}`);

  // 4. Verificação de status
  console.log('\n4. Verificação e distribuição atualizada:');
  const counts = await pool.query(`
    SELECT 
      c.ai_enabled,
      c.agent_name,
      COUNT(*) as count
    FROM conversations c
    WHERE c.company_id = 'default'
      AND (
        c.updated_at >= CURRENT_DATE 
        OR EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.created_at >= CURRENT_DATE
        )
      )
    GROUP BY c.ai_enabled, c.agent_name;
  `);
  console.log('   -> Distribuição das conversas de hoje:', counts.rows);

  const scope = await getAutomationScope('default');
  console.log('   -> Escopo de automação:', JSON.stringify(scope));

  console.log('\n✅ Ativação concluída com sucesso!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Falha na ativação:', err);
  process.exit(1);
});
