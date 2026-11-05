const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });
  const res = await pool.query("SELECT id, conversation_id, from_me, created_at, text FROM messages WHERE remote_jid LIKE '%177340004999306%' OR conversation_id = 12574 ORDER BY id ASC");
  console.log('Total messages:', res.rows.length);
  for (const r of res.rows) {
    const t = (r.text || '').replace(/\n/g, ' ').slice(0, 60);
    console.log(`id=${r.id} conv=${r.conversation_id} fromMe=${r.from_me} time=${r.created_at?.toISOString?.() || r.created_at} text="${t}"`);
  }
  await pool.end();
}

main().catch(console.error);
