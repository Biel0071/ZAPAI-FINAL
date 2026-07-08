const { query } = require('../config/database');

async function main() {
  console.log('Altering nodes table to add services column...');
  await query(`
    ALTER TABLE nodes ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '{}'::jsonb;
  `);
  console.log('Table nodes altered successfully!');

  const result = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'nodes'");
  console.log('New columns inside nodes table:');
  console.log(result.rows.filter(r => r.column_name === 'services'));
}

main().catch(console.error).finally(() => process.exit(0));
