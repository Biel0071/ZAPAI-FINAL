const { query } = require('../src/infrastructure/config/database');

async function main() {
  const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'provider_keys'");
  console.log('PROVIDER_KEYS COLS:', cols.rows.map(r => r.column_name));

  const rows = await query("SELECT * FROM provider_keys");
  console.log('PROVIDER_KEYS ROWS COUNT:', rows.rows.length);
  for (const r of rows.rows) {
    console.log(' - Provider:', r.provider, '| Tenant:', r.tenant_id, '| Enabled:', r.enabled, '| Model:', r.model);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
