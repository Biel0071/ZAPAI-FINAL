const db = require('/opt/zapai/backend/src/infrastructure/config/database');

async function run() {
  const lead = await db.query(`SELECT * FROM leads WHERE id = 2614`);
  console.log('Lead 2614:', lead.rows);

  const msgs = await db.query(`SELECT id, phone, sender, from_me, content FROM messages WHERE conversation_id = '12574' LIMIT 5`);
  console.log('Messages for 12574 sample:', msgs.rows);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
