module.exports = {
  version: '026_create_agent_learning_tables',
  description: 'Create agent_learning_events and agent_evolution_log tables for progressive AI agent learning',
  up: async (client) => {
    // 1. Create agent_learning_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_learning_events (
        id SERIAL PRIMARY KEY,
        agent_key VARCHAR(100) NOT NULL,
        company_id VARCHAR(100) DEFAULT 'default',
        event_type VARCHAR(50) NOT NULL,
        customer_question TEXT NOT NULL,
        ai_response TEXT,
        human_answer TEXT,
        contact_phone VARCHAR(50),
        contact_name VARCHAR(255),
        conversation_id VARCHAR(200),
        status VARCHAR(30) DEFAULT 'pending',
        applied_to_field VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );
    `);

    // Indexes for agent_learning_events
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_learning_agent ON agent_learning_events(agent_key, status);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_learning_created ON agent_learning_events(created_at DESC);
    `);

    // 2. Create agent_evolution_log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_evolution_log (
        id SERIAL PRIMARY KEY,
        agent_key VARCHAR(100) NOT NULL,
        company_id VARCHAR(100) DEFAULT 'default',
        change_type VARCHAR(50) NOT NULL,
        source_description TEXT,
        fields_changed JSONB,
        applied_by VARCHAR(100) DEFAULT 'owner',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Indexes for agent_evolution_log
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_evolution_agent ON agent_evolution_log(agent_key, created_at DESC);
    `);
  },
};
