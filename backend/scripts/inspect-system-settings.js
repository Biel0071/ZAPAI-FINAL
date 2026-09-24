const { query } = require('../src/infrastructure/config/database');

async function checkSystemSettings() {
  const settings = await query('SELECT * FROM system_settings');
  console.log('=== SYSTEM SETTINGS ===');
  for (const s of settings.rows) {
    console.log(`Key: "${s.key}"`);
    try {
      const parsed = JSON.parse(s.value);
      console.log('Parsed value:', JSON.stringify(parsed, null, 2).slice(0, 1000));
    } catch {
      console.log('Raw value:', String(s.value).slice(0, 500));
    }
    console.log('---');
  }
  process.exit(0);
}

checkSystemSettings().catch(err => {
  console.error(err);
  process.exit(1);
});
