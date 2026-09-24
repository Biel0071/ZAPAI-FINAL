const { query } = require('../src/infrastructure/config/database');

async function check() {
  console.log('=== CHECKING PROVIDER KEYS & AI SETTINGS ===');
  
  try {
    const keys = await query('SELECT id, tenant_id, provider, model, enabled, created_at FROM provider_keys');
    console.log('provider_keys rows:', keys.rows);
  } catch (err) {
    console.log('provider_keys query error:', err.message);
  }

  try {
    const aiTables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%ai%' OR table_name LIKE '%setting%' OR table_name LIKE '%agent%' OR table_name LIKE '%prompt%')
    `);
    console.log('Relevant tables:', aiTables.rows.map(r => r.table_name));
  } catch (err) {
    console.log('Table search error:', err.message);
  }

  // Check agents table
  try {
    const agents = await query('SELECT * FROM agents LIMIT 10');
    console.log('\n--- AGENTS TABLE ---');
    console.log(agents.rows);
  } catch (err) {
    console.log('agents table error:', err.message);
  }

  // Check official knowledge
  try {
    const knowledge = await query('SELECT * FROM official_knowledge LIMIT 10');
    console.log('\n--- OFFICIAL KNOWLEDGE TABLE ---');
    console.log(knowledge.rows);
  } catch (err) {
    console.log('official_knowledge error:', err.message);
  }

  // Check playbooks
  try {
    const playbooks = await query('SELECT * FROM sales_playbooks LIMIT 10');
    console.log('\n--- PLAYBOOKS TABLE ---');
    console.log(playbooks.rows);
  } catch (err) {
    console.log('sales_playbooks error:', err.message);
  }

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
