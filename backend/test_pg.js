const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function test() {
  try {
    const res = await pool.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['campaigns']);
    console.log('Columns:', res.rows.map(r => r.column_name));
    
    const testId = 'camp_' + Date.now();
    await pool.query('INSERT INTO campaigns (id, name, status, company_id) VALUES ($1, $2, $3, $4)', [testId, 'Test Real', 'draft', 'default']);
    const sel = await pool.query('SELECT * FROM campaigns WHERE id = $1', [testId]);
    console.log('[POSTGRESQL] CRUD Campaign inserted ->', sel.rows.length === 1);
    await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
    process.exit(0);
  } catch(e) {
    console.log(e);
    process.exit(1);
  }
}
test();
