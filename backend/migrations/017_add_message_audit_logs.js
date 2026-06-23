module.exports = {
  version: '017_add_message_audit_logs',
  description: 'Create message_audit_logs and ai_evolution_stats tables for pipeline auditing and evolutionary metrics',
  up: async (client) => {
    // 1. Create message_audit_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_audit_logs (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(255),
        conversation_id VARCHAR(255),
        phone VARCHAR(50),
        step VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        details JSONB,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create index for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_message_audit_logs_message_id ON message_audit_logs(message_id);
      CREATE INDEX IF NOT EXISTS idx_message_audit_logs_step ON message_audit_logs(step);
      CREATE INDEX IF NOT EXISTS idx_message_audit_logs_timestamp ON message_audit_logs(timestamp);
    `);

    // 2. Create ai_evolution_stats
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_evolution_stats (
        id SERIAL PRIMARY KEY,
        agent_key VARCHAR(255) NOT NULL,
        conversations_analyzed INT DEFAULT 0,
        conversions INT DEFAULT 0,
        objections INT DEFAULT 0,
        success_rate DECIMAL(5,2) DEFAULT 0.0,
        evolution_score INT DEFAULT 0,
        faq_data JSONB,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_evolution_stats_agent_key ON ai_evolution_stats(agent_key);
      CREATE INDEX IF NOT EXISTS idx_ai_evolution_stats_timestamp ON ai_evolution_stats(timestamp);
    `);
  },
};
