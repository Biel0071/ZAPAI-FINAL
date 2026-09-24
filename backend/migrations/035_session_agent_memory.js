module.exports = {
  version: '035_session_agent_memory',
  description: 'Connection-scoped persistent memory, optional stores and agent versions',
  up: async client => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_conversation_memory (
        id SERIAL PRIMARY KEY, contact_id VARCHAR(255) NOT NULL, company_id VARCHAR(100) NOT NULL,
        phone VARCHAR(50), name VARCHAR(255), intent VARCHAR(100), sentiment VARCHAR(50),
        tags TEXT[] DEFAULT '{}', summary TEXT DEFAULT '', metrics JSONB DEFAULT '{}',
        messages JSONB DEFAULT '[]', last_updated TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE ai_conversation_memory ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
      DO $$ DECLARE c RECORD; BEGIN
        FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='ai_conversation_memory'::regclass AND contype='u'
        LOOP EXECUTE format('ALTER TABLE ai_conversation_memory DROP CONSTRAINT %I', c.conname); END LOOP;
      END $$;
      CREATE UNIQUE INDEX IF NOT EXISTS ai_memory_connection_contact ON ai_conversation_memory(company_id,session_id,contact_id);
      CREATE INDEX IF NOT EXISTS ai_memory_connection_phone ON ai_conversation_memory(company_id,session_id,phone);
      -- Aggregated legacy rows have no provable per-message origin. Preserve them with NULL session_id.
      CREATE TABLE IF NOT EXISTS ai_stores (
        company_id VARCHAR(100) NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, segment TEXT NOT NULL DEFAULT '',
        knowledge TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(company_id,id)
      );
      CREATE TABLE IF NOT EXISTS session_ai_profiles (
        company_id VARCHAR(100) NOT NULL, session_id VARCHAR(100) NOT NULL, store_id TEXT,
        segment TEXT NOT NULL DEFAULT '', service_type TEXT NOT NULL DEFAULT '',
        evolution_mode TEXT NOT NULL DEFAULT 'limited' CHECK(evolution_mode IN ('limited','paused')),
        last_error TEXT, last_processed_at TIMESTAMPTZ,
        PRIMARY KEY(company_id,session_id), FOREIGN KEY(company_id,store_id) REFERENCES ai_stores(company_id,id)
      );
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS memory_projected BOOLEAN NOT NULL DEFAULT FALSE;
      CREATE INDEX IF NOT EXISTS messages_memory_pending ON messages(company_id,session_id,id) WHERE memory_projected=FALSE;
      CREATE TABLE IF NOT EXISTS ai_memory_receipts (
        company_id VARCHAR(100) NOT NULL, session_id VARCHAR(100) NOT NULL, event_key TEXT NOT NULL,
        PRIMARY KEY(company_id,session_id,event_key)
      );
      CREATE TABLE IF NOT EXISTS ai_agent_versions (
        id BIGSERIAL PRIMARY KEY, company_id VARCHAR(100) NOT NULL, session_id VARCHAR(100) NOT NULL,
        agent_key TEXT NOT NULL, snapshot JSONB NOT NULL, evidence JSONB NOT NULL DEFAULT '[]',
        reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ai_agent_versions_scope ON ai_agent_versions(company_id,session_id,agent_key,id DESC);
      CREATE TABLE IF NOT EXISTS ai_session_agent_styles (
        company_id VARCHAR(100) NOT NULL, session_id VARCHAR(100) NOT NULL, agent_key TEXT NOT NULL,
        style JSONB NOT NULL DEFAULT '{}', observed_count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(company_id,session_id,agent_key)
      );
    `);
  },
};
