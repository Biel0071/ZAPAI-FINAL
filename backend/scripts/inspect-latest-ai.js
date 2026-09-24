const { query } = require('../src/infrastructure/config/database');

async function inspectAI() {
  console.log('--- LATEST 50 MESSAGES SENT (FROM_ME = TRUE OR SENDER = AI) ---');
  const sentMsgs = await query(`
    SELECT m.id, m.conversation_id, m.sender, m.text, m.from_me, m.created_at, m.timestamp,
           l.phone, l.name as contact_name, c.agent_name, c.ai_enabled
    FROM messages m
    LEFT JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE m.from_me = true OR m.sender = 'ai' OR m.sender = 'agent' OR m.text ILIKE '%Camila%' OR m.text ILIKE '%obra%'
    ORDER BY m.id DESC
    LIMIT 50
  `);

  console.log(`Found ${sentMsgs.rows.length} messages.`);
  for (const msg of sentMsgs.rows) {
    const time = msg.timestamp || msg.created_at;
    console.log(`[${msg.id}] ${time} | Conv: ${msg.conversation_id} (${msg.phone} - ${msg.contact_name}) | Agent: ${msg.agent_name} | AI: ${msg.ai_enabled} | Sender: ${msg.sender} | FromMe: ${msg.from_me}:`);
    console.log(`    ${String(msg.text).replace(/\n/g, ' ')}\n`);
  }

  console.log('\n--- LATEST CONVERSATIONS WITH DIALOGUE ---');
  const activeConvs = await query(`
    SELECT c.id, l.phone, l.name, c.agent_name, c.ai_enabled, c.updated_at, c.last_message, c.status
    FROM conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    ORDER BY c.updated_at DESC
    LIMIT 10
  `);
  for (const c of activeConvs.rows) {
    console.log(`Conv ${c.id}: ${c.phone} (${c.name}) | Status: ${c.status} | AI: ${c.ai_enabled} | Agent: ${c.agent_name} | Updated: ${c.updated_at}`);
    console.log(`  Last msg: ${c.last_message}\n`);
  }

  process.exit(0);
}

inspectAI().catch(err => {
  console.error(err);
  process.exit(1);
});
