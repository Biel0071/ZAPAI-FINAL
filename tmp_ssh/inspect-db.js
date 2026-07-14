const { query } = require('../backend/config/database');

async function run() {
  console.log('--- INSPECTING DATABASE CONVERSATIONS ---');
  try {
    const res = await query(`
      SELECT conv.id, conv.remote_jid, l.phone, l.name
      FROM conversations conv
      INNER JOIN leads l ON l.id = conv.lead_id
      WHERE l.phone LIKE '%5531938%' OR conv.remote_jid LIKE '%5531938%'
    `);
    console.log('Conversations found:', res.rows.length);
    for (const row of res.rows) {
      console.log(row);
    }

    console.log('\n--- INSPECTING RECENT MESSAGES ---');
    const msgRes = await query(`
      SELECT m.id, m.conversation_id, m.phone, m.status, m.sender, m.direction, m.text, m.created_at
      FROM messages m
      WHERE m.phone LIKE '%5531938%'
      ORDER BY m.id DESC
      LIMIT 10
    `);
    console.log('Messages found:', msgRes.rows.length);
    for (const msg of msgRes.rows) {
      console.log(msg);
    }
  } catch (err) {
    console.error('Error during query:', err);
  }
}

run();
