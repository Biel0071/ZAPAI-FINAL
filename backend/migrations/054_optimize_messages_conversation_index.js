'use strict';

module.exports = {
  version: '054_optimize_messages_conversation_index',
  description: 'Add composite (company_id, conversation_id, created_at DESC, id DESC) index for sub-millisecond message loading during contact switching',
  async up(client) {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_company_conv_created 
      ON messages (company_id, conversation_id, created_at DESC, id DESC);
    `);
  },
  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_messages_company_conv_created;
    `);
  }
};
