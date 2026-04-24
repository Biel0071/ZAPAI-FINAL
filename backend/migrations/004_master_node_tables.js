const TABLES_DDL_SQL = `
  CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) UNIQUE NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    ip VARCHAR(50) NOT NULL,
    port INTEGER DEFAULT 4025,
    version VARCHAR(50) DEFAULT '1.0.0',
    status VARCHAR(50) DEFAULT 'offline',
    node_type VARCHAR(50) DEFAULT 'worker',
    token VARCHAR(255) UNIQUE,
    last_heartbeat TIMESTAMP,
    last_seen TIMESTAMP,
    cpu_cores INTEGER,
    ram_total INTEGER,
    uptime_seconds BIGINT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_node_id ON nodes(node_id);
  CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
  CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes(last_seen);

  CREATE TABLE IF NOT EXISTS node_logs (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE,
    log_type VARCHAR(50) NOT NULL,
    message TEXT,
    level VARCHAR(20) DEFAULT 'info',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_node_logs_node_id ON node_logs(node_id);
  CREATE INDEX IF NOT EXISTS idx_node_logs_created_at ON node_logs(created_at);

  CREATE TABLE IF NOT EXISTS node_versions (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    deployed_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'deployed',
    rollback_version VARCHAR(50),
    changelog TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_node_versions_node_id ON node_versions(node_id);
  CREATE INDEX IF NOT EXISTS idx_node_versions_deployed_at ON node_versions(deployed_at);
`;

module.exports = {
  up: async (client) => {
    await client.query(TABLES_DDL_SQL);
  },
  down: async (client) => {
    await client.query('DROP TABLE IF EXISTS node_versions CASCADE');
    await client.query('DROP TABLE IF EXISTS node_logs CASCADE');
    await client.query('DROP TABLE IF EXISTS nodes CASCADE');
  }
};
