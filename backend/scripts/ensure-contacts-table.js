require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        phone VARCHAR(64) NOT NULL,
        company_id VARCHAR(64) NOT NULL DEFAULT 'default',
        name VARCHAR(255),
        avatar_url TEXT,
        is_group BOOLEAN DEFAULT FALSE,
        session_id VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(phone, company_id)
      )
    `);
    console.log('OK: contacts table ensured');
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
  }
}

run();
