const PRICE_REQUEST_PATTERNS = [
  'quanto custa', 'quanto fica', 'fica quanto', 'qual o valor', 'preco', 'valor',
  'orcamento', 'tabela', 'desconto',
];
const PURCHASE_INTENT_PATTERNS = [
  'quero comprar', 'quero fechar', 'pode fechar', 'pode separar', 'vou levar',
  'manda o pix', 'chave pix', 'como pagar', 'forma de pagamento', 'cartao',
];
const OBJECTION_PATTERNS = ['muito caro', 'vou pensar', 'tem desconto', 'consegue melhorar'];
const QUESTION_HINTS = ['como', 'qual', 'quais', 'quando', 'onde', 'tem', 'tem?', 'possui'];
const DELIVERY_ISSUE_PATTERNS = [
  'nao foi entregue', 'não foi entregue', 'nao recebi', 'não recebi', 'atrasou',
  'atraso', 'nao chegou', 'não chegou', 'ainda nao chegou', 'ainda não chegou',
  'cade meu pedido', 'cadê meu pedido', 'nao veio', 'não veio', 'demorando',
  'demora', 'nao entregaram', 'não entregaram',
];
const SCHEDULED_PATTERNS = [
  'ja estava agendado', 'já estava agendado', 'ja agendado', 'já agendado',
  'agendado para', 'agendamento', 'marcado para', 'entrega agendada',
];
const PAYMENT_CONFIRMED_PATTERNS = [
  'ja paguei', 'já paguei', 'fiz o pix', 'mandei o pix', 'ta pago', 'tá pago',
  'segue o comprovante', 'comprovante do pix', 'comprovante anexado',
];

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function includesPattern(text, patterns) {
  return patterns.some((pattern) => text.includes(normalizeText(pattern)));
}

function countMatches(text, patterns) {
  return patterns.reduce(
    (total, pattern) => total + (text.includes(normalizeText(pattern)) ? 1 : 0),
    0
  );
}

function getHistorySignals(conversationHistory = []) {
  return conversationHistory.reduce(
    (accumulator, message) => {
      if (message?.from !== 'client') {
        return accumulator;
      }

      const content = normalizeText(message.text);

      accumulator.priceRequests += countMatches(content, PRICE_REQUEST_PATTERNS);
      accumulator.purchaseIntents += countMatches(content, PURCHASE_INTENT_PATTERNS);
      accumulator.objections += countMatches(content, OBJECTION_PATTERNS);

      return accumulator;
    },
    {
      objections: 0,
      priceRequests: 0,
      purchaseIntents: 0,
    }
  );
}

function analyzeLeadIntent(message, conversationHistory = []) {
  const normalizedMessage = normalizeText(message);
  const historySignals = getHistorySignals(conversationHistory);

  const quantityIntent = /\b(quero|preciso|separa|reserve|manda)\s+(?:de\s+)?\d+\b/.test(normalizedMessage);
  const confirmationIntent = /\b(fechado|confirmado|pode mandar|vamos fechar)\b/.test(normalizedMessage);

  if (includesPattern(normalizedMessage, DELIVERY_ISSUE_PATTERNS)) {
    return {
      confidence: 0.99,
      intent: 'delivery_issue',
      lead_temperature: 'urgent',
      next_action: 'support_check_delivery',
    };
  }

  if (includesPattern(normalizedMessage, PAYMENT_CONFIRMED_PATTERNS)) {
    return {
      confidence: 0.98,
      intent: 'payment_confirmed',
      lead_temperature: 'ready_to_buy',
      next_action: 'confirm_payment_and_schedule',
    };
  }

  if (includesPattern(normalizedMessage, SCHEDULED_PATTERNS)) {
    return {
      confidence: 0.95,
      intent: 'scheduled_order',
      lead_temperature: 'warm',
      next_action: 'confirm_schedule',
    };
  }

  if (includesPattern(normalizedMessage, PURCHASE_INTENT_PATTERNS) || quantityIntent || confirmationIntent) {
    return {
      confidence: historySignals.priceRequests > 0 ? 0.99 : 0.96,
      intent: 'purchase_intent',
      lead_temperature: 'ready_to_buy',
      next_action: 'close_sale',
    };
  }

  if (includesPattern(normalizedMessage, PRICE_REQUEST_PATTERNS)) {
    return {
      confidence: historySignals.purchaseIntents > 0 ? 0.95 : 0.91,
      intent: 'price_request',
      lead_temperature: 'warm',
      next_action: 'send_price',
    };
  }

  if (includesPattern(normalizedMessage, OBJECTION_PATTERNS)) {
    return {
      confidence: historySignals.priceRequests > 0 ? 0.94 : 0.9,
      intent: 'objection',
      lead_temperature: 'warm',
      next_action: 'overcome_objection',
    };
  }

  if (normalizedMessage.includes('?') || includesPattern(normalizedMessage, QUESTION_HINTS)) {
    return {
      confidence: 0.66,
      intent: 'question',
      lead_temperature:
        historySignals.purchaseIntents > 0
          ? 'hot'
          : historySignals.priceRequests > 0
            ? 'warm'
            : 'cold',
      next_action: 'educate',
    };
  }

  return {
    confidence: historySignals.purchaseIntents > 0 ? 0.62 : 0.52,
    intent: 'information',
    lead_temperature:
      historySignals.purchaseIntents > 0
        ? 'hot'
        : historySignals.priceRequests > 0
          ? 'warm'
          : 'cold',
    next_action: 'educate',
  };
}

module.exports = {
  analyzeLeadIntent,
};