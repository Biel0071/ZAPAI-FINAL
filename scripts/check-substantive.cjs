const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function checkRealMessages() {
  // Let's find messages that are substantive (> 15 chars)
  const msgs = await pool.query(
    "SELECT m.id, m.conversation_id, c.remote_jid, l.name, m.from_me, m.sender, m.content, m.timestamp " +
    "FROM messages m " +
    "JOIN conversations c ON c.id = m.conversation_id " +
    "LEFT JOIN leads l ON l.id = c.lead_id " +
    "WHERE length(m.content) > 15 " +
    "ORDER BY m.timestamp DESC " +
    "LIMIT 50"
  );
  console.log(`Found ${msgs.rows.length} substantive messages:`);
  for (const m of msgs.rows) {
    const who = m.from_me ? 'AI' : (m.name || 'User');
    console.log(`[Conv ${m.conversation_id} (${m.remote_jid})] [${who}]: ${m.content.slice(0, 100)}...`);
  }
  await pool.end();
}
checkRealMessages().catch(console.error);
