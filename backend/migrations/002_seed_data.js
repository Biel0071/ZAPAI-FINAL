/**
 * Development seed data for ZapAI CRM
 * Migration format for the migration runner
 */

module.exports = {
  version: '002_seed_data',
  description: 'Insert sample development data for testing',
  up: async (client) => {
    await client.query('BEGIN');

    // Insert sample sessions
    await client.query(`
      INSERT INTO sessions (session_id, session_name, status, phone_number, company_id)
      VALUES 
        ('dev-session-1', 'Development Session 1', 'connected', '+5511999999999', 'default'),
        ('dev-session-2', 'Development Session 2', 'disconnected', '+5511888888888', 'default')
      ON CONFLICT (session_id) DO NOTHING
    `);

    // Insert sample leads
    await client.query(`
      INSERT INTO leads (company_id, phone, name, created_at)
      VALUES 
        ('default', '+5511999999999', 'João Silva', NOW() - INTERVAL '7 days'),
        ('default', '+5511888888888', 'Maria Santos', NOW() - INTERVAL '5 days'),
        ('default', '+5511777777777', 'Pedro Costa', NOW() - INTERVAL '3 days'),
        ('default', '+5511666666666', 'Ana Oliveira', NOW() - INTERVAL '1 day'),
        ('default', '+5511555555555', 'Carlos Ferreira', NOW() - INTERVAL '12 hours')
      ON CONFLICT (company_id, phone) DO NOTHING
    `);

    // Insert sample conversations
    const leadIds = await client.query('SELECT id FROM leads ORDER BY id LIMIT 5');
    const leadIdList = leadIds.rows.map(r => r.id);

    await client.query(`
      INSERT INTO conversations (lead_id, session_id, status, lead_temperature, funnel_stage, agent_name, unread_count, company_id)
      VALUES 
        ($1, 'dev-session-1', 'open', 'warm', 'qualified', 'Bot', 2, 'default'),
        ($2, 'dev-session-1', 'open', 'cold', 'new_lead', 'Bot', 0, 'default'),
        ($3, 'dev-session-2', 'closed', 'hot', 'negotiation', 'Human', 1, 'default'),
        ($4, 'dev-session-1', 'open', 'warm', 'proposal', 'Bot', 0, 'default'),
        ($5, 'dev-session-1', 'open', 'cold', 'new_lead', 'Bot', 0, 'default')
      ON CONFLICT DO NOTHING
    `, leadIdList);

    // Insert sample messages
    const conversationIds = await client.query('SELECT id FROM conversations ORDER BY id LIMIT 5');
    const conversationIdList = conversationIds.rows.map(r => r.id);

    for (const convId of conversationIdList) {
      await client.query(`
        INSERT INTO messages (conversation_id, phone, text, direction, sender, type, status, created_at)
        VALUES 
          ($1, '+5511999999999', 'Olá! Como posso ajudar?', 'inbound', 'customer', 'text', 'delivered', NOW() - INTERVAL '1 hour'),
          ($1, '+5511999999999', 'Estou interessado no produto', 'outbound', 'agent', 'text', 'delivered', NOW() - INTERVAL '55 minutes'),
          ($1, '+5511999999999', 'Ótimo! Vou te enviar mais informações', 'inbound', 'customer', 'text', 'delivered', NOW() - INTERVAL '50 minutes')
        ON CONFLICT DO NOTHING
      `, [convId]);
    }

    // Insert sample campaigns
    await client.query(`
      INSERT INTO campaigns (id, company_id, name, status, created_at)
      VALUES 
        ('dev-campaign-1', 'default', 'Campanha de Boas-vindas', 'active', NOW() - INTERVAL '3 days'),
        ('dev-campaign-2', 'default', 'Campanha de Follow-up', 'draft', NOW() - INTERVAL '1 day')
      ON CONFLICT (id) DO NOTHING
    `);

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
