/**
 * Conversation Control Store — Backend API mode.
 *
 * Previously called Supabase directly. Now uses backend REST API
 * to manage per-conversation control settings (AI toggle, tags, notes).
 */
import { requestApiEndpoint } from "@/services/apiService";

export interface ConversationControl {
  conversation_id: string;
  ai_enabled: boolean;
  assigned_to?: string;
  tags?: string[];
  notes?: string;
  priority?: "low" | "medium" | "high";
  updated_at?: string;
}

export async function listConversationControls(): Promise<ConversationControl[]> {
  try {
    const data = await requestApiEndpoint<ConversationControl[]>("/api/conversations/controls", "GET");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function upsertConversationControl(
  control: Partial<ConversationControl> & { conversation_id: string },
): Promise<ConversationControl | null> {
  try {
    return await requestApiEndpoint<ConversationControl>(
      "/api/conversations/controls",
      "POST",
      control,
    );
  } catch (error) {
    console.warn("[ConversationControl] Failed to upsert:", error);
    return null;
  }
}

export async function getConversationControl(
  conversationId: string,
): Promise<ConversationControl | null> {
  try {
    return await requestApiEndpoint<ConversationControl>(
      `/api/conversations/controls/${encodeURIComponent(conversationId)}`,
      "GET",
    );
  } catch {
    return null;
  }
}
