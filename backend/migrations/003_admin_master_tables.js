const TABLES_DDL_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT DEFAULT 'default',
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash TEXT,
    role VARCHAR(50) DEFAULT 'admin',
    blocked BOOLEAN DEFAULT FALSE,
    plan VARCHAR(50) DEFAULT 'free',
    whatsapp_limit INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT DEFAULT 'default',
    actor_username VARCHAR(255),
    actor_role VARCHAR(50),
    actor_tenant_id TEXT,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
  );
`;

const INDEXES_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
  CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(blocked);
  CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_username ON audit_logs(actor_username);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
`;

module.exports = {
  version: '003_admin_master_tables',
  description: 'Create users and audit_logs tables for admin master functionality.',
  up: async (client) => {
    await client.query(TABLES_DDL_SQL);
    await client.query(INDEXES_SQL);

    // Insert default master admin if not exists
    const defaultTenant = process.env.AUTH_DEFAULT_TENANT_ID || process.env.DEFAULT_COMPANY_ID || 'default';
    const defaultUsername = process.env.AUTH_DEFAULT_USERNAME || 'admin';
    await client.query(
      `
        INSERT INTO users (tenant_id, username, role, plan, whatsapp_limit)
        VALUES ($1, $2, 'master_admin', 'enterprise', 999)
        ON CONFLICT (username) DO NOTHING
      `,
      [defaultTenant, defaultUsername]
    );
  },
};
