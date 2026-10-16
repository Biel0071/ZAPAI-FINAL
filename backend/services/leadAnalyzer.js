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
      if (!isClientMessage(message)) {
        return accumulator;
      }

      const content = normalizeText(message?.text || message?.content || '');

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

const PRODUCT_CATALOG_PATTERNS = [
  {
    key: 'churrasqueira',
    label: 'Churrasqueira Pré-Moldada / Kit Gourmet',
    keywords: ['churrasqueira', 'churras', 'pre-moldada', 'pre moldada', 'kit churras', 'tijolinho', 'defumador', 'forno e fogao', 'fogao a lenha'],
    quickReplyId: '196b2abf-3d1d-4841-95cb-4ccc65097708',
    quickReplyTitle: 'CHURRAS',
  },
  {
    key: 'tijolo',
    label: 'Tijolo Baiano / Cerâmico (Milheiro)',
    keywords: ['tijolo', 'tijolos', 'tijolao', 'baiano', 'milheiro', '8 furos', '9 furos', '6 furos'],
    quickReplyId: 'e3ae785d-df4c-4cf3-95ae-49e27e97a7cb',
    quickReplyTitle: 'Tijolo Promo',
  },
  {
    key: 'cimento',
    label: 'Cimento & Argamassa Estrutural',
    keywords: ['cimento', 'saco de cimento', 'cp ii', 'votoran', 'caue', 'csn', 'argamassa', 'cal'],
    quickReplyId: '9888b263-74ff-414b-80eb-6f54d409e277',
    quickReplyTitle: 'CIMENTO',
  },
  {
    key: 'bloco',
    label: 'Blocos de Concreto / Vedação',
    keywords: ['bloco', 'blocos', 'canaleta', 'estrutural', 'vedacao', 'bloco de concreto'],
    quickReplyId: 'd9a0637c-52fd-475a-a72a-7b33a85844a9',
    quickReplyTitle: 'BLOCOS PROMO',
  },
  {
    key: 'telha',
    label: 'Telhas Fibrocimento / Cerâmica',
    keywords: ['telha', 'telhas', 'telhado', 'fibrocimento', 'brasilit', 'eternit', 'romana', 'colonial', 'cumeeira'],
    quickReplyId: '3d7739a3-60dd-44fd-93a6-9de76f2e0e4e',
    quickReplyTitle: 'catalogo',
  },
  {
    key: 'betoneira',
    label: 'Betoneira 400L & Equipamentos',
    keywords: ['betoneira', '400l', '400 litros', 'menegotti', 'csm', 'carrinho de mao'],
    quickReplyId: '3d7739a3-60dd-44fd-93a6-9de76f2e0e4e',
    quickReplyTitle: 'catalogo',
  },
  {
    key: 'chale_container',
    label: 'Chalé / Container Habitável',
    keywords: ['chale', 'container', 'cabana', 'tiny house'],
    quickReplyId: '51787699-0cec-45f0-b5e4-f01e0a92290a',
    quickReplyTitle: 'RETORNO',
  },
];

