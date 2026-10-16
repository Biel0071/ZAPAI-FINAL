/**
 * AI Follow-up & Lead Recovery Engine Service
 * Automatically plans and schedules non-robotic, multi-touch follow-ups for stalled conversations.
 */

const { query } = require('../src/infrastructure/config/database');
const { buildLeadAlgorithm } = require('./leadAnalyzer');

async function loadConversationWithHistory({ conversationId, phone, companyId = 'default' }) {
  let conversation = null;
  try {
    const res = await query(
      `SELECT c.id, c.remote_jid, COALESCE(l.phone, c.remote_jid) AS phone,
              COALESCE(NULLIF(l.name, ''), 'Cliente') AS lead_name,
              c.summary, c.last_message, c.lead_temperature, c.lead_intent,
              c.funnel_stage, c.tags, c.ai_enabled, c.agent_name, c.session_id,
              c.company_id, c.updated_at
       FROM conversations c
       LEFT JOIN leads l ON l.id = c.lead_id
       WHERE c.company_id = $3
         AND (
           ($1::text IS NOT NULL AND c.id::text = $1::text)
           OR ($2::text IS NOT NULL AND (l.phone = $2 OR c.remote_jid = $2))
         )
       ORDER BY c.updated_at DESC
       LIMIT 1`,
      [conversationId ? String(conversationId) : null, phone ? String(phone) : null, companyId]
    );
    conversation = res.rows[0] || null;
  } catch (err) {
    console.warn('[AIFollowupEngine] DB Query error:', err.message);
  }

  let history = [];
  if (conversation?.id) {
    try {
      const msgRes = await query(
        `SELECT sender, content, timestamp
         FROM messages
         WHERE conversation_id = $1
         ORDER BY timestamp DESC
         LIMIT 8`,
        [conversation.id]
      );
      history = (msgRes.rows || []).reverse().map((m) => ({
        from: m.sender === 'contact' || m.sender === 'client' ? 'client' : 'agent',
        role: m.sender === 'contact' || m.sender === 'client' ? 'user' : 'assistant',
        text: m.content || '',
        content: m.content || '',
        timestamp: m.timestamp,
      }));
    } catch (_msgErr) {}
  }

  const lastClientMsg =
    [...history].reverse().find((m) => m.from === 'client')?.text ||
    conversation?.last_message ||
    '';

  const leadAlgorithm = buildLeadAlgorithm(lastClientMsg, history, {
    ...(conversation || {}),
    name: conversation?.lead_name || 'Cliente',
  });

  return { conversation, history, lastClientMsg, leadAlgorithm };
}

/**
 * Generates an automated multi-step follow-up plan for a given lead/conversation
 * tailored by the Lead Algorithm & Store Standard.
 */
