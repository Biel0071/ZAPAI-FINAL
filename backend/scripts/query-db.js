require('dotenv').config();
const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  connectionString = connectionString.replace('@postgres:', '@127.0.0.1:');
}

const pool = new Pool({ connectionString });

async function run() {
  try {
    const sessions = await pool.query(`
      SELECT id, company_id, session_id, session_name, status, phone_number FROM sessions
    `);
    console.log('--- SESSIONS ---');
    console.log(sessions.rows);

  } catch (e) {
    console.error('ERR:', e);
  } finally {
    await pool.end();
  }
}
run();
