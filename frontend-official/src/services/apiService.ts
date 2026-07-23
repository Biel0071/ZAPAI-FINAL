/* apiService — FIX applied 2026-05-25T16:59 — error:null guard */
import { getCache, invalidateCache, setCache } from "@/lib/requestCache";
import { buildApiHeaders } from "@/lib/apiGuard";
import { reportFrontendIssue } from "@/runtime/services/frontendHealthService";
import { slog } from "@/runtime/logs/structuredLogger";
import { notify } from "@/services/notifyService";
import { API_BASE_URL, API_ORIGIN } from "@/lib/backendConfig";
import { clearAdminAuthSession } from "@/lib/adminAuthSession";
import axios from "axios";

export { API_ORIGIN };

const CACHE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_GET_RETRIES = 3;
const INITIAL_BACKOFF_MS = 700;
const ENDPOINT_404_COOLDOWN_MS = 120_000;

const unavailableGetEndpoints = new Map<string, number>();
const pendingGetRequests = new Map<string, Promise<unknown>>();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

function resolveApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    if (typeof payload === "string" && payload.trim()) return payload;
    if (payload && typeof payload === "object") {
      const detail = (payload as Record<string, unknown>).message ?? (payload as Record<string, unknown>).error;
      if (typeof detail === "string" && detail.trim()) return detail;
    }

    if (error.code === "ECONNABORTED") return "A API demorou para responder. Tente novamente.";
    if (!error.response) return "Sem conexão com o backend no momento.";
    return `Falha na API (${error.response.status}).`;
  }

  return error instanceof Error ? error.message : "Erro inesperado de comunicação com API.";
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = resolveApiErrorMessage(error);
    notify.error(message);

    if (message.toLowerCase().includes("demorou") || message.toLowerCase().includes("timeout")) {
      reportFrontendIssue({
        type: "api_timeout",
        message,
        service: "axios-interceptor",
        level: "warning",
      });
    } else {
      reportFrontendIssue({
        type: "unexpected_error",
        message,
        service: "axios-interceptor",
        level: "error",
      });
    }

    return Promise.reject(error);
  },
);

function resolveAxiosEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return normalized.startsWith("/api/") ? normalized.slice(4) : normalized;
}

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
  lastMessageType?: "text" | "image" | "video" | "audio" | "file" | "sticker";
  aiEnabled?: boolean;
  summary?: string;
  notes?: string;
  funnel_stage?: string;
  controlMode?: string;
  humanActive?: boolean;
  assignedAgentName?: string;
  agent_name?: string;
  isBlocked?: boolean;
  assigned_to?: string;
  lid?: string;
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
  status?: "pending" | "sending" | "sent" | "server_ack" | "device_ack" | "delivered" | "read" | "played" | "failed" | "retry";
  isAI?: boolean;
  aiProvider?: string;
  aiModel?: string;
  aiAgentName?: string;
  aiResponseTimeMs?: number;
  aiPromptTokens?: number;
  aiCompletionTokens?: number;
  aiTotalTokens?: number;
  mediaType?: "image" | "video" | "audio" | "file" | "sticker" | "document" | "media";
  mediaPath?: string;
  mediaUrl?: string;
  url?: string;
  fileName?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  mimetype?: string | null;
  emoji?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  status: string;
  updatedAt?: string;
  remoteJid?: string;
  lid?: string;
  isGroup?: boolean;
  conversationId?: string;
  sessionId?: string;
  tags?: string[];
  lead_temperature?: string;
  funnel_stage?: string;
  lastMessage?: string;
  unread?: number;
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
  aiMemories?: number;
}

export interface AIStatusResponse {
  enabled?: boolean;
  active?: boolean;
  status?: string;
  ai?: boolean;
  tenantId?: string;
  provider?: string | null;
  model?: string | null;
}

export interface AILogEntry {
  id?: string | number;
  timestamp: string;
  conversationId?: string;
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AIMetricsResponse {
  tokensToday?: number;
  promptTokensToday?: number;
  completionTokensToday?: number;
  messagesToday?: number;
  tokensPerConversation?: Record<string, number>;
}

export interface AIConnectionTestResult {
  ok: boolean;
  provider?: string;
  model?: string;
  status?: string;
  response?: string;
  responseTimeMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  error?: string;
  httpStatus?: number | null;
  fullPrompt?: string;
  memoriesUsed?: string;
  rulesTriggered?: string;
}

export interface SessionInfo {
  id: string;
  name?: string;
  phone?: string;
  connected?: boolean;
  status?: string;
  webhookUrl?: string | null;
  queueCount?: number;
  aiAgentName?: string | null;
  lastActivity?: string | null;
}

export interface CampaignContact {
  id: string;
  name?: string;
  phone?: string;
  status?: string;
}

export interface CampaignMessage {
  id?: string;
  type: "text" | "image" | "audio" | "video" | "file" | "document" | "sticker";
  content: string;
  mediaUrl?: string | null;
  mediaPath?: string | null;
  fileName?: string | null;
  mimetype?: string | null;
  ptt?: boolean;
  delaySeconds?: number;
}

export interface CampaignSettings {
  intervalSeconds: number;
  pauseEvery: number;
  pauseSeconds: number;
  typingDelaySeconds: number;
  startAt?: string | null;
  flowId?: string | null;
  sessionId?: string | null;
  shuffleEnabled?: boolean;
  warmupMessages?: number;
  warmupDelayMultiplier?: number;
  dailyLimit?: number | null;
  hourlyLimit?: number | null;
  randomDelayMin?: number | null;
  randomDelayMax?: number | null;
}

export interface CampaignQueue {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  paused: boolean;
}

export interface CampaignRecord {
  id: string;
  name: string;
  status: string;
  selectedContacts: CampaignContact[];
  messages: CampaignMessage[];
  settings: CampaignSettings;
  queue: CampaignQueue;
  tags: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
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

export interface MemoryEntry {
  contact_id: string;
  phone?: string;
  name: string;
  intent: string;
  sentiment: string;
  tags: string[];
  summary: string;
  metrics?: {
    totalMessages?: number;
    audioRequests?: number;
    [key: string]: unknown;
  };
  messages?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp?: string;
  }>;
  last_updated?: string;
}

export interface MemoryAnalytics {
  totalContacts: number;
  totalMessages: number;
  totalAudioRequests: number;
  sentiments: {
    positive: number;
    negative: number;
    neutral: number;
  };
  intents: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
}

export interface AdvancedAISettings {
  temperature: number;
  maxTokens: number;
  responseDelaySeconds: number;
  autoFollowUp: boolean;
  providers?: Array<{
    id: string;
    name?: string;
    model?: string;
    active?: boolean;
  }>;
}

export interface PersistedMessagePayload {
  id: string;
  key?: { id?: string };
  conversationId?: string;
  content?: string;
  text?: string;
  fromMe?: boolean;
  sent?: boolean;
  from?: string;
  createdAt?: string;
  timestamp?: string;
  status?: "sent" | "delivered" | "read";
  caption?: string;
  mediaType?: "image" | "video" | "audio" | "file" | "sticker";
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
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
};

function isEndpointTemporarilyUnavailable(endpoint: string): boolean {
  const unavailableUntil = unavailableGetEndpoints.get(endpoint);
  if (!unavailableUntil) return false;

  if (Date.now() >= unavailableUntil) {
    unavailableGetEndpoints.delete(endpoint);
    return false;
  }

  return true;
}

function updateEndpointCooldown(endpoint: string) {
  unavailableGetEndpoints.set(endpoint, Date.now() + ENDPOINT_404_COOLDOWN_MS);
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
  remote_jid?: string;
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
  lastMessageType?: "text" | "image" | "video" | "audio" | "file" | "sticker" | "document" | "media";
  messageType?: "text" | "image" | "video" | "audio" | "file" | "sticker" | "document" | "media";
  mediaType?: "image" | "video" | "audio" | "file" | "sticker" | "document" | "media";
  aiEnabled?: boolean;
  ai_enabled?: boolean;
  summary?: string;
  notes?: string;
  funnel_stage?: string;
  controlMode?: string;
  humanActive?: boolean;
  assigned_to?: string;
  agent_name?: string;
  assignedAgentName?: string;
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
  status?: "pending" | "sending" | "sent" | "server_ack" | "device_ack" | "delivered" | "read" | "played" | "failed" | "retry";
  isAI?: boolean;
  mediaType?: "image" | "video" | "audio" | "file" | "sticker" | "document" | "media";
  type?: "text" | "image" | "video" | "audio" | "file" | "sticker" | "document" | "media";
  mediaPath?: string;
  media_path?: string;
  mediaUrl?: string;
  media_url?: string;
  fileUrl?: string;
  file_url?: string;
  url?: string;
  thumbnail?: string;
  fileName?: string;
  filename?: string;
  name?: string;
  originalName?: string;
  mimeType?: string;
  mimetype?: string;
  emoji?: string;
};

const LEGACY_MEDIA_PLACEHOLDERS = new Set([
  "[image]",
  "[video]",
  "[audio]",
  "[media]",
  "[file]",
  "[document]",
  "[sticker]",
]);

function sanitizeLegacyPlaceholder(value: unknown, mediaType?: string | null): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";
  if (!LEGACY_MEDIA_PLACEHOLDERS.has(normalized.toLowerCase())) return normalized;

