import { getCache, invalidateCache, setCache } from "@/lib/requestCache";
import { reportFrontendIssue } from "@/services/frontendHealthService";
import { slog } from "@/lib/structuredLogger";

const CACHE_TTL_MS = 30_000;
const METRICS_CACHE_TTL_MS = 10_000;
const SESSION_LIST_CACHE_TTL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_GET_RETRIES = 3;
const INITIAL_BACKOFF_MS = 700;
const PUBLIC_URL_STORAGE_KEY = "zapai_public_api_url";
const API_BASE_URL = `${(import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, "") || "http://localhost:4025"}/api`;
const CONFIGURED_API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();

/** Exported so other modules (socket, pages) can use the resolved backend origin */
export { CONFIGURED_API_ORIGIN as API_ORIGIN };

export interface Conversation {
  id: string;
  chatId?: string;
  companyId?: string;
  contactId?: string;
  sessionId?: string;
  contactName: string;
  avatar?: string;
  isGroup?: boolean;
  lastMessage: string;
  updatedAt: string;
  phone: string;
  unread?: number;
  status?: "online" | "offline" | "typing";
  tags?: string[];
  isAI?: boolean;
  lastMessageType?: "text" | "image" | "video" | "audio" | "file";
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  chatId?: string;
  content: string;
  caption?: string;
  fromMe: boolean;
  createdAt: string;
  timestamp?: string;
  status?: "sending" | "sent" | "delivered" | "read";
  isAI?: boolean;
  mediaType?: "image" | "video" | "audio" | "file";
  mediaPath?: string;
  mediaUrl?: string;
  url?: string;
  emoji?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  status: string;
}

export interface AnalyticsSummary {
  responseRate: number;
  resolvedConversations: number;
  averageServiceTime: number;
  aiErrors: number;
  topWords: string[];
}

export interface MetricsSummary {
  messagesToday?: number;
  todayMessages?: number;
  totalMessages?: number;
  messages?: number;
  activeChats?: number;
  chats?: number;
  aiResponses?: number;
  ai?: number;
  botResponses?: number;
  newLeads?: number;
  leads?: number;
}

export interface AIStatusResponse {
  enabled?: boolean;
  active?: boolean;
  status?: string;
}

export interface SessionInfo {
  id: string;
  name?: string;
  phone?: string;
  connected?: boolean;
  status?: string;
}

export interface ImproveRequest {
  customerQuestion: string;
  aiResponse: string;
  status: "closed" | "lost";
}

export interface ImproveResponse {
  suggestion?: string;
  improvedResponse?: string;
}

export interface PromptVersion {
  id?: string;
  content?: string;
  savedAt?: string;
}

export interface PromptSettings {
  prompt?: string;
  versions?: PromptVersion[];
}

export interface BusinessHoursSettings {
  openTime: string;
  closeTime: string;
  timezone: string;
  autoReplyOutsideHours: boolean;
}

export interface AbsenceMessageSettings {
  enabled: boolean;
  message: string;
}

export interface QueueSettings {
  batchSize: number;
  delaySeconds: number;
  reactivationMessage: string;
  customersWaiting?: number;
  messagesSentToday?: number;
}

export interface QueueProcessResponse {
  success?: boolean;
  messagesSent?: number;
}

export type RuntimeHealthState = "online" | "offline";

export interface RuntimeSessionHealth {
  runtime: RuntimeHealthState;
  sessions: RuntimeHealthState;
  activeSessions: number;
  totalSessions: number;
}

export interface SessionStatusResponse {
  connected: boolean;
  lastUpdate?: number;
}

export interface MemorySettings {
  enabled: boolean;
  rememberLastOrder: boolean;
  rememberPreferences: boolean;
}

export interface AdvancedAISettings {
  temperature: number;
  maxTokens: number;
  responseDelaySeconds: number;
  autoFollowUp: boolean;
}

export interface PersistedMessagePayload {
  id: string;
  conversationId?: string;
  content?: string;
  text?: string;
  fromMe?: boolean;
  sent?: boolean;
  from?: string;
  createdAt?: string;
  timestamp?: string;
  status?: "sent" | "delivered" | "read";
  mediaType?: "image" | "video" | "audio" | "file";
  type?: "text" | "image" | "video" | "audio" | "file";
  mediaPath?: string | null;
  mediaUrl?: string | null;
  url?: string | null;
}

export interface MessageSendResponse {
  success: boolean;
  message?: PersistedMessagePayload;
  error?: string;
  [key: string]: unknown;
}