const STORE_EVOLUTION_ALGORITHMS = Object.freeze({
  ALGO_CONVERSAO_RAPIDA_PIX: {
    id: 'ALGO_CONVERSAO_RAPIDA_PIX',
    code: 'ALGO-01',
    name: 'Fechamento Rápido & Condição À Vista (PIX / Entrega)',
    conversationStyle: 'direct_objective',
    styleLabel: 'Direto & Objetivo (Foco em Preço/Fechamento)',
    storeStandardRule: 'Padrão da Loja: Tabela oficial + PIX à vista com desconto ou pagamento seguro na entrega.',
    directive: 'O lead tem perfil direto e objetivo. Responda em 1 a 2 frases curtas com o valor exato do item no padrão da loja, destaque a condição à vista no PIX ou pagamento na entrega e peça o CEP/endereço para agendar.',
    followupHook: 'Oi {{name}}! Passando rapidinho sobre a cotação de {{product}} que você pediu. Ainda conseguimos manter o valor promocional à vista ou pagamento na entrega para a sua região. Quer que eu separe seu pedido?',
  },
  ALGO_CONSULTIVO_TECNICO: {
    id: 'ALGO_CONSULTIVO_TECNICO',
    code: 'ALGO-02',
    name: 'Consultivo Técnico & Catálogo Visual (Medidas + Frete)',
    conversationStyle: 'consultative_detailed',
    styleLabel: 'Consultivo & Detalhista (Medidas, Catálogo e Frete)',
    storeStandardRule: 'Padrão da Loja: Especificação completa de medidas/modelos + envio de foto/catálogo da resposta rápida.',
    directive: 'O lead busca detalhes técnicos, medidas, fotos ou cálculo de frete. Mantenha o padrão consultivo da loja, acione a resposta rápida com foto/catálogo quando pertinente, explique tamanhos/modelos com clareza e pergunte o CEP para calcular a entrega.',
    followupHook: 'Olá {{name}}, tudo bem? Sobre as especificações e medidas de {{product}} que vimos antes, ficou alguma dúvida técnica? Se quiser, me passa seu bairro ou CEP que já calculo o frete certinho pra você!',
  },
  ALGO_QUEBRA_OBJECAO_VALOR: {
    id: 'ALGO_QUEBRA_OBJECAO_VALOR',
    code: 'ALGO-03',
    name: 'Quebra de Objeção & Parcelamento 10x / Combo da Loja',
    conversationStyle: 'price_sensitive_negotiator',
    styleLabel: 'Negociador / Sensível a Preço & Condições',
    storeStandardRule: 'Padrão da Loja: Parcelamento em até 10x sem juros no cartão ou desconto progressivo no lote/combo.',
    directive: 'O lead é sensível a preço ou pediu condição especial. Acolha com simpatia no padrão da loja, destaque que parcelamos em até 10x sem juros ou fazemos condição diferenciada no PIX/lote fechado, valorizando a qualidade e entrega rápida.',
    followupHook: 'Oi {{name}}! Lembrei da nossa conversa sobre {{product}}. Conseguimos liberar uma condição muito bacana esta semana (tanto no PIX quanto parcelado em até 10x sem juros). Vamos aproveitar para garantir o material da sua obra?',
  },
  ALGO_REATIVACAO_RESPOSTA_RAPIDA: {
    id: 'ALGO_REATIVACAO_RESPOSTA_RAPIDA',
    code: 'ALGO-04',
    name: 'Reativação Inteligente com Resposta Rápida & Follow-up IA',
    conversationStyle: 'relationship_warm',
    styleLabel: 'Relacional / Retomada de Orçamento sem Retorno',
    storeStandardRule: 'Padrão da Loja: Abordagem acolhedora brasileira + envio da Resposta Rápida oficial do produto + ativação de follow-up automático.',
    directive: 'Este lead conversou anteriormente mas ficou sem retorno e ainda não fechou compra. Chame pelo nome com simpatia, relembre o interesse em {{product}} usando a resposta rápida da loja e faça uma pergunta leve e aberta para retomar o atendimento.',
    followupHook: 'Olá {{name}}, tudo joia por aí? Aqui é a Camila da loja! Vi que conversamos sobre {{product}} e como não tivemos retorno, passei para saber se você já conseguiu resolver ou se posso te mandar as condições atualizadas da semana!',
  },
  ALGO_POS_VENDA_PROTEGIDO: {
    id: 'ALGO_POS_VENDA_PROTEGIDO',
    code: 'ALGO-05',
    name: 'Pós-Venda & Proteção Anti-Spam (Compra / Entrega Confirmada)',
    conversationStyle: 'urgent_immediate',
    styleLabel: 'Pós-Venda / Pedido Fechado ou Entrega Agendada',
    storeStandardRule: 'Padrão da Loja: Bloqueio total de cobrança de vendas para clientes que já compraram; prioridade máxima de logística.',
    directive: 'Este cliente já realizou compra, enviou comprovante ou tem entrega agendada. NUNCA envie oferta comercial repetida; atue exclusivamente no suporte pós-venda e acompanhamento de entrega.',
    followupHook: null,
  },
});

function detectProductsFromText(rawText = '') {
  const normalized = normalizeText(rawText);
  const detected = [];
  for (const item of PRODUCT_CATALOG_PATTERNS) {
    if (item.keywords.some((kw) => normalized.includes(normalizeText(kw)))) {
      detected.push(item);
    }
  }
  return detected;
}

function detectPreferredPayment(rawText = '') {
  const normalized = normalizeText(rawText);
  if (/\b(pix|a vista|avista|transferencia)\b/.test(normalized)) return 'pix';
  if (/\b(cartao|credito|parcela|parcelado|10x|12x)\b/.test(normalized)) return 'cartao';
  if (/\b(na entrega|no local|quando entregar|receber)\b/.test(normalized)) return 'pagamento_na_entrega';
  if (/\b(boleto|faturado)\b/.test(normalized)) return 'boleto';
  return 'indefinido';
}

