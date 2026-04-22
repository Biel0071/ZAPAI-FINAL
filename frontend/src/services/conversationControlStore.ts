import { supabase } from "@/integrations/supabase/client";

export type ConversationControl = {
  conversationId: string;
  aiEnabled: boolean;
  summary: string;
  summarizedMessageCount: number;
  updatedAt?: string;
};

type ControlRow = {
  conversation_id: string;
  ai_enabled: boolean;
  summary: string | null;
  summarized_message_count: number;
  updated_at: string;
};

function normalizeControl(row: ControlRow): ConversationControl {
  return {
    conversationId: row.conversation_id,
    aiEnabled: row.ai_enabled ?? true,
    summary: row.summary ?? "",
    summarizedMessageCount: row.summarized_message_count ?? 0,
    updatedAt: row.updated_at,
  };
}

export async function listConversationControls(conversationIds: string[]) {
  if (!conversationIds.length) return {} as Record<string, ConversationControl>;

  const { data, error } = await (supabase as any)
    .from("conversation_controls")
    .select("conversation_id, ai_enabled, summary, summarized_message_count, updated_at")
    .in("conversation_id", conversationIds);

  if (error) throw error;

  return ((data ?? []) as ControlRow[]).reduce<Record<string, ConversationControl>>((acc, row) => {
    const normalized = normalizeControl(row);
    acc[normalized.conversationId] = normalized;
    return acc;
  }, {});
}

export async function upsertConversationControl(payload: {
  conversationId: string;
  aiEnabled?: boolean;
  summary?: string;
  summarizedMessageCount?: number;
}) {
  const { data, error } = await (supabase as any)
    .from("conversation_controls")
    .upsert(
      {
        conversation_id: payload.conversationId,
        ai_enabled: payload.aiEnabled,
        summary: payload.summary,
        summarized_message_count: payload.summarizedMessageCount,
      },
      { onConflict: "conversation_id" },
    )
    .select("conversation_id, ai_enabled, summary, summarized_message_count, updated_at")
    .single();

  if (error) throw error;
  return normalizeControl(data as ControlRow);
}
