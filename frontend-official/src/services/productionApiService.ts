import { buildApiHeaders } from "@/lib/apiGuard";
import { API_ORIGIN } from "@/lib/backendConfig";

async function requestDirect<T>(endpoint: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const headers = await buildApiHeaders();
  const response = await fetch(`${API_ORIGIN}${endpoint}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parsed as T;
}

export async function requestProductionApi<T>(endpoint: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  return requestDirect<T>(endpoint, method, body);
}