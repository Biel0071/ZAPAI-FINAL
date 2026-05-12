/**
 * Conversation Analyzer — Backend API mode.
 *
 * Previously called Supabase Edge Functions. Now routes through
 * the backend's AI intelligence service which provides the same
 * analysis capabilities via PostgreSQL + OpenAI.
 */
import { requestApiEndpoint } from "@/services/apiService";

export interface ConversationAnalysis {
  summary?: string;
  sentiment?: "positive" | "neutral" | "negative";
  topics?: string[];
  actionItems?: string[];
  leadScore?: number;
}

export async function analyzeConversation(
  conversationId: string,
  messages: Array<{ text: string; fromMe: boolean }>,
): Promise<ConversationAnalysis | null> {
  try {
    return await requestApiEndpoint<ConversationAnalysis>(
      "/api/ai/analyze-conversation",
      "POST",
      { conversationId, messages },
    );
  } catch (error) {
    console.warn("[ConversationAnalyzer] Analysis failed:", error);
    return null;
  }
}

export async function generateResponse(
  conversationId: string,
  context: { messages?: Array<{ text: string; fromMe: boolean }>; prompt?: string },
): Promise<string | null> {
  try {
    const result = await requestApiEndpoint<{ response?: string }>(
      "/api/ai/generate-response",
      "POST",
      { conversationId, ...context },
    );
    return result?.response ?? null;
  } catch (error) {
    console.warn("[ConversationAnalyzer] Response generation failed:", error);
    return null;
  }
}
