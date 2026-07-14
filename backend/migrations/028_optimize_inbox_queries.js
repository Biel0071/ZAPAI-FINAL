module.exports = {
  version: '028_optimize_inbox_queries',
  description: 'Add composite indexes for Inbox conversation and message loading',
  up: async (client) => {
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_company_session_updated
        ON conversations (company_id, session_id, updated_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp
        ON messages (conversation_id, timestamp DESC, id DESC);
    `);
  },
};