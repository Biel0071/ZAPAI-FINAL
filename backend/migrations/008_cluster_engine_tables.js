const CLUSTER_TABLES_SQL = `
  -- ==========================================================================
  -- 008: CLUSTER ENGINE TABLES
  -- Adds node_metrics, node_deployments, cluster_events, runtime_alerts
  -- ==========================================================================

  -- ── Node Metrics (time-series, separate from heartbeats) ───────────────────
  CREATE TABLE IF NOT EXISTS node_metrics (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(100) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,          -- cpu, ram, disk, network, docker, redis, postgres, sessions, queue
    metric_name VARCHAR(100) NOT NULL,         -- e.g. cpu.usage, ram.used_mb, docker.containers_running
    metric_value NUMERIC NOT NULL DEFAULT 0,
    unit VARCHAR(20) DEFAULT '',               -- percent, mb, count, bytes, ms
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_node_metrics_node_id ON node_metrics(node_id);
  CREATE INDEX IF NOT EXISTS idx_node_metrics_type ON node_metrics(metric_type);
  CREATE INDEX IF NOT EXISTS idx_node_metrics_recorded ON node_metrics(recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_node_metrics_node_type_time ON node_metrics(node_id, metric_type, recorded_at DESC);

  -- ── Node Deployments ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS node_deployments (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    deployment_type VARCHAR(50) NOT NULL DEFAULT 'deploy',   -- deploy, rollback, restart, update_env, rebuild
    git_ref VARCHAR(255),                                     -- branch/tag/commit
    build_hash VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',            -- pending, running, success, failed, rolled_back
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    logs TEXT,
    error_message TEXT,
    triggered_by VARCHAR(100) DEFAULT 'system',               -- system, api, webhook, manual
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_node_deployments_node_id ON node_deployments(node_id);
  CREATE INDEX IF NOT EXISTS idx_node_deployments_status ON node_deployments(status);
  CREATE INDEX IF NOT EXISTS idx_node_deployments_created ON node_deployments(created_at DESC);

  -- ── Cluster Events (audit trail) ──────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS cluster_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,          -- node.registered, node.offline, deploy.started, alert.fired, etc.
    node_id VARCHAR(100),                       -- nullable for cluster-wide events
    severity VARCHAR(20) DEFAULT 'info',        -- info, warning, error, critical
    title VARCHAR(500) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_cluster_events_type ON cluster_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_cluster_events_node_id ON cluster_events(node_id);
  CREATE INDEX IF NOT EXISTS idx_cluster_events_severity ON cluster_events(severity);
  CREATE INDEX IF NOT EXISTS idx_cluster_events_created ON cluster_events(created_at DESC);

  -- ── Runtime Alerts ────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS runtime_alerts (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE SET NULL,
    alert_type VARCHAR(100) NOT NULL,           -- cpu_high, ram_high, disk_full, backend_down, ws_disconnected, deploy_failed
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    title VARCHAR(500) NOT NULL,
    description TEXT,
    threshold_value NUMERIC,
    current_value NUMERIC,
    status VARCHAR(30) DEFAULT 'active',        -- active, acknowledged, resolved
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_runtime_alerts_node_id ON runtime_alerts(node_id);
  CREATE INDEX IF NOT EXISTS idx_runtime_alerts_status ON runtime_alerts(status);
  CREATE INDEX IF NOT EXISTS idx_runtime_alerts_type ON runtime_alerts(alert_type);
  CREATE INDEX IF NOT EXISTS idx_runtime_alerts_created ON runtime_alerts(created_at DESC);

  -- ── Extend nodes table with cluster fields ────────────────────────────────
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS provider VARCHAR(100);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS docker_version VARCHAR(50);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS compose_version VARCHAR(50);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS node_version VARCHAR(50);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS build_hash VARCHAR(64);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS os_info VARCHAR(255);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS kernel VARCHAR(100);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS websocket_status VARCHAR(30) DEFAULT 'disconnected';
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS health_status VARCHAR(30) DEFAULT 'unknown';
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS sessions_active INTEGER DEFAULT 0;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_deploy_at TIMESTAMP;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

  -- ── Cleanup: auto-purge old metrics (keep 7 days) ─────────────────────────
  -- This should be run via cron or pg_cron, not inline. Just an index to help.
  CREATE INDEX IF NOT EXISTS idx_node_metrics_cleanup ON node_metrics(recorded_at) WHERE recorded_at < NOW() - INTERVAL '7 days';
  CREATE INDEX IF NOT EXISTS idx_heartbeats_cleanup ON heartbeats(received_at) WHERE received_at < NOW() - INTERVAL '7 days';
`;

module.exports = {
  version: '008_cluster_engine_tables',
  description: 'Add node_metrics, node_deployments, cluster_events, runtime_alerts tables for distributed cluster engine',
  up: async (client) => {
    await client.query(CLUSTER_TABLES_SQL);
  },
  down: async () => {},
};
