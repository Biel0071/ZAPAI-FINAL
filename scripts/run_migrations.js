'use strict';

const { initDatabase } = require('../backend/src/infrastructure/config/database');

async function main() {
  try {
    const res = await initDatabase({ runMigrations: true });
    console.log('Migrations executed successfully:', res.executed);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
  process.exit(0);
}

main();
