const { query } = require('../backend/config/database');

async function run() {
  console.log('--- INSPECTING DATABASE CONVERSATIONS ---');
  try {
    const res = await query(`
      SELECT id, phone, remote_jid, name, status, created_at, updated_at
      FROM conversations
      WHERE phone LIKE '%5531938%' OR remote_jid LIKE '%5531938%'
    `);
    console.log('Conversations found:', res.rows.length);
    for (const row of res.rows) {
      console.log(row);
    }

    console.log('\n--- INSPECTING RECENT MESSAGES ---');
    const msgRes = await query(`
      SELECT id, conversation_id, phone, status, sender, direction, text, created_at
      FROM messages
      WHERE phone LIKE '%5531938%'
      ORDER BY id DESC
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
