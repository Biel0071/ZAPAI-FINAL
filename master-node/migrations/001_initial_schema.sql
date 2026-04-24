-- ============================================================================
-- MASTER NODE SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- Zero mock. Tudo produção real.
-- ============================================================================

-- Nodes (VPS instaladas)
CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    domain VARCHAR(255),
    api_port INTEGER DEFAULT 4025,
    status VARCHAR(50) DEFAULT 'pending', -- pending, online, offline, error
    token VARCHAR(500) NOT NULL,
    version VARCHAR(50),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_nodes_node_id ON nodes(node_id);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_last_heartbeat ON nodes(last_heartbeat);

-- Heartbeats
CREATE TABLE IF NOT EXISTS heartbeats (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    uptime_seconds BIGINT,
    active_sessions INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    whatsapp_connected BOOLEAN DEFAULT false,
    messages_today INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_heartbeats_node_id ON heartbeats(node_id);
CREATE INDEX idx_heartbeats_received_at ON heartbeats(received_at);

-- Remote Commands
CREATE TABLE IF NOT EXISTS remote_commands (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    command_type VARCHAR(50) NOT NULL, -- restart, update, rebuild, disconnect_whatsapp, backup, clear_cache
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, executing, completed, failed
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_remote_commands_node_id ON remote_commands(node_id);
CREATE INDEX idx_remote_commands_status ON remote_commands(status);
CREATE INDEX idx_remote_commands_created_at ON remote_commands(created_at);

-- Node Logs
CREATE TABLE IF NOT EXISTS node_logs (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL, -- info, warning, error, critical
    service VARCHAR(100),
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_node_logs_node_id ON node_logs(node_id);
CREATE INDEX idx_node_logs_level ON node_logs(level);
CREATE INDEX idx_node_logs_created_at ON node_logs(created_at);

-- WhatsApp Sessions
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    session_name VARCHAR(255),
    phone_number VARCHAR(50),
    status VARCHAR(50), -- connecting, connected, disconnected, error
    qr_code TEXT,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(node_id, session_id)
);

CREATE INDEX idx_whatsapp_sessions_node_id ON whatsapp_sessions(node_id);
CREATE INDEX idx_whatsapp_sessions_status ON whatsapp_sessions(status);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    backup_type VARCHAR(50) NOT NULL, -- full, database, sessions, media
    file_path TEXT,
    file_size BIGINT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_backups_node_id ON backups(node_id);
CREATE INDEX idx_backups_status ON backups(status);

-- Deployments/Rollbacks
CREATE TABLE IF NOT EXISTS deployments (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    commit_hash VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- pending, deploying, success, failed, rolled_back
    rollback_to_version VARCHAR(50),
    deployment_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_deployments_node_id ON deployments(node_id);
CREATE INDEX idx_deployments_status ON deployments(status);

-- Metrics Aggregation (daily)
CREATE TABLE IF NOT EXISTS daily_metrics (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    avg_cpu_usage DECIMAL(5,2),
    avg_memory_usage DECIMAL(5,2),
    avg_disk_usage DECIMAL(5,2),
    total_messages INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    uptime_seconds BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(node_id, date)
);

CREATE INDEX idx_daily_metrics_node_id ON daily_metrics(node_id);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_sessions_updated_at BEFORE UPDATE ON whatsapp_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
