const { query } = require('../src/infrastructure/config/database');

async function check() {
  const campCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'campaigns'");
  console.log('CAMPAIGNS COLS:', campCols.rows.map(r => r.column_name));

  const campaigns = await query('SELECT * FROM campaigns ORDER BY updated_at DESC LIMIT 3');
  console.log('=== CAMPAIGNS ===');
  for (const c of campaigns.rows) {
    console.log(`Campaign ${c.id}: name=${c.name}, status=${c.status}, total_leads=${c.total_leads}, sent=${c.sent || c.sent_count || 0}`);
  }

  const msgs = await query(`
    SELECT id, conversation_id, direction, sender, status, substring(text from 1 for 60) as preview, created_at 
    FROM messages 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  console.log('=== RECENT MESSAGES ===');
  for (const m of msgs.rows) {
    console.log(`[${m.created_at.toISOString()}] (${m.direction}/${m.sender || 'none'}/${m.status}) [Conv ${m.conversation_id}]: ${m.preview}`);
  }

  const convCols = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations'");
  console.log('CONVERSATIONS COLS:', convCols.rows.map(r => r.column_name));

  const camp = await query("SELECT * FROM campaigns WHERE id = 'cmp-recuperacao-02102026'");
  console.log('=== CAMPAIGN cmp-recuperacao-02102026 ===');
  if (camp.rows.length > 0) {
    const c = camp.rows[0];
    console.log('Status:', c.status);
    console.log('Started At:', c.started_at);
    console.log('Completed At:', c.completed_at);
    console.log('Created At:', c.created_at);
    console.log('Updated At:', c.updated_at);
    console.log('Messages:', JSON.stringify(c.messages, null, 2));
    console.log('Selected contacts count:', c.selected_contacts?.length || 0);
    console.log('Selected contacts sample:', JSON.stringify((c.selected_contacts || []).slice(0, 5), null, 2));
    console.log('Settings:', JSON.stringify(c.settings, null, 2));
    console.log('Full Queue:', JSON.stringify(c.queue, null, 2));
  }

  const convs = await query(`
    SELECT * 
    FROM conversations 
    ORDER BY updated_at DESC 
    LIMIT 3
  `);
  console.log('=== RECENT CONVERSATIONS ===');
  for (const cv of convs.rows) {
    console.log(`Conv ${cv.id}: name=${cv.name || cv.customer_name}, ai_enabled=${cv.ai_enabled}, tags=${JSON.stringify(cv.tags)}, stage=${cv.funnel_stage}, temp=${cv.lead_temperature}`);
  }

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
