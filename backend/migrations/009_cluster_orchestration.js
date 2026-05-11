const CONSOLIDATED_CLUSTER_TABLES_SQL = `
  -- ── Nodes ────────────────────────────────────────────────────────────────
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
    provider VARCHAR(100),
    docker_version VARCHAR(50),
    compose_version VARCHAR(50),
    node_version VARCHAR(50),
    build_hash VARCHAR(64),
    os_info VARCHAR(255),
    kernel VARCHAR(100),
    websocket_status VARCHAR(30) DEFAULT 'disconnected',
    health_status VARCHAR(30) DEFAULT 'unknown',
    sessions_active INTEGER DEFAULT 0,
    last_deploy_at TIMESTAMP,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_node_id ON nodes(node_id);
  CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);

  -- ── Node Metrics ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS node_metrics (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(100) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL DEFAULT 0,
    unit VARCHAR(20) DEFAULT '',
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_node_metrics_node_id ON node_metrics(node_id);
  CREATE INDEX IF NOT EXISTS idx_node_metrics_recorded ON node_metrics(recorded_at DESC);

  -- ── Heartbeats ───────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS heartbeats (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(100) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'online',
    cpu_usage NUMERIC,
    ram_usage NUMERIC,
    disk_usage NUMERIC,
    uptime_seconds BIGINT,
    active_sessions INTEGER DEFAULT 0,
    ws_connected BOOLEAN DEFAULT false,
    payload JSONB DEFAULT '{}'::jsonb,
    received_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_heartbeats_node_id ON heartbeats(node_id);
  CREATE INDEX IF NOT EXISTS idx_heartbeats_received ON heartbeats(received_at DESC);

  -- ── Deployments ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS deployments (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    deployment_type VARCHAR(50) NOT NULL DEFAULT 'deploy',
    git_ref VARCHAR(255),
    build_hash VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    triggered_by VARCHAR(100) DEFAULT 'system',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_deployments_node_id ON deployments(node_id);
  CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);

  -- ── Deployment Logs ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS deployment_logs (
    id BIGSERIAL PRIMARY KEY,
    deployment_id INTEGER NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    log_level VARCHAR(20) DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_deployment_logs_dep_id ON deployment_logs(deployment_id);

  -- ── Websocket Sessions ───────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS websocket_sessions (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE SET NULL,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    user_id VARCHAR(100),
    client_ip VARCHAR(50),
    user_agent TEXT,
    connected_at TIMESTAMP DEFAULT NOW(),
    last_ping_at TIMESTAMP,
    disconnected_at TIMESTAMP,
    status VARCHAR(30) DEFAULT 'connected',
    metadata JSONB DEFAULT '{}'::jsonb
  );

  CREATE INDEX IF NOT EXISTS idx_ws_sessions_node ON websocket_sessions(node_id);
  CREATE INDEX IF NOT EXISTS idx_ws_sessions_status ON websocket_sessions(status);

  -- ── Runtime Health ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS runtime_health (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE,
    component VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'healthy', -- healthy, degraded, down
    message TEXT,
    last_check_at TIMESTAMP DEFAULT NOW(),
    error_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
  );

  CREATE INDEX IF NOT EXISTS idx_runtime_health_node ON runtime_health(node_id);
  CREATE INDEX IF NOT EXISTS idx_runtime_health_comp ON runtime_health(component);
`;

module.exports = {
  version: '009_cluster_orchestration',
  description: 'Consolidate cluster SaaS tables: nodes, node_metrics, heartbeats, deployments, deployment_logs, websocket_sessions, runtime_health',
  up: async (client) => {
    await client.query(CONSOLIDATED_CLUSTER_TABLES_SQL);
  },
  down: async () => {},
};
