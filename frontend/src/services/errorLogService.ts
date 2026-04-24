export type ErrorLogPayload = {
  message: string;
  componentStack?: string;
  timestamp: string;
};

// Use relative URL for production (same origin)
const DEFAULT_TARGET_API_URL = "/api";

const TARGET_API_URL = import.meta.env.MODE === 'production'
  ? DEFAULT_TARGET_API_URL
  : ((import.meta.env.VITE_WHATSAPP_API_BASE_URL as string | undefined)?.trim().replace(/\/$/, "") ||
     ((import.meta.env as Record<string, string | undefined>).TARGET_API_URL ?? "").trim().replace(/\/$/, "") ||
     DEFAULT_TARGET_API_URL);
const SYSTEM_API_BASE_URL = (() => {
  try {
    return new URL(TARGET_API_URL).origin;
  } catch {
    return "";
  }
})();

export async function sendErrorLog(payload: ErrorLogPayload) {
  if (!SYSTEM_API_BASE_URL) return;
  try {
    const url = `${SYSTEM_API_BASE_URL}/api/system/error-log`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "main",
      },
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
