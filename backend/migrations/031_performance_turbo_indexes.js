/**
 * Migration 031 — Production Turbo Performance Indexes
 *
 * Adds high-speed composite indexes for conversation DISTINCT ON queries,
 * message pagination by conversation_id, and fast lead/phone lookups.
 */

const TURBO_INDEXES_SQL = `
  -- Fast DISTINCT ON & Recency lookup for Inbox conversations
  CREATE INDEX IF NOT EXISTS idx_conversations_distinct_lookup
    ON conversations(company_id, lead_id, session_id, updated_at DESC);

  -- Fast Conversation Session ID + Recency
  CREATE INDEX IF NOT EXISTS idx_conversations_session_id_updated_at
    ON conversations(session_id, updated_at DESC);

  -- Fast Message pagination by conversation_id
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at
    ON messages(conversation_id, created_at DESC);

  -- Fast Message lookup by phone
  CREATE INDEX IF NOT EXISTS idx_messages_phone_created_at
    ON messages(phone, created_at DESC);

  -- Fast Lead lookup by phone and company
  CREATE INDEX IF NOT EXISTS idx_leads_phone_company
    ON leads(phone, company_id);

  -- Fast Message lookup for unread / recent
  CREATE INDEX IF NOT EXISTS idx_messages_unread_lookup
    ON messages(conversation_id, from_me, created_at DESC);
`;

module.exports = {
  version: '031_performance_turbo_indexes',
  description: 'Production composite performance indexes for fast Inbox and DB query execution.',
  up: async (client) => {
    await client.query(TURBO_INDEXES_SQL);
  },
};
