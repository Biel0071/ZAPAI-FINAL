export type LeadIntent = "question" | "price_request" | "purchase_intent" | "objection" | "information";
export type LeadTemperature = "cold" | "warm" | "hot" | "ready_to_buy";
export type NextAction = "educate" | "send_price" | "close_sale" | "overcome_objection";

export interface LeadIntentResult {
  intent: LeadIntent;
  lead_temperature: LeadTemperature;
  confidence: number;
  next_action: NextAction;
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function analyzeLeadIntent(message: string, conversationHistory: string[] = []): LeadIntentResult {
  const text = normalizeText(`${conversationHistory.join(" ")} ${message}`.trim());

  if (containsAny(text, ["quero comprar", "manda o pix", "como pagar", "pode fechar", "vamos fechar"])) {
    return {
      intent: "purchase_intent",
      lead_temperature: "ready_to_buy",
      confidence: 0.95,
      next_action: "close_sale",
    };
  }

  if (containsAny(text, ["quanto custa", "preco", "valor", "quanto fica"])) {
    return {
      intent: "price_request",
      lead_temperature: "warm",
      confidence: 0.9,
      next_action: "send_price",
    };
  }

  if (containsAny(text, ["muito caro", "vou pensar", "depois eu vejo", "ta caro"])) {
    return {
      intent: "objection",
      lead_temperature: "warm",
      confidence: 0.88,
      next_action: "overcome_objection",
    };
  }

  if (text.includes("?")) {
    return {
      intent: "question",
      lead_temperature: "cold",
      confidence: 0.75,
      next_action: "educate",
    };
  }

  return {
    intent: "information",
    lead_temperature: "cold",
    confidence: 0.6,
    next_action: "educate",
  };
}

export type ConversationStyle =
  | "direct_objective"
  | "consultative_detailed"
  | "price_sensitive_negotiator"
  | "urgent_immediate"
  | "relationship_warm";

export interface StoreEvolutionAlgorithm {
  id: string;
  code: string;
  name: string;
  conversationStyle: ConversationStyle;
  styleLabel: string;
  storeStandardRule: string;
  directive: string;
}

export const STORE_EVOLUTION_ALGORITHMS: Record<string, StoreEvolutionAlgorithm> = {
  ALGO_CONVERSAO_RAPIDA_PIX: {
    id: "ALGO_CONVERSAO_RAPIDA_PIX",
    code: "ALGO-01",
    name: "Fechamento Rápido & Condição À Vista (PIX / Entrega)",
    conversationStyle: "direct_objective",
    styleLabel: "Direto & Objetivo (Foco em Preço/Fechamento)",
    storeStandardRule: "Padrão da Loja: Tabela oficial + PIX à vista com desconto ou pagamento seguro na entrega.",
    directive: "Responder valor exato em 1-2 frases, destacar condição PIX ou pagamento na entrega e pedir CEP.",
  },
  ALGO_CONSULTIVO_TECNICO: {
    id: "ALGO_CONSULTIVO_TECNICO",
    code: "ALGO-02",
    name: "Consultivo Técnico & Catálogo Visual (Medidas + Frete)",
    conversationStyle: "consultative_detailed",
    styleLabel: "Consultivo & Detalhista (Medidas, Catálogo e Frete)",
    storeStandardRule: "Padrão da Loja: Especificação completa de medidas/modelos + envio de foto/catálogo da resposta rápida.",
    directive: "Enviar resposta rápida com foto/catálogo, explicar medidas com clareza e calcular frete pelo CEP.",
  },
  ALGO_QUEBRA_OBJECAO_VALOR: {
    id: "ALGO_QUEBRA_OBJECAO_VALOR",
    code: "ALGO-03",
    name: "Quebra de Objeção & Parcelamento 10x / Combo da Loja",
    conversationStyle: "price_sensitive_negotiator",
    styleLabel: "Negociador / Sensível a Preço & Condições",
    storeStandardRule: "Padrão da Loja: Parcelamento em até 10x sem juros no cartão ou desconto progressivo no lote/combo.",
    directive: "Apresentar parcelamento em 10x sem juros ou condição especial no PIX/combo.",
  },
  ALGO_REATIVACAO_RESPOSTA_RAPIDA: {
    id: "ALGO_REATIVACAO_RESPOSTA_RAPIDA",
    code: "ALGO-04",
    name: "Reativação Inteligente com Resposta Rápida & Follow-up IA",
    conversationStyle: "relationship_warm",
    styleLabel: "Relacional / Retomada de Orçamento sem Retorno",
    storeStandardRule: "Padrão da Loja: Abordagem acolhedora + envio da Resposta Rápida oficial + follow-up automático.",
    directive: "Chamar pelo nome, relembrar o produto de interesse com resposta rápida e reabrir conversa se não houve compra.",
  },
  ALGO_POS_VENDA_PROTEGIDO: {
    id: "ALGO_POS_VENDA_PROTEGIDO",
    code: "ALGO-05",
    name: "Pós-Venda & Proteção Anti-Spam (Compra / Entrega Confirmada)",
    conversationStyle: "urgent_immediate",
    styleLabel: "Pós-Venda / Pedido Fechado ou Entrega Agendada",
    storeStandardRule: "Padrão da Loja: Bloqueio total de cobrança de vendas para clientes que já compraram.",
    directive: "Bloquear reativação comercial; atuar 100% no suporte pós-venda e entrega.",
  },
};

export function buildLeadAlgorithm(
  message: string,
  conversationHistory: string[] = [],
  meta: { funnelStage?: string; tags?: string[] } = {}
) {
  const base = analyzeLeadIntent(message, conversationHistory);
  const combined = normalizeText(`${conversationHistory.join(" ")} ${message}`.trim());
  const funnel = normalizeText(meta.funnelStage || "");
  const tags = (meta.tags || []).map((t) => normalizeText(t));

  const hasPurchased =
    ["closed", "fechamento", "agendado", "cancelado", "suporte"].includes(funnel) ||
    tags.some((t) => ["fechado", "pago", "comprou", "entregue"].includes(t)) ||
    containsAny(combined, ["ja paguei", "fiz o pix", "mandei o pix", "segue o comprovante", "ja agendado"]);

  let selected = STORE_EVOLUTION_ALGORITHMS.ALGO_REATIVACAO_RESPOSTA_RAPIDA;
  if (hasPurchased) {
    selected = STORE_EVOLUTION_ALGORITHMS.ALGO_POS_VENDA_PROTEGIDO;
  } else if (base.intent === "objection" || containsAny(combined, ["desconto", "parcela", "10x", "caro"])) {
    selected = STORE_EVOLUTION_ALGORITHMS.ALGO_QUEBRA_OBJECAO_VALOR;
  } else if (base.intent === "purchase_intent" || base.lead_temperature === "ready_to_buy") {
    selected = STORE_EVOLUTION_ALGORITHMS.ALGO_CONVERSAO_RAPIDA_PIX;
  } else if (base.intent === "price_request" || base.intent === "question" || containsAny(combined, ["medida", "catalogo", "frete", "foto"])) {
    selected = STORE_EVOLUTION_ALGORITHMS.ALGO_CONSULTIVO_TECNICO;
  }

  return {
    algorithmId: selected.id,
    algorithmCode: selected.code,
    algorithmName: selected.name,
    conversationStyle: selected.conversationStyle,
    styleLabel: selected.styleLabel,
    storeStandardRule: selected.storeStandardRule,
    directive: selected.directive,
    hasPurchased,
    shouldFollowUp: !hasPurchased,
    intent: base.intent,
    leadTemperature: base.lead_temperature,
  };
}