  const normalizedType = String(mediaType ?? "").trim().toLowerCase();
  if (normalizedType === "image") return "Imagem";
  if (normalizedType === "video") return "Vídeo";
  if (normalizedType === "audio") return "Áudio";
  if (normalizedType === "sticker") return "Sticker";
  if (normalizedType === "document" || normalizedType === "file" || normalizedType === "media") return "Documento";
  return "";
}

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

async function executeRequest<T>({ endpoint, method, body, timeoutMs = REQUEST_TIMEOUT_MS }: ProxyRequest): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("API_ORIGIN_UNAVAILABLE: configure VITE_API_URL para o backend oficial");
  }

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

  if (method === "GET" && isEndpointTemporarilyUnavailable(normalizedEndpoint)) {
    throw new Error(`HTTP_404:Endpoint temporarily unavailable (${normalizedEndpoint})`);
  }

  let attempt = 0;

  while (attempt <= MAX_GET_RETRIES) {
    try {
      slog.info("api", `${method} ${endpoint}`, { route: endpoint });

      const apiHeaders = await buildApiHeaders();

      const requestHeaders =
        method === "GET"
          ? Object.fromEntries(Object.entries(apiHeaders).filter(([key]) => key.toLowerCase() !== "content-type"))
          : apiHeaders;

      const response = await api.request({
        url: resolveAxiosEndpoint(endpoint),
        method,
        headers: requestHeaders,
        data: method === "GET" ? undefined : body ?? {},
        timeout: timeoutMs,
        validateStatus: () => true,
      });

      const raw =
        typeof response.data === "string"
          ? response.data
          : response.data == null
            ? ""
            : JSON.stringify(response.data);
      const parsed = raw
        ? (() => {
            try {
              return JSON.parse(raw) as unknown;
            } catch {
              return raw;
            }
          })()
          : {};

      if (response.status < 200 || response.status >= 300) {
        const details =
          parsed && typeof parsed === "object"
            ? String((parsed as Record<string, unknown>).error ?? (parsed as Record<string, unknown>).message ?? raw ?? "Request failed")
            : String(raw || "Request failed");

        if (response.status === 401) {
          clearAdminAuthSession();
        }

        slog.apiRequest(endpoint, response.status, {
          error: details,
          suggestion: response.status === 400 ? "Verificar payload ou query params enviados" : response.status === 404 ? "Endpoint não existe no backend" : undefined,
        });

        if (response.status === 404 && method === "GET") {
          updateEndpointCooldown(normalizedEndpoint);
        }

        throw new Error(`HTTP_${response.status}:${details || "Request failed"}`);
      }

      if (parsed && typeof parsed === "object" && "error" in (parsed as Record<string, unknown>)) {
        const errorValue = (parsed as Record<string, unknown>).error;
        if (typeof errorValue === "string" && errorValue.trim()) {
          throw new Error(errorValue);
        }
      }

      slog.apiRequest(endpoint, response.status);

      // Auto-unwrap backend envelope: { success: true, data: [...] } or { ok: true, data: [...] }
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        "data" in (parsed as Record<string, unknown>) &&
        ("success" in (parsed as Record<string, unknown>) || "ok" in (parsed as Record<string, unknown>))
      ) {
        return (parsed as Record<string, unknown>).data as T;
      }

      return parsed as T;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const isEndpointNotFound = errorMessage.includes("http_404") || errorMessage.includes("not found");

      if (!isEndpointNotFound) {
        slog.warn("api", `Request failed: ${endpoint}`, {
          route: endpoint,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      const isCorsOrFetchBlock =
        errorMessage.includes("failed to fetch") ||
        errorMessage.includes("cors") ||
        errorMessage.includes("access-control-allow-origin") ||
        errorMessage.includes("networkerror");

      const retriable =
        errorMessage.includes("timeout") ||
        errorMessage.includes("503") ||
        errorMessage.includes("502");

      const shouldAttemptAgain = shouldRetry && retriable && attempt < MAX_GET_RETRIES;
      if (shouldAttemptAgain) {
        const backoffMs = INITIAL_BACKOFF_MS * 2 ** attempt;
        await new Promise((resolve) => window.setTimeout(resolve, backoffMs));
        attempt += 1;
        continue;
      }

      if (errorMessage.includes("timeout")) {
        reportFrontendIssue({
          type: "api_timeout",
          message: `API timeout on ${endpoint}`,
          service: "backend-api",
          level: "warning",
        });
      } else if (!isCorsOrFetchBlock && !isEndpointNotFound) {
        reportFrontendIssue({
          type: "socket_disconnection",
          message: "Backend indisponível no momento. Tentando reconectar automaticamente.",
          service: "backend-api",
          level: "warning",
        });
      }

      throw error;
    }
  }

  throw new Error("Falha de comunicação com o backend");
}

async function request<T>(params: ProxyRequest): Promise<T> {
  if (params.method !== "GET") {
    return executeRequest<T>(params);
  }

  const normalizedEndpoint = (() => {
    if (!/^https?:\/\//i.test(params.endpoint)) return params.endpoint;

    try {
      const parsed = new URL(params.endpoint);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return params.endpoint;
    }
  })();
  const requestKey = `${normalizedEndpoint}::${params.timeoutMs ?? REQUEST_TIMEOUT_MS}`;
  const pending = pendingGetRequests.get(requestKey);

  if (pending) return pending as Promise<T>;

  const nextRequest = executeRequest<T>(params).finally(() => {
    pendingGetRequests.delete(requestKey);
  });
  pendingGetRequests.set(requestKey, nextRequest);
  return nextRequest;
}

function resolvePublicUrlFromApiBase(): string {
  if (API_ORIGIN) return API_ORIGIN;
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
  if (raw.includes("@g.us") || raw.includes("@lid")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 14 && !digits.startsWith("55")) return `${digits}@lid`;
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
    extractChatIdentifier(item.remote_jid) ??
    "";
  const stableFallbackId = [contactId, sessionId, resolvedPhone].filter(Boolean).join("-");

  return {
    id:
      normalizeIdentifier((item.id ?? item.conversationId ?? item.conversation_id) as string | number | undefined) ??
      (stableFallbackId || `conversation-${index}`),
    chatId: normalizeIdentifier((item.chatId ?? item.chat_id ?? item.remoteJid ?? item.remote_jid) as string | number | undefined) ?? resolvedPhone,
    companyId: item.companyId ?? item.company_id,
    contactId,
    sessionId,
    contactName: item.contactName ?? item.name ?? item.pushName ?? resolvedPhone ?? "Contato",
    avatar: item.avatar ?? item.profilePictureUrl ?? item.profile_picture_url,
    isGroup: item.isGroup ?? resolvedPhone.includes("@g.us"),
    lastMessage: sanitizeLegacyPlaceholder(item.lastMessage ?? item.last_message ?? "", String(normalizedType)),
    updatedAt: item.updatedAt ?? item.updated_at ?? new Date().toISOString(),
    phone: resolvedPhone,
    unread: item.unread ?? item.unread_count ?? item.unreadCount ?? 0,
    status: item.status ?? "offline",
    tags: item.tags ?? [],
    isAI: item.isAI ?? false,
    lastMessageType:
      normalizedType === "image" || normalizedType === "video" || normalizedType === "audio" || normalizedType === "file" || normalizedType === "sticker" || normalizedType === "document" || normalizedType === "media"
        ? (normalizedType === "document" || normalizedType === "media" ? "file" : normalizedType)
        : "text",
    aiEnabled: item.aiEnabled ?? item.ai_enabled ?? true,
    summary: item.summary ?? "",
    notes: item.notes ?? "",
    funnel_stage: item.funnel_stage,
    controlMode: item.controlMode,
    humanActive: item.humanActive,
    assignedAgentName: item.agent_name ?? item.assigned_to ?? item.assignedAgentName ?? null,
    agent_name: item.agent_name ?? item.assigned_to ?? item.assignedAgentName ?? null,
  };
}

function normalizeMessage(item: RawMessage, index: number, defaultConversationId?: string): ChatMessage {
  const normalizedMediaType = item.mediaType ?? item.type;
  const mediaPath = item.mediaPath ?? item.media_path;
  const mediaUrl = item.url ?? item.mediaUrl ?? item.media_url ?? item.fileUrl ?? item.file_url;
  const source = `${mediaPath ?? ""} ${mediaUrl ?? ""}`.toLowerCase();
  const contentStr = String(item.content ?? item.text ?? item.body ?? item.caption ?? "").toLowerCase();

  let inferredMediaType: "image" | "video" | "audio" | "file" | "sticker" | undefined = undefined;

  if (contentStr.includes("[image]")) {
    inferredMediaType = "image";
  } else if (contentStr.includes("[video]")) {
    inferredMediaType = "video";
  } else if (contentStr.includes("[audio]")) {
    inferredMediaType = "audio";
  } else if (contentStr.includes("[sticker]")) {
    inferredMediaType = "sticker";
  } else if (contentStr.includes("[document]") || contentStr.includes("[file]")) {
    inferredMediaType = "file";
  } else if (/\.(webp)($|\?|#)/.test(source) || source.includes("sticker")) {
    inferredMediaType = "sticker";
  } else if (/\.(png|jpe?g|gif|bmp|svg)($|\?|#)/.test(source)) {
    inferredMediaType = "image";
  } else if (/\.(mp4|mov|avi|mkv|webm|m4v)($|\?|#)/.test(source)) {
    inferredMediaType = "video";
  } else if (/\.(mp3|wav|ogg|m4a|aac|opus)($|\?|#)/.test(source)) {
    inferredMediaType = "audio";
  }

  if (!inferredMediaType) {
    if (
      normalizedMediaType === "image" ||
      normalizedMediaType === "video" ||
      normalizedMediaType === "audio" ||
      normalizedMediaType === "file" ||
      normalizedMediaType === "sticker"
    ) {
      inferredMediaType = normalizedMediaType;
    } else if (normalizedMediaType === "document" || normalizedMediaType === "media") {
      inferredMediaType = "file";
    } else if (mediaPath || mediaUrl) {
      inferredMediaType = "file";
    }
  }

  return {
    id: normalizeIdentifier(item.id as string | number | undefined) ?? `message-${index}`,
    conversationId: normalizeIdentifier((item.conversationId ?? item.conversation_id) as string | number | undefined) ?? defaultConversationId,
    chatId: normalizeIdentifier((item.chatId ?? item.chat_id) as string | number | undefined) ?? extractChatIdentifier(item.remoteJid ?? item.jid),
    content: sanitizeLegacyPlaceholder(item.content ?? item.text ?? item.body ?? item.caption ?? "", inferredMediaType),
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
    fileName: item.fileName ?? item.filename ?? item.name ?? item.originalName ?? null,
    filename: item.filename ?? item.fileName ?? item.name ?? item.originalName ?? null,
    mimeType: item.mimeType ?? item.mimetype ?? null,
    mimetype: item.mimetype ?? item.mimeType ?? null,
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

function normalizeSessionInfo(item: RawSession, index: number): SessionInfo {
  const sessionName = item.name ?? item.sessionName ?? item.session_name;
  const rawId = normalizeIdentifier((item.sessionId ?? item.session_id ?? item.id) as string | number | undefined);
  // Session names are display labels and may differ from the registry key used
  // by backend routes. Always preserve the real session id when it is present.
  const identifier = normalizeSessionName(rawId ?? sessionName ?? `session-${index}`);

  return {
    id: identifier,
    name: sessionName ?? identifier,
    phone: item.phone ?? item.phoneNumber ?? item.phone_number,
    connected: item.connected,
    status: item.status,
    webhookUrl: (item as any).webhookUrl || null,
    queueCount: (item as any).queueCount || 0,
    aiAgentName: (item as any).aiAgentName || null,
    lastActivity: (item as any).lastActivity || null,
  };
}

function normalizeCampaignContact(item: unknown, index: number): CampaignContact {
  const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const id = normalizeIdentifier((raw.id ?? raw.contactId ?? raw.contact_id ?? raw.phone) as string | number | undefined) ?? `contact-${index}`;
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : typeof raw.contactName === "string" ? raw.contactName : undefined,
    phone: typeof raw.phone === "string" ? raw.phone : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
  };
}

function normalizeCampaignMessage(item: unknown, index: number): CampaignMessage {
  const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const type = String(raw.type ?? "text").trim().toLowerCase();
  return {
    id: typeof raw.id === "string" ? raw.id : `message-${index}`,
    type: type === "image" || type === "audio" || type === "video" || type === "file" || type === "document" || type === "sticker" ? type : "text",
    content: String(raw.content ?? raw.text ?? raw.caption ?? "").trim(),
    mediaUrl: typeof raw.mediaUrl === "string" ? raw.mediaUrl : typeof raw.media_url === "string" ? raw.media_url : typeof raw.mediaPath === "string" ? raw.mediaPath : null,
    mediaPath: typeof raw.mediaPath === "string" ? raw.mediaPath : typeof raw.mediaUrl === "string" ? raw.mediaUrl : typeof raw.media_url === "string" ? raw.media_url : null,
    fileName: typeof raw.fileName === "string" ? raw.fileName : typeof raw.filename === "string" ? raw.filename : null,
    mimetype: typeof raw.mimetype === "string" ? raw.mimetype : typeof raw.mimeType === "string" ? raw.mimeType : null,
    ptt: raw.ptt === true,
    delaySeconds: Number(raw.delaySeconds ?? raw.delay_seconds ?? 0),
  };
}

function normalizeCampaignRecord(item: unknown, index: number): CampaignRecord {
  const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
  const selectedContacts = Array.isArray(raw.selectedContacts)
    ? raw.selectedContacts.map(normalizeCampaignContact)
    : Array.isArray(raw.selected_contacts)
      ? raw.selected_contacts.map(normalizeCampaignContact)
      : [];
  const messages = Array.isArray(raw.messages) ? raw.messages.map(normalizeCampaignMessage) : [];
  const settingsRaw = raw.settings && typeof raw.settings === "object" ? (raw.settings as Record<string, unknown>) : {};
  const queueRaw = raw.queue && typeof raw.queue === "object" ? (raw.queue as Record<string, unknown>) : {};

  return {
    id: String(raw.id ?? `campaign-${index}`),
    name: String(raw.name ?? "Nova campanha").trim(),
    status: String(raw.status ?? "draft").trim(),
    selectedContacts,
    messages,
    settings: {
      intervalSeconds: Number(settingsRaw.intervalSeconds ?? raw.intervalSeconds ?? 10),
      pauseEvery: Number(settingsRaw.pauseEvery ?? raw.pauseEvery ?? 10),
      pauseSeconds: Number(settingsRaw.pauseSeconds ?? raw.pauseSeconds ?? 60),
      typingDelaySeconds: Number(settingsRaw.typingDelaySeconds ?? raw.typingDelaySeconds ?? 3),
      startAt: typeof settingsRaw.startAt === "string" ? settingsRaw.startAt : typeof raw.scheduledFor === "string" ? raw.scheduledFor : null,
      flowId: typeof settingsRaw.flowId === "string" ? settingsRaw.flowId : null,
      sessionId: typeof settingsRaw.sessionId === "string" ? settingsRaw.sessionId : null,
      shuffleEnabled: Boolean(settingsRaw.shuffleEnabled ?? true),
      warmupMessages: Number(settingsRaw.warmupMessages ?? 5),
      warmupDelayMultiplier: Number(settingsRaw.warmupDelayMultiplier ?? 3),
      dailyLimit: settingsRaw.dailyLimit === null || settingsRaw.dailyLimit === undefined ? null : Number(settingsRaw.dailyLimit),
      hourlyLimit: settingsRaw.hourlyLimit === null || settingsRaw.hourlyLimit === undefined ? null : Number(settingsRaw.hourlyLimit),
      randomDelayMin: settingsRaw.randomDelayMin === null || settingsRaw.randomDelayMin === undefined ? null : Number(settingsRaw.randomDelayMin),
      randomDelayMax: settingsRaw.randomDelayMax === null || settingsRaw.randomDelayMax === undefined ? null : Number(settingsRaw.randomDelayMax),
    },
    queue: {
      total: Number(queueRaw.total ?? selectedContacts.length ?? 0),
      processed: Number(queueRaw.processed ?? 0),
      sent: Number(queueRaw.sent ?? raw.sent ?? 0),
      failed: Number(queueRaw.failed ?? 0),
      paused: Boolean(queueRaw.paused ?? false),
    },
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null,
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

function parseSessionStatusPayload(payload: unknown): RawSession[] {
  if (Array.isArray(payload)) return payload as RawSession[];
  if (!payload || typeof payload !== "object") return [];
  const raw = payload as Record<string, unknown>;
  const candidates = [raw.sessions, raw.data, raw.items, raw.results];
  const list = candidates.find((item) => Array.isArray(item));
  return Array.isArray(list) ? (list as RawSession[]) : [];
}

function resolveConnectedFromStatusPayload(payload: unknown): boolean | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;

  if (typeof raw.connected === "boolean") return raw.connected;

  if (typeof raw.status === "string") {
    const normalized = raw.status.toLowerCase();
    if (["connected", "online", "active", "open", "running"].includes(normalized)) return true;
    if (["disconnected", "offline", "inactive", "closed", "stopped"].includes(normalized)) return false;
  }

  const data = raw.data;
  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    if (typeof nested.connected === "boolean") return nested.connected;
    if (typeof nested.status === "string") {
      const normalized = nested.status.toLowerCase();
      if (["connected", "online", "active", "open", "running"].includes(normalized)) return true;
      if (["disconnected", "offline", "inactive", "closed", "stopped"].includes(normalized)) return false;
    }
  }

  return null;
}

function isSessionConnected(session: SessionInfo): boolean {
  const normalizedStatus = (session.status ?? "").toLowerCase();
  return Boolean(session.connected || ["connected", "online", "active", "open", "running"].includes(normalizedStatus));
}

function resolveRuntimeFromHealthPayload(payload: unknown): RuntimeHealthState {
  if (!payload || typeof payload !== "object") return "offline";
  return "online";
}

function is404Error(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("http_404") || message.includes("not found");
}

export const apiService = {
  async getAdminUsers(): Promise<{ id: number; username: string; email: string | null; role: string }[]> {
    const res = await request<{ ok: boolean; data: any[] }>({
      endpoint: "/api/admin/users",
      method: "GET",
    });
    return res?.data ?? [];
  },

  async updateAdminUser(id: number, payload: { email?: string; role?: string; password?: string }): Promise<any> {
    const res = await request<{ ok: boolean; data: any }>({
      endpoint: `/api/admin/users/${id}`,
      method: "PATCH",
      body: payload,
    });
    return res?.data;
  },

  async getPublicUrl() {
    const cacheKey = "public-url";
    const cached = getCache<{ publicUrl: string }>(cacheKey);
    if (cached?.publicUrl?.trim()) return cached;

    const resolved = { publicUrl: resolvePublicUrlFromApiBase() };
    setCache(cacheKey, resolved, CACHE_TTL_MS);
    return resolved;
  },

  async getRuntimeSessionHealth(): Promise<RuntimeSessionHealth> {
    const [healthResult, runtimeStatusResult, sessionsStatusResult] = await Promise.allSettled([
      (async () => {
        const candidates = ["/api/health"];
        for (const endpoint of candidates) {
          try {
            return await request<Record<string, unknown>>({ endpoint, method: "GET" });
          } catch (error) {
            if (!is404Error(error)) throw error;
          }
        }
        throw new Error("HTTP_404:No runtime endpoint configured");
      })(),
      Promise.resolve<Record<string, unknown>>({}),
      (async () => {
        const sessionEndpoints = ["/api/session-status"];
        for (const endpoint of sessionEndpoints) {
          try {
            return await request<unknown>({ endpoint, method: "GET" });
          } catch {
            // try next endpoint
          }
        }
        throw new Error("Falha ao obter status das sessões");
      })(),
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

    let sessions =
      sessionsStatusResult.status === "fulfilled"
        ? parseSessionStatusPayload(sessionsStatusResult.value).map(normalizeSessionInfo)
        : [];

    const safeSessions = Array.isArray(sessions) ? sessions : [];
    let totalSessions = safeSessions.length;
    let activeSessions = safeSessions.filter((s) => s && isSessionConnected(s)).length;

    if (sessionsStatusResult.status === "fulfilled" && totalSessions === 0) {
      const connected = resolveConnectedFromStatusPayload(sessionsStatusResult.value);
      if (connected !== null) {
        totalSessions = 1;
        activeSessions = connected ? 1 : 0;
      }
    }

    if (totalSessions === 0 && healthResult.status === "fulfilled") {
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
    const payload = await request<unknown>({ endpoint: "/api/session-status", method: "GET" });

    if (Array.isArray(payload)) {
      const sessions = payload.map((item, index) => normalizeSessionInfo((item ?? {}) as RawSession, index));
      return {
        connected: sessions.some(isSessionConnected),
        lastUpdate: Date.now(),
      };
    }

    if (payload && typeof payload === "object") {
      const raw = payload as Record<string, unknown>;
      const connectedFromStatus = resolveConnectedFromStatusPayload(raw);
      if (connectedFromStatus !== null) {
        return {
          connected: connectedFromStatus,
          lastUpdate: typeof raw.lastUpdate === "number" ? raw.lastUpdate : Date.now(),
        };
      }

      const sessions = parseSessionStatusPayload(raw).map(normalizeSessionInfo);
      if (sessions.length > 0) {
        return {
          connected: sessions.some(isSessionConnected),
          lastUpdate: Date.now(),
        };
      }
    }

    return { connected: false, lastUpdate: Date.now() };
  },

  async getConversations(forceRefresh = false, options?: { limit?: number; sessionId?: string }) {
    const normalizedSessionId = String(options?.sessionId ?? "").trim();
    const cacheKey = [
      "conversations",
      options?.limit ? `limit:${options.limit}` : "",
      normalizedSessionId ? `session:${normalizedSessionId}` : "",
    ].filter(Boolean).join(":");
    if (!forceRefresh) {
      const cached = getCache<Conversation[]>(cacheKey);
      if (cached) return cached;
    }

    const endpoints = [withQuery("/api/conversations", { limit: options?.limit, sessionId: normalizedSessionId })];

    let normalized: Conversation[] = [];
    let lastError: unknown = new Error("Falha ao carregar conversas");
    for (const endpoint of endpoints) {
      try {
        const data = await request<RawConversation[]>({ endpoint, method: "GET" });
        normalized = Array.isArray(data) ? data.map(normalizeConversation) : [];
        break;
      } catch (error) {
        lastError = error;
        if (!is404Error(error)) throw error;
      }
    }

    if (normalized.length === 0 && lastError instanceof Error && is404Error(lastError)) {
      return [];
    }

    setCache(cacheKey, normalized, CACHE_TTL_MS);
    return normalized;
  },

  async markConversationRead(conversationId: string) {
    const endpoint = `/api/conversations/${encodeURIComponent(conversationId)}/read`;
    const response = await request<{ success: boolean }>({ endpoint, method: "POST" });
    invalidateCache("conversations");
    return response;
  },

  async getMessages(conversationId: string, options?: { limit?: number; before?: string }) {
    const primaryEndpoint = withQuery(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
      limit: options?.limit,
      before: options?.before,
    });

    const data = await request<RawMessage[] | { messages?: RawMessage[]; data?: RawMessage[] | { messages?: RawMessage[] } }>({ endpoint: primaryEndpoint, method: "GET" });
    const nestedData = !Array.isArray(data) && data?.data ? data.data : null;
    const entries = Array.isArray(data)
      ? data
      : Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(nestedData)
          ? nestedData
          : nestedData && typeof nestedData === "object" && Array.isArray(nestedData.messages)
            ? nestedData.messages
            : [];
    return entries.map((item, index) => normalizeMessage(item, index, String(conversationId)));
  },

  async getStickers(): Promise<{ id: string; url: string; name: string }[]> {
    const res = await request<{ stickers: any[]; success: boolean }>({
      endpoint: "/api/stickers",
      method: "GET",
    });
    return res?.stickers ?? [];
  },

  async sendMessage(payload: { phone: string; chatId?: string; text: string; conversationId?: string; contactId?: string; sessionId?: string }) {
    const response = await request<MessageSendResponse>({ endpoint: "/api/send-message", method: "POST", body: payload });
    invalidateCache("conversations");
    return response;
  },

  async sendMediaMessage(payload: {
    phone: string;
    chatId?: string;
    caption?: string;
    fileName: string;
    mimeType: string;
    mediaType: "image" | "video" | "audio" | "file" | "sticker";
    dataBase64: string;
    conversationId?: string;
    contactId?: string;
    sessionId?: string;
  }) {
    const normalizedCaption = (payload.caption ?? "").trim();
    const normalizedBase64 = String(payload.dataBase64 ?? "").trim();
    const normalizedPhone = extractChatIdentifier(payload.phone) ?? "";
    const normalizedChatId = extractChatIdentifier(payload.chatId ?? payload.phone) ?? normalizedPhone;

    if (!normalizedBase64) {
      throw new Error("Arquivo de mídia inválido. Tente selecionar o arquivo novamente.");
    }

    if (!normalizedPhone) {
      throw new Error("Telefone inválido para envio de mídia.");
    }

    const mediaTypeMap: Record<string, "image" | "video" | "audio" | "document" | "sticker"> = {
      image: "image",
      video: "video",
      audio: "audio",
      file: "document",
      sticker: "sticker",
    };
    const mappedType = mediaTypeMap[payload.mediaType] ?? "document";

    const requestBody: Record<string, unknown> = {
      chatId: normalizedChatId.includes("@") ? normalizedChatId : `${normalizedChatId}@s.whatsapp.net`,
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

  deleteContact(id: string) {
    return request<{ success: boolean }>({
      endpoint: `/api/contacts/${id}`,
      method: "DELETE",
    });
  },

  getAnalytics: (sessionId?: string | null) =>
    request<AnalyticsSummary>({
      endpoint: `/api/analytics${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ""}`,
      method: "GET",
    }),

  async getMetrics(sessionId?: string | null) {
    const queryParam = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const candidateEndpoints = [`/api/metrics${queryParam}`];
    let lastError: unknown = new Error("Falha ao carregar métricas");

    for (const endpoint of candidateEndpoints) {
      try {
        const data = await request<MetricsSummary & Record<string, unknown>>({ endpoint, method: "GET" });
        if (endpoint.includes("admin/master/overview") || endpoint.includes("/api/dashboard")) {
          const raw = data as Record<string, unknown>;
          const metrics = (raw.metrics ?? raw.data ?? raw) as Record<string, unknown>;
          return {
            messagesToday: Number(metrics.messagesToday ?? metrics.todayMessages ?? metrics.totalMessages ?? metrics.messages ?? 0),
            activeChats: Number(metrics.activeChats ?? metrics.chats ?? metrics.onlineUsers ?? 0),
            aiResponses: Number(metrics.aiResponses ?? metrics.ai ?? metrics.botResponses ?? 0),
            newLeads: Number(metrics.newLeads ?? metrics.leads ?? 0),
          } as MetricsSummary;
        }

        return data;
      } catch (error) {
        lastError = error;
        if (!is404Error(error)) throw error;
      }
    }

    try {
      const health = await request<Record<string, unknown>>({ endpoint: `/api/health${queryParam}`, method: "GET" });
      const data = (health as Record<string, unknown>).data as Record<string, unknown> | undefined;
      const system = (data?.system ?? data) as Record<string, unknown> | undefined;
      const metrics = system?.metrics as Record<string, unknown> | undefined;
      const sessions = system?.sessions as Record<string, unknown> | undefined;
      if (metrics || sessions) {
        return {
          totalMessages: Number(metrics?.messagesProcessed ?? 0),
          activeChats: Number(sessions?.connected ?? 0),
        } as MetricsSummary;
      }
    } catch {
      // ignore
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

  async getAILogs(sessionId?: string | null) {
    const queryParam = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    return request<{ logs?: AILogEntry[] }>({ endpoint: `/ai/logs${queryParam}`, method: "GET" });
  },

  async getAIMetrics(sessionId?: string | null) {
    const queryParam = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    return request<AIMetricsResponse>({ endpoint: `/ai/metrics${queryParam}`, method: "GET" });
  },

  testAIMessage: (payload: { message: string; prompt?: string; model?: string; providerId?: string; agentKey?: string; agentName?: string; temperature?: number; responseStyle?: string; history?: any[]; maxWords?: number }) =>
    request<{ success?: boolean; result?: AIConnectionTestResult; error?: string }>({
      endpoint: "/ai/test",
      method: "POST",
      body: payload,
      timeoutMs: 60_000,
    }),

  refinePrompt: (payload: { currentPrompt: string; instruction: string }) =>
    request<{ success?: boolean; refinedPrompt?: string; error?: string }>({
      endpoint: "/ai/refine-prompt",
      method: "POST",
      body: payload,
      timeoutMs: 45_000,
    }),

  evolveAgent: (payload: { agentKey: string; instruction: string; apply?: boolean; changes?: any; sourceDescription?: string }) =>
    request<{ success: boolean; preview?: any; agent?: any; error?: string }>({
      endpoint: "/ai/agent-evolve",
      method: "POST",
      body: payload,
      timeoutMs: 60_000,
    }),

  getAgentLearning: (agentKey: string) =>
    request<{ success: boolean; pending: any[]; stats: any }>({
      endpoint: `/ai/agent-learning/${encodeURIComponent(agentKey)}`,
      method: "GET",
    }),

  answerLearningEvent: (id: number, answer: string) =>
    request<{ success: boolean; event: any }>({
      endpoint: `/ai/agent-learning/${id}/answer`,
      method: "POST",
      body: { answer },
    }),

  applyLearningAnswer: (id: number, answer?: string) =>
    request<{ success: boolean; targetField: string; formattedContent: string }>({
      endpoint: `/ai/agent-learning/${id}/apply`,
      method: "POST",
      body: { answer },
      timeoutMs: 45_000,
    }),

  ignoreLearningEvent: (id: number) =>
    request<{ success: boolean; event: any }>({
      endpoint: `/ai/agent-learning/${id}/ignore`,
      method: "POST",
    }),

  getAgentEvolution: (agentKey: string) =>
    request<{
      success: boolean;
      history: any[];
      stats: any;
      evolution: {
        score: number;
        level: string;
        goal: { current: number; target: number; percentage: number };
        components: { answers: number; refinements: number; coverage: number; queue: number };
      };
      memoryGraph: { nodes: Array<{ id: string; type: string; label: string; weight: number }>; edges: Array<{ source: string; target: string; relation: string }> };
    }>({
      endpoint: `/ai/agent-evolution/${encodeURIComponent(agentKey)}`,
      method: "GET",
    }),

  detectAgentGaps: (agentKey: string) =>
    request<{ success: boolean; createdCount: number }>({
      endpoint: `/ai/agent-detect-gaps/${encodeURIComponent(agentKey)}`,
      method: "POST",
    }),

  transcribeAudio: (mediaUrl: string, companyId?: string) =>
    request<{ text: string }>({
      endpoint: "/ai/transcribe",
      method: "POST",
      body: { mediaUrl, companyId },
      timeoutMs: 60_000,
    }),

  testAIProviders: () =>
    request<{ success?: boolean; results?: AIConnectionTestResult[]; error?: string }>({
      endpoint: "/ai/providers/test",
      method: "POST",
    }),

  getConversationInsights: (conversationId: string) =>
    request<Record<string, unknown>>({
      endpoint: `/api/conversations/${encodeURIComponent(conversationId)}/insights`,
      method: "GET",
    }),

  getConversationRuntime: (conversationId: string) =>
    request<{ conversationId: string; runtime?: { controlMode?: string; aiPausedUntil?: string | null }; success?: boolean }>({
      endpoint: `/api/conversations/${encodeURIComponent(conversationId)}/runtime`,
      method: "GET",
    }),

  async enableAI() {
    const data = await request<AIStatusResponse>({ endpoint: "/ai/enable", method: "POST" });
    invalidateCache("ai-status");
    return data;
  },

  async disableAI() {
    const data = await request<AIStatusResponse>({ endpoint: "/ai/disable", method: "POST" });
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

  async getAIAgents() {
    return request<{ success: boolean; agents: any[] }>({ endpoint: "/config/ai-agents", method: "GET" });
  },

  async createAIAgent(payload: any) {
    return request<{ success: boolean; agent: any }>({ endpoint: "/config/ai-agents", method: "POST", body: payload });
  },

  async updateAIAgent(key: string, payload: any) {
    return request<{ success: boolean; agent: any }>({ endpoint: `/config/ai-agents/${encodeURIComponent(key)}`, method: "PUT", body: payload });
  },

  async toggleAIAgent(key: string, active: boolean) {
    return request<{ success: boolean; agent: any }>({ endpoint: `/config/ai-agents/${encodeURIComponent(key)}/active`, method: "PATCH", body: { active } });
  },

  async deleteAIAgent(key: string) {
    return request<{ success: boolean; agent: any }>({ endpoint: `/config/ai-agents/${encodeURIComponent(key)}`, method: "DELETE" });
  },

  async cloneAIAgent(key: string) {
    return request<{ success: boolean; agent: any }>({ endpoint: `/config/ai-agents/${encodeURIComponent(key)}/clone`, method: "POST" });
  },

  async getAIEvolution() {
    return request<{ success: boolean; evolution: any[] }>({ endpoint: "/config/ai/evolution", method: "GET" });
  },

  async getPipelineLogs() {
    return request<{ success: boolean; logs: any[] }>({ endpoint: "/config/ai/pipeline-logs", method: "GET" });
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

  async saveBusinessHours(payload: BusinessHoursSettings) {
    const data = await request<{ success?: boolean }>({ endpoint: "/config/business-hours", method: "POST", body: payload });
    invalidateCache("business-hours");
    return data;
  },

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

  async saveAbsenceMessage(payload: AbsenceMessageSettings) {
    const data = await request<{ success?: boolean }>({ endpoint: "/config/absence-message", method: "POST", body: payload });
    invalidateCache("absence-message");
    return data;
  },

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

  async saveMemorySettings(payload: MemorySettings) {
    const data = await request<{ success?: boolean }>({ endpoint: "/ai/memory", method: "POST", body: payload });
    invalidateCache("memory-settings");
    return data;
  },

  getMemoryAnalytics: () =>
    request<{ success: boolean; data: MemoryAnalytics }>({ endpoint: "/ai/memory/analytics", method: "GET" }),

  searchMemory: (query: string) =>
    request<{ success: boolean; data: MemoryEntry[] }>({ endpoint: `/ai/memory/search?q=${encodeURIComponent(query)}`, method: "GET" }),
  getMemoryByContact: (contactId: string) =>
    request<{ success: boolean; data?: any }>({ endpoint: `/ai/conversation-memory/${encodeURIComponent(contactId)}`, method: "GET" }),

  getWebhooks: () =>
    request<{ tenantId?: string; webhooks?: Array<Record<string, unknown>> }>({ endpoint: "/api/integrations/webhooks", method: "GET" }),

  flushMemory: () =>
    request<{ success: boolean; data: { flushed: number } }>({ endpoint: "/ai/memory/flush", method: "POST" }),


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

  async saveAdvancedAISettings(payload: AdvancedAISettings) {
    const data = await request<{ success?: boolean }>({ endpoint: "/config/advanced-ai", method: "POST", body: payload });
    invalidateCache("advanced-ai");
    invalidateCache("ai-status");
    return data;
  },

  startSession: (input: string | { name: string }) => {
    const rawName = typeof input === "string" ? input : input.name;
    const normalized = normalizeSessionName(rawName);
    return request<{ success?: boolean; sessionId?: string; qr?: string }>({
      endpoint: "/session/start",
      method: "POST",
      body: { name: normalized, sessionId: normalized },
    });
  },
  restartSession: (sessionId: string) =>
    request<{ success?: boolean; sessionId?: string; qr?: string }>({ endpoint: "/session/restart", method: "POST", body: { sessionId: normalizeSessionName(sessionId) } }),
  reconnectSession: (sessionId: string) =>
    request<{ success?: boolean; sessionId?: string; qr?: string }>({ endpoint: `/session/${encodeURIComponent(normalizeSessionName(sessionId))}/reconnect`, method: "POST" }),
  checkNumber: (sessionId: string, phone: string) =>
    request<{ ok: boolean; exists: boolean; jid?: string }>({
      endpoint: `/sessions/${encodeURIComponent(normalizeSessionName(sessionId))}/check-number/${encodeURIComponent(phone)}`,
      method: "GET"
    }),
  logoutSession: (sessionId: string) =>
    request<{ success?: boolean; sessionId?: string }>({ endpoint: "/session/logout", method: "POST", body: { sessionId: normalizeSessionName(sessionId) } }),
  createSession: (sessionId: string) =>
    request<{ success?: boolean; sessionId?: string; qr?: string }>({ endpoint: "/session/start", method: "POST", body: { sessionId: normalizeSessionName(sessionId), name: normalizeSessionName(sessionId) } }),
  recoverSessions: () =>
    request<{ success?: boolean; recovered?: string[] }>({ endpoint: "/sessions/recover", method: "POST" }),
  
  async listSessions() {
    const endpoints = ["/api/sessions/status", "/sessions"];
    for (const endpoint of endpoints) {
      try {
        const data = await request<unknown>({ endpoint, method: "GET" });
        if (endpoint.includes("admin/master/overview") || endpoint.includes("/api/dashboard")) {
          const raw = data as Record<string, unknown>;
          const candidate = raw.sessions ?? (raw.data as Record<string, unknown> | undefined)?.sessions ?? [];
          return parseSessionStatusPayload(candidate).map(normalizeSessionInfo);
        }
        const raw = data as Record<string, unknown>;
        const nested = raw.data as Record<string, unknown> | undefined;
        if (nested?.sessions && Array.isArray(nested.sessions)) {
          return parseSessionStatusPayload(nested.sessions).map(normalizeSessionInfo);
        }
        return parseSessionStatusPayload(data).map(normalizeSessionInfo);
      } catch (error) {
        if (!is404Error(error)) throw error;
      }
    }

    throw new Error("Falha ao carregar sessões");
  },

  deleteSession: (sessionId: string) =>
    request<{ success?: boolean }>({ endpoint: `/session/${encodeURIComponent(normalizeSessionName(sessionId))}`, method: "DELETE" }),
  removeSession: (sessionId: string) =>
    request<{ success?: boolean }>({ endpoint: `/sessions/${encodeURIComponent(normalizeSessionName(sessionId))}`, method: "DELETE" }),
  purgeSession: (sessionId: string) =>
    request<{ success?: boolean; purged?: { session: boolean; conversations: number; contacts: number; aiMemory: number } }>({
      endpoint: `/session/${encodeURIComponent(normalizeSessionName(sessionId))}/purge?purgeData=true`,
      method: "DELETE",
    }),
  
  getSessionQr: (sessionId: string) =>
    request<{ qr?: string; status?: string }>({ endpoint: `/sessions/${encodeURIComponent(normalizeSessionName(sessionId))}/qr`, method: "GET" }),
  async getSessionStatusDetails(sessionId: string) {
    return request<{
      sessionId: string;
      sessionName: string;
      status: string;
      connected: boolean;
      systemConnected: boolean;
      retryCount: number;
      health: string;
      qrReady: boolean;
      lastError: string | null;
      logs: Array<{
        event: string;
        level: string;
        message: string;
        timestamp: string;
      }>;
    }>({
      endpoint: `/sessions/${encodeURIComponent(normalizeSessionName(sessionId))}/status`,
      method: "GET",
    });
  },
  async updateConversationAI(phone: string, aiEnabled: boolean) {
    return request<Conversation>({
      endpoint: `/conversations/${encodeURIComponent(phone)}/ai`,
      method: "PATCH",
      body: { aiEnabled },
    });
  },

  getCampaigns: async () => {
    const data = await request<unknown>({ endpoint: "/api/campaigns", method: "GET" });
    const entries = Array.isArray(data)
      ? data
      : data && typeof data === "object" && Array.isArray((data as { data?: unknown[] }).data)
        ? (data as { data?: unknown[] }).data ?? []
        : [];
    return entries.map(normalizeCampaignRecord);
  },
  createCampaign: (payload: Partial<CampaignRecord> & Record<string, unknown>) =>
    request<CampaignRecord>({ endpoint: "/api/campaigns", method: "POST", body: payload }),
  updateCampaign: (campaignId: string, payload: Partial<CampaignRecord> & Record<string, unknown>) =>
    request<CampaignRecord>({ endpoint: `/api/campaigns/${encodeURIComponent(campaignId)}`, method: "PUT", body: payload }),
  deleteCampaign: (campaignId: string) =>
    request<{ success?: boolean }>({ endpoint: `/api/campaigns/${encodeURIComponent(campaignId)}`, method: "DELETE" }),
  startCampaignDispatch: (campaignId: string) =>
    request<Record<string, unknown>>({ endpoint: `/api/campaigns/${encodeURIComponent(campaignId)}/start`, method: "POST" }),
  pauseCampaignDispatch: (campaignId: string) =>
    request<Record<string, unknown>>({ endpoint: `/api/campaigns/${encodeURIComponent(campaignId)}/pause`, method: "POST" }),
  resumeCampaignDispatch: (campaignId: string) =>
    request<Record<string, unknown>>({ endpoint: `/api/campaigns/${encodeURIComponent(campaignId)}/resume`, method: "POST" }),
  cancelCampaignDispatch: (campaignId: string) =>
    request<Record<string, unknown>>({ endpoint: `/api/campaigns/${encodeURIComponent(campaignId)}/cancel`, method: "POST" }),
  getCampaignDispatchStatus: (campaignId: string) =>
    request<Record<string, unknown>>({ endpoint: `/api/campaigns/${encodeURIComponent(campaignId)}/status`, method: "GET" }),
  generateCampaignAI: (prompt: string, temperature?: string) =>
    request<Record<string, unknown>>({ endpoint: "/api/campaigns/generate-ai", method: "POST", body: { prompt, temperature } }),
  estimateAudience: (filters: Record<string, unknown>) =>
    request<Record<string, unknown>>({ endpoint: "/api/campaigns/preview-audience", method: "POST", body: filters }),
  getAIFollowupPlan: (conversationId: string, phone?: string) =>
    request<Record<string, unknown>>({ endpoint: "/api/ai/followup-plan", method: "POST", body: { conversationId, phone } }),
  getAIRecoveryApproach: (conversationId: string, phone?: string, lastTopic?: string) =>
    request<Record<string, unknown>>({ endpoint: "/api/ai/recovery-approach", method: "POST", body: { conversationId, phone, lastTopic } }),
  getZapflowVoices: () =>
    request<Record<string, unknown>>({ endpoint: "/api/ai/voices", method: "GET" }),
  saveVoiceProfile: (agentId: string, voiceId: string, params: Record<string, unknown>) =>
    request<Record<string, unknown>>({ endpoint: "/api/ai/voices/profiles", method: "POST", body: { agentId, voiceId, params } }),
  testVoiceSynthesis: (voiceId: string, text?: string, params?: Record<string, unknown>) =>
    request<Record<string, unknown>>({ endpoint: "/api/ai/voices/test-synthesis", method: "POST", body: { voiceId, text, params } }),
  getLeadKnowledgeGraph: (leadId: string) =>
    request<Record<string, unknown>>({ endpoint: `/api/ai/lead-knowledge-graph/${encodeURIComponent(leadId)}`, method: "GET" }),
  patchConversation: (conversationId: string, payload: { status?: string; lead_temperature?: string; funnel_stage?: string; tags?: string[]; name?: string; notes?: string }) =>
    request<Record<string, unknown>>({ endpoint: `/api/conversations/${encodeURIComponent(conversationId)}`, method: "PATCH", body: payload }),
  createConversation: (payload: { phone: string; name?: string; sessionId?: string }) => {
    invalidateCache("conversations");
    return request<Conversation>({ endpoint: "/api/conversations", method: "POST", body: payload });
  },
  async deleteConversation(conversationId: string) {
    const data = await request<{ success?: boolean }>({ endpoint: `/api/conversations/${encodeURIComponent(conversationId)}`, method: "DELETE" });
    invalidateCache("conversations");
    return data;
  },
  deleteMessage: (messageId: string, scope: "local" | "everyone" = "local") =>
    request<{ success?: boolean; messageId?: string; scope?: "local" | "everyone"; revokedOnWhatsApp?: boolean }>({
      endpoint: `/api/messages/${encodeURIComponent(messageId)}`,
      method: "DELETE",
      body: { scope },
    }),
  forwardMessage: (messageId: string, payload: { phone: string; conversationId?: string; sessionId?: string }) =>
    request<Record<string, unknown>>({ endpoint: `/api/messages/${encodeURIComponent(messageId)}/forward`, method: "POST", body: payload }),
  async getQuickReplies() {
    try {
      const data = await request<any[]>({ endpoint: "/api/quick-replies", method: "GET" });
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },
  async createQuickReply(payload: any) {
    return request<any>({ endpoint: "/api/quick-replies", method: "POST", body: payload });
  },
  async updateQuickReply(id: string, payload: any) {
    return request<any>({ endpoint: `/api/quick-replies/${encodeURIComponent(id)}`, method: "PUT", body: payload });
  },
  async deleteQuickReply(id: string) {
    return request<any>({ endpoint: `/api/quick-replies/${encodeURIComponent(id)}`, method: "DELETE" });
  },
  async executeQuickReplyFlow(id: string, payload: { phone: string; sessionId?: string; companyId?: string }) {
    return request<{ success: boolean; stepsCount: number }>({
      endpoint: `/api/quick-replies/${encodeURIComponent(id)}/execute`,
      method: "POST",
      body: payload,
    });
  },
  async cancelQuickReplyFlow(phone: string) {
    return request<{ success: boolean; cancelled: boolean }>({
      endpoint: "/api/quick-replies/cancel-flow",
      method: "POST",
      body: { phone },
    });
  },
  async analyzeMediaWithAI(payload: { fileName: string; fileType: string; agentName?: string; companyDesc?: string }) {
    return request<{ success: boolean; descricao_ia: string; descricao_humana: string }>({
      endpoint: "/api/ai/analyze-media",
      method: "POST",
      body: payload,
    });
  },
  async generateFollowUpPrompt(payload: { agentName?: string; sector?: string; objective?: string; company?: string; products?: string }) {
    return request<{ success: boolean; prompt: string }>({
      endpoint: "/api/ai/generate-followup-prompt",
      method: "POST",
      body: payload,
    });
  },
  async getUserProviders() {
    return request<{ success: boolean; providers: any[] }>({ endpoint: "/config/user-providers", method: "GET" });
  },
  async saveUserProvider(payload: { provider: string; api_key: string; model?: string; enabled?: boolean }) {
    return request<{ success: boolean; provider: any }>({ endpoint: "/config/user-providers", method: "POST", body: payload });
  },
  async testVoice(text: string, voiceId: string) {
    return request<{ success: boolean; url: string }>({
      endpoint: "/api/ai/voices/test",
      method: "POST",
      body: { text, voiceId },
    });
  },
  async restartAI() {
    return request<{ success: boolean; message: string }>({
      endpoint: "/config/ai/restart",
      method: "POST",
    });
  },
  async deployVPS() {
    return request<{ success: boolean; message: string }>({
      endpoint: "/config/ai/deploy-vps",
      method: "POST",
    });
  },
  async fetchTestSuites() {
    return request<{ success: boolean; data: any[] }>({
      endpoint: "/api/tests/suites",
      method: "GET",
    });
  },
  async runTestSuites(suiteIds?: string[]) {
    return request<{ success: boolean; data: any }>({
      endpoint: "/api/tests/run",
      method: "POST",
      body: { suiteIds },
    });
  },
  async generateTestScripts(suiteId?: string) {
    return request<{ success: boolean; data: any[] }>({
      endpoint: "/api/tests/generate",
      method: "POST",
      body: { suiteId },
    });
  },
  async fetchTestGraph() {
    return request<{ success: boolean; data: any }>({
      endpoint: "/api/tests/graph",
      method: "GET",
    });
  },
  async fetchTestHistory() {
    return request<{ success: boolean; data: any[] }>({
      endpoint: "/api/tests/history",
      method: "GET",
    });
  },
  async fetchOperationsMetrics(companyId?: string) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    return request<{ success: boolean; data: any }>({
      endpoint: `/api/operations/metrics${query}`,
      method: "GET",
    });
  },
  async getExecutiveAIInsights(companyId?: string) {
    const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
    return request<{ success: boolean; data: any }>({
      endpoint: `/api/ai/executive-insights${query}`,
      method: "GET",
    });
  },
};

export async function requestApiEndpoint<T>(endpoint: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<T> {
  return request<T>({ endpoint, method: method as ProxyRequest["method"], body: body as Record<string, unknown> | undefined });
}
