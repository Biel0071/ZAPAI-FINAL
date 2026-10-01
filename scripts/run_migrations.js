'use strict';

const { initDatabase } = require('../backend/src/infrastructure/config/database');

async function main() {
  try {
    const res = await initDatabase({ runMigrations: true });
    console.log('Migrations executed successfully:', res.executed);

    const { query } = require('../backend/src/infrastructure/config/database');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_messages_group_retention
      ON messages (created_at)
      WHERE remote_jid LIKE '%@g.us' OR phone LIKE '%@g.us';
    `);
    console.log('idx_messages_group_retention ensured.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
  process.exit(0);
}

main();
