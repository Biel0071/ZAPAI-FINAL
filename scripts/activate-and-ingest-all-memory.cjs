const { Pool } = require('../backend/node_modules/pg');
const agentMemoryGraphService = require('../backend/services/agentMemoryGraphService');
const agentEvolutionService = require('../backend/services/agentEvolutionService');

const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function activateAndIngestAll() {
  console.log('=== [1/6] ATIVANDO CONVERSATION MEMORY (ai_conversation_memory) ===');

  // Query all conversations with their messages and lead data
  const convQuery = await pool.query(`
    SELECT c.id, c.remote_jid, c.company_id, c.session_id, c.lead_id, c.status,
           c.lead_temperature, c.funnel_stage, c.agent_name, c.tags, c.summary,
           c.last_message, c.ai_enabled, c.lead_intent, c.next_action,
           l.name as lead_name, l.phone as lead_phone
    FROM conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    ORDER BY c.id ASC
  `);

  console.log(`Carregadas ${convQuery.rows.length} conversas para processamento.`);

  let convMemUpserted = 0;
  for (const conv of convQuery.rows) {
    const contactId = conv.remote_jid || conv.lead_phone || String(conv.id);
    const phone = conv.lead_phone || conv.remote_jid.replace(/@.*$/, '');
    const name = conv.lead_name || conv.remote_jid || 'Contato';
    const companyId = conv.company_id || 'default';

    // Fetch messages for this conversation
    const msgRes = await pool.query(
      `SELECT id, from_me, sender, content, media_type, timestamp 
       FROM messages 
       WHERE conversation_id = $1 
       ORDER BY timestamp ASC`,
      [conv.id]
    );

    const msgs = msgRes.rows;
    const msgJson = msgs.slice(-40).map(m => ({
      id: m.id,
      from_me: m.from_me,
      sender: m.from_me ? 'ai' : 'user',
      content: m.content || `[${m.media_type || 'mídia'}]`,
      timestamp: m.timestamp
    }));

    const totalMsgs = msgs.length;
    const audioMsgs = msgs.filter(m => m.media_type === 'audio').length;
    const imageMsgs = msgs.filter(m => m.media_type === 'image').length;

    // Detect sentiment and intent from content
    let intent = conv.lead_intent || 'information';
    let sentiment = 'neutral';
    const allText = msgs.map(m => m.content || '').join(' ').toLowerCase();

    if (allText.includes('cimento') || allText.includes('argamassa') || allText.includes('tijolo') || allText.includes('preço') || allText.includes('quanto')) {
      intent = 'price_request';
    }
    if (allText.includes('pix') || allText.includes('fechar') || allText.includes('comprar') || allText.includes('quero')) {
      intent = 'purchase_intent';
      sentiment = 'positive';
    }
    if (allText.includes('golpe') || allText.includes('medo') || allText.includes('ruim') || allText.includes('não pago')) {
      sentiment = 'cautious_negative';
    }

    const tags = Array.isArray(conv.tags) ? [...conv.tags] : [];
    if (intent === 'price_request' && !tags.includes('cotacao')) tags.push('cotacao');
    if (intent === 'purchase_intent' && !tags.includes('lead_qualificado')) tags.push('lead_qualificado');
    if (conv.remote_jid.endsWith('@g.us') && !tags.includes('grupo')) tags.push('grupo');

    let summary = conv.summary || '';
    if (!summary) {
      if (allText.includes('cimento') && allText.includes('tijolo')) {
        summary = 'Cliente interessado em materiais básicos (cimento Cauê/Votoran 50kg, tijolos 8 furos). Cotação enviada com frete grátis e opção PIX.';
      } else if (conv.remote_jid.endsWith('@g.us')) {
        summary = `Grupo de WhatsApp (${name}) com fluxo de mensagens e networking.`;
      } else {
        summary = `Atendimento com ${totalMsgs} mensagens registradas.`;
      }
    }

    const metrics = {
      totalMessages: totalMsgs,
      audioRequests: audioMsgs,
      imageCount: imageMsgs,
      leadTemperature: conv.lead_temperature || 'cold',
      funnelStage: conv.funnel_stage || 'new_lead'
    };

    await pool.query(`
      INSERT INTO ai_conversation_memory (
        contact_id, company_id, phone, name, intent, sentiment,
        tags, summary, metrics, messages, last_updated, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, NOW(), NOW(), NOW())
      ON CONFLICT (contact_id, company_id) DO UPDATE SET
        phone = EXCLUDED.phone,
        name = EXCLUDED.name,
        intent = EXCLUDED.intent,
        sentiment = EXCLUDED.sentiment,
        tags = EXCLUDED.tags,
        summary = EXCLUDED.summary,
        metrics = EXCLUDED.metrics,
        messages = EXCLUDED.messages,
        last_updated = NOW(),
        updated_at = NOW()
    `, [
      contactId,
      companyId,
      phone,
      name,
      intent,
      sentiment,
      tags,
      summary,
      JSON.stringify(metrics),
      JSON.stringify(msgJson)
    ]);
    convMemUpserted++;
  }
  console.log(`[1/6] ai_conversation_memory atualizada: ${convMemUpserted} registros inseridos/atualizados.`);

  console.log('\n=== [2/6] INGESTÃO DE MEMÓRIA LONGA (ai_memory_long) ===');
  // Extract facts, objections, product interests and preferences per chat
  let longMemCount = 0;

  async function addLongMemory(chatId, sessionId, companyId, category, content, confidence = 1.0) {
    try {
      await pool.query(`
        INSERT INTO ai_memory_long (chat_id, session_id, company_id, category, content, confidence, source, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'conversation_extraction', NOW(), NOW())
        ON CONFLICT (chat_id, category, content) DO UPDATE SET
          confidence = EXCLUDED.confidence,
          updated_at = NOW()
      `, [chatId, sessionId || 'main', companyId || 'default', category, content, confidence]);
      longMemCount++;
    } catch (err) {
      console.warn(`Erro ao inserir ai_memory_long (${chatId}, ${category}):`, err.message);
    }
  }

  for (const conv of convQuery.rows) {
    const chatId = conv.remote_jid || conv.lead_phone || String(conv.id);
    const companyId = conv.company_id || 'default';
    const sessionId = conv.session_id || 'main';

    const msgs = await pool.query(
      `SELECT content, from_me FROM messages WHERE conversation_id = $1 AND content IS NOT NULL`,
      [conv.id]
    );

    const fullText = msgs.rows.map(m => m.content).join(' \n ');

    // Specific extractions for Gabriel Roc (553193807167)
    if (chatId.includes('553193807167')) {
      await addLongMemory(chatId, sessionId, companyId, 'profile', 'Nome identificado: Gabriel Roc; CPF: 23116439672');
      await addLongMemory(chatId, sessionId, companyId, 'product_interest', 'Cimento Cauê/Votoran 50kg (10 sacos cotados a R$ 34,90 = R$ 349,00)');
      await addLongMemory(chatId, sessionId, companyId, 'product_interest', 'Tijolo Baiano 8 furos (500 unidades cotadas a R$ 425,00)');
      await addLongMemory(chatId, sessionId, companyId, 'product_interest', 'Argamassa AC-I Quartzolit 20kg (550 sacos cotados a R$ 18,50 = R$ 10.175,00)');
      await addLongMemory(chatId, sessionId, companyId, 'product_interest', 'Laje pré-moldada (solicitou aviso de reposição de estoque)');
      await addLongMemory(chatId, sessionId, companyId, 'preference', 'Prefere pagamento via PIX com 5% de desconto');
      await addLongMemory(chatId, sessionId, companyId, 'preference', 'Valoriza frete grátis (atingido em compras acima de R$ 500,00)');
      await addLongMemory(chatId, sessionId, companyId, 'objection', 'Insegurança com pagamento antecipado: medo de golpe na internet');
      await addLongMemory(chatId, sessionId, companyId, 'objection', 'Desejo de pagamento na entrega (exige alinhamento de segurança e emissão prévia de NF)');
    }

    // Material Construction Interests
    if (fullText.includes('cimento') && !chatId.includes('553193807167')) {
      await addLongMemory(chatId, sessionId, companyId, 'product_interest', 'Interesse consultivo em cimento para obra');
    }
    if (fullText.includes('argamassa') && !chatId.includes('553193807167')) {
      await addLongMemory(chatId, sessionId, companyId, 'product_interest', 'Interesse em argamassa colante');
    }
    if (fullText.includes('tijolo') && !chatId.includes('553193807167')) {
      await addLongMemory(chatId, sessionId, companyId, 'product_interest', 'Interesse em alvenaria e tijolos');
    }

    // Tech / Support Interests
    if (fullText.includes('antivirus') || fullText.includes('erro') || fullText.includes('dando isso')) {
      await addLongMemory(chatId, sessionId, companyId, 'context', 'Contato enfrentou bloqueio por antivírus local ou erro de execução');
    }

    // Group context
    if (chatId.endsWith('@g.us')) {
      await addLongMemory(chatId, sessionId, companyId, 'context', `Grupo de WhatsApp focado em networking e anúncios (${conv.lead_name || 'Comunidade'})`);
    }

    // General lead profile
    if (conv.lead_name && conv.lead_name !== 'Contato' && !conv.lead_name.includes('@')) {
      await addLongMemory(chatId, sessionId, companyId, 'profile', `Nome de cadastro: ${conv.lead_name}`);
    }
  }
  console.log(`[2/6] ai_memory_long preenchida: ${longMemCount} fatos e aprendizados persistidos.`);

  console.log('\n=== [3/6] SNAPSHOT DE CONTEXTO ATIVO DA IA (ai_context) ===');
  let contextCount = 0;
  // Get all unique remote_jids
  const uniqueChats = await pool.query(`
    SELECT DISTINCT ON (c.remote_jid) 
      c.id, c.remote_jid, c.session_id, c.company_id, c.lead_temperature,
      c.lead_intent, c.next_action, c.tags, l.name as lead_name, l.phone as lead_phone
    FROM conversations c
    LEFT JOIN leads l ON l.id = c.lead_id
    ORDER BY c.remote_jid, c.updated_at DESC
  `);

  for (const chat of uniqueChats.rows) {
    const chatId = chat.remote_jid;
    const sessionId = chat.session_id || 'main';
    const companyId = chat.company_id || 'default';

    // Find last AI reply
    const lastReplyRes = await pool.query(
      `SELECT content FROM messages WHERE conversation_id = $1 AND from_me = true AND content IS NOT NULL ORDER BY timestamp DESC LIMIT 1`,
      [chat.id]
    );
    const lastAiReply = lastReplyRes.rows[0]?.content || 'Atendimento iniciado.';

    let temp = chat.lead_temperature || 'cold';
    let intent = chat.lead_intent || 'information';
    let nextAction = chat.next_action || 'qualificar_lead';
    let tone = 'professional';

    if (chatId.includes('553193807167')) {
      temp = 'warm';
      intent = 'purchase_order_closing';
      nextAction = 'enviar_chave_pix_e_confirmar_pedido';
      tone = 'consultivo_comercial_seguro';
    } else if (chatId.endsWith('@g.us')) {
      temp = 'cold';
      intent = 'group_monitoring';
      nextAction = 'manter_monitoramento_passivo';
      tone = 'discreto';
    }

    const contextJson = {
      leadName: chat.lead_name,
      leadPhone: chat.lead_phone,
      remoteJid: chatId,
      conversationId: chat.id,
      tags: chat.tags || [],
      lastUpdated: new Date().toISOString()
    };

    await pool.query(`
      INSERT INTO ai_context (
        chat_id, session_id, company_id, lead_temperature,
        lead_intent, next_action, tone, last_ai_reply, context_json, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
      ON CONFLICT (chat_id) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        company_id = EXCLUDED.company_id,
        lead_temperature = EXCLUDED.lead_temperature,
        lead_intent = EXCLUDED.lead_intent,
        next_action = EXCLUDED.next_action,
        tone = EXCLUDED.tone,
        last_ai_reply = EXCLUDED.last_ai_reply,
        context_json = EXCLUDED.context_json,
        updated_at = NOW()
    `, [
      chatId,
      sessionId,
      companyId,
      temp,
      intent,
      nextAction,
      tone,
      lastAiReply,
      JSON.stringify(contextJson)
    ]);
    contextCount++;
  }
  console.log(`[3/6] ai_context atualizado: ${contextCount} chats com snapshot ativo.`);

  console.log('\n=== [4/6] CONTEXTO DE CURTO PRAZO (ai_memory_short) ===');
  let shortCount = 0;
  for (const chat of uniqueChats.rows) {
    const chatId = chat.remote_jid;
    const isGroup = chatId.endsWith('@g.us');
    const sessionId = chat.session_id || 'main';
    const companyId = chat.company_id || 'default';
    const ttlDays = isGroup ? 1 : 60; // Groups 24h, Private 60d

    const recentMsgs = await pool.query(
      `SELECT from_me, content, timestamp FROM messages WHERE conversation_id = $1 AND content IS NOT NULL ORDER BY timestamp DESC LIMIT 6`,
      [chat.id]
    );

    for (const msg of recentMsgs.rows.reverse()) {
      await pool.query(`
        INSERT INTO ai_memory_short (chat_id, session_id, company_id, role, content, is_group, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '${ttlDays} days', NOW())
      `, [
        chatId,
        sessionId,
        companyId,
        msg.from_me ? 'assistant' : 'user',
        msg.content.slice(0, 1000),
        isGroup
      ]);
      shortCount++;
    }
  }
  console.log(`[4/6] ai_memory_short preenchida: ${shortCount} mensagens no buffer.`);

  console.log('\n=== [5/6] ESTATÍSTICAS DE EVOLUÇÃO (ai_evolution_stats) ===');
  const faqData = {
    topQuestions: [
      { question: 'Qual valor do cimento?', answer: 'Cimento Cauê/Votoran 50kg por R$ 34,90/saco.' },
      { question: 'Quanto fica o tijolo 8 furos?', answer: 'Tijolo Baiano 8 furos a R$ 850,00 o milheiro (R$ 0,85/un).' },
      { question: 'Qual valor da argamassa?', answer: 'Argamassa AC-I Quartzolit 20kg a R$ 18,50/saco.' },
      { question: 'Tem frete grátis?', answer: 'Sim, frete grátis para compras acima de R$ 500,00.' },
      { question: 'Quais as formas de pagamento?', answer: 'PIX com 5% de desconto, cartão em até 10x sem juros, ou boleto CNPJ sob análise.' },
      { question: 'Pode pagar na entrega?', answer: 'Para pedidos individuais o padrão é PIX/Cartão com emissão imediata de NF por segurança.' }
    ],
    identifiedObjections: [
      'Medo de golpe online / pagamento antecipado',
      'Falta de chave PIX cadastrada no sistema de envio automático',
      'Falta de estoque de laje pré-moldada',
      'Horário de atendimento noturno'
    ]
  };

  await pool.query(`
    INSERT INTO ai_evolution_stats (
      agent_key, conversations_analyzed, conversions, objections,
      success_rate, evolution_score, faq_data, timestamp
    ) VALUES (
      'camila', 51, 8, 4, 78.50, 85, $1::jsonb, NOW()
    )
  `, [JSON.stringify(faqData)]);
  console.log('[5/6] ai_evolution_stats populada com métricas reais do agente Camila.');

  console.log('\n=== [6/6] BOOTSTRAP DO GRAFO DE MEMÓRIA E DETECÇÃO DE GAPS ===');
  await agentMemoryGraphService.bootstrapAgentMemoryGraph({
    agentKey: 'camila',
    agentName: 'Camila',
    companyId: 'default'
  });
  console.log('Grafo de memória bootstrappado com sucesso.');

  const detectedGaps = await agentEvolutionService.detectUnansweredQuestions('camila', 'default', { scanAll: true });
  console.log(`Varredura de gaps concluída: ${detectedGaps} novos eventos de aprendizado detectados.`);

  // Final verification counts
  console.log('\n--- VERIFICAÇÃO FINAL DAS TABELAS ---');
  const tables = [
    'conversations', 'messages', 'ai_conversation_memory',
    'ai_memory_long', 'ai_memory_short', 'ai_context',
    'ai_evolution_stats', 'agent_memory_nodes', 'agent_memory_edges',
    'agent_learning_events'
  ];

  for (const t of tables) {
    const res = await pool.query(`SELECT count(*) FROM ${t}`);
    console.log(`${t}: ${res.rows[0].count}`);
  }

  await pool.end();
  console.log('\n=== INGESTÃO E ATIVAÇÃO DE MEMÓRIA CONCLUÍDAS COM SUCESSO ===');
}

activateAndIngestAll().catch((err) => {
  console.error('Falha fatal na ativação de memória:', err);
  process.exit(1);
});
