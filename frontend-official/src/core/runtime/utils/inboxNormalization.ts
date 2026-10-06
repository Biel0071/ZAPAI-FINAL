import { API_ORIGIN } from "@/core/lib/backendConfig";
import { loadAdminAuthSession, ADMIN_AUTH_CHANGED_EVENT } from "@/core/lib/adminAuthSession";
import type { Conversation, ChatMessage } from "@/core/services/apiService";

const BACKEND_BASE_URL = API_ORIGIN;

export function getMessageTime(message: Pick<ChatMessage, "timestamp" | "createdAt">): number {
  const value = message.timestamp ?? message.createdAt;
  const numeric = typeof value === "number" || /^\d+$/.test(String(value ?? ""));
  const number = Number(value);
  const time = new Date(numeric ? (number > 1e9 && number < 9e9 ? number * 1000 : number) : String(value ?? "")).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function compareMessageTimes(a: Pick<ChatMessage, "timestamp" | "createdAt">, b: Pick<ChatMessage, "timestamp" | "createdAt">): number {
  return getMessageTime(a) - getMessageTime(b);
}

export function normalizeId(id: unknown): string {
  return String(id ?? "").trim();
}

export function normalizePhone(phone?: string): string {
  const normalized = String(phone ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("@g.us") || normalized.includes("@lid")) return normalized;
  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 14 && !digits.startsWith("55")) return `${digits}@lid`;
  return digits;
}

export function normalizePhoneKey(phone: unknown): string {
  return normalizePhone(String(phone ?? ""));
}

export function getConversationKey(conversation: Partial<Conversation> & { conversationId?: unknown; remoteJid?: unknown; jid?: unknown; chatId?: unknown }): string {
  const preferredId = normalizeId(conversation.id) || normalizeId(conversation.conversationId);
  if (preferredId) return preferredId;

  const phone = normalizePhoneKey(conversation.phone);
  const sessionId = normalizeId(conversation.sessionId);
  if (phone && sessionId) return `${sessionId}:${phone}`;

  const jid = normalizeId(conversation.chatId) || normalizeId(conversation.remoteJid) || normalizeId(conversation.jid);
  if (jid) return jid;

  return phone || sessionId || "unknown-conversation";
}

export function getMessageConversationKey(message: Partial<ChatMessage> & { sessionId?: unknown; phone?: unknown; remoteJid?: unknown; jid?: unknown; chatId?: unknown; conversationId?: unknown }): string {
  const preferredId = normalizeId(message.conversationId);
  if (preferredId) return preferredId;

  const phone = normalizePhoneKey(message.phone);
  const sessionId = normalizeId(message.sessionId);
  if (phone && sessionId) return `${sessionId}:${phone}`;

  const jid = normalizeId(message.chatId) || normalizeId(message.remoteJid) || normalizeId(message.jid);
  if (jid) return jid;

  return phone || sessionId || "unknown-conversation";
}

