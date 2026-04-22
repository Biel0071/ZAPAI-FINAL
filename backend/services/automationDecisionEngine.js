function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function includesAny(text, patterns = []) {
  return patterns.some((pattern) => text.includes(pattern));
}

function detectIntent(text) {
  const normalized = normalizeText(text);

  const greetingPatterns = ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'opa'];
  const pricePatterns = ['preco', 'valor', 'quanto custa', 'quanto fica', 'tabela', 'orcamento'];
  const supportPatterns = [
    'suporte',
    'problema',
    'erro',
    'atendente',
    'humano',
    'reclamacao',
    'reclamar',
    'cancelar',
    'nao funcionou',
  ];

  if (includesAny(normalized, supportPatterns)) {
    return 'support';
  }

  if (includesAny(normalized, pricePatterns)) {
    return 'price';
  }

  if (includesAny(normalized, greetingPatterns)) {
    return 'greeting';
  }

  return 'unknown';
}

function buildFlowReply(flowKey, agentName = 'Camila') {
  if (flowKey === 'greeting') {
    return `${agentName}: Oi. Posso te ajudar com valores, disponibilidade ou suporte agora.`;
  }

  if (flowKey === 'price') {
    return `${agentName}: Posso te passar valores agora. Me diga o item e a quantidade para eu montar o preco final.`;
  }

  return `${agentName}: Recebi sua mensagem e vou te ajudar.`;
}

function decideMessageAction({
  text = '',
  conversation = null,
  leadAnalysis = null,
  runtime = null,
  agent = null,
} = {}) {
  const normalizedText = normalizeText(text);
  const intent = detectIntent(normalizedText);
  const agentName = agent?.name || 'Camila';

  if (!normalizedText) {
    return {
      action: 'wait',
      intent,
      reason: 'empty_message',
    };
  }

  if (runtime?.controlMode === 'human_active' || runtime?.controlMode === 'paused_ai') {
    return {
      action: 'wait',
      intent,
      reason: 'human_takeover_active',
    };
  }

  if (['ok', 'blz', 'valeu', 'obrigado', 'obg', '👍'].includes(normalizedText)) {
    return {
      action: 'wait',
      intent,
      reason: 'acknowledgement_only',
    };
  }

  if (intent === 'support') {
    return {
      action: 'escalate',
      intent,
      reason: 'support_request_detected',
      humanTimeoutMs: 30 * 60 * 1000,
      replyText: `${agentName}: Entendi. Vou transferir para atendimento humano agora.`,
    };
  }

  if (intent === 'greeting' || intent === 'price') {
    return {
      action: 'trigger_flow',
      flowKey: intent,
      intent,
      reason: `flow_${intent}`,
      replyText: buildFlowReply(intent, agentName),
    };
  }

  if (leadAnalysis?.intent === 'question' || conversation?.lead_intent === 'question') {
    return {
      action: 'respond',
      intent,
      reason: 'question_requires_ai_answer',
    };
  }

  return {
    action: 'respond',
    intent,
    reason: 'default_ai_response',
  };
}

module.exports = {
  decideMessageAction,
};
