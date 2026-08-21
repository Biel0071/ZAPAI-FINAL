const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function run() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quick_replies'
    `);
    console.log(res.rows);
  } catch(e) { console.error(e.message); }
  process.exit(0);
}
run();
