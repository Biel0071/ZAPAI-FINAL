'use strict';

module.exports = {
  version: '043_add_ai_last_followup_at_to_conversations',
  description: 'Add ai_last_followup_at column and index to conversations table for algorithmic follow-up tracking',
  async up(client) {
    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS ai_last_followup_at TIMESTAMP WITH TIME ZONE;

      CREATE INDEX IF NOT EXISTS idx_conversations_ai_last_followup_at
      ON conversations(company_id, ai_last_followup_at DESC);
    `);
  },
  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_conversations_ai_last_followup_at;
      ALTER TABLE conversations DROP COLUMN IF EXISTS ai_last_followup_at;
    `);
  }
};
