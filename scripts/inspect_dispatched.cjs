const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });

async function run() {
  const camp = await pool.query("SELECT id, company_id, status, queue, updated_at FROM campaigns WHERE id = 'cmp-recuperacao-02102026'");
  console.log('=== CAMPANHA NO POSTGRESQL ===');
  console.log(camp.rows[0]);
  console.log('ENV DEFAULT_COMPANY_ID:', process.env.DEFAULT_COMPANY_ID);

  const msgs = await pool.query("SELECT COUNT(*) FROM messages WHERE sender = 'campaign' AND created_at >= '2026-10-02 00:00:00'");
  console.log('Total mensagens de campanha hoje:', msgs.rows[0].count);

  await pool.end();
}

run().catch(console.error);
