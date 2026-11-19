'use strict';

module.exports = {
  version: '053_create_attendants_multi_tenant_tables',
  description: 'Create tenant-scoped attendant and assignment tables',
  async up(client) {
    // 1. Digital Attendants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS digital_attendants (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL DEFAULT 'default',
        key VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        role VARCHAR(128),
        status VARCHAR(32) DEFAULT 'active',
        active BOOLEAN DEFAULT true,
        is_platform_assistant BOOLEAN DEFAULT false,
        personality TEXT,
        personality_type VARCHAR(64) DEFAULT 'comercial',
        prompt TEXT,
        ai_provider VARCHAR(64) DEFAULT 'zai',
        ai_model VARCHAR(64) DEFAULT 'qwen2.5:3b',
        temperature NUMERIC(4, 2) DEFAULT 0.70,
        avatar_url TEXT,
        avatar_config JSONB DEFAULT '{}'::jsonb,
        appearance JSONB DEFAULT '{}'::jsonb,
        character JSONB DEFAULT '{}'::jsonb,
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_digital_attendants_company_key UNIQUE(company_id, key),
        CONSTRAINT uq_digital_attendants_company_id UNIQUE(company_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_digital_attendants_company
      ON digital_attendants(company_id);

      CREATE INDEX IF NOT EXISTS idx_digital_attendants_key
      ON digital_attendants(company_id, key);
    `);

    // 2. Store to Attendant Assignment Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS store_attendant_assignments (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL DEFAULT 'default',
        store_id VARCHAR(64) NOT NULL,
        attendant_id VARCHAR(64) NOT NULL,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_store_attendant UNIQUE(company_id, store_id, attendant_id),
        CONSTRAINT fk_store_tenant FOREIGN KEY(company_id, store_id) REFERENCES ai_stores(company_id, id),
        CONSTRAINT fk_store_attendant_tenant FOREIGN KEY(company_id, attendant_id) REFERENCES digital_attendants(company_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_store_attendants_store
      ON store_attendant_assignments(company_id, store_id);

      CREATE INDEX IF NOT EXISTS idx_store_attendants_attendant
      ON store_attendant_assignments(company_id, attendant_id);
    `);

    // 3. Connection to Attendant Assignment Table
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sessions_company_session_unique ON sessions(company_id, session_id);

      CREATE TABLE IF NOT EXISTS connection_attendant_assignments (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL DEFAULT 'default',
        store_id VARCHAR(64),
        session_id VARCHAR(128) NOT NULL,
        attendant_id VARCHAR(64) NOT NULL,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_conn_attendant UNIQUE(company_id, session_id, attendant_id),
        CONSTRAINT fk_conn_attendant_tenant FOREIGN KEY(company_id, attendant_id) REFERENCES digital_attendants(company_id, id),
        CONSTRAINT fk_conn_store_tenant FOREIGN KEY(company_id, store_id) REFERENCES ai_stores(company_id, id),
        CONSTRAINT fk_conn_session_tenant FOREIGN KEY(company_id, session_id) REFERENCES sessions(company_id, session_id)
      );

      CREATE INDEX IF NOT EXISTS idx_conn_attendants_session
      ON connection_attendant_assignments(company_id, session_id);

      CREATE INDEX IF NOT EXISTS idx_conn_attendants_attendant
      ON connection_attendant_assignments(company_id, attendant_id);
    `);

    await client.query(`ALTER TABLE connection_attendant_assignments ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false`);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_digital_attendants_company_id') THEN
          ALTER TABLE digital_attendants ADD CONSTRAINT uq_digital_attendants_company_id UNIQUE(company_id, id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_store_tenant') THEN
          ALTER TABLE store_attendant_assignments ADD CONSTRAINT fk_store_tenant FOREIGN KEY(company_id, store_id) REFERENCES ai_stores(company_id, id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_store_attendant_tenant') THEN
          ALTER TABLE store_attendant_assignments ADD CONSTRAINT fk_store_attendant_tenant FOREIGN KEY(company_id, attendant_id) REFERENCES digital_attendants(company_id, id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_conn_attendant_tenant') THEN
          ALTER TABLE connection_attendant_assignments ADD CONSTRAINT fk_conn_attendant_tenant FOREIGN KEY(company_id, attendant_id) REFERENCES digital_attendants(company_id, id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_conn_store_tenant') THEN
          ALTER TABLE connection_attendant_assignments ADD CONSTRAINT fk_conn_store_tenant FOREIGN KEY(company_id, store_id) REFERENCES ai_stores(company_id, id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_conn_session_tenant') THEN
          ALTER TABLE connection_attendant_assignments ADD CONSTRAINT fk_conn_session_tenant FOREIGN KEY(company_id, session_id) REFERENCES sessions(company_id, session_id);
        END IF;
      END $$;
    `);

    // 4. Quick Replies Multi-level Scoping Columns
    await client.query(`
      ALTER TABLE quick_replies 
      ADD COLUMN IF NOT EXISTS store_id VARCHAR(64);

      ALTER TABLE quick_replies 
      ADD COLUMN IF NOT EXISTS session_id VARCHAR(128);

      ALTER TABLE quick_replies 
      ADD COLUMN IF NOT EXISTS scope_level VARCHAR(32) DEFAULT 'global';

      CREATE INDEX IF NOT EXISTS idx_quick_replies_store
      ON quick_replies(company_id, store_id);

      CREATE INDEX IF NOT EXISTS idx_quick_replies_session
      ON quick_replies(company_id, session_id);
    `);

    // Reconcile existing tenant agent configuration without changing activation or session ownership.
    await client.query(`
      WITH legacy AS (
        SELECT substring(key FROM length('ai_agents_config_v2:') + 1) AS company_id,
               jsonb_array_elements(value::jsonb) AS agent
        FROM system_settings
        WHERE key LIKE 'ai_agents_config_v2:%'
          AND jsonb_typeof(value::jsonb) = 'array'
      )
      INSERT INTO digital_attendants (
        id, company_id, key, name, role, status, active, is_platform_assistant,
        personality, personality_type, prompt, ai_provider, ai_model, temperature,
        avatar_url, avatar_config, appearance, character, settings
      )
      SELECT 'attendant_' || md5(company_id || ':' || COALESCE(agent->>'key', agent->>'name')),
             company_id,
             COALESCE(NULLIF(agent->>'key', ''), lower(regexp_replace(agent->>'name', '\\s+', '-', 'g'))),
             COALESCE(NULLIF(agent->>'name', ''), agent->>'key'),
             agent->>'role',
             COALESCE(NULLIF(agent->>'status', ''), CASE WHEN agent->>'active' = 'false' THEN 'paused' ELSE 'active' END),
             COALESCE(agent->>'active', 'true') <> 'false',
             COALESCE(agent->>'isPlatformAssistant', 'false') = 'true',
             agent->>'personality', agent->>'personalityType', agent->>'prompt',
             agent->>'aiProvider', agent->>'aiModel', COALESCE(NULLIF(agent->>'temperature', '')::numeric, 0.70),
             COALESCE(agent->>'avatar', agent->>'avatarUrl'),
             COALESCE(agent->'avatarConfig', '{}'::jsonb), COALESCE(agent->'appearance', '{}'::jsonb),
             COALESCE(agent->'character', '{}'::jsonb), COALESCE(agent->'settings', '{}'::jsonb)
      FROM legacy
      WHERE COALESCE(NULLIF(agent->>'key', ''), NULLIF(agent->>'name', '')) IS NOT NULL
      ON CONFLICT (company_id, key) DO UPDATE SET
        name = EXCLUDED.name, role = EXCLUDED.role, status = EXCLUDED.status,
        active = EXCLUDED.active, is_platform_assistant = EXCLUDED.is_platform_assistant,
        personality = EXCLUDED.personality, personality_type = EXCLUDED.personality_type,
        prompt = EXCLUDED.prompt, ai_provider = EXCLUDED.ai_provider, ai_model = EXCLUDED.ai_model,
        temperature = EXCLUDED.temperature,
        avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), digital_attendants.avatar_url),
        avatar_config = EXCLUDED.avatar_config, appearance = EXCLUDED.appearance,
        character = EXCLUDED.character, settings = EXCLUDED.settings, updated_at = NOW();

      WITH legacy AS (
        SELECT substring(key FROM length('ai_agents_config_v2:') + 1) AS company_id,
               jsonb_array_elements(value::jsonb) AS agent
        FROM system_settings
        WHERE key LIKE 'ai_agents_config_v2:%'
          AND jsonb_typeof(value::jsonb) = 'array'
      ), linked AS (
        SELECT l.company_id, l.agent->>'key' AS agent_key, trim(session.value) AS session_id,
               l.agent->>'storeId' AS store_id
        FROM legacy l
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(l.agent->'sessionIds', '[]'::jsonb)) session(value)
      )
      INSERT INTO connection_attendant_assignments (id, company_id, session_id, attendant_id, store_id)
      SELECT 'assign_conn_' || md5(linked.company_id || ':' || linked.session_id || ':' || linked.agent_key),
             linked.company_id, linked.session_id, da.id,
             CASE WHEN store.company_id IS NOT NULL THEN linked.store_id ELSE NULL END
      FROM linked
      JOIN digital_attendants da ON da.company_id = linked.company_id AND da.key = linked.agent_key
      JOIN sessions session ON session.company_id = linked.company_id AND session.session_id = linked.session_id
      LEFT JOIN ai_stores store ON store.company_id = linked.company_id AND store.id = linked.store_id
      ON CONFLICT (company_id, session_id, attendant_id) DO NOTHING;

      -- Existing legacy JSON represents one active attendant as principal for each session.
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, session_id ORDER BY attendant_id) AS position
        FROM connection_attendant_assignments
      )
      UPDATE connection_attendant_assignments ca
      SET is_primary = (ranked.position = 1)
      FROM ranked WHERE ranked.id = ca.id;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_connection_one_principal
      ON connection_attendant_assignments(company_id, session_id) WHERE is_primary = true;

      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, store_id ORDER BY attendant_id) AS position
        FROM store_attendant_assignments WHERE is_primary = true
      )
      UPDATE store_attendant_assignments sa
      SET is_primary = false FROM ranked
      WHERE ranked.id = sa.id AND ranked.position > 1;

      WITH legacy AS (
        SELECT substring(key FROM length('ai_agents_config_v2:') + 1) AS company_id,
               jsonb_array_elements(value::jsonb) AS agent
        FROM system_settings
        WHERE key LIKE 'ai_agents_config_v2:%'
          AND jsonb_typeof(value::jsonb) = 'array'
      )
      INSERT INTO store_attendant_assignments (id, company_id, store_id, attendant_id, is_primary)
      SELECT 'assign_store_' || md5(legacy.company_id || ':' || (legacy.agent->>'storeId') || ':' || da.key),
             legacy.company_id, legacy.agent->>'storeId', da.id, true
      FROM legacy
      JOIN digital_attendants da ON da.company_id = legacy.company_id AND da.key = legacy.agent->>'key'
      JOIN ai_stores store ON store.company_id = legacy.company_id AND store.id = legacy.agent->>'storeId'
      ON CONFLICT (company_id, store_id, attendant_id) DO NOTHING;

      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, store_id ORDER BY attendant_id) AS position
        FROM store_attendant_assignments WHERE is_primary = true
      )
      UPDATE store_attendant_assignments sa
      SET is_primary = false FROM ranked
      WHERE ranked.id = sa.id AND ranked.position > 1;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_store_one_principal
      ON store_attendant_assignments(company_id, store_id) WHERE is_primary = true;
    `);
  },

  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_conn_attendants_attendant;
      DROP INDEX IF EXISTS idx_conn_attendants_session;
      DROP INDEX IF EXISTS uq_connection_one_principal;
      DROP TABLE IF EXISTS connection_attendant_assignments;
      DROP INDEX IF EXISTS idx_store_attendants_attendant;
      DROP INDEX IF EXISTS idx_store_attendants_store;
      DROP INDEX IF EXISTS uq_store_one_principal;
      DROP TABLE IF EXISTS store_attendant_assignments;
      DROP INDEX IF EXISTS idx_digital_attendants_key;
      DROP INDEX IF EXISTS idx_digital_attendants_company;
      DROP TABLE IF EXISTS digital_attendants;
      DROP INDEX IF EXISTS sessions_company_session_unique;
    `);
  }
};
