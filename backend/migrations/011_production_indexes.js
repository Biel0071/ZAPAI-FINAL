/**
 * Migration 011 — Production Performance Indexes
 *
 * Adds indexes for the most common production queries that are NOT
 * covered by migration 001:
 *
 * Hot paths:
 *   1. Messages today (dashboard metrics): WHERE created_at >= $today
 *   2. Conversations list (inbox): WHERE status ORDER BY updated_at DESC
 *   3. Messages by session+phone (inbox load): session_id + phone
 *   4. Conversations by company+status (multi-tenant): company_id + status
 *   5. DB pool health probe: SELECT 1 (no index needed, covered by PG)
 *
 * All indexes use IF NOT EXISTS — safe to run on live databases.
 * These are non-blocking (no table locks on index creation for small tables).
 * For large existing tables, run CONCURRENTLY manually after deploy:
 *   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
 */

const INDEXES_SQL = `
  -- Dashboard: messages today (WHERE created_at >= $date)
  CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages(created_at DESC);

  -- Dashboard: AI responses today (WHERE sender = 'agent' AND created_at >= $date)
  CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at
    ON messages(sender, created_at DESC);

  -- Inbox: conversation list sorted by recency
  CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
    ON conversations(updated_at DESC);

  -- Inbox: open conversations by company (multi-tenant filter)
  CREATE INDEX IF NOT EXISTS idx_conversations_company_status_updated
    ON conversations(company_id, status, updated_at DESC);

  -- Messages: load by session+phone (Inbox chat view)
  CREATE INDEX IF NOT EXISTS idx_messages_session_phone_ts
    ON messages(session_id, phone, created_at DESC);

  -- Leads: search by creation date (dashboard new leads count)
  CREATE INDEX IF NOT EXISTS idx_leads_created_at
    ON leads(created_at DESC);

  -- Leads: company filter (multi-tenant)
  CREATE INDEX IF NOT EXISTS idx_leads_company_created_at
    ON leads(company_id, created_at DESC);

  -- Sessions: last-updated sort (session list UI)
  CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
    ON sessions(created_at DESC);

  -- Conversations: unread count filter
  CREATE INDEX IF NOT EXISTS idx_conversations_unread
    ON conversations(unread_count)
    WHERE unread_count > 0;
`;

module.exports = {
  version: '011_production_indexes',
  description: 'Production performance indexes for hot query paths (dashboard, inbox, sessions).',
  up: async (client) => {
    await client.query(INDEXES_SQL);
  },
};