type ProxyRequest = {
  endpoint: string;
  method: "GET" | "POST" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
};

const inFlightControllers = new Map<string, AbortController>();

function abortPreviousRequest(key: string) {
  const previous = inFlightControllers.get(key);
  if (previous) {
    try { previous.abort(); } catch { /* noop */ }
    inFlightControllers.delete(key);
  }
}

function registerInFlightRequest(key: string, controller: AbortController) {
  if (inFlightControllers.size > 50) {
    const first = inFlightControllers.keys().next().value;
    if (first !== undefined) {
      try { inFlightControllers.get(first)?.abort(); } catch { /* noop */ }
      inFlightControllers.delete(first);
    }
  }
  inFlightControllers.set(key, controller);
}

function unregisterInFlightRequest(key: string) {
  inFlightControllers.delete(key);
}

const RETRYABLE_GET_ENDPOINTS = [
  /^\/api\/health(?:\?|$)/,
  /^\/api\/system\/runtime\/status(?:\?|$)/,
  /^\/api\/session-status(?:\?|$)/,
  /^\/session-status(?:\?|$)/,
  /^\/sessions(?:\?|$)/,
  /^\/api\/conversations(?:\?|$)/,
  /^\/api\/messages(?:\/|\?|$)/,
];

type RawConversation = {
  id?: string;
  conversationId?: string;
  conversation_id?: string;
  chatId?: string;
  chat_id?: string;
  jid?: string;
  remoteJid?: string;
  companyId?: string;
  company_id?: string;
  contactId?: string;
  contact_id?: string;
  sessionId?: string;
  session_id?: string;
  contactName?: string;
  name?: string;
  pushName?: string;
  avatar?: string;
  profilePictureUrl?: string;
  profile_picture_url?: string;
  isGroup?: boolean;
  lastMessage?: string;
  last_message?: string;
  updatedAt?: string;
  updated_at?: string;
  phone?: string;
  unread?: number;
  unread_count?: number;
  unreadCount?: number;
  status?: "online" | "offline" | "typing";
  tags?: string[];
  isAI?: boolean;
  lastMessageType?: "text" | "image" | "video" | "audio" | "file";
  messageType?: "text" | "image" | "video" | "audio" | "file";
  mediaType?: "image" | "video" | "audio" | "file";
};

type RawMessage = {
  id?: string;
  conversationId?: string;
  conversation_id?: string;
  chatId?: string;
  chat_id?: string;
  remoteJid?: string;
  jid?: string;
  content?: string;
  text?: string;
  body?: string;
  caption?: string;
  fromMe?: boolean;
  sent?: boolean;
  createdAt?: string;
  created_at?: string;
  time?: string;
  status?: "sent" | "delivered" | "read";
  isAI?: boolean;
  mediaType?: "image" | "video" | "audio" | "file";
  type?: "text" | "image" | "video" | "audio" | "file";
  mediaPath?: string;
  media_path?: string;
  mediaUrl?: string;
  media_url?: string;
  url?: string;
  thumbnail?: string;
  emoji?: string;
};

type RawSession = {
  id?: string;
  sessionId?: string;
  session_id?: string;
  name?: string;
  sessionName?: string;
  session_name?: string;
  phone?: string;
  phoneNumber?: string;
  phone_number?: string;
  connected?: boolean;
  status?: string;
};

function resolveDirectApiUrl(endpoint: string): string {
  const normalizePath = (value: string) => (value.startsWith("/") ? value : `/${value}`);

  if (/^https?:\/\//i.test(endpoint)) {
    try {
      const parsed = new URL(endpoint);
      const normalizedPath = normalizePath(parsed.pathname);
      if (normalizedPath.startsWith("/api/")) {
        return `${CONFIGURED_API_ORIGIN}${normalizedPath}${parsed.search}`;
      }
      return `${API_BASE_URL}${normalizedPath}${parsed.search}`;
    } catch {
      return endpoint;
    }
  }

  const normalizedPath = normalizePath(endpoint);
  return normalizedPath.startsWith("/api/") ? `${CONFIGURED_API_ORIGIN}${normalizedPath}` : `${API_BASE_URL}${normalizedPath}`;
}

