import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { List, type RowComponentProps } from "react-window";
import {
  ArrowBendUpRight,
  CaretLeft,
  ChatCircleDots,
  CopySimple,
  DotsThreeVertical,
  PencilSimple,
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
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getInboxUnreadTotal, publishInboxUnreadTotal } from "@/lib/inboxUnread";
import { apiService, type ChatMessage, type Conversation, type MessageSendResponse, type SessionInfo } from "@/services/apiService";
import { connectInboxSocket, emitInboxSocketEvent, forceReconnectInboxSocket } from "@/services/socketService";
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
const CONVERSATION_ROW_HEIGHT = 102;
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

// Use relative URL for production (same origin)
const BACKEND_BASE_URL = import.meta.env.MODE === 'production'
  ? ''
  : ((import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, "") || "http://localhost:4025");

function isSessionActive(session: SessionInfo): boolean {
  const normalizedStatus = (session.status ?? "").toLowerCase();
  return Boolean(session.connected || normalizedStatus === "connected" || normalizedStatus === "active" || normalizedStatus === "open");
}

function pickActiveSession(sessions: SessionInfo[], preferredSessionId?: string | null): SessionInfo | null {
  if (preferredSessionId) {
    const preferred = sessions.find((session) => session.id === preferredSessionId);
    if (preferred && isSessionActive(preferred)) return preferred;
  }

  return sessions.find(isSessionActive) ?? null;
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

function normalizeLoadedMessage(message: unknown, conversationId: string, index: number): ChatMessage {
  const safeMessage = message && typeof message === "object" ? (message as ChatMessage & Record<string, unknown>) : ({} as ChatMessage & Record<string, unknown>);

  return {
    ...safeMessage,
    id: normalizeId(safeMessage.id) || `message-${Date.now()}-${index}`,
    content: String(safeMessage.content ?? "") || String((safeMessage as ChatMessage & { text?: string }).text ?? ""),
    conversationId: normalizeId(safeMessage.conversationId) || normalizeId(conversationId),
    createdAt: normalizeId(safeMessage.createdAt) || normalizeId(safeMessage.timestamp) || new Date().toISOString(),
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

function normalizeConversationStatus(value: unknown): Conversation["status"] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "typing") return "typing";
  if (normalized === "offline") return "offline";
  return "online";
}

function normalizeConversationEntry(entry: unknown, index = 0): Conversation {
  const item = entry && typeof entry === "object" ? (entry as Partial<Conversation> & Record<string, unknown>) : {};
  const resolvedPhone = normalizePhone(String(item.phone ?? item.chatId ?? item.chat_id ?? ""));
  const resolvedId =
    normalizeId(item.id ?? item.conversationId ?? item.conversation_id) ||
    normalizeId(item.chatId ?? item.chat_id) ||
    `conversation-${index}-${resolvedPhone || Date.now()}`;
  const normalizedLastMessageType = String(item.lastMessageType ?? item.messageType ?? item.mediaType ?? "text").toLowerCase();
  const lastMessageType: Conversation["lastMessageType"] =
    normalizedLastMessageType === "image" ||
    normalizedLastMessageType === "video" ||
    normalizedLastMessageType === "audio" ||
    normalizedLastMessageType === "file"
      ? normalizedLastMessageType
      : "text";
  const unreadNumber = Number(item.unread ?? item.unread_count ?? item.unreadCount ?? 0);

  return {
    id: resolvedId,
    chatId: normalizeId(item.chatId ?? item.chat_id) || resolvedPhone || resolvedId,
    companyId: normalizeId(item.companyId ?? item.company_id) || undefined,
    contactId: normalizeId(item.contactId ?? item.contact_id) || undefined,
    sessionId: normalizeId(item.sessionId ?? item.session_id) || undefined,
    contactName: String((item.contactName ?? item.name ?? item.pushName ?? resolvedPhone) || "Contato").trim() || "Contato",
    avatar: String(item.avatar ?? item.profilePictureUrl ?? item.profile_picture_url ?? "").trim() || undefined,
    isGroup: Boolean(item.isGroup ?? String(item.chatId ?? item.chat_id ?? resolvedPhone).includes("@g.us")),
    lastMessage: String(item.lastMessage ?? item.last_message ?? ""),
    updatedAt: String(item.updatedAt ?? item.updated_at ?? item.timestamp ?? new Date().toISOString()),
    phone: resolvedPhone || String(item.phone ?? ""),
    unread: Number.isFinite(unreadNumber) ? Math.max(0, unreadNumber) : 0,
    status: normalizeConversationStatus(item.status),
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : [],
    isAI: Boolean(item.isAI ?? false),
    lastMessageType,
  };
}

function normalizeConversationsList(list: unknown): Conversation[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry, index) => normalizeConversationEntry(entry, index))
    .filter((conversation) => Boolean(normalizeId(conversation.id)));
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
  const textContent = hasCaption ? message.caption ?? "" : message.content;
  const safeTextContent = textContent?.trim() ? textContent : "Mensagem vazia";

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
          <Avatar className="h-11 w-11">
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

