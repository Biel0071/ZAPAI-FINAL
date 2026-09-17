/**
 * Migration 033 — Create Evolutionary Agent Tables (5-Layer Learning Architecture)
 *
 * 1. company_official_knowledge (Layer 1: Official Store Knowledge / Canonical Truth)
 * 2. ai_playbooks (Layer 3 & 5: Operational Sales Playbooks)
 * 3. ai_experience_events (Layer 4: Action x Reaction x Outcome Experience Tracker)
 * 4. ai_learning_suggestions (Layer 5: Mined Patterns & Evolution Proposals)
 */

module.exports = {
  version: '033_create_evolutionary_agent_tables',
  description: 'Create tables for 5-layer evolutionary AI agent: official knowledge, playbooks, experiences, suggestions',
  up: async (client) => {
    // 1. Layer 1: Official Knowledge
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_official_knowledge (
        id SERIAL PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL DEFAULT 'default',
        category VARCHAR(50) NOT NULL,
        key VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content JSONB NOT NULL DEFAULT '{}'::jsonb,
        raw_text TEXT,
        tags TEXT[] DEFAULT ARRAY[]::TEXT[],
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_official_knowledge_key UNIQUE (company_id, key)
      );

      CREATE INDEX IF NOT EXISTS idx_official_knowledge_company ON company_official_knowledge(company_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_official_knowledge_category ON company_official_knowledge(company_id, category);
      CREATE INDEX IF NOT EXISTS idx_official_knowledge_tags ON company_official_knowledge USING GIN (tags);
      CREATE INDEX IF NOT EXISTS idx_official_knowledge_tsv ON company_official_knowledge USING GIN (
        to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(raw_text, ''))
      );
    `);

    // 2. Layer 3 & 5: Playbooks
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_playbooks (
        id SERIAL PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL DEFAULT 'default',
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        trigger_condition VARCHAR(255) NOT NULL,
        goal TEXT NOT NULL,
        steps JSONB NOT NULL DEFAULT '[]'::jsonb,
        recommended_cta TEXT,
        confidence NUMERIC(5,2) DEFAULT 0.85,
        evidence_count INTEGER DEFAULT 1,
        continuity_boost_pct NUMERIC(5,2) DEFAULT 0.0,
        status VARCHAR(50) NOT NULL DEFAULT 'approved',
        created_by VARCHAR(100) DEFAULT 'system_seed',
        approved_by VARCHAR(100) DEFAULT 'owner',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_ai_playbooks_slug UNIQUE (company_id, slug)
      );

      CREATE INDEX IF NOT EXISTS idx_ai_playbooks_lookup ON ai_playbooks(company_id, status, trigger_condition);
    `);

    // 3. Layer 4: Experience Events
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_experience_events (
        id SERIAL PRIMARY KEY,
        conversation_id VARCHAR(200) NOT NULL,
        lead_id INTEGER,
        company_id VARCHAR(100) NOT NULL DEFAULT 'default',
        customer_utterance TEXT NOT NULL,
        intent_detected VARCHAR(100),
        strategy_applied VARCHAR(100),
        playbook_id INTEGER REFERENCES ai_playbooks(id) ON DELETE SET NULL,
        ai_reply TEXT NOT NULL,
        customer_replied BOOLEAN DEFAULT FALSE,
        customer_replied_seconds INTEGER,
        human_intervened BOOLEAN DEFAULT FALSE,
        human_correction_text TEXT,
        feedback_rating VARCHAR(20),
        feedback_category VARCHAR(50),
        funnel_outcome VARCHAR(50) DEFAULT 'in_progress',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ai_experience_conv ON ai_experience_events(company_id, conversation_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_experience_intent ON ai_experience_events(company_id, intent_detected);
      CREATE INDEX IF NOT EXISTS idx_ai_experience_rating ON ai_experience_events(company_id, feedback_rating);
    `);

    // 4. Layer 5: Learning Suggestions
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_learning_suggestions (
        id SERIAL PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL DEFAULT 'default',
        pattern_type VARCHAR(50) NOT NULL,
        situation_summary TEXT NOT NULL,
        suggested_strategy TEXT NOT NULL,
        suggested_cta TEXT,
        suggested_steps JSONB DEFAULT '[]'::jsonb,
        observed_frequency INTEGER DEFAULT 1,
        continuity_impact_pct NUMERIC(5,2) DEFAULT 0.0,
        evidence_data JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        proposed_playbook_id INTEGER REFERENCES ai_playbooks(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ai_learning_status ON ai_learning_suggestions(company_id, status);
    `);
  },
};
