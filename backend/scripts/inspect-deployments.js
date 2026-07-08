const { query } = require('../config/database');

async function main() {
  console.log('Altering deployments table...');
  await query(`
    ALTER TABLE deployments ADD COLUMN IF NOT EXISTS deployment_type VARCHAR(50) NOT NULL DEFAULT 'deploy';
    ALTER TABLE deployments ADD COLUMN IF NOT EXISTS git_ref VARCHAR(255);
    ALTER TABLE deployments ADD COLUMN IF NOT EXISTS build_hash VARCHAR(64);
    ALTER TABLE deployments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
    ALTER TABLE deployments ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
    ALTER TABLE deployments ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(100) DEFAULT 'system';
    ALTER TABLE deployments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE deployments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);
  console.log('Table deployments altered successfully!');

  const result = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deployments'");
  console.log('New columns inside deployments table:');
  console.log(result.rows);
}

main().catch(console.error).finally(() => process.exit(0));