async function request<T>({ endpoint, method, body, timeoutMs = REQUEST_TIMEOUT_MS }: ProxyRequest): Promise<T> {
  const normalizedEndpoint = (() => {
    if (!/^https?:\/\//i.test(endpoint)) return endpoint;

    try {
      const parsed = new URL(endpoint);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return endpoint;
    }
  })();

  const shouldRetry = method === "GET" && RETRYABLE_GET_ENDPOINTS.some((pattern) => pattern.test(normalizedEndpoint));
  let attempt = 0;

  while (attempt <= MAX_GET_RETRIES) {
    let timedOut = false;
    let timeoutId: number | undefined;

    try {
      const url = resolveDirectApiUrl(endpoint);
      slog.info("api", `${method} ${endpoint}`, { route: endpoint });

      const controller = new AbortController();
      const inFlightKey = `${method}:${normalizedEndpoint}`;
      abortPreviousRequest(inFlightKey);
      registerInFlightRequest(inFlightKey, controller);

      timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
            "x-tenant-id": "main",
            ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
          },
          body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
          signal: controller.signal,
        });

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
          const details =
            parsed && typeof parsed === "object"
              ? String((parsed as Record<string, unknown>).error ?? (parsed as Record<string, unknown>).message ?? raw ?? "Request failed")
              : String(raw || "Request failed");
          slog.apiRequest(endpoint, response.status, {
            error: details,
            suggestion: response.status === 400 ? "Verificar payload ou query params enviados" : response.status === 404 ? "Endpoint não existe no backend" : undefined,
          });
          throw new Error(details || `Request failed with status ${response.status}`);
        }

        if (parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)) {
          throw new Error(String((parsed as Record<string, unknown>).error ?? "Request failed"));
        }

        slog.apiRequest(endpoint, response.status);

        // Auto-unwrap backend envelope: { success: true, data: [] }
        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed) &&
          "data" in (parsed as Record<string, unknown>) &&
          "success" in (parsed as Record<string, unknown>)
        ) {
          return (parsed as Record<string, unknown>).data as T;
        }

        return parsed as T;
      } finally {
        window.clearTimeout(timeoutId);
        unregisterInFlightRequest(`${method}:${normalizedEndpoint}`);
      }
    } catch (error) {
      const wasTimedOut = timedOut || (error instanceof Error && error.name === "AbortError");
      if (wasTimedOut) {
        const timeoutError = new Error(`API timeout after ${timeoutMs}ms`);
        slog.warn("api", `Request failed: ${endpoint}`, {
          route: endpoint,
          error: timeoutError.message,
        });

        if (shouldRetry && attempt < MAX_GET_RETRIES) {
          const backoffMs = INITIAL_BACKOFF_MS * 2 ** attempt;
          await new Promise((resolve) => window.setTimeout(resolve, backoffMs));
          attempt += 1;
          continue;
        }

        reportFrontendIssue({
          type: "api_timeout",
          message: `API timeout on ${endpoint}`,
          service: "backend-api",
          level: "warning",
        });

        throw timeoutError;
      }

      slog.warn("api", `Request failed: ${endpoint}`, {
        route: endpoint,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const retriable =
        errorMessage.includes("timeout") ||
        errorMessage.includes("offline") ||
        errorMessage.includes("fetch") ||
        errorMessage.includes("network") ||
        errorMessage.includes("503") ||
        errorMessage.includes("502");

      const shouldAttemptAgain = shouldRetry && retriable && attempt < MAX_GET_RETRIES;
      if (shouldAttemptAgain) {
        const backoffMs = INITIAL_BACKOFF_MS * 2 ** attempt;
        await new Promise((resolve) => window.setTimeout(resolve, backoffMs));
        attempt += 1;
        continue;
      }

      if (retriable) {
        reportFrontendIssue({
          type: "socket_disconnection",
          message: "Backend indisponível no momento. Tentando reconectar automaticamente.",
          service: endpoint,
          level: "warning",
        });
      }

      throw error;
    }
  }

  throw new Error("Falha de comunicação com o backend");
}

function resolvePublicUrlFromApiBase(): string {
  const persisted = readPersistedPublicUrl();
  if (persisted) return persisted;

  return CONFIGURED_API_ORIGIN;
}

function readPersistedPublicUrl(): string {
  if (typeof window === "undefined") return "";
  const value = window.localStorage.getItem(PUBLIC_URL_STORAGE_KEY) ?? "";
  return value.trim().replace(/\/$/, "");
}

function persistPublicUrl(value: string) {
  if (typeof window === "undefined") return;
  const normalized = value.trim().replace(/\/$/, "");
  if (!normalized) return;
  window.localStorage.setItem(PUBLIC_URL_STORAGE_KEY, normalized);
}

