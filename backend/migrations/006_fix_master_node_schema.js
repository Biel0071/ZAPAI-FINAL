const MASTER_NODE_COMPAT_SQL = `
  CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS name VARCHAR(255);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS hostname VARCHAR(255);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS ip VARCHAR(50);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS api_port INTEGER DEFAULT 4025;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS port INTEGER DEFAULT 4025;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS version VARCHAR(50) DEFAULT '1.0.0';
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'offline';
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS node_type VARCHAR(50) DEFAULT 'worker';
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS token VARCHAR(255);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS cpu_cores INTEGER;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS ram_total INTEGER;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS disk_total INTEGER;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS uptime_seconds BIGINT;
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS region VARCHAR(100);
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  ALTER TABLE nodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

  UPDATE nodes
     SET name = COALESCE(NULLIF(name, ''), NULLIF(hostname, ''), node_id),
         hostname = COALESCE(NULLIF(hostname, ''), NULLIF(name, ''), node_id),
         ip_address = COALESCE(NULLIF(ip_address, ''), NULLIF(ip, ''), '0.0.0.0'),
         ip = COALESCE(NULLIF(ip, ''), NULLIF(ip_address, ''), '0.0.0.0'),
         api_port = COALESCE(api_port, port, 4025),
         port = COALESCE(port, api_port, 4025),
         status = COALESCE(NULLIF(status, ''), 'offline'),
         version = COALESCE(NULLIF(version, ''), '1.0.0'),
         node_type = COALESCE(NULLIF(node_type, ''), 'worker'),
         created_at = COALESCE(created_at, NOW()),
         updated_at = NOW();

  ALTER TABLE nodes ALTER COLUMN name SET DEFAULT 'unknown';
  ALTER TABLE nodes ALTER COLUMN hostname SET DEFAULT 'unknown';
  ALTER TABLE nodes ALTER COLUMN ip_address SET DEFAULT '0.0.0.0';
  ALTER TABLE nodes ALTER COLUMN ip SET DEFAULT '0.0.0.0';
  ALTER TABLE nodes ALTER COLUMN api_port SET DEFAULT 4025;
  ALTER TABLE nodes ALTER COLUMN port SET DEFAULT 4025;
  ALTER TABLE nodes ALTER COLUMN status SET DEFAULT 'offline';
  ALTER TABLE nodes ALTER COLUMN version SET DEFAULT '1.0.0';
  ALTER TABLE nodes ALTER COLUMN node_type SET DEFAULT 'worker';

  CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_node_id ON nodes(node_id);
  CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
  CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes(last_seen DESC);
  CREATE INDEX IF NOT EXISTS idx_nodes_ip_address ON nodes(ip_address);
  CREATE INDEX IF NOT EXISTS idx_nodes_ip ON nodes(ip);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_token_unique ON nodes(token) WHERE token IS NOT NULL AND token <> '';

  CREATE TABLE IF NOT EXISTS heartbeats (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    cpu_usage NUMERIC DEFAULT 0,
    memory_usage NUMERIC DEFAULT 0,
    disk_usage NUMERIC DEFAULT 0,
    uptime_seconds BIGINT DEFAULT 0,
    active_sessions INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    whatsapp_connected BOOLEAN DEFAULT FALSE,
    messages_today INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS cpu_usage NUMERIC DEFAULT 0;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS memory_usage NUMERIC DEFAULT 0;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS disk_usage NUMERIC DEFAULT 0;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS uptime_seconds BIGINT DEFAULT 0;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS active_sessions INTEGER DEFAULT 0;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT FALSE;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS messages_today INTEGER DEFAULT 0;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS errors_count INTEGER DEFAULT 0;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS received_at TIMESTAMP DEFAULT NOW();
  ALTER TABLE heartbeats ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS idx_heartbeats_node_id ON heartbeats(node_id);
  CREATE INDEX IF NOT EXISTS idx_heartbeats_received_at ON heartbeats(received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_heartbeats_node_received_at ON heartbeats(node_id, received_at DESC);

  CREATE TABLE IF NOT EXISTS remote_commands (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    command_type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    requested_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS command_type VARCHAR(100);
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS result JSONB;
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS error_message TEXT;
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT NOW();
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  ALTER TABLE remote_commands ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

  UPDATE remote_commands
     SET command_type = COALESCE(NULLIF(command_type, ''), 'unknown'),
         status = COALESCE(NULLIF(status, ''), 'pending'),
         payload = COALESCE(payload, '{}'::jsonb),
         requested_at = COALESCE(requested_at, created_at, NOW()),
         created_at = COALESCE(created_at, NOW()),
         updated_at = NOW();

  ALTER TABLE remote_commands ALTER COLUMN command_type SET NOT NULL;
  ALTER TABLE remote_commands ALTER COLUMN status SET DEFAULT 'pending';
  ALTER TABLE remote_commands ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

  CREATE INDEX IF NOT EXISTS idx_remote_commands_node_id ON remote_commands(node_id);
  CREATE INDEX IF NOT EXISTS idx_remote_commands_status ON remote_commands(status);
  CREATE INDEX IF NOT EXISTS idx_remote_commands_requested_at ON remote_commands(requested_at DESC);
  CREATE INDEX IF NOT EXISTS idx_remote_commands_node_status ON remote_commands(node_id, status);
`;

module.exports = {
  version: '006_fix_master_node_schema',
  description: 'Align master/node database schema with active nodeMaster and adminMaster routes',
  up: async (client) => {
    await client.query(MASTER_NODE_COMPAT_SQL);
  },
  down: async () => {},
};
