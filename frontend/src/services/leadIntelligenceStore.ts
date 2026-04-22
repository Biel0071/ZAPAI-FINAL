import { supabase } from "@/integrations/supabase/client";
import type { LeadIntentResult } from "@/services/leadAnalyzer";

export async function saveLeadTemperature(conversationId: string, analysis: LeadIntentResult) {
  const { error } = await supabase.from("lead_intelligence").upsert(
    {
      conversation_id: conversationId,
      intent: analysis.intent,
      lead_temperature: analysis.lead_temperature,
      confidence: analysis.confidence,
      next_action: analysis.next_action,
    },
    { onConflict: "conversation_id" },
  );

  if (error) throw error;
}
