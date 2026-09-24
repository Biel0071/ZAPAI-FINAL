const { query } = require('../src/infrastructure/config/database');

async function inspectLogDetail() {
  const cols = await query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_logs'
  `);
  console.log('Columns in ai_logs:', cols.rows.map(r => r.column_name));

  const log = await query(`SELECT * FROM ai_logs ORDER BY id DESC LIMIT 3`);
  console.log('\n--- LATEST 3 LOGS (FULL) ---');
  for (const row of log.rows) {
    console.log(JSON.stringify(row, null, 2));
  }

  process.exit(0);
}

inspectLogDetail().catch(err => {
  console.error(err);
  process.exit(1);
});
