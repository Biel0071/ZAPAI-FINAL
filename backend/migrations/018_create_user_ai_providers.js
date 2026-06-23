module.exports = {
  version: '018_create_user_ai_providers',
  description: 'Create user_ai_providers table for per-user AI providers configurations',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_ai_providers (
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_ai_providers_user_id ON user_ai_providers(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_ai_providers_provider ON user_ai_providers(provider);
    `);
  },
};
