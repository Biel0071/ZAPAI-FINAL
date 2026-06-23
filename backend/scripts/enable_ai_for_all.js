require('dotenv').config();
const { Pool } = require('pg');

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  connectionString = connectionString.replace('@postgres:', '@127.0.0.1:');
}

const pool = new Pool({ connectionString });

async function run() {
  try {
    // 1. Enable globally
    await pool.query("INSERT INTO system_settings (key, value) VALUES ('ai_enabled', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'");
    console.log('Global AI enabled in database.');

    // 2. Enable for the test conversation
    await pool.query("UPDATE conversations SET ai_enabled = true WHERE lead_id IN (SELECT id FROM leads WHERE phone = '553193672075')");
    console.log('AI enabled for conversation 553193672075 in database.');

  } catch (e) {
    console.error('ERR:', e);
  } finally {
    await pool.end();
  }
}
run();
