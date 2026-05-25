/**
 * Lead Intelligence Store — Backend API mode.
 *
 * Previously called Supabase directly. Now persists lead temperature
 * via the backend REST API, which stores it in PostgreSQL.
 */
import { requestApiEndpoint } from "@/services/apiService";

export async function saveLeadTemperature(
  conversationId: string | number,
  leadData?: {
    lead_temperature?: string;
    temperature?: string;
    intent?: string;
    urgency?: string;
    confidence?: number;
    keywords?: string[];
  },
) {
  try {
    await requestApiEndpoint("/api/leads/temperature", "POST", {
      conversationId: String(conversationId),
      temperature: leadData?.lead_temperature ?? leadData?.temperature ?? "cold",
      intent: leadData?.intent ?? "unknown",
      confidence: leadData?.confidence ?? 0,
    });
  } catch (error) {
    console.warn("[LeadIntelligence] Failed to save temperature:", error);
  }
}

export async function getLeadTemperature(conversationId: string | number) {
  try {
    return await requestApiEndpoint<{
      temperature: string;
      intent?: string;
      urgency?: string;
    }>(`/api/leads/temperature/${encodeURIComponent(String(conversationId))}`, "GET");
  } catch {
    return null;
  }
}
