import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { List, type RowComponentProps } from "react-window";
import {
  ArrowBendUpRight,
  CaretLeft,
  CaretRight,
  ChatCircleDots,
  CopySimple,
  DotsThreeVertical,
  PencilSimple,
  Star,
  File as FileIcon,
  ImageSquare,
  MagnifyingGlass,
  Microphone,
  PaperPlaneTilt,
  Paperclip,
  PlayCircle,
  Smiley,
  Trash,
  VideoCamera,
  Waveform,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import InboxView from "@/lovable/pages/InboxPageView";
import { createInboxLovableViewModel } from "@/adapters/lovable/inboxAdapter";
import { useNavigate } from "react-router-dom";
import { ChatHeaderBar } from "@/components/inbox/ChatHeaderBar";
import { ChatSearchBar } from "@/components/inbox/ChatSearchBar";
import { NewMessagesBanner } from "@/components/inbox/NewMessagesBanner";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getInboxUnreadTotal, publishInboxUnreadTotal } from "@/lib/inboxUnread";
import { apiService, API_ORIGIN, type ChatMessage, type Conversation, type MessageSendResponse, type SessionInfo } from "@/services/apiService";
import { useAppStore } from "@/stores/appStore";
import { emitInboxSocketEvent, forceReconnectInboxSocket } from "@/runtime/socket/socketManager";
import { notify } from "@/services/notifyService";
import { analyzeLeadIntent, type LeadIntentResult } from "@/services/leadAnalyzer";
import { generateSalesStrategy } from "@/services/salesStrategyEngine";
import { analyzeConversation } from "@/services/conversationAnalyzer";
import { generateResponse } from "@/services/responseEngine";
import { saveLeadTemperature } from "@/services/leadIntelligenceStore";
import { listConversationControls, upsertConversationControl, type ConversationControl } from "@/services/conversationControlStore";

const CONVERSATIONS_PAGE_SIZE = 20;
const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_CACHE_TTL_MS = 30_000;
const CONVERSATION_ROW_HEIGHT = 82;
const MOBILE_TOUCH_TARGET_CLASS = "h-11 min-h-11";
const DRAFT_TTL_MS = 5 * 60 * 1000;
const DRAFT_KEY_PREFIX = "draft_";
const EMOJI_OPTIONS = ["😀", "😂", "😍", "👍", "🔥", "👏", "🙏", "✅", "📦", "🚚"];
const ACTIVE_SESSION_STORAGE_KEY = "zapai_inbox_active_session";
const LAST_CHAT_SCOPE_STORAGE_KEY = "zapai_inbox_last_chat_scope";
const MESSAGE_STORAGE_KEY_PREFIX = "zapai_inbox_messages";
const CONVERSATION_STORAGE_KEY = "zapai_inbox_conversations";
const CONTACT_DIRECTORY_STORAGE_KEY = "zapai_inbox_contact_directory";
const MAX_PERSISTED_MESSAGES_PER_CHAT = 200;
const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
const RUNTIME_RECONNECTED_EVENT = "runtime:reconnected";
const ARCHIVED_CHATS_STORAGE_KEY = "zapai_inbox_archived_chats";
const BACKEND_BASE_URL = API_ORIGIN;
// Offline fallback polls: only activate when WebSocket is disconnected.
// Deliberately conservative — realtime WS handles the happy path.
// These intervals kick in ONLY when WS is down, so aggressive values hurt DB.
const OFFLINE_MESSAGE_POLL_INTERVAL_MS = 30_000;   // was 8s — too aggressive
const OFFLINE_FALLBACK_SYNC_INTERVAL_MS = 45_000;   // was 12s — too aggressive
const SOCKET_CONNECTED_SYNC_DEBOUNCE_MS = 8_000;
const SOCKET_FORCE_RECONNECT_DEBOUNCE_MS = 15_000;
const SOCKET_BACKGROUND_HYDRATE_DEBOUNCE_MS = 10_000;

function isSessionActive(session: SessionInfo): boolean {
  if (!session) return false;
  const normalizedStatus = (session.status ?? "").toLowerCase();
  return Boolean(session.connected || normalizedStatus === "connected" || normalizedStatus === "active" || normalizedStatus === "open");
}

function pickActiveSession(sessions: SessionInfo[], preferredSessionId?: string | null): SessionInfo | null {
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  if (preferredSessionId) {
    const preferred = safeSessions.find((session) => session && session.id === preferredSessionId);
    if (preferred && isSessionActive(preferred)) return preferred;
  }

  return safeSessions.find((session) => session && isSessionActive(session)) ?? null;
}

type ComposerAttachment = {
  id: string;
  file: File;
  mediaType: "image" | "video" | "audio" | "file";
  previewUrl: string;
};

type PreviewMediaState = {
  url: string;
  type: "image" | "video";
};

