'use strict';

module.exports = {
  version: '048_messages_performance_indexes',
  description: 'Add composite company/session and company/session/created_at performance indexes to messages table',
  async up(client) {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_company_session_id 
      ON messages (company_id, session_id);

      CREATE INDEX IF NOT EXISTS idx_messages_company_session_created 
      ON messages (company_id, session_id, created_at DESC);
    `);
  },
  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_messages_company_session_created;
      DROP INDEX IF EXISTS idx_messages_company_session_id;
    `);
  }
};
