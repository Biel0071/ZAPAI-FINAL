module.exports = {
  version: '013_add_ai_logs',
  description: 'Create ai_logs table for tracking token usage and AI replies',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        conversation_id VARCHAR(255),
        contact_name VARCHAR(255),
        message_sent TEXT,
        message_received TEXT,
        provider VARCHAR(50),
        model VARCHAR(100),
        prompt_tokens INT DEFAULT 0,
        completion_tokens INT DEFAULT 0,
        total_tokens INT DEFAULT 0
      );
    `);
  },
};