function resolveLocalFallbackPublicUrl(): string {
  const persisted = readPersistedPublicUrl();
  if (persisted) return persisted;

  const envUrl = resolvePublicUrlFromApiBase();
  if (envUrl) return envUrl;

  return "";
}

function normalizeIdentifier(value: string | number | null | undefined): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function extractChatIdentifier(value: string | number | null | undefined): string | undefined {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  if (raw.includes("@g.us") || raw.includes("@s.whatsapp.net")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits || undefined;
}

function normalizeConversation(item: RawConversation, index: number): Conversation {
  const normalizedType = item.lastMessageType ?? item.messageType ?? item.mediaType ?? "text";
  const contactId = normalizeIdentifier((item.contactId ?? item.contact_id) as string | number | undefined);
  const sessionId = normalizeIdentifier((item.sessionId ?? item.session_id) as string | number | undefined);
  const resolvedPhone =
    extractChatIdentifier(item.phone) ??
    extractChatIdentifier(item.chatId) ??
    extractChatIdentifier(item.chat_id) ??
    extractChatIdentifier(item.jid) ??
    extractChatIdentifier(item.remoteJid) ??
    "";
  const stableFallbackId = [contactId, sessionId, resolvedPhone].filter(Boolean).join("-");

  return {
    id:
      normalizeIdentifier((item.id ?? item.conversationId ?? item.conversation_id) as string | number | undefined) ??
      (stableFallbackId || `conversation-${index}`),
    chatId: normalizeIdentifier((item.chatId ?? item.chat_id) as string | number | undefined) ?? resolvedPhone,
    companyId: item.companyId ?? item.company_id,
    contactId,
    sessionId,
    contactName: item.contactName ?? item.name ?? item.pushName ?? resolvedPhone ?? "Contato",
    avatar: item.avatar ?? item.profilePictureUrl ?? item.profile_picture_url,
    isGroup: item.isGroup ?? resolvedPhone.includes("@g.us"),
    lastMessage: item.lastMessage ?? item.last_message ?? "",
    updatedAt: item.updatedAt ?? item.updated_at ?? new Date().toISOString(),
    phone: resolvedPhone,
    unread: item.unread ?? item.unread_count ?? item.unreadCount ?? 0,
    status: item.status ?? "offline",
    tags: item.tags ?? [],
    isAI: item.isAI ?? false,
    lastMessageType:
      normalizedType === "image" || normalizedType === "video" || normalizedType === "audio" || normalizedType === "file"
        ? normalizedType
        : "text",
  };
}

function normalizeMessage(item: RawMessage, index: number, defaultConversationId?: string): ChatMessage {
  const normalizedMediaType = item.mediaType ?? item.type;
  const mediaPath = item.mediaPath ?? item.media_path;
  const mediaUrl = item.url ?? item.mediaUrl ?? item.media_url;
  const source = `${mediaPath ?? ""} ${mediaUrl ?? ""}`.toLowerCase();

  const inferredMediaType =
    normalizedMediaType === "image" || normalizedMediaType === "video" || normalizedMediaType === "audio" || normalizedMediaType === "file"
      ? normalizedMediaType
      : /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/.test(source)
        ? "image"
        : /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/.test(source)
          ? "video"
          : /\.(mp3|wav|ogg|m4a|aac|opus|webm)(\?|$)/.test(source)
            ? "audio"
            : mediaPath || mediaUrl
              ? "file"
              : undefined;

  return {
    id: normalizeIdentifier(item.id as string | number | undefined) ?? `message-${index}`,
    conversationId: normalizeIdentifier((item.conversationId ?? item.conversation_id) as string | number | undefined) ?? defaultConversationId,
    chatId: normalizeIdentifier((item.chatId ?? item.chat_id) as string | number | undefined) ?? extractChatIdentifier(item.remoteJid ?? item.jid),
    content: item.content ?? item.text ?? item.body ?? item.caption ?? "",
    caption: item.caption,
    fromMe: item.fromMe ?? item.sent ?? false,
    createdAt: item.createdAt ?? item.created_at ?? item.time ?? new Date().toISOString(),
    timestamp: item.createdAt ?? item.created_at ?? item.time,
    status: item.status ?? "sent",
    isAI: item.isAI ?? false,
    mediaType: inferredMediaType,
    mediaPath,
    mediaUrl,
    url: mediaUrl ?? mediaPath,
    emoji: item.emoji,
  };
}

function withQuery(endpoint: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `${endpoint}?${queryString}` : endpoint;
}

function normalizeSessionName(name: string): string {
  return name.trim().replace(/\s+/g, "_").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "connected", "online"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "disconnected", "offline"].includes(normalized)) return false;
  }
  return undefined;
}

