#!/usr/bin/env node

require('dotenv').config();

const { runMigrations } = require('../services/migrationRunner');
const { pool } = require('../config/database');

async function main() {
  const result = await runMigrations({ pool });

  console.log('[MIGRATIONS] total:', result.totalMigrations);
  console.log('[MIGRATIONS] executed:', result.executed.length);
  for (const migration of result.executed) {
    console.log(` - applied ${migration.version}: ${migration.description}`);
  }

  if (!result.executed.length) {
    console.log('[MIGRATIONS] database is already up-to-date.');
  }

  console.log('[MIGRATIONS] applied versions:', result.appliedVersions.length);
}

main()
  .catch((error) => {
    console.error('[MIGRATIONS] failed:', error?.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
