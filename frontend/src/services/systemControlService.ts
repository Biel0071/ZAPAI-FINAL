import { slog } from "@/lib/structuredLogger";

export type RuntimeUiState = "offline" | "starting" | "running";

export type SystemStatusResponse = {
  active?: boolean;
  isActive?: boolean;
  running?: boolean;
  status?: string;
  runtime?: string;
  [key: string]: unknown;
};

export type SystemErrorLog = {
  timestamp: string;
  service: string;
  message: string;
};

const DEFAULT_TARGET_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, "") || "http://localhost:4025";

// Use relative URL for production (same origin)
const TARGET_API_URL = import.meta.env.MODE === 'production'
  ? ''
  : ((import.meta.env.VITE_WHATSAPP_API_BASE_URL as string | undefined)?.trim().replace(/\/$/, "") ||
     ((import.meta.env as Record<string, string | undefined>).TARGET_API_URL ?? "").trim().replace(/\/$/, "") ||
     DEFAULT_TARGET_API_URL);
const CONFIGURED_API_ORIGIN = (() => {
  try {
    return new URL(TARGET_API_URL).origin;
  } catch {
    return "";
  }
})();
const API_BASE_URL = `${CONFIGURED_API_ORIGIN}/api`;

export type AiDiagnosticsItem = {
  status: string;
  description: string;
  timestamp: string;
};

export type AiDiagnosticsResponse = {
  systemStatus?: Partial<AiDiagnosticsItem>;
  detectedBugs?: Partial<AiDiagnosticsItem>;
  systemMetrics?: Partial<AiDiagnosticsItem>;
  aiRecommendations?: Partial<AiDiagnosticsItem>;
  [key: string]: unknown;
};

export type SystemDiagnosticsResponse = {
  [key: string]: unknown;
};

function resolveSystemActive(status: SystemStatusResponse | null | undefined): boolean {
  if (!status) return false;
  if (typeof status.active === "boolean") return status.active;
  if (typeof status.isActive === "boolean") return status.isActive;
  if (typeof status.running === "boolean") return status.running;

  if (typeof status.status === "string") {
    const normalized = status.status.toLowerCase();
    if (normalized === "active" || normalized === "running" || normalized === "connected" || normalized === "online") {
      return true;
    }
  }

  const raw = status as Record<string, unknown>;
  const campaignQueue = typeof raw.campaignQueue === "string" ? raw.campaignQueue.toLowerCase() : "";
  const microtaskRunner = typeof raw.microtaskRunner === "string" ? raw.microtaskRunner.toLowerCase() : "";
  const socket = typeof raw.socket === "string" ? raw.socket.toLowerCase() : "";
  const whatsappConnected =
    typeof raw.whatsapp === "object" &&
    raw.whatsapp !== null &&
    typeof (raw.whatsapp as Record<string, unknown>).connected === "boolean"
      ? Boolean((raw.whatsapp as Record<string, unknown>).connected)
      : false;

  return campaignQueue === "running" || microtaskRunner === "running" || socket === "connected" || whatsappConnected;
}

function resolveRuntimeUiState(status: SystemStatusResponse | null | undefined): RuntimeUiState {
  if (!status) return "offline";

  const runtime = typeof status.runtime === "string" ? status.runtime.toLowerCase() : "";

  if (["running", "active", "online", "connected"].includes(runtime)) return "running";
  if (["starting", "booting", "initializing", "pending"].includes(runtime)) return "starting";

  return resolveSystemActive(status) ? "running" : "offline";
}

function resolveSystemBaseUrl(_baseUrl?: string): string {
  if (_baseUrl?.trim()) return _baseUrl.trim().replace(/\/$/, "");
  return API_BASE_URL;
}

async function requestSystem(path: string, method: "GET" | "POST", baseUrl?: string) {
  const resolvedBaseUrl = resolveSystemBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path;
  const endpoint = `${resolvedBaseUrl}${normalizedPath}`;
  slog.info("system", `${method} ${normalizedPath}`, { route: normalizedPath });

  const response = await fetch(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      "x-tenant-id": "main",
    },
    body: method === "POST" ? JSON.stringify({}) : undefined,
  });

  slog.apiRequest(normalizedPath, response.status);

  const raw = await response.text();
  const parsed = raw
    ? (() => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return raw;
        }
      })()
    : {};

  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object"
        ? String((parsed as Record<string, unknown>).error ?? (parsed as Record<string, unknown>).message ?? raw)
        : String(raw || `System request failed: ${response.status}`);
    throw new Error(message || `System request failed: ${response.status}`);
  }

  if (parsed && typeof parsed === "object") {
    if ("error" in (parsed as Record<string, unknown>)) {
      throw new Error(String((parsed as Record<string, unknown>).error ?? "System request failed"));
    }
    return parsed as Record<string, unknown>;
  }

  return {};
}

function normalizeErrorLog(raw: Record<string, unknown>): SystemErrorLog {
  return {
    timestamp:
      (typeof raw.timestamp === "string" && raw.timestamp) ||
      (typeof raw.createdAt === "string" && raw.createdAt) ||
      new Date().toISOString(),
    service:
      (typeof raw.service === "string" && raw.service) ||
      (typeof raw.source === "string" && raw.source) ||
      "system",
    message:
      (typeof raw.message === "string" && raw.message) ||
      (typeof raw.error === "string" && raw.error) ||
      "Unknown error",
  };
}

export const systemControlService = {
  async getStatus(baseUrl?: string) {
    const data = (await requestSystem("/api/system/runtime/status", "GET", baseUrl)) as SystemStatusResponse & Record<string, unknown>;
    const state = resolveRuntimeUiState(data);
    return { active: state === "running", state, raw: data };
  },

  async getErrorLogs(baseUrl?: string) {
    const data = await requestSystem("/api/system/error-log", "GET", baseUrl);
    const entries = Array.isArray(data) ? data : Array.isArray((data as { errors?: unknown }).errors) ? ((data as { errors?: unknown }).errors as unknown[]) : [];
    return entries
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
      .map(normalizeErrorLog)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  },

  async getAiDiagnostics(baseUrl?: string) {
    const data = (await requestSystem("/api/system/ai-diagnostics", "GET", baseUrl)) as AiDiagnosticsResponse;
    return data;
  },

  async getDiagnostics(baseUrl?: string) {
    const data = (await requestSystem("/api/diagnostics", "GET", baseUrl)) as SystemDiagnosticsResponse;
    return data;
  },

  async activate(baseUrl?: string) {
    try {
      await requestSystem("/api/system/activate", "POST", baseUrl);
    } catch {
      await requestSystem("/api/system/start", "POST", baseUrl);
    }
  },

  async stop(baseUrl?: string) {
    await requestSystem("/api/system/stop", "POST", baseUrl);
  },
};
