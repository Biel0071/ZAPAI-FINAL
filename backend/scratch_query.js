const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function test() {
  const c1 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'contacts'");
  console.log("CONTACTS:", c1.rows);
  
  const c2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversations'");
  console.log("CONVERSATIONS:", c2.rows);

  process.exit(0);
}
test();