function isClientMessage(m) {
  if (!m || typeof m !== 'object') return true;
  if (m.fromMe === true || m.from_me === true) return false;
  const sender = String(m.sender || m.from || m.role || '').toLowerCase();
  if (['agent', 'bot', 'system', 'assistant', 'operator'].includes(sender)) return false;
  return true;
}

function detectPurchaseStatus(message = '', conversationHistory = [], conversationMeta = {}) {
  const funnel = normalizeText(conversationMeta?.funnel_stage || conversationMeta?.funnelStage || '');
  const orderStatus = normalizeText(conversationMeta?.orderStatus || conversationMeta?.order_status || '');
  const tags = Array.isArray(conversationMeta?.tags)
    ? conversationMeta.tags.map((t) => normalizeText(t))
    : [];

  if (['closed', 'fechamento', 'agendado', 'cancelado', 'suporte', 'won'].includes(funnel)) {
    return { hasPurchased: true, reason: `funnel_${funnel}` };
  }
  if (['paid', 'scheduled', 'delivered', 'completed', 'confirmed'].includes(orderStatus)) {
    return { hasPurchased: true, reason: `order_${orderStatus}` };
  }
  if (tags.some((t) => ['fechado', 'pago', 'comprou', 'pedido_confirmado', 'entregue'].includes(t))) {
    return { hasPurchased: true, reason: 'tag_purchased' };
  }

  const allHistoryText = normalizeText(
    [
      ...(Array.isArray(conversationHistory)
        ? conversationHistory.map((m) => m?.text || m?.content || '')
        : []),
      message,
    ].join(' ')
  );

  if (
    includesPattern(allHistoryText, PAYMENT_CONFIRMED_PATTERNS) ||
    includesPattern(allHistoryText, SCHEDULED_PATTERNS) ||
    /\b(liberar o rastreio|codigo de rastreio|pedido agendado|entrega agendada|nota fiscal emitida|ja comprei|comprei ja)\b/.test(allHistoryText) ||
    /\b\d{3}[./-]\d{3}[./-]\d{3}[./-]\d{2}\b/.test(allHistoryText)
  ) {
    return { hasPurchased: true, reason: 'message_payment_or_schedule_confirmed' };
  }

  return { hasPurchased: false, reason: 'open_opportunity' };
}

function detectConversationStyle(message = '', conversationHistory = []) {
  const clientMessages = [
    ...(Array.isArray(conversationHistory)
      ? conversationHistory
          .filter(isClientMessage)
          .map((m) => String(m?.text || m?.content || '').trim())
      : []),
    String(message || '').trim(),
  ].filter(Boolean);

  const combined = normalizeText(clientMessages.join(' '));
  const avgWords =
    clientMessages.length > 0
      ? clientMessages.reduce((sum, txt) => sum + txt.split(/\s+/).filter(Boolean).length, 0) / clientMessages.length
      : 0;

  if (/\b(urgente|hoje|agora|pronta entrega|amanha cedo|ja paguei|atrasou|nao chegou)\b/.test(combined)) {
    return 'urgent_immediate';
  }
  if (/\b(desconto|caro|melhorar|parcela|10x|a vista|avista|promocao|mais barato)\b/.test(combined)) {
    return 'price_sensitive_negotiator';
  }
  if (/\b(medida|medidas|altura|largura|profundidade|catalogo|foto|fotos|frete|cep|como funciona|especificacao|modelo)\b/.test(combined)) {
    return 'consultative_detailed';
  }
  if (avgWords > 0 && avgWords <= 6 && includesPattern(combined, [...PRICE_REQUEST_PATTERNS, ...PURCHASE_INTENT_PATTERNS])) {
    return 'direct_objective';
  }
  return 'relationship_warm';
}

