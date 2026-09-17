const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function extractQuestionsAndQuotes() {
  const userMsgs = await pool.query(
    "SELECT m.id, m.conversation_id, c.remote_jid, l.name, l.phone, m.content " +
    "FROM messages m " +
    "JOIN conversations c ON c.id = m.conversation_id " +
    "LEFT JOIN leads l ON l.id = c.lead_id " +
    "WHERE m.from_me = false AND length(m.content) > 10 AND m.content LIKE '%?%' " +
    "ORDER BY m.timestamp DESC " +
    "LIMIT 40"
  );

  console.log(`Found ${userMsgs.rows.length} questions asked by users:`);
  for (const m of userMsgs.rows) {
    console.log(`- [${m.remote_jid}] (${m.name || m.phone}): "${m.content.trim()}"`);
  }
  await pool.end();
}

extractQuestionsAndQuotes().catch(console.error);
