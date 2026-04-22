const TABLES_DDL_SQL = `
  CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    company_id TEXT DEFAULT 'default',
    session_id VARCHAR(100) UNIQUE,
    session_name VARCHAR(100) UNIQUE,
    status VARCHAR(50),
    phone_number VARCHAR(30),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    company_id TEXT DEFAULT 'default',
    phone VARCHAR(30),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (company_id, phone)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    company_id TEXT DEFAULT 'default',
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    session_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'open',
    lead_temperature VARCHAR(50) DEFAULT 'cold',
    funnel_stage VARCHAR(100) DEFAULT 'new_lead',
    agent_name VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    summary TEXT,
    last_message TEXT,
    last_message_type VARCHAR(50) DEFAULT 'text',
    ai_enabled BOOLEAN DEFAULT TRUE,
    lead_intent VARCHAR(100) DEFAULT 'information',
    lead_confidence NUMERIC DEFAULT 0,
    next_action VARCHAR(100) DEFAULT 'educate',
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    phone VARCHAR(30),
    text TEXT,
    direction VARCHAR(10),
    sender VARCHAR(20),
    type VARCHAR(50) DEFAULT 'text',
    content TEXT,
    media_url TEXT,
    timestamp TIMESTAMP DEFAULT NOW(),
    status VARCHAR(30),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(120) PRIMARY KEY,
    company_id TEXT DEFAULT 'default',
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    selected_contacts JSONB DEFAULT '[]'::jsonb,
    messages JSONB DEFAULT '[]'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    queue JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS flows (
    id VARCHAR(120) PRIMARY KEY,
    company_id TEXT DEFAULT 'default',
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    trigger TEXT,
    response TEXT,
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    rules JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS flow_nodes (
    id SERIAL PRIMARY KEY,
    flow_id VARCHAR(120) REFERENCES flows(id) ON DELETE CASCADE,
    node_id VARCHAR(120) NOT NULL,
    type VARCHAR(50) NOT NULL,
    label TEXT,
    position JSONB DEFAULT '{}'::jsonb,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
  );
`;

const ALTER_COLUMNS_SQL = `
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_name VARCHAR(100);
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS status VARCHAR(50);
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

  ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS name VARCHAR(255);
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE;
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'open';
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_temperature VARCHAR(50) DEFAULT 'cold';
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS funnel_stage VARCHAR(100) DEFAULT 'new_lead';
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS agent_name VARCHAR(255);
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary TEXT;
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_type VARCHAR(50) DEFAULT 'text';
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT TRUE;
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_intent VARCHAR(100) DEFAULT 'information';
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_confidence NUMERIC DEFAULT 0;
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS next_action VARCHAR(100) DEFAULT 'educate';
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

  ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE;
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS text TEXT;
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS direction VARCHAR(10);
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender VARCHAR(20);
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'text';
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS content TEXT;
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(50) DEFAULT 'text';
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_path TEXT;
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT NOW();
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_me BOOLEAN DEFAULT FALSE;
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS status VARCHAR(30);
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
  ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

  ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS value TEXT;
  ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS name VARCHAR(255);
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft';
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS selected_contacts JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS queue JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL;
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

  ALTER TABLE flows ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'default';
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS name VARCHAR(255);
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS trigger TEXT;
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS response TEXT;
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS nodes JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS edges JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  ALTER TABLE flows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

  ALTER TABLE flow_nodes ADD COLUMN IF NOT EXISTS flow_id VARCHAR(120);
  ALTER TABLE flow_nodes ADD COLUMN IF NOT EXISTS node_id VARCHAR(120);
  ALTER TABLE flow_nodes ADD COLUMN IF NOT EXISTS type VARCHAR(50);
  ALTER TABLE flow_nodes ADD COLUMN IF NOT EXISTS label TEXT;
  ALTER TABLE flow_nodes ADD COLUMN IF NOT EXISTS position JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE flow_nodes ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE flow_nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
`;

const DATA_FIXES_SQL = `
  DO $$
  BEGIN
    IF to_regclass('public.contacts') IS NOT NULL THEN
      INSERT INTO leads (id, company_id, phone, name, created_at)
      SELECT c.id, COALESCE(c.company_id, 'default'), c.phone, c.name, COALESCE(c.created_at, NOW())
      FROM contacts c
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END $$;

  UPDATE sessions
  SET session_id = COALESCE(session_id, session_name),
      session_name = COALESCE(session_name, session_id)
  WHERE session_id IS NULL OR session_name IS NULL;

  UPDATE messages
  SET text = COALESCE(text, content),
      content = COALESCE(content, text),
      company_id = COALESCE(company_id, 'default'),
      created_at = COALESCE(created_at, timestamp, NOW()),
      media_type = COALESCE(media_type, type, 'text'),
      media_path = COALESCE(media_path, media_url),
      direction = COALESCE(
        direction,
        CASE
          WHEN sender = 'agent' THEN 'outgoing'
          ELSE 'incoming'
        END
      ),
      from_me = COALESCE(
        from_me,
        CASE
          WHEN sender = 'agent' THEN TRUE
          ELSE FALSE
        END
      )
  WHERE text IS NULL
    OR content IS NULL
    OR company_id IS NULL
    OR direction IS NULL
    OR created_at IS NULL
    OR media_type IS NULL
    OR media_path IS NULL
    OR from_me IS NULL;

  UPDATE messages AS m
  SET session_id = COALESCE(m.session_id, conv.session_id)
  FROM conversations AS conv
  WHERE m.conversation_id = conv.id
    AND m.session_id IS NULL;

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'conversations'
        AND column_name = 'contact_id'
    ) THEN
      EXECUTE 'UPDATE conversations SET lead_id = contact_id WHERE lead_id IS NULL';
    END IF;
  END $$;

  UPDATE messages AS m
  SET phone = l.phone
  FROM conversations AS conv
  INNER JOIN leads AS l ON l.id = conv.lead_id
  WHERE m.conversation_id = conv.id
    AND m.phone IS NULL;
`;

const INDEXES_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_name ON sessions(session_name);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_company_phone ON leads(company_id, phone);
  CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
  CREATE INDEX IF NOT EXISTS idx_conversations_lead_id ON conversations(lead_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
  CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  CREATE INDEX IF NOT EXISTS idx_campaigns_company_created_at ON campaigns(company_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_flows_company_created_at ON flows(company_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow_id ON flow_nodes(flow_id);
`;

async function syncSequence(client, tableName, columnName = 'id') {
  await client.query(
    `
      SELECT setval(
        pg_get_serial_sequence($1, $2),
        COALESCE((SELECT MAX(id) FROM ${tableName}), 1),
        true
      )
    `,
    [tableName, columnName]
  );
}

module.exports = {
  version: '001_initial_schema',
  description: 'Create CRM schema and baseline data/index migrations.',
  up: async (client) => {
    await client.query(TABLES_DDL_SQL);
    await client.query(ALTER_COLUMNS_SQL);
    await client.query(DATA_FIXES_SQL);
    await client.query(INDEXES_SQL);

    await syncSequence(client, 'sessions');
    await syncSequence(client, 'leads');
    await syncSequence(client, 'conversations');
    await syncSequence(client, 'messages');
    await syncSequence(client, 'flow_nodes');

    await client.query(
      `
        INSERT INTO system_settings (key, value, updated_at)
        VALUES ('ai_enabled', 'false', NOW())
        ON CONFLICT (key) DO NOTHING
      `
    );
  },
};
