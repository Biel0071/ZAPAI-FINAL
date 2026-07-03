import { API_ORIGIN } from "@/lib/backendConfig";
import { buildApiHeaders } from "@/lib/apiGuard";

export type ErrorLogPayload = {
  message: string;
  componentStack?: string;
  timestamp: string;
  type?: string;
  level?: string;
  service?: string;
  stack?: string;
};

const SYSTEM_API_BASE_URL = API_ORIGIN;

// Circuit breaker — prevents request storms when backend is unreachable
const CB_FAILURE_THRESHOLD = 3;
const CB_RESET_MS = 5 * 60_000; // 5 minutes back-off
let _cbFailures = 0;
let _cbOpenUntil = 0;

// Dedup — same message within 30s is silently dropped
const DEDUP_WINDOW_MS = 30_000;
const _recentMessages = new Map<string, number>();

function _isDuplicate(message: string): boolean {
  const now = Date.now();
  const key = message.slice(0, 120);
  const last = _recentMessages.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  _recentMessages.set(key, now);
  if (_recentMessages.size > 50) {
    for (const [k, t] of _recentMessages) {
      if (now - t > DEDUP_WINDOW_MS) _recentMessages.delete(k);
    }
  }
  return false;
}

export async function sendErrorLog(payload: ErrorLogPayload) {
  if (!SYSTEM_API_BASE_URL) return;

  const blockErrorLogRequests =
    (import.meta.env.VITE_DISABLE_REMOTE_ERROR_LOG as string | undefined)?.toLowerCase() === "true";
  if (blockErrorLogRequests) return;

  // Circuit breaker: if too many failures, back off silently
  if (Date.now() < _cbOpenUntil) return;

  // Dedup: same error within 30s is dropped
  if (_isDuplicate(payload.message)) return;

  try {
    const url = `${SYSTEM_API_BASE_URL}/api/system/error-log`;
    const apiHeaders = await buildApiHeaders();

    const response = await fetch(url, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000), // Never block UI
    });

    if (response.ok) {
      _cbFailures = 0; // Reset on success
      return;
    }

    _cbFailures += 1;
    if (_cbFailures >= CB_FAILURE_THRESHOLD) {
      _cbOpenUntil = Date.now() + CB_RESET_MS;
    }
  } catch {
    _cbFailures += 1;
    if (_cbFailures >= CB_FAILURE_THRESHOLD) {
      _cbOpenUntil = Date.now() + CB_RESET_MS;
    }
    // Always silent — never let error logging cause errors
  }
}
