const { Pool } = require('../backend/node_modules/pg');

const connStr = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString: connStr, query_timeout: 30000 });

async function analyze() {
  console.log('=== ANALISANDO ATENDIMENTO, VARIAÇÃO E RETORNO DE RESPOSTAS ===\n');

  // 1. Resumo Geral
  const totals = await pool.query(`
    SELECT 
      COUNT(DISTINCT c.id) as total_conversations,
      COUNT(m.id) as total_messages,
      COUNT(m.id) FILTER (WHERE m.from_me = false) as inbound_client_messages,
      COUNT(m.id) FILTER (WHERE m.from_me = true) as outbound_replies,
      COUNT(DISTINCT c.lead_id) as total_leads
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
  `);

  console.log('1. VOLUME GERAL DE INTERAÇÕES:');
  console.table(totals.rows);

  // 2. Tempo de Resposta (Inbound -> Outbound Turnaround)
  const turnaround = await pool.query(`
    WITH message_pairs AS (
      SELECT 
        m.conversation_id,
        m.from_me,
        m.timestamp,
        LAG(m.from_me) OVER w as prev_from_me,
        LAG(m.timestamp) OVER w as prev_timestamp
      FROM messages m
      WINDOW w AS (PARTITION BY m.conversation_id ORDER BY m.timestamp ASC, m.id ASC)
    ),
    response_intervals AS (
      SELECT 
        EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) as wait_seconds
      FROM message_pairs
      WHERE from_me = true 
        AND prev_from_me = false
        AND timestamp >= prev_timestamp
        AND EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) BETWEEN 1 AND 86400
    )
    SELECT 
      COUNT(*) as total_turnarounds,
      ROUND(AVG(wait_seconds)::numeric, 1) as avg_seconds,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY wait_seconds)::numeric, 1) as median_seconds,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY wait_seconds)::numeric, 1) as p75_seconds,
      ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY wait_seconds)::numeric, 1) as p90_seconds,
      COUNT(*) FILTER (WHERE wait_seconds <= 10) as instant_ai_responses_le_10s,
      COUNT(*) FILTER (WHERE wait_seconds BETWEEN 11 AND 60) as fast_responses_11_to_60s,
      COUNT(*) FILTER (WHERE wait_seconds BETWEEN 61 AND 300) as moderate_responses_1_to_5m,
      COUNT(*) FILTER (WHERE wait_seconds > 300) as slow_responses_gt_5m
    FROM response_intervals
  `);

  console.log('\n2. MÉTRICAS DE TEMPO DE RETORNO / RESPOSTA:');
  console.table(turnaround.rows);

  // 3. Variação e Diversidade Textual
  const variation = await pool.query(`
    WITH out_msgs AS (
      SELECT 
        TRIM(COALESCE(content, text, '')) as clean_content,
        LENGTH(TRIM(COALESCE(content, text, ''))) as char_length,
        CARDINALITY(REGEXP_SPLIT_TO_ARRAY(TRIM(COALESCE(content, text, '')), '\\s+')) as word_count
      FROM messages
      WHERE from_me = true AND LENGTH(TRIM(COALESCE(content, text, ''))) > 0
    )
    SELECT 
      COUNT(*) as total_outbound,
      COUNT(DISTINCT clean_content) as unique_responses,
      ROUND((COUNT(DISTINCT clean_content)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as diversity_ratio_pct,
      ROUND(AVG(char_length)::numeric, 1) as avg_chars,
      ROUND(AVG(word_count)::numeric, 1) as avg_words,
      MIN(char_length) as min_chars,
      MAX(char_length) as max_chars
    FROM out_msgs
  `);

  console.log('\n3. DIVERSIDADE E VARIAÇÃO TEXTUAL DAS RESPOSTAS:');
  console.table(variation.rows);

  // 4. Respostas Mais Repetidas (Templates vs Frases Padrão)
  const topRepeated = await pool.query(`
    SELECT 
      SUBSTRING(TRIM(COALESCE(content, text, '')) FROM 1 FOR 90) as response_preview,
      COUNT(*) as occurrences,
      ROUND((COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM messages WHERE from_me = true AND LENGTH(TRIM(COALESCE(content, text, ''))) > 10), 0)::numeric) * 100, 1) as pct_of_all_replies
    FROM messages
    WHERE from_me = true AND COALESCE(content, text) IS NOT NULL AND LENGTH(TRIM(COALESCE(content, text, ''))) > 10
    GROUP BY response_preview
    ORDER BY occurrences DESC
    LIMIT 8
  `);

  console.log('\n4. TOP RESPOSTAS REPETIDAS (PADRÕES / TEMPLATES):');
  console.table(topRepeated.rows);

  // 5. Elementos de Retorno e Conversão (Perguntas, Valores, Emojis, Links)
  const elements = await pool.query(`
    SELECT 
      COUNT(*) as total_outbound,
      COUNT(*) FILTER (WHERE COALESCE(content, text, '') LIKE '%?%') as contains_question_cta,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(content, text, '') LIKE '%?%')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as question_cta_pct,
      COUNT(*) FILTER (WHERE COALESCE(content, text, '') ~* 'R\\$|reais|valor|preço|custa') as contains_pricing_info,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(content, text, '') ~* 'R\\$|reais|valor|preço|custa')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as pricing_info_pct,
      COUNT(*) FILTER (WHERE COALESCE(content, text, '') ~* 'pix|cartão|parcel|transferência|pagamento') as contains_payment_info,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(content, text, '') ~* 'pix|cartão|parcel|transferência|pagamento')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as payment_info_pct,
      COUNT(*) FILTER (WHERE COALESCE(content, text, '') ~* 'frete|entrega|prazo|enviar|retirada') as contains_delivery_info,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(content, text, '') ~* 'frete|entrega|prazo|enviar|retirada')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as delivery_info_pct,
      COUNT(*) FILTER (WHERE COALESCE(content, text, '') ~* '😊|👍|👋|🚀|✅|🤝|📦|🏠|🏗️|🙏') as contains_emojis,
      ROUND((COUNT(*) FILTER (WHERE COALESCE(content, text, '') ~* '😊|👍|👋|🚀|✅|🤝|📦|🏠|🏗️|🙏')::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as emoji_usage_pct
    FROM messages
    WHERE from_me = true AND COALESCE(content, text) IS NOT NULL
  `);

  console.log('\n5. ESTRUTURA E ELEMENTOS DE ENGAJAMENTO NAS RESPOSTAS:');
  console.table(elements.rows);

  // 6. Taxa de Retorno do Cliente (Engajamento pós-resposta)
  const clientRetention = await pool.query(`
    WITH outbound_with_next AS (
      SELECT 
        m.conversation_id,
        m.from_me,
        m.timestamp,
        LEAD(m.from_me) OVER (PARTITION BY m.conversation_id ORDER BY m.timestamp ASC, m.id ASC) as next_from_me,
        LEAD(m.timestamp) OVER (PARTITION BY m.conversation_id ORDER BY m.timestamp ASC, m.id ASC) as next_timestamp
      FROM messages m
    )
    SELECT 
      COUNT(*) as total_agent_replies,
      COUNT(*) FILTER (WHERE next_from_me = false) as client_responded_back,
      ROUND((COUNT(*) FILTER (WHERE next_from_me = false)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 1) as client_retention_rate_pct,
      COUNT(*) FILTER (WHERE next_from_me IS NULL) as ended_on_agent_reply,
      COUNT(*) FILTER (WHERE next_from_me = true) as consecutive_agent_followups
    FROM outbound_with_next
    WHERE from_me = true
  `);

  console.log('\n6. ENGAJAMENTO E RETORNO DO CLIENTE PÓS-RESPOSTA:');
  console.table(clientRetention.rows);

  // 7. Conversas Pendentes / Sem Retorno (Vácuo / Abandono)
  const pendingStatus = await pool.query(`
    WITH last_message_per_conv AS (
      SELECT DISTINCT ON (conversation_id) 
        conversation_id,
        from_me,
        content,
        timestamp
      FROM messages
      ORDER BY conversation_id, timestamp DESC, id DESC
    )
    SELECT 
      COUNT(*) as total_conversations,
      COUNT(*) FILTER (WHERE from_me = false) as client_waiting_for_reply,
      ROUND((COUNT(*) FILTER (WHERE from_me = false)::numeric / COUNT(*)::numeric) * 100, 1) as client_waiting_pct,
      COUNT(*) FILTER (WHERE from_me = true) as agent_gave_last_word,
      ROUND((COUNT(*) FILTER (WHERE from_me = true)::numeric / COUNT(*)::numeric) * 100, 1) as agent_last_word_pct
    FROM last_message_per_conv
  `);

  console.log('\n7. ESTADO ATUAL DAS CONVERSAS (QUEM DEU A ÚLTIMA PALAVRA):');
  console.table(pendingStatus.rows);

  // 8. Amostras Qualitativas de Variação de Resposta
  const qualitativeSamples = await pool.query(`
    SELECT c.id as conv_id, l.name as client_name, COALESCE(m.content, m.text, '') as content, m.timestamp
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN leads l ON l.id = c.lead_id
    WHERE m.from_me = true AND LENGTH(COALESCE(m.content, m.text, '')) > 40
    ORDER BY RANDOM()
    LIMIT 6
  `);

  console.log('\n8. AMOSTRAS QUALITATIVAS DE RESPOSTAS ENVIADAS:');
  qualitativeSamples.rows.forEach((r, idx) => {
    console.log(`[Amostra #${idx + 1}] (Conv ${r.conv_id} - ${r.client_name || 'Cliente'}):`);
    console.log(`"${r.content}"\n`);
  });

  await pool.end();
}

analyze().catch(err => {
  console.error(err);
  process.exit(1);
});
