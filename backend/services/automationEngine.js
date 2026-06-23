const { getAIIntegrationStatus, processAI } = require('./ai.service');
const { isAIEnabled } = require('../config/aiToggle');
const sessionManager = require('./sessionManager');
const conversationRepository = require('../repositories/conversationRepository');
const messageRepository = require('../repositories/messageRepository');
const outboundQueueService = require('./outboundQueueService');
const whatsappService = require('./whatsappService');
const messagesController = require('../controllers/messagesController');
const { query } = require('../config/database');

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

function isBusinessOpen() {
  // Simple check for business hours. Can be expanded if settings are active.
  const now = new Date();
  const hr = now.getHours();
  // By default, open between 8:00 and 18:00
  return hr >= 8 && hr < 18;
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

  // (c) conversation AI is OFF (using authoritative database check to prevent stale memory values)
  let conversationAIEnabled = conversation?.aiEnabled !== false && conversation?.ai_enabled !== false;
  try {
    const fresh = await conversationRepository.getConversationByPhone(phone, companyId, sessionId).catch(() => null);
    if (fresh) {
      conversationAIEnabled = fresh.aiEnabled !== false && fresh.ai_enabled !== false;
    }
  } catch (err) {
    console.error('[AutomationEngine] Failed to check fresh conversation AI toggle:', err.message);
  }

  if (!conversationAIEnabled) {
    console.log(`[AutomationEngine] AI is OFF for conversation ${phone}. Short-circuiting response.`);
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
  if (!isBusinessOpen()) {
    const systemSettingsRepository = require('../repositories/systemSettingsRepository');
    let businessHours = { absenceMessage: 'No momento estamos fechados. Retornaremos em breve!' };
    try {
      const raw = await systemSettingsRepository.getSetting('business_hours');
      if (raw) businessHours = JSON.parse(raw);
    } catch {}

    console.log(`[AutomationEngine] Business is closed. Enqueueing absence message.`);
    await outboundQueueService.enqueue({
      companyId,
      phone,
      sessionId,
      text: businessHours.absenceMessage,
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

  console.log(`[AutomationEngine] Calling AI Engine for conversation ${conversationId}`);
  let ai = null;
  try {
    ai = await processAI({
      contact: {
        name: conversation?.name || phone,
        phone: phone,
      },
      history,
      message: incomingText,
      store,
      agentName: conversation?.agent_name || 'Camila',
      companyId,
    });
  } catch (error) {
    console.error('[AutomationEngine] AI processing error:', error);
  }

  if (!ai || !ai.reply) {
    console.log('[AutomationEngine] AI returned no reply.');
    // Check "IA sem resposta" trigger
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

  // 7. Update Lead CRM status
  await conversationRepository.updateConversationState(conversationId, {
    lead_confidence: ai.leadScore,
    lead_intent: ai.intent,
    lead_temperature: mapLeadTemperature(ai.leadScore),
    next_action: ai.suggestion || conversation?.next_action || 'educate',
  });

  // 8. Queue: Enqueue AI response message (Queue -> SendMessage)
  console.log(`[AutomationEngine] Enqueueing AI response message: "${ai.reply}"`);
  await outboundQueueService.enqueue({
    companyId,
    phone,
    sessionId,
    text: ai.reply,
    metadata: {
      ai_response: true,
      agentName: conversation?.agent_name || 'Camila'
    }
  });

  return { success: true, action: 'reply_queued' };
}

module.exports = {
  processMessage,
  isBusinessOpen
};
