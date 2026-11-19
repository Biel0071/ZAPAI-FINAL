'use strict';

module.exports = {
  version: '058_conversation_context_tokens',
  description: 'Add encrypted context token columns and 30-day retention/recency indexes on conversations, ai_conversation_memory, and messages',
  async up(client) {
    await client.query(`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS context_token TEXT,
        ADD COLUMN IF NOT EXISTS context_token_meta JSONB DEFAULT '{}'::jsonb;
    `);

    await client.query(`
      ALTER TABLE ai_conversation_memory
        ADD COLUMN IF NOT EXISTS context_token TEXT;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_effective_ts
      ON messages ((COALESCE("timestamp", created_at)));
    `);

    const tsTypeRes = await client.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'updated_at'
      LIMIT 1
    `);
    const isWithTz = String(tsTypeRes.rows[0]?.data_type || '').toLowerCase().includes('with time zone');

    if (isWithTz) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_recent_activity
        ON conversations (company_id, (COALESCE(last_message_at, updated_at, created_at)) DESC);
      `);
    } else {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_recent_activity
        ON conversations (company_id, (COALESCE(last_message_at, timezone('UTC', updated_at), timezone('UTC', created_at))) DESC);
      `);
    }
  },
  async down(client) {
    await client.query(`DROP INDEX IF EXISTS idx_conversations_recent_activity;`);
    await client.query(`DROP INDEX IF EXISTS idx_messages_effective_ts;`);
    await client.query(`ALTER TABLE ai_conversation_memory DROP COLUMN IF EXISTS context_token;`);
    await client.query(`
      ALTER TABLE conversations
        DROP COLUMN IF EXISTS context_token_meta,
        DROP COLUMN IF EXISTS context_token;
    `);
  },
};
