module.exports = {
  version: '022_create_pending_lid_messages',
  description: 'Create pending_lid_messages table for storing messages from unresolved LIDs',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_lid_messages (
        id SERIAL PRIMARY KEY,
        lid VARCHAR(255) NOT NULL,
        company_id VARCHAR(100) DEFAULT 'default',
        session_id VARCHAR(100) DEFAULT 'main',
        payload JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pending_lid_messages_lid ON pending_lid_messages(lid);
    `);
  },
};