async function generateFollowupPlan({ conversationId, phone, companyId = 'default' }) {
  const { conversation, leadAlgorithm } = await loadConversationWithHistory({
    conversationId,
    phone,
    companyId,
  });

  const rawName = conversation?.lead_name || 'Cliente';
  const name =
    rawName && !rawName.includes('@') && !/^\d+$/.test(rawName)
      ? rawName.split(/\s+/)[0]
      : 'Cliente';
  const temperature = conversation?.lead_temperature || leadAlgorithm.leadTemperature || 'warm';
  const productLabel = leadAlgorithm.primaryProductLabel || 'Churrasqueiras & Materiais';

  if (leadAlgorithm.hasPurchased) {
    return {
      success: true,
      data: {
        conversationId: conversationId || conversation?.id,
        phone: phone || conversation?.phone,
        leadName: name,
        temperature,
        hasPurchased: true,
        shouldFollowUp: false,
        purchaseReason: leadAlgorithm.purchaseReason,
        leadAlgorithm,
        totalSteps: 0,
        steps: [],
        createdAt: new Date().toISOString(),
      },
    };
  }

  const steps = [
    {
      delay: '2 horas',
      delayMinutes: 120,
      timingLabel: '1º Toque (2h sem retorno — Algoritmo do Lead)',
      message:
        leadAlgorithm.followupHook ||
        `Olá ${name}, tudo bem? Fiquei pensando sobre o orçamento de ${productLabel} que conversamos. Ficou alguma dúvida sobre medidas ou entrega que eu possa esclarecer?`,
      type: 'algoritmo_lead_imediato',
      algorithmId: leadAlgorithm.algorithmId,
      recommendedQuickReplyId: leadAlgorithm.recommendedQuickReplyId,
      recommendedQuickReplyTitle: leadAlgorithm.recommendedQuickReplyTitle,
      goal: `Retomar conversa no estilo ${leadAlgorithm.styleLabel}`,
    },
    {
      delay: '24 horas',
      delayMinutes: 1440,
      timingLabel: '2º Toque (24h — Resposta Rápida + Catálogo Técnico)',
      message: `Oi ${name}! Separei as fotos e especificações atualizadas de ${productLabel} no padrão da nossa loja. Quer que eu calcule o frete certinho para o seu CEP?`,
      type: 'envio_catalogo_padrao_loja',
      algorithmId: 'ALGO_CONSULTIVO_TECNICO',
      recommendedQuickReplyId: leadAlgorithm.recommendedQuickReplyId,
      recommendedQuickReplyTitle: leadAlgorithm.recommendedQuickReplyTitle,
      goal: 'Agregar valor técnico com mídia oficial da loja sem pressionar',
    },
    {
      delay: '3 dias',
      delayMinutes: 4320,
      timingLabel: '3º Toque (3 dias — Condição Especial PIX / 10x)',
      message: `${name}, conseguimos manter a condição promocional de ${productLabel} (desconto à vista no PIX ou parcelamento facilitado e pagamento na entrega) nesta semana! Posso reservar no seu nome?`,
      type: 'oferta_condicao_fechamento',
      algorithmId: 'ALGO_QUEBRA_OBJECAO_VALOR',
      goal: 'Ativar gatilho de benefício financeiro e segurança na entrega',
    },
  ];

  return {
    success: true,
    data: {
      conversationId: conversationId || conversation?.id,
      phone: phone || conversation?.phone,
      leadName: name,
      temperature,
      hasPurchased: false,
      shouldFollowUp: true,
      leadAlgorithm,
      totalSteps: steps.length,
      steps,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Triggers an AI recovery approach for a lead stalled for X days/hours
 */
async function generateRecoveryApproach({ conversationId, phone, lastTopic = '', companyId = 'default' }) {
  const { conversation, leadAlgorithm } = await loadConversationWithHistory({
    conversationId,
    phone,
    companyId,
  });

  if (leadAlgorithm.hasPurchased) {
    return {
      success: true,
      data: {
        conversationId: conversation?.id || conversationId,
        phone: conversation?.phone || phone,
        skipped: true,
        reason: 'Cliente já realizou compra ou agendamento confirmado.',
        leadAlgorithm,
      },
    };
  }

  return {
    success: true,
    data: {
      conversationId: conversation?.id || conversationId,
      phone: conversation?.phone || phone,
      approachType: leadAlgorithm.algorithmId,
      algorithmName: leadAlgorithm.algorithmName,
      conversationStyle: leadAlgorithm.conversationStyle,
      suggestedMessage: leadAlgorithm.followupHook,
      recommendedQuickReplyId: leadAlgorithm.recommendedQuickReplyId,
      recommendedQuickReplyTitle: leadAlgorithm.recommendedQuickReplyTitle,
      conversionHook: leadAlgorithm.storeStandardRule,
      recommendedChannel: 'WhatsApp Direct',
      leadAlgorithm,
    },
  };
}

const recentFollowupDispatches = new Map();
const FOLLOWUP_DEDUP_WINDOW_MS = 60 * 1000;

/**
 * Executes an algorithmic follow-up for a stalled lead if they haven't purchased yet.
 */
async function executeAlgorithmicFollowupForLead({ conversationId, companyId = 'default', sessionId = null }) {
  const { conversation, leadAlgorithm } = await loadConversationWithHistory({
    conversationId,
    companyId,
  });

  if (!conversation) {
    return { ok: false, reason: 'conversation_not_found' };
  }

  if (leadAlgorithm.hasPurchased) {
    return {
      ok: false,
      skipped: true,
      reason: 'already_purchased',
      purchaseReason: leadAlgorithm.purchaseReason,
      leadAlgorithm,
    };
  }

  const targetJid = conversation.remote_jid || conversation.phone;
  const resolvedSessionId = sessionId || conversation.session_id || 'default';
  const followupText = (leadAlgorithm.followupHook || '').trim();

  // Strict anti-empty message guard: never send blank bubbles
  if (!followupText) {
    console.warn(`[AIFollowupEngine] Refusing to send empty follow-up text to conversation ${conversation.id}`);
    return { ok: false, skipped: true, reason: 'empty_followup_text' };
  }

  // Deduplication guard: do not double-dispatch followups to the same lead within 60s
  const dedupKey = `${conversation.company_id || companyId}:${targetJid}`;
  const now = Date.now();
  const lastDispatched = recentFollowupDispatches.get(dedupKey);
  if (lastDispatched && now - lastDispatched < FOLLOWUP_DEDUP_WINDOW_MS) {
    console.log(`[AIFollowupEngine] Suppressed duplicate follow-up dispatch for ${targetJid} within window`);
    return { ok: true, skipped: true, reason: 'duplicate_suppressed' };
  }
  recentFollowupDispatches.set(dedupKey, now);

  const existingTags = Array.isArray(conversation.tags) ? conversation.tags : [];
  const nextTags = Array.from(
    new Set([
      ...existingTags,
      'followup_ia_ativo',
      leadAlgorithm.algorithmCode.toLowerCase(),
      `estilo_${leadAlgorithm.conversationStyle}`,
    ])
  );

  await query(
    `UPDATE conversations
     SET ai_enabled = true,
         agent_name = COALESCE(NULLIF(agent_name, ''), 'Camila'),
         tags = $2::text[],
         updated_at = NOW()
     WHERE id = $1`,
    [conversation.id, nextTags]
  );

  const outboundQueueService = require('./outboundQueueService');
  const delayMs = Math.floor(Math.random() * (18000 - 9000 + 1)) + 9000;
  const typingMs = Math.floor(Math.random() * (11000 - 6000 + 1)) + 6000;
  const dateKey = new Date().toISOString().slice(0, 13);

  const queueResult = await outboundQueueService.enqueue({
    companyId: conversation.company_id || companyId,
    phone: targetJid,
    sessionId: resolvedSessionId,
    correlationId: `algo_followup_${conversation.id}_${dateKey}`,
    text: followupText,
    delayMs,
    typingMs,
    metadata: {
      systemTag: 'ai_algorithmic_followup',
      ai_response: true,
      conversationId: conversation.id,
      algorithmId: leadAlgorithm.algorithmId,
      conversationStyle: leadAlgorithm.conversationStyle,
      source: 'ai_followup',
    },
  });

  return {
    ok: true,
    conversationId: conversation.id,
    phone: targetJid,
    followupText,
    leadAlgorithm,
    queueResult,
  };
}

module.exports = {
  generateFollowupPlan,
  generateRecoveryApproach,
  executeAlgorithmicFollowupForLead,
  loadConversationWithHistory,
};
