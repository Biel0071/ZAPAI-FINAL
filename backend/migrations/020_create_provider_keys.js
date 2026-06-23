module.exports = {
  version: '020_create_provider_keys',
  description: 'Rename user_ai_providers to provider_keys and add workspace_id, tenant_id columns',
  up: async (client) => {
    const res = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_ai_providers'
      );
    `);
    const exists = res.rows[0].exists;
    if (exists) {
      await client.query(`
        ALTER TABLE user_ai_providers RENAME TO provider_keys;
      `);
    } else {
      await client.query(`
        CREATE TABLE IF NOT EXISTS provider_keys (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id) ON DELETE CASCADE,
          provider VARCHAR(50) NOT NULL,
          api_key TEXT NOT NULL,
          model VARCHAR(100),
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
        );
      `);
    }

    await client.query(`
      ALTER TABLE provider_keys 
      ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(50) DEFAULT 'default',
      ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50) DEFAULT 'default';
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_provider_keys_user_id ON provider_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_provider_keys_provider ON provider_keys(provider);
      CREATE INDEX IF NOT EXISTS idx_provider_keys_workspace_id ON provider_keys(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_provider_keys_tenant_id ON provider_keys(tenant_id);
    `);
  },
};
