'use strict';

module.exports = {
  version: '041_add_last_message_at_to_conversations',
  description: 'Add last_message_at column and index to conversations, and backfill from messages max timestamp',
  async up(client) {
    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE;

      CREATE INDEX IF NOT EXISTS idx_conversations_last_msg_at
      ON conversations(company_id, last_message_at DESC);

      -- Backfill last_message_at from messages
      UPDATE conversations c
      SET last_message_at = m.max_ts
      FROM (
        SELECT conversation_id, MAX(COALESCE(timestamp, created_at)) AS max_ts
        FROM messages
        WHERE conversation_id IS NOT NULL
        GROUP BY conversation_id
      ) m
      WHERE c.id = m.conversation_id AND c.last_message_at IS NULL;

      -- Fallback to updated_at / created_at for conversations without messages
      UPDATE conversations
      SET last_message_at = COALESCE(updated_at, created_at, NOW())
      WHERE last_message_at IS NULL;
    `);
  },
  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_conversations_last_msg_at;
      ALTER TABLE conversations DROP COLUMN IF EXISTS last_message_at;
    `);
  }
};
