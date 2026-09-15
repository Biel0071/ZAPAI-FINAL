const { Client } = require('/opt/zapai/backend/node_modules/pg');

async function run() {
  const c = new Client({ connectionString: 'postgresql://zapai:zapai_secure_pass_2026@localhost:5432/zapai_crm' });
  await c.connect();
  const res = await c.query('SELECT id, conversation_id, phone, text, whatsapp_message_id, status, created_at FROM messages WHERE id >= 117770 ORDER BY id ASC');
  console.log('Recent messages >= 117770:');
  console.table(res.rows);
  await c.end();
}

run().catch(console.error);
