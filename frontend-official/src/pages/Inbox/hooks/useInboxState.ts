import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRuntime } from "@/providers/RuntimeProvider";
import { useAppStore, resolveStoreConversationId } from "@/stores/appStore";
import { apiService, requestApiEndpoint, type ChatMessage, type Conversation, type SessionInfo, type MessageSendResponse } from "@/services/apiService";
import { notify } from "@/services/notifyService";
import { listConversationControls, upsertConversationControl } from "@/services/conversationControlStore";
import { useInboxSocket } from "./useInboxSocket";
import {
  isSessionActive,
  pickActiveSession,
  getConversationScope,
  getConversationMessageStorageKey,
  loadContactDirectory,
  persistContactDirectory,
  dedupeConversationsByScope,
  getPreferredSessionIdForConversations,
  filterConversationsForSession,
  loadPersistedConversations,
  persistConversations,
  loadPersistedConversationMessages,
  persistConversationMessages,
  normalizePhone,
  normalizeId,
  getConversationKey,
  normalizeLoadedMessage,
  sortMessagesAsc,
  mergeMessagesById,
  countNewMessageEntries,
  isViewportNearBottom,
  detectMediaType,
  getUploadLimitBytes,
  fileToBase64,
  estimateBase64Bytes,
  revokeAttachmentPreviewUrls,
  toConversationDateLabel,
  getConversationSourceLabel,
  sanitizeSidebarText,
  formatTime,
  getLeadTemperatureMeta,
  interpolateTemplateVariables,
  getQuickReplyPreviewText,
  getMediaTypeLabel,
  formatFileSize,
  formatPlaybackTime,
  extractMessageAssetUrl,
  mergeContactDirectory,
  loadDraftFromStorage,
  loadDraftsFromStorage,
  saveDraftToStorage,
  clearDraftFromStorage,
  getMessageDisplayContent,
  resolveMediaUrl,
  downloadMediaFile,
  getMediaFileName,
} from "../utils";
import type {
  ComposerAttachment,
  PreviewMediaState,
  MessageCacheEntry,
  ConversationDraftState,
  AiMemoryRecord,
  InboxAiRuntime,
  LeadIntentResult,
  ConversationControl,
  QuickReplyItem,
  QuickReplyMediaItem,
} from "../types";

const CONVERSATIONS_PAGE_SIZE = 20;
const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_CACHE_TTL_MS = 30_000;
const DRAFT_TTL_MS = 5 * 60 * 1000;
const RUNTIME_RECONNECTED_EVENT = "runtime:reconnected";
const OFFLINE_MESSAGE_POLL_INTERVAL_MS = 45_000;
const OFFLINE_FALLBACK_SYNC_INTERVAL_MS = 60_000;
const SOCKET_FORCE_RECONNECT_DEBOUNCE_MS = 15_000;

const DEFAULT_QUICK_REPLIES: QuickReplyItem[] = [
  { id: "qr-1", category: "saudação", title: "Saudação", text: "Olá! Como posso ajudar?", items: [{ type: "text", value: "Olá! Como posso ajudar?" }] },
  { id: "qr-2", category: "vendas", title: "Interesse", text: "Qual produto você procura hoje?", items: [{ type: "text", value: "Qual produto você procura hoje?" }] },
  { id: "qr-3", category: "vendas", title: "Valores", text: "Posso te enviar os valores agora mesmo.", items: [{ type: "text", value: "Posso te enviar os valores agora mesmo." }] },
  { id: "qr-4", category: "suporte", title: "Suporte", text: "Já vou verificar isso para você e te retorno em instantes.", items: [{ type: "text", value: "Já vou verificar isso para você e te retorno em instantes." }] },
];

const EMPTY_MESSAGES_ARRAY: ChatMessage[] = [];

