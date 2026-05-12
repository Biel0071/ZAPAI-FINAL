import type { LeadIntent, LeadTemperature } from "@/services/leadAnalyzer";

export interface SalesStrategy {
  tone: "consultative" | "direct" | "closing";
  goal: "educate" | "send_quote" | "close_sale";
  priority: "low" | "medium" | "high";
}

export function generateSalesStrategy(leadTemperature: LeadTemperature, intent: LeadIntent): SalesStrategy {
  if (leadTemperature === "ready_to_buy") {
    return {
      tone: "closing",
      goal: "close_sale",
      priority: "high",
    };
  }

  if (leadTemperature === "hot") {
    return {
      tone: "direct",
      goal: intent === "price_request" ? "send_quote" : "close_sale",
      priority: "high",
    };
  }

  if (leadTemperature === "warm") {
    return {
      tone: "consultative",
      goal: "send_quote",
      priority: "medium",
    };
  }

  return {
    tone: "consultative",
    goal: "educate",
    priority: "low",
  };
}
