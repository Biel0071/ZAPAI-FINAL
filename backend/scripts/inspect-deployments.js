const { query } = require('../config/database');

async function main() {
  const result = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deployments'");
  console.log('Columns inside deployments table:');
  console.log(result.rows);
}

main().catch(console.error).finally(() => process.exit(0));
