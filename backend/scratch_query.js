const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function test() {
  const c1 = await pool.query(`SELECT id, name, status, settings->>'startAt' AS start_at, settings->>'scheduledAt' AS scheduled_at FROM campaigns ORDER BY created_at DESC LIMIT 10`);
  console.log("CAMPAIGNS:");
  c1.rows.forEach(r => console.log(`  [${r.status}] ${r.name} | startAt=${r.start_at} | scheduledAt=${r.scheduled_at}`));
  process.exit(0);
}
test().catch(e => { console.error(e.message); process.exit(1); });
