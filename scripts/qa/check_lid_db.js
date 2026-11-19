const db = require('/opt/zapai/backend/src/infrastructure/config/database');

async function run() {
  console.log('=== DEAD TUPLES & AUTOVACUUM STATUS ===');
  
  const stats = await db.query(`
    SELECT relname, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
    FROM pg_stat_user_tables
    ORDER BY n_dead_tup DESC
    LIMIT 10
  `);
  
  for (const row of stats.rows) {
    console.log(` - ${row.relname}: live=${row.n_live_tup}, dead=${row.n_dead_tup}, last_auto=${row.last_autovacuum || 'never'}`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
