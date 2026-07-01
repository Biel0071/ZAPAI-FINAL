module.exports = {
  version: '024_extend_provider_keys_and_ai_logs',
  description: 'Add settings column to provider_keys, and session_id column to ai_logs',
  up: async (client) => {
    // 1. Add settings column to provider_keys if not exists
    await client.query(`
      ALTER TABLE provider_keys
      ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
    `);

    // 2. Add session_id column to ai_logs if not exists
    await client.query(`
      ALTER TABLE ai_logs
      ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
    `);

    // 3. Create index for session_id on ai_logs
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_logs_session_id ON ai_logs(session_id);
    `);
  },
};
