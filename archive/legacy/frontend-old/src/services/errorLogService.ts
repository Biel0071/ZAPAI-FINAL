import { API_BASE_URL } from "@/config/runtime";

export type ErrorLogPayload = {
  message: string;
  componentStack?: string;
  timestamp: string;
};

const SYSTEM_API_BASE_URL = API_BASE_URL.trim().replace(/\/$/, "");

export async function sendErrorLog(payload: ErrorLogPayload) {
  if (!SYSTEM_API_BASE_URL) return;
  try {
    const url = `${SYSTEM_API_BASE_URL}/api/system/error-log`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": "default",
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