function normalizeSessionInfo(item: RawSession | null | undefined, index: number): SessionInfo {
  const safeItem = isRecord(item) ? (item as RawSession) : ({} as RawSession);

  const sessionName = safeItem.name ?? safeItem.sessionName ?? safeItem.session_name;
  const rawId = normalizeIdentifier((safeItem.sessionId ?? safeItem.session_id ?? safeItem.id) as string | number | undefined);
  const identifier = normalizeSessionName(sessionName ?? rawId ?? `session-${index}`);

  return {
    id: identifier,
    name: sessionName ?? identifier,
    phone: safeItem.phone ?? safeItem.phoneNumber ?? safeItem.phone_number,
    connected: toBoolean(safeItem.connected),
    status: typeof safeItem.status === "string" ? safeItem.status : undefined,
  };
}

function parseSessionStatusPayload(payload: unknown): RawSession[] {
  const asSessionArray = (value: unknown): RawSession[] => {
    if (Array.isArray(value)) return value.filter((item) => isRecord(item)) as RawSession[];
    if (!isRecord(value)) return [];

    const nestedListCandidates = [value.sessions, value.data, value.items, value.results];
    const nestedList = nestedListCandidates.find((candidate) => Array.isArray(candidate));
    if (Array.isArray(nestedList)) {
      return nestedList.filter((item) => isRecord(item)) as RawSession[];
    }

    const objectValues = Object.values(value);
    const recordValues = objectValues.filter((entry) => isRecord(entry));
    if (recordValues.length > 0 && recordValues.length === objectValues.length) {
      return recordValues as RawSession[];
    }

    return [];
  };

  return asSessionArray(payload);
}

function resolveRuntimeFromHealthPayload(payload: unknown): RuntimeHealthState {
  if (!payload || typeof payload !== "object") return "offline";
  // Backend responded with any payload → online
  return "online";
}

