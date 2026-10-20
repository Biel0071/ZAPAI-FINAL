const { getAIIntegrationStatus, processAI } = require('./ai.service');
const { getAutomationPermission } = require('../src/infrastructure/config/aiToggle');
const sessionManager = require('./sessionManager');
const conversationRepository = require('../src/data/repositories/conversationRepository');
const messageRepository = require('../src/data/repositories/messageRepository');
const outboundQueueService = require('./outboundQueueService');
const whatsappService = require('./whatsappService');
const messagesController = require('../src/api/controllers/messagesController');
const contactRepository = require('../src/data/repositories/contactRepository');
const aiIntelligenceService = require('./aiIntelligenceService');
const { analyzeLeadIntent } = require('./leadAnalyzer');
const { buildLeadTags, getNextFunnelStage } = require('./salesFunnel');
const { generateSalesStrategy } = require('./salesStrategyEngine');
const conversationRuntimeService = require('../src/messaging/inbox/inbox/services/ConversationRuntimeService');
const { emitAIResponseProgress } = require('./aiResponseProgressService');
const delayEngine = require('../src/ai/agents/engine/delayEngine');

const absenceCooldowns = new Map();
const ABSENCE_COOLDOWN_MS = Number(process.env.ABSENCE_REPLY_COOLDOWN_MS || 7200000); // 2 hours cooldown

function matchEscalationTrigger(text, triggers = []) {
  if (!text || !Array.isArray(triggers) || triggers.length === 0) return null;
  const lowerText = text.toLowerCase();

  const triggerPatterns = {
    "cliente pediu humano": [/humano/i, /humana/i, /atendente/i, /atendimento humano/i, /suporte humano/i, /falar com alguem/i, /falar com alguém/i, /operador/i, /pessoa/i],
    "cliente pediu ligação": [/ligar/i, /liga/i, /ligacao/i, /ligação/i, /me liga/i, /telefone/i, /chamada/i],
    "cliente reclamou": [/reclamar/i, /reclama/i, /ruim/i, /errado/i, /problema/i, /queixa/i, /absurdo/i, /pessimo/i, /péssimo/i, /horrivel/i, /horrível/i, /insatisfeito/i],
    "cliente pediu orçamento complexo": [/complexo/i, /projeto/i, /grande quantidade/i, /atacado/i, /desconto especial/i, /negociar preco/i, /negociar preço/i, /lote/i]
  };

  for (const trigger of triggers) {
    const patterns = triggerPatterns[trigger];
    if (patterns) {
      for (const pattern of patterns) {
        if (pattern.test(lowerText)) {
          return trigger;
        }
      }
    }
  }
  return null;
}

const fsp = require('fs/promises');
const path = require('path');
async function logEscalation(escalation) {
  const logDir = path.join(__dirname, '..', 'logs');
  await fsp.mkdir(logDir, { recursive: true });
  const logFile = path.join(logDir, 'escalations.json');
  let currentLogs = [];
  try {
    const data = await fsp.readFile(logFile, 'utf8');
    currentLogs = JSON.parse(data);
  } catch {}
  currentLogs.push(escalation);
  await fsp.writeFile(logFile, JSON.stringify(currentLogs, null, 2), 'utf8');
}

function mapLeadTemperature(score) {
  const val = Number(score || 0);
  if (val >= 0.7) return 'hot';
  if (val >= 0.4) return 'warm';
  return 'cold';
}

