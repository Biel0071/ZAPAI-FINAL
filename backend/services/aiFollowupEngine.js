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
  const productLabel = leadAlgorithm.primaryProductLabel && !leadAlgorithm.primaryProductLabel.includes('Churrasqueir') 
    ? leadAlgorithm.primaryProductLabel 
    : '';

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

  const productMention = productLabel ? ` sobre ${productLabel}` : '';
  const steps = [
    {
      delay: '4 a 6 horas',
      delayMinutes: 240,
      timingLabel: '1º Toque (4h sem retorno — Check-in Consultivo)',
      message:
        (leadAlgorithm.getProgressiveHook ? leadAlgorithm.getProgressiveHook(1) : leadAlgorithm.followupHook) ||
        `Olá ${name}, tudo bem? Fiquei pensando sobre nossa conversa${productMention}. Ficou alguma dúvida que eu possa esclarecer?`,
      type: 'algoritmo_lead_imediato',
      algorithmId: leadAlgorithm.algorithmId,
      recommendedQuickReplyId: leadAlgorithm.recommendedQuickReplyId,
      recommendedQuickReplyTitle: leadAlgorithm.recommendedQuickReplyTitle,
      goal: 'Check-in consultivo e acolhedor sobre o atendimento e dúvidas',
    },
    {
      delay: '24 horas',
      delayMinutes: 1440,
      timingLabel: '2º Toque (24h após Toque 1 — Condição de Atendimento)',
      message:
        (leadAlgorithm.getProgressiveHook ? leadAlgorithm.getProgressiveHook(2) : null) ||
        `Oi ${name}! Passando rapidinho para saber se podemos dar continuidade ao seu atendimento${productMention}. Quer que eu veja as melhores opções para você?`,
      type: 'envio_catalogo_padrao_loja',
      algorithmId: 'ALGO_CONSULTIVO_TECNICO',
      recommendedQuickReplyId: leadAlgorithm.recommendedQuickReplyId,
      recommendedQuickReplyTitle: leadAlgorithm.recommendedQuickReplyTitle,
      goal: 'Agregar valor com opções facilitadas e esclarecimento de dúvidas',
    },
    {
      delay: '48 horas',
      delayMinutes: 2880,
      timingLabel: '3º Toque (48h após Toque 2 — Encerramento Suave & Finalização)',
      message:
        (leadAlgorithm.getProgressiveHook ? leadAlgorithm.getProgressiveHook(3) : null) ||
        `Oi ${name}! Para não ficar te incomodando, estou deixando seu atendimento em aberto por aqui. Se precisar de algo ou quiser retomar o contato${productMention}, é só me chamar! Um abraço e boa semana!`,
      type: 'oferta_condicao_fechamento',
      algorithmId: 'ALGO_QUEBRA_OBJECAO_VALOR',
      goal: 'Encerramento suave e respeitoso deixando canal aberto sem pressão',
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
 * Deactivates follow-up for a conversation, setting tags 'followup_esgotado' and 'followup_desativado'
 * and removing 'followup_ia_ativo'.
 */
async function deactivateFollowupForConversation(conversationId, reason = 'auto_deactivated', context = {}) {
  if (!conversationId) return { ok: false };
  try {
    const { rows } = await query(
      `SELECT tags FROM conversations WHERE id = $1
       AND ($2::text IS NULL OR company_id = $2)
       AND ($3::text IS NULL OR session_id = $3)`,
      [conversationId, context.companyId || null, context.sessionId || null]
    );
    const currentTags = Array.isArray(rows[0]?.tags) ? rows[0].tags : [];
    const nextTags = Array.from(
      new Set([
        ...currentTags.filter((t) => t !== 'followup_ia_ativo'),
        'followup_esgotado',
        'followup_desativado',
      ])
    );
    try {
      await query(
        `UPDATE conversations
         SET tags = $2::text[],
             ai_last_followup_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND ($3::text IS NULL OR company_id = $3)
           AND ($4::text IS NULL OR session_id = $4)`,
        [conversationId, nextTags, context.companyId || null, context.sessionId || null]
      );
    } catch (updateErr) {
      if (updateErr.message && updateErr.message.includes('ai_last_followup_at')) {
        await query(
          `UPDATE conversations
           SET tags = $2::text[],
               updated_at = NOW()
           WHERE id = $1
             AND ($3::text IS NULL OR company_id = $3)
             AND ($4::text IS NULL OR session_id = $4)`,
          [conversationId, nextTags, context.companyId || null, context.sessionId || null]
        );
      } else {
        throw updateErr;
      }
    }
    console.log(`[AIFollowupEngine] Follow-up desativado para conversa ${conversationId} (motivo: ${reason})`);
    return { ok: true, conversationId, tags: nextTags, deactivated: true };
  } catch (err) {
    console.warn(`[AIFollowupEngine] Erro ao desativar follow-up para conversa ${conversationId}:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Resets / cancels follow-up when the customer sends a message, stopping further touches.
 */
async function resetFollowupOnCustomerResponse(conversationId) {
  if (!conversationId) return { ok: false };
  try {
    const { rows } = await query(`SELECT tags FROM conversations WHERE id = $1`, [conversationId]);
    const currentTags = Array.isArray(rows[0]?.tags) ? rows[0].tags : [];
    const hasFollowupTags = currentTags.some((t) => t.startsWith('followup_'));
    if (hasFollowupTags) {
      const nextTags = currentTags.filter((t) => !t.startsWith('followup_'));
      await query(
        `UPDATE conversations
         SET tags = $2::text[],
             updated_at = NOW()
         WHERE id = $1`,
        [conversationId, nextTags]
      );
      console.log(`[AIFollowupEngine] Follow-up resetado para conversa ${conversationId} pois cliente respondeu.`);
      return { ok: true, conversationId, tags: nextTags, reset: true };
    }
    return { ok: true, reset: false };
  } catch (err) {
    console.warn(`[AIFollowupEngine] Erro ao resetar follow-up para conversa ${conversationId}:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Executes an algorithmic follow-up for a stalled lead if they haven't purchased yet.
 * Respects progressive touches (Attempt 1: check-in, Attempt 2: value/freight/payment, Attempt 3: soft closing)
 * and strictly caps at 3 attempts maximum, automatically deactivating on attempt 3 exhaustion.
 */
async function executeAlgorithmicFollowupForLead({ conversationId, companyId = 'default', sessionId = null, attempt = null, allowSessionResume = false }) {
  const { conversation, history, leadAlgorithm } = await loadConversationWithHistory({
    conversationId,
    companyId,
  });

  if (!conversation) {
    return { ok: false, reason: 'conversation_not_found' };
  }

  // Count consecutive agent/bot messages without customer reply
  let consecutiveAgentMsgs = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].from === 'agent' || history[i].role === 'assistant') {
      consecutiveAgentMsgs++;
    } else {
      break;
    }
  }

  const convTags = Array.isArray(conversation.tags) ? conversation.tags : [];

  // If already deactivated/exhausted, skip immediately
  if (convTags.includes('followup_esgotado') || convTags.includes('followup_desativado')) {
    return {
      ok: false,
      skipped: true,
      reason: 'max_attempts_exceeded',
      deactivated: true,
      consecutiveAgentMsgs,
    };
  }

  // Check terminal purchase status: cancel follow-up immediately
  if (leadAlgorithm.hasPurchased) {
    await deactivateFollowupForConversation(conversation.id, `already_purchased_${leadAlgorithm.purchaseReason}`);
    return {
      ok: false,
      skipped: true,
      reason: 'already_purchased',
      purchaseReason: leadAlgorithm.purchaseReason,
      leadAlgorithm,
    };
  }

  // Accurately determine follow-up attempts sent so far
  let followupsSent = 0;
  if (convTags.includes('followup_toque_3')) {
    followupsSent = 3;
  } else if (convTags.includes('followup_toque_2')) {
    followupsSent = 2;
  } else if (convTags.includes('followup_toque_1')) {
    followupsSent = 1;
  } else {
    const hasAnyCustomerMsg = history.some((m) => m.from === 'client' || m.role === 'user');
    if (!hasAnyCustomerMsg) {
      followupsSent = consecutiveAgentMsgs;
    } else {
      followupsSent = 0;
    }
  }

  const currentAttempt = attempt || (followupsSent + 1);

  // Auto-deactivate if maximum 3 attempts were already reached without customer response
  if (followupsSent >= 3 || currentAttempt > 3 || consecutiveAgentMsgs >= 3) {
    await deactivateFollowupForConversation(conversation.id, 'max_attempts_exceeded_3');
    return {
      ok: false,
      skipped: true,
      reason: 'max_attempts_exceeded',
      deactivated: true,
      consecutiveAgentMsgs,
    };
  }

  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT) || process.argv.some((a) => a.includes('test'));
  if (!isTestEnv) {
    const sessionManager = require('./sessionManager');
    const session = sessionManager.getSession(sessionId || conversation.session_id);
    if (!session?.sock || String(session.status || '').toLowerCase() !== 'connected'
      || session.systemConnected === false || (session.automationPaused === true && allowSessionResume !== true)
      || (session.companyId && String(session.companyId) !== String(companyId))) {
      return { ok: false, skipped: true, reason: 'session_disconnected' };
    }
  }

  const targetJid = conversation.remote_jid || conversation.phone;
  const resolvedSessionId = sessionId || conversation.session_id || 'default';

  // Progressive angle selection:
  // Attempt 1: Check-in on product/quote
  // Attempt 2: Value / freight / payment options
  // Attempt 3: Soft closing
  let followupText = '';
  if (typeof leadAlgorithm.getProgressiveHook === 'function') {
    followupText = leadAlgorithm.getProgressiveHook(currentAttempt);
  } else if (leadAlgorithm.progressiveHooks?.[currentAttempt]) {
    followupText = leadAlgorithm.progressiveHooks[currentAttempt];
  } else {
    followupText = leadAlgorithm.followupHook || '';
  }
  followupText = (followupText || '').trim();

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

  const existingTags = convTags;
  const isFinalAttempt = currentAttempt >= 3;
  const filteredTags = isFinalAttempt
    ? existingTags.filter((t) => t !== 'followup_ia_ativo')
    : existingTags;

  const nextTags = Array.from(
    new Set([
      ...filteredTags,
      ...(isFinalAttempt ? ['followup_esgotado', 'followup_desativado'] : ['followup_ia_ativo']),
      `followup_toque_${currentAttempt}`,
      leadAlgorithm.algorithmCode.toLowerCase(),
      `estilo_${leadAlgorithm.conversationStyle}`,
    ])
  );

  const hasDeactivation = (conversation.tags || []).some((t) => {
    const s = String(t).toLowerCase();
    return ['desativado', 'ai_desativado', 'pausado', 'intervencao', 'intervencao_humana', 'atendimento_manual', 'manual', 'nao_reativar'].some((k) => s.includes(k));
  });
  const keepAiEnabled = conversation.ai_enabled !== false && !hasDeactivation && !['paused', 'closed', 'finalizado', 'pago'].includes(conversation.status);

  try {
    await query(
      `UPDATE conversations
       SET ai_enabled = $3,
           agent_name = COALESCE(NULLIF(agent_name, ''), 'Camila'),
           tags = $2::text[],
           ai_last_followup_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [conversation.id, nextTags, keepAiEnabled]
    );
  } catch (updateErr) {
    if (updateErr.message && updateErr.message.includes('ai_last_followup_at')) {
      await query(
        `UPDATE conversations
         SET ai_enabled = $3,
             agent_name = COALESCE(NULLIF(agent_name, ''), 'Camila'),
             tags = $2::text[],
             updated_at = NOW()
         WHERE id = $1`,
        [conversation.id, nextTags, keepAiEnabled]
      );
    } else {
      throw updateErr;
    }
  }

  const outboundQueueService = require('./outboundQueueService');
  const delayMs = Math.floor(Math.random() * (18000 - 9000 + 1)) + 9000;
  const typingMs = Math.floor(Math.random() * (11000 - 6000 + 1)) + 6000;
  const dateKey = new Date().toISOString().slice(0, 13);

  const queuePayload = {
    companyId: conversation.company_id || companyId,
    phone: targetJid,
    sessionId: resolvedSessionId,
    correlationId: `algo_followup_${conversation.id}_t${currentAttempt}_${dateKey}`,
    text: followupText,
    delayMs,
    typingMs,
    metadata: {
      systemTag: 'ai_algorithmic_followup',
      ai_response: true,
      conversationId: conversation.id,
      attempt: currentAttempt,
      maxAttempts: 3,
      algorithmId: leadAlgorithm.algorithmId,
      conversationStyle: leadAlgorithm.conversationStyle,
      source: 'ai_followup',
    },
  };
  const queueResult = allowSessionResume === true
    ? await outboundQueueService.enqueueReviewed(queuePayload)
    : await outboundQueueService.enqueue(queuePayload);

  return {
    ok: true,
    conversationId: conversation.id,
    phone: targetJid,
    attempt: currentAttempt,
    maxAttempts: 3,
    followupText,
    leadAlgorithm,
    queueResult,
  };
}

async function listSessionFollowups({ companyId, sessionId }) {
  if (!companyId || !sessionId) return [];
  const { rows } = await query(
    `SELECT c.id, c.remote_jid, COALESCE(l.phone, c.remote_jid) AS phone,
            COALESCE(NULLIF(l.name, ''), 'Cliente') AS name, c.tags
     FROM conversations c
     LEFT JOIN leads l ON l.id = c.lead_id
     WHERE c.company_id = $1 AND c.session_id = $2
       AND c.status = 'open' AND c.ai_enabled = true
       AND COALESCE(c.funnel_stage, '') NOT IN ('closed', 'fechamento', 'agendado', 'cancelado', 'suporte', 'aguardando_pix', 'finalizado', 'pago', 'concluido', 'pedido_confirmado', 'won')
       AND NOT ('followup_esgotado' = ANY(COALESCE(c.tags, '{}')))
       AND NOT ('followup_desativado' = ANY(COALESCE(c.tags, '{}')))
       AND c.updated_at < NOW() - INTERVAL '2 hours'
       AND c.updated_at > NOW() - INTERVAL '14 days'
       AND c.remote_jid NOT LIKE '%@g.us%'
       AND c.remote_jid NOT LIKE '%@broadcast%'
       AND c.remote_jid NOT LIKE '%status%'
     ORDER BY c.updated_at DESC
     LIMIT 500`,
    [companyId, sessionId]
  );
  return rows.map((row) => {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const followupsSent = tags.includes('followup_toque_3') ? 3
      : tags.includes('followup_toque_2') ? 2
        : tags.includes('followup_toque_1') ? 1 : 0;
    return { ...row, followupsSent };
  });
}

module.exports = {
  generateFollowupPlan,
  generateRecoveryApproach,
  executeAlgorithmicFollowupForLead,
  deactivateFollowupForConversation,
  resetFollowupOnCustomerResponse,
  loadConversationWithHistory,
  listSessionFollowups,
};