function buildLeadAlgorithm(message = '', conversationHistory = [], conversationMeta = {}) {
  const baseAnalysis = analyzeLeadIntent(message, conversationHistory);
  const clientOnlyTexts = [
    ...(Array.isArray(conversationHistory)
      ? conversationHistory.filter(isClientMessage).map((m) => m?.text || m?.content || '')
      : []),
    String(message || ''),
  ].join(' ');
  const allTexts = [
    clientOnlyTexts,
    ...(Array.isArray(conversationHistory) ? conversationHistory.map((m) => m?.text || m?.content || '') : []),
    String(conversationMeta?.last_message || conversationMeta?.lastMessage || ''),
    String(conversationMeta?.summary || ''),
  ].join(' ');

  const clientProducts = detectProductsFromText(clientOnlyTexts);
  const detectedProducts = clientProducts.length > 0 ? clientProducts : detectProductsFromText(allTexts);
  const primaryProductObj = detectedProducts[0] || {
    key: 'geral',
    label: 'Churrasqueiras & Materiais de Construção',
    quickReplyId: '196b2abf-3d1d-4841-95cb-4ccc65097708',
    quickReplyTitle: 'CHURRAS',
  };

  const preferredPayment = detectPreferredPayment(allTexts);
  const purchaseCheck = detectPurchaseStatus(message, conversationHistory, conversationMeta);
  const conversationStyle = detectConversationStyle(message, conversationHistory);

  let selectedAlgo = STORE_EVOLUTION_ALGORITHMS.ALGO_REATIVACAO_RESPOSTA_RAPIDA;
  if (purchaseCheck.hasPurchased || baseAnalysis.intent === 'delivery_issue' || baseAnalysis.intent === 'payment_confirmed') {
    selectedAlgo = STORE_EVOLUTION_ALGORITHMS.ALGO_POS_VENDA_PROTEGIDO;
  } else if (baseAnalysis.intent === 'objection' || conversationStyle === 'price_sensitive_negotiator') {
    selectedAlgo = STORE_EVOLUTION_ALGORITHMS.ALGO_QUEBRA_OBJECAO_VALOR;
  } else if (
    baseAnalysis.intent === 'purchase_intent' ||
    baseAnalysis.lead_temperature === 'ready_to_buy' ||
    conversationStyle === 'direct_objective'
  ) {
    selectedAlgo = STORE_EVOLUTION_ALGORITHMS.ALGO_CONVERSAO_RAPIDA_PIX;
  } else if (conversationStyle === 'consultative_detailed' || baseAnalysis.intent === 'price_request' || baseAnalysis.intent === 'question') {
    selectedAlgo = STORE_EVOLUTION_ALGORITHMS.ALGO_CONSULTIVO_TECNICO;
  }

  const rawName = String(conversationMeta?.name || conversationMeta?.lead_name || '').trim();
  const cleanFirstName =
    rawName && !rawName.includes('@') && !/^\d+$/.test(rawName)
      ? rawName.split(/\s+/)[0].replace(/[^\p{L}]/gu, '') || 'amigo(a)'
      : 'amigo(a)';

  const personalizedFollowup = selectedAlgo.followupHook
    ? selectedAlgo.followupHook
        .replace(/\{\{\s*name\s*\}\}/g, cleanFirstName)
        .replace(/\{\{\s*product\s*\}\}/g, primaryProductObj.label)
    : null;

  const personalizedDirective = selectedAlgo.directive.replace(/\{\{\s*product\s*\}\}/g, primaryProductObj.label);

  return {
    algorithmId: selectedAlgo.id,
    algorithmCode: selectedAlgo.code,
    algorithmName: selectedAlgo.name,
    conversationStyle,
    styleLabel: selectedAlgo.styleLabel,
    storeStandardRule: selectedAlgo.storeStandardRule,
    directive: personalizedDirective,
    followupHook: personalizedFollowup,
    hasPurchased: purchaseCheck.hasPurchased,
    purchaseReason: purchaseCheck.reason,
    shouldFollowUp: !purchaseCheck.hasPurchased,
    primaryProduct: primaryProductObj.key,
    primaryProductLabel: primaryProductObj.label,
    detectedProducts: detectedProducts.map((p) => p.key),
    preferredPayment,
    recommendedQuickReplyId: primaryProductObj.quickReplyId,
    recommendedQuickReplyTitle: primaryProductObj.quickReplyTitle,
    intent: baseAnalysis.intent,
    leadTemperature: baseAnalysis.lead_temperature,
    nextAction: baseAnalysis.next_action,
  };
}

module.exports = {
  analyzeLeadIntent,
  buildLeadAlgorithm,
  detectProductsFromText,
  detectConversationStyle,
  detectPurchaseStatus,
  STORE_EVOLUTION_ALGORITHMS,
};