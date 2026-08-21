const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, name, status, settings->>'scheduledAt' as scheduled,
      (settings->>'scheduledAt')::timestamp as casted_ts,
      (settings->>'scheduledAt')::timestamptz as casted_tz,
      NOW() as now_db,
      (settings->>'scheduledAt')::timestamptz <= NOW() as is_past_tz
      FROM campaigns
      WHERE status = 'scheduled'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Database Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
