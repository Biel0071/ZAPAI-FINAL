const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function discoverCategories() {
  const messages = await pool.query(
    "SELECT m.id, m.conversation_id, c.remote_jid, l.name, l.phone, m.from_me, m.content, m.timestamp " +
    "FROM messages m " +
    "JOIN conversations c ON c.id = m.conversation_id " +
    "LEFT JOIN leads l ON l.id = c.lead_id " +
    "WHERE m.content IS NOT NULL AND length(m.content) > 3 " +
    "ORDER BY m.timestamp ASC"
  );

  console.log('Total non-empty messages:', messages.rows.length);

  // Analyze keywords
  const keywords = {
    cimento: 0,
    argamassa: 0,
    tijolo: 0,
    areia: 0,
    tinta: 0,
    telha: 0,
    preco: 0,
    frete: 0,
    entrega: 0,
    pix: 0,
    desconto: 0,
    prazo: 0,
    loja: 0,
    atacado: 0,
    duvida: 0,
    orcamento: 0
  };

  for (const m of messages.rows) {
    const text = m.content.toLowerCase();
    for (const k of Object.keys(keywords)) {
      if (text.includes(k)) keywords[k]++;
    }
  }

  console.log('Keyword frequency:', keywords);
  await pool.end();
}

discoverCategories().catch(console.error);
