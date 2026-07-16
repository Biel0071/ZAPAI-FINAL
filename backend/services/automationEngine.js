const { getAIIntegrationStatus, processAI } = require('./ai.service');
const { isAIEnabled } = require('../config/aiToggle');
const sessionManager = require('./sessionManager');
const conversationRepository = require('../repositories/conversationRepository');
const messageRepository = require('../repositories/messageRepository');
const outboundQueueService = require('./outboundQueueService');
const whatsappService = require('./whatsappService');
const messagesController = require('../controllers/messagesController');
const { query } = require('../config/database');
const aiIntelligenceService = require('./aiIntelligenceService');
const { analyzeLeadIntent } = require('./leadAnalyzer');
const { buildLeadTags, getNextFunnelStage } = require('./salesFunnel');
const { generateSalesStrategy } = require('./salesStrategyEngine');
const conversationRuntimeService = require('../inbox-core/inbox/services/ConversationRuntimeService');

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

function randomProfileDelay(profile) {
  if (!profile || typeof profile !== 'object') return 0;
  const minMs = Math.max(0, Number(profile.minMs) || 0);
  const maxMs = Math.max(minMs, Number(profile.maxMs) || minMs);
  return maxMs === minMs ? minMs : Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function isBusinessOpen() {
  const businessHoursConfig = require('../config/businessHours');
  return businessHoursConfig.isBusinessOpen();
}

async function checkLeadBlocked(phone) {
  try {
    const res = await query(
      'SELECT is_blocked FROM leads WHERE phone = $1 OR phone = ANY(get_phone_aliases($1)) LIMIT 1',
      [phone]
    );
    if (res.rows.length > 0) {
      return Boolean(res.rows[0].is_blocked);
    }
  } catch (err) {
    console.error('[AutomationEngine] Failed to check lead blocked:', err.message);
  }
  return false;
}

async function processMessage({ payload, conversation, store, sock, sessionId }) {
  const phone = payload.phone;
  const incomingText = payload.text || '';
  const conversationId = conversation?.id;
  const companyId = conversation?.company_id || payload?.companyId || 'default';

  // Short-circuit automated replies if:
  // (a) global AI toggle is OFF
  if (!isAIEnabled()) {
    console.log(`[AutomationEngine] Global AI toggle is OFF. Short-circuiting response for ${phone}.`);
    return { success: false, reason: 'global_ai_off' };
  }

  // (b) session systemConnection is OFF
  const session = sessionManager.getSession(sessionId);
  if (!session || session.systemConnected === false) {
    console.log(`[AutomationEngine] Session/Line ${sessionId} is not enabled for AI. Short-circuiting response for ${phone}.`);
    return { success: false, reason: 'session_ai_disabled' };
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

  const runtimeCheck = conversationRuntimeService.refreshExpiredHumanTakeover(store, authoritativeConversation?.id || conversationId);
  if (runtimeCheck.runtime?.controlMode === 'human_active' || runtimeCheck.runtime?.controlMode === 'paused_ai') {
    console.log('[AutomationEngine] Human takeover active for ' + phone + '. Short-circuiting response until ' + runtimeCheck.runtime.aiPausedUntil + '.');
    return { success: false, reason: 'human_active' };
  }

  if (runtimeCheck.expired && authoritativeConversation?.id && !conversationAIEnabled) {
    await conversationRepository.updateConversationState(authoritativeConversation.id, { aiEnabled: true });
    conversationAIEnabled = true;
    console.log('[AutomationEngine] Human takeover expired for ' + phone + '. AI re-enabled automatically.');
  }

  if (!conversationAIEnabled) {
    console.log('[AutomationEngine] AI is OFF for conversation ' + phone + '. Short-circuiting response.');
    return { success: false, reason: 'conversation_ai_off' };
  }

  console.log(`[AutomationEngine] Starting pipeline for ${phone}: "${incomingText}"`);

  // 1. Rules Engine: Blocked Contact Check
  const isBlocked = await checkLeadBlocked(phone);
  if (isBlocked) {
    console.log(`[AutomationEngine] Lead ${phone} is blocked. Stopping pipeline.`);
    return { success: false, reason: 'lead_blocked' };
  }

  // 2. Rules Engine: Business Hours Check
  const { businessHours: bhConfig } = require('../config/businessHours');
  if (bhConfig.autoReplyOutsideHours !== false && !isBusinessOpen()) {
    const systemSettingsRepository = require('../repositories/systemSettingsRepository');
    let businessHours = { absenceMessage: 'No momento estamos fechados. Retornaremos em breve!' };
    try {
      const raw = await systemSettingsRepository.getSetting('business_hours');
      if (raw && raw.value) {
        businessHours = typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value;
      }
    } catch {}

    console.log(`[AutomationEngine] Business is closed. Enqueueing absence message.`);
    await outboundQueueService.enqueue({
      companyId,
      phone,
      sessionId,
      text: businessHours.absenceMessage || bhConfig.absenceMessage,
      metadata: { systemTag: 'absence' }
    });
    return { success: true, action: 'absence_reply_queued' };
  }

  // 3. Rules Engine: Load Active Agent
  const aiAgentService = require('../ai-agents/services/aiAgentService');
  let matchedAgent = null;
  try {
    await aiAgentService.listAgents();
    matchedAgent = aiAgentService.findByNameSync(conversation?.agent_name || 'Camila');
  } catch (err) {
    console.error('[AutomationEngine] Failed to load agent configuration:', err);
  }

  if (!matchedAgent) {
    matchedAgent = {
      name: 'Camila',
      escalationActive: true,
      escalationTriggers: ['cliente pediu humano', 'cliente reclamou'],
      escalationWhatsapp: '',
      escalationMode: 2
    };
  }

  // 4. Rules Engine: Human Escalation check
  const aiEnabledGlobal = conversation?.aiEnabled !== false;
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
    if (escalationTarget) {
      const alertMsg = `⚠️ [ALERTA DE TRANSBORDO] O cliente ${conversation?.name || phone} (${phone}) ativou o gatilho "${matchedTrigger}". Motivo: "${incomingText}". Por favor, assuma o atendimento.`;
      try {
        await whatsappService.sendMessage(sock, escalationTarget, alertMsg);
      } catch (err) {
        console.error('[AutomationEngine] Failed to send WhatsApp escalation alert:', err);
      }
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
      console.log(`[AutomationEngine] Escalated to human. AI disabled for conversation ${conversationId}`);
      return { success: true, action: 'escalated_to_human' };
    }
  }

  // 5. Rules Engine: AI Configuration Check
  const integrationStatus = await getAIIntegrationStatus(store, companyId);
  if (!integrationStatus.aiOn || !aiEnabledGlobal) {
    console.log(`[AutomationEngine] AI is OFF (integration: ${integrationStatus.aiOn}, conversation: ${aiEnabledGlobal}). Stopping pipeline.`);
    return { success: false, reason: 'ai_off' };
  }

  // 6. AI Engine: Retrieve conversation history and call processAI
  const history = await messageRepository
    .getMessagesByConversation(conversationId)
    .then((messages) =>
      messages.slice(-20).map((message) => ({
        content: message.content || message.text || '',
        role: message.fromMe ? 'assistant' : 'user',
        timestamp: message.createdAt || message.timestamp || new Date().toISOString(),
      }))
    )
    .catch(() => []);

  const leadHistory = history.map((entry) => ({
    from: entry.role === 'assistant' ? 'agent' : 'client',
    text: entry.content,
  }));
  const leadAnalysis = analyzeLeadIntent(incomingText, leadHistory);
  const funnelStage = getNextFunnelStage(
    conversation?.funnel_stage || 'new_lead',
    leadAnalysis,
    incomingText
  );
  const salesStrategy = generateSalesStrategy(leadAnalysis);
  const memoryContext =
    aiIntelligenceService.getOpenAIContextForContact(store, conversationId) ||
    aiIntelligenceService.getOpenAIContextForContact(store, phone);
  const tags = Array.from(new Set([
    ...(Array.isArray(conversation?.tags) ? conversation.tags : []),
    ...buildLeadTags(leadAnalysis, funnelStage),
    ...(Array.isArray(memoryContext?.tags) ? memoryContext.tags : []),
  ]));

  const crmState = await conversationRepository.updateConversationState(conversationId, {
    funnel_stage: funnelStage,
    lead_confidence: leadAnalysis.confidence,
    lead_intent: leadAnalysis.intent,
    lead_temperature: leadAnalysis.lead_temperature,
    next_action: leadAnalysis.next_action,
    summary: memoryContext?.summary || conversation?.summary,
    tags,
  });

  const io = store?.io || global.io;
  io?.emit('lead_updated', {
    conversationId,
    intent: leadAnalysis.intent,
    lead_temperature: leadAnalysis.lead_temperature,
    next_action: leadAnalysis.next_action,
    phone,
    tags,
  });
  io?.emit('funnel_updated', { conversationId, funnel_stage: funnelStage, phone });

  console.log(`[AutomationEngine] Calling AI Engine for conversation ${conversationId}`);
  let ai = null;
  try {
    ai = await processAI({
      contact: {
        name: conversation?.name || phone,
        phone,
        conversationId,
        sessionId,
        funnelStage,
        nextAction: leadAnalysis.next_action,
        leadAnalysis,
        salesStrategy,
      },
      history: leadHistory,
      message: incomingText,
      store,
      agentName: matchedAgent.name,
      companyId,
    });
  } catch (error) {
    console.error('[AutomationEngine] processAI failed:', error.message);
  }

  if (!ai || !ai.reply) {
    if (matchedAgent.escalationActive && matchedAgent.escalationTriggers.includes("IA sem resposta")) {
      const fallbackTrigger = "IA sem resposta";
      await logEscalation({
        motivo: fallbackTrigger,
        data: new Date().toISOString(),
        cliente: conversation?.name || phone,
        telefone: phone
      });

      const escalationTarget = matchedAgent.escalationWhatsapp || matchedAgent.escalationPhone;
      if (escalationTarget) {
        const alertMsg = `⚠️ [ALERTA DE TRANSBORDO] O motor de IA falhou ou ficou sem resposta para o cliente ${conversation?.name || phone} (${phone}). Por favor, assuma o atendimento.`;
        try {
          await whatsappService.sendMessage(sock, escalationTarget, alertMsg);
        } catch {}
      }

      await conversationRepository.updateConversationAIEnabled(phone, false, companyId);
      const io = store?.io || global.io;
      io?.emit('conversation:update', {
        id: conversationId,
        aiEnabled: false,
        phone,
        sessionId
      });
      console.log(`[AutomationEngine] Escalated to human due to "IA sem resposta". AI disabled.`);
    }
    return { success: false, reason: 'ai_empty_reply' };
  }

  // 7. Process AI metadata (funnel stage and tags) if available
  if (ai.analysis) {
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

      await conversationRepository.updateConversationState(conversationId, updatePayload);

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
        const agentLearningRepo = require('../repositories/agentLearningRepository');
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
  const replyText = ai.reply || '';
  const chunks = splitLongMessage(replyText);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const responseDelayMs = i === 0 
      ? randomProfileDelay(matchedAgent.delayProfile) 
      : 1000;
      
    const typingDelayMs = i === 0
      ? randomProfileDelay(matchedAgent.typingDelayProfile)
      : Math.min(5000, Math.max(2000, chunk.length * 50));

    console.log(`[AutomationEngine] Enqueueing AI response chunk ${i+1}/${chunks.length} for ${conversationId}: "${chunk.substring(0, 30)}..."`);
    
    await outboundQueueService.enqueue({
      companyId,
      phone,
      sessionId,
      text: chunk,
      metadata: {
        ai_response: true,
        conversationId,
        source: 'ai',
        agentName: conversation?.agent_name || 'Camila',
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
      }
    });
  }

  return { success: true, action: 'reply_queued' };
}

module.exports = {
  processMessage,
  isBusinessOpen
};