type MessageCacheEntry = {
  messages: ChatMessage[];
  hasMore: boolean;
  oldestCursor: string | null;
  cachedAt: number;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(value?: string): string {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.length <= 5 ? value : "--:--";
  return parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function normalizeConversationTimestamp(value?: string): number {
  const parsed = new Date(value ?? "").getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeId(id: unknown): string {
  return String(id ?? "").trim();
}

function normalizePhoneKey(phone: unknown): string {
  return String(phone ?? "").trim().toLowerCase();
}

function getConversationKey(conversation: Partial<Conversation> & { conversationId?: unknown; remoteJid?: unknown; jid?: unknown; chatId?: unknown }) {
  const preferredId = normalizeId(conversation.id) || normalizeId(conversation.conversationId);
  if (preferredId) return preferredId;

  const phone = normalizePhoneKey(conversation.phone);
  const sessionId = normalizeId(conversation.sessionId);
  if (phone && sessionId) return `${sessionId}:${phone}`;

  const jid = normalizeId(conversation.chatId) || normalizeId(conversation.remoteJid) || normalizeId(conversation.jid);
  if (jid) return jid;

  return phone || sessionId || "unknown-conversation";
}

function getMessageConversationKey(message: Partial<ChatMessage> & { sessionId?: unknown; phone?: unknown; remoteJid?: unknown; jid?: unknown; chatId?: unknown; conversationId?: unknown }) {
  const preferredId = normalizeId(message.conversationId);
  if (preferredId) return preferredId;

  const phone = normalizePhoneKey(message.phone);
  const sessionId = normalizeId(message.sessionId);
  if (phone && sessionId) return `${sessionId}:${phone}`;

  const jid = normalizeId(message.chatId) || normalizeId(message.remoteJid) || normalizeId(message.jid);
  if (jid) return jid;

  return phone || sessionId || "unknown-conversation";
}

function toConversationDateLabel(value?: string): string {
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

function resolveMediaUrl(url?: string | null): string | null {
  const normalized = String(url ?? "").trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${BACKEND_BASE_URL}/${normalized.replace(/^\/+/, "")}`;
}

function inferMediaTypeFromSource(source?: string): "image" | "video" | "audio" | "file" | undefined {
  if (!source) return undefined;
  const normalized = source.toLowerCase();

  if (/(\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.svg)($|\?|#)/.test(normalized)) return "image";
  if (/(\.mp4|\.mov|\.avi|\.mkv|\.webm|\.m4v)($|\?|#)/.test(normalized)) return "video";
  if (/(\.mp3|\.wav|\.ogg|\.m4a|\.aac|\.webm|\.opus)($|\?|#)/.test(normalized)) return "audio";
  return "file";
}

async function downloadMediaFile(url: string, fallbackFileName = "arquivo") {
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

function getMediaFileName(message: ChatMessage): string {
  const caption = String(message.caption ?? "").trim();
  if (caption) return caption;

  const source = String(message.url ?? "").trim();
  if (!source) return "arquivo";
  const base = source.split("?")[0].split("#")[0].split("/").pop();
  return base || "arquivo";
}

function estimateBase64Bytes(base64: string): number {
  const normalized = base64.replace(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function sortMessagesAsc(list: ChatMessage[]): ChatMessage[] {
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

function mergeMessagesById(base: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set(base.map((item) => item.id));
  const appended = incoming.filter((item) => !seen.has(item.id));
  return [...base, ...appended];
}

function getMessageDisplayContent(message: Partial<ChatMessage> & { text?: string; body?: string; message?: string; caption?: string; mediaType?: string }) {
  const directText = [message.content, message.text, message.body, message.message, message.caption]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value) => value.length > 0);

  if (directText) return directText;

  switch (message.mediaType) {
    case "image":
      return "[imagem]";
    case "video":
      return "[vídeo]";
    case "audio":
      return "[áudio]";
    case "file":
      return "[arquivo]";
    default:
      return "Mensagem sem conteúdo";
  }
}

function normalizeLoadedMessage(message: ChatMessage, conversationId: string, index: number): ChatMessage {
  return {
    ...message,
    id: normalizeId(message.id) || `message-${Date.now()}-${index}`,
    content: getMessageDisplayContent(message as ChatMessage & { text?: string; body?: string; message?: string; caption?: string }),
    conversationId: normalizeId(message.conversationId) || normalizeId(conversationId),
    createdAt: normalizeId(message.createdAt) || normalizeId(message.timestamp) || new Date().toISOString(),
  };
}

function countNewMessageEntries(base: ChatMessage[], incoming: ChatMessage[]): number {
  const knownIds = new Set(base.map((item) => item.id));
  return incoming.reduce((total, item) => (knownIds.has(item.id) ? total : total + 1), 0);
}

function isLikelyRealtimeAck(candidate: ChatMessage, incoming: ChatMessage): boolean {
  if (!candidate.id.startsWith("temp-")) return false;
  if ((candidate.mediaType ?? "text") !== (incoming.mediaType ?? "text")) return false;
  if ((candidate.content ?? "").trim() !== (incoming.content ?? "").trim()) return false;
  const candidateTime = new Date(candidate.createdAt).getTime();
  const incomingTime = new Date(incoming.createdAt).getTime();
  if (!Number.isFinite(candidateTime) || !Number.isFinite(incomingTime)) return true;
  return Math.abs(incomingTime - candidateTime) <= 120_000;
}

function isPotentialDuplicateMessage(base: ChatMessage[], incoming: ChatMessage): boolean {
  if (base.some((item) => item.id === incoming.id)) return true;

  const incomingMedia = resolveMediaUrl(incoming.url);
  return base.some((item) => {
    if (!item.id.startsWith("temp-") && !incoming.id.startsWith("temp-")) return false;
    if ((item.mediaType ?? "text") !== (incoming.mediaType ?? "text")) return false;
    if ((item.content ?? "").trim() !== (incoming.content ?? "").trim()) return false;
    if (item.fromMe !== incoming.fromMe) return false;

    const itemMedia = resolveMediaUrl(item.url);
    if (itemMedia && incomingMedia && itemMedia !== incomingMedia) return false;

    return isLikelyRealtimeAck(item, incoming);
  });
}

function inferConversationMessageType(conversation: Conversation): "text" | "image" | "video" | "audio" | "file" {
  if (conversation.lastMessageType && conversation.lastMessageType !== "text") return conversation.lastMessageType;
  const normalized = (conversation.lastMessage ?? "").trim().toLowerCase();
  if (normalized.includes("image") || normalized.startsWith("[image]")) return "image";
  if (normalized.includes("video") || normalized.startsWith("[video]")) return "video";
  if (normalized.includes("audio") || normalized.startsWith("[audio]")) return "audio";
  if (normalized.includes("pdf") || normalized.includes("document") || normalized.startsWith("[file]")) return "file";
  return "text";
}

function getMessageStatusMeta(status?: ChatMessage["status"]) {
  if (status === "read") {
    return {
      symbol: "✓✓",
      className: "text-info",
      label: "Lida",
    };
  }

  if (status === "delivered") {
    return {
      symbol: "✓✓",
      className: "text-primary-foreground/70",
      label: "Entregue",
    };
  }

  return {
    symbol: "✓",
    className: "text-primary-foreground/70",
    label: "Enviada",
  };
}

function isViewportNearBottom(viewport: HTMLDivElement, threshold = 96): boolean {
  const distance = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
  return distance <= threshold;
}

function detectMediaType(file: File): "image" | "video" | "audio" | "file" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

function fileToBase64(file: File): Promise<string> {
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

function normalizePhone(phone?: string): string {
  const normalized = String(phone ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("@g.us")) return normalized;
  return normalized.replace(/\D/g, "");
}

function parseChatsLoadedPayload(payload: unknown): Conversation[] {
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

function parseContactsLoadedPayload(payload: unknown): Array<{ phone: string; name: string }> {
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

function getConversationScope(params: { phone?: string; sessionId?: string | null }): string {
  const normalizedPhone = normalizePhone(params.phone);
  const normalizedSessionId = String(params.sessionId ?? "default").trim() || "default";
  if (!normalizedPhone) return "";
  return `${normalizedSessionId}:${normalizedPhone}`;
}

function getConversationMessageStorageKey(params: { conversationId: string; sessionId?: string; phone?: string }): string {
  const normalizedPhone = normalizePhone(params.phone);
  const normalizedSession = String(params.sessionId ?? "default").trim() || "default";
  const scope = normalizedPhone || String(params.conversationId);
  return `${MESSAGE_STORAGE_KEY_PREFIX}:${normalizedSession}:${scope}`;
}

type ContactDirectory = Record<string, string>;

function parseJsonStorage<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function loadContactDirectory(): ContactDirectory {
  const parsed = parseJsonStorage<ContactDirectory>(CONTACT_DIRECTORY_STORAGE_KEY, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed;
}

function persistContactDirectory(directory: ContactDirectory) {
  localStorage.setItem(CONTACT_DIRECTORY_STORAGE_KEY, JSON.stringify(directory));
}

function isMeaningfulContactName(name: string, phone: string): boolean {
  const normalized = name.trim();
  if (!normalized) return false;
  if (!phone) return true;
  return normalizePhone(normalized) !== phone;
}

function mergeContactDirectory(base: ContactDirectory, conversations: Conversation[]): ContactDirectory {
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

function dedupeConversationsByScope(conversations: Conversation[], contacts: ContactDirectory): Conversation[] {
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

function loadPersistedConversations(): Conversation[] {
  const parsed = parseJsonStorage<Conversation[]>(CONVERSATION_STORAGE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function persistConversations(conversations: Conversation[]) {
  localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(conversations));
}

function loadPersistedConversationMessages(params: { conversationId: string; sessionId?: string; phone?: string }): ChatMessage[] {
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

function persistConversationMessages(params: {
  conversationId: string;
  sessionId?: string;
  phone?: string;
  messages: ChatMessage[];
}) {
  const key = getConversationMessageStorageKey(params);
  const payload = params.messages.slice(-MAX_PERSISTED_MESSAGES_PER_CHAT);
  localStorage.setItem(key, JSON.stringify(payload));
}

function buildFallbackConversationId(params: { phone?: string; sessionId?: string }): string {
  const normalizedPhone = normalizePhone(params.phone);
  if (!normalizedPhone) return "";
  const normalizedSession = String(params.sessionId ?? "default").trim() || "default";
  return `phone-${normalizedSession}-${normalizedPhone}`;
}

function resolveIncomingConversationId(params: {
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

function getDraftStorageKey(conversationId: string): string {
  return `${DRAFT_KEY_PREFIX}${conversationId}`;
}

function loadDraftFromStorage(conversationId: string): string {
  const raw = localStorage.getItem(getDraftStorageKey(conversationId));
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw) as { draft?: string; timestamp?: number };
    if (!parsed.timestamp || Date.now() - parsed.timestamp > DRAFT_TTL_MS) {
      localStorage.removeItem(getDraftStorageKey(conversationId));
      return "";
    }
    return parsed.draft ?? "";
  } catch {
    localStorage.removeItem(getDraftStorageKey(conversationId));
    return "";
  }
}

function saveDraftToStorage(conversationId: string, draft: string) {
  localStorage.setItem(
    getDraftStorageKey(conversationId),
    JSON.stringify({ draft, timestamp: Date.now() }),
  );
}

function clearDraftFromStorage(conversationId: string) {
  localStorage.removeItem(getDraftStorageKey(conversationId));
}

function getLeadTemperatureMeta(analysis?: Pick<LeadIntentResult, "lead_temperature" | "next_action" | "intent" | "confidence"> | null) {
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

function getLeadStatusPalette(temperature?: string | null) {
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

const responseCenterSections = [
  "Olá! Como posso ajudar?",
  "Qual produto você procura?",
  "Vou te enviar os valores agora",
] as const;

type QuickReplyItem = {
  id: string;
  category: "saudação" | "vendas" | "suporte";
  text: string;
  favorite?: boolean;
};

const DEFAULT_QUICK_REPLIES: QuickReplyItem[] = [
  { id: "qr-1", category: "saudação", text: "Olá! Como posso ajudar?" },
  { id: "qr-2", category: "vendas", text: "Qual produto você procura hoje?" },
  { id: "qr-3", category: "vendas", text: "Posso te enviar os valores agora mesmo." },
  { id: "qr-4", category: "suporte", text: "Já vou verificar isso para você e te retorno em instantes." },
];

const MessageBubble = memo(function MessageBubble({
  message,
  reaction,
  onReact,
  onOpenMediaPreview,
  isMenuOpen,
  isReactionPickerOpen,
  onToggleMenu,
  onToggleReactionPicker,
  onCopyMessage,
  onReplyMessage,
  onForwardMessage,
  onToggleAudio,
  isAudioLoading,
  isAudioPlaying,
  audioProgress,
  audioDuration,
  backendOnline,
}: {
  message: ChatMessage;
  reaction?: string;
  onReact: (messageId: string, emoji: string) => void;
  onOpenMediaPreview: (url: string, type: "image" | "video") => void;
  isMenuOpen: boolean;
  isReactionPickerOpen: boolean;
  onToggleMenu: (messageId: string) => void;
  onToggleReactionPicker: (messageId: string) => void;
  onCopyMessage: (message: ChatMessage) => void;
  onReplyMessage: (message: ChatMessage) => void;
  onForwardMessage: (message: ChatMessage) => void;
  onToggleAudio: (messageId: string, url: string) => void;
  isAudioLoading: boolean;
  isAudioPlaying: boolean;
  audioProgress: number;
  audioDuration: number;
  backendOnline: boolean;
}) {
  const explicitMessageType = (message as ChatMessage & { messageType?: "text" | "image" | "video" | "audio" | "file" }).messageType;
  const mediaUrl = resolveMediaUrl(message.url ?? message.mediaUrl ?? message.mediaPath);
  const resolvedMediaType =
    message.mediaType ??
    explicitMessageType ??
    inferMediaTypeFromSource(message.url) ??
    inferMediaTypeFromSource(mediaUrl ?? undefined);
  const hasRenderableMedia = Boolean(resolvedMediaType && resolvedMediaType !== "text");
  const shouldTrackMediaLoading = resolvedMediaType === "image" || resolvedMediaType === "video";
  const [mediaLoading, setMediaLoading] = useState(Boolean(mediaUrl && shouldTrackMediaLoading));
  const [mediaError, setMediaError] = useState(false);
  const statusMeta = getMessageStatusMeta(message.status);

  useEffect(() => {
    setMediaLoading(Boolean(mediaUrl && shouldTrackMediaLoading));
    setMediaError(false);
  }, [mediaUrl, message.id, shouldTrackMediaLoading]);

  useEffect(() => {
    if (!hasRenderableMedia || mediaUrl) return;
  }, [hasRenderableMedia, mediaUrl, message]);

  const hasCaption = Boolean(message.caption?.trim());
  const safeTextContent = getMessageDisplayContent(message as ChatMessage & { text?: string; body?: string; message?: string; caption?: string });

  return (
    <div className={cn("flex", message.fromMe && "justify-end")}>
      <div className="relative pb-3">
        <button
          type="button"
          onClick={() => onToggleMenu(message.id)}
          className={cn("chat-bubble text-left", message.fromMe ? "chat-bubble-sent" : "chat-bubble-received")}
        >

          {!backendOnline && hasRenderableMedia && (
            <div className="mb-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Servidor reconectando...
            </div>
          )}

          {!mediaUrl && hasRenderableMedia && backendOnline && (
            <div className="mb-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Não foi possível carregar mídia
            </div>
          )}

          {mediaUrl && backendOnline && (
            <div className="mb-2" onClick={(event) => event.stopPropagation()}>
              {mediaLoading && (
                <div className="mb-2">
                  <Skeleton className={cn("rounded-lg", resolvedMediaType === "audio" ? "h-10 w-64" : "h-40 w-64")} />
                </div>
              )}

              {mediaError && (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Mídia indisponível
                </div>
              )}

              {resolvedMediaType === "image" && !mediaError && (
                <img
                  src={mediaUrl}
                  alt={message.caption?.trim() || "Imagem enviada"}
                  className={cn("max-w-64 cursor-pointer rounded-lg border border-border", mediaLoading && "hidden")}
                  loading="lazy"
                  decoding="async"
                  onClick={() => onOpenMediaPreview(mediaUrl, "image")}
                  onLoad={() => {
                    setMediaLoading(false);
                  }}
                  onError={() => {
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              )}

              {resolvedMediaType === "video" && !mediaError && (
                <video
                  src={mediaUrl}
                  controls
                  className={cn("max-w-64 cursor-pointer rounded-lg border border-border", mediaLoading && "hidden")}
                  preload="metadata"
                  onClick={() => onOpenMediaPreview(mediaUrl, "video")}
                  onLoadedData={() => setMediaLoading(false)}
                  onError={() => {
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              )}

              {resolvedMediaType === "audio" && !mediaError && (
                <audio
                  controls
                  src={mediaUrl}
                  className={cn("w-64", mediaLoading && "hidden")}
                  onCanPlayThrough={() => setMediaLoading(false)}
                  onError={() => {
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              )}

              {(resolvedMediaType === "file" || !resolvedMediaType) && (
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={getMediaFileName(message)}
                  className="inline-flex h-8 items-center gap-2 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Baixar arquivo
                </a>
              )}
            </div>
          )}

          <p className="whitespace-pre-wrap">{safeTextContent}</p>

          <div className={cn("mt-1 flex items-center gap-1 text-[10px]", message.fromMe ? "justify-end text-primary-foreground/70" : "text-muted-foreground")}>
            <span>{formatTime(message.createdAt)}</span>
            {message.fromMe && (
              <span className={cn("font-semibold", statusMeta.className)} aria-label={statusMeta.label} title={statusMeta.label}>
                {statusMeta.symbol}
              </span>
            )}
          </div>
        </button>

        {reaction && (
          <button
            type="button"
            onClick={() => onToggleReactionPicker(message.id)}
            className={cn(
              "absolute -bottom-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs shadow-sm",
              message.fromMe ? "right-2" : "left-2",
            )}
          >
            {reaction}
          </button>
        )}

        {isMenuOpen && (
          <div className={cn("absolute z-20 mt-1 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg", message.fromMe ? "right-0" : "left-0")}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={() => onToggleReactionPicker(message.id)}
            >
              <Smiley className="h-3.5 w-3.5" />
              Reagir
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onReplyMessage(message)}>
              <ArrowBendUpRight className="h-3.5 w-3.5" />
              Responder
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onCopyMessage(message)}>
              <CopySimple className="h-3.5 w-3.5" />
              Copiar
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onForwardMessage(message)}>
              <PaperPlaneTilt className="h-3.5 w-3.5" />
              Encaminhar
            </button>
          </div>
        )}

        {isReactionPickerOpen && (
          <div className={cn("absolute z-20 mt-1 flex items-center gap-1 rounded-full border border-border bg-popover p-1 shadow-lg", message.fromMe ? "right-0" : "left-0")}>
            {EMOJI_OPTIONS.slice(0, 6).map((emoji) => (
              <button
                key={`${message.id}-${emoji}`}
                type="button"
                onClick={() => onReact(message.id, emoji)}
                className={cn("rounded-full px-1.5 py-0.5 text-sm transition-colors", reaction === emoji ? "bg-primary/15" : "hover:bg-muted")}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

type ConversationRowData = {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  leadByConversationId: Record<string, LeadIntentResult>;
};

function ConversationRow(props: RowComponentProps<ConversationRowData>) {
  const { index, style, ...rowProps } = props;
  const { conversations, selectedId, onSelect, leadByConversationId } = rowProps as ConversationRowData;
  const conversation = conversations[index];
  if (!conversation) return null;
  const leadMeta = getLeadTemperatureMeta(leadByConversationId[conversation.id]);

  return (
    <div style={style} className="px-1">
      <button type="button" onClick={() => onSelect(conversation.id)} className={cn("inbox-message w-full text-left", MOBILE_TOUCH_TARGET_CLASS, "md:h-auto md:min-h-0", normalizeId(selectedId) === normalizeId(conversation.id) && "inbox-message-active")}>
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            {conversation.avatar ? <AvatarImage src={conversation.avatar} alt={conversation.contactName} loading="lazy" /> : null}
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">{getInitials(conversation.contactName)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate font-medium">{conversation.contactName}</h4>
            <span className="shrink-0 text-xs text-muted-foreground">{formatTime(conversation.updatedAt)}</span>
          </div>

          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            {inferConversationMessageType(conversation) === "image" && <ImageSquare className="h-3.5 w-3.5 shrink-0" />}
            {inferConversationMessageType(conversation) === "video" && <VideoCamera className="h-3.5 w-3.5 shrink-0" />}
            {inferConversationMessageType(conversation) === "audio" && <Microphone className="h-3.5 w-3.5 shrink-0" />}
            {inferConversationMessageType(conversation) === "file" && <Paperclip className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{conversation.lastMessage || "Sem mensagens"}</span>
          </p>

          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Badge variant="secondary" className="h-5 text-[10px]">
              {leadMeta.badge}
            </Badge>
            {(conversation.unread ?? 0) > 0 && (
              <Badge className="h-5 min-w-5 rounded-full px-1.5 text-xs text-primary-foreground">{conversation.unread}</Badge>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

const EMPTY_MESSAGES_ARRAY: ChatMessage[] = [];

export default function Inbox() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const conversations = useAppStore((state) => state.conversations);
  const setConversations = useCallback((listOrUpdater: Conversation[] | ((prev: Conversation[]) => Conversation[])) => {
    useAppStore.getState().setConversations(listOrUpdater);
  }, []);

  const selectedConversationId = useAppStore((state) => state.activeConversationId);
  const setSelectedConversationId = useCallback((idOrUpdater: string | null | ((prev: string | null) => string | null)) => {
    const store = useAppStore.getState();
    const next = typeof idOrUpdater === "function" ? idOrUpdater(store.activeConversationId) : idOrUpdater;
    store.setActiveConversationId(next);
  }, []);

  const messages = useAppStore((state) => state.messagesByConversationId[selectedConversationId || ""] || EMPTY_MESSAGES_ARRAY);
  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (!selectedConversationId) return;
    const store = useAppStore.getState();
    const current = store.messagesByConversationId[selectedConversationId] || [];
    const next = typeof updater === "function" ? updater(current) : updater;
    store.setMessages(selectedConversationId, next);
  }, [selectedConversationId]);

  const [messageInput, setMessageInput] = useState("");
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [conversationsLoadFailed, setConversationsLoadFailed] = useState(false);
  const [messagesLoadFailed, setMessagesLoadFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const socketUrl = (API_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "")).trim() || null;
  const [isWhatsappConnected, setIsWhatsappConnected] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [pendingBackgroundUpdates, setPendingBackgroundUpdates] = useState(0);
  const [conversationListHeight, setConversationListHeight] = useState(520);
  const [leadInsight, setLeadInsight] = useState<LeadIntentResult | null>(null);
  const [suggestingResponse, setSuggestingResponse] = useState(false);
  const [responseSearchQuery, setResponseSearchQuery] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>(DEFAULT_QUICK_REPLIES);
  const [quickReplyCategory, setQuickReplyCategory] = useState<"all" | QuickReplyItem["category"]>("all");
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<string | null>(null);
  const [editingQuickReplyValue, setEditingQuickReplyValue] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"ai" | "lead" | "qr">("ai");
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("zapai_right_panel_collapsed") === "1";
  });
  const [mobileScreen, setMobileScreen] = useState<"conversations" | "chat">("conversations");
  const [isTabletLayout, setIsTabletLayout] = useState<boolean>(() => window.innerWidth < 1024);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const sessions = useAppStore((state) => state.sessions);
  const setSessions = useCallback((sessionsList: any) => {
    useAppStore.getState().setSessions(sessionsList);
  }, []);
  const [preferredSessionId, setPreferredSessionId] = useState<string | null>(() => localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY));
  const [EmojiPickerComponent, setEmojiPickerComponent] = useState<ComponentType<{ data: unknown; onEmojiSelect: (emoji: { native?: string }) => void; previewPosition: "none"; skinTonePosition: "none"; theme: "light" }> | null>(null);
  const [emojiPickerData, setEmojiPickerData] = useState<unknown>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const typingByConversationId = useAppStore((state) => state.typingUsers);
  const [unseenRealtimeCount, setUnseenRealtimeCount] = useState(0);
  const [conversationControls, setConversationControls] = useState<Record<string, ConversationControl>>({});
  const [updatingAiToggle, setUpdatingAiToggle] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [previewMedia, setPreviewMedia] = useState<PreviewMediaState | null>(null);
  const [archivedChatIds, setArchivedChatIds] = useState<string[]>(() => {
    const parsed = parseJsonStorage<string[]>(ARCHIVED_CHATS_STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const touchStartXRef = useRef<number | null>(null);
  const autoScrollRef = useRef(true);
  const selectedConversationRef = useRef<Conversation | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const contactDirectoryRef = useRef<ContactDirectory>(loadContactDirectory());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const summaryBusyRef = useRef(false);
  const activeMessageRequestRef = useRef<Map<string, number>>(new Map());
  const messageCacheRef = useRef<Map<string, MessageCacheEntry>>(new Map());
  const messageIdsRef = useRef<Set<string>>(new Set());
  const pendingOutgoingTempIdsRef = useRef<Map<string, string[]>>(new Map());
  const pendingSendFallbackTimersRef = useRef<Map<string, number>>(new Map());
  const isProcessingRealtimeRef = useRef(false);
  const lastRealtimeTimestampRef = useRef(0);
  const fallbackSyncBusyRef = useRef(false);
  const lastSocketConnectedSyncAtRef = useRef(0);
  const lastForceReconnectAtRef = useRef(0);
  const lastBackgroundHydrateAtRef = useRef(0);
  const preferredSessionIdRef = useRef<string | null>(preferredSessionId);
  const loadConversationMessagesRef = useRef<(conversationId: string, options?: { force?: boolean; background?: boolean }) => Promise<void>>(
    async () => undefined,
  );
  const initialLoadStartedRef = useRef(false);
  const errorToastThrottleRef = useRef<Map<string, number>>(new Map());
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudioMessageId, setPlayingAudioMessageId] = useState<string | null>(null);
  const [loadingAudioMessageId, setLoadingAudioMessageId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const clearPendingFallbackTimersForTempId = useCallback((tempId: string) => {
    pendingSendFallbackTimersRef.current.forEach((timerId, timerKey) => {
      if (!timerKey.includes(tempId)) return;
      window.clearTimeout(timerId);
      pendingSendFallbackTimersRef.current.delete(timerKey);
    });
  }, []);

  const updateConversationMessageStore = useCallback((conversationId: string, nextMessages: ChatMessage[], hasMore: boolean) => {
    const normalizedConversationId = String(conversationId);
    const linkedConversation =
      conversationsRef.current.find((item) => String(item.id) === normalizedConversationId) ??
      (String(selectedConversationRef.current?.id ?? "") === normalizedConversationId ? selectedConversationRef.current : null);
    const conversationKey = getConversationKey(linkedConversation ?? { id: normalizedConversationId });
    const oldestCursor = nextMessages.length > 0 ? String(nextMessages[0]?.createdAt ?? nextMessages[0]?.timestamp ?? "") || null : null;

    messageCacheRef.current.set(conversationKey, {
      messages: nextMessages,
      hasMore,
      oldestCursor,
      cachedAt: Date.now(),
    });

    persistConversationMessages({
      conversationId: normalizedConversationId,
      sessionId: linkedConversation?.sessionId,
      phone: linkedConversation?.phone,
      messages: nextMessages,
    });
  }, []);

  const rememberContacts = useCallback((nextConversations: Conversation[]) => {
    const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, nextConversations);
    contactDirectoryRef.current = mergedDirectory;
    persistContactDirectory(mergedDirectory);
  }, []);

  const mergeConversationsSnapshot = useCallback((incoming: Conversation[]) => {
    const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, incoming);
    contactDirectoryRef.current = mergedDirectory;
    persistContactDirectory(mergedDirectory);

    setConversations((prev) => dedupeConversationsByScope([...prev, ...incoming], mergedDirectory));
  }, []);

  useEffect(() => {
    if (!conversations.length) return;
    rememberContacts(conversations);
    persistConversations(conversations);
  }, [conversations, rememberContacts]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => normalizeId(conversation.id) === normalizeId(selectedConversationId)) ?? null,
    [conversations, selectedConversationId],
  );
  const selectedConversationKey = useMemo(
    () => (selectedConversation ? getConversationKey(selectedConversation) : null),
    [selectedConversation],
  );

  // Persist right-panel collapsed state
  useEffect(() => {
    try {
      window.localStorage.setItem("zapai_right_panel_collapsed", rightPanelCollapsed ? "1" : "0");
    } catch {}
  }, [rightPanelCollapsed]);

  // Keyboard shortcuts for right panel: Alt+1/2/3 to switch tabs, Alt+B to collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "1") { setRightPanelTab("ai"); setRightPanelCollapsed(false); e.preventDefault(); }
      else if (e.key === "2") { setRightPanelTab("lead"); setRightPanelCollapsed(false); e.preventDefault(); }
      else if (e.key === "3") { setRightPanelTab("qr"); setRightPanelCollapsed(false); e.preventDefault(); }
      else if (e.key.toLowerCase() === "b") { setRightPanelCollapsed((v) => !v); e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const listedSessions = await apiService.listSessions();
      setSessions((prev) => (Array.isArray(listedSessions) ? listedSessions : prev));
      return Array.isArray(listedSessions) ? listedSessions : [];
    } catch {
      return [];
    }
  }, []);

  const activeSession = useMemo(
    () => pickActiveSession(sessions, selectedConversation?.sessionId ?? preferredSessionId),
    [sessions, selectedConversation?.sessionId, preferredSessionId],
  );

  const activeControl = selectedConversation ? conversationControls[selectedConversation.id] : undefined;
  const aiEnabledForConversation = activeControl?.aiEnabled ?? true;

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(
    () => () => {
      pendingSendFallbackTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      pendingSendFallbackTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((message) => message.id));
  }, [messages]);

  useEffect(() => {
    conversationsRef.current = conversations;

    if (selectedConversationId && !conversations.some((item) => normalizeId(item.id) === normalizeId(selectedConversationId))) {
      setSelectedConversationId(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!activeSession?.id) return;
    setPreferredSessionId(activeSession.id);
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSession.id);
  }, [activeSession?.id]);

  useEffect(() => {
    if (!selectedConversation) return;
    const scope = getConversationScope({
      phone: selectedConversation.phone,
      sessionId: selectedConversation.sessionId,
    });
    if (scope) {
      localStorage.setItem(LAST_CHAT_SCOPE_STORAGE_KEY, scope);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessageInput("");
      return;
    }

    setMessageInput(loadDraftFromStorage(selectedConversationId));
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const frame = window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedConversationId, mobileScreen]);

  useEffect(() => {
    if (!selectedConversationId) return;
    saveDraftToStorage(selectedConversationId, messageInput);
  }, [messageInput, selectedConversationId]);

  useEffect(() => {
    const onResize = () => {
      setConversationListHeight(Math.max(360, window.innerHeight - 200));
      setIsTabletLayout(window.innerWidth < 1024);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileScreen("chat");
      return;
    }

    if (!selectedConversationId) {
      setMobileScreen("conversations");
    }
  }, [isMobile, selectedConversationId]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport || !isMobile) {
      setKeyboardOffset(0);
      return;
    }

    const updateKeyboardInset = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardOffset(keyboardHeight);
      if (keyboardHeight > 0 && messagesScrollRef.current) {
        messagesScrollRef.current.scrollTo({ top: messagesScrollRef.current.scrollHeight, behavior: "smooth" });
      }
    };

    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);
    updateKeyboardInset();

    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
    };
  }, [isMobile]);

  useEffect(
    () => () => {
      attachments.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [attachments],
  );

  const showErrorToast = useCallback(
    (title: string) => {
      const now = Date.now();
      const key = title.trim().toLowerCase();
      const lastAt = errorToastThrottleRef.current.get(key) ?? 0;
      if (now - lastAt < 4_000) return;
      errorToastThrottleRef.current.set(key, now);
      toastRef.current({ title, variant: "destructive" });
    },
    [],
  );

  useEffect(() => {
    if (!showEmojiPicker || (EmojiPickerComponent && emojiPickerData)) return;

    let cancelled = false;
    const loadEmojiPicker = async () => {
      try {
        const [{ default: PickerComponent }, { default: pickerData }] = await Promise.all([
          import("@emoji-mart/react"),
          import("@emoji-mart/data"),
        ]);

        if (cancelled) return;
        setEmojiPickerComponent(() => PickerComponent as ComponentType<{ data: unknown; onEmojiSelect: (emoji: { native?: string }) => void; previewPosition: "none"; skinTonePosition: "none"; theme: "light" }>);
        setEmojiPickerData(pickerData);
      } catch {
        if (!cancelled) showErrorToast("Não foi possível carregar emojis.");
      }
    };

    void loadEmojiPicker();

    return () => {
      cancelled = true;
    };
  }, [EmojiPickerComponent, emojiPickerData, showEmojiPicker, showErrorToast]);

  const loadConversationControls = useCallback(async (nextConversations: Conversation[]) => {
    try {
      const controls = await listConversationControls(nextConversations.map((item) => item.id));
      setConversationControls((prev) => ({ ...prev, ...controls }));
    } catch {
      // non-blocking
    }
  }, []);

  const markBackendOffline = useCallback((err: unknown) => {
    console.error("BACKEND OFF:", err);
    setBackendOnline(false);
  }, []);

  const markBackendOnline = useCallback(() => {
    setBackendOnline(true);
  }, []);

  useEffect(() => {
    if (initialLoadStartedRef.current) return;
    initialLoadStartedRef.current = true;

    const loadInitial = async () => {
      setError(null);
      setLoadingConversations(true);
      setConversationsLoadFailed(false);

      try {
        const [conversationsResult, sessionsResult] = await Promise.allSettled([
          apiService.getConversations(false, { limit: CONVERSATIONS_PAGE_SIZE }),
          refreshSessions(),
        ]);

        if (conversationsResult.status !== "fulfilled") {
          throw conversationsResult.reason;
        }

        const conversationsData = conversationsResult.value;
        const sessionsData = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
        const persistedConversations = loadPersistedConversations();
        const combinedConversations = [...persistedConversations, ...conversationsData];
        const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, combinedConversations);
        contactDirectoryRef.current = mergedDirectory;
        persistContactDirectory(mergedDirectory);

        const normalizedConversations = dedupeConversationsByScope(combinedConversations, mergedDirectory);
        setConversations(normalizedConversations);
        markBackendOnline();
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
        setSelectedConversationId((currentId) => {
          if (currentId && normalizedConversations.some((conversation) => normalizeId(conversation.id) === normalizeId(currentId))) {
            return normalizeId(currentId);
          }
          const lastScope = localStorage.getItem(LAST_CHAT_SCOPE_STORAGE_KEY);
          if (lastScope) {
            const match = normalizedConversations.find(
              (conversation) => getConversationScope({ phone: conversation.phone, sessionId: conversation.sessionId }) === lastScope,
            );
            if (match) return normalizeId(match.id);
          }
          return normalizeId(normalizedConversations[0]?.id) || null;
        });
        await loadConversationControls(normalizedConversations);
        setConversationsLoadFailed(false);
      } catch (err) {
        markBackendOffline(err);
        setConversationsLoadFailed(true);
        const message = "Não foi possível atualizar as conversas. Verifique backend e banco de dados local; os últimos dados em tela serão mantidos quando disponíveis.";
        setError(message);
        showErrorToast(message);
      } finally {
        setLoadingConversations(false);
      }
    };

    void loadInitial();
  }, [loadConversationControls, markBackendOffline, markBackendOnline, showErrorToast]);


  const hydrateConversationHistoryForAnalysis = useCallback(async (conversationId: string, seedMessages: ChatMessage[]) => {
    if (!seedMessages.length) return;

    const normalizedConversationId = String(conversationId);
    let merged = seedMessages;
    let before = seedMessages[0]?.createdAt;

    for (let page = 0; page < 2; page += 1) {
      if (!before) break;

      const olderBatch = await apiService.getMessages(conversationId, {
        limit: MESSAGE_PAGE_SIZE,
        before,
      });

      if (!olderBatch.length) break;

      const normalizedBatch = olderBatch
        .map((item) => ({ ...item, conversationId: item.conversationId ?? normalizedConversationId }))
        .filter((item) => String(item.conversationId ?? "") === normalizedConversationId);

      if (!normalizedBatch.length) break;

      merged = sortMessagesAsc(mergeMessagesById(merged, normalizedBatch));
      before = normalizedBatch[0]?.createdAt;

      if (olderBatch.length < MESSAGE_PAGE_SIZE) break;
    }

    updateConversationMessageStore(conversationId, merged, merged.length >= MESSAGE_PAGE_SIZE);

    if (String(selectedConversationRef.current?.id ?? "") === normalizedConversationId) {
      setMessages(merged);
    }
  }, [updateConversationMessageStore]);

  const loadConversationMessages = useCallback(
    async (conversationId: string, options?: { force?: boolean; background?: boolean }) => {
      const normalizedConversationId = String(conversationId);
      const conversationMeta =
        conversationsRef.current.find((item) => normalizeId(item.id) === normalizeId(normalizedConversationId)) ??
        (normalizeId(selectedConversationRef.current?.id) === normalizeId(normalizedConversationId) ? selectedConversationRef.current : null);
      const conversationKey = getConversationKey(conversationMeta ?? { id: normalizedConversationId });
      const cached = messageCacheRef.current.get(conversationKey);
      const persisted = loadPersistedConversationMessages({
        conversationId: normalizedConversationId,
        sessionId: conversationMeta?.sessionId,
        phone: conversationMeta?.phone,
      })
        .map((item, index) => normalizeLoadedMessage(item, normalizedConversationId, index))
        .filter((item) => normalizeId(item.conversationId) === normalizeId(normalizedConversationId));

      if (!options?.force && cached && Date.now() - cached.cachedAt < MESSAGE_CACHE_TTL_MS) {
        if (normalizeId(selectedConversationRef.current?.id) === normalizeId(normalizedConversationId)) {
          setMessages(cached.messages);
          setHasMoreMessages(cached.hasMore);
        }
        return;
      }

      if (!cached && persisted.length > 0) {
        const sortedPersisted = sortMessagesAsc(persisted);
        if (normalizeId(selectedConversationRef.current?.id) === normalizeId(normalizedConversationId)) {
          setMessages(sortedPersisted);
          setHasMoreMessages(sortedPersisted.length >= MESSAGE_PAGE_SIZE);
        }
        updateConversationMessageStore(normalizedConversationId, sortedPersisted, sortedPersisted.length >= MESSAGE_PAGE_SIZE);
      }

      const requestId = Date.now();
      activeMessageRequestRef.current.set(normalizedConversationId, requestId);
      const shouldShowLoading = !options?.background && !(cached?.messages.length || persisted.length);
      if (shouldShowLoading) {
        setLoadingMessages(true);
      }
      setMessagesLoadFailed(false);
      setError(null);

      try {
        const data = await apiService.getMessages(normalizedConversationId, { limit: MESSAGE_PAGE_SIZE });
        markBackendOnline();
        if (activeMessageRequestRef.current.get(normalizedConversationId) !== requestId) return;

        const normalizedData = Array.isArray(data)
          ? data.map((item, index) => normalizeLoadedMessage(item, normalizedConversationId, index))
          : [];

        const sorted = sortMessagesAsc(
          normalizedData.filter((item) => normalizeId(item.conversationId) === normalizeId(normalizedConversationId)),
        );
        const mergedWithCache = sortMessagesAsc(mergeMessagesById(cached?.messages ?? persisted, sorted));
        const hasMore = normalizedData.length >= MESSAGE_PAGE_SIZE;

        const isSelectedConversation = normalizeId(selectedConversationRef.current?.id) === normalizeId(normalizedConversationId);
        if (options?.background) {
          updateConversationMessageStore(normalizedConversationId, mergedWithCache, hasMore);

          if (isSelectedConversation) {
            const incomingCount = countNewMessageEntries(messagesRef.current, mergedWithCache);
            if (incomingCount > 0) {
              setPendingBackgroundUpdates((prev) => Math.max(prev, incomingCount));
            }
          }

          void hydrateConversationHistoryForAnalysis(normalizedConversationId, sorted);
          return;
        }

        if (normalizeId(selectedConversationRef.current?.id) === normalizeId(normalizedConversationId)) {
          setMessages((prev) => {
            if (!Array.isArray(data)) return prev;
            return mergedWithCache;
          });
          setHasMoreMessages(hasMore);
          setPendingBackgroundUpdates(0);
          setMessagesLoadFailed(false);
        }
        updateConversationMessageStore(normalizedConversationId, mergedWithCache, hasMore);

        void hydrateConversationHistoryForAnalysis(normalizedConversationId, sorted);
      } catch (err) {
        markBackendOffline(err);
        if (activeMessageRequestRef.current.get(normalizedConversationId) !== requestId) return;
        setMessagesLoadFailed(true);
        const message = "Falha ao carregar mensagens agora. Você pode tentar novamente.";
        setError(message);
        showErrorToast(message);
      } finally {
        if (activeMessageRequestRef.current.get(normalizedConversationId) === requestId) {
          activeMessageRequestRef.current.delete(normalizedConversationId);
          setLoadingMessages(false);
        }
      }
    },
    [hydrateConversationHistoryForAnalysis, markBackendOffline, markBackendOnline, showErrorToast, updateConversationMessageStore],
  );

  useEffect(() => {
    preferredSessionIdRef.current = preferredSessionId;
  }, [preferredSessionId]);

  useEffect(() => {
    loadConversationMessagesRef.current = loadConversationMessages;
  }, [loadConversationMessages]);

  useEffect(() => {
    if (!selectedConversation?.id) {
      setMessages([]);
      setHasMoreMessages(false);
      setPendingBackgroundUpdates(0);
      setUnseenRealtimeCount(0);
      setReplyingTo(null);
      messageIdsRef.current = new Set();
      return;
    }

    // Instead of clearing to [], try to hydrate from cache/persisted immediately
    const normalizedId = String(selectedConversation.id);
    const cached = messageCacheRef.current.get(getConversationKey(selectedConversation));
    if (cached && cached.messages.length > 0) {
      setMessages(cached.messages);
      setHasMoreMessages(cached.hasMore);
      messageIdsRef.current = new Set(cached.messages.map((m) => m.id));
    } else {
      const persisted = loadPersistedConversationMessages({
        conversationId: normalizedId,
        sessionId: selectedConversation.sessionId,
        phone: selectedConversation.phone,
      })
        .map((item, index) => normalizeLoadedMessage(item, normalizedId, index))
        .filter((item) => normalizeId(item.conversationId) === normalizeId(normalizedId));

      if (persisted.length > 0) {
        const sorted = sortMessagesAsc(persisted);
        setMessages(sorted);
        setHasMoreMessages(sorted.length >= MESSAGE_PAGE_SIZE);
        messageIdsRef.current = new Set(sorted.map((m) => m.id));
      } else {
        setMessages([]);
        setHasMoreMessages(false);
        setLoadingMessages(true);
        messageIdsRef.current = new Set();
      }
    }

    // Bug 3 fix: always reset auto-scroll when switching conversations
    autoScrollRef.current = true;
    // Bug 4 fix: clear loading if we hydrated from cache/persisted above
    setLoadingMessages(false);
    setPendingBackgroundUpdates(0);
    setUnseenRealtimeCount(0);
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId(null);
    setReplyingTo(null);
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    if (isRealtimeConnected) return;
    let isMounted = true;
    let isPolling = false;

    const pollMessages = async () => {
      if (!isMounted || isPolling) return;
      const activeId = String(selectedConversationRef.current?.id ?? "");
      if (activeId && activeMessageRequestRef.current.has(activeId)) return;
      isPolling = true;
      try {
        await loadConversationMessagesRef.current(selectedConversation.id, { force: true });
      } catch {
        // handled inside loadConversationMessages
      } finally {
        isPolling = false;
      }
    };

    void pollMessages();
    const intervalId = window.setInterval(() => {
      void pollMessages();
    }, OFFLINE_MESSAGE_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isRealtimeConnected, selectedConversation?.id]);

  const applyPendingBackgroundUpdates = useCallback(async () => {
    if (!selectedConversation?.id) return;
    setPendingBackgroundUpdates(0);
    await loadConversationMessages(selectedConversation.id, { force: true });
  }, [loadConversationMessages, selectedConversation?.id]);

  const handleRetryConversations = useCallback(async () => {
    setLoadingConversations(true);
    setConversationsLoadFailed(false);
    try {
      const latestConversations = await apiService.getConversations(true, { limit: CONVERSATIONS_PAGE_SIZE });
      markBackendOnline();
      mergeConversationsSnapshot(latestConversations);
      setError(null);
    } catch {
      markBackendOffline("retry_conversations_failed");
      const message = "Ainda sem conexão com o backend. Tente novamente em instantes.";
      setConversationsLoadFailed(true);
      setError(message);
      showErrorToast(message);
    } finally {
      setLoadingConversations(false);
    }
  }, [markBackendOffline, markBackendOnline, mergeConversationsSnapshot, showErrorToast]);

  const handleRetryMessages = useCallback(async () => {
    if (!selectedConversation?.id) return;
    setMessagesLoadFailed(false);
    await loadConversationMessages(selectedConversation.id, { force: true });
  }, [loadConversationMessages, selectedConversation?.id]);

  const handleLoadOlderMessages = useCallback(async () => {
    if (!selectedConversation?.id || !messages.length || loadingOlderMessages || !hasMoreMessages) return;

    setLoadingOlderMessages(true);
    try {
      const cacheKey = selectedConversation ? getConversationKey(selectedConversation) : null;
      const before = (cacheKey ? messageCacheRef.current.get(cacheKey)?.oldestCursor : null) || messages[0]?.createdAt;
      const olderBatch = await apiService.getMessages(selectedConversation.id, {
        limit: MESSAGE_PAGE_SIZE,
        before,
      });

      const normalizedOlderBatch = Array.isArray(olderBatch)
        ? olderBatch.map((item, index) => normalizeLoadedMessage(item, String(selectedConversation.id), index))
        : [];

      const nextHasMore = normalizedOlderBatch.length >= MESSAGE_PAGE_SIZE;
        const normalizedConversationId = String(selectedConversation.id);
        setMessages((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const merged = [
            ...normalizedOlderBatch
              .filter((item) => !seen.has(item.id) && normalizeId(item.conversationId) === normalizeId(normalizedConversationId)),
            ...prev,
          ];
          const sorted = sortMessagesAsc(merged);
          updateConversationMessageStore(selectedConversation.id, sorted, nextHasMore);
        return sorted;
      });

      setHasMoreMessages(nextHasMore);
    } catch (err) {
      markBackendOffline(err);
      const message = err instanceof Error ? err.message : "Erro ao carregar mensagens antigas";
      setError(message);
      showErrorToast(message);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [selectedConversation?.id, messages, loadingOlderMessages, hasMoreMessages, markBackendOffline, showErrorToast, updateConversationMessageStore]);


  useEffect(() => {
    const root = messagesScrollRef.current?.closest("[data-radix-scroll-area-root]");
    const viewport = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) return;

    (viewport.style as CSSStyleDeclaration & { WebkitOverflowScrolling?: string }).WebkitOverflowScrolling = "touch";

    const onScroll = () => {
      autoScrollRef.current = isViewportNearBottom(viewport);
      if (autoScrollRef.current) setUnseenRealtimeCount(0);
      if (activeMessageMenuId || activeReactionPickerMessageId) {
        setActiveMessageMenuId(null);
        setActiveReactionPickerMessageId(null);
      }
      if (viewport.scrollTop <= 40 && hasMoreMessages && !loadingOlderMessages) {
        void handleLoadOlderMessages();
      }
    };

    autoScrollRef.current = isViewportNearBottom(viewport);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [activeMessageMenuId, activeReactionPickerMessageId, handleLoadOlderMessages, hasMoreMessages, loadingOlderMessages, selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id || !hasMoreMessages || loadingOlderMessages) return;

    const root = messagesScrollRef.current?.closest("[data-radix-scroll-area-root]");
    const viewport = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    const sentinel = loadMoreTriggerRef.current;
    if (!viewport || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void handleLoadOlderMessages();
        }
      },
      {
        root: viewport,
        threshold: 0.01,
        rootMargin: "120px 0px 0px 0px",
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadOlderMessages, hasMoreMessages, loadingOlderMessages, selectedConversation?.id]);

  useEffect(() => {
    // Bug 2 fix: defer scroll to next animation frame so React has time to render
    // the messages before we measure scrollHeight.
    const frameId = window.requestAnimationFrame(() => {
      const root = messagesScrollRef.current?.closest("[data-radix-scroll-area-root]");
      const viewport = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
      if (!viewport) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
      autoScrollRef.current = true;
      setUnseenRealtimeCount(0);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-emoji-picker]") || target.closest("[data-emoji-trigger]")) return;
      setShowEmojiPicker(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showEmojiPicker]);

  const scrollToLatestMessage = useCallback(() => {
    const root = messagesScrollRef.current?.closest("[data-radix-scroll-area-root]");
    const viewport = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    autoScrollRef.current = true;
    setUnseenRealtimeCount(0);
  }, []);

  const analyzeCurrentConversation = useCallback(async () => {
    if (!selectedConversation || messages.length === 0) return;

    const history = messages.slice(-20).map((message) => ({
      role: message.fromMe ? ("assistant" as const) : ("user" as const),
      content: message.content,
    }));

    const lastCustomerMessage = [...messages].reverse().find((message) => !message.fromMe)?.content ?? "";
    const lead = analyzeLeadIntent(lastCustomerMessage, history.map((item) => item.content));
    setLeadInsight(lead);

    try {
      await saveLeadTemperature(selectedConversation.id, lead);
    } catch {
      // non-blocking
    }
  }, [messages, selectedConversation]);

  useEffect(() => {
    void analyzeCurrentConversation();
  }, [analyzeCurrentConversation]);

  useEffect(() => {
    if (!selectedConversation || messages.length < 5) return;
    if (summaryBusyRef.current) return;

    const alreadySummarized = conversationControls[selectedConversation.id]?.summarizedMessageCount ?? 0;
    if (messages.length - alreadySummarized < 5) return;

    summaryBusyRef.current = true;

    const run = async () => {
      try {
        const history = messages.slice(-30).map((message) => ({
          role: message.fromMe ? ("assistant" as const) : ("user" as const),
          content: message.content || (message.mediaType ? `[${message.mediaType}]` : ""),
        }));

        const analysis = await analyzeConversation(selectedConversation.id, history);
        const nextControl = await upsertConversationControl({
          conversationId: selectedConversation.id,
          summary: analysis.summary,
          summarizedMessageCount: messages.length,
          aiEnabled: conversationControls[selectedConversation.id]?.aiEnabled ?? true,
        });

        setConversationControls((prev) => ({ ...prev, [nextControl.conversationId]: nextControl }));
      } catch {
        // non-blocking
      } finally {
        summaryBusyRef.current = false;
      }
    };

    void run();
  }, [conversationControls, messages, selectedConversation]);

  const globalWebsocketHealth = useAppStore((state) => state.websocketHealth);

  useEffect(() => {
    setIsRealtimeConnected(globalWebsocketHealth === "online");
    setBackendOnline(globalWebsocketHealth !== "offline");
    if (globalWebsocketHealth === "offline") {
      setError("Realtime: Socket desconectado do backend.");
    } else {
      setError(null);
    }
  }, [globalWebsocketHealth]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (isRealtimeConnected) return;
      if (fallbackSyncBusyRef.current) return;
      const activeId = String(selectedConversationRef.current?.id ?? "");
      if (activeId && activeMessageRequestRef.current.has(activeId)) return;
      // Do not poll when tab is hidden — no visible user, no need for fresh data
      if (document.hidden) return;

      void (async () => {
        fallbackSyncBusyRef.current = true;
        try {
          const sessionStatus = await apiService.getSessionStatus();
          setIsWhatsappConnected(Boolean(sessionStatus.connected));
          setBackendOnline(true);

          const selectedId = selectedConversationRef.current?.id;
          if (selectedId) await loadConversationMessagesRef.current(String(selectedId), { background: true, force: true });
        } catch (err) {
          markBackendOffline(err);
          setIsWhatsappConnected(false);
        } finally {
          fallbackSyncBusyRef.current = false;
        }
      })();
    }, OFFLINE_FALLBACK_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isRealtimeConnected, loadConversationMessages, markBackendOffline]);

  useEffect(() => {
    const handleRuntimeReconnected = () => {
      const now = Date.now();
      if (isRealtimeConnected) return;
      if (now - lastForceReconnectAtRef.current < SOCKET_FORCE_RECONNECT_DEBOUNCE_MS) return;
      lastForceReconnectAtRef.current = now;
      forceReconnectInboxSocket();
    };

    window.addEventListener(RUNTIME_RECONNECTED_EVENT, handleRuntimeReconnected);
    return () => window.removeEventListener(RUNTIME_RECONNECTED_EVENT, handleRuntimeReconnected);
  }, [isRealtimeConnected]);

  useEffect(() => {
    publishInboxUnreadTotal(getInboxUnreadTotal(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(ARCHIVED_CHATS_STORAGE_KEY, JSON.stringify(archivedChatIds));
  }, [archivedChatIds]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const archivedSet = new Set(archivedChatIds);

    return conversations
      .filter((conversation) => {
      const isArchived = archivedSet.has(String(conversation.id));
      if (filter === "archived") return isArchived;
      if (isArchived) return false;
      if (filter === "unread" && (conversation.unread ?? 0) <= 0) return false;
      if (filter === "ai" && !(conversationControls[conversation.id]?.aiEnabled ?? true)) return false;
      if (!normalizedSearch) return true;

      return (
        conversation.contactName.toLowerCase().includes(normalizedSearch) ||
        conversation.phone.toLowerCase().includes(normalizedSearch) ||
        conversation.lastMessage.toLowerCase().includes(normalizedSearch)
      );
    })
      .sort((a, b) => normalizeConversationTimestamp(b.updatedAt) - normalizeConversationTimestamp(a.updatedAt));
  }, [archivedChatIds, conversations, conversationControls, filter, searchQuery]);

  const selectedConversationMessages = useMemo(
    () => messages.filter((message) => normalizeId(message.conversationId) === normalizeId(selectedConversation?.id)),
    [messages, selectedConversation?.id],
  );

  const messageGroups = useMemo(() => {
    const groups = new Map<string, ChatMessage[]>();
    selectedConversationMessages.forEach((message) => {
      const key = toConversationDateLabel(message.createdAt);
      const previous = groups.get(key) ?? [];
      groups.set(key, [...previous, message]);
    });

    return [...groups.entries()].map(([label, entries]) => ({ label, entries }));
  }, [selectedConversationMessages]);

  const leadByConversationId = useMemo<Record<string, LeadIntentResult>>(() => {
    const entries = conversations.map((conversation) => {
      const cached = conversationControls[conversation.id];
      const sourceText = cached?.summary || conversation.lastMessage || "";
      return [conversation.id, analyzeLeadIntent(sourceText, [sourceText])];
    });

    return Object.fromEntries(entries);
  }, [conversations, conversationControls]);

  const lovableInboxViewModel = createInboxLovableViewModel({
    conversations,
    selectedConversation,
    messages: selectedConversationMessages,
  });

  const selectedLead = useMemo(() => {
    if (!selectedConversation) return null;
    return leadInsight ?? leadByConversationId[selectedConversation.id] ?? null;
  }, [leadInsight, leadByConversationId, selectedConversation]);

  const selectedLeadMeta = getLeadTemperatureMeta(selectedLead);

  const filteredQuickReplies = useMemo(() => {
    const query = responseSearchQuery.trim().toLowerCase();
    return quickReplies.filter((item) => {
      const categoryMatches = quickReplyCategory === "all" || item.category === quickReplyCategory;
      if (!categoryMatches) return false;
      if (!query) return true;
      return item.text.toLowerCase().includes(query);
    });
  }, [quickReplies, quickReplyCategory, responseSearchQuery]);

  const slashSuggestions = useMemo(() => {
    if (!messageInput.startsWith("/")) return [] as string[];
    const needle = messageInput.slice(1).toLowerCase();
    return quickReplies.map((item) => item.text).filter((item) => item.toLowerCase().includes(needle));
  }, [messageInput, quickReplies]);

  const conversationRowData = useMemo(
    () => ({
      conversations: filteredConversations,
      selectedId: selectedConversation?.id ?? null,
      onSelect: (id: string) => {
        const normalizedId = normalizeId(id);
        setSelectedConversationId(normalizedId);
        void loadConversationMessages(normalizedId, { force: true });
        if (isMobile) setMobileScreen("chat");
        window.requestAnimationFrame(() => messageInputRef.current?.focus());
        useAppStore.getState().updateConversationRealtime({
          id: normalizedId,
          unread: 0,
        });
      },
      leadByConversationId,
    }),
    [filteredConversations, isMobile, loadConversationMessages, selectedConversation?.id, leadByConversationId],
  );

  const addFilesToComposer = useCallback((files: File[]) => {
    const mapped = files.map<ComposerAttachment>((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      mediaType: detectMediaType(file),
      previewUrl: URL.createObjectURL(file),
    }));

    setAttachments((prev) => [...prev, ...mapped]);
  }, []);

  const handleAttachFiles = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    addFilesToComposer(files);
    event.target.value = "";
  }, [addFilesToComposer]);

  const clearMessageActionState = useCallback(() => {
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId(null);
    setReplyingTo(null);
  }, []);

  const handleInsertEmoji = useCallback((emoji: { native?: string }) => {
    if (!emoji.native) return;
    setMessageInput((prev) => `${prev}${emoji.native}`);
    setShowEmojiPicker(false);
  }, []);

  const handleCopyMessage = useCallback((message: ChatMessage) => {
    const value = getMessageDisplayContent(message as ChatMessage & { text?: string; body?: string; message?: string; caption?: string }).trim();
    if (!value) return;
    void navigator.clipboard.writeText(value);
    toast({ title: "Mensagem copiada" });
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId(null);
  }, [toast]);

  const handleReplyMessage = useCallback((message: ChatMessage) => {
    setReplyingTo(message);
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId(null);
    window.requestAnimationFrame(() => messageInputRef.current?.focus());
  }, []);

  const handleForwardMessage = useCallback((message: ChatMessage) => {
    const value = getMessageDisplayContent(message as ChatMessage & { text?: string; body?: string; message?: string; caption?: string }).trim();
    setMessageInput(value ? `Encaminhar: ${value}` : "Encaminhar: ");
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId(null);
    window.requestAnimationFrame(() => messageInputRef.current?.focus());
  }, []);

  const handleReactMessage = useCallback((messageId: string, emoji: string) => {
    setMessageReactions((prev) => ({ ...prev, [messageId]: emoji }));
    setActiveReactionPickerMessageId(null);
    setActiveMessageMenuId(null);
  }, []);

  const handleToggleMessageMenu = useCallback((messageId: string) => {
    setActiveReactionPickerMessageId(null);
    setActiveMessageMenuId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleToggleReactionPicker = useCallback((messageId: string) => {
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId((prev) => (prev === messageId ? null : messageId));
  }, []);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const root = messagesScrollRef.current;
      const input = messageInputRef.current;
      const target = event.target as Node | null;
      if (target && (root?.contains(target) || input?.contains(target))) {
        return;
      }
      setActiveMessageMenuId(null);
      setActiveReactionPickerMessageId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActiveMessageMenuId(null);
      setActiveReactionPickerMessageId(null);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleToggleAudioPlayback = useCallback((messageId: string, url: string) => {
    if (!url) return;

    if (audioPlayerRef.current && playingAudioMessageId === messageId) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
      setPlayingAudioMessageId(null);
      setLoadingAudioMessageId(null);
      setAudioProgress(0);
      setAudioDuration(0);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }

    setLoadingAudioMessageId(messageId);
    setAudioProgress(0);
    setAudioDuration(0);

    const audio = new Audio(url);
    audio.preload = "auto";
    audioPlayerRef.current = audio;

    audio.addEventListener(
      "loadedmetadata",
      () => {
        setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      },
      { once: true },
    );

    audio.addEventListener(
      "canplaythrough",
      () => {
        setLoadingAudioMessageId(null);
      },
      { once: true },
    );

    audio.addEventListener("timeupdate", () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (duration <= 0) {
        setAudioProgress(0);
        return;
      }
      setAudioProgress(audio.currentTime / duration);
      setAudioDuration(duration);
    });

    audio.addEventListener("ended", () => {
      setPlayingAudioMessageId(null);
      setLoadingAudioMessageId(null);
      setAudioProgress(0);
      audioPlayerRef.current = null;
    });

    audio.addEventListener(
      "error",
      () => {
        setPlayingAudioMessageId(null);
        setLoadingAudioMessageId(null);
        setAudioProgress(0);
        setAudioDuration(0);
        audioPlayerRef.current = null;
        showErrorToast("Não foi possível reproduzir este áudio.");
      },
      { once: true },
    );

    void audio
      .play()
      .then(() => {
        setPlayingAudioMessageId(messageId);
      })
      .catch(() => {
        setLoadingAudioMessageId(null);
        setPlayingAudioMessageId(null);
        audioPlayerRef.current = null;
        showErrorToast("Falha ao iniciar o áudio.");
      });
  }, [playingAudioMessageId, showErrorToast]);

  useEffect(() => {
    return () => {
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = null;
    };
  }, []);

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => {
      const found = prev.find((item) => item.id === attachmentId);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((item) => item.id !== attachmentId);
    });
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (!files.length) return;
    addFilesToComposer(files);
  }, [addFilesToComposer]);

  const handleChatTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleChatTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile || touchStartXRef.current === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? 0) - touchStartXRef.current;
    touchStartXRef.current = null;

    if (deltaX > 72) {
      setShowLeadPanel(true);
      return;
    }

    if (deltaX < -72) {
      setMobileScreen("conversations");
    }
  }, [isMobile]);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        addFilesToComposer([file]);
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      showErrorToast("Permissão de microfone não concedida.");
    }
  }, [addFilesToComposer, isRecording, showErrorToast]);

  const handleSendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? messageInput).trim();
    const replyExcerpt = (replyingTo?.caption ?? replyingTo?.content ?? "").trim();
    const textWithReply = replyingTo && replyExcerpt ? `↩ ${replyExcerpt}\n${text}`.trim() : text;
    if (!selectedConversation?.phone || (!textWithReply && attachments.length === 0) || sending) return;
    if (!backendOnline) {
      setError("Servidor reconectando... envio temporariamente indisponível.");
      return;
    }
    if (!isWhatsappConnected) {
      setError("WHATSAPP_OFFLINE");
      showErrorToast("WhatsApp offline. Aguarde reconexão para enviar mensagens.");
      return;
    }

    setSending(true);
    setError(null);

    const now = new Date().toISOString();
    const pendingTempIds = new Set<string>();

    try {
      const safeSessions = Array.isArray(sessions) ? sessions : [];
      const latestSessions = safeSessions.length > 0 ? safeSessions : await refreshSessions();
      const resolvedActiveSession = pickActiveSession(
        latestSessions,
        selectedConversation.sessionId ?? preferredSessionId,
      );
      const fallbackSession =
        (Array.isArray(latestSessions) ? latestSessions : []).find((session) => session && session.id === (selectedConversation.sessionId ?? preferredSessionId)) ??
        (Array.isArray(latestSessions) ? latestSessions[0] : null) ??
        null;
      const targetSession = resolvedActiveSession ?? fallbackSession;

      if (!targetSession?.id) {
        showErrorToast("Nenhuma sessão disponível para envio. Ative uma sessão do WhatsApp e tente novamente.");
        return;
      }

      const conversationSession = selectedConversation.sessionId
        ? latestSessions.find((session) => session.id === selectedConversation.sessionId)
        : null;
      const sessionIdToSend = conversationSession && isSessionActive(conversationSession)
        ? conversationSession.id
        : targetSession.id;

      if (!resolvedActiveSession) {
        notify.warning("Sessão não sinalizou como conectada; tentando envio com fallback.");
      }

      setPreferredSessionId(sessionIdToSend);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionIdToSend);

      const optimisticMessages: ChatMessage[] = attachments.length
        ? attachments.map((attachment, index) => {
            const tempId = `temp-media-${Date.now()}-${index}`;
            pendingTempIds.add(tempId);
            return {
              id: tempId,
              conversationId: selectedConversation.id,
              content: index === 0 ? textWithReply : "",
              fromMe: true,
              createdAt: now,
              status: "sending",
              mediaType: attachment.mediaType,
              url: attachment.previewUrl,
            };
          })
        : [
            (() => {
              const tempId = `temp-${Date.now()}`;
              pendingTempIds.add(tempId);
              return {
                id: tempId,
                conversationId: selectedConversation.id,
                content: textWithReply,
                fromMe: true,
                createdAt: now,
                status: "sending" as const,
              };
            })(),
          ];

      setMessages((prev) => {
        const next = sortMessagesAsc([...prev, ...optimisticMessages]);
        updateConversationMessageStore(
          selectedConversation.id,
          next,
          messageCacheRef.current.get(selectedConversation.id)?.hasMore ?? hasMoreMessages,
        );
        return next;
      });

      const pendingQueue = pendingOutgoingTempIdsRef.current.get(selectedConversation.id) ?? [];
      pendingOutgoingTempIdsRef.current.set(
        selectedConversation.id,
        [...pendingQueue, ...optimisticMessages.map((item) => item.id)],
      );

      const optimisticLast = optimisticMessages[optimisticMessages.length - 1];
      setConversations((prev) => {
        const current = prev.find((item) => item.id === selectedConversation.id);
        if (!current) return prev;

        const updated: Conversation = {
          ...current,
          lastMessage: optimisticLast?.content || textWithReply || (attachments[0]?.mediaType ? `[${attachments[0].mediaType}]` : current.lastMessage || ""),
          lastMessageType: optimisticLast?.mediaType ?? attachments[0]?.mediaType ?? "text",
          updatedAt: optimisticLast?.createdAt ?? now,
        };

        return [updated, ...prev.filter((item) => item.id !== selectedConversation.id)];
      });

      for (let i = 0; i < optimisticMessages.length; i += 1) {
        const optimistic = optimisticMessages[i];
        const attachment = attachments[i];

        if (attachment && attachment.file.size > MAX_MEDIA_UPLOAD_BYTES) {
          throw new Error("Arquivo maior que 10MB. Reduza o tamanho e tente novamente.");
        }

        const base64Payload = attachment ? await fileToBase64(attachment.file) : null;
        if (attachment && base64Payload && estimateBase64Bytes(base64Payload) > MAX_MEDIA_UPLOAD_BYTES) {
          throw new Error("Arquivo de mídia muito grande para envio direto (limite de 10MB).");
        }

        const response: MessageSendResponse = attachment
          ? await apiService.sendMediaMessage({
              phone: selectedConversation.phone,
              caption: i === 0 ? textWithReply : "",
              fileName: attachment.file.name,
              mimeType: attachment.file.type || "application/octet-stream",
              mediaType: attachment.mediaType,
              dataBase64: base64Payload ?? "",
              conversationId: selectedConversation.id,
              contactId: selectedConversation.contactId,
              sessionId: sessionIdToSend,
            })
          : await apiService.sendMessage({
              phone: selectedConversation.phone,
              text: textWithReply,
              conversationId: selectedConversation.id,
              contactId: selectedConversation.contactId,
              sessionId: sessionIdToSend,
            });

        if (!response.success) {
          throw new Error(String(response.error ?? "Falha ao enviar mensagem"));
        }

        pendingTempIds.delete(optimistic.id);
        clearPendingFallbackTimersForTempId(optimistic.id);
      }

      pendingTempIds.forEach((tempId) => {
        const fallbackTimerKey = `fallback-${tempId}-500`;
        const fallbackTimerId = window.setTimeout(() => {
          pendingSendFallbackTimersRef.current.delete(fallbackTimerKey);
          const conversationId = selectedConversationRef.current?.id;
          if (!conversationId) return;

          const pendingQueue = pendingOutgoingTempIdsRef.current.get(String(conversationId)) ?? [];
          const isPending = pendingQueue.includes(tempId);
          const tempStillVisible = messagesRef.current.some((message) => message.id === tempId);
          if (!isPending && !tempStillVisible) return;

          void loadConversationMessages(String(conversationId), { force: true });
        }, 500);
        pendingSendFallbackTimersRef.current.set(fallbackTimerKey, fallbackTimerId);
      });

      await loadConversationMessages(selectedConversation.id, { force: true });

      clearDraftFromStorage(selectedConversation.id);
      setMessageInput("");
      setAttachments([]);
      setReplyingTo(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setError(message);
      showErrorToast(message);

      if (pendingTempIds.size > 0) {
        const currentPending = pendingOutgoingTempIdsRef.current.get(selectedConversation.id) ?? [];
        pendingOutgoingTempIdsRef.current.set(
          selectedConversation.id,
          currentPending.filter((id) => !pendingTempIds.has(id)),
        );
        pendingTempIds.forEach((tempId) => {
          clearPendingFallbackTimersForTempId(tempId);
        });
        setMessages((prev) => {
          const next = prev.map((item) => (pendingTempIds.has(item.id) ? { ...item, status: "failed" as const } : item));
          updateConversationMessageStore(
            selectedConversation.id,
            next,
            messageCacheRef.current.get(selectedConversation.id)?.hasMore ?? hasMoreMessages,
          );
          return next;
        });
      }
    } finally {
      setSending(false);
    }
  }, [attachments, backendOnline, clearPendingFallbackTimersForTempId, hasMoreMessages, isWhatsappConnected, loadConversationMessages, messageInput, preferredSessionId, refreshSessions, replyingTo, selectedConversation, sending, sessions, showErrorToast, updateConversationMessageStore]);

  const selectedConversationTyping = useMemo(() => {
    if (!selectedConversation?.id) return false;
    return Boolean(typingByConversationId[selectedConversation.id]) || selectedConversation.status === "typing";
  }, [selectedConversation, typingByConversationId]);

  const selectedConversationStatusLabel = useMemo(() => {
    if (selectedConversationTyping) return "digitando...";
    if (selectedConversation?.status === "online") return "online";
    return "offline";
  }, [selectedConversation?.status, selectedConversationTyping]);

  const handleOpenMediaPreview = useCallback((url: string, type: "image" | "video") => {
    setPreviewMedia({ url, type });
  }, []);

  const handleSuggestResponse = useCallback(async () => {
    if (!selectedConversation || suggestingResponse || !aiEnabledForConversation) return;

    const lastCustomerMessage = [...messages].reverse().find((message) => !message.fromMe)?.content;
    if (!lastCustomerMessage) return;

    setSuggestingResponse(true);

    try {
      const history = messages.slice(-20).map((message) => ({
        role: message.fromMe ? ("assistant" as const) : ("user" as const),
        content: message.content,
      }));

      const lead = leadInsight ?? analyzeLeadIntent(lastCustomerMessage, history.map((item) => item.content));
      const strategy = generateSalesStrategy(lead.lead_temperature, lead.intent);
      const promptData = await apiService.getAIPrompt();

      const optimized = await generateResponse({
        prompt: promptData.prompt ?? "Você é uma assistente comercial focada em fechar vendas com clareza e simpatia.",
        conversationHistory: history,
        customerMessage: lastCustomerMessage,
        leadAnalysis: lead,
        salesStrategy: strategy,
      });

      setMessageInput(optimized.response);
      toast({ title: "Sugestão pronta para envio." });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "AI response unavailable.";
      showErrorToast(message);
    } finally {
      setSuggestingResponse(false);
    }
  }, [aiEnabledForConversation, selectedConversation, suggestingResponse, messages, leadInsight, toast, showErrorToast]);

  const handleSetConversationAiEnabled = useCallback(async (enabled: boolean) => {
    if (!selectedConversation || updatingAiToggle) return;
    setUpdatingAiToggle(true);

    try {
      const updated = await upsertConversationControl({
        conversationId: selectedConversation.id,
        aiEnabled: enabled,
        summary: conversationControls[selectedConversation.id]?.summary,
        summarizedMessageCount: conversationControls[selectedConversation.id]?.summarizedMessageCount,
      });

      setConversationControls((prev) => ({ ...prev, [updated.conversationId]: updated }));
      toast({ title: enabled ? "AI habilitada para esta conversa." : "AI desabilitada para esta conversa." });
    } catch {
      showErrorToast("Não foi possível atualizar o controle de IA.");
    } finally {
      setUpdatingAiToggle(false);
    }
  }, [conversationControls, selectedConversation, showErrorToast, toast, updatingAiToggle]);

  const handleArchiveSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    const chatId = String(selectedConversation.id);
    setArchivedChatIds((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));
    emitInboxSocketEvent("archive_chat", chatId);
    toast({ title: "Conversa arquivada." });
  }, [selectedConversation, toast]);

  const handleUnarchiveSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    const chatId = String(selectedConversation.id);
    setArchivedChatIds((prev) => prev.filter((id) => id !== chatId));
    emitInboxSocketEvent("unarchive_chat", chatId);
    toast({ title: "Conversa desarquivada." });
  }, [selectedConversation, toast]);

  const handleAddTagToSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    const normalizedTag = newTagInput.trim();
    if (!normalizedTag) return;

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, tags: Array.from(new Set([...(conversation.tags ?? []), normalizedTag])) }
          : conversation,
      ),
    );

    emitInboxSocketEvent("add_tag", { chatId: selectedConversation.id, tag: normalizedTag });
    setNewTagInput("");
  }, [newTagInput, selectedConversation]);

  const handleRemoveTagFromSelectedConversation = useCallback((tag: string) => {
    if (!selectedConversation) return;

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, tags: (conversation.tags ?? []).filter((currentTag) => currentTag !== tag) }
          : conversation,
      ),
    );

    emitInboxSocketEvent("remove_tag", { chatId: selectedConversation.id, tag });
  }, [selectedConversation]);

  const sendQuickReply = useCallback(async (text: string) => {
    await handleSendMessage(text);
  }, [handleSendMessage]);

  const startEditingQuickReply = useCallback((reply: QuickReplyItem) => {
    setEditingQuickReplyId(reply.id);
    setEditingQuickReplyValue(reply.text);
  }, []);

  const saveQuickReply = useCallback(() => {
    if (!editingQuickReplyId) return;
    const normalized = editingQuickReplyValue.trim();
    if (!normalized) return;
    setQuickReplies((prev) =>
      prev.map((item) => (item.id === editingQuickReplyId ? { ...item, text: normalized } : item)),
    );
    setEditingQuickReplyId(null);
    setEditingQuickReplyValue("");
  }, [editingQuickReplyId, editingQuickReplyValue]);

  const deleteQuickReply = useCallback((quickReplyId: string) => {
    setQuickReplies((prev) => prev.filter((item) => item.id !== quickReplyId));
    if (editingQuickReplyId === quickReplyId) {
      setEditingQuickReplyId(null);
      setEditingQuickReplyValue("");
    }
  }, [editingQuickReplyId]);

  const toggleFavoriteQuickReply = useCallback((quickReplyId: string) => {
    setQuickReplies((prev) =>
      prev.map((item) => (item.id === quickReplyId ? { ...item, favorite: !item.favorite } : item)),
    );
  }, []);

  const duplicateQuickReply = useCallback((item: QuickReplyItem) => {
    setQuickReplies((prev) => [
      ...prev,
      { ...item, id: `${item.id}-copy-${Date.now()}`, text: `${item.text} (cópia)`, favorite: false },
    ]);
  }, []);

  const quickRepliesByCategory = useMemo(() => {
    const groups: Record<string, QuickReplyItem[]> = {};
    for (const item of filteredQuickReplies) {
      (groups[item.category] ||= []).push(item);
    }
    return groups;
  }, [filteredQuickReplies]);

  const favoriteQuickReplies = useMemo(
    () => filteredQuickReplies.filter((item) => item.favorite),
    [filteredQuickReplies],
  );

  const renderQuickReplyRow = (item: QuickReplyItem) => (
    <div key={item.id} className="group rounded-md border border-border/50 bg-background/30 p-1.5 transition-all hover:border-border hover:bg-background/60 hover:shadow-sm">
      {editingQuickReplyId === item.id ? (
        <div className="space-y-1.5">
          <Input
            value={editingQuickReplyValue}
            onChange={(event) => setEditingQuickReplyValue(event.target.value)}
            className="h-7 text-xs"
            autoFocus
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-[11px]" onClick={saveQuickReply}>Salvar</Button>
            <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => { setEditingQuickReplyId(null); setEditingQuickReplyValue(""); }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="line-clamp-2 text-[11.5px] leading-snug text-foreground/90">{item.text}</p>
          <div className="mt-1.5 flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
            <Button size="sm" className="h-6 flex-1 text-[11px]" onClick={() => void sendQuickReply(item.text)}>
              <PaperPlaneTilt className="mr-1 h-3 w-3" weight="fill" /> Enviar
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleFavoriteQuickReply(item.id)} title="Favoritar">
              <Star className={cn("h-3 w-3", item.favorite ? "text-warning" : "text-muted-foreground")} weight={item.favorite ? "fill" : "regular"} />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditingQuickReply(item)} title="Editar">
              <PencilSimple className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => duplicateQuickReply(item)} title="Duplicar">
              <CopySimple className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteQuickReply(item.id)} title="Excluir">
              <Trash className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const leadPanelContent = selectedConversation ? (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as "ai" | "lead" | "qr")} className="flex h-full w-full flex-col">
        <div className="sticky top-0 z-10 -mx-1 mb-2 bg-card/40 px-1 pb-2 pt-0.5 backdrop-blur supports-[backdrop-filter]:bg-card/30">
          <TabsList className="grid h-9 w-full shrink-0 grid-cols-4 bg-muted/60">
            <TabsTrigger value="ai" className="text-xs transition-all data-[state=active]:shadow-sm" title="IA (Alt+1)">IA</TabsTrigger>
            <TabsTrigger value="lead" className="text-xs transition-all data-[state=active]:shadow-sm" title="Lead (Alt+2)">Lead</TabsTrigger>
            <TabsTrigger value="qr" className="text-xs transition-all data-[state=active]:shadow-sm" title="Quick Replies (Alt+3)">Respostas</TabsTrigger>
            <button type="button" className="text-xs text-muted-foreground">Tags</button>
          </TabsList>
        </div>

        {/* ============ TAB IA ============ */}
        <TabsContent value="ai" className="mt-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin animate-fade-in data-[state=inactive]:hidden">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Análise da IA</p>
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Intent</span>
                <span className="font-medium capitalize">{selectedLead?.intent ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confiança</span>
                <span className="font-medium">{Math.round((selectedLead?.confidence ?? 0) * 100)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Temperatura</span>
                <Badge variant="secondary" className="h-5 text-[10px]">{selectedLeadMeta.label}</Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Suggested replies</p>
            <div className="space-y-1.5">
              {filteredQuickReplies.slice(0, 3).map((reply) => (
                <Button
                  key={reply.id}
                  size="sm"
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-2 text-left text-xs"
                  onClick={() => void sendQuickReply(reply.text)}
                >
                  {reply.text}
                </Button>
              ))}
              {filteredQuickReplies.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem sugestões disponíveis.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Memory</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {activeControl?.summary || "Sem memória consolidada para esta conversa."}
            </p>
            {activeControl?.updatedAt && (
              <p className="mt-2 text-[10px] text-muted-foreground/70">Atualizado às {formatTime(activeControl.updatedAt)}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">IA Automática</p>
                <p className="text-[11px] text-muted-foreground">
                  {aiEnabledForConversation ? "Respondendo automaticamente" : "Atendimento manual"}
                </p>
              </div>
              <Switch
                checked={aiEnabledForConversation}
                onCheckedChange={(checked) => void handleSetConversationAiEnabled(checked)}
                disabled={updatingAiToggle}
              />
            </div>
          </div>
        </TabsContent>

        {/* ============ TAB LEAD ============ */}
        <TabsContent value="lead" className="mt-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin animate-fade-in data-[state=inactive]:hidden">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Dados do Lead</p>
              <Badge variant="secondary" className="h-5 text-[10px]">Ativo</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Nome</span>
                <span className="truncate font-medium">{selectedConversation.contactName}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Telefone</span>
                <span className="truncate font-medium">{selectedConversation.phone || "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Score</span>
                <span className="font-medium">{Math.round((selectedLead?.confidence ?? 0) * 100)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{selectedConversation.status ?? "open"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Origem</span>
                <span className="font-medium">WhatsApp</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Pipeline</span>
                <span className="font-medium">{selectedLeadMeta.label}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Último contato</span>
                <span className="font-medium">{selectedConversation.updatedAt ? formatTime(selectedConversation.updatedAt) : "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Próxima ação</span>
                <span className="truncate text-right font-medium">{selectedLeadMeta.action}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-2">
              {(selectedConversation.tags ?? []).length > 0 ? (
                selectedConversation.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTagFromSelectedConversation(tag)} className="text-muted-foreground hover:text-foreground">×</button>
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Sem tags</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input value={newTagInput} onChange={(event) => setNewTagInput(event.target.value)} placeholder="Nova tag" className="h-8 text-xs" />
              <Button size="sm" variant="outline" className="h-8" onClick={handleAddTagToSelectedConversation}>Adicionar</Button>
            </div>
          </div>
        </TabsContent>

        {/* ============ TAB QUICK REPLIES ============ */}
        <TabsContent value="qr" className="mt-0 flex-1 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin animate-fade-in data-[state=inactive]:hidden">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={responseSearchQuery}
              onChange={(event) => setResponseSearchQuery(event.target.value)}
              placeholder="Buscar quick reply..."
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {([
              { value: "all", label: "Todas" },
              { value: "saudação", label: "Saudação" },
              { value: "vendas", label: "Vendas" },
              { value: "suporte", label: "Suporte" },
            ] as const).map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={quickReplyCategory === option.value ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-[11px]"
                onClick={() => setQuickReplyCategory(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {favoriteQuickReplies.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Star className="h-3 w-3 text-warning" weight="fill" /> Favoritos
              </p>
              <div className="space-y-1.5">
                {favoriteQuickReplies.map(renderQuickReplyRow)}
              </div>
            </div>
          )}

          <Accordion type="multiple" defaultValue={["saudação", "vendas", "suporte"]} className="space-y-2">
            {(["saudação", "vendas", "suporte"] as const).map((cat) => {
              const items = quickRepliesByCategory[cat] ?? [];
              if (items.length === 0) return null;
              return (
                <AccordionItem key={cat} value={cat} className="rounded-xl border border-border bg-card px-3">
                  <AccordionTrigger className="py-2 text-xs font-semibold capitalize hover:no-underline">
                    <span className="flex items-center gap-2">
                      {cat}
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{items.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1.5 pb-3">
                    {items.map(renderQuickReplyRow)}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {filteredQuickReplies.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">Nenhum quick reply encontrado.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  ) : (
    <div className="text-sm text-muted-foreground">Selecione uma conversa para ver detalhes.</div>
  );

  return (
    <div className="min-h-screen inbox-layout">
      <Header title="Inbox" subtitle={`${lovableInboxViewModel.conversationCount} conversas ativas`} />

      <InboxView
        leftPanel={
          <div className={cn("flex min-h-0 flex-col border-r border-border bg-card/50 lg:overflow-auto", isMobile && mobileScreen !== "conversations" && "hidden")}>
          <div className="space-y-2 border-b border-border p-3">
            <ChatSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar conversas..."
            />
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">Todas</TabsTrigger>
                <TabsTrigger value="unread" className="flex-1">Não lidas</TabsTrigger>
                <TabsTrigger value="ai" className="flex-1">IA ativa</TabsTrigger>
                <TabsTrigger value="archived" className="flex-1">Arquivadas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center justify-between gap-3">
              <OperationalStatusBadge
                label={activeSession ? "Baileys conectado" : "Baileys offline"}
                tone={activeSession ? "online" : "warning"}
                pulse={Boolean(activeSession)}
              />
              <Button
                type="button"
                variant={activeSession ? "secondary" : "outline"}
                onClick={() => navigate("/connections")}
              >
                {activeSession ? "Gerenciar sessão" : "Conectar Baileys"}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-2">
            {conversationsLoadFailed && filteredConversations.length > 0 && (
              <div className="mb-2 rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-sm text-muted-foreground">Falha temporária ao atualizar conversas. Mantendo os últimos dados em tela.</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleRetryConversations()}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {loadingConversations ? (
              <div className="space-y-3 p-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              conversationsLoadFailed ? (
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <p className="text-sm text-muted-foreground">Falha ao carregar conversas. O backend está online, mas o banco local pode estar indisponível.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleRetryConversations()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in">
                  <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border/40">
                    <ChatCircleDots className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Nenhuma conversa encontrada</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">Tente ajustar os filtros ou aguarde novas mensagens.</p>
                  </div>
                </div>
              )
            ) : (
              <List rowComponent={ConversationRow} rowCount={filteredConversations.length} rowHeight={CONVERSATION_ROW_HEIGHT} rowProps={conversationRowData} style={{ height: conversationListHeight }} />
            )}
          </div>
        </div>
        }
        centerPanel={
          <div
          className={cn("flex min-h-0 min-w-0 flex-col", isMobile && mobileScreen !== "chat" && "hidden")}
          onDragOver={(event) => { event.preventDefault(); setIsDraggingFiles(true); }}
          onDragLeave={() => setIsDraggingFiles(false)}
          onDrop={handleDrop}
          onTouchStart={handleChatTouchStart}
          onTouchEnd={handleChatTouchEnd}
        >
          {selectedConversation ? (
            <>
              <ChatHeaderBar
                contactName={selectedConversation.contactName}
                phone={selectedConversation.phone}
                avatar={selectedConversation.avatar}
                initials={getInitials(selectedConversation.contactName)}
                isMobile={isMobile}
                onBack={() => setMobileScreen("conversations")}
                statusLabel={selectedConversationStatusLabel}
                showStatusDot
              />

              {!activeSession && (
                <div className="border-b border-border bg-destructive/10 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-destructive">Nenhuma sessão ativa no Baileys. Conecte para enviar e receber mensagens.</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => navigate("/connections")}>Conectar agora</Button>
                  </div>
                </div>
              )}

              {pendingBackgroundUpdates > 0 && (
                <div className="border-b border-border bg-muted/40 px-4 py-2">
                  <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {pendingBackgroundUpdates === 1
                        ? "Nova mensagem disponível em segundo plano."
                        : `${pendingBackgroundUpdates} novas mensagens disponíveis em segundo plano.`}
                    </p>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void applyPendingBackgroundUpdates()}>
                      Atualizar chat
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className={cn("min-h-0 flex-1 bg-muted/20 p-4 pb-28 md:pb-6", isMobile && "pb-[calc(11rem+env(safe-area-inset-bottom))]")}>
                <div ref={messagesScrollRef} className={cn("mx-auto max-w-3xl space-y-3", isDraggingFiles && "rounded-xl border border-dashed border-primary p-3") }>
                  <div ref={loadMoreTriggerRef} className="h-1 w-full" aria-hidden />
                  {isDraggingFiles && <p className="text-xs text-muted-foreground">Solte arquivos aqui para anexar.</p>}

                  {messagesLoadFailed && selectedConversationMessages.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-3 text-center">
                      <p className="text-sm text-muted-foreground">Falha temporária ao atualizar mensagens. Mantendo os últimos dados em tela.</p>
                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleRetryMessages()}>
                        Tentar novamente
                      </Button>
                    </div>
                  )}

                  {loadingMessages ? (
                    <div className="space-y-4 animate-fade-in">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className={cn("h-14 rounded-2xl", i % 2 === 0 ? "w-3/4" : "ml-auto w-1/2")} />
                      ))}
                    </div>
                  ) : selectedConversationMessages.length === 0 ? (
                    messagesLoadFailed ? (
                      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
                        <p className="text-sm text-muted-foreground">Não foi possível carregar as mensagens.</p>
                        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleRetryMessages()}>
                          Tentar novamente
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
                        <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border/40">
                          <ChatCircleDots className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-foreground">Nenhuma mensagem nesta conversa</p>
                          <p className="mt-1 text-xs text-muted-foreground/70">Envie a primeira mensagem abaixo.</p>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="animate-fade-in">
                    {messageGroups.map((group) => (
                      <div key={group.label} className="space-y-3 mb-3">
                        <div className="flex justify-center">
                          <Badge variant="secondary" className="text-[10px]">{group.label}</Badge>
                        </div>
                        {group.entries.map((message) => (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            reaction={messageReactions[message.id]}
                            onReact={handleReactMessage}
                            onOpenMediaPreview={handleOpenMediaPreview}
                            isMenuOpen={activeMessageMenuId === message.id}
                            isReactionPickerOpen={activeReactionPickerMessageId === message.id}
                            onToggleMenu={handleToggleMessageMenu}
                            onToggleReactionPicker={handleToggleReactionPicker}
                            onCopyMessage={handleCopyMessage}
                            onReplyMessage={handleReplyMessage}
                            onForwardMessage={handleForwardMessage}
                            onToggleAudio={handleToggleAudioPlayback}
                            isAudioLoading={loadingAudioMessageId === message.id}
                            isAudioPlaying={playingAudioMessageId === message.id}
                            audioProgress={playingAudioMessageId === message.id ? audioProgress : 0}
                            audioDuration={playingAudioMessageId === message.id ? audioDuration : 0}
                            backendOnline={backendOnline}
                          />
                        ))}
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              </ScrollArea>

              <NewMessagesBanner
                unseenRealtimeCount={unseenRealtimeCount}
                onScrollToLatest={scrollToLatestMessage}
              />

              <div
                className={cn(
                  "border-t border-border bg-card/95 p-3 md:sticky md:bottom-0 md:z-20 md:p-4",
                  isMobile && "fixed inset-x-0 bottom-0 z-30 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
                )}
                style={isMobile ? { bottom: `calc(${keyboardOffset}px + env(safe-area-inset-bottom))` } : undefined}
              >
                <div className="mx-auto max-w-3xl space-y-3">
                  {replyingTo && (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 p-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground">Respondendo</p>
                        <p className="truncate text-xs">{(replyingTo.caption ?? replyingTo.content ?? "Mensagem").trim()}</p>
                      </div>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReplyingTo(null)}>
                        Cancelar
                      </Button>
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="relative rounded-lg border border-border bg-muted/40 p-2">
                          <p className="truncate text-xs font-medium">{attachment.file.name}</p>
                          {attachment.mediaType === "image" && <img src={attachment.previewUrl} alt={attachment.file.name} className="mt-2 h-20 w-full rounded object-cover" />}
                          {attachment.mediaType === "video" && <video src={attachment.previewUrl} className="mt-2 h-20 w-full rounded object-cover" />}
                          {attachment.mediaType === "audio" && <audio src={attachment.previewUrl} controls className="mt-2 w-full" />}
                          {attachment.mediaType === "file" && <FileIcon className="mt-2 h-8 w-8 text-muted-foreground" />}
                          <button type="button" onClick={() => removeAttachment(attachment.id)} className="absolute right-1 top-1 rounded-md bg-background p-1 text-muted-foreground md:hover:text-foreground">
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={MOBILE_TOUCH_TARGET_CLASS}
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      aria-label="Abrir emojis"
                      data-emoji-trigger
                    >
                      <Smiley className="h-5 w-5" />
                    </Button>

                    <Button type="button" variant="ghost" size="icon" className={MOBILE_TOUCH_TARGET_CLASS} onClick={() => fileInputRef.current?.click()} aria-label="Anexar mídia">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept="*/*"
                      onChange={handleAttachFiles}
                    />

                    <Input
                      ref={messageInputRef}
                      placeholder={
                        !backendOnline
                          ? "Servidor reconectando..."
                          : activeSession
                            ? "Digite sua mensagem..."
                            : "Conecte uma sessão WhatsApp para enviar mensagens"
                      }
                      className="h-11 flex-1"
                      value={messageInput}
                      disabled={!activeSession || !backendOnline || sending}
                      onChange={(event) => setMessageInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                    />

                    <Button size="icon" className={cn("rounded-full", MOBILE_TOUCH_TARGET_CLASS)} onClick={() => void handleSendMessage()} disabled={!activeSession || !backendOnline || (messageInput.trim().length === 0 && attachments.length === 0) || sending} aria-label="Enviar mensagem">
                      <PaperPlaneTilt weight="fill" className="h-5 w-5" />
                    </Button>

                    {showEmojiPicker && (
                      <div data-emoji-picker className="absolute bottom-14 left-0 z-30 rounded-lg border border-border bg-popover p-2 shadow-lg">
                        {EmojiPickerComponent && emojiPickerData ? (
                          <EmojiPickerComponent
                            data={emojiPickerData}
                            onEmojiSelect={handleInsertEmoji}
                            previewPosition="none"
                            skinTonePosition="none"
                            theme="light"
                          />
                        ) : (
                          <div className="w-56 p-3 text-xs text-muted-foreground">Carregando emojis...</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {error && <p className="mt-2 text-center text-xs text-destructive">{error}</p>}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 text-muted-foreground animate-fade-in">
              <div className="rounded-2xl bg-muted/30 p-6 ring-1 ring-border/40">
                <ChatCircleDots className="h-12 w-12 text-muted-foreground/40" />
              </div>
              <div className="text-center max-w-[220px]">
                <p className="text-sm font-semibold text-foreground">Selecione uma conversa</p>
                <p className="mt-1.5 text-xs text-muted-foreground/70 leading-relaxed">Escolha um contato na lista ao lado para visualizar as mensagens.</p>
              </div>
            </div>
          )}
        </div>
        }
        rightPanel={
          <aside
          className={cn(
            "hidden min-h-0 border-l border-border bg-card/40 transition-[width,padding] duration-300 ease-out lg:flex lg:flex-col",
            rightPanelCollapsed
              ? "lg:w-12 lg:min-w-[3rem] lg:max-w-[3rem] lg:p-2"
              : "lg:w-[320px] lg:overflow-auto lg:p-4",
          )}
        >
          {rightPanelCollapsed ? (
            <div className="flex h-full w-full flex-col items-center gap-2 pt-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setRightPanelCollapsed(false)}
                title="Expandir painel (Alt+B)"
              >
                <CaretLeft className="h-4 w-4" />
              </Button>
              <div className="my-1 h-px w-6 bg-border" />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setRightPanelTab("ai"); setRightPanelCollapsed(false); }} title="IA (Alt+1)">
                <span className="text-[10px] font-bold">IA</span>
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setRightPanelTab("lead"); setRightPanelCollapsed(false); }} title="Lead (Alt+2)">
                <span className="text-[10px] font-bold">LD</span>
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setRightPanelTab("qr"); setRightPanelCollapsed(false); }} title="Quick Replies (Alt+3)">
                <span className="text-[10px] font-bold">QR</span>
              </Button>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col">
              <div className="mb-2 flex items-center justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setRightPanelCollapsed(true)}
                  title="Recolher painel (Alt+B)"
                >
                  <CaretRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                {leadPanelContent}
              </div>
            </div>
          )}
        </aside>
        }
        tabletLeadSheet={
          isTabletLayout ? (
            <Sheet open={showLeadPanel} onOpenChange={setShowLeadPanel}>
              <SheetContent side="right" className="w-full p-4 sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Lead Panel</SheetTitle>
                </SheetHeader>
                <div className="mt-4 overflow-y-auto pr-1">{leadPanelContent}</div>
              </SheetContent>
            </Sheet>
          ) : undefined
        }
        previewDialog={
          <Dialog open={Boolean(previewMedia)} onOpenChange={(open) => !open && setPreviewMedia(null)}>
            <DialogContent className="h-screen w-screen max-w-none border-none bg-black/95 p-0 shadow-none">
              <div className="flex h-full w-full items-center justify-center" onClick={() => setPreviewMedia(null)}>
                {previewMedia?.type === "image" && (
                  <img
                    src={previewMedia.url}
                    alt="Preview da imagem"
                    className="max-h-[85vh] max-w-[95vw] rounded-lg border border-border object-contain"
                    onClick={(event) => event.stopPropagation()}
                  />
                )}
                {previewMedia?.type === "video" && (
                  <video
                    src={previewMedia.url}
                    controls
                    autoPlay
                    className="max-h-[85vh] max-w-[95vw] rounded-lg border border-border object-contain"
                    onClick={(event) => event.stopPropagation()}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        }
      />
    </div>
  );
}
