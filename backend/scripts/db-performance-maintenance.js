const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function getPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'zapai_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });
}

function shouldRunVacuum() {
  return String(process.env.DB_RUN_VACUUM_ANALYZE || '').trim().toLowerCase() === 'true';
}

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const indexes = await client.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    const deadTuples = await client.query(`
      SELECT
        relname AS table_name,
        n_live_tup,
        n_dead_tup,
        ROUND((n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0)) * 100, 2) AS dead_pct
      FROM pg_stat_user_tables
      ORDER BY n_dead_tup DESC
      LIMIT 20
    `);

    let vacuumResult = { mode: 'skipped', message: 'Set DB_RUN_VACUUM_ANALYZE=true to execute.' };
    if (shouldRunVacuum()) {
      await client.query('VACUUM (ANALYZE) sessions');
      await client.query('VACUUM (ANALYZE) leads');
      await client.query('VACUUM (ANALYZE) conversations');
      await client.query('VACUUM (ANALYZE) messages');
      await client.query('VACUUM (ANALYZE) campaigns');
      vacuumResult = { mode: 'executed', message: 'VACUUM ANALYZE executed on core tables.' };
    }

    console.log(JSON.stringify({
      status: 'ok',
      totalIndexes: indexes.rows.length,
      deadTupleTop: deadTuples.rows,
      vacuum: vacuumResult,
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed db performance maintenance:', error?.message || error);
  process.exit(1);
});
