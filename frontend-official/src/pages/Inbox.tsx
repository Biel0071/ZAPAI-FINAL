import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { List, type RowComponentProps } from "react-window";
import {
  ArrowBendUpRight,
  CaretLeft,
  CaretRight,
  Check,
  Checks,
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
  Clock,
  Brain,
  Phone,
  ArrowDown,
  Plus,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { useRuntime } from "@/providers/RuntimeProvider";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { InboxSectionBoundary } from "@/components/system/InboxSectionBoundary";

const CONVERSATIONS_PAGE_SIZE = 20;
const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_CACHE_TTL_MS = 30_000;
const CONVERSATION_ROW_HEIGHT = 66;
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

function formatPhoneNumber(phone: string): string {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return phone || "Sem número";
  if (clean.length === 13) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  if (clean.length === 11) {
    return `+55 (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  return phone;
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
function getTagColor(tag: string): string {
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
  const normStatus = String(status || "").toLowerCase();
  if (normStatus === "sending" || normStatus === "pending" || normStatus === "retry") {
    return {
      symbol: "🟡",
      className: "text-amber-500 animate-pulse",
      label: "Enviando...",
      icon: "clock",
    };
  }
  if (normStatus === "failed") {
    return {
      symbol: "🔴",
      className: "text-destructive",
      label: "Falhou",
      icon: "failed",
    };
  }
  if (normStatus === "read" || normStatus === "played") {
    return {
      symbol: "🔵",
      className: "text-blue-500",
      label: "Lida",
      icon: "read",
    };
  }
  if (normStatus === "device_ack" || normStatus === "delivered") {
    return {
      symbol: "🟢",
      className: "text-emerald-500",
      label: "Entregue",
      icon: "delivered",
    };
  }
  if (normStatus === "sent" || normStatus === "server_ack") {
    return {
      symbol: "🟢",
      className: "text-muted-foreground/60",
      label: "Enviada",
      icon: "sent",
    };
  }

  // Fallback for any unknown or default status
  return {
    symbol: "🟢",
    className: "text-muted-foreground/60",
    label: "Enviada",
    icon: "sent",
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

type QuickReplyMediaItem = {
  id?: string;
  type: "text" | "image" | "video" | "audio" | "pdf" | "document" | "sticker";
  value: string;
  filename?: string;
};

type QuickReplyItem = {
  id: string;
  title: string;
  category: string;
  text: string;
  favorite?: boolean;
  items?: QuickReplyMediaItem[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_QUICK_REPLIES: QuickReplyItem[] = [
  { id: "qr-1", category: "saudação", title: "Saudação", text: "Olá! Como posso ajudar?", items: [{ type: "text", value: "Olá! Como posso ajudar?" }] },
  { id: "qr-2", category: "vendas", title: "Interesse", text: "Qual produto você procura hoje?", items: [{ type: "text", value: "Qual produto você procura hoje?" }] },
  { id: "qr-3", category: "vendas", title: "Valores", text: "Posso te enviar os valores agora mesmo.", items: [{ type: "text", value: "Posso te enviar os valores agora mesmo." }] },
  { id: "qr-4", category: "suporte", title: "Suporte", text: "Já vou verificar isso para você e te retorno em instantes.", items: [{ type: "text", value: "Já vou verificar isso para você e te retorno em instantes." }] },
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
  onDeleteMessage,
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
  onDeleteMessage: (messageId: string) => void;
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
    <div className={cn("flex group/bubble", message.fromMe && "justify-end")}>
      <div className="relative pb-3 max-w-[80%]">
        {/* Hover Actions Bar */}
        <div
          className={cn(
            "absolute top-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 z-20 flex items-center gap-0.5 bg-[#181d26]/90 border border-border/80 rounded-full p-1 shadow-md backdrop-blur-sm",
            message.fromMe ? "-left-32" : "-right-32"
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onReplyMessage(message)}
            title="Responder"
          >
            <ArrowBendUpRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onCopyMessage(message)}
            title="Copiar"
          >
            <CopySimple className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onToggleReactionPicker(message.id)}
            title="Reagir"
          >
            <Smiley className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDeleteMessage(message.id)}
            title="Excluir"
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>

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
                  className="flex items-center gap-3 rounded-lg bg-[#202c33] border border-border/40 p-3 text-xs font-medium text-foreground hover:bg-[#202c33]/80 transition-all select-none w-64 shadow-sm text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00a884] text-white">
                    <FileIcon className="h-5 w-5" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{getMediaFileName(message)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase mt-0.5">Documento</p>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary/60 hover:bg-secondary text-foreground transition-colors shrink-0">
                    <ArrowDown className="h-4 w-4" />
                  </div>
                </a>
              )}
            </div>
          )}

          <p className="whitespace-pre-wrap">{safeTextContent}</p>

          <div className={cn("mt-1 flex items-center gap-1 text-[10px]", message.fromMe ? "justify-end text-primary-foreground/70" : "text-muted-foreground")}>
            <span>{formatTime(message.createdAt)}</span>
            {message.fromMe && (
              <span className={cn("flex items-center shrink-0 ml-0.5", statusMeta.className)} aria-label={statusMeta.label} title={statusMeta.label}>
                {statusMeta.icon === "clock" ? (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                ) : statusMeta.icon === "failed" ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block shrink-0" />
                ) : statusMeta.icon === "read" ? (
                  <Checks className="h-3.5 w-3.5 text-[#53bdeb] shrink-0" weight="bold" />
                ) : statusMeta.icon === "delivered" ? (
                  <Checks className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                )}
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
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteMessage(message.id)}
            >
              <Trash className="h-3.5 w-3.5" />
              Excluir
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
  typingByConversationId?: Record<string, boolean>;
};

function ConversationRow(props: RowComponentProps<ConversationRowData>) {
  const { index, style, ...rowProps } = props;
  const { conversations, selectedId, onSelect, leadByConversationId, typingByConversationId } = rowProps as ConversationRowData;
  const conversation = conversations[index];
  if (!conversation) return null;
  const isTyping = typingByConversationId?.[conversation.id] || conversation.status === "typing";

  return (
    <div style={style} className="px-1 py-0.5">
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className={cn(
          "inbox-message w-full text-left rounded-lg flex items-center gap-3 px-3 py-2",
          MOBILE_TOUCH_TARGET_CLASS,
          "md:h-full md:min-h-0",
          normalizeId(selectedId) === normalizeId(conversation.id) && "inbox-message-active"
        )}
      >
        <div className="relative shrink-0 flex items-center">
          <Avatar className="h-11 w-11 border border-border/40">
            {conversation.avatar ? <AvatarImage src={conversation.avatar} alt={conversation.contactName} loading="lazy" /> : null}
            <AvatarFallback className="bg-primary/10 font-bold text-xs text-primary">{getInitials(conversation.contactName)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center justify-between gap-1">
            <h4 className="truncate text-xs md:text-sm font-semibold text-foreground/95 leading-none">{conversation.contactName}</h4>
            <span className="shrink-0 text-[10px] text-muted-foreground/70">{formatTime(conversation.updatedAt)}</span>
          </div>

          {isTyping ? (
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs text-emerald-400 font-semibold leading-normal animate-pulse">
                digitando...
              </span>
              {(conversation.unread ?? 0) > 0 && (
                <span className="h-5 min-w-[20px] rounded-full px-1.5 py-0.5 flex items-center justify-center text-[10px] font-bold text-white bg-emerald-500 shrink-0">
                  {conversation.unread}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1">
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground/80 leading-normal min-w-0">
                {inferConversationMessageType(conversation) === "image" && <ImageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "video" && <VideoCamera className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "audio" && <Microphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "file" && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                <span className="truncate">{conversation.lastMessage || "Sem mensagens"}</span>
              </p>
              {(conversation.unread ?? 0) > 0 && (
                <span className="h-5 min-w-[20px] rounded-full px-1.5 py-0.5 flex items-center justify-center text-[10px] font-bold text-white bg-emerald-500 shrink-0">
                  {conversation.unread}
                </span>
              )}
            </div>
          )}
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

  const setMessagesForConversation = useCallback((conversationId: string, updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    const normalizedConversationId = String(conversationId);
    if (!normalizedConversationId) return;
    const store = useAppStore.getState();
    const current = store.messagesByConversationId[normalizedConversationId] || [];
    const next = typeof updater === "function" ? updater(current) : updater;
    store.setMessages(normalizedConversationId, next);
  }, []);

  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    const activeId = useAppStore.getState().activeConversationId;
    if (!activeId) return;
    setMessagesForConversation(activeId, updater);
  }, [setMessagesForConversation]);

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
  const runtime = useRuntime();
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [pendingBackgroundUpdates, setPendingBackgroundUpdates] = useState(0);
  const [conversationListHeight, setConversationListHeight] = useState(520);
  const [leadInsight, setLeadInsight] = useState<LeadIntentResult | null>(null);
  const [suggestingResponse, setSuggestingResponse] = useState(false);
  const [responseSearchQuery, setResponseSearchQuery] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>(DEFAULT_QUICK_REPLIES);
  const [quickReplyCategory, setQuickReplyCategory] = useState<string>("all");
  const [isQuickReplyDialogOpen, setIsQuickReplyDialogOpen] = useState(false);
  const [qrDialogId, setQrDialogId] = useState<string | null>(null);
  const [qrDialogTitle, setQrDialogTitle] = useState("");
  const [qrDialogCategory, setQrDialogCategory] = useState("saudação");
  const [qrDialogFavorite, setQrDialogFavorite] = useState(false);
  const [qrDialogTags, setQrDialogTags] = useState<string[]>([]);
  const [qrDialogNewTag, setQrDialogNewTag] = useState("");
  const [qrDialogItems, setQrDialogItems] = useState<QuickReplyMediaItem[]>([]);
  const [aiMemory, setAiMemory] = useState<any | null>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"ai" | "lead" | "qr" | "tags" | "history" | "files">("ai");
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
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);
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
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const isTyping = useMemo(
    () => selectedConversation ? Boolean(typingByConversationId[selectedConversation.id]) : false,
    [selectedConversation, typingByConversationId],
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

  const activeSession = useMemo(() => {
    if (!Array.isArray(sessions)) return null;

    const active = pickActiveSession(sessions, selectedConversation?.sessionId);
    if (active) return active;

    // Fallback to matching conversation session even if disconnected
    if (selectedConversation?.sessionId) {
      const found = sessions.find((s) => s && s.id === selectedConversation.sessionId);
      if (found) return found;
    }

    // Fallback to the first available session
    return sessions[0] || null;
  }, [sessions, selectedConversation?.sessionId]);

  const isWhatsappConnected = activeSession ? isSessionActive(activeSession) : false;

  const connectedPhone = useMemo(() => {
    return (
      activeSession?.phone ||
      activeSession?.wid ||
      activeSession?.number ||
      activeSession?.id ||
      "Sem número"
    );
  }, [activeSession]);

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

  const fetchAiMemory = useCallback(async (phone: string) => {
    if (!phone) return;
    try {
      const response = await apiService.getMemoryByContact(phone);
      if (response && response.success && response.data) {
        setAiMemory(response.data);
      } else {
        setAiMemory(null);
      }
    } catch (err) {
      console.error("Failed to fetch AI memory:", err);
      setAiMemory(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedConversation?.phone) {
      setAiMemory(null);
      return;
    }
    void fetchAiMemory(selectedConversation.phone);
  }, [selectedConversation?.phone, messages.length, fetchAiMemory]);

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
      setMessagesForConversation(normalizedConversationId, merged);
    }
  }, [setMessagesForConversation, updateConversationMessageStore]);

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
          const currentStoreMessages = useAppStore.getState().messagesByConversationId[normalizedConversationId] || [];
          if (currentStoreMessages.length === 0) {
            setMessagesForConversation(normalizedConversationId, cached.messages);
          }
          setHasMoreMessages(cached.hasMore);
        }
        return;
      }

      if (!cached && persisted.length > 0) {
        const sortedPersisted = sortMessagesAsc(persisted);
        if (normalizeId(selectedConversationRef.current?.id) === normalizeId(normalizedConversationId)) {
          setMessagesForConversation(normalizedConversationId, sortedPersisted);
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
          setMessagesForConversation(normalizedConversationId, (prev) => {
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
    [hydrateConversationHistoryForAnalysis, markBackendOffline, markBackendOnline, showErrorToast, updateConversationMessageStore, setMessagesForConversation],
  );

  useEffect(() => {
    preferredSessionIdRef.current = preferredSessionId;
  }, [preferredSessionId]);

  useEffect(() => {
    loadConversationMessagesRef.current = loadConversationMessages;
  }, [loadConversationMessages]);

  useEffect(() => {
    if (!selectedConversation?.id) {
      // Just clear active selection, state handles clearing
      setHasMoreMessages(false);
      setPendingBackgroundUpdates(0);
      setUnseenRealtimeCount(0);
      setReplyingTo(null);
      messageIdsRef.current = new Set();
      return;
    }

    const normalizedId = String(selectedConversation.id);
    const storeMessages = useAppStore.getState().messagesByConversationId[normalizedId] || [];

    if (storeMessages.length > 0) {
      // Already has messages in Zustand, preserve them to keep WebSocket realtime state
      messageIdsRef.current = new Set(storeMessages.map((m) => m.id));
      const cached = messageCacheRef.current.get(getConversationKey(selectedConversation));
      setHasMoreMessages(cached ? cached.hasMore : storeMessages.length >= MESSAGE_PAGE_SIZE);
    } else {
      // Hydrate from cache or persistence if empty
      const cached = messageCacheRef.current.get(getConversationKey(selectedConversation));
      if (cached && cached.messages.length > 0) {
        setMessagesForConversation(normalizedId, cached.messages);
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
          setMessagesForConversation(normalizedId, sorted);
          setHasMoreMessages(sorted.length >= MESSAGE_PAGE_SIZE);
          messageIdsRef.current = new Set(sorted.map((m) => m.id));
        } else {
          setMessagesForConversation(normalizedId, []);
          setHasMoreMessages(false);
          setLoadingMessages(true);
          messageIdsRef.current = new Set();
        }
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
  }, [selectedConversation, setMessagesForConversation]);

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
      setMessagesForConversation(normalizedConversationId, (prev) => {
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
  }, [selectedConversation, messages, loadingOlderMessages, hasMoreMessages, markBackendOffline, showErrorToast, updateConversationMessageStore, setMessagesForConversation]);


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
          await refreshSessions();
          setBackendOnline(true);

          const selectedId = selectedConversationRef.current?.id;
          if (selectedId) await loadConversationMessagesRef.current(String(selectedId), { background: true, force: true });
        } catch (err) {
          markBackendOffline(err);
        } finally {
          fallbackSyncBusyRef.current = false;
        }
      })();
    }, OFFLINE_FALLBACK_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isRealtimeConnected, loadConversationMessages, markBackendOffline, refreshSessions]);

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

  // CRM Local State
  const [crmDetails, setCrmDetails] = useState<{ email: string; city: string; responsible: string; funnelStage?: string }>({ email: "", city: "", responsible: "" });

  useEffect(() => {
    if (!selectedConversation?.id) return;
    const cached = localStorage.getItem(`zapai_crm_${selectedConversation.id}`);
    if (cached) {
      try {
        setCrmDetails(JSON.parse(cached));
      } catch {
        setCrmDetails({ email: "", city: "", responsible: "Zapflow IA" });
      }
    } else {
      setCrmDetails({
        email: `${selectedConversation.contactName.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
        city: "São Paulo - SP",
        responsible: "Zapflow IA",
        funnelStage: selectedLeadMeta.label
      });
    }
  }, [selectedConversation?.id, selectedLeadMeta.label]);

  const updateCrmDetails = useCallback((fields: Partial<typeof crmDetails>) => {
    if (!selectedConversation?.id) return;
    setCrmDetails((prev) => {
      const next = { ...prev, ...fields };
      localStorage.setItem(`zapai_crm_${selectedConversation.id}`, JSON.stringify(next));
      return next;
    });
  }, [selectedConversation?.id]);

  const aiLiveInsights = useMemo(() => {
    const text = selectedConversationMessages.map((m) => m.content).join(" ").toLowerCase();

    // ── Sentiment mapping (real AI memory → display label) ──
    const sentimentMap: Record<string, string> = {
      positive: "Amigável",
      negative: "Insatisfeito",
      neutral: "Neutro",
    };
    const intentMap: Record<string, string> = {
      purchase_intent: "Comprar plano Zapflow",
      price_request: "Consultar valores",
      question: "Tirar dúvidas de fluxo",
      support: "Suporte técnico",
      information: "Conhecer ferramentas",
    };

    // ── If we have real AI Memory from PostgreSQL, use it ──
    if (aiMemory) {
      const mem = aiMemory;
      const mood = sentimentMap[mem.sentiment] || "Interessado";
      const intent = intentMap[mem.intent] || mem.intent || "Conhecer ferramentas";
      const totalMsgs = (mem.metrics?.inboundMessages || 0) + (mem.metrics?.outboundMessages || 0);
      const conversionProb = mem.sentiment === "positive" ? 75 :
        mem.sentiment === "negative" ? 15 :
        selectedLead?.lead_temperature === "ready_to_buy" ? 95 :
        selectedLead?.lead_temperature === "hot" ? 85 :
        selectedLead?.lead_temperature === "warm" ? 60 : 35;

      const churnRisk = mem.sentiment === "negative" ? "Alto" :
        mem.tags?.includes("needs_attention") ? "Alto" :
        mem.sentiment === "positive" ? "Baixo" : "Médio";

      const urgency = text.includes("urgente") || text.includes("agora") ? "Alta" :
        selectedLead?.lead_temperature === "cold" ? "Baixa" : "Média";

      let bestTime = "09h - 18h";
      if (selectedConversationMessages.length > 0) {
        const hours = selectedConversationMessages.map((m) => new Date(m.createdAt).getHours()).filter((h) => !isNaN(h));
        if (hours.length > 0) {
          const avg = Math.round(hours.reduce((a, b) => a + b) / hours.length);
          bestTime = `${avg - 1}h às ${avg + 1}h`;
        }
      }

      // Extract objections from tags
      const objectionTags = (mem.tags || []).filter((t: string) => t === "needs_attention" || t === "question");
      const objections = objectionTags.length > 0
        ? (text.includes("caro") || text.includes("desconto") ? "Preço da licença" :
           text.includes("prazo") || text.includes("tempo") ? "Prazo de implementação" : "Pendência identificada")
        : "Nenhuma";

      return {
        mood,
        urgency,
        churnRisk,
        conversionProb,
        bestTime,
        products: "Zapflow AI CRM",
        objections,
        objective: intent,
        // Extra fields from real AI Memory
        summary: mem.summary || "",
        tags: mem.tags || [],
        metrics: mem.metrics || {},
        totalMessages: totalMsgs,
        lastUpdated: mem.last_updated || null,
        isFromDb: true,
      };
    }

    // ── Fallback: heuristic analysis (no DB memory available) ──
    let mood = "Interessado";
    if (text.includes("obrigado") || text.includes("valeu") || text.includes("👍") || text.includes("ótimo") || text.includes("excelente")) {
      mood = "Amigável";
    } else if (text.includes("urgente") || text.includes("rapido") || text.includes("logo") || text.includes("agora") || text.includes("imediato")) {
      mood = "Urgente";
    } else if (text.includes("caro") || text.includes("desconto") || text.includes("dificil") || text.includes("mas") || text.includes("pensei")) {
      mood = "Cético";
    } else if (selectedConversationMessages.length === 0) {
      mood = "Neutro";
    }

    let urgency = "Média";
    if (text.includes("urgente") || text.includes("agora") || text.includes("rapido") || selectedLead?.lead_temperature === "ready_to_buy") {
      urgency = "Alta";
    } else if (selectedLead?.lead_temperature === "cold") {
      urgency = "Baixa";
    }

    let churnRisk = "Médio";
    if (text.includes("caro") || text.includes("vou pensar") || text.includes("outra hora") || text.includes("concorrente")) {
      churnRisk = "Alto";
    } else if (selectedLead?.lead_temperature === "hot" || selectedLead?.lead_temperature === "ready_to_buy") {
      churnRisk = "Baixo";
    }

    let conversionProb = 35;
    if (selectedLead?.lead_temperature === "ready_to_buy") conversionProb = 95;
    else if (selectedLead?.lead_temperature === "hot") conversionProb = 85;
    else if (selectedLead?.lead_temperature === "warm") conversionProb = 60;
    else if (selectedLead?.lead_temperature === "cold") conversionProb = 20;

    let bestTime = "09h - 18h";
    if (selectedConversationMessages.length > 0) {
      const hours = selectedConversationMessages.map((m) => new Date(m.createdAt).getHours()).filter((h) => !isNaN(h));
      if (hours.length > 0) {
        const avg = Math.round(hours.reduce((a, b) => a + b) / hours.length);
        bestTime = `${avg - 1}h às ${avg + 1}h`;
      }
    }

    let products = "Zapflow AI CRM";
    if (text.includes("api") || text.includes("integracao") || text.includes("webhook")) products = "Zapflow API Link";
    else if (text.includes("whatsapp") || text.includes("numero") || text.includes("sessao")) products = "WhatsApp Multi-Agent";

    let objections = "Nenhuma";
    if (text.includes("caro") || text.includes("desconto") || text.includes("baixar")) objections = "Preço da licença";
    else if (text.includes("prazo") || text.includes("tempo") || text.includes("demora")) objections = "Prazo de implementação";

    let objective = "Conhecer ferramentas";
    if (selectedLead?.intent === "purchase_intent") objective = "Comprar plano Zapflow";
    else if (selectedLead?.intent === "price_request") objective = "Consultar valores";
    else if (selectedLead?.intent === "question") objective = "Tirar dúvidas de fluxo";

    return {
      mood,
      urgency,
      churnRisk,
      conversionProb,
      bestTime,
      products,
      objections,
      objective,
      summary: "",
      tags: [] as string[],
      metrics: {} as Record<string, number>,
      totalMessages: 0,
      lastUpdated: null as string | null,
      isFromDb: false,
    };
  }, [selectedConversationMessages, selectedLead, aiMemory]);

  const filteredQuickReplies = useMemo(() => {
    const query = responseSearchQuery.trim().toLowerCase();
    return quickReplies.filter((item) => {
      const categoryMatches = quickReplyCategory === "all" || item.category === quickReplyCategory;
      if (!categoryMatches) return false;
      if (!query) return true;
      return item.text.toLowerCase().includes(query);
    });
  }, [quickReplies, quickReplyCategory, responseSearchQuery]);

  const favoriteQuickReplies = useMemo(() => {
    return filteredQuickReplies.filter((item) => item.favorite);
  }, [filteredQuickReplies]);

  const quickRepliesByCategory = useMemo(() => {
    const map: Record<string, QuickReplyItem[]> = {};
    for (const item of filteredQuickReplies) {
      if (!item.favorite) {
        const cat = item.category || "suporte";
        if (!map[cat]) map[cat] = [];
        map[cat].push(item);
      }
    }
    return map;
  }, [filteredQuickReplies]);

  const [activeSlashIndex, setActiveSlashIndex] = useState(0);

  const slashSuggestions = useMemo(() => {
    if (!messageInput.startsWith("/")) return [] as { cmd: string; desc: string; text: string }[];
    const needle = messageInput.slice(1).toLowerCase();
    
    // Add default slash commands
    const defaultCmds = [
      { cmd: "/catalogo", desc: "Link do catálogo oficial", text: "Aqui está o link para o nosso catálogo digital: https://zapflow.ai/catalogo" },
      { cmd: "/desconto", desc: "Cupom de 15% de desconto", text: "Consegui um desconto de 15% para você fechar hoje! Use o cupom ZAPVIP15." },
      { cmd: "/agendar", desc: "Link para agendamento de demo", text: "Claro! Vamos agendar uma demonstração de 15 minutos? Escolha o melhor dia/horário aqui: calendly.com/zapflow" },
      { cmd: "/saudar", desc: "Saudação amigável padrão", text: "Olá! Como posso te ajudar hoje?" },
      { cmd: "/preço", desc: "Valores das assinaturas", text: "Temos planos de assinatura a partir de R$ 97/mês. Gostaria de ver nossa tabela detalhada?" },
      { cmd: "/ajuda", desc: "Link da base de conhecimento", text: "Se precisar de ajuda com a configuração, acesse nossa base de conhecimento em docs.zapflow.ai." },
    ];

    // Combine with quick replies
    const qrCmds = quickReplies.map(qr => ({
      cmd: `/${qr.text.split(" ").slice(0, 2).join("_").toLowerCase().replace(/[^a-z0-9_]/g, "")}`,
      desc: `Resposta Rápida: ${qr.category}`,
      text: qr.text
    }));

    return [...defaultCmds, ...qrCmds].filter(item => 
      item.cmd.toLowerCase().includes(needle) || 
      item.text.toLowerCase().includes(needle) ||
      item.desc.toLowerCase().includes(needle)
    );
  }, [messageInput, quickReplies]);

  useEffect(() => {
    setActiveSlashIndex(0);
  }, [slashSuggestions.length]);

  const conversationRowData = useMemo(
    () => ({
      conversations: filteredConversations,
      selectedId: selectedConversation?.id ?? null,
      onSelect: (id: string) => {
        const normalizedId = normalizeId(id);
        setSelectedConversationId(normalizedId);
        void loadConversationMessages(normalizedId, { force: true });
        if (isMobile) setMobileScreen("chat");
        window.requestAnimationFrame(() => {
          if (messageInputRef.current) {
            messageInputRef.current.style.height = "auto";
            messageInputRef.current.focus();
          }
        });
        useAppStore.getState().updateConversationRealtime({
          id: normalizedId,
          unread: 0,
        });
      },
      leadByConversationId,
      typingByConversationId,
    }),
    [filteredConversations, isMobile, loadConversationMessages, selectedConversation?.id, leadByConversationId, typingByConversationId],
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

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!selectedConversationId) return;
    try {
      const response = await apiService.deleteMessage(messageId);
      if (response.success) {
        useAppStore.getState().deleteMessage(selectedConversationId, messageId);
        toast({ title: "Mensagem excluída com sucesso" });
      } else {
        toast({ title: "Falha ao excluir mensagem", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao tentar excluir a mensagem", variant: "destructive" });
    }
  }, [selectedConversationId, toast]);

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

  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    let intervalId: number | undefined;
    if (isRecording) {
      setRecordingTime(0);
      intervalId = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [isRecording]);

  const handleCancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setIsRecording(false);
    }
  }, [isRecording]);

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

    // Debug visual
    console.log({
      conversationId: selectedConversation?.id,
      sessionId: activeSession?.id,
      connected: isWhatsappConnected,
      message: text
    });

    if (!selectedConversation?.phone || (!textWithReply && attachments.length === 0) || sending) return;
    if (!backendOnline) {
      setError("Servidor reconectando... envio temporariamente indisponível.");
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

      setMessagesForConversation(selectedConversation.id, (prev) => {
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

        const returnedMsg = response.message;
        const realId = returnedMsg?.id || returnedMsg?.key?.id;
        const realStatus = "sent";

        setMessagesForConversation(selectedConversation.id, (prev) => {
          const next = prev.map((msg) => {
            if (msg.id === optimistic.id) {
              return {
                ...msg,
                id: realId || msg.id,
                status: realStatus,
                url: returnedMsg?.url ?? returnedMsg?.mediaUrl ?? msg.url,
              };
            }
            return msg;
          });
          updateConversationMessageStore(
            selectedConversation.id,
            next,
            messageCacheRef.current.get(selectedConversation.id)?.hasMore ?? hasMoreMessages,
          );
          return next;
        });

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
        setMessagesForConversation(selectedConversation.id, (prev) => {
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
  }, [activeSession, attachments, backendOnline, clearPendingFallbackTimersForTempId, hasMoreMessages, isWhatsappConnected, loadConversationMessages, messageInput, preferredSessionId, refreshSessions, replyingTo, selectedConversation, sending, sessions, showErrorToast, updateConversationMessageStore, setMessagesForConversation]);

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

  const handleClearSelectedConversation = useCallback(() => {
    if (!selectedConversation?.id) return;
    setMessagesForConversation(selectedConversation.id, []);
    updateConversationMessageStore(selectedConversation.id, [], false);
    toast({ title: "Conversa limpa localmente." });
  }, [selectedConversation?.id, setMessagesForConversation, updateConversationMessageStore, toast]);

  const handleBlockContact = useCallback(() => {
    if (!selectedConversation?.contactName) return;
    toast({
      title: `Contato ${selectedConversation.contactName} bloqueado (simulado).`,
      variant: "destructive",
    });
  }, [selectedConversation?.contactName, toast]);

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

  // Load Quick Replies on Mount
  useEffect(() => {
    const loadQuickReplies = async () => {
      try {
        const list = await apiService.getQuickReplies();
        if (list && Array.isArray(list)) {
          const mapped = list.map((qr: any) => ({
            id: qr.id,
            title: qr.title || qr.content || "",
            category: qr.category || "general",
            text: qr.content || qr.items?.[0]?.value || qr.title || "",
            favorite: qr.favorite,
            items: qr.items || [{ type: "text", value: qr.content || qr.title }],
            tags: qr.tags || [],
          }));
          setQuickReplies(mapped);
        }
      } catch (err) {
        console.error("Failed to load quick replies:", err);
      }
    };
    void loadQuickReplies();
  }, []);

  const sendQuickReply = useCallback(async (arg: string | QuickReplyItem) => {
    if (!selectedConversation) return;

    if (typeof arg === "string") {
      await handleSendMessage(arg);
      return;
    }

    const items = arg.items || [{ type: "text", value: arg.text }];
    setSending(true);

    try {
      for (const item of items) {
        if (!selectedConversation) break;

        const payload: any = {
          phone: selectedConversation.phone,
          conversationId: selectedConversation.id,
          contactId: selectedConversation.contactId,
          sessionId: selectedConversation.sessionId || preferredSessionId || undefined,
        };

        if (item.type === "text") {
          await apiService.sendMessage({
            ...payload,
            text: item.value,
          });
        } else {
          await apiService.sendMediaMessage({
            phone: selectedConversation.phone,
            conversationId: selectedConversation.id,
            contactId: selectedConversation.contactId,
            sessionId: selectedConversation.sessionId || preferredSessionId || undefined,
            mediaType: item.type as any,
            fileName: item.filename || `${item.type}_file`,
            mimeType: "",
            dataBase64: item.value,
          });
        }

        // Delay of 600ms between sends to prevent overlapping
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      notify.success("Automação enviada com sucesso.");
    } catch (err) {
      notify.error("Falha ao enviar itens da automação.");
      console.error(err);
    } finally {
      setSending(false);
    }

    await loadConversationMessages(selectedConversation.id);
  }, [selectedConversation, preferredSessionId, handleSendMessage, loadConversationMessages]);

  const deleteQuickReply = useCallback(async (quickReplyId: string) => {
    try {
      await apiService.deleteQuickReply(quickReplyId);
      setQuickReplies((prev) => prev.filter((item) => item.id !== quickReplyId));
      notify.success("Resposta rápida excluída.");
    } catch (err) {
      notify.error("Falha ao excluir resposta rápida.");
    }
  }, []);

  const toggleFavoriteQuickReply = useCallback(async (quickReplyId: string) => {
    const reply = quickReplies.find((item) => item.id === quickReplyId);
    if (!reply) return;
    try {
      await apiService.updateQuickReply(quickReplyId, {
        favorite: !reply.favorite,
      });
      setQuickReplies((prev) =>
        prev.map((item) => (item.id === quickReplyId ? { ...item, favorite: !item.favorite } : item)),
      );
    } catch (err) {
      notify.error("Falha ao atualizar favorito.");
    }
  }, [quickReplies]);

  const duplicateQuickReply = useCallback(async (item: QuickReplyItem) => {
    try {
      const newPayload = {
        title: `${item.title || "Cópia"} (cópia)`,
        category: item.category,
        favorite: false,
        tags: item.tags || [],
        items: item.items || [{ type: "text", value: item.text }],
      };
      const created = await apiService.createQuickReply(newPayload);
      setQuickReplies((prev) => [
        ...prev,
        {
          id: created.id,
          title: created.title,
          category: created.category,
          text: created.content || created.items?.[0]?.value || created.title || "",
          favorite: created.favorite,
          items: created.items,
          tags: created.tags || [],
        },
      ]);
      notify.success("Resposta rápida duplicada.");
    } catch (err) {
      notify.error("Falha ao duplicar.");
    }
  }, []);

  const addQrDialogTextItem = () => {
    setQrDialogItems((prev) => [...prev, { id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, type: "text", value: "" }]);
  };

  const handleQrDialogMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
        notify.error(`O arquivo ${file.name} excede o limite de 10MB.`);
        continue;
      }
      
      try {
        const type = detectMediaType(file);
        const base64 = await fileToBase64(file);
        const value = `data:${file.type};base64,${base64}`;
        setQrDialogItems((prev) => [...prev, { id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, type, value, filename: file.name }]);
      } catch (err) {
        notify.error(`Erro ao carregar arquivo: ${file.name}`);
      }
    }
    
    event.target.value = "";
  };

  const removeQrDialogItem = (index: number) => {
    setQrDialogItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const moveQrDialogItem = (index: number, direction: "up" | "down") => {
    setQrDialogItems((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const openCreateQuickReplyDialog = () => {
    setQrDialogId(null);
    setQrDialogTitle("");
    setQrDialogCategory("saudação");
    setQrDialogFavorite(false);
    setQrDialogTags([]);
    setQrDialogItems([{ id: `item-${Date.now()}-initial`, type: "text", value: "" }]);
    setIsQuickReplyDialogOpen(true);
  };

  const openEditQuickReplyDialog = (reply: QuickReplyItem) => {
    setQrDialogId(reply.id);
    setQrDialogTitle(reply.title || reply.text || "");
    setQrDialogCategory(reply.category);
    setQrDialogFavorite(Boolean(reply.favorite));
    setQrDialogTags(reply.tags || []);
    
    const itemsWithIds = (reply.items || [{ type: "text", value: reply.text }]).map((item, index) => ({
      ...item,
      id: item.id || `item-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
    }));
    setQrDialogItems(itemsWithIds);
    setIsQuickReplyDialogOpen(true);
  };

  const saveQuickReplyDialog = async () => {
    const title = qrDialogTitle.trim();
    if (!title) {
      notify.error("O título é obrigatório.");
      return;
    }
    
    const items = qrDialogItems.map(item => ({
      ...item,
      value: item.value.trim(),
    })).filter(item => item.value);

    if (items.length === 0) {
      notify.error("Adicione pelo menos um item com conteúdo.");
      return;
    }

    const payload = {
      title,
      category: qrDialogCategory,
      favorite: qrDialogFavorite,
      tags: qrDialogTags,
      items,
    };

    try {
      if (qrDialogId) {
        const updated = await apiService.updateQuickReply(qrDialogId, payload);
        setQuickReplies((prev) =>
          prev.map((item) =>
            item.id === qrDialogId
              ? {
                  id: updated.id,
                  title: updated.title,
                  category: updated.category,
                  text: updated.content || updated.items?.[0]?.value || updated.title || "",
                  favorite: updated.favorite,
                  items: updated.items,
                  tags: updated.tags || [],
                }
              : item
          )
        );
        notify.success("Resposta rápida atualizada.");
      } else {
        const created = await apiService.createQuickReply(payload);
        setQuickReplies((prev) => [
          ...prev,
          {
            id: created.id,
            title: created.title,
            category: created.category,
            text: created.content || created.items?.[0]?.value || created.title || "",
            favorite: created.favorite,
            items: created.items,
            tags: created.tags || [],
          },
        ]);
        notify.success("Resposta rápida criada.");
      }
      setIsQuickReplyDialogOpen(false);
    } catch (err) {
      notify.error("Falha ao salvar resposta rápida.");
    }
  };

  const renderQuickReplyRow = (item: QuickReplyItem) => (
    <div
      key={item.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.text);
      }}
      onClick={() => {
        setMessageInput(item.text);
      }}
      onDoubleClick={() => {
        void sendQuickReply(item);
      }}
      className="group rounded-md border border-border/50 bg-background/30 p-1.5 transition-all hover:border-border hover:bg-background/60 hover:shadow-sm cursor-pointer active:scale-[0.98] select-none"
    >
      <div className="flex items-start justify-between gap-1.5">
        <h4 className="font-semibold text-[11.5px] text-foreground truncate flex-grow">
          {item.title || item.text.split("\n")[0]}
        </h4>
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-0.5 max-w-[50%] overflow-hidden shrink-0">
            {item.tags.slice(0, 2).map(t => (
              <span key={t} className="text-[8px] px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 scale-90">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground mt-0.5">{item.text}</p>
      <div className="mt-1.5 flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
        <Button size="sm" className="h-6 flex-grow text-[10px]" onClick={(e) => { e.stopPropagation(); void sendQuickReply(item); }}>
          <PaperPlaneTilt className="mr-1 h-3 w-3" weight="fill" /> Enviar
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); toggleFavoriteQuickReply(item.id); }} title="Favoritar">
          <Star className={cn("h-3 w-3", item.favorite ? "text-warning" : "text-muted-foreground")} weight={item.favorite ? "fill" : "regular"} />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEditQuickReplyDialog(item); }} title="Editar">
          <PencilSimple className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); duplicateQuickReply(item); }} title="Duplicar">
          <CopySimple className="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deleteQuickReply(item.id); }} title="Excluir">
          <Trash className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  const handleInsertTag = useCallback((tag: string) => {
    if (!selectedConversation || !tag) return;
    const currentTags = selectedConversation.tags ?? [];
    if (currentTags.includes(tag)) return;
    const nextTags = [...currentTags, tag];
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversation.id ? { ...c, tags: nextTags } : c)),
    );
    emitInboxSocketEvent("add_tag", { chatId: selectedConversation.id, tag });
  }, [selectedConversation, setConversations]);

  const leadPanelContent = selectedConversation ? (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Tabs value={rightPanelTab} onValueChange={(v) => setRightPanelTab(v as any)} className="flex h-full w-full flex-col overflow-hidden">
        <div className="sticky top-0 z-10 -mx-1 mb-2 bg-card/40 px-1 pb-2 pt-0.5 backdrop-blur supports-[backdrop-filter]:bg-card/30 shrink-0">
          <div className="flex overflow-x-auto scrollbar-none border-b border-border bg-muted/40 p-1 rounded-lg">
            <TabsList className="flex w-max space-x-1 bg-transparent">
              <TabsTrigger value="ai" className="text-xs px-2.5 h-7 transition-all data-[state=active]:shadow-sm">IA</TabsTrigger>
              <TabsTrigger value="lead" className="text-xs px-2.5 h-7 transition-all data-[state=active]:shadow-sm">Lead</TabsTrigger>
              <TabsTrigger value="files" className="text-xs px-2.5 h-7 transition-all data-[state=active]:shadow-sm">Arquivos</TabsTrigger>
              <TabsTrigger value="qr" className="text-xs px-2.5 h-7 transition-all data-[state=active]:shadow-sm">Automação</TabsTrigger>
              <TabsTrigger value="history" className="text-xs px-2.5 h-7 transition-all data-[state=active]:shadow-sm">Histórico</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ============ TAB IA ============ */}
        <TabsContent value="ai" className="mt-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin animate-fade-in data-[state=inactive]:hidden min-h-0">
          <InboxSectionBoundary fallbackLabel="Insights IA">
          {/* ── Header: Insights IA + DB Status ── */}
          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none" />
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Insights IA em Tempo Real
              {aiLiveInsights.isFromDb && (
                <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  DB Sync
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-muted/30 p-2 border border-border/40">
                <span className="text-muted-foreground block mb-0.5">Sentimento</span>
                <span className={cn("font-semibold", aiLiveInsights.mood === "Insatisfeito" ? "text-destructive" : aiLiveInsights.mood === "Amigável" ? "text-emerald-400" : "text-foreground")}>{aiLiveInsights.mood}</span>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 border border-border/40">
                <span className="text-muted-foreground block mb-0.5">Urgência</span>
                <span className={cn("font-semibold", aiLiveInsights.urgency === "Alta" ? "text-destructive" : "text-foreground")}>{aiLiveInsights.urgency}</span>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 border border-border/40">
                <span className="text-muted-foreground block mb-0.5">Risco de Abandono</span>
                <span className={cn("font-semibold", aiLiveInsights.churnRisk === "Alto" ? "text-destructive" : aiLiveInsights.churnRisk === "Baixo" ? "text-emerald-400" : "text-foreground")}>{aiLiveInsights.churnRisk}</span>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 border border-border/40">
                <span className="text-muted-foreground block mb-0.5">Conversão</span>
                <span className={cn("font-semibold", aiLiveInsights.conversionProb >= 70 ? "text-emerald-400" : aiLiveInsights.conversionProb <= 25 ? "text-destructive" : "text-foreground")}>{aiLiveInsights.conversionProb}%</span>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 border border-border/40 col-span-2">
                <span className="text-muted-foreground block mb-0.5">Melhor horário para contato</span>
                <span className="font-semibold text-foreground">{aiLiveInsights.bestTime}</span>
              </div>
            </div>
          </div>

          {/* ── AI Memory Summary (from PostgreSQL) ── */}
          {aiLiveInsights.summary && (
            <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                Resumo IA Persistido
              </p>
              <p className="text-xs leading-relaxed text-foreground/90 bg-muted/20 p-2.5 rounded-lg border border-border/40">
                {aiLiveInsights.summary}
              </p>
              {aiLiveInsights.lastUpdated && (
                <p className="mt-1.5 text-[9px] text-muted-foreground text-right">
                  Atualizado: {new Date(aiLiveInsights.lastUpdated).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}

          {/* ── Tags from AI Memory ── */}
          {aiLiveInsights.tags.length > 0 && (
            <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tags IA</p>
              <div className="flex flex-wrap gap-1.5">
                {aiLiveInsights.tags.map((tag: string, idx: number) => (
                  <span key={`${tag}-${idx}`} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Metrics from AI Memory ── */}
          {aiLiveInsights.isFromDb && aiLiveInsights.totalMessages > 0 && (
            <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Métricas da Conversa</p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg bg-muted/30 p-2 border border-border/40 text-center">
                  <span className="text-muted-foreground block mb-0.5 text-[9px]">Recebidas</span>
                  <span className="font-bold text-foreground text-sm">{aiLiveInsights.metrics?.inboundMessages || 0}</span>
                </div>
                <div className="rounded-lg bg-muted/30 p-2 border border-border/40 text-center">
                  <span className="text-muted-foreground block mb-0.5 text-[9px]">Enviadas</span>
                  <span className="font-bold text-foreground text-sm">{aiLiveInsights.metrics?.outboundMessages || 0}</span>
                </div>
                <div className="rounded-lg bg-muted/30 p-2 border border-border/40 text-center">
                  <span className="text-muted-foreground block mb-0.5 text-[9px]">Áudios</span>
                  <span className="font-bold text-foreground text-sm">{aiLiveInsights.metrics?.audioMessages || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Próxima Ação IA ── */}
          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Próxima Ação IA</p>
            <div className="space-y-2 bg-muted/20 p-2.5 rounded-lg border border-border/40 text-xs">
              <div className="flex-grow">
                <span className="font-bold text-foreground">Ação recomendada:</span>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">
                  {selectedLead?.next_action === "close_sale" ? "Oferecer fechamento do plano Zapflow imediatamente e mover para 'Fechado Ganho'." :
                   selectedLead?.next_action === "send_price" ? "Enviar tabela de planos e propor simulação de ROI." :
                   selectedLead?.next_action === "overcome_objection" ? "Enviar cupom de 15% (ZAPVIP15) para remover barreira de preço." :
                   "Apresentar funcionalidades da IA Zapflow no modo demonstrativo."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-[10px] font-medium"
                onClick={() => {
                  const replyText =
                    selectedLead?.next_action === "close_sale" ? "Vamos fechar o seu plano Zapflow? Posso gerar o link de pagamento Pix agora." :
                    selectedLead?.next_action === "send_price" ? "Seguem nossos valores detalhados. O plano Start fica R$ 97/mês." :
                    selectedLead?.next_action === "overcome_objection" ? "Consigo liberar um cupom exclusivo de 15% de desconto se fecharmos hoje! O que acha?" :
                    "Olá! Estou aqui para te ajudar. Gostaria de entender mais sobre o seu negócio.";
                  setMessageInput(replyText);
                  toast({ title: "Template inserido na caixa de texto" });
                }}
              >
                Usar Resposta Recomendada
              </Button>
            </div>
          </div>

          {/* ── Resumo Automático (Intenção, Produtos, Objeções) ── */}
          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Análise Detalhada</p>
            <div className="space-y-2 text-xs leading-relaxed">
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 font-semibold w-16">Intenção:</span>
                <span className="text-foreground">{aiLiveInsights.objective}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 font-semibold w-16">Produtos:</span>
                <span className="text-foreground">{aiLiveInsights.products}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 font-semibold w-16">Objeções:</span>
                <span className="text-foreground">{aiLiveInsights.objections}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground shrink-0 font-semibold w-16">Funil:</span>
                <span className="text-foreground">{crmDetails.funnelStage || selectedLeadMeta.label}</span>
              </div>
            </div>
          </div>
          </InboxSectionBoundary>
        </TabsContent>

        {/* ============ TAB LEAD (CRM) ============ */}
        <TabsContent value="lead" className="mt-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin animate-fade-in data-[state=inactive]:hidden min-h-0">
          <InboxSectionBoundary fallbackLabel="Lead CRM">
          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Perfil do Lead</p>
              <Badge variant="secondary" className="h-4.5 px-1.5 text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold">Qualificado</Badge>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3 border-b border-border/20 pb-1.5">
                <span className="text-muted-foreground">Nome</span>
                <span className="truncate font-semibold text-foreground">{selectedConversation.contactName}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/20 pb-1.5">
                <span className="text-muted-foreground">Telefone</span>
                <span className="truncate font-mono font-semibold text-foreground">{selectedConversation.phone || "—"}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-border/20 pb-1.5">
                <span className="text-muted-foreground">Email</span>
                <Input
                  value={crmDetails.email}
                  onChange={(e) => updateCrmDetails({ email: e.target.value })}
                  className="h-7 text-xs bg-muted/20 border-border/50 focus:border-primary/50"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="flex flex-col gap-1 border-b border-border/20 pb-1.5">
                <span className="text-muted-foreground">Cidade</span>
                <Input
                  value={crmDetails.city}
                  onChange={(e) => updateCrmDetails({ city: e.target.value })}
                  className="h-7 text-xs bg-muted/20 border-border/50 focus:border-primary/50"
                  placeholder="Cidade - UF"
                />
              </div>
              <div className="flex flex-col gap-1 border-b border-border/20 pb-1.5">
                <span className="text-muted-foreground">Responsável</span>
                <Input
                  value={crmDetails.responsible}
                  onChange={(e) => updateCrmDetails({ responsible: e.target.value })}
                  className="h-7 text-xs bg-muted/20 border-border/50 focus:border-primary/50"
                  placeholder="Atendente"
                />
              </div>
              <div className="flex items-center justify-between gap-3 pb-0.5">
                <span className="text-muted-foreground">Último contato</span>
                <span className="font-semibold text-foreground">{selectedConversation.updatedAt ? formatTime(selectedConversation.updatedAt) : "—"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Funil de Vendas</p>
            <div className="flex items-center gap-2">
              <select
                value={crmDetails.funnelStage || selectedLeadMeta.label}
                onChange={(e) => {
                  updateCrmDetails({ funnelStage: e.target.value });
                  toast({ title: `Lead movido para: ${e.target.value}` });
                  const timelineKey = `timeline_${selectedConversation.id}`;
                  const currentList = JSON.parse(localStorage.getItem(timelineKey) || "[]");
                  localStorage.setItem(timelineKey, JSON.stringify([
                    {
                      id: `t-${Date.now()}`,
                      type: "funnel",
                      title: "Lead Movido de Etapa",
                      description: `Mover para Funil: ${e.target.value}`,
                      timestamp: new Date().toISOString()
                    },
                    ...currentList
                  ]));
                }}
                className="h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary w-full"
              >
                <option value="Novo Lead">Novo Lead</option>
                <option value="Qualificado">Qualificado</option>
                <option value="Apresentação">Apresentação</option>
                <option value="Negociação">Negociação</option>
                <option value="Pronto para compra">Pronto para compra</option>
                <option value="Fechado Ganho">Fechado Ganho</option>
                <option value="Fechado Perdido">Fechado Perdido</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Atalhos de Gestão</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start hover:bg-muted"
              onClick={() => toast({ title: "Perfil do cliente aberto no CRM principal" })}
            >
              Abrir contato no CRM
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start hover:bg-muted"
              onClick={() => {
                toast({ title: "Lembrete agendado para amanhã" });
                const timelineKey = `timeline_${selectedConversation.id}`;
                const currentList = JSON.parse(localStorage.getItem(timelineKey) || "[]");
                localStorage.setItem(timelineKey, JSON.stringify([
                  {
                    id: `t-${Date.now()}`,
                    type: "system",
                    title: "Lembrete Agendado",
                    description: "Retorno agendado para amanhã",
                    timestamp: new Date().toISOString()
                  },
                  ...currentList
                ]));
              }}
            >
              Agendar Lembrete
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30"
              onClick={() => {
                toast({ title: "Lead arquivado com sucesso" });
                handleArchiveChat(selectedConversation.id);
              }}
            >
              Remover Lead
            </Button>
          </div>

          {/* Etiquetas / Tags (movidas da aba Etiquetas) */}
          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm mt-3">
            <p className="mb-2.5 text-xs font-semibold text-foreground">Etiquetas Ativas</p>
            <div className="flex flex-wrap gap-1.5 min-h-[48px] border border-dashed border-border/40 rounded-lg p-2 bg-muted/10">
              {(selectedConversation.tags ?? []).length > 0 ? (
                selectedConversation.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn("gap-1 py-0.5 pl-2 pr-1 h-5 text-[10px] font-semibold rounded-md border", getTagColor(tag))}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTagFromSelectedConversation(tag)}
                      className="text-foreground hover:text-red-400 font-bold ml-0.5 text-xs"
                    >
                      ×
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground/60 m-auto">Sem etiquetas associadas</span>
              )}
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              <Input
                value={newTagInput}
                onChange={(event) => setNewTagInput(event.target.value)}
                placeholder="Nova tag..."
                className="h-8 text-xs bg-muted/20 border-border/50 focus:border-primary/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTagToSelectedConversation();
                }}
              />
              <Button size="sm" variant="outline" className="h-8" onClick={handleAddTagToSelectedConversation}>
                Adicionar
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm mt-3">
            <p className="mb-2 text-xs font-semibold text-foreground">Sugeridas pela IA</p>
            <div className="flex flex-wrap gap-1.5">
              {["Quente", "Preços", "Dúvida SDR", "Aguardando Demo"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleInsertTag(tag)}
                  className="text-[10px] px-2 py-1 rounded bg-muted/50 border border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors font-semibold"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>
          </InboxSectionBoundary>
        </TabsContent>

        {/* ============ TAB RESPOSTAS (QUICK REPLIES) ============ */}
        <TabsContent value="qr" className="mt-0 flex-1 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin animate-fade-in data-[state=inactive]:hidden min-h-0">
          <InboxSectionBoundary fallbackLabel="Quick Replies">
          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">IA Automática</p>
                <p className="text-[10px] text-muted-foreground">
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

          <div className="flex gap-2">
            <div className="relative flex-grow">
              <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={responseSearchQuery}
                onChange={(event) => setResponseSearchQuery(event.target.value)}
                placeholder="Buscar resposta..."
                className="h-9 pl-9 text-xs bg-muted/20 border-border/50 focus:border-primary/50"
              />
            </div>
            <Button size="sm" onClick={openCreateQuickReplyDialog} className="h-9 gap-1 rounded-lg">
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 shrink-0">
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
            <div className="rounded-xl border border-border bg-card/45 p-2.5 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#25D366]">
                <Star className="h-3 w-3 text-warning" weight="fill" /> Favoritas
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
                <AccordionItem key={cat} value={cat} className="rounded-xl border border-border bg-card/40 px-3 py-0.5">
                  <AccordionTrigger className="py-2 text-xs font-semibold capitalize hover:no-underline text-foreground">
                    <span className="flex items-center gap-2">
                      {cat}
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-muted">{items.length}</Badge>
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
            <p className="text-center text-xs text-muted-foreground">Nenhuma resposta encontrada.</p>
          )}
          </InboxSectionBoundary>
        </TabsContent>


        {/* ============ TAB HISTÓRICO (TIMELINE) ============ */}
        <TabsContent value="history" className="mt-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin animate-fade-in data-[state=inactive]:hidden min-h-0">
          <InboxSectionBoundary fallbackLabel="Histórico">
          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
            <p className="mb-3 text-xs font-semibold text-foreground">Histórico do Contato</p>
            <div className="relative pl-4 border-l border-border/80 ml-2 space-y-4 text-xs">
              {(() => {
                const timelineKey = `timeline_${selectedConversation.id}`;
                const listStr = localStorage.getItem(timelineKey);
                let list = listStr ? JSON.parse(listStr) : [];
                if (list.length === 0) {
                  // Fallback default timeline log entries
                  list = [
                    { id: "1", type: "message", title: "Mensagem Recebida", description: "Iniciou contato via WhatsApp", timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
                    { id: "2", type: "ai", title: "IA Analisou Intenção", description: `Mapeado como: ${selectedLead?.intent ?? "informação"}`, timestamp: new Date(Date.now() - 25 * 60000).toISOString() },
                    { id: "3", type: "funnel", title: "Etapa de Funil Atualizada", description: `Mapeado automaticamente para: ${selectedLeadMeta.label}`, timestamp: new Date(Date.now() - 24 * 60000).toISOString() },
                  ];
                }
                return list.map((evt: any) => (
                  <div key={evt.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 flex h-2 w-2 rounded-full bg-primary ring-4 ring-[#0C0F14]" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{evt.title}</span>
                      <span className="text-[10px] text-muted-foreground/70">{formatTime(evt.timestamp)}</span>
                    </div>
                    <p className="text-muted-foreground/80 mt-0.5">{evt.description}</p>
                  </div>
                ));
              })()}
            </div>
          </div>
          </InboxSectionBoundary>
        </TabsContent>

        {/* ============ TAB ARQUIVOS (GALLERY) ============ */}
        <TabsContent value="files" className="mt-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin animate-fade-in data-[state=inactive]:hidden min-h-0">
          <InboxSectionBoundary fallbackLabel="Arquivos">
          <div className="rounded-xl border border-border bg-card/40 p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold text-foreground">Arquivos e Mídias Compartilhados</p>
            {(() => {
              const mediaMessages = selectedConversationMessages.filter(m => m.mediaUrl || m.url || (m.mediaType && m.mediaType !== "text"));
              if (mediaMessages.length === 0) {
                return <p className="text-xs text-muted-foreground/70 text-center py-6">Nenhuma mídia encontrada neste chat.</p>;
              }
              return (
                <div className="grid grid-cols-2 gap-2">
                  {mediaMessages.map((msg) => {
                    const url = resolveMediaUrl(msg.url ?? msg.mediaUrl);
                    if (!url) return null;
                    return (
                      <div key={msg.id} className="relative rounded-lg border border-border/40 bg-muted/20 p-1 flex flex-col justify-between overflow-hidden">
                        {msg.mediaType === "image" ? (
                          <img
                            src={url}
                            alt="Imagem"
                            className="h-20 w-full object-cover rounded cursor-pointer"
                            onClick={() => handleOpenMediaPreview(url, "image")}
                          />
                        ) : msg.mediaType === "video" ? (
                          <video
                            src={url}
                            className="h-20 w-full object-cover rounded cursor-pointer animate-fade-in"
                            onClick={() => handleOpenMediaPreview(url, "video")}
                          />
                        ) : (
                          <div className="h-20 w-full flex items-center justify-center bg-muted/40 rounded">
                            <FileIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 text-[10px] text-center font-semibold truncate text-primary hover:underline"
                          download
                        >
                          Baixar
                        </a>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          </InboxSectionBoundary>
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
                label={activeSession && isSessionActive(activeSession) ? "Baileys conectado" : "Baileys offline"}
                tone={activeSession && isSessionActive(activeSession) ? "online" : "warning"}
                pulse={Boolean(activeSession && isSessionActive(activeSession))}
              />
              <Button
                type="button"
                variant={activeSession && isSessionActive(activeSession) ? "secondary" : "outline"}
                onClick={() => navigate("/connections")}
              >
                {activeSession && isSessionActive(activeSession) ? "Gerenciar sessão" : "Conectar Baileys"}
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
                avatar={selectedConversation.avatar}
                initials={getInitials(selectedConversation.contactName)}
                isMobile={isMobile}
                onBack={() => setMobileScreen("conversations")}
                statusLabel={selectedConversationStatusLabel}
                rightActions={
                  <div className="flex items-center gap-1 relative select-none">
                    {/* Voz chamadas */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground/40 cursor-not-allowed"
                      disabled
                      title="Chamada de voz (Indisponível)"
                    >
                      <Phone className="h-5 w-5" />
                    </Button>

                    {/* Vídeo chamadas */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground/40 cursor-not-allowed"
                      disabled
                      title="Chamada de vídeo (Indisponível)"
                    >
                      <VideoCamera className="h-5 w-5" />
                    </Button>

                    {/* Busca */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground/80 hover:text-foreground hover:bg-muted"
                      onClick={() => {
                        toast({ title: "Recurso de busca na conversa em desenvolvimento." });
                      }}
                      title="Buscar conversa"
                    >
                      <MagnifyingGlass className="h-5 w-5" />
                    </Button>

                    {/* IA Cérebro */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleSetConversationAiEnabled(!aiEnabledForConversation)}
                      className={cn(
                        "h-9 w-9 rounded-full transition-all duration-300",
                        aiEnabledForConversation
                          ? "text-emerald-400 hover:text-emerald-300 bg-emerald-500/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                      title={aiEnabledForConversation ? "IA Automática Ativada" : "IA Automática Desativada"}
                    >
                      <Brain className="h-5 w-5" />
                    </Button>

                    {/* Contact Menu */}
                    <div className="relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => setIsContactMenuOpen((prev) => !prev)}
                        title="Opções do contato"
                      >
                        <DotsThreeVertical className="h-5 w-5" />
                      </Button>

                      {isContactMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsContactMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-10 z-50 w-52 rounded-lg border border-border bg-popover p-1 shadow-lg animate-fade-in text-left">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-foreground hover:bg-muted transition-colors"
                              onClick={() => {
                                handleClearSelectedConversation();
                                setIsContactMenuOpen(false);
                              }}
                            >
                              <Trash className="h-3.5 w-3.5" />
                              Limpar conversa
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-foreground hover:bg-muted transition-colors"
                              onClick={() => {
                                const isArchived = archivedChatIds.includes(selectedConversation.id);
                                if (isArchived) {
                                  handleUnarchiveSelectedConversation();
                                } else {
                                  handleArchiveSelectedConversation();
                                }
                                setIsContactMenuOpen(false);
                              }}
                            >
                              {archivedChatIds.includes(selectedConversation.id) ? (
                                <>
                                  <CaretLeft className="h-3.5 w-3.5" />
                                  Desarquivar conversa
                                </>
                              ) : (
                                <>
                                  <CaretRight className="h-3.5 w-3.5" />
                                  Arquivar conversa
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10 transition-colors"
                              onClick={() => {
                                handleBlockContact();
                                setIsContactMenuOpen(false);
                              }}
                            >
                              <Check className="h-3.5 w-3.5 text-destructive" />
                              Bloquear contato
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-foreground border-t border-border/40 mt-1 pt-2 hover:bg-muted transition-colors"
                              onClick={() => {
                                setRightPanelTab("lead");
                                setRightPanelCollapsed(false);
                                setIsContactMenuOpen(false);
                              }}
                            >
                              <PaperPlaneTilt className="h-3.5 w-3.5" />
                              Etiquetar & Exportar Lead
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                }
              />

              {/* Connection & Realtime Status Banners */}
              {runtime.status === "reconnecting" && (
                <div className="border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-2 flex items-center justify-center gap-2 text-xs text-yellow-400 select-none animate-pulse">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500"></span>
                  </span>
                  Reconectando ao servidor em tempo real...
                </div>
              )}

              {runtime.status === "offline" && (
                <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 flex items-center justify-center gap-2 text-xs text-red-400 select-none">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                  </span>
                  Servidor offline. Exibindo dados salvos localmente.
                </div>
              )}

              {runtime.status === "online" && !isWhatsappConnected && (
                <div className="border-b border-amber-500/25 bg-amber-500/5 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-400 select-none">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                    </span>
                    Sessão WhatsApp desconectada no momento
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 rounded-md px-2.5 text-[10px] font-semibold bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all"
                    onClick={() => navigate("/connections")}
                  >
                    Conectar WhatsApp
                  </Button>
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

              <ScrollArea className="min-h-0 flex-1 chat-area-bg">
                <div ref={messagesScrollRef} className={cn("mx-auto max-w-3xl space-y-3 p-4 pb-24 md:pb-16", isDraggingFiles && "rounded-xl border border-dashed border-primary p-3") }>
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
                            onDeleteMessage={handleDeleteMessage}
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
                  "border-t border-border bg-card/95 p-3 md:relative md:p-4 shrink-0",
                  isMobile && "fixed inset-x-0 bottom-0 z-30 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
                )}
                style={isMobile ? { bottom: `calc(${keyboardOffset}px + env(safe-area-inset-bottom))` } : undefined}
              >
                <div className="mx-auto max-w-3xl space-y-3">
                  {(isTyping || suggestingResponse) && (
                    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground animate-pulse">
                      <div className="flex space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span>
                        {suggestingResponse ? "IA analisando..." : "digitando..."}
                      </span>
                    </div>
                  )}

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

                  <div className="relative flex items-center gap-2 w-full">
                    {isRecording ? (
                      /* Audio Recording Mode UI */
                      <div className="flex flex-1 items-center justify-between bg-muted/40 rounded-xl px-4 py-1 h-11 border border-border/60 animate-pulse">
                        <div className="flex items-center">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                          </span>
                          <span className="text-xs font-semibold text-foreground/95 ml-2.5 font-mono">
                            Gravando áudio: {formatPlaybackTime(recordingTime)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                            onClick={handleCancelRecording}
                            title="Descartar gravação"
                          >
                            <Trash className="h-4.5 w-4.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                            onClick={handleToggleRecording}
                            title="Enviar gravação"
                          >
                            <Check className="h-4.5 w-4.5" weight="bold" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Input Mode UI */
                      <>
                        {/* Floating Slash Commands Autocomplete */}
                        {slashSuggestions.length > 0 && (
                          <div className="absolute bottom-full left-0 right-0 z-40 mb-2 max-h-52 overflow-y-auto rounded-lg border border-border bg-[#181d26]/95 p-1.5 shadow-2xl backdrop-blur scrollbar-thin">
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider border-b border-border/40 mb-1">
                              Comandos e Respostas Rápidas
                            </div>
                            {slashSuggestions.map((item, index) => (
                              <button
                                key={item.cmd + index}
                                type="button"
                                onClick={() => {
                                  setMessageInput(item.text);
                                  messageInputRef.current?.focus();
                                }}
                                onDoubleClick={() => {
                                  setMessageInput(item.text);
                                  void handleSendMessage(item.text);
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors",
                                  index === activeSlashIndex ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted text-foreground"
                                )}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className={cn("font-mono font-bold text-[11px]", index === activeSlashIndex ? "text-primary-foreground" : "text-primary")}>
                                    {item.cmd}
                                  </span>
                                  <span className="truncate opacity-90">{item.text}</span>
                                </div>
                                <span className={cn("text-[10px] shrink-0 ml-3", index === activeSlashIndex ? "text-primary-foreground/75" : "text-muted-foreground/60")}>
                                  {item.desc}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={MOBILE_TOUCH_TARGET_CLASS}
                          onClick={() => setShowEmojiPicker((prev) => !prev)}
                          aria-label="Abrir emojis"
                          data-emoji-trigger
                          disabled={!selectedConversation || sending || !isWhatsappConnected || !backendOnline}
                        >
                          <Smiley className="h-5 w-5" />
                        </Button>

                        <Button type="button" variant="ghost" size="icon" className={MOBILE_TOUCH_TARGET_CLASS} onClick={() => fileInputRef.current?.click()} aria-label="Anexar mídia" disabled={!selectedConversation || sending || !isWhatsappConnected || !backendOnline}>
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

                        <textarea
                          ref={messageInputRef}
                          rows={1}
                          placeholder={
                            !backendOnline
                              ? "Servidor reconectando..."
                              : !isWhatsappConnected
                                ? "WhatsApp offline. Conecte nas configurações para enviar."
                                : selectedConversation
                                  ? "Digite sua mensagem..."
                                  : "Selecione uma conversa para enviar mensagens"
                          }
                          className="flex min-h-[44px] max-h-[180px] w-full flex-1 resize-none rounded-lg border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 scrollbar-none"
                          value={messageInput}
                          disabled={!selectedConversation || sending || !isWhatsappConnected || !backendOnline}
                          onChange={(event) => {
                            setMessageInput(event.target.value);
                            const textarea = event.target;
                            textarea.style.height = "auto";
                            textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const text = e.dataTransfer.getData("text/plain");
                            if (text) {
                              setMessageInput((prev) => prev ? `${prev} ${text}` : text);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (slashSuggestions.length > 0) {
                              if (event.key === "ArrowDown") {
                                  event.preventDefault();
                                  setActiveSlashIndex((prev) => (prev + 1) % slashSuggestions.length);
                                  return;
                                }
                                if (event.key === "ArrowUp") {
                                  event.preventDefault();
                                  setActiveSlashIndex((prev) => (prev - 1 + slashSuggestions.length) % slashSuggestions.length);
                                  return;
                                }
                                if (event.key === "Enter" || event.key === "Tab") {
                                  event.preventDefault();
                                  const selected = slashSuggestions[activeSlashIndex];
                                  if (selected) {
                                    setMessageInput(selected.text);
                                  }
                                  return;
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setMessageInput("");
                                  return;
                                }
                              }
  
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void handleSendMessage();
                                if (messageInputRef.current) {
                                  messageInputRef.current.style.height = "auto";
                                }
                              }
                            }}
                          />
  
                          {messageInput.trim().length === 0 && attachments.length === 0 ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className={cn("rounded-full text-muted-foreground hover:text-foreground", MOBILE_TOUCH_TARGET_CLASS)}
                              onClick={handleToggleRecording}
                              disabled={!selectedConversation || !isWhatsappConnected || !backendOnline}
                              title="Gravar áudio"
                            >
                              <Microphone className="h-5 w-5" />
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              className={cn("rounded-full bg-primary text-primary-foreground", MOBILE_TOUCH_TARGET_CLASS)}
                              onClick={() => void handleSendMessage()}
                              disabled={!selectedConversation || sending || !isWhatsappConnected || !backendOnline}
                              aria-label="Enviar mensagem"
                            >
                            <PaperPlaneTilt weight="fill" className="h-5 w-5" />
                          </Button>
                        )}
                      </>
                    )}

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
          <>
            <Dialog open={Boolean(previewMedia)} onOpenChange={(open) => !open && setPreviewMedia(null)}>
              <DialogContent className="h-screen w-screen max-w-none border-none bg-black/95 p-0 shadow-none">
                <DialogTitle className="sr-only">Visualização de Mídia</DialogTitle>
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

            <Dialog open={isQuickReplyDialogOpen} onOpenChange={setIsQuickReplyDialogOpen}>
              <DialogContent className="sm:max-w-lg border-border/80 bg-card/95 backdrop-blur-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-display text-base text-foreground">
                    {qrDialogId ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="qr-title" className="text-xs text-foreground">Título</Label>
                    <Input
                      id="qr-title"
                      placeholder="Ex: Saudação Inicial"
                      value={qrDialogTitle}
                      onChange={(e) => setQrDialogTitle(e.target.value)}
                      className="h-8 text-xs bg-background/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="qr-category" className="text-xs text-foreground">Categoria</Label>
                      <select
                        id="qr-category"
                        value={qrDialogCategory}
                        onChange={(e) => setQrDialogCategory(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="saudação">Saudação</option>
                        <option value="vendas">Vendas</option>
                        <option value="suporte">Suporte</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        id="qr-favorite"
                        checked={qrDialogFavorite}
                        onChange={(e) => setQrDialogFavorite(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="qr-favorite" className="text-xs cursor-pointer select-none text-foreground">Favorita (Fixar no topo)</Label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">Sequência de Mensagens / Mídias</Label>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={addQrDialogTextItem}>
                          <Plus className="h-3 w-3" /> Texto
                        </Button>
                        <Label htmlFor="qr-file-upload" className="flex h-7 items-center justify-center rounded-md border border-input bg-background/50 px-2.5 text-[10px] font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer gap-1 text-foreground border-border/75">
                          <Paperclip className="h-3 w-3" /> Mídia
                        </Label>
                        <input
                          id="qr-file-upload"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => void handleQrDialogMediaUpload(e)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[250px] overflow-y-auto border border-border/40 rounded-lg p-2 bg-muted/10">
                      {qrDialogItems.length === 0 ? (
                        <p className="text-center text-[10px] text-muted-foreground py-4">Nenhum item adicionado à sequência.</p>
                      ) : (
                        qrDialogItems.map((item, idx) => (
                          <div key={item.id || idx} className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/50 p-2 group/item">
                            <div className="flex flex-col gap-0.5 pt-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveQrDialogItem(idx, "up")}
                                className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === qrDialogItems.length - 1}
                                onClick={() => moveQrDialogItem(idx, "down")}
                                className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                ▼
                              </button>
                            </div>

                            <div className="flex-grow min-w-0">
                              {item.type === "text" ? (
                                <textarea
                                  placeholder="Digite o texto da mensagem..."
                                  value={item.value}
                                  onChange={(e) => {
                                    const next = [...qrDialogItems];
                                    next[idx].value = e.target.value;
                                    setQrDialogItems(next);
                                  }}
                                  className="w-full min-h-[50px] bg-transparent border-0 focus:ring-0 resize-none text-xs text-foreground p-0 placeholder:text-muted-foreground/60"
                                />
                              ) : (
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                    {item.type === "image" ? "🖼️" : item.type === "video" ? "📹" : item.type === "audio" ? "🎵" : "📄"}
                                  </div>
                                  <div className="min-w-0 flex-grow">
                                    <p className="truncate font-semibold text-[10.5px] text-foreground">{item.filename || "Mídia"}</p>
                                    <p className="text-[9px] text-muted-foreground capitalize">{item.type}</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0 self-center"
                              onClick={() => removeQrDialogItem(idx)}
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsQuickReplyDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" onClick={() => void saveQuickReplyDialog()}>
                      Salvar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />
    </div>
  );
}
