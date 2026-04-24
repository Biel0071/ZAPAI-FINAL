import { supabase } from "@/integrations/supabase/client";
import type { LeadIntentResult } from "@/services/leadAnalyzer";
import type { SalesStrategy } from "@/services/salesStrategyEngine";

export interface ConversationAnalysisResult {
  summary: string;
  customer_interest_score: number;
  objections: string[];
  questions: string[];
  purchase_signals: string[];
  recommended_action: string;
}

export interface ResponseContext {
  prompt: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  customerMessage: string;
  leadAnalysis: LeadIntentResult;
  salesStrategy: SalesStrategy;
}

function normalizeAIError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";
  const lowered = message.toLowerCase();

  if (
    lowered.includes("non-2xx") ||
    lowered.includes("edge function") ||
    lowered.includes("failed to fetch") ||
    lowered.includes("network")
  ) {
    return new Error("AI response unavailable.");
  }

  return new Error(message || "AI response unavailable.");
}

export async function analyzeConversation(
  conversationId: string,
  conversationMessages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<ConversationAnalysisResult> {
  try {
    const { data, error } = await supabase.functions.invoke("conversation-intelligence", {
      body: {
        action: "analyze-conversation",
        conversationId,
        conversationMessages,
      },
    });

    if (error) throw error;
    return data as ConversationAnalysisResult;
  } catch (error) {
    if (import.meta.env.MODE !== 'production') console.error("AI error", error);
    throw normalizeAIError(error);
  }
}

export async function generateResponse(context: ResponseContext): Promise<{ response: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("conversation-intelligence", {
      body: {
        action: "generate-response",
        context,
      },
    });

    if (error) throw error;
    return data as { response: string };
  } catch (error) {
    if (import.meta.env.MODE !== 'production') console.error("AI error", error);
    throw normalizeAIError(error);
  }
}