export function useInboxState() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const socketActions = useInboxSocket();

  // zustand store
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

  const messages = useAppStore((state) => {
    const resolvedId = resolveStoreConversationId(state.conversations, selectedConversationId || "");
    return state.messagesByConversationId[resolvedId] || EMPTY_MESSAGES_ARRAY;
  });

  const setMessagesForConversation = useCallback((conversationId: string, updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    const normalizedConversationId = String(conversationId);
    if (!normalizedConversationId) return;
    const store = useAppStore.getState();
    const resolvedId = resolveStoreConversationId(store.conversations, normalizedConversationId);
    const current = store.messagesByConversationId[resolvedId] || [];
    const next = typeof updater === "function" ? updater(current) : updater;
    store.setMessages(resolvedId, next);
  }, []);

  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    const activeId = useAppStore.getState().activeConversationId;
    if (!activeId) return;
    setMessagesForConversation(activeId, updater);
  }, [setMessagesForConversation]);

  // States
  const [messageInput, setMessageInput] = useState("");
  const [draftsByConversationId, setDraftsByConversationId] = useState<Record<string, { draft: string; timestamp: number }>>({});
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationSearchOpen, setConversationSearchOpen] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");
  const [activeConversationSearchIndex, setActiveConversationSearchIndex] = useState(0);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [conversationsLoadFailed, setConversationsLoadFailed] = useState(false);
  const [messagesLoadFailed, setMessagesLoadFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const runtime = useRuntime();
  const apiHealth = useAppStore((state) => state.apiHealth);
  const globalWebsocketHealth = useAppStore((state) => state.websocketHealth);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [pendingBackgroundUpdates, setPendingBackgroundUpdates] = useState(0);
  const [conversationListHeight, setConversationListHeight] = useState(520);
  const [leadInsight, setLeadInsight] = useState<LeadIntentResult | null>(null);
  const [suggestingResponse, setSuggestingResponse] = useState(false);
  const [responseSearchQuery, setResponseSearchQuery] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>(DEFAULT_QUICK_REPLIES);
  const [quickReplyCategory, setQuickReplyCategory] = useState<string>("all");
  const [isQuickReplyDialogOpen, setIsQuickReplyDialogOpen] = useState(false);

  // Quick Reply dialog states
  const [qrDialogId, setQrDialogId] = useState<string | null>(null);
  const [qrDialogTitle, setQrDialogTitle] = useState("");
  const [qrDialogCategory, setQrDialogCategory] = useState("saudação");
  const [qrDialogFavorite, setQrDialogFavorite] = useState(false);
  const [qrDialogTags, setQrDialogTags] = useState<string[]>([]);
  const [qrDialogNewTag, setQrDialogNewTag] = useState("");
  const [qrDialogItems, setQrDialogItems] = useState<QuickReplyMediaItem[]>([]);
  const [qrDialogIsFlow, setQrDialogIsFlow] = useState(false);

  // AI & Memory states
  const [aiMemory, setAiMemory] = useState<AiMemoryRecord | null>(null);
  const [aiRuntime, setAiRuntime] = useState<InboxAiRuntime>({
    globalEnabled: true,
    memoryEnabled: true,
    provider: "Não configurado",
    model: "Não configurado",
    lastResponseAt: null,
    lastResponseTimeMs: null,
    promptTokens: 0,
    completionTokens: 0,
    loading: true,
    aiOn: false,
  });

  // Composer attachments, dragging, recording
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLeadPanel, setShowLeadPanel] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"ai" | "lead" | "files" | "qr" | "history" | null>("ai");
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("zapai_right_panel_collapsed") === "1";
  });
  const [mobileScreen, setMobileScreen] = useState<"conversations" | "chat">("conversations");
  const [isTabletLayout, setIsTabletLayout] = useState<boolean>(() => window.innerWidth < 1440);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Session management
  const sessions = useAppStore((state) => state.sessions);
  const setSessions = useCallback((sessionsOrUpdater: SessionInfo[] | ((prev: SessionInfo[]) => SessionInfo[])) => {
    const store = useAppStore.getState();
    const previous = store.sessions as unknown as SessionInfo[];
    const next = typeof sessionsOrUpdater === "function" ? sessionsOrUpdater(previous) : sessionsOrUpdater;
    store.setSessions(next as any);
  }, []);
  const [preferredSessionId, setPreferredSessionId] = useState<string | null>(() => localStorage.getItem("zapai_inbox_active_session"));

  const sessionOwnPhonesKey = useMemo(() => {
    return [...sessions]
      .map(
        (session) =>
          session?.phone ||
          (session as any)?.raw?.wid ||
          (session as any)?.raw?.number ||
          "",
      )
      .filter(Boolean)
      .sort()
      .join(",");
  }, [sessions]);

  const sessionOwnPhones = useMemo(() => {
    const phones = new Set<string>();
    for (const session of sessions) {
      const normalizedPhone = normalizePhone(
        session?.phone ||
        (session as any)?.raw?.wid ||
        (session as any)?.raw?.number ||
        "",
      );
      if (normalizedPhone) phones.add(normalizedPhone);
    }
    return phones;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionOwnPhonesKey]);


  const isOwnSessionConversation = useCallback((conversation?: Conversation | null) => {
    if (!conversation || sessionOwnPhones.size === 0) return false;

    const candidates = [
      conversation.phone,
      conversation.chatId,
      (conversation as any).remoteJid,
      (conversation as any).remote_jid,
      conversation.contactId,
    ];

    return candidates.some((candidate) => {
      const normalized = normalizePhone(String(candidate || ""));
      return normalized ? sessionOwnPhones.has(normalized) : false;
    });
  }, [sessionOwnPhones]);

  // Emoji picker components
  const [EmojiPickerComponent, setEmojiPickerComponent] = useState<any | null>(null);
  const [emojiPickerData, setEmojiPickerData] = useState<unknown>(null);

  // Message UI states
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);
  const [activeReactionPickerMessageId, setActiveReactionPickerMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const typingByConversationId = useAppStore((state) => state.typingUsers);
  const aiProgress = useAppStore((state) => {
    const resolvedId = resolveStoreConversationId(state.conversations, selectedConversationId || "");
    return resolvedId ? state.aiProgressByConversationId[resolvedId] ?? null : null;
  });
  const [unseenRealtimeCount, setUnseenRealtimeCount] = useState(0);
  const [conversationControls, setConversationControls] = useState<Record<string, ConversationControl>>({});
  const [updatingAiToggle, setUpdatingAiToggle] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [previewMedia, setPreviewMedia] = useState<PreviewMediaState | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [aiAgents, setAiAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchAgents = async () => {
      setLoadingAgents(true);
      try {
        const res = await apiService.getAIAgents();
        if (active && res && res.success && Array.isArray(res.agents)) {
          setAiAgents(res.agents);
        }
      } catch (err) {
        console.warn("Failed to fetch AI agents for Inbox:", err);
      } finally {
        if (active) setLoadingAgents(false);
      }
    };
    void fetchAgents();
    return () => {
      active = false;
    };
  }, []);

  // Archived & pinned chats
  const [archivedChatIds, setArchivedChatIds] = useState<string[]>(() => {
    const raw = localStorage.getItem("zapai_inbox_archived_chats");
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [pinnedChatIds, setPinnedChatIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("zapai_pinned_chats") ?? "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("zapai_inbox_archived_chats", JSON.stringify(archivedChatIds));
  }, [archivedChatIds]);

  useEffect(() => {
    localStorage.setItem("zapai_pinned_chats", JSON.stringify(pinnedChatIds));
  }, [pinnedChatIds]);

  // Bulk actions
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationSearchInputRef = useRef<HTMLInputElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const touchStartXRef = useRef<number | null>(null);
  const autoScrollRef = useRef(true);
  const selectedConversationRef = useRef<Conversation | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const contactDirectoryRef = useRef<any>(loadContactDirectory());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const summaryBusyRef = useRef(false);
  const lastAnalyzedKeyRef = useRef("");
  const activeMessageRequestRef = useRef<Map<string, number>>(new Map());
  const messageCacheRef = useRef<Map<string, MessageCacheEntry>>(new Map());
  const messageIdsRef = useRef<Set<string>>(new Set());
  const pendingOutgoingTempIdsRef = useRef<Map<string, string[]>>(new Map());
  const pendingSendFallbackTimersRef = useRef<Map<string, number>>(new Map());
  const composerDraftsRef = useRef<Map<string, ConversationDraftState>>(new Map());
  const selectedConversationIdRef = useRef<string | null>(selectedConversationId);
  const messageInputStateRef = useRef(messageInput);
  const attachmentsStateRef = useRef<ComposerAttachment[]>([]);
  const replyingToStateRef = useRef<ChatMessage | null>(null);
  const lastRenderedTailKeyRef = useRef<string>("");
  const prevConvIdScrollRef = useRef<string>("");
  const fallbackSyncBusyRef = useRef(false);
  const lastForceReconnectAtRef = useRef(0);
  const preferredSessionIdRef = useRef<string | null>(preferredSessionId);
  const errorToastThrottleRef = useRef<Map<string, number>>(new Map());
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Audio player specific states
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

  const removePendingTempIdsForConversation = useCallback((conversationId: string, tempIds: string[]) => {
    if (!conversationId || tempIds.length === 0) return;
    const current = pendingOutgoingTempIdsRef.current.get(conversationId) ?? [];
    const next = current.filter((id) => !tempIds.includes(id));
    if (next.length > 0) {
      pendingOutgoingTempIdsRef.current.set(conversationId, next);
    } else {
      pendingOutgoingTempIdsRef.current.delete(conversationId);
    }
  }, []);

  const getMessagesViewport = useCallback(() => {
    const anchor = messagesScrollRef.current;
    const directViewport = anchor?.closest("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (directViewport) return directViewport;

    const root = anchor?.closest("[data-radix-scroll-area-root]");
    return (root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null) ?? null;
  }, []);

  const persistDraftSnapshot = useCallback((conversationId: string | null, draftOverride?: Partial<ConversationDraftState>) => {
    if (!conversationId) return;
    const nextDraft: ConversationDraftState = {
      draftMessage: draftOverride?.draftMessage ?? messageInputStateRef.current,
      draftMedia: draftOverride?.draftMedia ?? attachmentsStateRef.current,
      draftReply: draftOverride?.draftReply ?? replyingToStateRef.current,
      draftMentions: draftOverride?.draftMentions ?? [],
    };
    composerDraftsRef.current.set(conversationId, nextDraft);
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

  const scheduleScrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const runScroll = () => {
      const viewport = getMessagesViewport();
      if (!viewport) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
      autoScrollRef.current = true;
      setUnseenRealtimeCount(0);
    };

    window.requestAnimationFrame(runScroll);
    window.setTimeout(runScroll, 180);
  }, [getMessagesViewport]);

  const rememberContacts = useCallback((nextConversations: Conversation[]) => {
    const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, nextConversations);
    contactDirectoryRef.current = mergedDirectory;
    persistContactDirectory(mergedDirectory);
  }, []);

  const mergeConversationsSnapshot = useCallback((incoming: Conversation[]) => {
    const sessionScopedIncoming = filterConversationsForSession(incoming, preferredSessionIdRef.current);
    const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, sessionScopedIncoming);
    contactDirectoryRef.current = mergedDirectory;
    persistContactDirectory(mergedDirectory);

    setConversations((prev) => {
      const sessionScopedPrev = filterConversationsForSession(prev, preferredSessionIdRef.current);
      const visiblePrev = sessionScopedPrev.filter((conversation) => !isOwnSessionConversation(conversation));
      const visibleIncoming = sessionScopedIncoming.filter((conversation) => !isOwnSessionConversation(conversation));
      return dedupeConversationsByScope([...visiblePrev, ...visibleIncoming], mergedDirectory);
    });
  }, [isOwnSessionConversation, setConversations]);

  useEffect(() => {
    if (!conversations.length) return;
    rememberContacts(conversations);
    persistConversations(conversations);
    setDraftsByConversationId(loadDraftsFromStorage(conversations.map((conversation) => String(conversation.id))));
  }, [conversations, rememberContacts]);

  const selectedConversation = useMemo(() => {
    const match = conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
    return isOwnSessionConversation(match) ? null : match;
  }, [conversations, isOwnSessionConversation, selectedConversationId]);

  const leadByConversationId = useMemo(
    () =>
      Object.fromEntries(
        conversations.map((conversation) => {
          const sourceText = String(
            conversationControls[conversation.id]?.summary || conversation.lastMessage || "",
          ).toLowerCase();
          const intent: LeadIntentResult["intent"] =
            sourceText.includes("comprar") || sourceText.includes("adquirir")
              ? "purchase_intent"
              : sourceText.includes("preco") || sourceText.includes("valor")
                ? "price_request"
                : sourceText.includes("duvida") || sourceText.includes("como")
                  ? "question"
                  : "information";

          return [
            conversation.id,
            {
              intent,
              lead_temperature: "warm",
              confidence: 0.5,
              next_action: intent === "purchase_intent" ? "close_sale" : intent === "price_request" ? "send_price" : "educate",
            } satisfies LeadIntentResult,
          ];
        }),
      ),
    [conversationControls, conversations],
  );

  const isTyping = useMemo(() => {
    if (!selectedConversation) return false;
    const byId = typingByConversationId[selectedConversation.id];
    if (byId !== undefined) return byId;

    if (selectedConversation.chatId) {
      const byChatId = typingByConversationId[selectedConversation.chatId];
      if (byChatId !== undefined) return byChatId;
      
      const cleanChatId = selectedConversation.chatId.replace(/@s\.whatsapp\.net$/i, "");
      const byCleanChatId = typingByConversationId[cleanChatId];
      if (byCleanChatId !== undefined) return byCleanChatId;
    }

    if (selectedConversation.phone) {
      const byPhone = typingByConversationId[selectedConversation.phone];
      if (byPhone !== undefined) return byPhone;
      
      const cleanPhone = selectedConversation.phone.replace(/\D/g, "");
      const byCleanPhone = typingByConversationId[cleanPhone];
      if (byCleanPhone !== undefined) return byCleanPhone;
    }

    return (selectedConversation as any).status === "typing" ? "composing" : false;
  }, [selectedConversation, typingByConversationId]);

  const selectedConversationKey = useMemo(
    () => (selectedConversation ? getConversationKey(selectedConversation) : null),
    [selectedConversation],
  );

  // Persist right-panel collapsed state
  useEffect(() => {
    try {
      window.localStorage.setItem("zapai_right_panel_collapsed", rightPanelCollapsed ? "1" : "0");
    } catch {
      // Ignore
    }
  }, [rightPanelCollapsed]);

  // Keyboard shortcuts for right panel: Alt+1/2/3 to switch tabs, Alt+B to collapse
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "1") { setRightPanelTab("ai"); setRightPanelCollapsed(false); e.preventDefault(); }
      else if (e.key === "2") { setRightPanelTab("lead"); setRightPanelCollapsed(false); e.preventDefault(); }
      else if (e.key === "3") { setRightPanelTab("files"); setRightPanelCollapsed(false); e.preventDefault(); }
      else if (e.key === "4") { setRightPanelTab("qr"); setRightPanelCollapsed(false); e.preventDefault(); }
      else if (e.key === "5") { setRightPanelTab("history"); setRightPanelCollapsed(false); e.preventDefault(); }
      else if (e.key.toLowerCase() === "b") { setRightPanelCollapsed((v) => !v); e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") return;
      if (!selectedConversationRef.current) return;
      event.preventDefault();
      setConversationSearchOpen(true);
      window.requestAnimationFrame(() => conversationSearchInputRef.current?.focus());
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
  }, [setSessions]);

  const activeSession = useMemo(() => {
    if (!Array.isArray(sessions)) return null;

    const active = pickActiveSession(sessions, selectedConversation?.sessionId);
    if (active) return active;

    if (selectedConversation?.sessionId) {
      const found = sessions.find((s) => s && s.id === selectedConversation.sessionId);
      if (found) return found;
    }

    return sessions[0] || null;
  }, [sessions, selectedConversation?.sessionId]);

  const isWhatsappConnected = useMemo(() => {
    return Boolean(activeSession && isSessionActive(activeSession));
  }, [activeSession]);

  const connectedPhone = useMemo(() => {
    return (
      activeSession?.phone ||
      (activeSession as any)?.raw?.wid ||
      (activeSession as any)?.raw?.number ||
      activeSession?.id ||
      "Sem número"
    );
  }, [activeSession]);

  const activeControl = selectedConversation ? conversationControls[selectedConversation.id] : undefined;
  const conversationAiOverrideEnabled = activeControl?.aiEnabled ?? selectedConversation?.aiEnabled ?? true;
  const aiEnabledForConversation = aiRuntime.globalEnabled && aiRuntime.aiOn && conversationAiOverrideEnabled;

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);


  useEffect(() => {
    setLeadNotes(
      selectedConversation?.notes ??
      conversationControls[selectedConversation?.id ?? ""]?.notes ??
      "",
    );
  }, [conversationControls, selectedConversation?.id, selectedConversation?.notes]);

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

    const params = new URLSearchParams(window.location.search);
    const urlConvId = params.get("conversationId");
    const urlPhone = params.get("phone") || params.get("chatId");
    const normUrlPhone = urlPhone ? normalizePhone(urlPhone) : "";

    if (urlConvId || normUrlPhone) {
      const match = conversations.find((item) => {
        const itemId = String(item.id);
        const itemConvId = String((item as any).conversationId || "");
        const itemPhone = normalizePhone(item.phone || "");
        const itemChatId = normalizePhone(item.chatId || "");

        if (urlConvId && (itemId === urlConvId || itemConvId === urlConvId)) return true;
        if (normUrlPhone && (itemPhone === normUrlPhone || itemChatId === normUrlPhone)) return true;
        return false;
      });

      if (match) {
        if (selectedConversationId !== match.id) {
          setSelectedConversationId(match.id);
        }
        setMobileScreen("chat");
        return;
      } else if (normUrlPhone && conversations.length > 0) {
        const syntheticConv: Conversation = {
          id: urlConvId || `synthetic-${normUrlPhone}`,
          contactName: urlPhone || normUrlPhone,
          phone: normUrlPhone,
          chatId: normUrlPhone,
          lastMessage: "",
          unread: 0,
          updatedAt: new Date().toISOString(),
          sessionId: preferredSessionId || "main",
          aiEnabled: true,
        };

        setConversations((prev) => [syntheticConv, ...prev.filter((c) => normalizePhone(c.phone) !== normUrlPhone)]);
        setSelectedConversationId(syntheticConv.id);
        setMobileScreen("chat");
        return;
      }
    }

    if (selectedConversationId && !conversations.some((item) => normalizeId(item.id) === normalizeId(selectedConversationId))) {
      if (!urlConvId && !normUrlPhone) {
        setSelectedConversationId(conversations[0]?.id ?? null);
      }
    } else if (!selectedConversationId && conversations.length > 0 && !urlConvId && !normUrlPhone) {
      setSelectedConversationId(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversationId, setSelectedConversationId, setConversations, preferredSessionId]);

  useEffect(() => {
    if (!activeSession?.id) return;
    setPreferredSessionId(activeSession.id);
    localStorage.setItem("zapai_inbox_active_session", activeSession.id);
  }, [activeSession?.id]);

  const fetchAiMemory = useCallback(async (contactId: string) => {
    if (!contactId) return;
    try {
      const response = await apiService.getMemoryByContact(contactId);
      if (response && response.success && response.data) {
        setAiMemory(response.data);
      } else {
        setAiMemory(null);
      }
    } catch (err) {
      setAiMemory(null);
    }
  }, []);

  useEffect(() => {
    const memoryContactId = String(selectedConversation?.contactId ?? selectedConversation?.phone ?? "").trim();
    if (!memoryContactId) {
      setAiMemory(null);
      return;
    }
    void fetchAiMemory(memoryContactId);
  }, [selectedConversation?.contactId, selectedConversation?.phone, fetchAiMemory]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    let cancelled = false;

    const loadAiRuntime = async () => {
      setAiRuntime((current) => ({ ...current, loading: true }));
      try {
        const [status, memorySettings, advancedSettings, logsResponse] = await Promise.all([
          apiService.getAIStatus(true),
          apiService.getMemorySettings(true),
          apiService.getAdvancedAISettings(true),
          apiService.getAILogs(),
        ]);
        if (cancelled) return;

        const logs = Array.isArray(logsResponse?.logs) ? logsResponse.logs : [];
        const normalizeAiIdentity = (value: unknown) => {
          const raw = String(value ?? "").trim().toLowerCase();
          if (!raw) return "";
          if (raw.includes("@g.us")) return raw;
          const withoutSuffix = raw.replace(/@(s\.whatsapp\.net|c\.us|lid)$/i, "");
          const digits = withoutSuffix.replace(/\D/g, "");
          return digits.length >= 8 ? digits : raw;
        };
        const conversationIdentities = [
          selectedConversation.id,
          selectedConversation.chatId,
          selectedConversation.phone,
          selectedConversation.contactId,
        ].map(normalizeAiIdentity).filter(Boolean);
        const conversationLogs = logs.filter((entry) => {
          const entryIdentity = normalizeAiIdentity(entry.conversationId);
          return conversationIdentities.some((identity) =>
            identity === entryIdentity ||
            (identity.length >= 8 && entryIdentity.length >= 8 && identity.slice(-8) === entryIdentity.slice(-8)),
          );
        });
        const latestLog = conversationLogs[0] ?? null;
        const activeProvider =
          advancedSettings.providers?.find((provider: any) => provider.active) ??
          advancedSettings.providers?.[0] ??
          null;

        setAiRuntime({
          globalEnabled: Boolean(status.ai ?? status.enabled ?? status.active),
          memoryEnabled: memorySettings.enabled !== false,
          provider: latestLog?.provider || activeProvider?.name || activeProvider?.id || "Não configurado",
          model: latestLog?.model || activeProvider?.model || "Não configurado",
          lastResponseAt: latestLog?.timestamp || null,
          lastResponseTimeMs: null,
          promptTokens: conversationLogs.reduce((total, entry) => total + Number(entry.promptTokens || 0), 0),
          completionTokens: conversationLogs.reduce((total, entry) => total + Number(entry.completionTokens || 0), 0),
          loading: false,
          aiOn: Boolean(status.aiOn),
        });
      } catch (error) {
        if (cancelled) return;
        setAiRuntime((current) => ({ ...current, loading: false }));
      }
    };

    void loadAiRuntime();
    return () => {
      cancelled = true;
    };
  }, [selectedConversation?.id, selectedConversation?.chatId, selectedConversation?.phone, selectedConversation?.contactId]);

  useEffect(() => {
    const aiMessages = messages.filter((message) => message.isAI);
    const latestAiMessage = aiMessages.at(-1);
    if (!latestAiMessage) return;

    const promptTokens = aiMessages.reduce((total, message) => total + Number(message.aiPromptTokens || 0), 0);
    const completionTokens = aiMessages.reduce((total, message) => total + Number(message.aiCompletionTokens || 0), 0);

    setAiRuntime((current) => ({
      ...current,
      provider: latestAiMessage.aiProvider || current.provider,
      model: latestAiMessage.aiModel || current.model,
      lastResponseAt: latestAiMessage.createdAt || current.lastResponseAt,
      lastResponseTimeMs: latestAiMessage.aiResponseTimeMs ?? current.lastResponseTimeMs,
      promptTokens: Math.max(current.promptTokens, promptTokens),
      completionTokens: Math.max(current.completionTokens, completionTokens),
      loading: false,
    }));
  }, [messages, selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation) return;
    const scope = getConversationScope({
      phone: selectedConversation.phone,
      sessionId: selectedConversation.sessionId,
    });
    if (scope) {
      localStorage.setItem("zapai_inbox_last_chat_scope", scope);
    }
  }, [selectedConversation]);

  // Sync draft snapshots
  useEffect(() => {
    if (!selectedConversationId) {
      const previousConversationId = selectedConversationIdRef.current;
      if (previousConversationId) {
        persistDraftSnapshot(previousConversationId);
      }
      selectedConversationIdRef.current = null;
      setMessageInput("");
      setAttachments([]);
      setReplyingTo(null);
      return;
    }

    const previousConversationId = selectedConversationIdRef.current;
    if (previousConversationId && previousConversationId !== selectedConversationId) {
      persistDraftSnapshot(previousConversationId);
    }
    selectedConversationIdRef.current = selectedConversationId;

    const inMemoryDraft = composerDraftsRef.current.get(selectedConversationId);
    setMessageInput(inMemoryDraft?.draftMessage ?? loadDraftFromStorage(selectedConversationId));
    setAttachments(inMemoryDraft?.draftMedia ?? []);
    setReplyingTo(inMemoryDraft?.draftReply ?? null);
  }, [persistDraftSnapshot, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const frame = window.requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedConversationId, mobileScreen]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const snapshot = saveDraftToStorage(selectedConversationId, messageInput);
    setDraftsByConversationId((prev) => {
      if (!snapshot) {
        if (!prev[selectedConversationId]) return prev;
        const { [selectedConversationId]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [selectedConversationId]: snapshot,
      };
    });
  }, [messageInput, selectedConversationId]);

  useEffect(() => {
    messageInputStateRef.current = messageInput;
    if (selectedConversationId) {
      persistDraftSnapshot(selectedConversationId, { draftMessage: messageInput });
    }
  }, [messageInput, persistDraftSnapshot, selectedConversationId]);

  useEffect(() => {
    attachmentsStateRef.current = attachments;
    if (selectedConversationId) {
      persistDraftSnapshot(selectedConversationId, { draftMedia: attachments });
    }
  }, [attachments, persistDraftSnapshot, selectedConversationId]);

  useEffect(() => {
    replyingToStateRef.current = replyingTo;
    if (selectedConversationId) {
      persistDraftSnapshot(selectedConversationId, { draftReply: replyingTo });
    }
  }, [persistDraftSnapshot, replyingTo, selectedConversationId]);

  useEffect(() => {
    const onResize = () => {
      setConversationListHeight(Math.max(360, window.innerHeight - 200));
      const compactRightPanel = window.innerWidth < 1440;
      setIsTabletLayout(compactRightPanel);
      if (compactRightPanel) setRightPanelCollapsed(true);
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
      const allAttachments = new Map<string, ComposerAttachment>();
      attachmentsStateRef.current.forEach((attachment) => allAttachments.set(attachment.id, attachment));
      composerDraftsRef.current.forEach((draft) => {
        draft.draftMedia.forEach((attachment) => allAttachments.set(attachment.id, attachment));
      });
      revokeAttachmentPreviewUrls([...allAttachments.values()]);
    },
    [],
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
        setEmojiPickerComponent(() => PickerComponent);
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
    setBackendOnline(false);
  }, []);

  const markBackendOnline = useCallback(() => {
    setBackendOnline(true);
  }, []);

  // Sync WebSocket state
  useEffect(() => {
    setIsRealtimeConnected(globalWebsocketHealth === "online");
  }, [globalWebsocketHealth]);

  const loadConversationMessagesRef = useRef<(conversationId: string, options?: { force?: boolean; background?: boolean }) => Promise<void>>(
    async () => undefined,
  );

  // Initial load
  useEffect(() => {
    const loadInitial = async () => {
      setError(null);
      setLoadingConversations(true);
      setConversationsLoadFailed(false);

      try {
        const storeSnapshot = useAppStore.getState();
        const sessionsData =
          storeSnapshot.sessions.length > 0
            ? (storeSnapshot.sessions as unknown as SessionInfo[])
            : await refreshSessions();
        const conversationSessionId = getPreferredSessionIdForConversations(
          Array.isArray(sessionsData) ? sessionsData : [],
          preferredSessionIdRef.current,
        );
        const conversationsData =
          storeSnapshot.conversations.length > 0
            ? storeSnapshot.conversations
            : await apiService.getConversations(false, {
                limit: CONVERSATIONS_PAGE_SIZE,
                sessionId: conversationSessionId ?? undefined,
              });
        const persistedConversations = filterConversationsForSession(loadPersistedConversations(), conversationSessionId);
        const combinedConversations = [...persistedConversations, ...conversationsData]
          .filter((conversation) => !isOwnSessionConversation(conversation));
        const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, combinedConversations);
        contactDirectoryRef.current = mergedDirectory;
        persistContactDirectory(mergedDirectory);

        const normalizedConversations = dedupeConversationsByScope(combinedConversations, mergedDirectory);
        setConversations(normalizedConversations);
        markBackendOnline();
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
        if (conversationSessionId) {
          setPreferredSessionId(conversationSessionId);
          localStorage.setItem("zapai_inbox_active_session", conversationSessionId);
        }
        setSelectedConversationId((currentId) => {
          if (currentId && normalizedConversations.some((conversation) => normalizeId(conversation.id) === normalizeId(currentId))) {
            return normalizeId(currentId);
          }
          const lastScope = localStorage.getItem("zapai_inbox_last_chat_scope");
          if (lastScope) {
            const match = normalizedConversations.find(
              (conversation) => getConversationScope({ phone: conversation.phone, sessionId: conversation.sessionId }) === lastScope,
            );
            if (match) return normalizeId(match.id);
          }
          return normalizeId(normalizedConversations[0]?.id) || null;
        });
        void loadConversationControls(normalizedConversations);
        setConversationsLoadFailed(false);
      } catch (err) {
        markBackendOffline(err);
        setConversationsLoadFailed(true);
        const message = "Não foi possível atualizar as conversas. Os últimos dados salvos serão mantidos.";
        setError(message);
        showErrorToast(message);
      } finally {
        setLoadingConversations(false);
      }
    };

    void loadInitial();
  }, [isOwnSessionConversation, loadConversationControls, markBackendOffline, markBackendOnline, refreshSessions, showErrorToast, setConversations, setSelectedConversationId, setSessions]);

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
          const resolvedId = resolveStoreConversationId(useAppStore.getState().conversations, normalizedConversationId);
          const currentStoreMessages = useAppStore.getState().messagesByConversationId[resolvedId] || [];
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
          setMessagesForConversation(normalizedConversationId, mergedWithCache);
          setHasMoreMessages(hasMore);
          setPendingBackgroundUpdates(0);
          setMessagesLoadFailed(false);
          scheduleScrollToBottom("auto");
        }
        updateConversationMessageStore(normalizedConversationId, mergedWithCache, hasMore);

        void hydrateConversationHistoryForAnalysis(normalizedConversationId, sorted);
      } catch (err) {
        markBackendOffline(err);
        if (activeMessageRequestRef.current.get(normalizedConversationId) !== requestId) return;
        setMessagesLoadFailed(true);
        const message = "Falha ao carregar mensagens. Tente novamente.";
        setError(message);
        showErrorToast(message);
      } finally {
        if (activeMessageRequestRef.current.get(normalizedConversationId) === requestId) {
          activeMessageRequestRef.current.delete(normalizedConversationId);
          setLoadingMessages(false);
        }
      }
    },
    [hydrateConversationHistoryForAnalysis, markBackendOffline, markBackendOnline, scheduleScrollToBottom, showErrorToast, updateConversationMessageStore, setMessagesForConversation],
  );

  useEffect(() => {
    preferredSessionIdRef.current = preferredSessionId;
  }, [preferredSessionId]);

  useEffect(() => {
    loadConversationMessagesRef.current = loadConversationMessages;
  }, [loadConversationMessages]);

  useEffect(() => {
    if (!selectedConversationId || !messages) return;

    const normalizedConversationId = String(selectedConversationId);
    const linkedConversation =
      conversationsRef.current.find((item) => String(item.id) === normalizedConversationId) ??
      (String(selectedConversationRef.current?.id ?? "") === normalizedConversationId ? selectedConversationRef.current : null);
    const conversationKey = getConversationKey(linkedConversation ?? { id: normalizedConversationId });
    const oldestCursor = messages.length > 0 ? String(messages[0]?.createdAt ?? messages[0]?.timestamp ?? "") || null : null;
    const cached = messageCacheRef.current.get(conversationKey);
    const hasMore = cached ? cached.hasMore : messages.length >= MESSAGE_PAGE_SIZE;

    messageCacheRef.current.set(conversationKey, {
      messages,
      hasMore,
      oldestCursor,
      cachedAt: Date.now(),
    });

    persistConversationMessages({
      conversationId: normalizedConversationId,
      sessionId: linkedConversation?.sessionId,
      phone: linkedConversation?.phone,
      messages,
    });
  }, [messages, selectedConversationId]);


  const selectedConversationIdForEffect = selectedConversation?.id || null;
  const selectedConversationUnread = selectedConversation?.unread || 0;

  useEffect(() => {
    if (!selectedConversationIdForEffect) return;
    if (selectedConversationUnread > 0) {
      try {
        void apiService.markConversationRead(selectedConversationIdForEffect);
      } catch (e) {
        console.warn("Failed to mark conversation read:", e);
      }
    }
  }, [selectedConversationIdForEffect, selectedConversationUnread]);

  useEffect(() => {
    if (!selectedConversationIdForEffect) {
      setHasMoreMessages(false);
      setPendingBackgroundUpdates(0);
      setUnseenRealtimeCount(0);
      setReplyingTo(null);
      messageIdsRef.current = new Set();
      return;
    }

    const normalizedId = String(selectedConversationIdForEffect);
    const activeConversation = selectedConversation!;

    const resolvedId = resolveStoreConversationId(useAppStore.getState().conversations, normalizedId);
    const storeMessages = useAppStore.getState().messagesByConversationId[resolvedId] || [];

    if (storeMessages.length > 0) {
      messageIdsRef.current = new Set(storeMessages.map((m) => m.id));
      const cached = messageCacheRef.current.get(getConversationKey(activeConversation));
      setHasMoreMessages(cached ? cached.hasMore : storeMessages.length >= MESSAGE_PAGE_SIZE);
    } else {
      const cached = messageCacheRef.current.get(getConversationKey(activeConversation));
      if (cached && cached.messages.length > 0) {
        setMessagesForConversation(normalizedId, cached.messages);
        setHasMoreMessages(cached.hasMore);
        messageIdsRef.current = new Set(cached.messages.map((m) => m.id));
      } else {
        const persisted = loadPersistedConversationMessages({
          conversationId: normalizedId,
          sessionId: activeConversation.sessionId,
          phone: activeConversation.phone,
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

    // Paint cached data first, then reconcile the selected conversation with
    // the API. The cache TTL prevents duplicate requests when switching quickly.
    void loadConversationMessagesRef.current(normalizedId);

    autoScrollRef.current = true;
    setLoadingMessages(false);
    setPendingBackgroundUpdates(0);
    setUnseenRealtimeCount(0);
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId(null);
    setReplyingTo(null);
    scheduleScrollToBottom("auto");
  }, [
    scheduleScrollToBottom,
    selectedConversationIdForEffect,
    selectedConversation?.sessionId,
    selectedConversation?.phone,
    setMessagesForConversation
  ]);

  // Offline sync fallbacks
  useEffect(() => {
    if (!selectedConversation?.id) return;
    if (isRealtimeConnected) return;
    let isMounted = true;
    let isPolling = false;

    const pollMessages = async () => {
      if (!isMounted || isPolling) return;
      if (document.hidden) return;
      const activeId = String(selectedConversationRef.current?.id ?? "");
      if (activeId && activeMessageRequestRef.current.has(activeId)) return;
      isPolling = true;
      try {
        await loadConversationMessagesRef.current(selectedConversation.id, { force: true });
      } catch {
        // Ignored
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
      const latestConversations = await apiService.getConversations(true, {
        limit: CONVERSATIONS_PAGE_SIZE,
        sessionId: activeSession?.id ?? preferredSessionId ?? undefined,
      });
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
  }, [activeSession?.id, markBackendOffline, markBackendOnline, mergeConversationsSnapshot, preferredSessionId, showErrorToast]);

  const handleRetryMessages = useCallback(async () => {
    if (!selectedConversation?.id) return;
    setMessagesLoadFailed(false);
    await loadConversationMessages(selectedConversation.id, { force: true });
  }, [loadConversationMessages, selectedConversation?.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void handleRetryConversations();
        if (selectedConversation?.id) {
          void handleRetryMessages();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleRetryConversations, handleRetryMessages, selectedConversation?.id]);


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

  // Visual scroll area updates
  useEffect(() => {
    const viewport = getMessagesViewport();
    if (!viewport) return;

    (viewport.style as any).WebkitOverflowScrolling = "touch";

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

    const viewport = getMessagesViewport();
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
    const frameId = window.requestAnimationFrame(() => {
      const viewport = getMessagesViewport();
      if (!viewport) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
      autoScrollRef.current = true;
      setUnseenRealtimeCount(0);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedConversation?.id]);

  const lastScrolledConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedConversation?.id || messages.length === 0) return;

    const convId = String(selectedConversation.id);
    if (lastScrolledConvRef.current !== convId) {
      lastScrolledConvRef.current = convId;

      const scroll = () => {
        const viewport = getMessagesViewport();
        if (viewport) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: "auto" });
          autoScrollRef.current = true;
          setUnseenRealtimeCount(0);
        }
      };

      scroll();
      const t1 = setTimeout(scroll, 100);
      const t2 = setTimeout(scroll, 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [getMessagesViewport, selectedConversation?.id, messages.length]);

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

  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = getMessagesViewport();
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    window.requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    });
    autoScrollRef.current = true;
    setUnseenRealtimeCount(0);
  }, [getMessagesViewport]);

  useEffect(() => {
    if (!selectedConversation?.id || messages.length === 0) {
      lastRenderedTailKeyRef.current = "";
      return;
    }

    const currentConvId = String(selectedConversation.id);
    const hasConvChanged = prevConvIdScrollRef.current !== currentConvId;
    prevConvIdScrollRef.current = currentConvId;

    const lastMessage = messages[messages.length - 1];
    const tailKey = `${selectedConversation.id}:${lastMessage?.id ?? "none"}:${messages.length}`;
    const previousTailKey = lastRenderedTailKeyRef.current;
    lastRenderedTailKeyRef.current = tailKey;

    if (hasConvChanged) {
      scheduleScrollToBottom("auto");
      return;
    }

    if (!previousTailKey) {
      scheduleScrollToBottom("auto");
      return;
    }

    if (previousTailKey === tailKey) return;

    const behavior: ScrollBehavior = lastMessage?.fromMe ? "auto" : "smooth";
    scheduleScrollToBottom(behavior);
  }, [messages, selectedConversation?.id, scheduleScrollToBottom]);

  useEffect(() => {
    if (!selectedConversation?.id || !aiProgress) return;
    scheduleScrollToBottom("smooth");
  }, [aiProgress?.status, aiProgress?.updatedAt, scheduleScrollToBottom, selectedConversation?.id]);

  // Automatic synchronization logic
  useEffect(() => {
    if (!selectedConversation?.id || messages.length === 0) return;

    const sidebarText = (selectedConversation.lastMessage || "").trim();
    const lastMsg = messages[messages.length - 1];
    const chatPanelText = (lastMsg?.content || lastMsg?.caption || "").trim();

    if (!sidebarText || !chatPanelText) return;

    const isPlaceholder = (text: string) => {
      const lower = text.toLowerCase();
      return lower.startsWith("[") && lower.endsWith("]");
    };

    if (isPlaceholder(sidebarText) || isPlaceholder(chatPanelText)) {
      return;
    }

    if (sidebarText !== chatPanelText) {
      const timer = setTimeout(() => {
        console.warn(`[INBOX SYNC] Divergence detected. Sidebar: "${sidebarText}", Chat panel: "${chatPanelText}". Syncing...`);
        void loadConversationMessagesRef.current(selectedConversation.id, { force: true });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [selectedConversation?.id, selectedConversation?.lastMessage, messages]);

  const analyzeCurrentConversation = useCallback(async () => {
    if (!selectedConversation || messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    const hash = `${selectedConversation.id}-${messages.length}-${lastMsg.id || lastMsg.createdAt || lastMsg.content || ""}`;
    if (lastAnalyzedKeyRef.current === hash) return;
    lastAnalyzedKeyRef.current = hash;

    const history = messages.slice(-20).map((message) => ({
      role: message.fromMe ? ("assistant" as const) : ("user" as const),
      content: message.content,
    }));

    const [{ analyzeLeadIntent }, { saveLeadTemperature }] = await Promise.all([
      import("@/services/leadAnalyzer"),
      import("@/services/leadIntelligenceStore"),
    ]);
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
    if (!selectedConversation || messages.length === 0) return;
    if (summaryBusyRef.current) return;

    const alreadySummarized = conversationControls[selectedConversation.id]?.summarizedMessageCount ?? 0;
    if (messages.length === alreadySummarized) return; // Only run if there are new messages

    summaryBusyRef.current = true;

    const run = async () => {
      try {
        const { analyzeConversation } = await import("@/services/conversationAnalyzer");
        const history = messages.slice(-30).map((message) => ({
          text: message.content || (message.mediaType ? `[${message.mediaType}]` : ""),
          fromMe: message.fromMe,
        }));

        const analysis = await analyzeConversation(selectedConversation.id, history);
        if (!analysis) return;
        const nextControl = await upsertConversationControl({
          conversationId: selectedConversation.id,
          summary: analysis.summary,
          summarizedMessageCount: messages.length,
          aiEnabled: conversationControls[selectedConversation.id]?.aiEnabled ?? true,
        });

        setConversationControls((prev) => ({
          ...prev,
          [nextControl.conversationId]: {
            ...nextControl,
            summarizedMessageCount: messages.length,
          },
        }));
      } catch {
        // non-blocking
      } finally {
        summaryBusyRef.current = false;
      }
    };

    void run();
  }, [conversationControls, messages, selectedConversation]);

  const inboxRuntimeState = useMemo<"ONLINE" | "DEGRADED" | "WHATSAPP_OFFLINE" | "OFFLINE">(() => {
    const apiReachable = backendOnline || apiHealth === "ONLINE" || apiHealth === "RECONNECTING";
    const websocketReachable = globalWebsocketHealth === "online";
    const runtimeHealthy = runtime.status === "online";

    if (!apiReachable && !websocketReachable) {
      return "OFFLINE";
    }

    if (!isWhatsappConnected) {
      return "WHATSAPP_OFFLINE";
    }

    if (!apiReachable || !websocketReachable || !runtimeHealthy || apiHealth !== "ONLINE") {
      return "DEGRADED";
    }

    return "ONLINE";
  }, [apiHealth, backendOnline, globalWebsocketHealth, isWhatsappConnected, runtime.status]);

  const canUseBackend = inboxRuntimeState === "ONLINE" || inboxRuntimeState === "DEGRADED";
  const canSendMessages = canUseBackend && isWhatsappConnected && !selectedConversation?.isBlocked;

  // Poll in degraded fallback only if WS is offline
  useEffect(() => {
    if (isRealtimeConnected) return; // Suspende polling redundante quando WS estiver online (Etapa 8)

    const intervalId = window.setInterval(() => {
      if (fallbackSyncBusyRef.current) return;
      const activeId = String(selectedConversationRef.current?.id ?? "");
      if (activeId && activeMessageRequestRef.current.has(activeId)) return;
      if (document.hidden) return;

      void (async () => {
        fallbackSyncBusyRef.current = true;
        try {
          await apiService.getSessionStatus();
          await refreshSessions();
          setBackendOnline(true);

        } catch (err) {
          markBackendOffline(err);
        } finally {
          fallbackSyncBusyRef.current = false;
        }
      })();
    }, OFFLINE_FALLBACK_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isRealtimeConnected, refreshSessions, markBackendOffline]);

  // Force reconnect on runtime event
  useEffect(() => {
    const handleRuntimeReconnected = () => {
      const now = Date.now();
      if (isRealtimeConnected) return;
      if (now - lastForceReconnectAtRef.current < SOCKET_FORCE_RECONNECT_DEBOUNCE_MS) return;
      lastForceReconnectAtRef.current = now;
      socketActions.forceReconnect();
    };

    window.addEventListener(RUNTIME_RECONNECTED_EVENT, handleRuntimeReconnected);
    return () => window.removeEventListener(RUNTIME_RECONNECTED_EVENT, handleRuntimeReconnected);
  }, [isRealtimeConnected, socketActions]);

  // Message sending implementation
  const handleSendMessage = useCallback(async (overrideText?: string) => {
    if (sending) return;

    const text = (overrideText ?? messageInput).trim();
    const replyExcerpt = (replyingTo?.caption ?? replyingTo?.content ?? "").trim();
    const textWithReply = replyingTo && replyExcerpt ? `↩ ${replyExcerpt}\n${text}`.trim() : text;
    const currentAttachments = [...attachments];
    const currentReplyingTo = replyingTo;

    if (!selectedConversation?.phone || (!textWithReply && currentAttachments.length === 0)) return;
    if (!canUseBackend) {
      setError("Servidor reconectando... envio temporariamente indisponível.");
      return;
    }


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
      if (!resolvedActiveSession?.id) {
        const unavailableMessage = "Nenhuma sessão do WhatsApp está conectada. Reconecte uma sessão e tente novamente.";
        setError(unavailableMessage);
        showErrorToast(unavailableMessage);
        return;
      }

      const conversationSession = selectedConversation.sessionId
        ? latestSessions.find((session) => session.id === selectedConversation.sessionId)
        : null;
      const sessionIdToSend = conversationSession && isSessionActive(conversationSession)
        ? conversationSession.id
        : resolvedActiveSession.id;

      // Only clear the composer after a connected session has been resolved. If
      // WhatsApp is offline, the user's draft remains available for a retry.
      setMessageInput("");
      setAttachments([]);
      setReplyingTo(null);
      clearDraftFromStorage(selectedConversation.id);
      setDraftsByConversationId((prev) => {
        if (!prev[selectedConversation.id]) return prev;
        const { [selectedConversation.id]: _removed, ...rest } = prev;
        return rest;
      });
      persistDraftSnapshot(selectedConversation.id, {
        draftMessage: "",
        draftMedia: [],
        draftReply: null,
        draftMentions: [],
      });

      setSending(true);
      setPreferredSessionId(sessionIdToSend);
      localStorage.setItem("zapai_inbox_active_session", sessionIdToSend);

      // Clear typing status immediately upon sending a message
      const storeState = useAppStore.getState();
      storeState.updateTypingStatus(selectedConversation.id, false);
      if (selectedConversation.chatId) {
        storeState.updateTypingStatus(selectedConversation.chatId, false);
      }
      if (selectedConversation.phone) {
        storeState.updateTypingStatus(selectedConversation.phone, false);
      }

      const optimisticMessages: ChatMessage[] = currentAttachments.length
        ? currentAttachments.map((attachment, index) => {
            const tempId = `temp-media-${Date.now()}-${index}`;
            pendingTempIds.add(tempId);
            return {
              id: tempId,
              conversationId: selectedConversation.id,
              content: attachment.caption || (index === 0 ? textWithReply : ""),
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
          lastMessage: optimisticLast?.content || textWithReply || (currentAttachments[0]?.mediaType ? getMediaTypeLabel(currentAttachments[0].mediaType) : current.lastMessage || ""),
          lastMessageType: optimisticLast?.mediaType ?? currentAttachments[0]?.mediaType ?? "text",
          updatedAt: optimisticLast?.createdAt ?? now,
        };

        return [updated, ...prev.filter((item) => item.id !== selectedConversation.id)];
      });

      for (let i = 0; i < optimisticMessages.length; i += 1) {
        const optimistic = optimisticMessages[i];
        const attachment = currentAttachments[i];

        if (attachment && attachment.file.size > getUploadLimitBytes(attachment.mediaType)) {
          throw new Error(`O arquivo ${attachment.file.name} excede o limite de ${formatFileSize(getUploadLimitBytes(attachment.mediaType))} para ${getMediaTypeLabel(attachment.mediaType)}.`);
        }

        const base64Payload = attachment ? await fileToBase64(attachment.file) : null;
        if (attachment && base64Payload && estimateBase64Bytes(base64Payload) > getUploadLimitBytes(attachment.mediaType)) {
          throw new Error(`A mídia ${attachment.file.name} ultrapassou o limite de ${formatFileSize(getUploadLimitBytes(attachment.mediaType))} após processamento.`);
        }

        const response: MessageSendResponse = attachment
          ? await apiService.sendMediaMessage({
              phone: selectedConversation.phone,
              chatId: selectedConversation.chatId,
              caption: attachment.caption || (i === 0 ? textWithReply : ""),
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
              chatId: selectedConversation.chatId,
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
        const realStatus = (returnedMsg?.status ?? "server_ack") as ChatMessage["status"];
        const returnedUrl =
          returnedMsg?.url ??
          returnedMsg?.mediaUrl ??
          (returnedMsg as any)?.fileUrl ??
          (returnedMsg as any)?.file_url ??
          optimistic.url ??
          optimistic.mediaUrl;
        const returnedMediaType = returnedMsg?.mediaType ?? attachment?.mediaType ?? optimistic.mediaType;

        setMessagesForConversation(selectedConversation.id, (prev) => {
          if (realId && prev.some((m) => String(m.id) === String(realId))) {
            const next = prev.filter((m) => m.id !== optimistic.id);
            updateConversationMessageStore(
              selectedConversation.id,
              next,
              messageCacheRef.current.get(selectedConversation.id)?.hasMore ?? hasMoreMessages,
            );
            return next;
          }

          const next = prev.map((msg) => {
            if (msg.id === optimistic.id) {
              return {
                ...msg,
                id: realId || msg.id,
                status: realStatus,
                caption: returnedMsg?.caption ?? msg.caption,
                content: returnedMsg?.content ?? msg.content,
                conversationId: returnedMsg?.conversationId ?? msg.conversationId,
                mediaType: returnedMediaType,
                mediaUrl: returnedUrl ?? msg.mediaUrl,
                url: returnedUrl ?? msg.url,
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
        removePendingTempIdsForConversation(selectedConversation.id, [optimistic.id]);
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

      revokeAttachmentPreviewUrls(currentAttachments);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setError(message);
      showErrorToast(message);

      const errMsg = message.toLowerCase();
      const isBlockedError = errMsg.includes("blocked") || errMsg.includes("forbidden") || errMsg.includes("recipient unavailable");
      if (isBlockedError && selectedConversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedConversation.id ? { ...c, isBlocked: true } : c))
        );
      }

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
  }, [activeSession, attachments, canUseBackend, clearPendingFallbackTimersForTempId, hasMoreMessages, inboxRuntimeState, isWhatsappConnected, loadConversationMessages, messageInput, persistDraftSnapshot, preferredSessionId, refreshSessions, removePendingTempIdsForConversation, replyingTo, selectedConversation, sending, sessions, showErrorToast, updateConversationMessageStore, setMessagesForConversation, setConversations]);

  const handleSetConversationAiEnabledById = useCallback(async (conversationId: string, enabled: boolean) => {
    const targetConversation = conversationsRef.current.find((conversation) => conversation.id === conversationId);
    if (!targetConversation || updatingAiToggle) return;

    setUpdatingAiToggle(true);

    try {
      const updated = await upsertConversationControl({
        conversationId: targetConversation.id,
        aiEnabled: enabled,
        summary: conversationControls[targetConversation.id]?.summary,
        summarizedMessageCount: conversationControls[targetConversation.id]?.summarizedMessageCount,
      });
      if (!updated) {
        throw new Error("Backend did not confirm the conversation AI state.");
      }

      const persistedEnabled = updated.aiEnabled;
      setConversationControls((prev) => ({
        ...prev,
        [updated.conversationId]: {
          ...updated,
          summarizedMessageCount: conversationControls[targetConversation.id]?.summarizedMessageCount,
        },
      }));
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === targetConversation.id
            ? { ...conversation, aiEnabled: persistedEnabled }
            : conversation,
        ),
      );
      toast({ title: persistedEnabled ? "IA habilitada para esta conversa." : "IA pausada para esta conversa." });
    } catch {
      showErrorToast("Não foi possível atualizar o controle de IA.");
    } finally {
      setUpdatingAiToggle(false);
    }
  }, [aiRuntime.globalEnabled, conversationControls, setConversations, showErrorToast, toast, updatingAiToggle]);

  const handleSetConversationAgent = useCallback(async (agentName: string) => {
    if (!selectedConversation) return;
    try {
      const updated = await upsertConversationControl({
        conversationId: selectedConversation.id,
        assigned_to: agentName,
        aiEnabled: selectedConversation.aiEnabled,
        summary: conversationControls[selectedConversation.id]?.summary,
        summarizedMessageCount: conversationControls[selectedConversation.id]?.summarizedMessageCount,
      });

      if (updated) {
        setConversationControls((prev) => ({
          ...prev,
          [updated.conversationId]: {
            ...updated,
            summarizedMessageCount: conversationControls[selectedConversation.id]?.summarizedMessageCount,
          },
        }));
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === selectedConversation.id
              ? {
                  ...conversation,
                  assignedAgentName: agentName,
                  agent_name: agentName,
                }
              : conversation,
          ),
        );
        toast({ title: `Atendente alterado para ${agentName}.` });
      }
    } catch {
      showErrorToast("Não foi possível alterar o atendente da conversa.");
    }
  }, [selectedConversation, conversationControls, setConversations, toast, showErrorToast]);

  const addFilesToComposer = useCallback((files: File[]) => {
    const mapped: ComposerAttachment[] = [];

    files.forEach((file) => {
      const mediaType = detectMediaType(file);
      const maxBytes = getUploadLimitBytes(mediaType);
      if (file.size > maxBytes) {
        notify.error(`O arquivo ${file.name} excede o limite de ${formatFileSize(maxBytes)}.`);
        return;
      }

      mapped.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        file,
        mediaType,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (mapped.length > 0) {
      setAttachments((prev) => [...prev, ...mapped]);
    }
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
    const value = getMessageDisplayContent(message).trim();
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
    const value = getMessageDisplayContent(message).trim();
    setMessageInput(value ? `Encaminhar: ${value}` : `Encaminhar ${getMediaTypeLabel(message.mediaType)}: `);
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId(null);
    window.requestAnimationFrame(() => messageInputRef.current?.focus());
  }, []);

  const handleDownloadMedia = useCallback((message: ChatMessage) => {
    const mediaUrl = resolveMediaUrl(extractMessageAssetUrl(message));
    if (!mediaUrl) {
      toast({ title: "Mídia indisponível", variant: "destructive" });
      return;
    }

    void downloadMediaFile(mediaUrl, getMediaFileName(message));
    setActiveMessageMenuId(null);
    setActiveReactionPickerMessageId(null);
  }, [toast]);

  const handleDeleteMessage = useCallback(async (messageId: string, scope: "local" | "everyone" = "local") => {
    if (!selectedConversationId) return;
    try {
      const response = await apiService.deleteMessage(messageId, scope);
      if (response.success) {
        useAppStore.getState().deleteMessage(selectedConversationId, messageId);
        setPreviewMedia((current) => (current?.messageId === messageId ? null : current));
        setActiveMessageMenuId(null);
        setActiveReactionPickerMessageId(null);
        toast({
          title: scope === "everyone" ? "Mensagem excluída para todos" : "Mensagem excluída para você",
        });
      } else {
        toast({ title: "Falha ao excluir mensagem", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      const fallback = scope === "everyone"
        ? "Não foi possível excluir para todos. A mensagem pode ser antiga ou a sessão está offline."
        : "Erro ao tentar excluir a mensagem";
      toast({ title: fallback, variant: "destructive" });
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

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => {
      const found = prev.find((item) => item.id === attachmentId);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((item) => item.id !== attachmentId);
    });
  }, []);

  const updateAttachmentCaption = useCallback((attachmentId: string, caption: string) => {
    setAttachments((prev) =>
      prev.map((item) => (item.id === attachmentId ? { ...item, caption } : item))
    );
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (!files.length) return;
    addFilesToComposer(files);
  }, [addFilesToComposer]);

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

  const handleSuggestResponse = useCallback(async () => {
    if (!selectedConversation || suggestingResponse || !aiEnabledForConversation) return;

    const lastCustomerMessage = [...messages].reverse().find((message) => !message.fromMe)?.content;
    if (!lastCustomerMessage) return;

    setSuggestingResponse(true);

    try {
      const [{ analyzeLeadIntent }, { generateResponse }] = await Promise.all([
        import("@/services/leadAnalyzer"),
        import("@/services/responseEngine"),
      ]);
      const history = messages.slice(-20).map((message) => ({
        role: message.fromMe ? ("assistant" as const) : ("user" as const),
        content: message.content,
      }));

      const lead = leadInsight ?? analyzeLeadIntent(lastCustomerMessage, history.map((item) => item.content));
      const promptData = await apiService.getAIPrompt();

      const optimized = await generateResponse(selectedConversation.id, {
        prompt: promptData.prompt ?? "Você é uma assistente comercial focada em fechar vendas com clareza e simpatia.",
        messages: history.map((item) => ({
          text: item.content,
          fromMe: item.role === "assistant",
        })),
      });

      if (!optimized) throw new Error("A IA nao retornou uma sugestao.");
      setMessageInput(optimized);
      toast({ title: "Sugestão pronta para envio." });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "AI response unavailable.";
      showErrorToast(message);
    } finally {
      setSuggestingResponse(false);
    }
  }, [aiEnabledForConversation, selectedConversation, suggestingResponse, messages, leadInsight, toast, showErrorToast]);

  const handleSetConversationAiEnabled = useCallback(async (enabled: boolean) => {
    if (!selectedConversation) return;
    await handleSetConversationAiEnabledById(selectedConversation.id, enabled);
  }, [handleSetConversationAiEnabledById, selectedConversation]);

  const handleArchiveSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    const chatId = String(selectedConversation.id);
    setArchivedChatIds((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));
    socketActions.emitArchiveChat(chatId);
    toast({ title: "Conversa arquivada." });
  }, [selectedConversation, socketActions, toast]);

  const handleUnarchiveSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    const chatId = String(selectedConversation.id);
    setArchivedChatIds((prev) => prev.filter((id) => id !== chatId));
    socketActions.emitUnarchiveChat(chatId);
    toast({ title: "Conversa desarquivada." });
  }, [selectedConversation, socketActions, toast]);

  const handleClearSelectedConversation = useCallback(() => {
    if (!selectedConversation?.id) return;
    setMessagesForConversation(selectedConversation.id, []);
    updateConversationMessageStore(selectedConversation.id, [], false);
    toast({ title: "Conversa limpa localmente." });
  }, [selectedConversation?.id, setMessagesForConversation, updateConversationMessageStore, toast]);

  const handleBlockContact = useCallback(async () => {
    if (!selectedConversation?.phone) return;
    try {
      const response = await requestApiEndpoint<{ ok: boolean }>(
        `/api/contacts/${encodeURIComponent(selectedConversation.phone)}/block`,
        "POST"
      );
      if (response && response.ok) {
        toast({
          title: `Contato ${selectedConversation.contactName || selectedConversation.phone} bloqueado com sucesso.`,
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id ? { ...c, isBlocked: true } : c
          )
        );
      } else {
        toast({
          title: `Falha ao bloquear contato.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      showErrorToast("Erro ao bloquear contato.");
    }
  }, [selectedConversation, toast, showErrorToast, setConversations]);

  const handleUnblockContact = useCallback(async () => {
    if (!selectedConversation?.phone) return;
    try {
      const response = await requestApiEndpoint<{ ok: boolean }>(
        `/api/contacts/${encodeURIComponent(selectedConversation.phone)}/unblock`,
        "POST"
      );
      if (response && response.ok) {
        toast({
          title: `Contato ${selectedConversation.contactName || selectedConversation.phone} desbloqueado com sucesso.`,
        });
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id ? { ...c, isBlocked: false } : c
          )
        );
      } else {
        toast({
          title: `Falha ao desbloquear contato.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      showErrorToast("Erro ao desbloquear contato.");
    }
  }, [selectedConversation, toast, showErrorToast, setConversations]);

  const persistConversationMetadata = useCallback(async (conversationId: string, payload: { tags?: string[]; funnel_stage?: string; notes?: string }) => {
    try {
      await apiService.patchConversation(conversationId, payload);
    } catch (error) {
      console.error("Falha ao persistir dados da conversa", error);
      notify.error("Não foi possível salvar os dados da conversa.");
    }
  }, []);

  const handleSaveLeadNotes = useCallback(async () => {
    if (!selectedConversation) return;
    const normalizedNotes = leadNotes.trim();
    await persistConversationMetadata(selectedConversation.id, { notes: normalizedNotes });
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id ? { ...conversation, notes: normalizedNotes } : conversation,
      ),
    );
    toast({ title: "Observações salvas." });
  }, [leadNotes, persistConversationMetadata, selectedConversation, setConversations, toast]);

  const handleAddTagToSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    const normalizedTag = newTagInput.trim();
    if (!normalizedTag) return;

    const nextTags = Array.from(new Set([...(selectedConversation.tags ?? []), normalizedTag]));
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, tags: nextTags }
          : conversation,
      ),
    );

    socketActions.emitAddTag(selectedConversation.id, normalizedTag);
    void persistConversationMetadata(selectedConversation.id, { tags: nextTags });
    setNewTagInput("");
  }, [newTagInput, selectedConversation, socketActions, persistConversationMetadata, setConversations]);

  const handleRemoveTagFromSelectedConversation = useCallback((tag: string) => {
    if (!selectedConversation) return;
    const nextTags = (selectedConversation.tags ?? []).filter((currentTag) => currentTag !== tag);

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, tags: nextTags }
          : conversation,
      ),
    );

    socketActions.emitRemoveTag(selectedConversation.id, tag);
    void persistConversationMetadata(selectedConversation.id, { tags: nextTags });
  }, [selectedConversation, socketActions, persistConversationMetadata, setConversations]);

  // Bulk operations implementations
  const handleBulkPin = useCallback(() => {
    const allPinned = selectedChatIds.every((id) => pinnedChatIds.includes(id));
    if (allPinned) {
      setPinnedChatIds((prev) => prev.filter((id) => !selectedChatIds.includes(id)));
      toast({ title: "Conversas desfixadas." });
    } else {
      setPinnedChatIds((prev) => Array.from(new Set([...prev, ...selectedChatIds])));
      toast({ title: "Conversas fixadas." });
    }
    setSelectedChatIds([]);
    setIsMultiSelectMode(false);
  }, [selectedChatIds, pinnedChatIds, toast]);

  const handleTogglePin = useCallback((conversationId: string) => {
    setPinnedChatIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId],
    );
  }, []);

  const handleToggleArchive = useCallback((conversationId: string) => {
    setArchivedChatIds((current) => {
      const isArchived = current.includes(conversationId);
      if (isArchived) {
        socketActions.emitUnarchiveChat(conversationId);
        return current.filter((id) => id !== conversationId);
      }
      socketActions.emitArchiveChat(conversationId);
      return [...current, conversationId];
    });
  }, [socketActions]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    try {
      const response = await apiService.deleteConversation(conversationId);
      if (!response.success) throw new Error("Falha ao excluir conversa");
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
      if (selectedConversationId === conversationId) setSelectedConversationId(null);
      toast({ title: "Conversa excluida com sucesso." });
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Falha ao excluir conversa.");
    }
  }, [selectedConversationId, setConversations, setSelectedConversationId, showErrorToast, toast]);

  const handleUpdateConversationTags = useCallback((conversationId: string, tags: string[]) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, tags } : conversation,
      ),
    );
    void persistConversationMetadata(conversationId, { tags });
  }, [persistConversationMetadata, setConversations]);

  const handleBulkArchive = useCallback(() => {
    const allArchived = selectedChatIds.every((id) => archivedChatIds.includes(id));
    if (allArchived) {
      setArchivedChatIds((prev) => prev.filter((id) => !selectedChatIds.includes(id)));
      selectedChatIds.forEach((id) => socketActions.emitUnarchiveChat(id));
      toast({ title: "Conversas desarquivadas." });
    } else {
      setArchivedChatIds((prev) => Array.from(new Set([...prev, ...selectedChatIds])));
      selectedChatIds.forEach((id) => socketActions.emitArchiveChat(id));
      toast({ title: "Conversas arquivadas." });
    }
    setSelectedChatIds([]);
    setIsMultiSelectMode(false);
  }, [selectedChatIds, archivedChatIds, socketActions, toast]);

  const handleBulkAddTag = useCallback(async (tag: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (selectedChatIds.includes(c.id)) {
          const nextTags = Array.from(new Set([...(c.tags ?? []), tag]));
          socketActions.emitAddTag(c.id, tag);
          void apiService.patchConversation(c.id, { tags: nextTags }).catch(console.error);
          return { ...c, tags: nextTags };
        }
        return c;
      })
    );
    toast({ title: `Tag "${tag}" adicionada a todas as conversas selecionadas.` });
    setSelectedChatIds([]);
    setIsMultiSelectMode(false);
  }, [selectedChatIds, socketActions, setConversations, toast]);

  const handleBulkDelete = useCallback(async () => {
    let successCount = 0;
    for (const id of selectedChatIds) {
      try {
        const response = await apiService.deleteConversation(id);
        if (response.success) {
          successCount++;
        }
      } catch (err) {
        console.error("Erro ao deletar conversa bulk", id, err);
      }
    }
    if (successCount > 0) {
      setConversations((prev) => prev.filter((c) => !selectedChatIds.includes(c.id)));
      if (selectedConversationId && selectedChatIds.includes(selectedConversationId)) {
        setSelectedConversationId(null);
      }
      toast({ title: `${successCount} conversas excluídas com sucesso.` });
    } else {
      toast({ title: "Falha ao excluir conversas.", variant: "destructive" });
    }
    setSelectedChatIds([]);
    setIsMultiSelectMode(false);
  }, [selectedChatIds, selectedConversationId, setConversations, setSelectedConversationId, toast]);

  const handleBulkExportContacts = useCallback(() => {
    const selectedList = conversations.filter((c) => selectedChatIds.includes(c.id));
    const csvContent = [
      ["Nome", "Telefone", "Tags"],
      ...selectedList.map((c) => [c.contactName, c.phone, (c.tags ?? []).join(";")]),
    ]
      .map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `contatos_exportados_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: `${selectedList.length} contatos exportados.` });
    setSelectedChatIds([]);
    setIsMultiSelectMode(false);
  }, [selectedChatIds, conversations, toast]);

  const handleBulkLoadCampaign = useCallback(async () => {
    const selectedList = conversations.filter((c) => selectedChatIds.includes(c.id));
    const contacts = selectedList.map((c) => ({
      id: String(c.contactId || c.phone),
      name: c.contactName,
      phone: c.phone,
      status: "pending" as const,
    }));

    try {
      await apiService.createCampaign({
        name: `Campanha Inbox ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        selectedContacts: contacts,
        messages: [],
        settings: {
          intervalSeconds: 30,
          pauseEvery: 10,
          pauseSeconds: 60,
          typingDelaySeconds: 3,
        },
        tags: [],
      });
      toast({ title: "Campanha criada com os contatos selecionados!" });
      navigate("/campaigns");
    } catch (err) {
      console.error(err);
      toast({ title: "Falha ao criar campanha com os contatos.", variant: "destructive" });
    }
    setSelectedChatIds([]);
    setIsMultiSelectMode(false);
  }, [selectedChatIds, conversations, toast, navigate]);

  // Quick Replies loading & execution
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
            steps: qr.steps || [],
            isFlow: qr.isFlow,
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

  const conversationVariableContext = useMemo(
    () => ({
      contactName: selectedConversation?.contactName || "",
      phone: selectedConversation?.phone || "",
      company: typeof aiMemory?.company === "string" ? aiMemory.company : "ZapAI",
    }),
    [aiMemory?.company, selectedConversation?.contactName, selectedConversation?.phone],
  );

  const sendQuickReply = useCallback(async (arg: string | QuickReplyItem) => {
    if (!selectedConversation) return;

    if (typeof arg === "string") {
      await handleSendMessage(interpolateTemplateVariables(arg, conversationVariableContext));
      return;
    }

    setSending(true);
    try {
      await apiService.executeQuickReplyFlow(arg.id || "custom", {
        phone: selectedConversation.phone,
        sessionId: selectedConversation.sessionId || preferredSessionId || undefined,
        item: arg,
      });
      notify.success("Fluxo / Resposta Rápida iniciada.");
    } catch (err: any) {
      console.error("[SEND_QUICK_REPLY_ERROR]", err);
      if (arg.text && !arg.mediaUrl && (!arg.items || arg.items.length === 0)) {
        await handleSendMessage(interpolateTemplateVariables(arg.text, conversationVariableContext));
      } else {
        notify.error("Falha ao disparar resposta rápida.");
      }
    } finally {
      setSending(false);
    }
  }, [selectedConversation, preferredSessionId, handleSendMessage, conversationVariableContext]);

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

  // Quick Reply creation modal triggers
  const openCreateQuickReplyDialog = () => {
    setQrDialogId(null);
    setQrDialogTitle("");
    setQrDialogCategory("saudação");
    setQrDialogFavorite(false);
    setQrDialogTags([]);
    setQrDialogIsFlow(false);
    setQrDialogItems([{ id: `item-${Date.now()}-initial`, type: "text", value: "", delayMs: 0, typingMs: 1500, caption: "", actions: { addTags: [], archiveContact: false } }]);
    setIsQuickReplyDialogOpen(true);
  };

  const openEditQuickReplyDialog = (reply: QuickReplyItem) => {
    setQrDialogId(reply.id);
    setQrDialogTitle(reply.title || reply.text || "");
    setQrDialogCategory(reply.category);
    setQrDialogFavorite(Boolean(reply.favorite));
    setQrDialogTags(reply.tags || []);
    setQrDialogIsFlow(Boolean(reply.isFlow));

    const sourceItems = reply.isFlow ? (reply.steps || []) : (reply.items || [{ type: "text", value: reply.text }]);
    const itemsWithIds = sourceItems.map((item: any, index) => ({
      ...item,
      id: item.id || `item-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 7)}`,
      delayMs: item.delayMs ?? 0,
      typingMs: item.typingMs ?? 1500,
      caption: item.caption ?? "",
      actions: item.actions || { addTags: [], archiveContact: false },
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
      isFlow: qrDialogIsFlow,
      items: qrDialogIsFlow ? undefined : items.map(item => ({
        type: item.type,
        value: item.value,
        filename: item.filename,
        delayMs: item.delayMs ?? 0,
        typingMs: item.typingMs ?? 1500,
        caption: item.caption ?? "",
      })),
      steps: qrDialogIsFlow ? items.map(item => ({
        id: item.id,
        type: item.type,
        value: item.value,
        filename: item.filename,
        delayMs: item.delayMs || 0,
        typingMs: item.typingMs ?? 1500,
        caption: item.caption ?? "",
        actions: item.actions || { addTags: [], archiveContact: false },
      })) : undefined,
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
                  isFlow: updated.isFlow,
                  steps: updated.steps,
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
            isFlow: created.isFlow,
            steps: created.steps,
          },
        ]);
        notify.success("Resposta rápida criada.");
      }
      setIsQuickReplyDialogOpen(false);
    } catch (err) {
      notify.error("Falha ao salvar resposta rápida.");
    }
  };

  const addQrDialogTextItem = () => {
    setQrDialogItems((prev) => [...prev, {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type: "text",
      value: "",
      delayMs: 0,
      typingMs: 1500,
      caption: "",
      actions: { addTags: [], archiveContact: false },
    }]);
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

  const handleQrDialogMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = detectMediaType(file);
      const maxBytes = getUploadLimitBytes(type);
      if (file.size > maxBytes) {
        notify.error(`O arquivo ${file.name} excede o limite.`);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const value = `data:${file.type};base64,${base64}`;
        setQrDialogItems((prev) => [
          ...prev,
          {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type,
            value,
            filename: file.name,
            delayMs: 0,
            typingMs: 1500,
            caption: "",
            actions: { addTags: [], archiveContact: false },
          },
        ]);
      } catch (err) {
        notify.error(`Erro ao carregar arquivo: ${file.name}`);
      }
    }

    event.target.value = "";
  };

  const handleInsertTag = useCallback((tag: string) => {
    if (!selectedConversation || !tag) return;
    const currentTags = selectedConversation.tags ?? [];
    if (currentTags.includes(tag)) return;
    const nextTags = [...currentTags, tag];
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversation.id ? { ...c, tags: nextTags } : c)),
    );
    socketActions.emitAddTag(selectedConversation.id, tag);
    void persistConversationMetadata(selectedConversation.id, { tags: nextTags });
  }, [selectedConversation, setConversations, socketActions, persistConversationMetadata]);

  // Audio timer trigger
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

  useEffect(() => {
    return () => {
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = null;
    };
  }, []);

  return {
    // states
    inboxRuntimeState,
    canUseBackend,
    canSendMessages,
    messageInput, setMessageInput,
    draftsByConversationId,
    filter, setFilter,
    searchQuery, setSearchQuery,
    conversationSearchOpen, setConversationSearchOpen,
    conversationSearchQuery, setConversationSearchQuery,
    activeConversationSearchIndex, setActiveConversationSearchIndex,
    loadingConversations,
    loadingMessages,
    loadingOlderMessages,
    conversationsLoadFailed,
    messagesLoadFailed,
    sending,
    error, setError,
    backendOnline,
    isRealtimeConnected,
    hasMoreMessages,
    pendingBackgroundUpdates,
    conversationListHeight,
    leadInsight,
    suggestingResponse,
    responseSearchQuery, setResponseSearchQuery,
    quickReplies, setQuickReplies,
    quickReplyCategory, setQuickReplyCategory,
    isQuickReplyDialogOpen, setIsQuickReplyDialogOpen,
    qrDialogId,
    qrDialogTitle, setQrDialogTitle,
    qrDialogCategory, setQrDialogCategory,
    qrDialogFavorite, setQrDialogFavorite,
    qrDialogTags, setQrDialogTags,
    qrDialogNewTag, setQrDialogNewTag,
    qrDialogItems, setQrDialogItems,
    qrDialogIsFlow, setQrDialogIsFlow,
    aiMemory,
    aiRuntime,
    attachments, setAttachments,
    isDraggingFiles, setIsDraggingFiles,
    isRecording,
    recordingTime,
    showEmojiPicker, setShowEmojiPicker,
    EmojiPickerComponent,
    emojiPickerData,
    showLeadPanel, setShowLeadPanel,
    rightPanelTab, setRightPanelTab,
    rightPanelCollapsed, setRightPanelCollapsed,
    mobileScreen, setMobileScreen,
    isMobile,
    isTabletLayout,
    keyboardOffset,
    preferredSessionId,
    sessions,
    messageReactions,
    activeMessageMenuId, setActiveMessageMenuId,
    activeReactionPickerMessageId, setActiveReactionPickerMessageId,
    replyingTo, setReplyingTo,
    unseenRealtimeCount,
    conversationControls,
    updatingAiToggle,
    newTagInput, setNewTagInput,
    leadNotes, setLeadNotes,
    previewMedia, setPreviewMedia,
    previewZoom, setPreviewZoom,
    archivedChatIds,
    pinnedChatIds,
    isMultiSelectMode, setIsMultiSelectMode,
    selectedChatIds, setSelectedChatIds,
    playingAudioMessageId,
    loadingAudioMessageId,
    audioProgress,
    audioDuration,

    // refs
    fileInputRef,
    messageInputRef,
    conversationSearchInputRef,
    messagesScrollRef,
    loadMoreTriggerRef,
    messagesRef,
    autoScrollRef,
    selectedConversationRef,
    conversationsRef,
    contactDirectoryRef,

    // callbacks
    selectedConversation,
    isTyping,
    selectedConversationKey,
    activeSession,
    isWhatsappConnected,
    connectedPhone,
    aiEnabledForConversation,
    conversationAiOverrideEnabled,
    conversations,
    messages,
    leadByConversationId,
    typingByConversationId,
    aiProgress,
    setConversations,
    setSelectedConversationId,
    setMessagesForConversation,
    setMessages,
    refreshSessions,
    loadConversationMessages,
    handleRetryConversations,
    handleRetryMessages,
    handleLoadOlderMessages,
    applyPendingBackgroundUpdates,
    scrollToLatestMessage,
    handleSendMessage,
    handleSetConversationAiEnabledById,
    handleAttachFiles,
    handleInsertEmoji,
    handleCopyMessage,
    handleReplyMessage,
    handleForwardMessage,
    handleDownloadMedia,
    handleDeleteMessage,
    handleReactMessage,
    handleToggleMessageMenu,
    handleToggleReactionPicker,
    handleToggleAudioPlayback,
    removeAttachment,
    updateAttachmentCaption,
    handleDrop,
    handleCancelRecording,
    handleToggleRecording,
    handleSuggestResponse,
    handleSetConversationAiEnabled,
    handleArchiveSelectedConversation,
    handleUnarchiveSelectedConversation,
    handleClearSelectedConversation,
    handleBlockContact,
    handleUnblockContact,
    handleSaveLeadNotes,
    handleAddTagToSelectedConversation,
    handleRemoveTagFromSelectedConversation,
    handleBulkPin,
    handleTogglePin,
    handleToggleArchive,
    handleDeleteConversation,
    handleUpdateConversationTags,
    handleBulkArchive,
    handleBulkAddTag,
    handleBulkDelete,
    handleBulkExportContacts,
    handleBulkLoadCampaign,
    sendQuickReply,
    deleteQuickReply,
    toggleFavoriteQuickReply,
    duplicateQuickReply,
    openCreateQuickReplyDialog,
    openEditQuickReplyDialog,
    saveQuickReplyDialog,
    addQrDialogTextItem,
    removeQrDialogItem,
    moveQrDialogItem,
    handleQrDialogMediaUpload,
    handleInsertTag,
    conversationVariableContext,
    aiAgents,
    loadingAgents,
    handleSetConversationAgent,
  };
}
