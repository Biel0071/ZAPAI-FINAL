const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function inspect() {
  const tables = [
    'ai_conversation_memory',
    'ai_memory_long',
    'ai_memory_short',
    'ai_context',
    'ai_evolution_stats',
    'agent_learning_events',
    'agent_memory_nodes',
    'conversations',
    'messages',
    'whatsapp_lid_mappings'
  ];

  for (const t of tables) {
    try {
      const res = await pool.query(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position",
        [t]
      );
      console.log(`=== ${t} ===`);
      console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
    } catch (err) {
      console.log(`=== ${t} === Error: ${err.message}`);
    }
  }
  await pool.end();
}

inspect().catch(console.error);
