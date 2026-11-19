'use strict';

module.exports = {
  version: '059_ai_agent_enterprise_transformation',
  description: 'Add canonical agent config columns, encrypted scoped provider credentials, model router policy, memory/evolution lifecycle, and tenant isolation indexes',
  async up(client) {
    // 1. Canonical AgentConfiguration columns on digital_attendants
    await client.query(`
      ALTER TABLE digital_attendants
        ADD COLUMN IF NOT EXISTS whatsapp_connection_id VARCHAR(120),
        ADD COLUMN IF NOT EXISTS personality_preset VARCHAR(64) DEFAULT 'consultivo_amigavel',
        ADD COLUMN IF NOT EXISTS objective VARCHAR(64) DEFAULT 'fechamento',
        ADD COLUMN IF NOT EXISTS tone VARCHAR(64) DEFAULT 'acolhedor',
        ADD COLUMN IF NOT EXISTS response_style VARCHAR(64) DEFAULT 'balanced',
        ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 600,
        ADD COLUMN IF NOT EXISTS routing_mode VARCHAR(32) DEFAULT 'AUTO',
        ADD COLUMN IF NOT EXISTS system_prompt_version INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS knowledge_configuration JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS updated_by VARCHAR(120);
    `);

    // 2. Extend ai_agent_versions for full config audit & rollback
    await client.query(`
      ALTER TABLE ai_agent_versions
        ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS change_scope VARCHAR(32) DEFAULT 'configuration',
        ADD COLUMN IF NOT EXISTS created_by VARCHAR(120);

      CREATE INDEX IF NOT EXISTS idx_ai_agent_versions_lookup
        ON ai_agent_versions(company_id, agent_key, created_at DESC);
    `);

    // 3. Scoped encrypted AI provider credentials vault + audit log + router policies
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_provider_credentials (
        id BIGSERIAL PRIMARY KEY,
        scope VARCHAR(20) NOT NULL CHECK (scope IN ('master', 'company', 'agent')),
        company_id VARCHAR(100) NOT NULL DEFAULT 'default',
        agent_key VARCHAR(100) NOT NULL DEFAULT '',
        provider_id VARCHAR(50) NOT NULL,
        label VARCHAR(120),
        encrypted_key TEXT NOT NULL,
        key_hint VARCHAR(32) NOT NULL,
        default_model VARCHAR(120),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        health_status VARCHAR(24) DEFAULT 'unknown',
        last_tested_at TIMESTAMPTZ,
        last_latency_ms INTEGER,
        last_error TEXT,
        last_used_at TIMESTAMPTZ,
        created_by VARCHAR(120),
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_ai_provider_credentials_scope UNIQUE (scope, company_id, agent_key, provider_id)
      );

      CREATE INDEX IF NOT EXISTS idx_ai_provider_creds_lookup
        ON ai_provider_credentials(company_id, scope, provider_id, enabled);

      CREATE TABLE IF NOT EXISTS ai_credential_audit_log (
        id BIGSERIAL PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL,
        scope VARCHAR(20) NOT NULL,
        agent_key VARCHAR(100),
        provider_id VARCHAR(50) NOT NULL,
        action VARCHAR(32) NOT NULL,
        actor_id VARCHAR(80),
        actor_name VARCHAR(120),
        detail JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ai_cred_audit_company
        ON ai_credential_audit_log(company_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS ai_router_policies (
        company_id VARCHAR(100) PRIMARY KEY,
        default_mode VARCHAR(32) NOT NULL DEFAULT 'AUTO',
        fallback_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        zai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        daily_zai_limit INTEGER DEFAULT 200,
        preferred_providers JSONB DEFAULT '["zai","groq","openai","gemini","openrouter"]'::jsonb,
        updated_by VARCHAR(120),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Semantic memory hardening on agent_memory_nodes
    await client.query(`
      ALTER TABLE agent_memory_nodes
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS memory_scope VARCHAR(24) DEFAULT 'agent',
        ADD COLUMN IF NOT EXISTS category VARCHAR(40),
        ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2) DEFAULT 0.80,
        ADD COLUMN IF NOT EXISTS occurrences INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS status VARCHAR(24) DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS provenance JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    await client.query(`
      UPDATE agent_memory_nodes
      SET
        category = CASE
          WHEN category IS NOT NULL AND category <> '' THEN category
          WHEN node_type = 'preference' THEN 'preferences'
          WHEN node_type IN ('product', 'product_media') THEN 'products'
          WHEN node_type = 'objection' THEN 'objections'
          WHEN node_type IN ('evolution_insight', 'topic', 'intent', 'city', 'habit', 'concept') THEN 'insights'
          ELSE category
        END,
        session_id = COALESCE(NULLIF(session_id, ''), NULLIF(properties->>'sessionId', '')),
        status = COALESCE(NULLIF(status, ''), 'active'),
        occurrences = GREATEST(1, COALESCE(occurrences, ROUND(COALESCE(weight, 1))::integer))
      WHERE node_type NOT IN ('conversation', 'contact')
        AND (category IS NULL OR category = '' OR status IS NULL);

      CREATE INDEX IF NOT EXISTS idx_agent_memory_nodes_semantic_active
        ON agent_memory_nodes(company_id, agent_key, category, last_seen_at DESC)
        WHERE node_type NOT IN ('conversation', 'contact');
    `);

    // 5. Controlled evolution lifecycle columns on ai_learning_suggestions
    await client.query(`
      ALTER TABLE ai_learning_suggestions
        ADD COLUMN IF NOT EXISTS agent_key VARCHAR(100),
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS stage VARCHAR(32) DEFAULT 'pending_approval',
        ADD COLUMN IF NOT EXISTS before_behavior TEXT,
        ADD COLUMN IF NOT EXISTS after_behavior TEXT,
        ADD COLUMN IF NOT EXISTS evidence_items JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS impact_metrics JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS applied_version_id BIGINT,
        ADD COLUMN IF NOT EXISTS approved_by VARCHAR(120),
        ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ;

      UPDATE ai_learning_suggestions
      SET stage = CASE
        WHEN status = 'approved' THEN 'applied'
        WHEN status = 'rejected' THEN 'rejected'
        ELSE 'pending_approval'
      END
      WHERE stage IS NULL OR stage = '';

      CREATE INDEX IF NOT EXISTS idx_ai_learning_stage
        ON ai_learning_suggestions(company_id, stage, updated_at DESC);
    `);

    // 6. Telemetry & explainability columns on ai_logs + company_id backfill
    await client.query(`
      ALTER TABLE ai_logs
        ADD COLUMN IF NOT EXISTS company_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS agent_key VARCHAR(100),
        ADD COLUMN IF NOT EXISTS routing_mode VARCHAR(32),
        ADD COLUMN IF NOT EXISTS credential_scope VARCHAR(24),
        ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
        ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12,6),
        ADD COLUMN IF NOT EXISTS effective_config JSONB DEFAULT '{}'::jsonb;

      UPDATE ai_logs l
      SET company_id = c.company_id
      FROM conversations c
      WHERE l.company_id IS NULL
        AND l.conversation_id = c.id::text;

      CREATE INDEX IF NOT EXISTS idx_ai_logs_company_ts
        ON ai_logs(company_id, timestamp DESC);
    `);

    // 7. Tenant isolation constraints on ai_context & ai_memory_long
    await client.query(`
      UPDATE ai_context
      SET company_id = 'default'
      WHERE company_id IS NULL OR company_id = '';

      DELETE FROM ai_context a
      USING ai_context b
      WHERE a.id < b.id
        AND a.company_id = b.company_id
        AND a.chat_id = b.chat_id;

      ALTER TABLE ai_context DROP CONSTRAINT IF EXISTS ai_context_chat_id_key;
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_ai_context_company_chat'
        ) THEN
          ALTER TABLE ai_context
            ADD CONSTRAINT uq_ai_context_company_chat UNIQUE (company_id, chat_id);
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_ai_memory_long_tenant_scope
        ON ai_memory_long(company_id, session_id, chat_id);
    `);
  },

  async down(client) {
    await client.query(`DROP INDEX IF EXISTS idx_ai_memory_long_tenant_scope;`);
    await client.query(`ALTER TABLE ai_context DROP CONSTRAINT IF EXISTS uq_ai_context_company_chat;`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ai_context_chat_id_key'
        ) THEN
          ALTER TABLE ai_context ADD CONSTRAINT ai_context_chat_id_key UNIQUE (chat_id);
        END IF;
      END $$;
    `).catch(() => {});

    await client.query(`DROP INDEX IF EXISTS idx_ai_logs_company_ts;`);
    await client.query(`
      ALTER TABLE ai_logs
        DROP COLUMN IF EXISTS effective_config,
        DROP COLUMN IF EXISTS estimated_cost_usd,
        DROP COLUMN IF EXISTS latency_ms,
        DROP COLUMN IF EXISTS credential_scope,
        DROP COLUMN IF EXISTS routing_mode,
        DROP COLUMN IF EXISTS agent_key,
        DROP COLUMN IF EXISTS company_id;
    `);

    await client.query(`DROP INDEX IF EXISTS idx_ai_learning_stage;`);
    await client.query(`
      ALTER TABLE ai_learning_suggestions
        DROP COLUMN IF EXISTS rolled_back_at,
        DROP COLUMN IF EXISTS approved_at,
        DROP COLUMN IF EXISTS approved_by,
        DROP COLUMN IF EXISTS applied_version_id,
        DROP COLUMN IF EXISTS impact_metrics,
        DROP COLUMN IF EXISTS evidence_items,
        DROP COLUMN IF EXISTS after_behavior,
        DROP COLUMN IF EXISTS before_behavior,
        DROP COLUMN IF EXISTS stage,
        DROP COLUMN IF EXISTS session_id,
        DROP COLUMN IF EXISTS agent_key;
    `);

    await client.query(`DROP INDEX IF EXISTS idx_agent_memory_nodes_semantic_active;`);
    await client.query(`
      ALTER TABLE agent_memory_nodes
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS provenance,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS occurrences,
        DROP COLUMN IF EXISTS confidence,
        DROP COLUMN IF EXISTS category,
        DROP COLUMN IF EXISTS memory_scope,
        DROP COLUMN IF EXISTS session_id;
    `);

    await client.query(`DROP TABLE IF EXISTS ai_router_policies;`);
    await client.query(`DROP TABLE IF EXISTS ai_credential_audit_log;`);
    await client.query(`DROP TABLE IF EXISTS ai_provider_credentials;`);

    await client.query(`DROP INDEX IF EXISTS idx_ai_agent_versions_lookup;`);
    await client.query(`
      ALTER TABLE ai_agent_versions
        DROP COLUMN IF EXISTS created_by,
        DROP COLUMN IF EXISTS change_scope,
        DROP COLUMN IF EXISTS version_number;
    `);

    await client.query(`
      ALTER TABLE digital_attendants
        DROP COLUMN IF EXISTS updated_by,
        DROP COLUMN IF EXISTS enabled_features,
        DROP COLUMN IF EXISTS knowledge_configuration,
        DROP COLUMN IF EXISTS system_prompt_version,
        DROP COLUMN IF EXISTS routing_mode,
        DROP COLUMN IF EXISTS max_tokens,
        DROP COLUMN IF EXISTS response_style,
        DROP COLUMN IF EXISTS tone,
        DROP COLUMN IF EXISTS objective,
        DROP COLUMN IF EXISTS personality_preset,
        DROP COLUMN IF EXISTS whatsapp_connection_id;
    `);
  },
};
