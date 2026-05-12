/**
 * Lead Intelligence Store — Backend API mode.
 *
 * Previously called Supabase directly. Now persists lead temperature
 * via the backend REST API, which stores it in PostgreSQL.
 */
import { requestApiEndpoint } from "@/services/apiService";

export async function saveLeadTemperature(data: {
  conversation_id: string;
  temperature: string;
  intent?: string;
  urgency?: string;
  keywords?: string[];
}) {
  try {
    await requestApiEndpoint("/api/leads/temperature", "POST", data);
  } catch (error) {
    console.warn("[LeadIntelligence] Failed to save temperature:", error);
  }
}

export async function getLeadTemperature(conversationId: string) {
  try {
    return await requestApiEndpoint<{
      temperature: string;
      intent?: string;
      urgency?: string;
    }>(`/api/leads/temperature/${encodeURIComponent(conversationId)}`, "GET");
  } catch {
    return null;
  }
}
