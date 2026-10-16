const { getClient } = require('../src/infrastructure/config/ai');
const { buildPersonalityPrompt } = require('../src/ai/agents/engine/personalityEngine');
const { processEvent } = require('../src/messaging/inbox/ai/AIEventBridge');

function ensureAgent(agent) {
  let safeAgent = agent || {
    name: 'Camila',
    personality: 'Friendly sales assistant focused on closing purchases naturally.',
    tone: 'warm',
    responseStyle: 'short_natural',
  };
  if (!safeAgent.name || safeAgent.name.toLowerCase() === 'zaibot' || safeAgent.isPlatformAssistant || safeAgent.key === 'zaibot') {
    safeAgent = { ...safeAgent, name: 'Camila' };
  }
  return safeAgent;
}

function buildConversationHistory(messages = []) {
  return messages
    .slice(-30)
    .map((message) => ({
      role: message.from === 'agent' ? 'assistant' : 'user',
      content: message.text || `[${message.mediaType || 'mensagem'}]`,
    }));
}

function buildFallbackResponse(agent, leadAnalysis = {}, strategy = {}, options = {}) {
  const resolvedAgent = ensureAgent(agent);
  const aiAntiRepetitionService = require('./aiAntiRepetitionService');
  const history = options.conversationHistory || [];
  const recentBotReplies = aiAntiRepetitionService.extractRecentBotReplies(history, 3);
  const hasPastBotMessages = recentBotReplies.length > 0;
  const recentCtas = recentBotReplies.map(r => r.cta).filter(Boolean);

  let reply = '';
  if (leadAnalysis.next_action === 'close_sale') {
    const nextCta = aiAntiRepetitionService.getAlternativeCta(recentCtas, 'payment');
    reply = `Posso finalizar seu pedido agora. ${nextCta}`;
  } else if (leadAnalysis.next_action === 'send_price') {
    reply = 'Posso te passar o valor final e calcular a entrega certinho. Quais itens e quantidades você deseja confirmar para sua obra?';
  } else if (leadAnalysis.next_action === 'overcome_objection') {
    reply = 'Entendo perfeitamente sua preocupação. Temos condições especiais e modelos variados para atender seu orçamento. O que você gostaria de priorizar?';
  } else {
    reply = hasPastBotMessages
      ? 'Como posso te orientar melhor sobre materiais, medidas e prazos de entrega para a sua obra?'
      : `Olá! Aqui é a ${resolvedAgent.name} da loja. Como posso ajudar com sua obra hoje? Posso te orientar sobre tijolos, cimento, telhas, churrasqueiras e prazos de entrega!`;
  }

  return aiAntiRepetitionService.sanitizeAndVaryBotReply(reply, recentBotReplies);
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

  // Use EvolutionaryAgentOrchestrator (5-layer evolutionary learning pipeline)
  try {
    const evolutionaryOrchestrator = require('../src/ai/evolutionary/orchestrator');
    const result = await evolutionaryOrchestrator.orchestrateResponse({
      agent: resolvedAgent,
      conversation,
      conversationHistory,
      customerMessage,
      leadAnalysis,
      salesStrategy,
      store,
      sessionId,
      companyId: conversation?.company_id || store?.activeCompanyId || 'default'
    });

    if (result && result.response) {
      return result;
    }
  } catch (err) {
    console.error('[AI RESPONSE ENGINE] Evolutionary orchestrator error:', err.message);
  }

  // Fallback if orchestrator fails completely
  const openai = getClient();

  if (!openai) {
    return buildFallbackResponse(resolvedAgent, leadAnalysis, salesStrategy, { conversationHistory, customerMessage });
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