function randomProfileDelay(profile, fallbackMin = 12000, fallbackMax = 25000) {
  if (!profile || typeof profile !== 'object') {
    return Math.floor(Math.random() * (fallbackMax - fallbackMin + 1)) + fallbackMin;
  }
  const minMs = Math.max(0, Number(profile.minMs) || fallbackMin);
  const maxMs = Math.max(minMs, Number(profile.maxMs) || fallbackMax || minMs);
  return maxMs === minMs ? minMs : Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function isBusinessOpen() {
  const businessHoursConfig = require('../src/infrastructure/config/businessHours');
  return businessHoursConfig.isBusinessOpen();
}

async function checkLeadBlocked(phone, companyId) {
  try {
    return await contactRepository.isLeadBlocked(phone, companyId);
  } catch (error) {
    console.error('[AutomationEngine] Failed to check lead blocked:', error.message);
    return false;
  }
}

async function processMessage({ payload, conversation, store, sock, sessionId }) {
  const phone = payload.phone;
  const incomingText = payload.text || '';
  const conversationId = conversation?.id;
  const companyId = conversation?.company_id || conversation?.companyId || payload?.companyId;
  const io = store?.io || global.io;
  const progressStartedAt = new Date().toISOString();
  const publishProgress = (status, details = {}) => emitAIResponseProgress(io, {
    companyId,
    conversationId,
    phone,
    sessionId,
    startedAt: progressStartedAt,
    status,
    ...details,
  });

  console.log(`[AutomationEngine] Starting pipeline for ${phone}: "${incomingText}"`);

  // Reset / cancel active follow-up sequence since the customer has actively responded
  if (conversationId) {
    try {
      const { resetFollowupOnCustomerResponse } = require('./aiFollowupEngine');
      void resetFollowupOnCustomerResponse(conversationId).catch(() => {});
    } catch (_) {}
  }

  // 1. Rules Engine: Blocked Contact Check
  const isBlocked = await checkLeadBlocked(phone, companyId);
  if (isBlocked) {
    console.log(`[AutomationEngine] Lead ${phone} is blocked. Stopping pipeline.`);
    return { success: false, reason: 'lead_blocked' };
  }

  // 2. CRM Intelligence Engine (Always Executes)
  const crmIntelligence = require('./crm-intelligence');
  const crmContext = await crmIntelligence.processIncomingMessage({
    sessionId,
    conversationId,
    contact: { phone, name: conversation?.name || phone },
    message: incomingText,
    conversation,
    store
  });

  // Short-circuit automated replies if the current store disabled AI.
  const automationPermission = await getAutomationPermission({ companyId, sessionId, phone });
  if (!automationPermission.allowed) {
    console.log(`[AutomationEngine] Automatic reply blocked: ${automationPermission.reason}`);
    publishProgress('disabled', { message: 'Automação pausada ou conversa fora do alcance configurado.' });
    return { success: false, reason: automationPermission.reason };
  }

  // (b) session systemConnection is OFF
  const session = sessionManager.getSession(sessionId);
  if (!session || session.companyId !== companyId || session.systemConnected === false || session.automationPaused === true) {
    console.log(`[AutomationEngine] Session/Line ${sessionId} is not enabled for AI. Short-circuiting response for ${phone}.`);
    publishProgress('disabled', { message: 'IA desativada nesta conexao do WhatsApp.' });
    return { success: false, reason: session?.automationPaused ? 'session_automation_paused' : 'session_ai_disabled' };
  }

  // (c) human takeover / conversation AI OFF (authoritative DB + runtime pause)
  let conversationAIEnabled = conversation?.aiEnabled !== false && conversation?.ai_enabled !== false;
  let authoritativeConversation = conversation || null;
  try {
    const fresh = await conversationRepository.getConversationByPhone(phone, companyId, sessionId).catch(() => null);
    if (fresh) {
      authoritativeConversation = fresh;
      conversationAIEnabled = fresh.aiEnabled !== false && fresh.ai_enabled !== false;
    }
  } catch (err) {
    console.error('[AutomationEngine] Failed to check fresh conversation AI toggle:', err.message);
  }

  const hasDeactivation = (authoritativeConversation?.tags || []).some((t) => {
    const s = String(t).toLowerCase();
    return [
      'desativado',
      'ai_desativado',
      'pausado',
      'intervencao',
      'intervencao_humana',
      'atendimento_manual',
      'manual',
      'nao_reativar',
      'aguarda_pix',
      'pago',
      'finalizado',
      'followup_desativado',
      'followup_esgotado',
    ].some((k) => s.includes(k));
  });

  const isPermanentlyDisabled =
    !conversationAIEnabled ||
    hasDeactivation ||
    ['paused', 'closed', 'finalizado', 'pago', 'pending_human', 'intervencao_humana'].includes(authoritativeConversation?.status) ||
    ['intervencao_humana', 'fechado', 'perdido', 'cancelado', 'aguardando_pix', 'finalizado', 'pago'].includes(authoritativeConversation?.funnel_stage);

  if (isPermanentlyDisabled) {
    console.log(`[AutomationEngine] AI is paused/deactivated for conversation ${phone}. Stopping response.`);
    publishProgress('disabled', { message: 'IA pausada nesta conversa.' });
    return { success: false, reason: 'conversation_ai_deactivated' };
  }

  const runtimeCheck = conversationRuntimeService.refreshExpiredHumanTakeover(store, authoritativeConversation?.id || conversationId);
  if (runtimeCheck.runtime?.controlMode === 'human_active' || runtimeCheck.runtime?.controlMode === 'paused_ai') {
    console.log('[AutomationEngine] Human takeover active for ' + phone + '. Short-circuiting response until ' + runtimeCheck.runtime.aiPausedUntil + '.');
    return { success: false, reason: 'human_active' };
  }

  if (runtimeCheck.expired && authoritativeConversation?.id && !isPermanentlyDisabled) {
    const updated = await conversationRepository.updateConversationState(authoritativeConversation.id, { aiEnabled: true });
    if (updated) {
      const io = store?.io || global.io;
      io?.emit('conversation_updated', updated);
    }
    conversationAIEnabled = true;
    console.log('[AutomationEngine] Human takeover expired for ' + phone + '. AI re-enabled legitimately.');
  }

  if (!conversationAIEnabled) {
    console.log('[AutomationEngine] AI is OFF for conversation ' + phone + '. Short-circuiting response.');
    publishProgress('disabled', { message: 'IA pausada nesta conversa.' });
    return { success: false, reason: 'conversation_ai_off' };
  }

  // 3. Rules Engine: Business Hours Check
  const { businessHours: bhConfig } = require('../src/infrastructure/config/businessHours');
  if (bhConfig.autoReplyOutsideHours !== false && !isBusinessOpen()) {
    const systemSettingsRepository = require('../src/data/repositories/systemSettingsRepository');
    let businessHours = { absenceMessage: 'No momento estamos fechados. Retornaremos em breve!' };
    try {
      const raw = await systemSettingsRepository.getSetting('business_hours');
      if (raw && raw.value) {
        businessHours = typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value;
      }
    } catch {}

    const reactivationService = require('./reactivationService');
    await reactivationService.enqueueOutofHoursContact({
      phone,
      text: incomingText,
      companyId,
      sessionId,
    });

    const cooldownKey = `${companyId}:${phone}`;
    const lastSentAt = absenceCooldowns.get(cooldownKey) || (store?.absenceState?.[phone]?.sentAt ? new Date(store.absenceState[phone].sentAt).getTime() : 0);
    const now = Date.now();
    const isCooldownActive = lastSentAt && (now - lastSentAt) < ABSENCE_COOLDOWN_MS;

    if (isCooldownActive) {
      console.log(`[AutomationEngine] Absence reply suppressed by cooldown (${Math.round((now - lastSentAt) / 1000)}s ago) for ${phone}.`);
      return { success: true, action: 'absence_reply_cooldown_suppressed' };
    }

    absenceCooldowns.set(cooldownKey, now);
    if (store) {
      if (!store.absenceState) store.absenceState = {};
      store.absenceState[phone] = { sent: true, sentAt: new Date(now).toISOString(), companyId };
      if (conversationId) {
        store.absenceState[conversationId] = store.absenceState[phone];
      }
    }

    console.log(`[AutomationEngine] Business is closed. Enqueueing single absence message for ${phone}.`);
    const dateKey = new Date().toISOString().slice(0, 10);
    const correlationId = `absence_${companyId}_${phone}_${dateKey}`;

    await outboundQueueService.enqueue({
      companyId,
      phone,
      sessionId,
      correlationId,
      text: businessHours.absenceMessage || bhConfig.absenceMessage,
      metadata: { systemTag: 'absence', ai_response: true, conversationId, source: 'ai' }
    });
    return { success: true, action: 'absence_reply_queued' };
  }

  // 3. Rules Engine: Load Active Agent
  const aiAgentService = require('../src/ai/agents/services/aiAgentService');
  let matchedAgent = null;
  let ambiguousAssignment = false;
  try {
    const allAgents = await aiAgentService.listAgents(companyId);
    const activeAgents = aiAgentService.getActiveAgentsSync(companyId);
    const assigned = allAgents.filter(agent => agent.sessionIds?.includes(sessionId));
    const eligible = assigned.length ? assigned : activeAgents.filter(agent => !agent.sessionIds?.length);
    ambiguousAssignment = eligible.length > 1;
    matchedAgent = eligible.length === 1 && activeAgents.some(agent => agent.key === eligible[0].key) ? eligible[0] : null;
  } catch (err) {
    console.error('[AutomationEngine] Failed to load agent configuration:', err);
  }

  if (ambiguousAssignment) {
    publishProgress('no_agent', { message: 'Há mais de um atendente vinculado a este WhatsApp. Escolha o responsável em Atendentes.' });
    return { success: false, reason: 'ambiguous_session_agent' };
  }

  if (!matchedAgent) {
    console.log(`[AutomationEngine] No store-specific agent configured for tenant ${companyId}.`);
    publishProgress('no_agent', { message: 'Nenhum atendente ativo foi configurado para esta loja.' });
    return { success: false, reason: 'no_store_agent' };
  }

  const plannedResponseDelayMs = randomProfileDelay(matchedAgent.delayProfile, 12000, 25000);
  const plannedTypingDelayMs = randomProfileDelay(matchedAgent.typingDelayProfile, 6000, 14000);
  const estimatedGenerationMs = 8_000;
  publishProgress('analyzing', {
    agentName: matchedAgent.name,
    estimatedMs: estimatedGenerationMs + plannedResponseDelayMs + plannedTypingDelayMs,
    message: `${matchedAgent.name} esta entendendo a conversa.`,
  });

  // 4. Rules Engine: Human Escalation check
  const aiEnabledGlobal = conversationAIEnabled;
  let matchedTrigger = null;
  if (matchedAgent.escalationActive && aiEnabledGlobal) {
    matchedTrigger = matchEscalationTrigger(incomingText, matchedAgent.escalationTriggers);
  }

  if (matchedTrigger) {
    await logEscalation({
      motivo: matchedTrigger,
      data: new Date().toISOString(),
      cliente: conversation?.name || phone,
      telefone: phone
    });

    const escalationTarget = matchedAgent.escalationWhatsapp || matchedAgent.escalationPhone;
    if (escalationTarget && (await getAutomationPermission({ companyId, sessionId, phone: escalationTarget })).allowed) {
      const alertMsg = `⚠️ [ALERTA DE TRANSBORDO] O cliente ${conversation?.name || phone} (${phone}) ativou o gatilho "${matchedTrigger}". Motivo: "${incomingText}". Por favor, assuma o atendimento.`;
      try {
        await whatsappService.sendMessage(sock, escalationTarget, alertMsg, { beforeSend: () => getAutomationPermission({ companyId, sessionId, phone: escalationTarget }) });
      } catch (err) {
        console.error('[AutomationEngine] Failed to send WhatsApp escalation alert:', err);
      }
    } else if (escalationTarget) {
      console.log('[AutomationEngine] Escalation alert blocked: destination outside automation scope or AI paused.');
    }

    if (matchedAgent.escalationMode === 2 || matchedAgent.escalationMode === 3) {
      await conversationRepository.updateConversationAIEnabled(phone, false, companyId);
      const io = store?.io || global.io;
      io?.emit('conversation:update', {
        id: conversationId,
        aiEnabled: false,
        phone,
        sessionId
      });
      publishProgress('cancelled', {
        agentName: matchedAgent.name,
        message: 'Atendimento transferido para uma pessoa; resposta automatica cancelada.',
      });
      console.log(`[AutomationEngine] Escalated to human. AI disabled for conversation ${conversationId}`);
      return { success: true, action: 'escalated_to_human' };
    }
  }

  // 5. Rules Engine: AI Configuration Check
  const integrationStatus = await getAIIntegrationStatus(store, companyId);
  if (!integrationStatus.aiOn || !aiEnabledGlobal) {
    publishProgress('disabled', {
      agentName: matchedAgent.name,
      message: !integrationStatus.aiOn
        ? 'Nenhum provedor de IA ativo esta disponivel para esta loja.'
        : 'IA pausada nesta conversa.',
    });
    console.log(`[AutomationEngine] AI is OFF (integration: ${integrationStatus.aiOn}, conversation: ${aiEnabledGlobal}). Stopping pipeline.`);
    return { success: false, reason: 'ai_off' };
  }

  // 6. Automation Engine: call processAI using the context generated by CRM Intelligence
  const leadHistory = crmContext.leadHistory || [];
  const funnelStage = crmContext.funnelStage || 'new_lead';
  const leadAnalysis = crmContext.analysis || {};
  const leadAlgorithm = crmContext.leadAlgorithm || leadAnalysis.leadAlgorithm || null;
  const tags = crmContext.tags || [];
  const salesStrategy = generateSalesStrategy(leadAnalysis);
  const aiAntiRepetitionService = require('./aiAntiRepetitionService');
  const recentBotReplies = aiAntiRepetitionService.extractRecentBotReplies(leadHistory, 20);

  console.log(`[AutomationEngine] Calling AI Engine for conversation ${conversationId} (algo=${leadAlgorithm?.algorithmId || 'default'}, style=${leadAlgorithm?.conversationStyle || 'default'})`);
  publishProgress('generating', {
    agentName: matchedAgent.name,
    estimatedMs: estimatedGenerationMs + plannedResponseDelayMs + plannedTypingDelayMs,
    message: `${matchedAgent.name} esta gerando a resposta.`,
  });
  let ai = null;
  try {
    ai = await processAI({
      contact: {
        name: conversation?.name || phone,
        phone,
        conversationId,
        sessionId,
        funnelStage: crmContext.funnelStage || funnelStage,
        nextAction: leadAnalysis.next_action,
        leadAnalysis,
        leadAlgorithm,
        salesStrategy,
        tags: crmContext.tags || conversation?.tags || [],
        notes: crmContext.notes || conversation?.notes || '',
        orderStatus: crmContext.orderStatus || leadAnalysis.intent,
        currentIssue: crmContext.currentIssue,
        neighborhood: conversation?.neighborhood || conversation?.memory_json?.neighborhood || crmContext?.neighborhood || null,
        city: conversation?.city || conversation?.memory_json?.city || crmContext?.city || null,
        recentBotReplies,
      },
      history: leadHistory,
      message: incomingText,
      store,
      agentName: matchedAgent.name,
      companyId,
    });

    if (ai && ai.reply && !ai.circuitBreakerTriggered) {
      ai.reply = aiAntiRepetitionService.sanitizeAndVaryBotReply(ai.reply, recentBotReplies);
    }
  } catch (error) {
    console.error('[AutomationEngine] processAI failed:', error.message);
  }

  // Circuit Breaker Handling: Delirium, Unknown Catalog Answer, or Repetition Loop
  if (ai && ai.circuitBreakerTriggered) {
    console.log(`[AutomationEngine] Circuit breaker active for ${phone}: reason=${ai.circuitBreakerReason}`);

    // 1. Auto-deactivate AI in PostgreSQL for this conversation
    try {
      await conversationRepository.updateConversationAIEnabled(phone, false, companyId);
    } catch (e) {
      console.warn('[AutomationEngine] Error updating AI enabled:', e.message);
    }

    // 2. Add human intervention tags and update conversation status
    const cbTags = ['intervencao_humana', 'precisa_humano', 'delirio_evitado'];
    const mergedTags = Array.from(new Set([...tags, ...cbTags]));

    try {
      await conversationRepository.updateConversationState(conversationId, {
        aiEnabled: false,
        tags: mergedTags,
        status: 'pending_human',
        funnel_stage: 'intervencao_humana',
      });
    } catch (e) {
      console.warn('[AutomationEngine] Error updating conversation state:', e.message);
    }

    // 3. Emit realtime socket notifications for instant sidebar flashing red indicator
    const io = store?.io || global.io;
    io?.emit('conversation:update', {
      id: conversationId,
      aiEnabled: false,
      ai_enabled: false,
      phone,
      tags: mergedTags,
      status: 'pending_human',
      funnel_stage: 'intervencao_humana',
      needsHuman: true,
      needs_human: true,
      circuitBreakerReason: ai.circuitBreakerReason,
      sessionId,
    });
    io?.emit('conversation_updated', {
      id: conversationId,
      aiEnabled: false,
      ai_enabled: false,
      phone,
      tags: mergedTags,
      status: 'pending_human',
      funnel_stage: 'intervencao_humana',
      needsHuman: true,
      needs_human: true,
    });
    io?.emit('lead_updated', {
      conversationId,
      phone,
      tags: mergedTags,
      status: 'pending_human',
    });

    // 4. If graceful handoff message was produced, enqueue it once. Otherwise, stop responding silently.
    if (!ai.reply || !ai.reply.trim()) {
      console.log(`[AutomationEngine] Circuit breaker: Stopped responding silently for ${phone}.`);
      return { success: true, circuitBreaker: true, reason: ai.circuitBreakerReason, replySent: false };
    }
  }

  if (!ai || !ai.reply) {
    publishProgress('failed', {
      agentName: matchedAgent.name,
      message: 'A IA nao conseguiu gerar uma resposta. Verifique o provedor e o agente.',
    });

    // Mark conversation for human intervention
    const cbTags = ['intervencao_humana', 'precisa_humano'];
    const mergedTags = Array.from(new Set([...tags, ...cbTags]));
    try {
      await conversationRepository.updateConversationAIEnabled(phone, false, companyId);
      await conversationRepository.updateConversationState(conversationId, {
        aiEnabled: false,
        tags: mergedTags,
        status: 'pending_human',
      });
      const io = store?.io || global.io;
      io?.emit('conversation:update', {
        id: conversationId,
        aiEnabled: false,
        phone,
        tags: mergedTags,
        status: 'pending_human',
        needsHuman: true,
        sessionId,
      });
      io?.emit('conversation_updated', {
        id: conversationId,
        aiEnabled: false,
        phone,
        tags: mergedTags,
        status: 'pending_human',
        needsHuman: true,
      });
    } catch (_) {}

    if (matchedAgent.escalationActive && matchedAgent.escalationTriggers.includes("IA sem resposta")) {
      const fallbackTrigger = "IA sem resposta";
      await logEscalation({
        motivo: fallbackTrigger,
        data: new Date().toISOString(),
        cliente: conversation?.name || phone,
        telefone: phone
      });

      const escalationTarget = matchedAgent.escalationWhatsapp || matchedAgent.escalationPhone;
      if (escalationTarget && (await getAutomationPermission({ companyId, sessionId, phone: escalationTarget })).allowed) {
        const alertMsg = `⚠️ [ALERTA DE TRANSBORDO] O motor de IA falhou ou ficou sem resposta para o cliente ${conversation?.name || phone} (${phone}). Por favor, assuma o atendimento.`;
        try {
          await whatsappService.sendMessage(sock, escalationTarget, alertMsg, { beforeSend: () => getAutomationPermission({ companyId, sessionId, phone: escalationTarget }) });
        } catch {}
      } else if (escalationTarget) {
        console.log('[AutomationEngine] Escalation alert blocked: destination outside automation scope or AI paused.');
      }

      console.log(`[AutomationEngine] Escalated to human due to "IA sem resposta". AI disabled.`);
    }
    return { success: false, reason: 'ai_empty_reply' };
  }

  // 7. Process AI metadata (funnel stage and tags) if available (skip on circuit breaker to preserve intervention status)
  if (ai.analysis && !ai.circuitBreakerTriggered) {
    try {
      let finalFunnelStage = ai.analysis.funnel_stage;
      let tagsToAdd = Array.isArray(ai.analysis.tags_to_add) ? ai.analysis.tags_to_add : [];
      
      const FUNNEL_STAGES = ['new_lead', 'interested', 'price_sent', 'negotiation', 'ready_to_buy', 'closed', 'lost'];
      if (finalFunnelStage && !FUNNEL_STAGES.includes(finalFunnelStage)) {
        finalFunnelStage = undefined;
      }

      const finalTags = Array.from(new Set([
        ...tags,
        ...tagsToAdd.map(t => String(t).trim().toLowerCase())
      ])).filter(Boolean);

      const updatePayload = {};
      if (finalFunnelStage) updatePayload.funnel_stage = finalFunnelStage;
      updatePayload.tags = finalTags;

      if (ai.analysis.address) {
        const address = ai.analysis.address;
        const contactPhone = ai.analysis.phone || '';
        let notesText = `Endereço de Entrega: ${address}`;
        if (contactPhone) {
          notesText += `\nTelefone de Contato: ${contactPhone}`;
        }
        if (ai.analysis.coordinates) {
          notesText += `\nCoordenadas: ${ai.analysis.coordinates.lat}, ${ai.analysis.coordinates.lng}`;
        }
        updatePayload.notes = notesText;
      }

      console.log(`[AutomationEngine] AI auto-analysis for ${conversationId}: stage=${finalFunnelStage}, tags=${JSON.stringify(finalTags)}`);

      const finalCrmState = await conversationRepository.updateConversationState(conversationId, updatePayload);
      if (finalCrmState) {
        io?.emit('conversation_updated', finalCrmState);
      }

      io?.emit('lead_updated', {
        conversationId,
        intent: leadAnalysis.intent,
        lead_temperature: leadAnalysis.lead_temperature,
        next_action: leadAnalysis.next_action,
        phone,
        tags: finalTags,
      });
      if (finalFunnelStage) {
        io?.emit('funnel_updated', { conversationId, funnel_stage: finalFunnelStage, phone });
      }

      try {
        const agentMemoryGraphService = require('./agentMemoryGraphService');
        void agentMemoryGraphService.learnFromInteraction({
          agentKey: conversation?.agent_name || matchedAgent?.name || 'default',
          companyId: conversation?.company_id || companyId || 'default',
          contact: { phone, name: conversation?.lead_name || conversation?.name || phone, conversationId },
          message: incomingText,
          reply: ai.reply || '',
        });
      } catch (_gErr) {}
    } catch (err) {
      console.error('[AutomationEngine] Failed to apply AI analysis metadata:', err.message);
    }
  }

  // 8. CRM state was updated before generation so the prompt and UI share the same context.
  void crmState;

function splitLongMessage(text) {
  if (!text || text.length <= 250) return [text];

  const parts = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [text];

  const chunks = [];
  let currentChunk = '';

  for (const part of parts) {
    if (currentChunk && (currentChunk.length + part.length < 320)) {
      currentChunk += '\n\n' + part;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = part;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

  // 7.5 Detect knowledge gaps for agent evolution
  if (ai && ai.reply) {
    const uncertaintyPatterns = [
      /não tenho essa informação/i,
      /não sei informar/i,
      /vou verificar/i,
      /entre em contato/i,
      /não posso ajudar com isso/i,
      /infelizmente não/i,
      /não disponho dessa informação/i,
      /preciso consultar/i
    ];
    const hasUncertainty = uncertaintyPatterns.some(p => p.test(ai.reply));
    
    if (hasUncertainty) {
      try {
        const agentLearningRepo = require('../src/data/repositories/agentLearningRepository');
        await agentLearningRepo.createLearningEvent({
          agentKey: matchedAgent.key,
          eventType: 'unanswered',
          customerQuestion: incomingText,
          aiResponse: ai.reply,
          contactPhone: phone,
          contactName: conversation?.name || phone,
          conversationId: conversationId,
          companyId
        });
        console.log(`[AutomationEngine] Learning event logged for uncertainty: "${incomingText.substring(0, 40)}..."`);
      } catch (err) {
        console.error('[AutomationEngine] Failed to create learning event:', err.message);
      }
    }
  }

  // 8. Queue: Enqueue AI response message (Queue -> SendMessage)
  const replyText = (ai.reply || '').trim();
  if (!replyText) {
    console.warn(`[AutomationEngine] Refused to queue empty reply text for ${phone}`);
    return { success: false, reason: 'ai_empty_reply_trimmed' };
  }
  const chunks = splitLongMessage(replyText);

  publishProgress('queued', {
    agentName: matchedAgent.name,
    estimatedMs: plannedResponseDelayMs + plannedTypingDelayMs,
    message: 'Resposta pronta; aguardando o tempo humanizado para envio.',
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const responseDelayMs = i === 0
      ? plannedResponseDelayMs
      : 1000;

    const typingDelayMs = i === 0
      ? (delayEngine.getTypingDelayMs ? delayEngine.getTypingDelayMs(matchedAgent, chunk) : plannedTypingDelayMs)
      : Math.min(6000, Math.max(2000, chunk.length * 40));

    console.log(`[AutomationEngine] Enqueueing AI response chunk ${i+1}/${chunks.length} for ${conversationId}: "${chunk.substring(0, 30)}..." (responseDelay: ${responseDelayMs}ms, typingDelay: ${typingDelayMs}ms)`);
    
    const inboundMsgId = payload?.externalMessageId || payload?.messageId || '';
    const correlationId = inboundMsgId ? `ai_reply_${inboundMsgId}_chunk_${i}` : undefined;

    await outboundQueueService.enqueue({
      companyId,
      phone,
      sessionId,
      correlationId,
      text: chunk,
      metadata: {
        ai_response: true,
        circuitBreakerHandoff: Boolean(ai?.circuitBreakerTriggered),
        systemTag: ai?.circuitBreakerTriggered ? 'circuit_breaker_handoff' : undefined,
        conversationId,
        source: 'ai',
        agentName: matchedAgent?.name || conversation?.agent_name || 'Camila',
        provider: ai.provider,
        model: ai.model,
        responseTimeMs: ai.responseTimeMs,
        promptTokens: ai.promptTokens,
        completionTokens: ai.completionTokens,
        totalTokens: ai.totalTokens,
        funnelStage,
        leadAnalysis,
        salesStrategy,
        responseDelayMs,
        typingDelayMs,
        progressStartedAt,
      }
    });
  }

  try {
    const { syncEngine } = require('./sync');
    syncEngine.dispatch('automation.executed', {
      conversationId,
      phone,
      companyId,
      matchedAgent: matchedAgent.name,
      replyTextLength: replyText.length,
      tenantId: companyId || 'default',
    });
  } catch (_) {}

  return { success: true, action: 'reply_queued' };
}

module.exports = {
  processMessage,
  isBusinessOpen
};
