const { getClient } = require('../src/infrastructure/config/ai');
const { buildPersonalityPrompt } = require('../src/ai/agents/engine/personalityEngine');
const { processEvent } = require('../src/messaging/inbox/ai/AIEventBridge');

function ensureAgent(agent) {
  return agent || {
    name: 'Atendente',
    personality: 'Friendly sales assistant focused on closing purchases naturally.',
    tone: 'warm',
    responseStyle: 'short_natural',
  };
}

function buildConversationHistory(messages = []) {
  return messages
    .slice(-20)
    .map((message) => ({
      role: message.from === 'agent' ? 'assistant' : 'user',
      content: message.text || `[${message.mediaType || 'mensagem'}]`,
    }));
}

function buildFallbackResponse(agent, leadAnalysis = {}, strategy = {}) {
  const resolvedAgent = ensureAgent(agent);

  if (leadAnalysis.next_action === 'close_sale') {
    return `${resolvedAgent.name}: Posso finalizar seu pedido agora. Prefere pagamento via PIX ou retirada na loja?`;
  }

  if (leadAnalysis.next_action === 'send_price') {
    return `${resolvedAgent.name}: Posso te passar o valor final e organizar retirada ou entrega. Quais itens e quantidades deseja confirmar?`;
  }

  if (leadAnalysis.next_action === 'overcome_objection') {
    return `${resolvedAgent.name}: Entendo sua preocupação. Posso te ajudar com uma opção mais adequada ao seu pedido. Quais itens deseja priorizar?`;
  }

  return `${resolvedAgent.name}: Posso te orientar com clareza e já avançar seu atendimento. O que você precisa para sua obra?`;
}

async function generateAIResponse({
  agent,
  conversation,
  conversationHistory = [],
  customerMessage,
  leadAnalysis,
  salesStrategy,
  store,
  sessionId,
}) {
  const resolvedAgent = ensureAgent(agent);

  // Call processAI as the main path
  try {
    const systemSettingsRepository = require('../src/data/repositories/systemSettingsRepository');
    const { processAI } = require('./ai.service');
    
    let aiConfig = {};
    const raw = await systemSettingsRepository.getSetting('ai_config');
    if (raw && raw.value) {
      aiConfig = typeof raw.value === 'string' ? JSON.parse(raw.value) : raw.value;
    }

    const processStore = {
      ...store,
      aiConfig
    };

    const contactData = {
      name: store?.contact?.name || conversation?.phone || 'Cliente',
      phone: conversation?.phone || 'unknown',
      conversationId: conversation?.id || conversation?.phone || 'unknown',
      sessionId: sessionId || store?.sessionId || null,
      funnelStage: conversation?.funnel_stage || store?.contact?.funnelStage || null,
      nextAction: leadAnalysis?.next_action || conversation?.next_action || store?.contact?.nextAction || null,
      leadAnalysis: leadAnalysis || {
        intent: conversation?.lead_intent || null,
        lead_temperature: conversation?.lead_temperature || null,
        confidence: conversation?.lead_confidence || null,
        next_action: conversation?.next_action || null,
      },
      salesStrategy: salesStrategy || {
        goal: conversation?.next_action || null,
      },
    };

    const history = conversationHistory.map(h => ({
      role: h.role || (h.from === 'agent' ? 'assistant' : 'user'),
      content: h.content || h.text || '',
    }));

    const aiResult = await processAI({
      contact: contactData,
      history,
      message: customerMessage,
      store: processStore,
      agentName: resolvedAgent?.name || 'Atendente'
    });

    if (aiResult && aiResult.reply) {
      return {
        response: aiResult.reply,
        provider: aiResult.provider,
        model: aiResult.model,
        responseTimeMs: aiResult.responseTimeMs,
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
        totalTokens: aiResult.totalTokens,
        agentName: aiResult.agentName || resolvedAgent?.name,
        analysis: aiResult.analysis,
      };
    }
  } catch (err) {
    console.error('[AI RESPONSE ENGINE] processAI failed, using fallback:', err.message);
  }

  // Fallback if processAI fails or returns no reply
  const openai = getClient();

  if (!openai) {
    return buildFallbackResponse(resolvedAgent, leadAnalysis, salesStrategy);
  }

  const personalityPrompt = buildPersonalityPrompt(resolvedAgent);

  try {
    const result = await processEvent(
      {
        type: 'incoming_message',
        conversationId: conversation?.id,
        message: customerMessage,
        agent: resolvedAgent,
        context: {
          conversationId: conversation?.id,
          phone: conversation?.phone,
          funnelStage: conversation?.funnel_stage || 'new_lead',
          leadAnalysis: leadAnalysis || {},
          salesStrategy: salesStrategy || {},
          activePrompt: personalityPrompt,
          personalityPrompt,
          conversationHistory: buildConversationHistory(conversationHistory),
        },
      },
      {
        openaiClient: openai,
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      }
    );

    return {
      response: result?.response || buildFallbackResponse(resolvedAgent, leadAnalysis, salesStrategy),
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      agentName: resolvedAgent?.name,
    };
  } catch {
    return {
      response: buildFallbackResponse(resolvedAgent, leadAnalysis, salesStrategy),
      provider: 'fallback',
      model: 'local',
      agentName: resolvedAgent?.name,
    };
  }
}

module.exports = {
  generateAIResponse,
};