'use strict';

module.exports = {
  version: '040_index_history_items_foreign_key',
  description: 'Add index on whatsapp_history_items.message_id and messages(company_id, created_at) to accelerate cascade checks and retention deletions',
  async up(client) {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_history_items_msg_fk
      ON whatsapp_history_items(message_id);

      CREATE INDEX IF NOT EXISTS idx_messages_company_created_at
      ON messages(company_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_messages_group_retention
      ON messages(created_at)
      WHERE remote_jid LIKE '%@g.us' OR phone LIKE '%@g.us';
    `);
  },
  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_history_items_message_id;
      DROP INDEX IF EXISTS idx_messages_company_created_at;
      DROP INDEX IF EXISTS idx_messages_group_retention;
    `);
  }
};
