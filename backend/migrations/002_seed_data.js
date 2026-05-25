/**
 * Development seed data for ZapAI CRM
 * Migration format for the migration runner
 */

module.exports = {
  version: '002_seed_data',
  description: 'Insert sample development data for testing',
  up: async (client) => {
    await client.query('BEGIN');

    // Insert sample system settings
    await client.query(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES 
        ('ai_enabled', 'true', NOW()),
        ('max_daily_messages', '1000', NOW()),
        ('business_hours_start', '09:00', NOW()),
        ('business_hours_end', '18:00', NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);

    await client.query('COMMIT');
  },
};
