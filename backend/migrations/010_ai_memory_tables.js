/**
 * Migration 010 — AI Memory Engine Tables
 *
 * Creates:
 *   ai_memory_short  — short-term conversation context (TTL-based expiry)
 *   ai_memory_long   — long-term customer profile (permanent)
 *   ai_context       — per-session AI context snapshot
 *   frontend_errors  — persisted frontend error reports (from POST /api/system/error-log)
 *
 * Rules:
 *   GROUPS  → ai_memory_short expires in 24h
 *   PRIVATE → ai_memory_short expires in 60 days
 *   LONG    → ai_memory_long never expires (manual cleanup only)
 */

const UP_SQL = `
  -- Short-term memory: conversation context with TTL
  CREATE TABLE IF NOT EXISTS ai_memory_short (
    id          SERIAL PRIMARY KEY,
    chat_id     VARCHAR(200) NOT NULL,
    session_id  VARCHAR(100),
    company_id  TEXT DEFAULT 'default',
    role        VARCHAR(20)  NOT NULL DEFAULT 'user',   -- 'user' | 'assistant' | 'system'
    content     TEXT         NOT NULL,
    is_group    BOOLEAN      DEFAULT FALSE,
    expires_at  TIMESTAMP    NOT NULL,
    created_at  TIMESTAMP    DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_ai_mem_short_chat   ON ai_memory_short(chat_id, session_id);
  CREATE INDEX IF NOT EXISTS idx_ai_mem_short_expiry ON ai_memory_short(expires_at);

  -- Long-term memory: customer profile (permanent, manual prune only)
  CREATE TABLE IF NOT EXISTS ai_memory_long (
    id          SERIAL PRIMARY KEY,
    chat_id     VARCHAR(200) NOT NULL,
    session_id  VARCHAR(100),
    company_id  TEXT DEFAULT 'default',
    category    VARCHAR(80),    -- 'preference' | 'objection' | 'context' | 'product_interest'
    content     TEXT NOT NULL,
    confidence  NUMERIC DEFAULT 1.0,
    source      VARCHAR(50) DEFAULT 'conversation',
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (chat_id, category, content)
  );

  CREATE INDEX IF NOT EXISTS idx_ai_mem_long_chat ON ai_memory_long(chat_id, session_id);
  CREATE INDEX IF NOT EXISTS idx_ai_mem_long_cat  ON ai_memory_long(chat_id, category);

  -- Per-session AI context snapshot (latest state of AI for this chat)
  CREATE TABLE IF NOT EXISTS ai_context (
    id              SERIAL PRIMARY KEY,
    chat_id         VARCHAR(200) UNIQUE NOT NULL,
    session_id      VARCHAR(100),
    company_id      TEXT DEFAULT 'default',
    lead_temperature VARCHAR(50) DEFAULT 'cold',
    lead_intent     VARCHAR(100),
    next_action     VARCHAR(100),
    tone            VARCHAR(50) DEFAULT 'professional',
    last_ai_reply   TEXT,
    context_json    JSONB DEFAULT '{}'::jsonb,
    updated_at      TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_ai_ctx_chat ON ai_context(chat_id, session_id);

  -- Frontend error log table (complements the NDJSON file log)
  CREATE TABLE IF NOT EXISTS frontend_errors (
    id            SERIAL PRIMARY KEY,
    type          VARCHAR(100) DEFAULT 'frontend_error',
    level         VARCHAR(20)  DEFAULT 'error',
    message       TEXT,
    service       VARCHAR(200),
    stack         TEXT,
    user_agent    TEXT,
    ip            VARCHAR(60),
    created_at    TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_fe_errors_created ON frontend_errors(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fe_errors_level   ON frontend_errors(level, created_at DESC);
`;

module.exports = {
  version: '010_ai_memory_tables',
  description: 'AI memory engine tables: short-term, long-term, context, frontend errors.',
  up: async (client) => {
    await client.query(UP_SQL);
  },
};
