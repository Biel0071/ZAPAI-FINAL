import { slog } from "@/lib/structuredLogger";
import { API_BASE_URL } from "@/lib/backendConfig";
import { buildApiHeaders } from "@/lib/apiGuard";

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

export type RuntimeCoherenceResponse = {
  frontendRuntime?: string;
  frontendUrl?: string;
  backendUrl?: string;
  websocketUrl?: string;
  [key: string]: unknown;
};

export type SystemDiagnosticsResponse = {
  [key: string]: unknown;
};

let runtimeStatusEndpointUnavailable = false;
let errorLogEndpointUnavailable = false;

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
  if (!resolvedBaseUrl) {
    throw new Error("API_ORIGIN_UNAVAILABLE: configure VITE_API_URL para o backend oficial");
  }

  const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path;
  const endpoint = `${resolvedBaseUrl}${normalizedPath}`;
  slog.info("system", `${method} ${normalizedPath}`, { route: normalizedPath });

  let response: Response;
  try {
    const apiHeaders = await buildApiHeaders();
    response = await fetch(endpoint, {
      method,
      headers: apiHeaders,
      body: method === "POST" ? JSON.stringify({}) : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro de rede ao acessar o sistema";
    const normalized = message.toLowerCase();
    if (
      normalized.includes("cors") ||
      normalized.includes("failed to fetch") ||
      normalized.includes("access-control-allow-origin") ||
      normalized.includes("networkerror")
    ) {
      throw new Error("Falha de CORS ao conectar com o backend configurado");
    }
    throw new Error(message);
  }

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
    // Only throw if there is a TRUTHY error value.
    // The backend envelope includes "error": null on success — must NOT throw on that.
    if ((parsed as Record<string, unknown>).error) {
      throw new Error(String((parsed as Record<string, unknown>).error ?? "System request failed"));
    }

    // Auto-unwrap backend envelope: { success: true, data: {...} }
    const asRecord = parsed as Record<string, unknown>;
    if ("data" in asRecord && asRecord.data && typeof asRecord.data === "object") {
      return asRecord.data as Record<string, unknown>;
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
  async getRuntimeCoherence(baseUrl?: string) {
    const [health, websocket] = await Promise.all([
      requestSystem("/api/health", "GET", baseUrl),
      requestSystem("/api/websocket/status", "GET", baseUrl),
    ]);

    const healthData = (health.data && typeof health.data === "object" ? health.data : health) as Record<string, unknown>;
    const websocketData = (websocket.data && typeof websocket.data === "object" ? websocket.data : websocket) as Record<string, unknown>;

    return {
      health: healthData,
      websocket: websocketData,
      runtimeIdentity:
        (typeof healthData.runtimeIdentity === "object" && healthData.runtimeIdentity) ||
        (typeof websocketData.runtimeIdentity === "object" && websocketData.runtimeIdentity) ||
        {},
    } as RuntimeCoherenceResponse & {
      health: Record<string, unknown>;
      websocket: Record<string, unknown>;
      runtimeIdentity: Record<string, unknown>;
    };
  },
  async getStatus(baseUrl?: string) {
    let data: SystemStatusResponse & Record<string, unknown>;

    if (!runtimeStatusEndpointUnavailable) {
      try {
        data = (await requestSystem("/api/system/runtime/status", "GET", baseUrl)) as SystemStatusResponse & Record<string, unknown>;
        const state = resolveRuntimeUiState(data);
        return { active: state === "running", state, raw: data };
      } catch {
        runtimeStatusEndpointUnavailable = true;
      }
    }

    {
      data = (await requestSystem("/api/health", "GET", baseUrl)) as SystemStatusResponse & Record<string, unknown>;
    }

    const state = resolveRuntimeUiState(data);
    return { active: state === "running", state, raw: data };
  },

  async getErrorLogs(baseUrl?: string) {
    let data: unknown;

    if (!errorLogEndpointUnavailable) {
      try {
        data = await requestSystem("/api/system/error-log", "GET", baseUrl);
      } catch {
        errorLogEndpointUnavailable = true;
        data = [];
      }
    } else {
      data = [];
    }

    const entries = Array.isArray(data) ? data : Array.isArray((data as { errors?: unknown }).errors) ? ((data as { errors?: unknown }).errors as unknown[]) : [];
    return entries
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
      .map(normalizeErrorLog)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);
  },

  async getAiDiagnostics(baseUrl?: string) {
    void baseUrl;
    return {} as AiDiagnosticsResponse;
  },

  async getDiagnostics(baseUrl?: string) {
    void baseUrl;
    return {} as SystemDiagnosticsResponse;
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
