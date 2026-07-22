import { memo } from "react";
import { loadAdminAuthSession } from "@/lib/adminAuthSession";
import { cn } from "@/lib/utils";
import { API_ORIGIN, type ChatMessage, type Conversation, type SessionInfo } from "@/services/apiService";
import type {
  ComposerAttachment,
  PreviewMediaState,
  ConversationDraftState,
  LeadIntentResult,
  ConversationControl,
  QuickReplyItem,
  QuickReplyMediaItem,
} from "./types";

const BACKEND_BASE_URL = API_ORIGIN;

export const LEGACY_MEDIA_PLACEHOLDERS = new Set([
  "[image]",
  "[video]",
  "[audio]",
  "[media]",
  "[file]",
  "[document]",
  "[sticker]",
]);

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const HighlightedMessageText = memo(function HighlightedMessageText({
  active,
  query,
  text,
}: {
  active: boolean;
  query: string;
  text: string;
}) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return <>{text}</>;

  const matcher = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "gi");
  const parts = text.split(matcher);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === normalizedQuery.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className={cn(
              "rounded-sm px-0.5 text-inherit",
              active ? "bg-amber-400 text-black" : "bg-amber-300/45",
            )}
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
});

export function getInitials(name?: string | null): string {
  if (!name || typeof name !== "string") return "C";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatTime(value?: string | number): string {
  if (!value) return "--:--";
  let date: Date;
  if (typeof value === "number") {
    const ms = value > 1e9 && value < 9e9 ? value * 1000 : value;
    date = new Date(ms);
  } else {
    const str = String(value).trim();
    if (/^\d+$/.test(str)) {
      const num = Number(str);
      const ms = num > 1e9 && num < 9e9 ? num * 1000 : num;
      date = new Date(ms);
    } else {
      date = new Date(str);
    }
  }
  if (Number.isNaN(date.getTime())) {
    const strVal = String(value);
    return strVal.length <= 5 ? strVal : "--:--";
  }
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatPhoneNumber(phone: string): string {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return phone || "Sem número";
  if (clean.length === 13 && clean.startsWith("55")) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12 && clean.startsWith("55")) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  if (clean.length === 11) {
    return `+55 (${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `+55 (${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

export function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

export function formatDurationMs(value?: number | null): string {
  if (!Number.isFinite(value) || Number(value) < 0) return "Sem dado";
  const milliseconds = Number(value);
  if (milliseconds >= 60_000) return `${Math.max(1, Math.round(milliseconds / 60_000))} min`;
  return `${Math.max(1, Math.round(milliseconds / 1000))} s`;
}

export function normalizeConversationTimestamp(value?: string | number): number {
  if (!value) return 0;

  if (typeof value === "number") {
    if (value > 1e9 && value < 9e9) return value * 1000;
    return value;
  }

  const str = String(value).trim();
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (num > 1e9 && num < 9e9) return num * 1000;
    return num;
  }

  const parsed = new Date(str).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeId(id: unknown): string {
  return String(id ?? "").trim();
}

export function normalizePhoneKey(phone: unknown): string {
  return String(phone ?? "").trim().toLowerCase();
}

export function normalizeConversationAddressKey(phone: unknown): string {
  const normalized = normalizePhoneKey(phone);
  if (normalized.endsWith("@g.us")) return normalized;
  return normalized.replace(/\D/g, "");
}

export function getConversationKey(conversation: Partial<Conversation> & { conversationId?: unknown; remoteJid?: unknown; jid?: unknown; chatId?: unknown }) {
  const preferredId = normalizeId(conversation.id) || normalizeId(conversation.conversationId);
  if (preferredId) return preferredId;

  const phone = normalizePhoneKey(conversation.phone);
  const sessionId = normalizeId(conversation.sessionId);
  if (phone && sessionId) return `${sessionId}:${phone}`;

  const jid = normalizeId(conversation.chatId) || normalizeId(conversation.remoteJid) || normalizeId(conversation.jid);
  if (jid) return jid;

  return phone || sessionId || "unknown-conversation";
}

export function getMessageConversationKey(message: Partial<ChatMessage> & { sessionId?: unknown; phone?: unknown; remoteJid?: unknown; jid?: unknown; chatId?: unknown; conversationId?: unknown }) {
  const preferredId = normalizeId(message.conversationId);
  if (preferredId) return preferredId;

  const phone = normalizePhoneKey(message.phone);
  const sessionId = normalizeId(message.sessionId);
  if (phone && sessionId) return `${sessionId}:${phone}`;

  const jid = normalizeId(message.chatId) || normalizeId(message.remoteJid) || normalizeId(message.jid);
  if (jid) return jid;

  return phone || sessionId || "unknown-conversation";
}

export function toConversationDateLabel(value?: string): string {
  const timestamp = normalizeConversationTimestamp(value);
  if (!timestamp) return "Sem data";

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-red-500/10 text-red-400 border-red-500/20",
    "bg-orange-500/10 text-orange-400 border-orange-500/20",
    "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    "bg-green-500/10 text-green-400 border-green-500/20",
    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "bg-teal-500/10 text-teal-400 border-teal-500/20",
    "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "bg-sky-500/10 text-sky-400 border-sky-500/20",
    "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    "bg-violet-500/10 text-violet-400 border-violet-500/20",
    "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
    "bg-pink-500/10 text-pink-400 border-pink-500/20",
    "bg-rose-500/10 text-rose-400 border-rose-500/20",
  ];
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
}

export function resolveMediaUrl(url?: string | null): string | null {
  let normalized = String(url ?? "").trim().replace(/\\/g, "/");
  if (!normalized || normalized === "null" || normalized === "undefined" || (normalized.startsWith("[") && normalized.endsWith("]"))) return null;

  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) return normalized;

  // Extract relative static routes (/uploads/, /media/, /upload/) from absolute filesystem paths or filenames
  if (normalized.toLowerCase().includes("/uploads/")) {
    normalized = `/uploads/${normalized.split(/\/uploads\//i).pop()}`;
  } else if (normalized.toLowerCase().includes("/media/")) {
    normalized = `/media/${normalized.split(/\/media\//i).pop()}`;
  } else if (normalized.toLowerCase().includes("/upload/")) {
    normalized = `/upload/${normalized.split(/\/upload\//i).pop()}`;
  } else if (normalized.toLowerCase().includes("/public/")) {
    normalized = `/${normalized.split(/\/public\//i).pop()}`;
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1):4025/i.test(normalized)) {
    normalized = normalized.replace(/^https?:\/\/(localhost|127\.0\.0\.1):4025/i, BACKEND_BASE_URL);
  }

  let finalUrl = normalized;
  if (!/^https?:\/\//i.test(normalized)) {
    if (/^[a-zA-Z]:/i.test(normalized)) {
      normalized = normalized.replace(/^[a-zA-Z]:/i, "");
    }
    const cleanPath = normalized.replace(/^\/+/, "");
    finalUrl = `${BACKEND_BASE_URL}/${cleanPath}`;
  }

  const isBackendMedia =
    finalUrl.startsWith(BACKEND_BASE_URL) ||
    /^(https?:\/\/[^\/]+)?\/(media|upload|uploads)\//i.test(finalUrl);

  if (isBackendMedia) {
    const session = loadAdminAuthSession();
    if (session && session.token && !finalUrl.includes("token=")) {
      const separator = finalUrl.includes("?") ? "&" : "?";
      finalUrl = `${finalUrl}${separator}token=${encodeURIComponent(session.token)}`;
    }
  }

  return finalUrl;
}

export async function resolveCachedMediaUrl(url?: string | null): Promise<string | null> {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return null;

  try {
    const cache = await caches.open("zapai-media-cache");
    const cachedResponse = await cache.match(resolved);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    // Try fetching and caching
    const response = await fetch(resolved);
    if (response.ok) {
      const responseClone = response.clone();
      await cache.put(resolved, responseClone);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn("Failed caching media URL:", resolved, err);
  }

  return resolved;
}

export function logInboxDebug(event: string, payload?: Record<string, unknown>) {
  if (typeof console === "undefined") return;
  if (payload) {
    console.info(`[InboxDebug] ${event}`, payload);
    return;
  }
  console.info(`[InboxDebug] ${event}`);
}

export function getMediaTypeLabel(type?: string): string {
  switch (String(type || "").toLowerCase()) {
    case "image":
      return "Imagem";
    case "video":
      return "Vídeo";
    case "audio":
      return "Áudio";
    case "file":
    case "document":
      return "Documento";
    case "sticker":
      return "Sticker";
    default:
      return "Mídia";
  }
}

export function sanitizeLegacyPlaceholderText(value: unknown, mediaType?: string | null): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";
  if (!LEGACY_MEDIA_PLACEHOLDERS.has(normalized.toLowerCase())) return normalized;
  const label = getMediaTypeLabel(mediaType);
  return label === "Mídia" ? "" : label;
}

export function sanitizeSidebarText(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "";
  if (normalized === "Conversa não encontrada" || normalized === "Nenhuma mapeada") return "";
  return normalized;
}

export function extractMessageAssetUrl(message: Partial<ChatMessage> & { fileUrl?: string | null; file_url?: string | null; media_url?: string | null; mediaPath?: string | null; media_path?: string | null; url?: string | null; mediaUrl?: string | null }) {
  return (
    message.url ??
    message.mediaUrl ??
    message.media_url ??
    message.fileUrl ??
    message.file_url ??
    message.mediaPath ??
    message.media_path ??
    null
  );
}

export function revokeAttachmentPreviewUrls(attachments: ComposerAttachment[]) {
  attachments.forEach((attachment) => {
    if (!attachment?.previewUrl) return;
    try {
      URL.revokeObjectURL(attachment.previewUrl);
    } catch {
      // noop
    }
  });
}

export function isSessionActive(session: SessionInfo): boolean {
  if (!session) return false;
  const normalizedStatus = (session.status ?? "").toLowerCase();
  return Boolean(
    session.connected ||
    ["connected", "online", "active", "open", "running"].includes(normalizedStatus)
  );
}

export function pickActiveSession(sessions: SessionInfo[], preferredSessionId?: string | null): SessionInfo | null {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  if (preferredSessionId) {
    const preferred = safeSessions.find((session) => session && session.id === preferredSessionId);
    if (preferred && isSessionActive(preferred)) return preferred;
  }

  return safeSessions.find((session) => session && isSessionActive(session)) ?? null;
}

export function getConversationScope(params: { phone?: string; sessionId?: string | null }): string {
  const normalizedPhone = normalizeConversationAddressKey(params.phone);
  const normalizedSessionId = String(params.sessionId ?? "default").trim() || "default";
  if (!normalizedPhone) return "";
  return `${normalizedSessionId}:${normalizedPhone}`;
}

export function getConversationMessageStorageKey(params: { conversationId: string; sessionId?: string; phone?: string }): string {
  const normalizedPhone = normalizePhone(params.phone);
  const normalizedSession = String(params.sessionId ?? "default").trim() || "default";
  const scope = normalizedPhone || String(params.conversationId);
  return `zapai_inbox_messages:${normalizedSession}:${scope}`;
}

export function normalizePhone(phone?: string): string {
  const normalized = String(phone ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("@g.us") || normalized.includes("@lid")) return normalized;
  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 14 && !digits.startsWith("55")) return `${digits}@lid`;
  return digits;
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
      const rawPhone = String(item.phone ?? item.phoneNumber ?? item.jid ?? item.remoteJid ?? item.remote_jid ?? item.chatId ?? item.chat_id ?? "").trim();
      const rawName = String((item.contactName ?? item.name ?? item.pushName ?? rawPhone) || "Contato").trim();
      const normalizedLastMessageType = String(item.lastMessageType ?? item.messageType ?? item.mediaType ?? "text").toLowerCase();
      const lastMessageType =
        normalizedLastMessageType === "image" ||
        normalizedLastMessageType === "video" ||
        normalizedLastMessageType === "audio" ||
        normalizedLastMessageType === "file" ||
        normalizedLastMessageType === "document" ||
        normalizedLastMessageType === "media" ||
        normalizedLastMessageType === "sticker"
          ? (normalizedLastMessageType === "document" || normalizedLastMessageType === "media" ? "file" : normalizedLastMessageType)
          : "text";

      const resolvedPhone = normalizePhone(rawPhone);
      const resolvedId = rawId || `chat-${index}-${resolvedPhone || Date.now()}`;

      return {
        id: resolvedId,
        chatId: String(item.chatId ?? item.chat_id ?? item.remoteJid ?? item.remote_jid ?? item.jid ?? resolvedPhone),
        companyId: item.companyId ? String(item.companyId) : undefined,
        contactId: item.contactId ? String(item.contactId) : undefined,
        sessionId: item.sessionId ? String(item.sessionId) : item.session_id ? String(item.session_id) : undefined,
        contactName: rawName || resolvedPhone || "Contato",
        avatar: String(item.avatar ?? item.profilePictureUrl ?? item.profile_picture_url ?? "") || undefined,
        isGroup: Boolean(item.isGroup ?? String(item.chatId ?? item.chat_id ?? rawPhone).toLowerCase().includes("@g.us")),
        lastMessage: sanitizeLegacyPlaceholderText(item.lastMessage ?? item.last_message ?? item.preview ?? "", lastMessageType),
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

export type ContactDirectory = Record<string, string>;

export function parseJsonStorage<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export function loadContactDirectory(): ContactDirectory {
  const parsed = parseJsonStorage<ContactDirectory>("zapai_inbox_contact_directory", {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed;
}

export function persistContactDirectory(directory: ContactDirectory) {
  localStorage.setItem("zapai_inbox_contact_directory", JSON.stringify(directory));
}

export function isMeaningfulContactName(name: string, phone: string): boolean {
  const normalized = name.trim();
  if (!normalized) return false;
  if (!phone) return true;
  return normalizePhone(normalized) !== phone;
}

export function mergeContactDirectory(base: ContactDirectory, conversations: Conversation[]): ContactDirectory {
  const next: ContactDirectory = { ...base };

  conversations.forEach((conversation) => {
    const normalizedPhone = normalizePhone(conversation.phone);
    if (!normalizedPhone) return;

    const candidateName = String(conversation.contactName ?? "").trim();
    if (isMeaningfulContactName(candidateName, normalizedPhone)) {
      next[normalizedPhone] = candidateName;
    }
  });

  return next;
}

export function dedupeConversationsByScope(conversations: Conversation[], contacts: ContactDirectory): Conversation[] {
  const byScope = new Map<string, Conversation>();

  conversations.forEach((conversation) => {
    const normalizedPhone = normalizePhone(conversation.phone);
    const scope = getConversationScope({ phone: normalizedPhone, sessionId: conversation.sessionId }) || `id:${conversation.id}`;
    const storedName = normalizedPhone ? contacts[normalizedPhone] : undefined;
    const fallbackName = conversation.contactName || normalizedPhone || "Contato";
    const resolvedName =
      storedName && !isMeaningfulContactName(conversation.contactName ?? "", normalizedPhone)
        ? storedName
        : fallbackName;

    const normalizedConversation: Conversation = {
      ...conversation,
      phone: normalizedPhone || conversation.phone,
      contactName: resolvedName,
    };

    const existing = byScope.get(scope);
    if (!existing) {
      byScope.set(scope, normalizedConversation);
      return;
    }

    const existingTime = new Date(existing.updatedAt).getTime();
    const incomingTime = new Date(normalizedConversation.updatedAt).getTime();
    const incomingIsNewer = Number.isFinite(incomingTime) && (!Number.isFinite(existingTime) || incomingTime >= existingTime);
    const preferred = incomingIsNewer ? normalizedConversation : existing;

    byScope.set(scope, {
      ...preferred,
      unread: Math.max(existing.unread ?? 0, normalizedConversation.unread ?? 0),
      tags: preferred.tags?.length ? preferred.tags : (incomingIsNewer ? existing.tags : normalizedConversation.tags) ?? [],
    });
  });

  return [...byScope.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getPreferredSessionIdForConversations(sessions: SessionInfo[], preferredSessionId?: string | null): string | null {
  const active = pickActiveSession(sessions, preferredSessionId);
  return active?.id ?? sessions.find((session) => session?.id)?.id ?? preferredSessionId ?? null;
}

export function filterConversationsForSession(conversations: Conversation[], sessionId?: string | null): Conversation[] {
  const normalizedSessionId = String(sessionId ?? "").trim();
  if (!normalizedSessionId) return conversations;

  return conversations.filter((conversation) => {
    const conversationSessionId = String(conversation.sessionId ?? "").trim();
    return !conversationSessionId || conversationSessionId === normalizedSessionId;
  });
}

export function loadPersistedConversations(): Conversation[] {
  const parsed = parseJsonStorage<Conversation[]>("zapai_inbox_conversations", []);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

export function persistConversations(conversations: Conversation[]) {
  localStorage.setItem("zapai_inbox_conversations", JSON.stringify(conversations));
}

export function loadPersistedConversationMessages(params: { conversationId: string; sessionId?: string; phone?: string }): ChatMessage[] {
  const key = getConversationMessageStorageKey(params);
  const raw = localStorage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ChatMessage[];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

export function persistConversationMessages(params: {
  conversationId: string;
  sessionId?: string;
  phone?: string;
  messages: ChatMessage[];
}) {
  const key = getConversationMessageStorageKey(params);
  const payload = params.messages.slice(-200);
  localStorage.setItem(key, JSON.stringify(payload));
}

export function buildFallbackConversationId(params: { phone?: string; sessionId?: string }): string {
  const normalizedPhone = normalizePhone(params.phone);
  if (!normalizedPhone) return "";
  const normalizedSession = String(params.sessionId ?? "default").trim() || "default";
  return `phone-${normalizedSession}-${normalizedPhone}`;
}

export function resolveIncomingConversationId(params: {
  incoming: Pick<ChatMessage & { sessionId?: string; phone?: string; contactId?: string }, "conversationId" | "sessionId" | "phone" | "contactId">;
  activeConversation: Conversation | null;
  conversations: Conversation[];
  preferredSessionId?: string | null;
}): string {
  const explicitId = params.incoming.conversationId ? String(params.incoming.conversationId) : "";
  if (explicitId) return explicitId;

  const incomingContactId = String(params.incoming.contactId ?? "").trim();
  if (incomingContactId) {
    const byContact = params.conversations.find((conversation) => String(conversation.contactId ?? "") === incomingContactId);
    if (byContact) return String(byContact.id);
  }

  const incomingPhone = normalizePhone(params.incoming.phone);
  const incomingSessionId = String(params.incoming.sessionId ?? "").trim();
  if (!incomingPhone) return "";

  const sessionMatches = (conversationSessionId?: string) => {
    if (!incomingSessionId) return true;
    if (!conversationSessionId) return false;
    return conversationSessionId === incomingSessionId;
  };

  if (
    params.activeConversation &&
    normalizePhone(params.activeConversation.phone) === incomingPhone &&
    sessionMatches(params.activeConversation.sessionId)
  ) {
    return String(params.activeConversation.id);
  }

  const byPhone = params.conversations.filter((conversation) => normalizePhone(conversation.phone) === incomingPhone);
  if (byPhone.length === 0) return "";

  if (incomingSessionId) {
    const bySession = byPhone.find((conversation) => conversation.sessionId === incomingSessionId);
    if (bySession) return String(bySession.id);
  }

  if (params.preferredSessionId) {
    const byPreferredSession = byPhone.find((conversation) => conversation.sessionId === params.preferredSessionId);
    if (byPreferredSession) return String(byPreferredSession.id);
  }

  return String(byPhone[0].id);
}

export type StoredConversationDraft = {
  draft: string;
  timestamp: number;
};

export function getDraftStorageKey(conversationId: string): string {
  return `draft_${conversationId}`;
}

export function loadDraftSnapshotFromStorage(conversationId: string): StoredConversationDraft | null {
  const raw = localStorage.getItem(getDraftStorageKey(conversationId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { draft?: string; timestamp?: number };
    const draft = String(parsed.draft ?? "");
    if (!draft.trim()) {
      localStorage.removeItem(getDraftStorageKey(conversationId));
      return null;
    }
    return { draft, timestamp: Number(parsed.timestamp) || Date.now() };
  } catch {
    localStorage.removeItem(getDraftStorageKey(conversationId));
    return null;
  }
}

export function loadDraftFromStorage(conversationId: string): string {
  return loadDraftSnapshotFromStorage(conversationId)?.draft ?? "";
}

export function loadDraftsFromStorage(conversationIds: string[]): Record<string, StoredConversationDraft> {
  const entries = conversationIds
    .map((conversationId) => [conversationId, loadDraftSnapshotFromStorage(conversationId)] as const)
    .filter((entry): entry is readonly [string, StoredConversationDraft] => Boolean(entry[1]));

  return Object.fromEntries(entries);
}

export function saveDraftToStorage(conversationId: string, draft: string): StoredConversationDraft | null {
  const normalizedDraft = String(draft ?? "");
  if (!normalizedDraft.trim()) {
    clearDraftFromStorage(conversationId);
    return null;
  }

  const current = loadDraftSnapshotFromStorage(conversationId);
  if (current?.draft === normalizedDraft) {
    return current;
  }

  const snapshot = { draft: normalizedDraft, timestamp: Date.now() };
  localStorage.setItem(getDraftStorageKey(conversationId), JSON.stringify(snapshot));
  return snapshot;
}

export function clearDraftFromStorage(conversationId: string) {
  localStorage.removeItem(getDraftStorageKey(conversationId));
}

export function getLeadTemperatureMeta(analysis?: Pick<LeadIntentResult, "lead_temperature" | "next_action" | "intent" | "confidence"> | null) {
  if (!analysis) {
    return { label: "Lead Frio", badge: "Frio", action: "Educar o cliente", short: "Cold" };
  }

  if (analysis.lead_temperature === "ready_to_buy") {
    return { label: "Pronto para compra", badge: "Pronto", action: "Fechar venda", short: "Ready" };
  }

  if (analysis.lead_temperature === "hot") {
    return { label: "Lead Quente", badge: "Quente", action: "Incentivar compra", short: "Hot" };
  }

  if (analysis.lead_temperature === "warm") {
    return { label: "Lead Morno", badge: "Morno", action: "Enviar orçamento", short: "Warm" };
  }

  return { label: "Lead Frio", badge: "Frio", action: "Educar o cliente", short: "Cold" };
}

export function getLeadStatusPalette(temperature?: string | null) {
  const normalized = String(temperature ?? "").toLowerCase();
  if (normalized === "ready_to_buy" || normalized === "hot") {
    return {
      dotClass: "bg-primary",
      chipClass: "bg-primary/15 text-primary",
      badge: "Quente",
    };
  }

  if (normalized === "warm") {
    return {
      dotClass: "bg-secondary-foreground/70",
      chipClass: "bg-secondary text-secondary-foreground",
      badge: "Morno",
    };
  }

  return {
    dotClass: "bg-accent-foreground/70",
    chipClass: "bg-accent text-accent-foreground",
    badge: "Frio",
  };
}

export function inferMediaTypeFromSource(source?: string): "image" | "video" | "audio" | "file" | "sticker" | undefined {
  if (!source) return undefined;
  const normalized = source.toLowerCase();

  if (/(\.webp)($|\?|#)/.test(normalized) || normalized.includes("sticker")) return "sticker";
  if (/(\.png|\.jpe?g|\.gif|\.bmp|\.svg)($|\?|#)/.test(normalized)) return "image";
  if (/(\.mp4|\.mov|\.avi|\.mkv|\.webm|\.m4v)($|\?|#)/.test(normalized)) return "video";
  if (/(\.mp3|\.wav|\.ogg|\.m4a|\.aac|\.webm|\.opus)($|\?|#)/.test(normalized)) return "audio";
  return "file";
}

export async function downloadMediaFile(url: string, fallbackFileName = "arquivo") {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download_failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = fallbackFileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function getMediaMimeType(message: Partial<ChatMessage> & { mimeType?: string | null; mimetype?: string | null }): string {
  return String(message.mimeType || message.mimetype || "").trim();
}

function extensionFromMimeType(mimeType?: string | null): string {
  const normalized = String(mimeType || "").toLowerCase();
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "application/json": "json",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "application/vnd.rar": "rar",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/wav": "wav",
  };
  if (map[normalized]) return map[normalized];
  const subtype = normalized.split("/")[1]?.split(";")[0]?.trim();
  return subtype && /^[a-z0-9.+-]+$/.test(subtype) ? subtype.replace(/^x-/, "") : "";
}

function getFileExtension(fileName?: string | null): string {
  const normalized = String(fileName || "").split("?")[0].split("#")[0].trim();
  const match = normalized.match(/\.([a-z0-9]{1,8})$/i);
  return match?.[1]?.toLowerCase() || "";
}

function decodeFileName(value?: string | null): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function isOpaqueMediaName(value?: string | null): boolean {
  const name = String(value || "").trim();
  if (!name) return true;
  const stem = name.replace(/\.[a-z0-9]{1,8}$/i, "");
  if (/^[0-9a-f]{16,}$/i.test(stem)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stem)) return true;
  if (/^[a-z0-9_-]{20,}$/i.test(stem) && !/[._ -]/.test(stem)) return true;
  return false;
}

function getExplicitMediaFileName(message: Partial<ChatMessage> & { fileName?: string | null; filename?: string | null; name?: string | null; originalName?: string | null }): string {
  return decodeFileName(message.fileName || message.filename || message.originalName || message.name || "");
}

function fallbackMediaFileName(message: Partial<ChatMessage> & { mimeType?: string | null; mimetype?: string | null }, mediaType?: string | null): string {
  const label = getMediaTypeLabel(mediaType || message.mediaType).toLowerCase();
  const extension = extensionFromMimeType(getMediaMimeType(message));
  if (extension) return `${label}.${extension}`;
  if (label && label !== "mídia") return label;
  return "arquivo";
}

export function getMediaFileName(message: ChatMessage): string {
  const explicitName = getExplicitMediaFileName(message);
  if (explicitName) return explicitName;

  const source = String(extractMessageAssetUrl(message) ?? "").trim();
  if (source) {
    const base = decodeFileName(source.split("?")[0].split("#")[0].split("/").pop());
    if (base && !isOpaqueMediaName(base)) return base;
  }

  return fallbackMediaFileName(message, message.mediaType);
}

export function getMediaFileReferenceLabel(message: Partial<ChatMessage> & { mimeType?: string | null; mimetype?: string | null; fileName?: string | null; filename?: string | null }, mediaType?: string | null): string {
  const typeLabel = getMediaTypeLabel(mediaType || message.mediaType);
  const explicitName = getExplicitMediaFileName(message);
  const source = String(extractMessageAssetUrl(message) ?? "").trim();
  const sourceBase = source ? decodeFileName(source.split("?")[0].split("#")[0].split("/").pop()) : "";
  const extension = getFileExtension(explicitName) || (!isOpaqueMediaName(sourceBase) ? getFileExtension(sourceBase) : "") || extensionFromMimeType(getMediaMimeType(message));
  const upperExtension = extension ? extension.toUpperCase() : "";

  if (upperExtension && typeLabel) return `${upperExtension} • ${typeLabel}`;
  return typeLabel || getMediaMimeType(message) || "Arquivo";
}

export function estimateBase64Bytes(base64: string): number {
  const normalized = base64.replace(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

export function sortMessagesAsc(list: ChatMessage[]): ChatMessage[] {
  const uniqueById = new Map<string, ChatMessage>();

  list.forEach((message) => {
    if (!message?.id) return;
    uniqueById.set(String(message.id), message);
  });

  return [...uniqueById.values()].sort((a, b) => {
    const aTime = new Date(String((a as { timestamp?: string }).timestamp ?? a.createdAt ?? "")).getTime();
    const bTime = new Date(String((b as { timestamp?: string }).timestamp ?? b.createdAt ?? "")).getTime();
    const safeATime = Number.isFinite(aTime) ? aTime : 0;
    const safeBTime = Number.isFinite(bTime) ? bTime : 0;
    return safeATime - safeBTime;
  });
}

export function mergeMessagesById(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(base.map((item) => item.id));
  const appended = incoming.filter((item) => !seen.has(item.id));
  return [...base, ...appended];
}

export function getMessageDisplayContent(message: Partial<ChatMessage> & { text?: string; body?: string; message?: string; caption?: string; mediaType?: string }) {
  const directText = [message.content, message.text, message.body, message.message, message.caption]
    .map((value) => sanitizeLegacyPlaceholderText(value, message.mediaType))
    .find((value) => value.length > 0);

  if (directText) return directText;

  return getMediaTypeLabel(message.mediaType) || "Mensagem sem conteúdo";
}

export function normalizeLoadedMessage(message: ChatMessage, conversationId: string, index: number): ChatMessage {
  const resolvedUrl = extractMessageAssetUrl(message);
  const resolvedMediaType = message.mediaType ?? inferMediaTypeFromSource(String(resolvedUrl ?? "")) ?? undefined;
  const createdAt = normalizeId(message.createdAt) || normalizeId(message.timestamp) || new Date().toISOString();
  const createdAtMs = new Date(createdAt).getTime();
  const normalizedStatus = String(message.status ?? "").toLowerCase();
  const hasStalePendingStatus =
    ["pending", "sending", "retry"].includes(normalizedStatus) &&
    Number.isFinite(createdAtMs) &&
    Date.now() - createdAtMs > 120_000;

  return {
    ...message,
    id: normalizeId(message.id) || `message-${Date.now()}-${index}`,
    content: getMessageDisplayContent({ ...(message as ChatMessage & { text?: string; body?: string; message?: string; caption?: string }), mediaType: resolvedMediaType }),
    conversationId: normalizeId(message.conversationId) || normalizeId(conversationId),
    createdAt,
    mediaType: resolvedMediaType,
    mediaUrl: typeof resolvedUrl === "string" ? resolvedUrl : message.mediaUrl,
    status: hasStalePendingStatus ? "failed" : message.status,
    url: typeof resolvedUrl === "string" ? resolvedUrl : message.url,
  };
}

export function countNewMessageEntries(base: ChatMessage[], incoming: ChatMessage[]): number {
  const knownIds = new Set(base.map((item) => item.id));
  return incoming.reduce((total, item) => (knownIds.has(item.id) ? total : total + 1), 0);
}

export function isLikelyRealtimeAck(candidate: ChatMessage, incoming: ChatMessage): boolean {
  if (!candidate.id.startsWith("temp-")) return false;
  if ((candidate.mediaType ?? "text") !== (incoming.mediaType ?? "text")) return false;
  if ((candidate.content ?? "").trim() !== (incoming.content ?? "").trim()) return false;
  const candidateTime = new Date(candidate.createdAt).getTime();
  const incomingTime = new Date(incoming.createdAt).getTime();
  if (!Number.isFinite(candidateTime) || !Number.isFinite(incomingTime)) return true;
  return Math.abs(incomingTime - candidateTime) <= 120_000;
}

export function isPotentialDuplicateMessage(base: ChatMessage[], incoming: ChatMessage): boolean {
  if (base.some((item) => item.id === incoming.id)) return true;

  const incomingMedia = resolveMediaUrl(extractMessageAssetUrl(incoming));
  return base.some((item) => {
    if (!item.id.startsWith("temp-") && !incoming.id.startsWith("temp-")) return false;
    if ((item.mediaType ?? "text") !== (incoming.mediaType ?? "text")) return false;
    if ((item.content ?? "").trim() !== (incoming.content ?? "").trim()) return false;
    if (item.fromMe !== incoming.fromMe) return false;

    const itemMedia = resolveMediaUrl(extractMessageAssetUrl(item));
    if (itemMedia && incomingMedia && itemMedia !== incomingMedia) return false;

    return isLikelyRealtimeAck(item, incoming);
  });
}

export function inferConversationMessageType(conversation: Conversation): "text" | "image" | "video" | "audio" | "file" | "sticker" {
  if (conversation.lastMessageType && conversation.lastMessageType !== "text") return conversation.lastMessageType;
  const normalized = (conversation.lastMessage ?? "").trim().toLowerCase();
  if (normalized.includes("image") || normalized.startsWith("[image]")) return "image";
  if (normalized.includes("video") || normalized.startsWith("[video]")) return "video";
  if (normalized.includes("audio") || normalized.startsWith("[audio]")) return "audio";
  if (normalized.includes("sticker")) return "sticker";
  if (normalized.includes("pdf") || normalized.includes("document") || normalized.startsWith("[file]") || normalized.startsWith("[media]")) return "file";
  return "text";
}

export function getMessageStatusMeta(status?: ChatMessage["status"]) {
  const normStatus = String(status || "").toLowerCase();
  if (normStatus === "sending" || normStatus === "pending" || normStatus === "retry") {
    return {
      symbol: "1V",
      className: "text-amber-500 animate-pulse",
      label: "Enviando para o WhatsApp...",
      icon: "clock",
    };
  }
  if (normStatus === "failed" || normStatus === "blocked" || normStatus === "error") {
    return {
      symbol: "1V",
      className: "text-destructive font-bold",
      label: "Bloqueado ou não entregue (Falha)",
      icon: "failed",
    };
  }
  if (normStatus === "read" || normStatus === "played") {
    return {
      symbol: "2V",
      className: "text-emerald-500 font-bold",
      label: "Lida no WhatsApp",
      icon: "read",
    };
  }
  if (normStatus === "device_ack" || normStatus === "delivered" || normStatus === "received") {
    return {
      symbol: "2V",
      className: "text-emerald-500 font-bold",
      label: "Entregue no WhatsApp",
      icon: "delivered",
    };
  }
  if (normStatus === "sent" || normStatus === "server_ack") {
    return {
      symbol: "1V",
      className: "text-muted-foreground/70",
      label: "Enviada (Servidor)",
      icon: "sent",
    };
  }

  return {
    symbol: "1V",
    className: "text-muted-foreground/70",
    label: "Enviada",
    icon: "sent",
  };
}

export function isViewportNearBottom(viewport: HTMLDivElement, threshold = 96): boolean {
  const distance = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
  return distance <= threshold;
}

export function detectMediaType(file: File): "image" | "video" | "audio" | "file" | "sticker" {
  const normalizedType = String(file.type || "").toLowerCase();
  const normalizedName = String(file.name || "").toLowerCase();
  if (normalizedType === "image/webp" && normalizedName.includes("sticker")) return "sticker";
  if (normalizedType.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const arrayBuffer = reader.result;
      if (!(arrayBuffer instanceof ArrayBuffer)) {
        reject(new Error("Não foi possível processar o arquivo selecionado."));
        return;
      }

      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 0x8000;
      let binary = "";

      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        let partial = "";
        for (let index = 0; index < chunk.length; index += 1) {
          partial += String.fromCharCode(chunk[index]);
        }
        binary += partial;
      }

      resolve(window.btoa(binary));
    };

    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

export function getConversationSourceLabel(conversation?: Conversation | null): string {
  if (!conversation) return "WhatsApp";
  if (conversation.isGroup) return "Grupo WhatsApp";
  if (conversation.sessionId) return `WhatsApp (${conversation.sessionId})`;
  return "WhatsApp";
}

export function interpolateTemplateVariables(
  template: string,
  context: {
    contactName?: string | null;
    phone?: string | null;
    company?: string | null;
  },
): string {
  const normalizedPhone = normalizePhone(context.phone || "");
  return String(template || "")
    .replace(/\{\{\s*nome\s*\}\}/gi, context.contactName?.trim() || "cliente")
    .replace(/\{\{\s*telefone\s*\}\}/gi, normalizedPhone || context.phone?.trim() || "")
    .replace(/\{\{\s*empresa\s*\}\}/gi, context.company?.trim() || "ZapAI");
}

export function getQuickReplyPreviewText(
  item: QuickReplyItem,
  context: {
    contactName?: string | null;
    phone?: string | null;
    company?: string | null;
  },
): string {
  const items = item.items || [{ type: "text", value: item.text }];
  const textParts = items
    .filter((entry) => entry.type === "text")
    .map((entry) => interpolateTemplateVariables(entry.value, context))
    .filter(Boolean);

  if (textParts.length > 0) return textParts.join("\n");

  const mediaLabels = items
    .filter((entry) => entry.type !== "text")
    .map((entry) => getMediaTypeLabel(entry.type === "pdf" ? "document" : entry.type))
    .filter(Boolean);

  return mediaLabels.join(" ⬢ ") || item.text;
}

export function getUploadLimitBytes(mediaType: ComposerAttachment["mediaType"]): number {
  const limits = {
    image: 20 * 1024 * 1024,
    video: 100 * 1024 * 1024,
    audio: 20 * 1024 * 1024,
    file: 100 * 1024 * 1024,
    sticker: 20 * 1024 * 1024,
  };
  return limits[mediaType] ?? limits.file;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

