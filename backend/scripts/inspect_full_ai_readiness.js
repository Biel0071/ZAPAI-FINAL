const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool, query } = require('../src/infrastructure/config/database');
const { getAIEnabled, isAIEnabled, getAutomationScope } = require('../src/infrastructure/config/aiToggle');
const { getAIIntegrationStatus } = require('../services/ai.service');
const aiAgentService = require('../src/ai/agents/services/aiAgentService');

async function inspect() {
  console.log('=== 1. AI GLOBAL TOGGLE & SCOPE ===');
  const globalToggle = await getAIEnabled('default');
  console.log('isAIEnabled("default"):', globalToggle);
  const scope = await getAutomationScope('default');
  console.log('Automation Scope:', JSON.stringify(scope));

  console.log('\n=== 2. AI INTEGRATION STATUS (LLM PROVIDER) ===');
  try {
    const integration = await getAIIntegrationStatus(null, 'default');
    console.log('Integration Status:', integration);
  } catch (e) {
    console.error('Integration check error:', e.message);
  }

  console.log('\n=== 3. CONFIGURED AGENTS ===');
  try {
    const agents = await aiAgentService.listAgents('default');
    console.log(`Found ${agents.length} agent(s):`);
    for (const a of agents) {
      console.log(JSON.stringify(a, null, 2));
    }
  } catch (e) {
    console.error('Agent list error:', e.message);
  }

  console.log('\n=== 4. SYSTEM SETTINGS (AI & RELEVANT) ===');
  const settingsRes = await pool.query(
    "SELECT key, value, updated_at FROM system_settings WHERE key LIKE '%ai%' OR key = 'business_hours' ORDER BY key"
  );
  for (const row of settingsRes.rows) {
    console.log(`- ${row.key}: ${row.value.slice(0, 100)}${row.value.length > 100 ? '...' : ''} (Updated: ${row.updated_at})`);
  }

  console.log('\n=== 5. SESSIONS STATUS IN DB ===');
  try {
    const distinctSessions = await pool.query("SELECT DISTINCT session_id FROM conversations WHERE session_id IS NOT NULL");
    console.log('Distinct session_ids in conversations:', distinctSessions.rows);
  } catch (e) {
    console.log('Sessions query note:', e.message);
  }

  console.log('\n=== 6. CONVERSATIONS ACTIVITY TODAY ===');
  const todayConvs = await pool.query(`
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
  console.log('Today conversations breakdown:', todayConvs.rows);

  process.exit(0);
}

inspect().catch(err => {
  console.error('Inspect error:', err);
  process.exit(1);
});
