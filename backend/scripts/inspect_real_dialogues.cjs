const { pool } = require('../src/infrastructure/config/database');

async function run() {
  const since = '2026-10-16 00:00:00';
  console.log('=== AMOSTRA DE DIÁLOGOS REAIS DO FIM DE SEMANA (DESDE SEXTA) ===\n');

  // Selecionar conversas de interesse:
  // a) Conversa com Ficha / Aguarda PIX (#16880, #16861, #16917)
  // b) Conversa com Intervenção Humana (#16851, #16871)
  // c) Conversas recentes de tráfego de anúncio (#16916, #16915, #16914)
  const convIds = [16861, 16880, 16917, 16916, 16915, 16851, 16871];

  for (const cid of convIds) {
    const convInfo = await pool.query(
      `SELECT c.id, c.status, c.funnel_stage, c.tags, c.ai_enabled, l.name, l.phone
       FROM conversations c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.id = $1`,
      [cid]
    );

    const msgs = await pool.query(
      `SELECT id, from_me, sender, text, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [cid]
    );

    const sheet = await pool.query(
      `SELECT id, items, total_price, status, created_at
       FROM conversation_sheets
       WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [cid]
    );

    const c = convInfo.rows[0] || { id: cid };
    console.log(`\n======================================================================`);
    console.log(`CONVERSA #${c.id} | Cliente: ${c.name || 'N/A'} (${c.phone || 'N/A'})`);
    console.log(`Status: ${c.status} | Funil: ${c.funnel_stage} | IA Ativa: ${c.ai_enabled}`);
    console.log(`Tags: ${(c.tags || []).join(', ')}`);
    if (sheet.rows.length > 0) {
      console.log(`Ficha #${sheet.rows[0].id}: R$ ${sheet.rows[0].total_price} | Status: ${sheet.rows[0].status}`);
      console.log(`Itens Ficha:`, JSON.stringify(sheet.rows[0].items));
    }
    console.log(`--- Mensagens (${msgs.rows.length} total) ---`);
    msgs.rows.slice(-10).forEach(m => {
      const who = m.from_me ? `[BOT/HUMANO (${m.sender})]` : `[CLIENTE]`;
      const time = new Date(m.created_at).toISOString().replace('T', ' ').slice(0, 19);
      // clean meta if present
      const cleanText = (m.text || '').split('\n[META]')[0];
      console.log(`${time} ${who}: ${cleanText}`);
    });
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
