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
