const { getClient } = require('../config/ai');
const { getActivePrompt } = require('../config/promptManager');
const { buildPersonalityPrompt } = require('../ai-agents/engine/personalityEngine');
const { processEvent } = require('../inbox-core/ai/AIEventBridge');

function ensureAgent(agent) {
  return agent || {
    name: 'Camila',
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
}) {
  const resolvedAgent = ensureAgent(agent);
  const openai = getClient();

  if (!openai) {
    return buildFallbackResponse(resolvedAgent, leadAnalysis, salesStrategy);
  }

  const activePrompt = getActivePrompt(store);
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
          activePrompt,
          personalityPrompt,
          conversationHistory: buildConversationHistory(conversationHistory),
        },
      },
      {
        openaiClient: openai,
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      }
    );

    return result?.response || buildFallbackResponse(resolvedAgent, leadAnalysis, salesStrategy);
  } catch {
    return buildFallbackResponse(resolvedAgent, leadAnalysis, salesStrategy);
  }
}

module.exports = {
  generateAIResponse,
};