import { API_ORIGIN } from "@/lib/backendConfig";
import { buildApiHeaders } from "@/lib/apiGuard";

export type ErrorLogPayload = {
  message: string;
  componentStack?: string;
  timestamp: string;
};
const SYSTEM_API_BASE_URL = API_ORIGIN;

export async function sendErrorLog(payload: ErrorLogPayload) {
  if (!SYSTEM_API_BASE_URL) return;
  const blockErrorLogRequests =
    (import.meta.env.VITE_DISABLE_REMOTE_ERROR_LOG as string | undefined)?.toLowerCase() === "true";
  if (blockErrorLogRequests) return;

  try {
    const url = `${SYSTEM_API_BASE_URL}/api/system/error-log`;
    const apiHeaders = await buildApiHeaders();

    const response = await fetch(url, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Failed to send error log: ${response.status}`);
    }
  } catch {
    return;
  }
}