export const apiService = {
  async getPublicUrl() {
    const cacheKey = "public-url";
    const cached = getCache<{ publicUrl: string }>(cacheKey);
    if (cached?.publicUrl?.trim()) return cached;

    const resolved = { publicUrl: resolvePublicUrlFromApiBase() };
    persistPublicUrl(resolved.publicUrl);
    setCache(cacheKey, resolved, CACHE_TTL_MS);
    return resolved;
  },

  async getRuntimeSessionHealth(): Promise<RuntimeSessionHealth> {
    const [healthResult, runtimeStatusResult] = await Promise.allSettled([
      request<Record<string, unknown>>({ endpoint: "/api/health", method: "GET" }),
      request<Record<string, unknown>>({ endpoint: "/api/system/runtime/status", method: "GET" }),
    ]);

    const runtimePayload =
      healthResult.status === "fulfilled"
        ? healthResult.value
        : runtimeStatusResult.status === "fulfilled"
          ? runtimeStatusResult.value
          : null;

    const runtime =
      runtimePayload
        ? resolveRuntimeFromHealthPayload(runtimePayload)
        : "offline";

    let totalSessions = 0;
    let activeSessions = 0;

    if (healthResult.status === "fulfilled") {
      const healthData = healthResult.value as Record<string, unknown>;
      const data = (healthData.data ?? healthData) as Record<string, unknown>;
      const system = (data.system ?? data) as Record<string, unknown>;
      const sessionsInfo = system.sessions as Record<string, unknown> | undefined;
      const whatsapp = system.whatsapp as Record<string, unknown> | undefined;

      if (sessionsInfo) {
        totalSessions = Number(sessionsInfo.total ?? 0) || 0;
        activeSessions = Number(sessionsInfo.connected ?? 0) || 0;
      }
      if (totalSessions === 0 && whatsapp?.connected) {
        totalSessions = 1;
        activeSessions = 1;
      }
    }

    const sessionState: RuntimeHealthState =
      activeSessions > 0 ? "online" : "offline";

    return {
      runtime,
      sessions: sessionState,
      activeSessions,
      totalSessions,
    };
  },

  async getSessionStatus(): Promise<SessionStatusResponse> {
    try {
      const payload = await request<unknown>({ endpoint: "/session-status", method: "GET" });
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { connected: false, lastUpdate: Date.now() };
      }

      const raw = payload as Record<string, unknown>;
      const connected =
        typeof raw.connected === "boolean"
          ? raw.connected
          : typeof raw.status === "string"
            ? ["connected", "online", "active", "open", "running"].includes(raw.status.toLowerCase())
            : false;

      return {
        connected,
        lastUpdate: typeof raw.lastUpdate === "number" ? raw.lastUpdate : Date.now(),
      };
    } catch {
      return { connected: false, lastUpdate: Date.now() };
    }
  },

  async getConversations(forceRefresh = false, options?: { limit?: number }) {
    const cacheKey = options?.limit ? `conversations:${options.limit}` : "conversations";
    if (!forceRefresh) {
      const cached = getCache<Conversation[]>(cacheKey);
      if (cached) return cached;
    }

    const endpoint = withQuery("/api/conversations", { limit: options?.limit });
    const data = await request<RawConversation[]>({ endpoint, method: "GET" });
    const normalized = Array.isArray(data) ? data.map(normalizeConversation) : [];
    setCache(cacheKey, normalized, CACHE_TTL_MS);
    return normalized;
  },

  async getMessages(conversationId: string, options?: { limit?: number; before?: string }) {
    const primaryEndpoint = withQuery(`/api/messages/${encodeURIComponent(conversationId)}`, {
      limit: options?.limit,
      before: options?.before,
    });

    const fallbackEndpoints = [
      withQuery("/messages", {
        conversationId,
        limit: options?.limit,
        before: options?.before,
      }),
      withQuery(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
        limit: options?.limit,
        before: options?.before,
      }),
    ];

    try {
      const data = await request<RawMessage[] | { messages?: RawMessage[] }>({ endpoint: primaryEndpoint, method: "GET" });
      const entries = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
      return entries.map((item, index) => normalizeMessage(item, index, String(conversationId)));
    } catch {
      for (const endpoint of fallbackEndpoints) {
        try {
          const data = await request<RawMessage[] | { messages?: RawMessage[] }>({ endpoint, method: "GET" });
          const entries = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
          return entries.map((item, index) => normalizeMessage(item, index, String(conversationId)));
        } catch {
          // try next fallback endpoint
        }
      }

      throw new Error("Falha ao carregar mensagens da conversa");
    }
  },

  async sendMessage(payload: { phone: string; text: string; conversationId?: string; contactId?: string; sessionId?: string }) {
    const response = await request<MessageSendResponse>({ endpoint: "/send-message", method: "POST", body: payload });
    invalidateCache("conversations");
    invalidateCache("metrics");
    return response;
  },

  async sendMediaMessage(payload: {
    phone: string;
    caption?: string;
    fileName: string;
    mimeType: string;
    mediaType: "image" | "video" | "audio" | "file";
    dataBase64: string;
    conversationId?: string;
    contactId?: string;
    sessionId?: string;
  }) {
    const normalizedCaption = (payload.caption ?? "").trim();
    const normalizedBase64 = String(payload.dataBase64 ?? "").trim();
    const normalizedPhone = String(payload.phone ?? "").replace(/\D/g, "");

    if (!normalizedBase64) {
      throw new Error("Arquivo de mídia inválido. Tente selecionar o arquivo novamente.");
    }

    if (!normalizedPhone) {
      throw new Error("Telefone inválido para envio de mídia.");
    }

    const mediaTypeMap: Record<string, "image" | "video" | "audio" | "file"> = {
      image: "image",
      video: "video",
      audio: "audio",
      file: "file",
    };
    const mappedType = mediaTypeMap[payload.mediaType] ?? "file";

    const requestBody: Record<string, unknown> = {
      chatId: `${normalizedPhone}@s.whatsapp.net`,
      type: mappedType,
      file: normalizedBase64,
      mediaPath: `upload://${payload.fileName}`,
      caption: normalizedCaption,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      conversationId: payload.conversationId,
      contactId: payload.contactId,
      sessionId: payload.sessionId,
    };

    const candidateEndpoints = ["/api/send-media", "/send-media"];
    let lastError: unknown = new Error("Falha ao enviar mídia");

    for (const endpoint of candidateEndpoints) {
      try {
        const response = await request<MessageSendResponse>({
          endpoint,
          method: "POST",
          body: requestBody,
          timeoutMs: 45_000,
        });
        invalidateCache("conversations");
        invalidateCache("metrics");
        return response;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const recoverableError =
          message.includes("404") ||
          message.includes("route not found") ||
          message.includes("cannot post") ||
          message.includes("<!doctype") ||
          message.includes("413") ||
          message.includes("request entity too large") ||
          message.includes("request_error");

        if (!recoverableError) {
          throw error;
        }
      }
    }

    throw lastError;
  },

  async getContacts(forceRefresh = false) {
    const cacheKey = "contacts";
    if (!forceRefresh) {
      const cached = getCache<Contact[]>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<Contact[]>({ endpoint: "/api/contacts", method: "GET" });
    setCache(cacheKey, data, CACHE_TTL_MS);
    return data;
  },

  getAnalytics: () => request<AnalyticsSummary>({ endpoint: "/api/analytics", method: "GET" }),

  async getMetrics() {
    const cacheKey = "metrics";
    const cached = getCache<MetricsSummary>(cacheKey);
    if (cached) {
      return cached;
    }

    const candidateEndpoints = ["/metrics", "/api/metrics", "/api/analytics"];
    let lastError: unknown = new Error("Falha ao carregar métricas");

    for (const endpoint of candidateEndpoints) {
      try {
        const data = await request<MetricsSummary>({ endpoint, method: "GET" });
        setCache(cacheKey, data, METRICS_CACHE_TTL_MS);
        return data;
      } catch (error) {
        lastError = error;
      }
    }

    // Fallback: extract basic metrics from /api/health
    try {
      const health = await request<Record<string, unknown>>({ endpoint: "/api/health", method: "GET" });
      const data = (health as Record<string, unknown>).data as Record<string, unknown> | undefined;
      const system = (data?.system ?? data) as Record<string, unknown> | undefined;
      const metrics = system?.metrics as Record<string, unknown> | undefined;
      const sessions = system?.sessions as Record<string, unknown> | undefined;
      if (metrics || sessions) {
        const resolvedMetrics = {
          totalMessages: Number(metrics?.messagesProcessed ?? 0),
          activeChats: Number(sessions?.connected ?? 0),
        } as MetricsSummary;
        setCache(cacheKey, resolvedMetrics, METRICS_CACHE_TTL_MS);
        return resolvedMetrics;
      }
    } catch {
      // health also failed
    }

    throw lastError;
  },

  async getAIStatus(forceRefresh = false) {
    const cacheKey = "ai-status";
    if (!forceRefresh) {
      const cached = getCache<AIStatusResponse>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<AIStatusResponse>({ endpoint: "/ai/status", method: "GET" });
    setCache(cacheKey, data, CACHE_TTL_MS);
    return data;
  },

  async enableAI() {
    const data = await request<{ success?: boolean; [key: string]: unknown }>({ endpoint: "/ai/enable", method: "POST" });
    invalidateCache("ai-status");
    return data;
  },

  async disableAI() {
    const data = await request<{ success?: boolean; [key: string]: unknown }>({ endpoint: "/ai/disable", method: "POST" });
    invalidateCache("ai-status");
    return data;
  },

  improveAIResponse: (payload: ImproveRequest) => request<ImproveResponse>({ endpoint: "/ai/improve", method: "POST", body: payload }),

  async getAIPrompt(forceRefresh = false) {
    const cacheKey = "ai-prompt";
    if (!forceRefresh) {
      const cached = getCache<PromptSettings>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<PromptSettings>({ endpoint: "/ai/prompt", method: "GET" });
    setCache(cacheKey, data, CACHE_TTL_MS);
    return data;
  },

  async saveAIPrompt(prompt: string) {
    const data = await request<{ success?: boolean }>({ endpoint: "/ai/prompt", method: "POST", body: { prompt } });
    invalidateCache("ai-prompt");
    return data;
  },

  async getBusinessHours(forceRefresh = false) {
    const cacheKey = "business-hours";
    if (!forceRefresh) {
      const cached = getCache<BusinessHoursSettings>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<BusinessHoursSettings>({ endpoint: "/config/business-hours", method: "GET" });
    setCache(cacheKey, data, CACHE_TTL_MS);
    return data;
  },

  saveBusinessHours: (payload: BusinessHoursSettings) =>
    request<{ success?: boolean }>({ endpoint: "/config/business-hours", method: "POST", body: payload }),

  async getAbsenceMessage(forceRefresh = false) {
    const cacheKey = "absence-message";
    if (!forceRefresh) {
      const cached = getCache<AbsenceMessageSettings>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<AbsenceMessageSettings>({ endpoint: "/config/absence-message", method: "GET" });
    setCache(cacheKey, data, CACHE_TTL_MS);
    return data;
  },

  saveAbsenceMessage: (payload: AbsenceMessageSettings) =>
    request<{ success?: boolean }>({ endpoint: "/config/absence-message", method: "POST", body: payload }),

  async getQueueStats(forceRefresh = false) {
    const cacheKey = "queue-stats";
    if (!forceRefresh) {
      const cached = getCache<QueueSettings>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<QueueSettings>({ endpoint: "/queue", method: "GET" });
    setCache(cacheKey, data, CACHE_TTL_MS);
    return data;
  },

  processQueue: (payload: Pick<QueueSettings, "batchSize" | "delaySeconds" | "reactivationMessage">) =>
    request<QueueProcessResponse>({ endpoint: "/queue/process", method: "POST", body: payload }),

  async getMemorySettings(forceRefresh = false) {
    const cacheKey = "memory-settings";
    if (!forceRefresh) {
      const cached = getCache<MemorySettings>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<MemorySettings>({ endpoint: "/ai/memory", method: "GET" });
    setCache(cacheKey, data, CACHE_TTL_MS);
    return data;
  },

  saveMemorySettings: (payload: MemorySettings) =>
    request<{ success?: boolean }>({ endpoint: "/ai/memory", method: "POST", body: payload }),

  async getAdvancedAISettings(forceRefresh = false) {
    const cacheKey = "advanced-ai";
    if (!forceRefresh) {
      const cached = getCache<AdvancedAISettings>(cacheKey);
      if (cached) return cached;
    }

    const data = await request<AdvancedAISettings>({ endpoint: "/config/advanced-ai", method: "GET" });
    setCache(cacheKey, data, CACHE_TTL_MS);
    return data;
  },

  saveAdvancedAISettings: (payload: AdvancedAISettings) =>
    request<{ success?: boolean }>({ endpoint: "/config/advanced-ai", method: "POST", body: payload }),

  async startSession(name: string) {
    const normalized = normalizeSessionName(name);
    const response = await request<{ success?: boolean; sessionId?: string; qr?: string }>({
      endpoint: "/session/start",
      method: "POST",
      body: { name: normalized, sessionId: normalized },
    });
    invalidateCache("sessions");
    return response;
  },
  async restartSession(sessionId: string) {
    const response = await request<{ success?: boolean; sessionId?: string; qr?: string }>({ endpoint: "/session/restart", method: "POST", body: { sessionId: normalizeSessionName(sessionId) } });
    invalidateCache("sessions");
    return response;
  },
  async logoutSession(sessionId: string) {
    const response = await request<{ success?: boolean; sessionId?: string }>({ endpoint: "/session/logout", method: "POST", body: { sessionId: normalizeSessionName(sessionId) } });
    invalidateCache("sessions");
    return response;
  },
  async createSession(sessionId: string) {
    const response = await request<{ success?: boolean; sessionId?: string; qr?: string }>({ endpoint: "/sessions/create", method: "POST", body: { sessionId: normalizeSessionName(sessionId) } });
    invalidateCache("sessions");
    return response;
  },
  async listSessions() {
    const cacheKey = "sessions";
    const cached = getCache<SessionInfo[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const endpoints = ["/sessions", "/api/connections", "/connections", "/api/session-status", "/session-status"];
    for (const endpoint of endpoints) {
      try {
        const data = await request<unknown>({ endpoint, method: "GET" });
        const normalizedSessions = parseSessionStatusPayload(data).map(normalizeSessionInfo);
        setCache(cacheKey, normalizedSessions, SESSION_LIST_CACHE_TTL_MS);
        return normalizedSessions;
      } catch {
        // try next endpoint
      }
    }

    throw new Error("Falha ao carregar sessões");
  },
  async deleteSession(sessionId: string) {
    const response = await request<{ success?: boolean }>({ endpoint: `/session/${encodeURIComponent(normalizeSessionName(sessionId))}`, method: "DELETE" });
    invalidateCache("sessions");
    return response;
  },
  async removeSession(sessionId: string) {
    const response = await request<{ success?: boolean }>({ endpoint: `/sessions/${encodeURIComponent(normalizeSessionName(sessionId))}`, method: "DELETE" });
    invalidateCache("sessions");
    return response;
  },
};
