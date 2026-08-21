const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    const res = await pool.query(`SELECT id, name, status, settings->>'startAt' as start_at, settings->>'scheduledAt' as scheduled_at, settings FROM campaigns ORDER BY created_at DESC LIMIT 5`);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Database Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
