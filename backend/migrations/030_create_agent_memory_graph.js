module.exports = {
  version: '030_create_agent_memory_graph',
  description: 'Create tenant-scoped evolutionary memory graph for AI agents',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_memory_nodes (
        id BIGSERIAL PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL DEFAULT 'default',
        agent_key VARCHAR(100) NOT NULL,
        node_key VARCHAR(255) NOT NULL,
        node_type VARCHAR(40) NOT NULL,
        label VARCHAR(255) NOT NULL,
        content TEXT,
        searchable_text TEXT NOT NULL DEFAULT '',
        properties JSONB NOT NULL DEFAULT '{}'::jsonb,
        weight DOUBLE PRECISION NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (company_id, agent_key, node_key)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_memory_edges (
        id BIGSERIAL PRIMARY KEY,
        company_id VARCHAR(100) NOT NULL DEFAULT 'default',
        agent_key VARCHAR(100) NOT NULL,
        source_key VARCHAR(255) NOT NULL,
        target_key VARCHAR(255) NOT NULL,
        relation VARCHAR(60) NOT NULL,
        weight DOUBLE PRECISION NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (company_id, agent_key, source_key, target_key, relation)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_memory_nodes_scope ON agent_memory_nodes(company_id, agent_key, node_type, last_seen_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_memory_nodes_search ON agent_memory_nodes USING GIN(to_tsvector('simple', searchable_text))`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_agent_memory_edges_scope ON agent_memory_edges(company_id, agent_key, last_seen_at DESC)`);
  },
};
