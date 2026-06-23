require('dotenv').config();
const { Pool } = require('pg');
const connectionString = process.env.DATABASE_URL.replace('@postgres:', '@127.0.0.1:');
const pool = new Pool({ connectionString });

async function check() {
  try {
    const leadsRes = await pool.query(`
      SELECT id, phone, name FROM leads WHERE phone LIKE '%@lid%' OR phone ~ '^15\\d{13}'
    `);
    console.log('--- LEADS WITH LID ---');
    console.log(leadsRes.rows);

    const dupRes = await pool.query(`
      SELECT phone, COUNT(*) FROM leads GROUP BY phone HAVING COUNT(*) > 1
    `);
    console.log('--- DUPLICATE LEADS BY PHONE ---');
    console.log(dupRes.rows);

    const conversationsRes = await pool.query(`
      SELECT id, lead_id, session_id, last_message FROM conversations ORDER BY lead_id, session_id
    `);
    console.log('--- ALL CONVERSATIONS ---');
    console.log(conversationsRes.rows);

    const mappings = await pool.query(`
      SELECT * FROM whatsapp_lid_mappings
    `);
    console.log('--- WHATSAPP LID MAPPINGS ---');
    console.log(mappings.rows);

  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
check();
