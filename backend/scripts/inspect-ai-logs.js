const { query } = require('../src/infrastructure/config/database');

async function inspectLogs() {
  console.log('=== LATEST 20 AI LOGS ===');
  const logs = await query(`
    SELECT * FROM ai_logs 
    ORDER BY id DESC 
    LIMIT 20
  `);
  console.log(`Found ${logs.rows.length} ai_logs rows.`);
  for (const l of logs.rows) {
    console.log(`[Log ${l.id}] ${l.created_at || l.timestamp} | Provider: ${l.provider} | Model: ${l.model} | Success: ${l.success}`);
    console.log(`  Prompt preview: ${String(l.prompt || '').slice(0, 150)}...`);
    console.log(`  Response: ${String(l.response || l.error || '').slice(0, 200)}...\n`);
  }

  process.exit(0);
}

inspectLogs().catch(err => {
  console.error(err);
  process.exit(1);
});
