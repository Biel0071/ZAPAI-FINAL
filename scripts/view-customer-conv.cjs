const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function viewCustomerConversation() {
  const msgs = await pool.query(
    "SELECT m.id, m.conversation_id, m.from_me, m.sender, m.content, m.timestamp " +
    "FROM messages m " +
    "JOIN conversations c ON c.id = m.conversation_id " +
    "WHERE c.remote_jid = '553193807167@s.whatsapp.net' AND m.content IS NOT NULL " +
    "ORDER BY m.timestamp ASC"
  );

  console.log(`Conversation history for 553193807167 (${msgs.rows.length} messages):`);
  for (const m of msgs.rows) {
    const speaker = m.from_me ? 'AI (Camila)' : 'Cliente';
    console.log(`[${speaker}]: ${m.content.replace(/\n+/g, ' ')}`);
  }
  await pool.end();
}

viewCustomerConversation().catch(console.error);
