/**
 * Conversation Control Store — Backend API mode.
 *
 * Previously called Supabase directly. Now uses backend REST API
 * to manage per-conversation control settings (AI toggle, tags, notes).
 */
import { requestApiEndpoint } from "@/services/apiService";

export interface ConversationControl {
  conversation_id: string;
  conversationId: string;
  ai_enabled: boolean;
  aiEnabled: boolean;
  assigned_to?: string;
  tags?: string[];
  notes?: string;
  summary?: string;
  summarizedMessageCount?: number;
  priority?: "low" | "medium" | "high";
  updated_at?: string;
}

function normalizeConversationControl(control: Partial<ConversationControl>): ConversationControl | null {
  const conversationId = String(control.conversationId ?? control.conversation_id ?? "").trim();
  if (!conversationId) return null;
  const aiEnabled = control.aiEnabled ?? control.ai_enabled ?? true;

  return {
    ...control,
    conversation_id: conversationId,
    conversationId,
    ai_enabled: Boolean(aiEnabled),
    aiEnabled: Boolean(aiEnabled),
    notes: control.notes ?? "",
  };
}

export async function listConversationControls(conversationIds?: string[]): Promise<Record<string, ConversationControl>> {
  try {
    const data = await requestApiEndpoint<ConversationControl[]>("/api/conversations/controls", "GET");
    const allowedIds = conversationIds?.length ? new Set(conversationIds.map(String)) : null;
    return (Array.isArray(data) ? data : []).reduce<Record<string, ConversationControl>>((result, item) => {
      const normalized = normalizeConversationControl(item);
      if (!normalized || (allowedIds && !allowedIds.has(normalized.conversationId))) return result;
      result[normalized.conversationId] = normalized;
      return result;
    }, {});
  } catch {
    return {};
  }
}

export async function upsertConversationControl(
  control: Partial<ConversationControl> & { conversation_id?: string; conversationId?: string },
): Promise<ConversationControl | null> {
  try {
    const response = await requestApiEndpoint<ConversationControl>(
      "/api/conversations/controls",
      "POST",
      control,
    );
    return normalizeConversationControl(response);
  } catch (error) {
    console.warn("[ConversationControl] Failed to upsert:", error);
    return null;
  }
}

export async function getConversationControl(
  conversationId: string,
): Promise<ConversationControl | null> {
  try {
    const response = await requestApiEndpoint<ConversationControl>(
      `/api/conversations/controls/${encodeURIComponent(conversationId)}`,
      "GET",
    );
    return normalizeConversationControl(response);
  } catch {
    return null;
  }
}
