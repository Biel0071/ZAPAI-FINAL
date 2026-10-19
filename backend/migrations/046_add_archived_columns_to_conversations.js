'use strict';

module.exports = {
  version: '046_add_archived_columns_to_conversations',
  description: 'Add archived and archived_at columns to conversations',
  async up(client) {
    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

      CREATE INDEX IF NOT EXISTS idx_conversations_archived
      ON conversations(company_id, archived, last_message_at DESC);
    `);
  },
  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_conversations_archived;
      ALTER TABLE conversations DROP COLUMN IF EXISTS archived_at;
      ALTER TABLE conversations DROP COLUMN IF EXISTS archived;
    `);
  }
};
