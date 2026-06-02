const { Pool } = require('pg');
require('dotenv').config({ path: '../.env.production.local' });

async function main() {
  const connectionString = 'postgresql://zapai:JtkdhP2FWC_ElG4zIjXoaT3Yq0pV2xMI@127.0.0.1:5432/zapai_crm';
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query('SELECT * FROM frontend_errors ORDER BY created_at DESC LIMIT 10');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
