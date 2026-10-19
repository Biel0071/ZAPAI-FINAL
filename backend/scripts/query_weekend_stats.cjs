const { pool } = require('../src/infrastructure/config/database');

async function run() {
  const since = '2026-10-16 00:00:00';
  console.log('=== CONTINUAÇÃO DA ANÁLISE DETALHADA (' + since + ') ===\n');

  // 6. Top scores de evolução
  try {
    const topScores = await pool.query(
      `SELECT conversation_id, contact_name, total_xp, milestones, evaluated_at
       FROM conversation_evolution_scores
       WHERE evaluated_at >= $1
       ORDER BY total_xp DESC
       LIMIT 6`,
      [since]
    );
    console.log('6.1. TOP SCORES:', JSON.stringify(topScores.rows, null, 2));
  } catch (err) {
    console.log('6.1. ERRO SCORES:', err.message);
  }

  // 7. Amostra de conversas reais do fim de semana com mensagens de cliente e IA
  try {
    const sampleConvs = await pool.query(
      `SELECT 
         c.id,
         c.status,
         c.funnel_stage,
         c.tags,
         c.ai_enabled,
         (SELECT content FROM messages WHERE conversation_id = c.id AND from_me = false ORDER BY created_at DESC LIMIT 1) as last_client_msg,
         (SELECT content FROM messages WHERE conversation_id = c.id AND from_me = true ORDER BY created_at DESC LIMIT 1) as last_bot_msg,
         (SELECT count(*) FROM messages WHERE conversation_id = c.id AND created_at >= $1) as msg_count_period
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE m.created_at >= $1
       GROUP BY c.id
       ORDER BY msg_count_period DESC
       LIMIT 10`,
      [since]
    );
    console.log('7. AMOSTRA DE CONVERSAS COM MAIOR MOVIMENTAÇÃO:');
    sampleConvs.rows.forEach(c => {
      console.log(`\n--- CONVERSA #${c.id} (Status: ${c.status} | Funil: ${c.funnel_stage} | IA: ${c.ai_enabled}) ---`);
      console.log(`Tags: ${(c.tags || []).join(', ')}`);
      console.log(`Última do Cliente: "${c.last_client_msg ? c.last_client_msg.slice(0, 100) : ''}"`);
      console.log(`Última da IA/Atendente: "${c.last_bot_msg ? c.last_bot_msg.slice(0, 150) : ''}"`);
    });
  } catch (err) {
    console.log('7. ERRO CONVERSAS:', err.message);
  }

  // 8. Leads por aquecimento no período (verde, amarelo, vermelho, azul)
  try {
    const breakdown = await pool.query(
      `SELECT 
         CASE 
           WHEN c.tags && ARRAY['ficha_gerada', 'aguarda_pix', 'atendimento_finalizado']::text[] 
                OR c.funnel_stage IN ('aguardando_pix', 'finalizado') THEN 'azul_finalizado_pix'
           WHEN c.tags && ARRAY['intervencao_humana', 'precisa_humano', 'delirio_evitado']::text[]
                OR c.status = 'pending_human'
                OR c.ai_enabled = false THEN 'vermelho_pausado'
           WHEN c.ai_enabled = true AND c.status = 'open' THEN 'amarelo_rodando'
           ELSE 'verde_chegou'
         END as lead_state,
         count(DISTINCT c.id) as count
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE m.created_at >= $1
       GROUP BY lead_state`,
      [since]
    );
    console.log('\n8. AQUECIMENTO DE LEADS (CORES INBOX):', breakdown.rows);
  } catch (err) {
    console.log('8. ERRO AQUECIMENTO:', err.message);
  }

  // 9. Mensagens por dia desde sexta
  try {
    const daily = await pool.query(
      `SELECT 
         date_trunc('day', created_at) as dia,
         count(*) as total,
         count(*) FILTER (WHERE from_me = false) as recebidas,
         count(*) FILTER (WHERE from_me = true) as enviadas
       FROM messages
       WHERE created_at >= $1
       GROUP BY dia
       ORDER BY dia ASC`,
      [since]
    );
    console.log('\n9. DISTRIBUIÇÃO DIÁRIA:', daily.rows);
  } catch (err) {
    console.log('9. ERRO DIARIO:', err.message);
  }

  // 10. Produtos mais cotados nas fichas
  try {
    const topProducts = await pool.query(
      `SELECT 
         elem->>'item' as product_name,
         count(*) as occurrences,
         avg((elem->>'unitPrice')::numeric) as avg_price
       FROM conversation_sheets,
       jsonb_array_elements(items) as elem
       WHERE created_at >= $1
       GROUP BY product_name
       ORDER BY occurrences DESC
       LIMIT 10`,
      [since]
    );
    console.log('\n10. PRODUTOS MAIS COTADOS NAS FICHAS:', topProducts.rows);
  } catch (err) {
    console.log('10. ERRO PRODUTOS:', err.message);
  }

  // 11. Conversas que estão em AGUARDA_PIX (as 12 que finalizaram)
  try {
    const aguardaPix = await pool.query(
      `SELECT 
         c.id,
         c.funnel_stage,
         c.tags,
         (SELECT content FROM messages WHERE conversation_id = c.id AND from_me = false ORDER BY created_at DESC LIMIT 1) as client_last,
         (SELECT content FROM messages WHERE conversation_id = c.id AND from_me = true ORDER BY created_at DESC LIMIT 1) as bot_last
       FROM conversations c
       WHERE (c.tags && ARRAY['aguarda_pix', 'atendimento_finalizado']::text[] 
              OR c.status = 'aguarda_pix' 
              OR c.funnel_stage = 'aguardando_pix')
       LIMIT 6`
    );
    console.log('\n11. CONVERSAS EM AGUARDA_PIX (FINALIZADAS PELA IA):');
    aguardaPix.rows.forEach(r => {
      console.log(`\nConversa #${r.id} | Funil: ${r.funnel_stage} | Tags: ${r.tags}`);
      console.log(`Cliente: "${r.client_last}"`);
      console.log(`Atendente: "${r.bot_last}"`);
    });
  } catch (err) {
    console.log('11. ERRO AGUARDA PIX:', err.message);
  }

  // 12. Conversas com intervenção humana / delírio evitado (vermelho)
  try {
    const intervencao = await pool.query(
      `SELECT 
         c.id,
         c.status,
         c.funnel_stage,
         c.tags,
         (SELECT content FROM messages WHERE conversation_id = c.id AND from_me = false ORDER BY created_at DESC LIMIT 1) as client_last,
         (SELECT content FROM messages WHERE conversation_id = c.id AND from_me = true ORDER BY created_at DESC LIMIT 1) as bot_last
       FROM conversations c
       WHERE c.tags && ARRAY['intervencao_humana', 'precisa_humano', 'delirio_evitado']::text[]
          OR c.status = 'pending_human'
       LIMIT 5`
    );
    console.log('\n12. CONVERSAS EM INTERVENÇÃO HUMANA / DELÍRIO EVITADO:');
    intervencao.rows.forEach(r => {
      console.log(`\nConversa #${r.id} | Status: ${r.status} | Tags: ${r.tags}`);
      console.log(`Cliente: "${r.client_last}"`);
      console.log(`Bot: "${r.bot_last}"`);
    });
  } catch (err) {
    console.log('12. ERRO INTERVENÇÃO:', err.message);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
