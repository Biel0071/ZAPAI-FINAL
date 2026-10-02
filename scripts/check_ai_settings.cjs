const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai123@localhost:5432/zapai_crm' });

async function check() {
  const camp = await pool.query("SELECT id, status, queue, updated_at FROM campaigns WHERE id = 'cmp-recuperacao-02102026'");
  console.log('=== STATUS DA CAMPANHA ===');
  console.log('Status:', camp.rows[0].status);
  console.log('Fila:', camp.rows[0].queue);
  console.log('Atualizado em:', camp.rows[0].updated_at);

  const msgs = await pool.query(`
    SELECT m.id, m.conversation_id, m.status, m.created_at, l.name, l.phone, m.remote_jid
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE m.sender = 'campaign'
    ORDER BY m.id DESC
    LIMIT 6
  `);
  console.log('\n=== ULTIMAS MENSAGENS DISPARADAS PELA CAMPANHA ===');
  for (const m of msgs.rows) {
    console.log(`[#${m.id}] ${m.name || 'Contato'} (${m.phone || m.remote_jid}) | Status: ${m.status} | Hora: ${m.created_at.toISOString()}`);
  }

  const count = await pool.query("SELECT count(*) as total FROM messages WHERE sender = 'campaign' AND created_at >= '2026-10-02 00:00:00'");
  console.log('\nTOTAL DE DISPAROS HOJE:', count.rows[0].total, '/ 61');

  const replies = await pool.query(`
    SELECT m.id, m.conversation_id, m.sender, m.text, m.created_at, l.name, l.phone, m.remote_jid
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    LEFT JOIN leads l ON c.lead_id = l.id
    WHERE m.direction = 'incoming' AND m.created_at >= '2026-10-02 12:45:00'
    ORDER BY m.id DESC
  `);
  console.log('\nRESPOSTAS RECEBIDAS DE LEADS APOS O DISPARO:', replies.rows.length);

  await pool.end();
}

check().catch(console.error);