export default function Inbox() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>(() =>
    dedupeConversationsByScope(normalizeConversationsList(loadPersistedConversations()), loadContactDirectory()),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
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
  const [publicApiUrl, setPublicApiUrl] = useState<string | null>(null);
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
  const [mobileScreen, setMobileScreen] = useState<"conversations" | "chat">("conversations");
  const [isTabletLayout, setIsTabletLayout] = useState<boolean>(() => window.innerWidth < 1024);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [preferredSessionId, setPreferredSessionId] = useState<string | null>(() => localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY));
  const [EmojiPickerComponent, setEmojiPickerComponent] = useState<ComponentType<{ data: unknown; onEmojiSelect: (emoji: { native?: string }) => void; previewPosition: "none"; skinTonePosition: "none"; theme: "light" }> | null>(null);
  const [emojiPickerData, setEmojiPickerData] = useState<unknown>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [typingByConversationId, setTypingByConversationId] = useState<Record<string, boolean>>({});
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
  const activeMessageRequestRef = useRef(0);
  const messageCacheRef = useRef<Map<string, MessageCacheEntry>>(new Map());
  const messageIdsRef = useRef<Set<string>>(new Set());
  const pendingOutgoingTempIdsRef = useRef<Map<string, string[]>>(new Map());
  const pendingSendFallbackTimersRef = useRef<Map<string, number>>(new Map());
  const isProcessingRealtimeRef = useRef(false);
  const lastRealtimeTimestampRef = useRef(0);
  const fallbackSyncBusyRef = useRef(false);
  const messagePollingBusyRef = useRef(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
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

    messageCacheRef.current.set(normalizedConversationId, {
      messages: nextMessages,
      hasMore,
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
    const safeIncoming = normalizeConversationsList(incoming);
    const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, safeIncoming);
    contactDirectoryRef.current = mergedDirectory;
    persistContactDirectory(mergedDirectory);

    setConversations((prev) => dedupeConversationsByScope([...prev, ...safeIncoming], mergedDirectory));
  }, []);

  const safeConversations = useMemo(
    () => (Array.isArray(conversations) ? normalizeConversationsList(conversations) : []),
    [conversations],
  );

  useEffect(() => {
    if (!safeConversations.length) return;
    rememberContacts(safeConversations);
    persistConversations(safeConversations);
  }, [rememberContacts, safeConversations]);

  const selectedConversation = useMemo(
    () => safeConversations.find((conversation) => normalizeId(conversation.id) === normalizeId(selectedConversationId)) ?? null,
    [safeConversations, selectedConversationId],
  );

  const refreshSessions = useCallback(async () => {
    try {
      const listedSessions = await apiService.listSessions();
      const safeSessions = Array.isArray(listedSessions) ? listedSessions : [];
      setSessions(safeSessions);
      return safeSessions;
    } catch {
      setSessions([]);
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
    conversationsRef.current = safeConversations;

    if (selectedConversationId && !safeConversations.some((item) => normalizeId(item.id) === normalizeId(selectedConversationId))) {
      setSelectedConversationId(safeConversations[0]?.id ?? null);
    }
  }, [safeConversations, selectedConversationId]);

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
    (title: string) => toast({ title, variant: "destructive" }),
    [toast],
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
    const loadInitial = async () => {
      setError(null);
      setLoadingConversations(true);
      setConversationsLoadFailed(false);

      try {
        const [conversationsData, publicUrlData, sessionsData] = await Promise.all([
          apiService.getConversations(false, { limit: CONVERSATIONS_PAGE_SIZE }),
          apiService.getPublicUrl(),
          apiService.listSessions(),
        ]);
        const persistedConversations = normalizeConversationsList(loadPersistedConversations());
        const combinedConversations = normalizeConversationsList([...persistedConversations, ...conversationsData]);
        const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, combinedConversations);
        contactDirectoryRef.current = mergedDirectory;
        persistContactDirectory(mergedDirectory);

        const normalizedConversations = dedupeConversationsByScope(combinedConversations, mergedDirectory);
        setConversations(normalizedConversations);
        markBackendOnline();
        setPublicApiUrl(typeof publicUrlData.publicUrl === "string" ? publicUrlData.publicUrl.trim() || null : null);
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
        const message = "Não foi possível atualizar as conversas. Mantendo os últimos dados em tela.";
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
      const cached = messageCacheRef.current.get(normalizedConversationId);
      const persisted = loadPersistedConversationMessages({
        conversationId: normalizedConversationId,
        sessionId: conversationMeta?.sessionId,
        phone: conversationMeta?.phone,
      })
        .map((item, index) => normalizeLoadedMessage(item, normalizedConversationId, index))
        .filter((item) => normalizeId(item.conversationId) === normalizeId(normalizedConversationId));

      if (!options?.force && cached && Date.now() - cached.cachedAt < MESSAGE_CACHE_TTL_MS) {
        setMessages(cached.messages);
        setHasMoreMessages(cached.hasMore);
        return;
      }

      if (!cached && persisted.length > 0) {
        const sortedPersisted = sortMessagesAsc(persisted);
        setMessages(sortedPersisted);
        setHasMoreMessages(sortedPersisted.length >= MESSAGE_PAGE_SIZE);
        updateConversationMessageStore(normalizedConversationId, sortedPersisted, sortedPersisted.length >= MESSAGE_PAGE_SIZE);
      }

      const requestId = Date.now();
      activeMessageRequestRef.current = requestId;
      const shouldShowLoading = !options?.background && !(cached?.messages.length || persisted.length);
      if (shouldShowLoading) {
        setLoadingMessages(true);
      }
      setMessagesLoadFailed(false);
      setError(null);

      try {
        const data = await apiService.getMessages(normalizedConversationId, { limit: MESSAGE_PAGE_SIZE });
        markBackendOnline();
        if (activeMessageRequestRef.current !== requestId) return;

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

        setMessages((prev) => {
          if (!Array.isArray(data)) return prev;
          return mergedWithCache;
        });
        setHasMoreMessages(hasMore);
        setPendingBackgroundUpdates(0);
        setMessagesLoadFailed(false);
        updateConversationMessageStore(normalizedConversationId, mergedWithCache, hasMore);

        void hydrateConversationHistoryForAnalysis(normalizedConversationId, sorted);
      } catch (err) {
        markBackendOffline(err);
        if (activeMessageRequestRef.current !== requestId) return;
        setMessagesLoadFailed(true);
        const message = "Falha ao carregar mensagens agora. Você pode tentar novamente.";
        setError(message);
        showErrorToast(message);
      } finally {
        if (activeMessageRequestRef.current === requestId && shouldShowLoading) {
          setLoadingMessages(false);
        }
      }
    },
    [hydrateConversationHistoryForAnalysis, markBackendOffline, markBackendOnline, showErrorToast, updateConversationMessageStore],
  );

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
    const cached = messageCacheRef.current.get(normalizedId);
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
        messageIdsRef.current = new Set();
      }
    }

    setPendingBackgroundUpdates(0);
    setUnseenRealtimeCount(0);
  }, [loadConversationMessages, selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    let isMounted = true;

    const pollMessages = async () => {
      if (!isMounted || messagePollingBusyRef.current) return;
      messagePollingBusyRef.current = true;
      try {
        await loadConversationMessages(selectedConversation.id, { force: true, background: true });
      } catch {
        // handled inside loadConversationMessages
      } finally {
        messagePollingBusyRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void pollMessages();
    }, 20_000);

    return () => {
      isMounted = false;
      messagePollingBusyRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [loadConversationMessages, selectedConversation?.id]);

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
      const before = messages[0]?.createdAt;
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
      if (viewport.scrollTop <= 40 && hasMoreMessages && !loadingOlderMessages) {
        void handleLoadOlderMessages();
      }
    };

    autoScrollRef.current = isViewportNearBottom(viewport);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [handleLoadOlderMessages, hasMoreMessages, loadingOlderMessages, selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id || !hasMoreMessages || loadingOlderMessages) return;

    const root = messagesScrollRef.current?.closest("[data-radix-scroll-area-root]");
    const viewport = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    const sentinel = loadMoreTriggerRef.current;
    if (!viewport || !sentinel) return;

    // Reuse existing observer if root hasn't changed, otherwise create new
    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect();
    }

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

    intersectionObserverRef.current = observer;
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      intersectionObserverRef.current = null;
    };
  }, [handleLoadOlderMessages, hasMoreMessages, loadingOlderMessages, selectedConversation?.id]);

  useEffect(() => {
    const root = messagesScrollRef.current?.closest("[data-radix-scroll-area-root]");
    const viewport = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
    autoScrollRef.current = true;
    setUnseenRealtimeCount(0);
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

  useEffect(() => {
    if (!publicApiUrl) return;

    // websocket-first: do not force backend refresh after each realtime event

    const disconnect = connectInboxSocket({
      socketUrl: publicApiUrl,
      onNewMessage: (incoming) => {
        if (isProcessingRealtimeRef.current) return;
        isProcessingRealtimeRef.current = true;

        try {
        if (!incoming?.id) return;
        const incomingTimestampRaw = incoming.timestamp ?? incoming.createdAt;
        const incomingTimestamp = new Date(String(incomingTimestampRaw ?? "")).getTime();
        if (Number.isFinite(incomingTimestamp) && incomingTimestamp < lastRealtimeTimestampRef.current) {
          return;
        }
        if (Number.isFinite(incomingTimestamp)) {
          lastRealtimeTimestampRef.current = incomingTimestamp;
        }
        const activeConversation = selectedConversationRef.current;
        const activeScope = getConversationScope({
          phone: activeConversation?.phone,
          sessionId: activeConversation?.sessionId,
        });
        const incomingScope = getConversationScope({
          phone: incoming.phone,
          sessionId: incoming.sessionId,
        });
        const knownConversationById = incoming.conversationId
          ? conversationsRef.current.find((item) => String(item.id) === String(incoming.conversationId))
          : null;
        const knownConversationByScope = incomingScope
          ? conversationsRef.current.find(
              (item) =>
                getConversationScope({
                  phone: item.phone,
                  sessionId: item.sessionId,
                }) === incomingScope,
            )
          : null;
        const resolvedConversationId = resolveIncomingConversationId({
          incoming: {
            conversationId: incoming.conversationId,
            sessionId: incoming.sessionId,
            phone: incoming.phone,
            contactId: incoming.contactId,
          },
          activeConversation,
          conversations: conversationsRef.current,
          preferredSessionId,
        });
        const incomingConversationId = String(
          knownConversationById?.id ||
            knownConversationByScope?.id ||
            (incomingScope && incomingScope === activeScope ? activeConversation?.id : undefined) ||
            incoming.conversationId ||
            resolvedConversationId ||
            buildFallbackConversationId({
              phone: incoming.phone,
              sessionId: incoming.sessionId,
            }),
        );

        if (!incomingConversationId) return;

        const normalizedIncoming: ChatMessage & { phone?: string; sessionId?: string; messageType?: "text" | "image" | "video" | "audio" | "file" } = {
          ...incoming,
          conversationId: incomingConversationId,
          id: String(incoming.id),
        };

        const selectedChatId = String(selectedConversationRef.current?.id ?? "");
        const incomingChatId = String(incomingConversationId);
        console.log("CHAT ABERTO:", selectedChatId);
        console.log("EVENTO RECEBIDO:", incomingChatId);
        console.log("MENSAGEM:", normalizedIncoming.id);

        if (!selectedChatId || incomingChatId !== selectedChatId) return;

        const isActiveConversation = true;

        const scrollChatToBottom = () => {
          const root = messagesScrollRef.current?.closest("[data-radix-scroll-area-root]");
          const viewport = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
          if (!viewport || !autoScrollRef.current) return false;
          window.requestAnimationFrame(() => {
            viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
          });
          return true;
        };

        const updateMessages = (conversationId: string, message: ChatMessage) => {
          const normalizedConversationId = String(conversationId);
          if (messageIdsRef.current.has(message.id)) {
            return false;
          }

          let inserted = false;

          setMessages((prev) => {
            let base = prev;

            if (message.fromMe) {
              const pending = pendingOutgoingTempIdsRef.current.get(normalizedConversationId) ?? [];
              const [tempIdToRemove, ...rest] = pending;
              if (tempIdToRemove) {
                base = base.filter((item) => item.id !== tempIdToRemove);
                messageIdsRef.current.delete(tempIdToRemove);
                clearPendingFallbackTimersForTempId(tempIdToRemove);
                if (rest.length > 0) {
                  pendingOutgoingTempIdsRef.current.set(normalizedConversationId, rest);
                } else {
                  pendingOutgoingTempIdsRef.current.delete(normalizedConversationId);
                }
              }
            }

            const exists = base.some((item) => item.id === message.id);
            if (exists) return base;
            messageIdsRef.current.add(message.id);
            inserted = true;
            const next = sortMessagesAsc([...base, message]);
            const hasMoreFromCache = messageCacheRef.current.get(normalizedConversationId)?.hasMore ?? next.length >= MESSAGE_PAGE_SIZE;
            updateConversationMessageStore(normalizedConversationId, next, hasMoreFromCache);
            return next;
          });

          const scrolled = scrollChatToBottom();
          if (!scrolled && !message.fromMe) {
            setUnseenRealtimeCount((prev) => prev + 1);
          } else if (scrolled) {
            setUnseenRealtimeCount(0);
          }

          return inserted;
        };

        const wasInserted = updateMessages(incomingConversationId, normalizedIncoming);
        if (!wasInserted) return;

        if (!normalizedIncoming.fromMe) {
          notify.success("New message received");
        }

        setConversations((prev) => {
          const existing =
            prev.find((conversation) => String(conversation.id) === incomingConversationId) ??
            (incomingScope
              ? prev.find(
                  (conversation) =>
                    getConversationScope({ phone: conversation.phone, sessionId: conversation.sessionId }) === incomingScope,
                )
              : undefined);
          const unreadBase = existing?.unread ?? 0;
          const lastMessageText = normalizedIncoming.content || (normalizedIncoming.messageType ? `[${normalizedIncoming.messageType}]` : "");
          const lastMessageTimestamp = normalizedIncoming.createdAt ?? new Date().toISOString();
          const unread = normalizedIncoming.fromMe ? unreadBase : 0;

          const nextConversation: Conversation = existing
            ? {
                ...existing,
                sessionId: normalizedIncoming.sessionId ?? existing.sessionId,
                lastMessage: lastMessageText || existing.lastMessage,
                updatedAt: lastMessageTimestamp,
                unread,
                lastMessageType: normalizedIncoming.messageType ?? normalizedIncoming.mediaType ?? existing.lastMessageType ?? "text",
              }
            : {
                id: incomingConversationId,
                contactName: normalizedIncoming.phone || "Contato",
                phone: normalizedIncoming.phone || "",
                sessionId: normalizedIncoming.sessionId,
                lastMessage: lastMessageText,
                updatedAt: lastMessageTimestamp,
                unread: 0,
                status: "online",
                tags: [],
                isAI: false,
                lastMessageType: normalizedIncoming.messageType ?? normalizedIncoming.mediaType ?? "text",
              };

          const idsToRemove = new Set([incomingConversationId, existing?.id].filter(Boolean).map((id) => String(id)));
          const nextList = [nextConversation, ...prev.filter((item) => !idsToRemove.has(String(item.id)))];
          const normalizedList = dedupeConversationsByScope(nextList, contactDirectoryRef.current);

          if (!selectedConversationRef.current?.id) {
            setSelectedConversationId(normalizedList[0]?.id ?? null);
          }

          return normalizedList;
        });
        } finally {
          isProcessingRealtimeRef.current = false;
        }

      },
      onTypingStatus: (payload) => {
        const activeConversation = selectedConversationRef.current;
        const resolvedConversationId = resolveIncomingConversationId({
          incoming: {
            conversationId: payload.conversationId,
            phone: payload.phone,
          },
          activeConversation,
          conversations: conversationsRef.current,
          preferredSessionId,
        });

        if (!resolvedConversationId) return;

        setTypingByConversationId((prev) => {
          if (payload.isTyping === false && !prev[resolvedConversationId]) return prev;
          if (payload.isTyping === true && prev[resolvedConversationId]) return prev;
          return { ...prev, [resolvedConversationId]: payload.isTyping };
        });

        setConversations((prev) =>
          prev.map((conversation) => {
            if (String(conversation.id) !== String(resolvedConversationId)) return conversation;
            const nextStatus = payload.isTyping ? "typing" : conversation.status === "typing" ? "online" : conversation.status;
            if (nextStatus === conversation.status) return conversation;
            return { ...conversation, status: nextStatus };
          }),
        );
      },
      onConversationUpdated: (incoming) => {
        if (!incoming.id) return;
        setConversations((prev) => {
          const incomingId = String(incoming.id);
          const found = prev.find((item) => String(item.id) === incomingId);
          const merged: Conversation = found
            ? { ...found, ...incoming, id: found.id }
            : {
                id: incomingId,
                companyId: incoming.companyId,
                contactId: incoming.contactId,
                sessionId: incoming.sessionId,
                contactName: incoming.contactName || normalizePhone(incoming.phone) || "Contato",
                lastMessage: incoming.lastMessage || "",
                updatedAt: incoming.updatedAt || new Date().toISOString(),
                phone: incoming.phone || "",
                unread: incoming.unread ?? 0,
                status: incoming.status ?? "online",
                tags: incoming.tags ?? [],
                isAI: incoming.isAI ?? false,
                lastMessageType: incoming.lastMessageType ?? inferConversationMessageType(incoming),
              };
          const withoutCurrent = prev.filter((item) => String(item.id) !== incomingId);
          return dedupeConversationsByScope([merged, ...withoutCurrent], contactDirectoryRef.current);
        });
      },
      onChatsLoaded: (payload) => {
        const loadedChats = parseChatsLoadedPayload(payload);
        if (!loadedChats.length) return;

        const isResetPayload =
          payload &&
          typeof payload === "object" &&
          "type" in payload &&
          String((payload as { type?: unknown }).type ?? "").toLowerCase() === "reset";

        if (isResetPayload) {
          const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, loadedChats);
          contactDirectoryRef.current = mergedDirectory;
          persistContactDirectory(mergedDirectory);
          setConversations(dedupeConversationsByScope(loadedChats, mergedDirectory));
          return;
        }

        mergeConversationsSnapshot(loadedChats);
      },
      onConversationSnapshot: (payload) => {
        const snapshotObject = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
        const rawMessages = Array.isArray(payload)
          ? payload
          : Array.isArray(snapshotObject?.messages)
            ? (snapshotObject.messages as unknown[])
            : Array.isArray(snapshotObject?.data)
              ? (snapshotObject.data as unknown[])
              : [];

        if (!rawMessages.length) return;

        const activeConversationId = String(selectedConversationRef.current?.id ?? "");
        if (!activeConversationId) return;

        const normalizedSnapshot = sortMessagesAsc(
          rawMessages
            .map((entry, index): ChatMessage | null => {
              if (!entry || typeof entry !== "object") return null;
              const item = entry as Record<string, unknown>;
              const messageId = String(item.id ?? `snapshot-${activeConversationId}-${index}`).trim();
              if (!messageId) return null;

              const messageConversationId = String(
                item.conversationId ?? item.conversation_id ?? item.chatId ?? item.chat_id ?? activeConversationId,
              );

              const mediaUrlCandidate =
                (typeof item.url === "string" && item.url) ||
                (typeof item.mediaUrl === "string" && item.mediaUrl) ||
                (typeof item.media_url === "string" && item.media_url) ||
                undefined;
              const mediaPathCandidate =
                (typeof item.mediaPath === "string" && item.mediaPath) ||
                (typeof item.media_path === "string" && item.media_path) ||
                undefined;
              const resolvedUrl = resolveMediaUrl(mediaUrlCandidate ?? mediaPathCandidate);

              const normalizedType = String(item.mediaType ?? item.type ?? "").toLowerCase();
              const mediaType =
                normalizedType === "image" || normalizedType === "video" || normalizedType === "audio" || normalizedType === "file"
                  ? (normalizedType as ChatMessage["mediaType"])
                  : inferMediaTypeFromSource(resolvedUrl ?? undefined);

              return {
                id: messageId,
                conversationId: messageConversationId,
                chatId: String(item.chatId ?? item.chat_id ?? "") || undefined,
                content: String(item.content ?? item.text ?? item.body ?? item.caption ?? ""),
                caption: typeof item.caption === "string" ? item.caption : undefined,
                fromMe: Boolean(item.fromMe ?? item.sent ?? false),
                createdAt: String(item.createdAt ?? item.created_at ?? item.timestamp ?? item.time ?? new Date().toISOString()),
                timestamp: String(item.timestamp ?? item.createdAt ?? item.created_at ?? item.time ?? "") || undefined,
                status: (String(item.status ?? "sent") as ChatMessage["status"]),
                isAI: Boolean(item.isAI ?? false),
                mediaType,
                mediaPath: mediaPathCandidate,
                mediaUrl: resolvedUrl ?? undefined,
                url: resolvedUrl ?? undefined,
                emoji: typeof item.emoji === "string" ? item.emoji : undefined,
              } satisfies ChatMessage;
            })
            .filter((item): item is ChatMessage => item !== null)
            .filter((item) => String(item.conversationId ?? "") === activeConversationId),
        );

        if (!normalizedSnapshot.length) return;

        messageIdsRef.current = new Set(normalizedSnapshot.map((item) => item.id));
        setMessages(normalizedSnapshot);
        updateConversationMessageStore(
          activeConversationId,
          normalizedSnapshot,
          messageCacheRef.current.get(activeConversationId)?.hasMore ?? normalizedSnapshot.length >= MESSAGE_PAGE_SIZE,
        );
      },
      onContactsLoaded: (payload) => {
        const contacts = parseContactsLoadedPayload(payload);
        if (!contacts.length) return;
        const nextDirectory = { ...contactDirectoryRef.current };
        contacts.forEach((contact) => {
          if (contact.phone && contact.name) {
            nextDirectory[contact.phone] = contact.name;
          }
        });
        contactDirectoryRef.current = nextDirectory;
        persistContactDirectory(nextDirectory);
        setConversations((prev) => dedupeConversationsByScope(prev, nextDirectory));
      },
      onAiResponse: (payload) => {
        const normalizedIncoming = { ...payload, fromMe: true, isAI: true };
        const incomingConversationId = String(normalizedIncoming.conversationId ?? "");
        if (!incomingConversationId) return;

        setMessages((prev) => {
          const selectedId = String(selectedConversationRef.current?.id ?? "");
          if (selectedId !== incomingConversationId) return prev;
          if (isPotentialDuplicateMessage(prev, normalizedIncoming)) return prev;

          const next = sortMessagesAsc([...prev, normalizedIncoming]);
          updateConversationMessageStore(incomingConversationId, next, hasMoreMessages);
          return next;
        });

        setConversations((prev) => {
          const existing = prev.find((conversation) => String(conversation.id) === incomingConversationId);
          if (!existing) return prev;

          const updated: Conversation = {
            ...existing,
            lastMessage: normalizedIncoming.content || existing.lastMessage,
            lastMessageType: normalizedIncoming.messageType ?? normalizedIncoming.mediaType ?? existing.lastMessageType ?? "text",
            updatedAt: normalizedIncoming.createdAt ?? new Date().toISOString(),
          };

          const withoutCurrent = prev.filter((item) => String(item.id) !== incomingConversationId);
          return dedupeConversationsByScope([updated, ...withoutCurrent], contactDirectoryRef.current);
        });
      },
      onChatArchived: ({ chatId, conversationId }) => {
        const resolvedId = String(chatId ?? conversationId ?? "");
        if (!resolvedId) return;
        setArchivedChatIds((prev) => (prev.includes(resolvedId) ? prev : [...prev, resolvedId]));
      },
      onChatTagUpdated: ({ chatId, conversationId, tag, action }) => {
        const resolvedId = String(chatId ?? conversationId ?? "");
        const normalizedTag = String(tag ?? "").trim();
        if (!resolvedId || !normalizedTag) return;

        setConversations((prev) =>
          prev.map((conversation) => {
            if (String(conversation.id) !== resolvedId) return conversation;
            const currentTags = conversation.tags ?? [];
            if (action === "remove") {
              return { ...conversation, tags: currentTags.filter((entry) => entry !== normalizedTag) };
            }
            return { ...conversation, tags: Array.from(new Set([...currentTags, normalizedTag])) };
          }),
        );
      },
      onMessageDeleted: ({ messageId, conversationId }) => {
        if (!messageId) return;
        const normalizedConversationId = conversationId ? String(conversationId) : null;

        setMessages((prev) => {
          const next = prev.filter((message) => message.id !== messageId);
          const selectedId = String(selectedConversationRef.current?.id ?? "");
          if (!normalizedConversationId || selectedId === normalizedConversationId) {
            const targetConversationId = normalizedConversationId || selectedId;
            if (!targetConversationId) return next;
            updateConversationMessageStore(
              targetConversationId,
              next,
              hasMoreMessages,
            );
          }
          return next;
        });

        setConversations((prev) =>
          prev.map((conversation) => {
            if (normalizedConversationId && String(conversation.id) !== normalizedConversationId) return conversation;
            if (!conversation.lastMessage) return conversation;
            return {
              ...conversation,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      },
      onMessageStatus: ({ messageId, status, conversationId }) => {
        if (!messageId || !status) return;
        const normalizedConversationId = conversationId ? String(conversationId) : null;

        setMessages((prev) => {
          const next = prev.map((message) =>
            message.id === messageId ? { ...message, status: status as ChatMessage["status"] } : message,
          );

          const targetConversationId = normalizedConversationId ?? String(selectedConversationRef.current?.id ?? "");
          if (targetConversationId) {
            updateConversationMessageStore(targetConversationId, next, hasMoreMessages);
          }

          return next;
        });
      },
      onSocketConnected: () => {
        setBackendOnline(true);
        setError((current) => (current?.startsWith("Realtime:") ? null : current));
        const selectedId = selectedConversationRef.current?.id;
        if (selectedId) {
          void loadConversationMessages(String(selectedId), { force: true, background: true });
        }
      },
      onSocketDisconnected: () => undefined,
      onError: (message) => {
        setBackendOnline(false);
        setError(`Realtime: ${message}`);
        showErrorToast(`Realtime: ${message}`);
      },
    });

    return () => disconnect();
  }, [clearPendingFallbackTimersForTempId, loadConversationMessages, preferredSessionId, publicApiUrl, showErrorToast, updateConversationMessageStore]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (fallbackSyncBusyRef.current) return;
      if (backendOnline && isWhatsappConnected) return;

      void (async () => {
        fallbackSyncBusyRef.current = true;
        try {
          const sessionStatus = await apiService.getSessionStatus();
          setIsWhatsappConnected(Boolean(sessionStatus.connected));
          setBackendOnline(true);
        } catch (err) {
          markBackendOffline(err);
          setIsWhatsappConnected(false);
        } finally {
          fallbackSyncBusyRef.current = false;
        }
      })();
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [backendOnline, isWhatsappConnected, markBackendOffline]);

  useEffect(() => {
    const handleRuntimeReconnected = () => {
      forceReconnectInboxSocket();
    };

    window.addEventListener(RUNTIME_RECONNECTED_EVENT, handleRuntimeReconnected);
    return () => window.removeEventListener(RUNTIME_RECONNECTED_EVENT, handleRuntimeReconnected);
  }, []);

  useEffect(() => {
    publishInboxUnreadTotal(getInboxUnreadTotal(safeConversations));
  }, [safeConversations]);

  useEffect(() => {
    localStorage.setItem(ARCHIVED_CHATS_STORAGE_KEY, JSON.stringify(archivedChatIds));
  }, [archivedChatIds]);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const archivedSet = new Set(archivedChatIds);

    return (Array.isArray(safeConversations) ? safeConversations : [])
      .filter((conversation) => {
      const isArchived = archivedSet.has(String(conversation.id));
      if (filter === "archived") return isArchived;
      if (isArchived) return false;
      if (filter === "unread" && (conversation.unread ?? 0) <= 0) return false;
      if (filter === "ai" && !(conversationControls[conversation.id]?.aiEnabled ?? true)) return false;
      if (!normalizedSearch) return true;

      const safeName = String(conversation.contactName ?? "").toLowerCase();
      const safePhone = String(conversation.phone ?? "").toLowerCase();
      const safeLastMessage = String(conversation.lastMessage ?? "").toLowerCase();

      return (
        safeName.includes(normalizedSearch) ||
        safePhone.includes(normalizedSearch) ||
        safeLastMessage.includes(normalizedSearch)
      );
    })
      .sort((a, b) => normalizeConversationTimestamp(b.updatedAt) - normalizeConversationTimestamp(a.updatedAt));
  }, [archivedChatIds, conversationControls, filter, safeConversations, searchQuery]);

  const selectedConversationMessages = useMemo(
    () => (Array.isArray(messages) ? messages : []).filter((message) => normalizeId(message?.conversationId) === normalizeId(selectedConversation?.id)),
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
    const entries = (Array.isArray(safeConversations) ? safeConversations : []).map((conversation) => {
      const cached = conversationControls[conversation.id];
      const sourceText = cached?.summary || conversation.lastMessage || "";
      return [conversation.id, analyzeLeadIntent(sourceText, [sourceText])];
    });

    return Object.fromEntries(entries);
  }, [conversationControls, safeConversations]);

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
        setConversations((prev) =>
          prev.map((conversation) => (normalizeId(conversation.id) === normalizedId ? { ...conversation, unread: 0 } : conversation)),
        );
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

  const handleInsertEmoji = useCallback((emoji: { native?: string }) => {
    if (!emoji.native) return;
    setMessageInput((prev) => `${prev}${emoji.native}`);
    setShowEmojiPicker(false);
  }, []);

  const handleCopyMessage = useCallback((message: ChatMessage) => {
    const value = (message.caption ?? message.content ?? "").trim();
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
    const value = (message.caption ?? message.content ?? "").trim();
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
    }, { passive: true });

    audio.addEventListener("ended", () => {
      setPlayingAudioMessageId(null);
      setLoadingAudioMessageId(null);
      setAudioProgress(0);
      audioPlayerRef.current = null;
    }, { once: true });

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
      const latestSessions = sessions.length > 0 ? sessions : await refreshSessions();
      const resolvedActiveSession = pickActiveSession(
        latestSessions,
        selectedConversation.sessionId ?? preferredSessionId,
      );
      const fallbackSession =
        latestSessions.find((session) => session.id === (selectedConversation.sessionId ?? preferredSessionId)) ??
        latestSessions[0] ??
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
          const next = prev.filter((item) => !pendingTempIds.has(item.id));
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

  const leadPanelContent = selectedConversation ? (
    <div className="flex h-full w-full flex-col space-y-3 overflow-y-auto pr-1">
      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai">IA</TabsTrigger>
          <TabsTrigger value="lead">Lead</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-3 space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Intent</span>
                <span className="font-medium">{selectedLead?.intent ?? "compra"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confiança</span>
                <span className="font-medium">{Math.round((selectedLead?.confidence ?? 0.85) * 100)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Temperatura</span>
                <span className="font-medium">{selectedLeadMeta.label}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold">Suggested replies</p>
            <div className="mt-2 space-y-2">
              {filteredQuickReplies.slice(0, 3).map((reply) => (
                <Button
                  key={reply.id}
                  size="sm"
                  variant="outline"
                  className="h-8 w-full justify-start text-xs"
                  onClick={() => void sendQuickReply(reply.text)}
                >
                  {reply.text}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold">Memory</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {activeControl?.summary || "Sem memória consolidada para esta conversa."}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="lead" className="mt-3 space-y-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Dados do Lead</p>
              <Badge variant="secondary" className="h-6 text-xs">Ativo</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Nome</span>
                <span className="truncate font-medium">{selectedConversation.contactName}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Telefone</span>
                <span className="truncate font-medium">{selectedConversation.phone || "Sem número"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Histórico</span>
                <span className="line-clamp-2 text-right font-medium">{selectedConversation.lastMessage || "Sem histórico recente"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
      </Tabs>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-semibold">Quick Replies</p>
        <div className="relative mt-3">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={responseSearchQuery} onChange={(event) => setResponseSearchQuery(event.target.value)} placeholder="Buscar quick reply" className="pl-9" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
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
              className="h-7 px-3 text-xs"
              onClick={() => setQuickReplyCategory(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {filteredQuickReplies.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-2">
              {editingQuickReplyId === item.id ? (
                <div className="space-y-2">
                  <Input value={editingQuickReplyValue} onChange={(event) => setEditingQuickReplyValue(event.target.value)} className="h-8 text-xs" />
                  <Button size="sm" className="h-7 text-xs" onClick={saveQuickReply}>Salvar</Button>
                </div>
              ) : (
                <>
                  <p className="text-xs">{item.text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void sendQuickReply(item.text)}>
                      Enviar
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditingQuickReply(item)}>
                      <PencilSimple className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteQuickReply(item.id)}>
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filteredQuickReplies.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum quick reply encontrado.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Controle da IA</p>
          <Switch checked={aiEnabledForConversation} onCheckedChange={(checked) => void handleSetConversationAiEnabled(checked)} disabled={updatingAiToggle} />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button
            size="sm"
            variant={aiEnabledForConversation ? "default" : "secondary"}
            className="h-10 justify-start"
            onClick={() => void handleSetConversationAiEnabled(true)}
            disabled={updatingAiToggle || aiEnabledForConversation}
          >
            IA responde automaticamente
          </Button>
          <Button
            size="sm"
            variant={!aiEnabledForConversation ? "default" : "outline"}
            className="h-10 justify-start"
            onClick={() => void handleSetConversationAiEnabled(false)}
            disabled={updatingAiToggle || !aiEnabledForConversation}
          >
            Atendimento manual
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-semibold">Resumo da conversa</p>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{activeControl?.summary || "Cliente pediu preço e perguntou sobre disponibilidade."}</p>
        {activeControl?.updatedAt && <p className="mt-2 text-[11px] text-muted-foreground">Atualizado às {formatTime(activeControl.updatedAt)}</p>}
      </div>
    </div>
  ) : (
    <div className="text-sm text-muted-foreground">Selecione uma conversa para ver detalhes.</div>
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <Header title="Inbox" subtitle={`${safeConversations.length} conversas ativas`} />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <div className={cn("flex min-h-0 flex-col border-r border-border bg-card/50 lg:resize-x lg:overflow-auto lg:min-w-[280px] lg:max-w-[460px]", isMobile && mobileScreen !== "conversations" && "hidden")}>
          <div className="space-y-3 border-b border-border p-4">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar conversas..." className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </div>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">Todas</TabsTrigger>
                <TabsTrigger value="unread" className="flex-1">Não lidas</TabsTrigger>
                <TabsTrigger value="ai" className="flex-1">IA ativa</TabsTrigger>
                <TabsTrigger value="archived" className="flex-1">Arquivadas</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              type="button"
              variant={activeSession ? "secondary" : "outline"}
              className="w-full"
              onClick={() => navigate("/connections")}
            >
              {activeSession ? "Baileys conectado" : "Conectar Baileys"}
            </Button>
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
                  <p className="text-sm text-muted-foreground">Falha ao carregar conversas.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleRetryConversations()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
              )
            ) : (
              <List rowComponent={ConversationRow} rowCount={filteredConversations.length} rowHeight={CONVERSATION_ROW_HEIGHT} rowProps={conversationRowData} style={{ height: conversationListHeight }} />
            )}
          </div>
        </div>

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
              <div className="flex h-16 items-center justify-between border-b border-border bg-card/50 px-3 md:px-4">
                <div className="flex items-center gap-2 md:gap-3">
                  {isMobile && (
                    <Button variant="ghost" size="icon" className={MOBILE_TOUCH_TARGET_CLASS} onClick={() => setMobileScreen("conversations")} aria-label="Voltar para conversas">
                      <CaretLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <Avatar className="h-10 w-10">
                    {selectedConversation.avatar ? <AvatarImage src={selectedConversation.avatar} alt={selectedConversation.contactName} loading="lazy" /> : null}
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary">{getInitials(selectedConversation.contactName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{selectedConversation.contactName}</h3>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{selectedConversation.phone || "Sem número"}</span>
                      <span>•</span>
                      <span>{selectedConversationStatusLabel}</span>
                    </p>
                  </div>
                </div>
              </div>

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
                      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
                        <p className="text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
                        <p className="mt-1 text-xs text-muted-foreground/70">Envie a primeira mensagem abaixo.</p>
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

              {unseenRealtimeCount > 0 && (
                <div className="px-4 pb-2">
                  <div className="mx-auto flex max-w-3xl justify-center">
                    <Button type="button" size="sm" className="h-8 rounded-full px-4 text-xs" onClick={scrollToLatestMessage}>
                      {unseenRealtimeCount === 1 ? "1 nova mensagem" : `${unseenRealtimeCount} novas mensagens`}
                    </Button>
                  </div>
                </div>
              )}

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
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground animate-fade-in">
              <div className="rounded-full bg-muted/50 p-6">
                <ChatCircleDots className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Selecione uma conversa</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Escolha um contato na lista ao lado para iniciar.</p>
              </div>
            </div>
          )}
        </div>

        <aside className="hidden min-h-0 border-l border-border bg-card/40 p-4 lg:flex lg:resize-x lg:overflow-auto lg:min-w-[300px] lg:max-w-[480px]">
          {leadPanelContent}
        </aside>
      </div>

      {isTabletLayout && (
        <Sheet open={showLeadPanel} onOpenChange={setShowLeadPanel}>
          <SheetContent side="right" className="w-full p-4 sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Lead Panel</SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto pr-1">{leadPanelContent}</div>
          </SheetContent>
        </Sheet>
      )}

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
    </div>
  );
}
