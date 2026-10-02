const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/infrastructure/config/database');

async function main() {
  console.log('================================================================');
  console.log('⏱️ ATUALIZANDO CONFIGURAÇÕES DE DELAY HUMANIZADO (CAMPANHA E IA)');
  console.log('================================================================\n');

  // 1. Atualizar Campanha de Recuperação 'cmp-recuperacao-02102026'
  const campaignId = 'cmp-recuperacao-02102026';
  const campRes = await pool.query('SELECT id, name, settings, queue FROM campaigns WHERE id = $1', [campaignId]);

  if (campRes.rows.length === 0) {
    console.warn(`⚠️ Campanha ${campaignId} não encontrada no banco.`);
  } else {
    const currentCamp = campRes.rows[0];
    const currentSettings = typeof currentCamp.settings === 'string' 
      ? JSON.parse(currentCamp.settings) 
      : (currentCamp.settings || {});

    const updatedSettings = {
      ...currentSettings,
      intervalSeconds: 115,
      randomDelayMin: 85000,
      randomDelayMax: 140000,
      typingDelaySeconds: 9,
      typingDelayMinSeconds: 6,
      typingDelayMaxSeconds: 12,
      pauseEvery: 7,
      pauseEveryMin: 6,
      pauseEveryMax: 8,
      pauseSeconds: 180,
      pauseMinSeconds: 150,
      pauseMaxSeconds: 240,
    };

    await pool.query(
      'UPDATE campaigns SET settings = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedSettings), campaignId]
    );

    console.log(`✅ Campanha "${campaignId}" atualizada com sucesso:`);
    console.log(`   - Cadência Média: ~115 segundos (~2 minutos por lead)`);
    console.log(`   - Delay Dinâmico entre mensagens: 85s a 140s (com jitter natural)`);
    console.log(`   - Digitação com presença WhatsApp (composing): 6s a 12s`);
    console.log(`   - Pausas Humanas do Atendente: a cada 6 a 8 mensagens, descanso de 150s a 240s`);
    console.log(`   - Tempo Total Estimado para 61 leads: ~2 horas`);
  }

  // 2. Atualizar Configurações do Agente Camila em system_settings
  const agentKeys = ['ai_agents_config_v2:default', 'ai_agents_config_v1'];
  for (const settingKey of agentKeys) {
    const sRes = await pool.query('SELECT key, value FROM system_settings WHERE key = $1', [settingKey]);
    if (sRes.rows.length > 0) {
      try {
        const agents = typeof sRes.rows[0].value === 'string'
          ? JSON.parse(sRes.rows[0].value)
          : sRes.rows[0].value;

        if (Array.isArray(agents)) {
          let modified = false;
          for (const agent of agents) {
            agent.delayProfile = { minMs: 12000, maxMs: 25000 };
            agent.typingDelayProfile = { minMs: 6000, maxMs: 14000 };
            modified = true;
          }

          if (modified) {
            await pool.query(
              'UPDATE system_settings SET value = $1, updated_at = NOW() WHERE key = $2',
              [JSON.stringify(agents), settingKey]
            );
            console.log(`\n✅ system_settings ("${settingKey}") atualizado com sucesso:`);
            console.log(`   - Camila delayProfile (leitura / reflexão): 12.000ms a 25.000ms (12s - 25s)`);
            console.log(`   - Camila typingDelayProfile (digitação humana): 6.000ms a 14.000ms (6s - 14s)`);
          }
        }
      } catch (err) {
        console.warn(`   ⚠️ Erro ao atualizar ${settingKey}:`, err.message);
      }
    }
  }

  console.log('\n================================================================');
  console.log('🎉 TODAS AS CONFIGURAÇÕES DE HUMANIZAÇÃO FORAM APLICADAS!');
  console.log('================================================================');
  await pool.end();
}

main().catch(err => {
  console.error('❌ Erro no script de atualização:', err);
  process.exit(1);
});
