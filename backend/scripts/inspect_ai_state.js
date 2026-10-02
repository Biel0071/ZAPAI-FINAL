const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/infrastructure/config/database');
const { getAIEnabled, isAIEnabled, getAutomationScope } = require('../src/infrastructure/config/aiToggle');

async function check() {
  console.log('=== AI GLOBAL & SCOPE STATE ===');
  const globalFromToggle = await getAIEnabled('default');
  const scope = await getAutomationScope('default');
  console.log('isAIEnabled("default"):', globalFromToggle);
  console.log('Automation Scope:', JSON.stringify(scope));

  // Check system_settings table
  const settingsRes = await pool.query(
    "SELECT key, value, updated_at FROM system_settings WHERE key LIKE '%ai%' ORDER BY key"
  );
  console.log('system_settings matches:', settingsRes.rows);

  // Check conversations from today
  const todayConvs = await pool.query(`
    SELECT 
      c.id, c.session_id, c.ai_enabled, c.updated_at, c.agent_name,
      l.phone, l.name
    FROM conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE c.company_id = 'default'
      AND (
        c.updated_at >= CURRENT_DATE 
        OR EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.created_at >= CURRENT_DATE
        )
      )
    ORDER BY c.updated_at DESC
    LIMIT 50;
  `);

  console.log(`\n=== CONVERSATIONS ACTIVE TODAY (${todayConvs.rows.length} found) ===`);
  for (const row of todayConvs.rows) {
    console.log(`ID: ${row.id} | Phone: ${row.phone} | Name: ${row.name || 'Sem nome'} | ai_enabled: ${row.ai_enabled} | Agent: ${row.agent_name || 'Nenhum'} | Updated: ${row.updated_at}`);
  }

  // Count how many are enabled vs disabled today
  const counts = await pool.query(`
    SELECT 
      c.ai_enabled,
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
    GROUP BY c.ai_enabled;
  `);
  console.log('\nAI Enabled distribution for today:', counts.rows);

  process.exit(0);
}

check().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