export function resolveMediaUrl(url?: string | null): string | null {
  let normalized = String(url ?? "").trim().replace(/\\/g, "/");
  if (!normalized || normalized === "null" || normalized === "undefined" || (normalized.startsWith("[") && normalized.endsWith("]"))) return null;
  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) return normalized;
  const staticPath = normalized.match(/\/(?:api\/)?(media|uploads|upload)\/(.+)$/i);
  if (staticPath) normalized = `/${staticPath[1]}/${staticPath[2]}`;
  if (/^https?:\/\/(localhost|127\.0\.0\.1):4025/i.test(normalized)) {
    normalized = normalized.replace(/^https?:\/\/(localhost|127\.0\.0\.1):4025/i, BACKEND_BASE_URL);
  }
  let finalUrl = normalized;
  if (!/^https?:\/\//i.test(normalized)) {
    if (/^[a-zA-Z]:/i.test(normalized)) {
      normalized = normalized.replace(/^[a-zA-Z]:/i, "");
    }
    let cleanPath = normalized.replace(/^\/+/, "");
    if (!/^(uploads|media|upload|public|api)\//i.test(cleanPath)) cleanPath = `uploads/${cleanPath}`;
    finalUrl = `${BACKEND_BASE_URL}/${cleanPath}`;
  }

  // Older records sometimes persisted the login token. Never send it in a URL.
  try {
    const parsed = new URL(finalUrl, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    parsed.searchParams.delete("token");
    return parsed.toString();
  } catch { return null; }
}

export type ProtectedMediaAccess = { url: string; expiresAt: number };
const mediaAccessCache = new Map<string, ProtectedMediaAccess>();
const mediaAccessPending = new Map<string, Promise<ProtectedMediaAccess | null>>();
let mediaAuthorizationVersion = 0;

export function clearMediaAccessCache() {
  mediaAuthorizationVersion++;
  mediaAccessCache.clear();
  mediaAccessPending.clear();
  // Remove the former persistent cache, which stored URLs containing login JWTs.
  if (typeof caches !== "undefined") void caches.delete("zapai-media-cache").catch(() => {});
}

if (typeof window !== "undefined") {
  clearMediaAccessCache();
  window.addEventListener(ADMIN_AUTH_CHANGED_EVENT, clearMediaAccessCache);
}

export async function authorizeMediaUrl(rawUrl?: string | null, force = false): Promise<ProtectedMediaAccess | null> {
  const resolved = resolveMediaUrl(rawUrl);
  if (!resolved) return null;
  if (/^(data:|blob:)/.test(resolved)) return { url: resolved, expiresAt: 0 };
  const media = new URL(resolved);
  if (!/^\/(?:api\/)?(?:media|upload|uploads)\//i.test(media.pathname)) return { url: resolved, expiresAt: 0 };
  const session = loadAdminAuthSession();
  if (!session?.token) return null;
  const tenant = session.tenantId || session.companyId || "";
  const mediaPath = media.pathname.replace(/^\/api\//, "/");
  const key = `${tenant}:${session.token}:${mediaPath}`;
  const cached = mediaAccessCache.get(key);
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached;
  if (mediaAccessPending.has(key)) return mediaAccessPending.get(key)!;
  const authorizationVersion = mediaAuthorizationVersion;
  const request = (async () => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/media/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}`, ...(tenant ? { "x-tenant-id": tenant } : {}) },
        body: JSON.stringify({ path: mediaPath }),
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const access = payload?.data || payload;
      if (authorizationVersion !== mediaAuthorizationVersion) return null;
      if (typeof access.url !== "string" || !Number.isFinite(access.expiresAt) || access.expiresAt <= Date.now()) return null;
      const result = { url: new URL(access.url, `${BACKEND_BASE_URL}/`).toString(), expiresAt: access.expiresAt };
      if (mediaAccessCache.size >= 300) mediaAccessCache.delete(mediaAccessCache.keys().next().value!);
      mediaAccessCache.set(key, result);
      return result;
    } catch { return null; }
    finally { mediaAccessPending.delete(key); }
  })();
  mediaAccessPending.set(key, request);
  return request;
}

export async function resolveProtectedMediaUrl(url?: string | null, force = false): Promise<string | null> {
  return (await authorizeMediaUrl(url, force))?.url || null;
}

export function inferMediaTypeFromSource(source?: string): "image" | "video" | "audio" | "file" | undefined {
  if (!source) return undefined;
  const normalized = source.toLowerCase();

  if (/(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.svg)($|\?|#)/.test(normalized)) return "image";
  if (/(\.mp4|\.mov|\.avi|\.mkv|\.webm|\.m4v)($|\?|#)/.test(normalized)) return "video";
  if (/(\.mp3|\.wav|\.ogg|\.m4a|\.aac|\.webm|\.opus)($|\?|#)/.test(normalized)) return "audio";
  return "file";
}

export function inferConversationMessageType(conversation: Conversation): "text" | "image" | "video" | "audio" | "file" | "sticker" {
  if (conversation.lastMessageType && conversation.lastMessageType !== "text") return conversation.lastMessageType;
  const normalized = (conversation.lastMessage ?? "").trim().toLowerCase();
  if (normalized.includes("image") || normalized.startsWith("[image]")) return "image";
  if (normalized.includes("video") || normalized.startsWith("[video]")) return "video";
  if (normalized.includes("audio") || normalized.startsWith("[audio]")) return "audio";
  if (normalized.includes("pdf") || normalized.includes("document") || normalized.startsWith("[file]")) return "file";
  return "text";
}

export function parseChatsLoadedPayload(payload: unknown): Conversation[] {
  const payloadObject =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { chats?: unknown; conversations?: unknown; data?: unknown })
      : null;

  const mappedChats =
    payloadObject?.chats && typeof payloadObject.chats === "object" && !Array.isArray(payloadObject.chats)
      ? Object.values(payloadObject.chats as Record<string, unknown>)
      : [];

  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payloadObject?.chats)
      ? payloadObject.chats
      : mappedChats.length > 0
        ? mappedChats
      : Array.isArray(payloadObject?.conversations)
        ? payloadObject.conversations
        : Array.isArray(payloadObject?.data)
          ? payloadObject.data
          : [];

  return list
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const rawId = String(item.id ?? item.conversationId ?? item.conversation_id ?? item.chatId ?? item.chat_id ?? "").trim();
      const rawPhone = String(item.phone ?? item.phoneNumber ?? item.jid ?? item.remoteJid ?? item.chatId ?? item.chat_id ?? "").trim();
      const rawName = String((item.contactName ?? item.name ?? item.pushName ?? rawPhone) || "Contato").trim();
      const normalizedLastMessageType = String(item.lastMessageType ?? item.messageType ?? item.mediaType ?? "text").toLowerCase();
      const lastMessageType =
        normalizedLastMessageType === "image" ||
        normalizedLastMessageType === "video" ||
        normalizedLastMessageType === "audio" ||
        normalizedLastMessageType === "file"
          ? normalizedLastMessageType
          : "text";

      const resolvedPhone = normalizePhone(rawPhone);
      const resolvedId = rawId || `chat-${index}-${resolvedPhone || Date.now()}`;

      return {
        id: resolvedId,
        chatId: String(item.chatId ?? item.chat_id ?? rawId ?? resolvedPhone),
        companyId: item.companyId ? String(item.companyId) : undefined,
        contactId: item.contactId ? String(item.contactId) : undefined,
        sessionId: item.sessionId ? String(item.sessionId) : item.session_id ? String(item.session_id) : undefined,
        contactName: rawName || resolvedPhone || "Contato",
        avatar: String(item.avatar ?? item.profilePictureUrl ?? item.profile_picture_url ?? "") || undefined,
        isGroup: Boolean(item.isGroup ?? String(item.chatId ?? item.chat_id ?? rawPhone).toLowerCase().includes("@g.us")),
        lastMessage: String(item.lastMessage ?? item.last_message ?? item.preview ?? ""),
        updatedAt: String(item.updatedAt ?? item.updated_at ?? item.timestamp ?? new Date().toISOString()),
        phone: resolvedPhone || rawPhone,
        unread: Number(item.unread ?? item.unread_count ?? item.unreadCount ?? 0) || 0,
        status: String(item.status ?? "online") as Conversation["status"],
        tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
        isAI: Boolean(item.isAI ?? false),
        lastMessageType,
      } as Conversation;
    })
    .filter((item): item is Conversation => Boolean(item?.id));
}

export function parseContactsLoadedPayload(payload: unknown): Array<{ phone: string; name: string }> {
  const candidates = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (payload as { contacts?: unknown; data?: unknown })
      : null;

  const list = Array.isArray(candidates)
    ? candidates
    : Array.isArray(candidates?.contacts)
      ? candidates.contacts
      : Array.isArray(candidates?.data)
        ? candidates.data
        : [];

  return list
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const phone = normalizePhone(String(item.phone ?? item.phoneNumber ?? item.jid ?? item.remoteJid ?? ""));
      const name = String(item.name ?? item.contactName ?? item.pushName ?? "").trim();
      if (!phone || !name) return null;
      return { phone, name };
    })
    .filter((item): item is { phone: string; name: string } => Boolean(item));
}
