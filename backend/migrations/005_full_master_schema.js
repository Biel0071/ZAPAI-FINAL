const TABLES_DDL_SQL = `
  -- Users table (Master admin users)
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  -- Nodes table (Worker VPS registration)
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
    disk_total INTEGER,
    uptime_seconds BIGINT,
    region VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_nodes_node_id ON nodes(node_id);
  CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
  CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON nodes(last_seen);
  CREATE INDEX IF NOT EXISTS idx_nodes_ip ON nodes(ip);

  -- Node stats table (Historical metrics)
  CREATE TABLE IF NOT EXISTS node_stats (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE,
    cpu_usage NUMERIC,
    ram_used INTEGER,
    ram_free INTEGER,
    disk_used INTEGER,
    disk_free INTEGER,
    active_connections INTEGER,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    uptime_seconds BIGINT,
    timestamp TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_node_stats_node_id ON node_stats(node_id);
  CREATE INDEX IF NOT EXISTS idx_node_stats_timestamp ON node_stats(timestamp);

  -- WhatsApp sessions table
  CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(30),
    status VARCHAR(50) DEFAULT 'disconnected',
    qr_code TEXT,
    last_message TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_node_id ON whatsapp_sessions(node_id);
  CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_session_id ON whatsapp_sessions(session_id);
  CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON whatsapp_sessions(status);

  -- Clients table (Customer management)
  CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    company_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_clients_node_id ON clients(node_id);
  CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

  -- Deployments table (Deployment tracking)
  CREATE TABLE IF NOT EXISTS deployments (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    deployed_at TIMESTAMP,
    completed_at TIMESTAMP,
    rollback_version VARCHAR(50),
    changelog TEXT,
    error_message TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_deployments_node_id ON deployments(node_id);
  CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
  CREATE INDEX IF NOT EXISTS idx_deployments_deployed_at ON deployments(deployed_at);

  -- Messages table (Message tracking across nodes)
  -- This table may already exist from migration 001 (without node_id).
  -- We ensure node_id exists before creating the index.
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE,
    session_id VARCHAR(100),
    phone VARCHAR(30) NOT NULL,
    message_text TEXT,
    direction VARCHAR(20),
    message_type VARCHAR(50) DEFAULT 'text',
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );

  ALTER TABLE messages ADD COLUMN IF NOT EXISTS node_id VARCHAR(100) REFERENCES nodes(node_id) ON DELETE CASCADE;

  CREATE INDEX IF NOT EXISTS idx_messages_node_id ON messages(node_id);
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

  -- Node logs table (Audit trail)
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
  CREATE INDEX IF NOT EXISTS idx_node_logs_level ON node_logs(level);
`;

module.exports = {
  up: async (client) => {
    await client.query(TABLES_DDL_SQL);
    
    // Insert default admin user
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO NOTHING`,
      ['admin', 'admin@zapai.com', passwordHash, 'admin']
    );
  },
  down: async (client) => {
    await client.query('DROP TABLE IF EXISTS node_logs CASCADE');
    await client.query('DROP TABLE IF EXISTS messages CASCADE');
    await client.query('DROP TABLE IF EXISTS deployments CASCADE');
    await client.query('DROP TABLE IF EXISTS clients CASCADE');
    await client.query('DROP TABLE IF EXISTS whatsapp_sessions CASCADE');
    await client.query('DROP TABLE IF EXISTS node_stats CASCADE');
    await client.query('DROP TABLE IF EXISTS nodes CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');
  }
};
