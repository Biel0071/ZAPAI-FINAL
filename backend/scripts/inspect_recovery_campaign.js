const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/infrastructure/config/database');

async function main() {
  const campaignId = process.argv[2] || 'cmp-recuperacao-02102026';
  const res = await pool.query(
    'SELECT id, name, status, settings, queue, created_at, updated_at FROM campaigns WHERE id = $1',
    [campaignId]
  );
  if (res.rows.length === 0) {
    console.log(`Campanha ${campaignId} não encontrada no banco.`);
  } else {
    console.log('Campanha encontrada:');
    console.log(JSON.stringify(res.rows[0], null, 2));
  }

  const agentRes = await pool.query(
    "SELECT key, value FROM system_settings WHERE key = 'ai_agents_config_v2:default'"
  );
  if (agentRes.rows.length > 0) {
    console.log('\nConfiguração do Agente (ai_agents_config_v2:default):');
    try {
      console.log(JSON.stringify(JSON.parse(agentRes.rows[0].value), null, 2));
    } catch {
      console.log(agentRes.rows[0].value);
    }
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
