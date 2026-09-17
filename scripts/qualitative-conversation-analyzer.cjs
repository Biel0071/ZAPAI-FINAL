const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function qualitativeAnalysis() {
  console.log('--- QUALITATIVE CONVERSATION ANALYSIS ---');

  // Let's examine direct customer conversations (non-group first)
  const directMsgs = await pool.query(`
    SELECT c.id as conv_id, c.remote_jid, l.name, l.phone, m.from_me, m.content, m.media_type, m.timestamp
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE c.remote_jid NOT LIKE '%@g.us'
    ORDER BY c.id, m.timestamp ASC
    LIMIT 100
  `);

  console.log(`Found ${directMsgs.rows.length} direct messages. Samples:`);
  for (const row of directMsgs.rows.slice(0, 30)) {
    const sender = row.from_me ? 'AI (Camila)' : (row.name || row.phone || 'Cliente');
    console.log(`[${row.conv_id}] [${sender}]: ${row.content ? row.content.slice(0, 120) : '[' + row.media_type + ']'}`);
  }

  // Let's analyze response times and pattern markers
  const patternStats = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE from_me = true AND (content ILIKE '%olá%' OR content ILIKE '%bom dia%' OR content ILIKE '%boa tarde%')) as greetings,
      COUNT(*) FILTER (WHERE from_me = true AND (content ILIKE '%R$%' OR content ILIKE '%reais%' OR content ILIKE '%preço%' OR content ILIKE '%custa%')) as price_quotes,
      COUNT(*) FILTER (WHERE from_me = true AND (content ILIKE '%cimento%' OR content ILIKE '%argamassa%' OR content ILIKE '%tijolo%' OR content ILIKE '%areia%')) as material_quotes,
      COUNT(*) FILTER (WHERE from_me = true AND (content ILIKE '%não posso%' OR content ILIKE '%não tenho%' OR content ILIKE '%desculpe%')) as apologies_or_limits,
      COUNT(*) FILTER (WHERE from_me = true AND (content ILIKE '%pix%' OR content ILIKE '%cartão%' OR content ILIKE '%pagamento%')) as payment_mentions
    FROM messages
  `);

  console.log('\n--- PATTERN FREQUENCIES (Outbound AI) ---');
  console.log(patternStats.rows[0]);

  await pool.end();
}

qualitativeAnalysis().catch(console.error);
