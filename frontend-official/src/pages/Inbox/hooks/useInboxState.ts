import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/state/hooks/use-toast";
import { useIsMobile } from "@/state/hooks/use-mobile";
import { useRuntime } from "@/state/providers/RuntimeProvider";
import { useAppStore, resolveStoreConversationId } from "@/state/stores/appStore";
import { apiService, requestApiEndpoint, type ChatMessage, type Conversation, type SessionInfo, type MessageSendResponse } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { generateUuid } from "@/core/lib/utils";
import { listConversationControls, upsertConversationControl } from "@/core/services/conversationControlStore";
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
  QuickReplyCategoryAppearance,
  QuickReplyMediaItem,
} from "../types";

const CONVERSATIONS_PAGE_SIZE = 100;
const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_CACHE_TTL_MS = 60_000;
const DRAFT_TTL_MS = 5 * 60 * 1000;
const RUNTIME_RECONNECTED_EVENT = "runtime:reconnected";
const OFFLINE_MESSAGE_POLL_INTERVAL_MS = 45_000;
const OFFLINE_FALLBACK_SYNC_INTERVAL_MS = 60_000;
const SOCKET_FORCE_RECONNECT_DEBOUNCE_MS = 15_000;

const EMPTY_MESSAGES_ARRAY: ChatMessage[] = [];

export function useConversationSearch(query: string, onResults: (rows: Conversation[]) => void) {
  const sessionId = useAppStore((state) => state.activeSessionId) || undefined;
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const retry = useCallback(() => setRetryVersion((version) => version + 1), []);

  useEffect(() => {
    const search = query.trim();
    let cancelled = false;
    setFailed(false);
    setLoading(Boolean(search));
    if (!search) return;

    const timer = window.setTimeout(() => {
      void apiService.getConversations(true, { limit: 50, sessionId, search })
        .then((rows) => { if (!cancelled) onResults(filterConversationsForSession(rows, sessionId)); })
        .catch(() => { if (!cancelled) setFailed(true); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, sessionId, onResults, retryVersion]);

  return { loading, failed, retry };
}

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
  const [historySyncStatus, setHistorySyncStatus] = useState<"idle" | "requesting" | "requested" | "imported" | "error">("idle");
  const historySyncRequestedAtRef = useRef<Map<string, number>>(new Map());
  const [conversationsLoadFailed, setConversationsLoadFailed] = useState(false);
  const [messagesLoadFailed, setMessagesLoadFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const sendingQuickReplyRef = useRef(false);
  const retryQuickReplyIdsRef = useRef<Map<string, string>>(new Map());
  const retrySendRequestIdsRef = useRef<Map<string, string>>(new Map());
  const lastSentTextRef = useRef("");
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
  const suggestingResponseRef = useRef(false);
  const suggestionContextRef = useRef(0);
  const [responseSearchQuery, setResponseSearchQuery] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>([]);
  const [quickReplyCategoryAppearance, setQuickReplyCategoryAppearance] = useState<QuickReplyCategoryAppearance>({});
  const [quickReplyCategoryAppearanceError, setQuickReplyCategoryAppearanceError] = useState(false);
  const [quickRepliesLoading, setQuickRepliesLoading] = useState(true);
  const [quickRepliesError, setQuickRepliesError] = useState(false);
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
    globalEnabled: false,
    memoryEnabled: true,
    provider: "Não configurado",
    model: "Não configurado",
    lastResponseAt: null,
    lastResponseTimeMs: null,
    promptTokens: 0,
    completionTokens: 0,
    loading: true,
    aiOn: false,
    providerReady: false,
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
  const [isTabletLayout, setIsTabletLayout] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsTabletLayout(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
  const scrollFrameRef = useRef<number | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const pendingScrollBehaviorRef = useRef<ScrollBehavior>("auto");
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
      draftReply: draftOverride?.draftReply !== undefined ? draftOverride.draftReply : replyingToStateRef.current,
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
    const oldestCursor = nextMessages.length > 0 ? String(nextMessages[0]?.timestamp ?? nextMessages[0]?.createdAt ?? "") || null : null;

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
    // Coalesce bursts from Socket.IO, optimistic updates and React renders.
    // The old implementation scheduled two independent scrolls per update,
    // which caused visible jumps and unnecessary layout/repaint work.
    if (behavior === "auto") {
      pendingScrollBehaviorRef.current = "auto";
    } else if (pendingScrollBehaviorRef.current !== "auto") {
      pendingScrollBehaviorRef.current = behavior;
    }

    const runScroll = () => {
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      scrollFrameRef.current = null;
      scrollTimerRef.current = null;
      const viewport = getMessagesViewport();
      if (!viewport) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: pendingScrollBehaviorRef.current });
      autoScrollRef.current = true;
      setUnseenRealtimeCount(0);
    };

    if (scrollFrameRef.current === null) {
      scrollFrameRef.current = window.requestAnimationFrame(runScroll);
    }
    if (scrollTimerRef.current === null) {
      scrollTimerRef.current = window.setTimeout(runScroll, 180);
    }
  }, [getMessagesViewport]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
  }, []);

  const rememberContacts = useCallback((nextConversations: Conversation[]) => {
    const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, nextConversations);
    contactDirectoryRef.current = mergedDirectory;
    persistContactDirectory(mergedDirectory);
  }, []);

  const mergeConversationsSnapshot = useCallback((incoming: Conversation[], sessionId: string | null = preferredSessionIdRef.current) => {
    const sessionScopedIncoming = filterConversationsForSession(incoming, sessionId);
    const mergedDirectory = mergeContactDirectory(contactDirectoryRef.current, sessionScopedIncoming);
    contactDirectoryRef.current = mergedDirectory;
    persistContactDirectory(mergedDirectory);

    setConversations((prev) => {
      const visiblePrev = prev.filter((conversation) => !isOwnSessionConversation(conversation));
      const visibleIncoming = sessionScopedIncoming.filter((conversation) => !isOwnSessionConversation(conversation));
      return dedupeConversationsByScope([...visiblePrev, ...visibleIncoming], mergedDirectory);
    });
  }, [isOwnSessionConversation, setConversations]);

  // Search already captured the connection filter; keep its results when a
  // background snapshot refreshes the connection used by the open chat.
  const mergeConversationSearchSnapshot = useCallback((incoming: Conversation[]) => {
    mergeConversationsSnapshot(incoming, null);
  }, [mergeConversationsSnapshot]);

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
    if (selectedConversation?.sessionId) {
      return sessions.find((s) => s && s.id === selectedConversation.sessionId) ?? null;
    }
    return pickActiveSession(sessions, preferredSessionId) ?? sessions[0] ?? null;
  }, [sessions, selectedConversation?.sessionId, preferredSessionId]);

  const conversationSearch = useConversationSearch(
    searchQuery,
    mergeConversationSearchSnapshot,
  );

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
    suggestionContextRef.current += 1;
  }, [selectedConversation?.id]);


  useEffect(() => {
    setLeadNotes(
      selectedConversation?.notes ??
      conversationControls[selectedConversation?.id ?? ""]?.notes ??
      "",
    );
  }, [conversationControls[selectedConversation?.id ?? ""]?.notes, selectedConversation?.id, selectedConversation?.notes]);

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
        setSelectedConversationId(isMobile ? null : (conversations[0]?.id ?? null));
        if (isMobile) {
          setMobileScreen("conversations");
          useAppStore.getState().setIsMobileChatOpen(false);
        }
      }
    } else if (!selectedConversationId && conversations.length > 0 && !urlConvId && !normUrlPhone) {
      if (!isMobile) {
        setSelectedConversationId(conversations[0]?.id ?? null);
      }
    }
  }, [conversations, selectedConversationId, setSelectedConversationId, setConversations, preferredSessionId, isMobile]);

  useEffect(() => {
    if (!activeSession?.id) return;
    setPreferredSessionId(activeSession.id);
    localStorage.setItem("zapai_inbox_active_session", activeSession.id);
  }, [activeSession?.id]);

  useEffect(() => {
    const memoryContactId = String(selectedConversation?.contactId ?? selectedConversation?.phone ?? "").trim();
    let active = true;
    setAiMemory(null);
    if (memoryContactId) {
      void apiService.getMemoryByContact(memoryContactId, selectedConversation?.sessionId)
        .then(response => { if (active) setAiMemory(response?.success ? response.data ?? null : null); })
        .catch(() => { if (active) setAiMemory(null); });
    }
    return () => { active = false; };
  }, [selectedConversation?.id, selectedConversation?.contactId, selectedConversation?.phone, selectedConversation?.sessionId]);

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
          providerReady: Boolean(activeProvider && ((activeProvider as any).configured || (activeProvider as any).hasApiKey)),
        });
      } catch (error) {
        if (cancelled) return;
        setAiRuntime((current) => ({ ...current, loading: false, providerReady: false }));
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
      useAppStore.getState().setIsMobileChatOpen(false);
      return;
    }

    if (!selectedConversationId) {
      setMobileScreen("conversations");
      useAppStore.getState().setIsMobileChatOpen(false);
    } else if (mobileScreen === "chat") {
      useAppStore.getState().setIsMobileChatOpen(true);
    }
  }, [isMobile, selectedConversationId, mobileScreen]);

  useEffect(() => {
    return () => {
      useAppStore.getState().setIsMobileChatOpen(false);
    };
  }, []);

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
    let before = seedMessages[0]?.timestamp || seedMessages[0]?.createdAt;
    let beforeId = /^\d+$/.test(String(seedMessages[0]?.id || '')) ? String(seedMessages[0].id) : undefined;

    for (let page = 0; page < 2; page += 1) {
      if (!before) break;

      const olderBatch = await apiService.getMessages(conversationId, {
        limit: MESSAGE_PAGE_SIZE,
        before,
        beforeId,
      });

      if (!olderBatch.length) break;

      const normalizedBatch = olderBatch
        .map((item) => ({ ...item, conversationId: item.conversationId ?? normalizedConversationId }))
        .filter((item) => String(item.conversationId ?? "") === normalizedConversationId);

      if (!normalizedBatch.length) break;

      merged = sortMessagesAsc(mergeMessagesById(merged, normalizedBatch));
      before = normalizedBatch[0]?.timestamp || normalizedBatch[0]?.createdAt;
      beforeId = /^\d+$/.test(String(normalizedBatch[0]?.id || '')) ? String(normalizedBatch[0].id) : undefined;

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

      // Show persisted messages as a skeleton ONLY if they belong to this exact conversation.
      // They will be replaced immediately once the server fetch completes.
      if (!cached && persisted.length > 0) {
        const sortedPersisted = sortMessagesAsc(persisted);
        const allBelongToConv = sortedPersisted.every(
          (msg) => !msg.conversationId || normalizeId(msg.conversationId) === normalizeId(normalizedConversationId),
        );
        if (allBelongToConv && normalizeId(selectedConversationRef.current?.id) === normalizeId(normalizedConversationId)) {
          setMessagesForConversation(normalizedConversationId, sortedPersisted);
          setHasMoreMessages(sortedPersisted.length >= MESSAGE_PAGE_SIZE);
        }
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

        // Server response is the authoritative source of truth.
        // Only merge temp outgoing messages (not yet confirmed) from the current in-memory state.
        const sorted = sortMessagesAsc(
          normalizedData.filter((item) => normalizeId(item.conversationId) === normalizeId(normalizedConversationId)),
        );
        const currentInMemory = messagesRef.current.filter(
          (msg) => String(msg.id).startsWith("temp-") && normalizeId(msg.conversationId) === normalizeId(normalizedConversationId),
        );
        // Use server data as the base; only append unconfirmed outgoing temp messages on top.
        const mergedWithCache = sortMessagesAsc(mergeMessagesById(sorted, currentInMemory));
        // A short first page still needs one older-page probe so the user can
        // explicitly ask WhatsApp for history using a real message cursor.
        const hasMore = normalizedData.length >= MESSAGE_PAGE_SIZE || (!options?.background && normalizedData.length > 0);

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

        if (isSelectedConversation) {
          // Always replace with server data — no stale localStorage bleed-through.
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
    const conversationId = String(selectedConversation?.id ?? "");
    if (!conversationId) return;
    const handleHistoryImported = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationIds?: string[] }>).detail;
      if (detail?.conversationIds?.some((id) => String(id) === conversationId)) setHistorySyncStatus("imported");
    };
    window.addEventListener("whatsapp:history-imported", handleHistoryImported);
    return () => window.removeEventListener("whatsapp:history-imported", handleHistoryImported);
  }, [selectedConversation?.id]);

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
    const oldestCursor = messages.length > 0 ? String(messages[0]?.timestamp ?? messages[0]?.createdAt ?? "") || null : null;
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
    setHistorySyncStatus("idle");

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
    if (searchQuery.trim()) {
      conversationSearch.retry();
      return;
    }
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
  }, [activeSession?.id, markBackendOffline, markBackendOnline, mergeConversationsSnapshot, preferredSessionId, showErrorToast, searchQuery, conversationSearch.retry]);

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
    if (!selectedConversation?.id || !messages.length || loadingOlderMessages) return;

    setLoadingOlderMessages(true);
    try {
      const cacheKey = selectedConversation ? getConversationKey(selectedConversation) : null;
      const before = (cacheKey ? messageCacheRef.current.get(cacheKey)?.oldestCursor : null) || messages[0]?.timestamp || messages[0]?.createdAt;
      const olderBatch = await apiService.getMessages(selectedConversation.id, {
        limit: MESSAGE_PAGE_SIZE,
        before,
        beforeId: /^\d+$/.test(String(messages[0]?.id || '')) ? String(messages[0].id) : undefined,
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

      if (!nextHasMore && selectedConversation?.id) {
        const conversationId = String(selectedConversation.id);
        const lastRequestedAt = historySyncRequestedAtRef.current.get(conversationId) || 0;
        if (Date.now() - lastRequestedAt >= 30000) {
          historySyncRequestedAtRef.current.set(conversationId, Date.now());
          setHistorySyncStatus("requesting");
          try {
            await apiService.syncConversationHistory(conversationId);
            setHistorySyncStatus("requested");
          } catch {
            setHistorySyncStatus("error");
          }
        }
      }
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
      import("@/core/services/leadAnalyzer"),
      import("@/core/services/leadIntelligenceStore"),
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
        const { analyzeConversation } = await import("@/core/services/conversationAnalyzer");
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
    // Always use refs for volatile state to avoid stale closures on rapid re-renders
    const replyingToSnapshot = replyingToStateRef.current;
    const draftTextSnapshot = messageInputStateRef.current;
    const textToSend = (overrideText ?? messageInputStateRef.current).trim();
    const currentAttachments = [...attachmentsStateRef.current];
    // Always read the latest conversation from ref — avoids stale closure after re-renders
    const currentConversation = selectedConversationRef.current;

    if (!textToSend && currentAttachments.length === 0) {
      console.log("[SEND] No text and no attachments. Aborting.");
      return;
    }

    if (!currentConversation?.id) {
      console.log("[SEND] No current conversation id. Aborting.");
      return;
    }

    if (!canUseBackend) {
      console.log("[SEND] canUseBackend is false. Aborting.");
      setError("Servidor reconectando... envio temporariamente indisponível.");
      showErrorToast("Servidor reconectando... aguarde um momento.");
      return;
    }

    // Lock before the first await so button + Enter (or rapid clicks) cannot
    // create concurrent API requests for the same composer action.
    if (sendingRef.current) {
      console.log("[SEND] Ignoring duplicate send while another send is active.");
      return;
    }
    sendingRef.current = true;
    setSending(true);

    setError(null);

    const startTime = Date.now();
    console.log(`[SEND] State updated to sending=true at ${startTime}`);

    const now = new Date().toISOString();
    const pendingTempIds = new Set<string>();
    let acceptedCount = 0;

    try {
      // Always read latest sessions directly from the Zustand store to avoid stale closure
      const storeSessions = useAppStore.getState().sessions as unknown as SessionInfo[];
      const safeSessions = Array.isArray(storeSessions) ? storeSessions : [];
      const latestSessions = safeSessions.length > 0 ? safeSessions : await refreshSessions();

      const conversationSession = currentConversation.sessionId
        ? latestSessions.find((session) => session.id === currentConversation.sessionId)
        : null;
      const resolvedActiveSession = currentConversation.sessionId
        ? conversationSession && isSessionActive(conversationSession) ? conversationSession : null
        : pickActiveSession(latestSessions, preferredSessionId);
      if (!resolvedActiveSession?.id) {
        const unavailableMessage = "Nenhuma sessão do WhatsApp está conectada. Reconecte uma sessão e tente novamente.";
        if (useAppStore.getState().activeConversationId === currentConversation.id) setError(unavailableMessage);
        showErrorToast(unavailableMessage);
        return;
      }

      const sessionIdToSend = resolvedActiveSession.id;

      // Only clear the composer after a connected session has been resolved.
      // Preserve edits and the next conversation's composer made during the await.
      const isOriginSelected = useAppStore.getState().activeConversationId === currentConversation.id;
      const currentDraft = isOriginSelected
        ? { draftMessage: messageInputStateRef.current, draftMedia: attachmentsStateRef.current, draftReply: replyingToStateRef.current }
        : composerDraftsRef.current.get(currentConversation.id);
      const retainedText = currentDraft?.draftMessage === draftTextSnapshot ? "" : currentDraft?.draftMessage ?? "";
      const retainedMedia = (currentDraft?.draftMedia ?? []).filter(attachment => !currentAttachments.some(sent => sent.id === attachment.id));
      const retainedReply = currentDraft?.draftReply?.id === replyingToSnapshot?.id ? null : currentDraft?.draftReply ?? null;
      persistDraftSnapshot(currentConversation.id, { draftMessage: retainedText, draftMedia: retainedMedia, draftReply: retainedReply, draftMentions: [] });
      saveDraftToStorage(currentConversation.id, retainedText);
      if (isOriginSelected) {
        messageInputStateRef.current = retainedText;
        attachmentsStateRef.current = retainedMedia;
        replyingToStateRef.current = retainedReply;
        setMessageInput(retainedText);
        setAttachments(retainedMedia);
        setReplyingTo(retainedReply);
      }

      setPreferredSessionId(sessionIdToSend);
      localStorage.setItem("zapai_inbox_active_session", sessionIdToSend);

      // Clear typing status immediately upon sending a message
      const storeState = useAppStore.getState();
      storeState.updateTypingStatus(currentConversation.id, false);
      if (currentConversation.chatId) {
        storeState.updateTypingStatus(currentConversation.chatId, false);
      }
      if (currentConversation.phone) {
        storeState.updateTypingStatus(currentConversation.phone, false);
      }

      const optimisticMessages: ChatMessage[] = currentAttachments.length
        ? currentAttachments.map((attachment, index) => {
            const tempId = `temp-media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${index}`;
            pendingTempIds.add(tempId);
            return {
              id: tempId,
              conversationId: currentConversation.id,
              content: attachment.caption || (index === 0 ? textToSend : ""),
              fromMe: true,
              createdAt: now,
              status: "sending",
              mediaType: attachment.mediaType,
              url: attachment.previewUrl,
            };
          })
        : [
            (() => {
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              pendingTempIds.add(tempId);
              return {
                id: tempId,
                conversationId: currentConversation.id,
                content: textToSend,
                fromMe: true,
                createdAt: now,
                status: "sending" as const,
              };
            })(),
          ];

      setMessagesForConversation(currentConversation.id, (prev) => {
        const next = sortMessagesAsc([...prev, ...optimisticMessages]);
        updateConversationMessageStore(
          currentConversation.id,
          next,
          messageCacheRef.current.get(currentConversation.id)?.hasMore ?? hasMoreMessages,
        );
        return next;
      });

      const pendingQueue = pendingOutgoingTempIdsRef.current.get(currentConversation.id) ?? [];
      pendingOutgoingTempIdsRef.current.set(
        currentConversation.id,
        [...pendingQueue, ...optimisticMessages.map((item) => item.id)],
      );

      const optimisticLast = optimisticMessages[optimisticMessages.length - 1];
      setConversations((prev) => {
        const current = prev.find((item) => item.id === currentConversation.id);
        if (!current) return prev;

        const updated: Conversation = {
          ...current,
          lastMessage: optimisticLast?.content || textToSend || (currentAttachments[0]?.mediaType ? getMediaTypeLabel(currentAttachments[0].mediaType) : current.lastMessage || ""),
          lastMessageType: optimisticLast?.mediaType === "document" || optimisticLast?.mediaType === "media" ? "file" : optimisticLast?.mediaType ?? currentAttachments[0]?.mediaType ?? "text",
          updatedAt: optimisticLast?.createdAt ?? now,
        };

        return [updated, ...prev.filter((item) => item.id !== currentConversation.id)];
      });

      console.log("[SEND] Sending loop starting...");
      for (let i = 0; i < optimisticMessages.length; i += 1) {
        console.log(`[SEND] Processing message ${i + 1}/${optimisticMessages.length}`);
        const optimistic = optimisticMessages[i];
        const attachment = currentAttachments[i];

        if (attachment && attachment.file.size > getUploadLimitBytes(attachment.mediaType)) {
          throw new Error(`O arquivo ${attachment.file.name} excede o limite de ${formatFileSize(getUploadLimitBytes(attachment.mediaType))} para ${getMediaTypeLabel(attachment.mediaType)}.`);
        }

        const base64Payload = attachment ? await fileToBase64(attachment.file) : null;
        if (attachment && base64Payload && estimateBase64Bytes(base64Payload) > getUploadLimitBytes(attachment.mediaType)) {
          throw new Error(`A mídia ${attachment.file.name} ultrapassou o limite de ${formatFileSize(getUploadLimitBytes(attachment.mediaType))} após processamento.`);
        }

        console.log(`[SEND] Calling API for message ${i + 1}...`);
        // A timeout may hide an accepted enqueue. Retrying the same draft uses
        // the same request ID so the server can return that result once.
        const retryKey = JSON.stringify([currentConversation.id, attachment?.id ?? "text", optimistic.content]);
        const requestId = retrySendRequestIdsRef.current.get(retryKey) ?? `inbox-${generateUuid()}`;
        retrySendRequestIdsRef.current.set(retryKey, requestId);
        const response: MessageSendResponse = attachment
          ? await apiService.sendMediaMessage({
              phone: currentConversation.phone,
              chatId: currentConversation.chatId,
              caption: attachment.caption || (i === 0 ? textToSend : ""),
              fileName: attachment.file.name,
              mimeType: attachment.file.type || "application/octet-stream",
              mediaType: attachment.mediaType,
              dataBase64: base64Payload ?? "",
              conversationId: currentConversation.id,
              contactId: currentConversation.contactId,
              sessionId: sessionIdToSend,
              requestId,
            })
          : await apiService.sendMessage({
              phone: currentConversation.phone,
              chatId: currentConversation.chatId,
              text: textToSend,
              conversationId: currentConversation.id,
              contactId: currentConversation.contactId,
              sessionId: sessionIdToSend,
              requestId,
            });

        if (!response.success) {
          throw new Error(String(response.error ?? "Falha ao enviar mensagem"));
        }
        acceptedCount += 1;
        retrySendRequestIdsRef.current.delete(retryKey);
        const confirmedControl = response.conversationControl as { aiEnabled?: boolean; aiReactivateAt?: string | null } | undefined;
        if (confirmedControl?.aiEnabled != null) {
          setConversationControls(prev => ({ ...prev, [currentConversation.id]: { ...prev[currentConversation.id], conversation_id: currentConversation.id, conversationId: currentConversation.id, ai_enabled: confirmedControl.aiEnabled!, aiEnabled: confirmedControl.aiEnabled!, aiReactivateAt: confirmedControl.aiReactivateAt ?? null, ai_reactivate_at: confirmedControl.aiReactivateAt ?? null } }));
          setConversations(prev => prev.map(conversation => conversation.id === currentConversation.id ? { ...conversation, aiEnabled: confirmedControl.aiEnabled, ai_enabled: confirmedControl.aiEnabled, aiReactivateAt: confirmedControl.aiReactivateAt ?? null, ai_reactivate_at: confirmedControl.aiReactivateAt ?? null } : conversation));
        }

        const returnedMsg = response.message;
        const realId = returnedMsg?.id || returnedMsg?.key?.id;
        const realStatus = (returnedMsg?.status ?? "pending") as ChatMessage["status"];
        const returnedUrl =
          returnedMsg?.url ??
          returnedMsg?.mediaUrl ??
          (returnedMsg as any)?.fileUrl ??
          (returnedMsg as any)?.file_url ??
          optimistic.url ??
          optimistic.mediaUrl;
        const returnedMediaType = returnedMsg?.mediaType ?? attachment?.mediaType ?? optimistic.mediaType;

        setMessagesForConversation(currentConversation.id, (prev) => {
          if (realId && prev.some((m) => String(m.id) === String(realId))) {
            const next = prev.filter((m) => m.id !== optimistic.id);
            updateConversationMessageStore(
              currentConversation.id,
              next,
              messageCacheRef.current.get(currentConversation.id)?.hasMore ?? hasMoreMessages,
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
            currentConversation.id,
            next,
            messageCacheRef.current.get(currentConversation.id)?.hasMore ?? hasMoreMessages,
          );
          console.log(`[SEND] Message ${i + 1} UI update complete.`);
          return next;
        });

        pendingTempIds.delete(optimistic.id);
        removePendingTempIdsForConversation(currentConversation.id, [optimistic.id]);
        clearPendingFallbackTimersForTempId(optimistic.id);
      }

      console.log(`[SEND] All messages processed successfully in ${Date.now() - startTime}ms`);

      pendingTempIds.forEach((tempId) => {
        const fallbackTimerKey = `fallback-${tempId}-500`;
        const fallbackTimerId = window.setTimeout(() => {
          console.log(`[SEND] Fallback timer fired for tempId ${tempId}`);
          pendingSendFallbackTimersRef.current.delete(fallbackTimerKey);
          const conversationId = currentConversation.id;

          const pendingQueue = pendingOutgoingTempIdsRef.current.get(String(conversationId)) ?? [];
          const isPending = pendingQueue.includes(tempId);
          const tempStillVisible = (useAppStore.getState().messagesByConversationId[conversationId] ?? []).some((message) => message.id === tempId);
          if (!isPending && !tempStillVisible) return;

          void loadConversationMessages(String(conversationId), { force: true });
        }, 500);
        pendingSendFallbackTimersRef.current.set(fallbackTimerKey, fallbackTimerId);
      });

      revokeAttachmentPreviewUrls(currentAttachments);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      if (useAppStore.getState().activeConversationId === currentConversation.id) setError(message);
      showErrorToast(message);

      const failedConversation = currentConversation;
      const errMsg = message.toLowerCase();
      const isBlockedError = errMsg.includes("blocked") || errMsg.includes("forbidden") || errMsg.includes("recipient unavailable");
      if (isBlockedError && failedConversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === failedConversation.id ? { ...c, isBlocked: true } : c))
        );
      }

      if (pendingTempIds.size > 0 && failedConversation) {
        const currentPending = pendingOutgoingTempIdsRef.current.get(failedConversation.id) ?? [];
        pendingOutgoingTempIdsRef.current.set(
          failedConversation.id,
          currentPending.filter((id) => !pendingTempIds.has(id)),
        );
        pendingTempIds.forEach((tempId) => {
          clearPendingFallbackTimersForTempId(tempId);
        });
        setMessagesForConversation(failedConversation.id, (prev) => {
          const next = prev.map((item) => (pendingTempIds.has(item.id) ? { ...item, status: "failed" as const } : item));
          updateConversationMessageStore(
            failedConversation.id,
            next,
            messageCacheRef.current.get(failedConversation.id)?.hasMore ?? hasMoreMessages,
          );
          return next;
        });
      }

      // Restore only content that did not reach the queue, scoped to its origin.
      const unsentAttachments = currentAttachments.slice(acceptedCount);
      const existingDraft = useAppStore.getState().activeConversationId === currentConversation.id
        ? { draftMessage: messageInputStateRef.current, draftMedia: attachmentsStateRef.current, draftReply: replyingToStateRef.current }
        : composerDraftsRef.current.get(currentConversation.id);
      const restoredText = existingDraft?.draftMessage || (acceptedCount === 0 ? draftTextSnapshot || textToSend : "");
      const restoredMedia = [...(existingDraft?.draftMedia ?? []), ...unsentAttachments.filter(attachment => !existingDraft?.draftMedia?.some(existing => existing.id === attachment.id))];
      const restoredReply = existingDraft?.draftReply ?? (acceptedCount === 0 ? replyingToSnapshot : null);
      persistDraftSnapshot(currentConversation.id, { draftMessage: restoredText, draftMedia: restoredMedia, draftReply: restoredReply });
      saveDraftToStorage(currentConversation.id, restoredText);
      if (useAppStore.getState().activeConversationId === currentConversation.id) {
        messageInputStateRef.current = restoredText;
        attachmentsStateRef.current = restoredMedia;
        setMessageInput(restoredText);
        setAttachments(restoredMedia);
        setReplyingTo(restoredReply);
      }
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  // Stable dep array: volatile state (messageInput, attachments, sessions, selectedConversation,
  // sending) is intentionally read from refs inside the function body to prevent stale closures
  // and the freeze-after-first-message bug.
  }, [canUseBackend, clearPendingFallbackTimersForTempId, hasMoreMessages, loadConversationMessages, persistDraftSnapshot, preferredSessionId, refreshSessions, removePendingTempIdsForConversation, replyingTo, selectedConversation, showErrorToast, updateConversationMessageStore, setMessagesForConversation, setConversations]);

  const handleSetConversationAiEnabledById = useCallback(async (conversationId: string, enabled: boolean, reactivateAt?: string | null) => {
    const targetConversation = conversationsRef.current.find((conversation) => conversation.id === conversationId);
    if (!targetConversation || updatingAiToggle) return;

    setUpdatingAiToggle(true);

    try {
      const updated = await upsertConversationControl({
        conversationId: targetConversation.id,
        aiEnabled: enabled,
        aiReactivateAt: reactivateAt !== undefined ? reactivateAt : null,
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
            ? {
                ...conversation,
                aiEnabled: persistedEnabled,
                ai_enabled: persistedEnabled,
                ai_reactivate_at: reactivateAt,
                aiReactivateAt: reactivateAt,
                aiPausedUntil: reactivateAt,
              }
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
        aiEnabled: conversationControls[selectedConversation.id]?.aiEnabled ?? selectedConversation.aiEnabled ?? true,
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
                  assigned_to: agentName,
                }
              : conversation,
          ),
        );
        toast({ title: agentName ? `Atendente alterado para ${agentName}.` : "Agente padrão da conexão selecionado." });
      } else {
        throw new Error("O servidor não confirmou a alteração do agente.");
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

    void downloadMediaFile(mediaUrl, getMediaFileName(message)).catch(() => {
      toast({ title: "Arquivo indisponível", description: "Atualize a conversa e tente novamente.", variant: "destructive" });
    });
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
    const targetConversation = selectedConversationRef.current;
    if (!targetConversation || suggestingResponseRef.current || !aiRuntime.providerReady) return;

    const lastCustomerMessage = [...messages].reverse().find((message) => !message.fromMe)?.content;
    if (!lastCustomerMessage) return;

    const contextVersion = suggestionContextRef.current;
    const draftSnapshot = messageInputStateRef.current;
    suggestingResponseRef.current = true;
    setSuggestingResponse(true);

    try {
      const { generateResponse } = await import("@/core/services/responseEngine");
      const optimized = await generateResponse(targetConversation.id, {});

      if (!optimized) throw new Error("A IA nao retornou uma sugestao.");
      if (suggestionContextRef.current !== contextVersion || useAppStore.getState().activeConversationId !== targetConversation.id) return;
      if (messageInputStateRef.current !== draftSnapshot) {
        toast({ title: "Sugestão descartada", description: "Você editou o rascunho enquanto a IA preparava a resposta. Seu texto foi preservado." });
        return;
      }
      setMessageInput(optimized);
      toast({ title: "Sugestão pronta para envio." });
    } catch (err) {
      if (suggestionContextRef.current !== contextVersion || useAppStore.getState().activeConversationId !== targetConversation.id) return;
      const message = err instanceof Error && err.message ? err.message : "AI response unavailable.";
      showErrorToast(message);
    } finally {
      suggestingResponseRef.current = false;
      setSuggestingResponse(false);
    }
  }, [aiRuntime.providerReady, messages, toast, showErrorToast]);

  const handleSetConversationAiEnabled = useCallback(async (enabled: boolean, reactivateAt?: string | null) => {
    if (!selectedConversation) return;
    await handleSetConversationAiEnabledById(selectedConversation.id, enabled, reactivateAt);
  }, [handleSetConversationAiEnabledById, selectedConversation]);

  const handleArchiveSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    const chatId = String(selectedConversation.id);
    setArchivedChatIds((prev) => (prev.includes(chatId) ? prev : [...prev, chatId]));
    setConversations((prev) =>
      prev.map((c) => (String(c.id) === chatId ? { ...c, status: "archived" } : c))
    );
    socketActions.emitArchiveChat(chatId);
    toast({ title: "Conversa arquivada." });
  }, [selectedConversation, socketActions, toast, setConversations]);

  const handleUnarchiveSelectedConversation = useCallback(() => {
    if (!selectedConversation) return;
    const chatId = String(selectedConversation.id);
    setArchivedChatIds((prev) => prev.filter((id) => id !== chatId));
    setConversations((prev) =>
      prev.map((c) => (String(c.id) === chatId ? { ...c, status: "open" } : c))
    );
    socketActions.emitUnarchiveChat(chatId);
    toast({ title: "Conversa desarquivada." });
  }, [selectedConversation, socketActions, toast, setConversations]);

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
      return true;
    } catch (error) {
      console.error("Falha ao persistir dados da conversa", error);
      notify.error("Não foi possível salvar os dados da conversa.");
      return false;
    }
  }, []);

  const handleSaveLeadNotes = useCallback(async () => {
    if (!selectedConversation) return;
    const normalizedNotes = leadNotes.trim();
    if (!await persistConversationMetadata(selectedConversation.id, { notes: normalizedNotes })) return;
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id ? { ...conversation, notes: normalizedNotes } : conversation,
      ),
    );
    toast({ title: "Observações salvas." });
  }, [leadNotes, persistConversationMetadata, selectedConversation, setConversations, toast]);

  const handleAddTagToSelectedConversation = useCallback(async () => {
    if (!selectedConversation) return;
    const normalizedTag = newTagInput.trim();
    if (!normalizedTag) return;

    const nextTags = Array.from(new Set([...(selectedConversation.tags ?? []), normalizedTag]));
    if (!await persistConversationMetadata(selectedConversation.id, { tags: nextTags })) return;
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, tags: nextTags }
          : conversation,
      ),
    );

    if (useAppStore.getState().activeConversationId === selectedConversation.id) setNewTagInput("");
  }, [newTagInput, selectedConversation, socketActions, persistConversationMetadata, setConversations]);

  const handleRemoveTagFromSelectedConversation = useCallback(async (tag: string) => {
    if (!selectedConversation) return;
    const nextTags = (selectedConversation.tags ?? []).filter((currentTag) => currentTag !== tag);
    if (!await persistConversationMetadata(selectedConversation.id, { tags: nextTags })) return;

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === selectedConversation.id
          ? { ...conversation, tags: nextTags }
          : conversation,
      ),
    );

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
    const conv = conversationsRef.current.find((c) => String(c.id) === String(conversationId));
    const isCurrentlyArchived = archivedChatIds.includes(conversationId) || String(conv?.status).toLowerCase() === "archived";

    if (isCurrentlyArchived) {
      setArchivedChatIds((current) => current.filter((id) => id !== conversationId));
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(conversationId) ? { ...c, status: "open" } : c))
      );
      socketActions.emitUnarchiveChat(conversationId);
      toast({ title: "Conversa desarquivada." });
    } else {
      setArchivedChatIds((current) => (current.includes(conversationId) ? current : [...current, conversationId]));
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(conversationId) ? { ...c, status: "archived" } : c))
      );
      socketActions.emitArchiveChat(conversationId);
      toast({ title: "Conversa arquivada." });
    }
  }, [socketActions, archivedChatIds, setConversations, toast]);

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
    const allArchived = selectedChatIds.every((id) => {
      const conv = conversationsRef.current.find((c) => String(c.id) === String(id));
      return archivedChatIds.includes(id) || String(conv?.status).toLowerCase() === "archived";
    });
    if (allArchived) {
      setArchivedChatIds((prev) => prev.filter((id) => !selectedChatIds.includes(id)));
      setConversations((prev) =>
        prev.map((c) => (selectedChatIds.includes(String(c.id)) ? { ...c, status: "open" } : c))
      );
      selectedChatIds.forEach((id) => socketActions.emitUnarchiveChat(id));
      toast({ title: "Conversas desarquivadas." });
    } else {
      setArchivedChatIds((prev) => Array.from(new Set([...prev, ...selectedChatIds])));
      setConversations((prev) =>
        prev.map((c) => (selectedChatIds.includes(String(c.id)) ? { ...c, status: "archived" } : c))
      );
      selectedChatIds.forEach((id) => socketActions.emitArchiveChat(id));
      toast({ title: "Conversas arquivadas." });
    }
    setSelectedChatIds([]);
    setIsMultiSelectMode(false);
  }, [selectedChatIds, archivedChatIds, socketActions, toast, setConversations]);

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
  const loadQuickReplyCategoryAppearance = useCallback(async () => {
    try {
      const appearance = await apiService.getQuickReplyCategories();
      setQuickReplyCategoryAppearance(appearance && typeof appearance === "object" ? appearance : {});
      setQuickReplyCategoryAppearanceError(false);
    } catch (error) {
      setQuickReplyCategoryAppearanceError(true);
      throw error;
    }
  }, []);

  useEffect(() => {
    const loadQuickReplies = async () => {
      setQuickRepliesLoading(true);
      setQuickRepliesError(false);
      try {
        const [listResult, categoryAppearanceResult] = await Promise.allSettled([
          apiService.getQuickReplies(),
          loadQuickReplyCategoryAppearance(),
        ]);
        if (categoryAppearanceResult.status === "rejected") {
          console.error("Failed to load quick reply category appearance:", categoryAppearanceResult.reason);
        }
        if (listResult.status === "fulfilled" && Array.isArray(listResult.value)) {
          const mapped = listResult.value.map((qr: any) => ({
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
        } else if (listResult.status === "rejected") throw listResult.reason;
      } catch (err) {
        setQuickRepliesError(true);
        console.error("Failed to load quick replies:", err);
      } finally {
        setQuickRepliesLoading(false);
      }
    };
    void loadQuickReplies();
  }, [loadQuickReplyCategoryAppearance]);

  const saveQuickReplyCategoryAppearance = async (category: string, appearance: { emoji: string; color: string }) => {
    const saved = await apiService.saveQuickReplyCategory(category, appearance);
    setQuickReplyCategoryAppearance(saved);
    setQuickReplyCategoryAppearanceError(false);
    notify.success("Categoria atualizada.");
  };

  const conversationVariableContext = useMemo(
    () => ({
      contactName: selectedConversation?.contactName || "",
      phone: selectedConversation?.phone || "",
      company: typeof aiMemory?.company === "string" ? aiMemory.company : "",
    }),
    [aiMemory?.company, selectedConversation?.contactName, selectedConversation?.phone],
  );

  const sendQuickReply = useCallback(async (arg: string | QuickReplyItem, overrideDelayMs?: number, customSteps?: any[]) => {
    const targetConversation = selectedConversationRef.current;
    if (!targetConversation) throw new Error("Selecione uma conversa antes de enviar.");
    if (sendingQuickReplyRef.current || sendingRef.current) throw new Error("Aguarde o envio atual.");

    if (typeof arg === "string") {
      setMessageInput(interpolateTemplateVariables(arg, conversationVariableContext));
      return;
    }

    sendingQuickReplyRef.current = true;
    sendingRef.current = true;
    setSending(true);
    try {
      if (!arg.id) throw new Error("Salve a resposta rápida antes de enviar.");
      const retryKey = JSON.stringify([targetConversation.id, arg.id, overrideDelayMs, customSteps?.length]);
      const currentSendId = retryQuickReplyIdsRef.current.get(retryKey) ?? generateUuid();
      retryQuickReplyIdsRef.current.set(retryKey, currentSendId);
      const response = await apiService.executeQuickReplyFlow(arg.id, {
        phone: targetConversation.phone,
        conversationId: targetConversation.id,
        sessionId: targetConversation.sessionId || preferredSessionId || undefined,
        overrideDelayMs,
        sendId: currentSendId,
        steps: customSteps,
      });
      if (!response?.success) throw new Error("O servidor não confirmou o envio da resposta rápida.");
      retryQuickReplyIdsRef.current.delete(retryKey);
      notify.success(`Resposta rápida na fila para ${targetConversation.contactName}.`);
    } finally {
      setSending(false);
      sendingRef.current = false;
      sendingQuickReplyRef.current = false;
    }
  }, [preferredSessionId, conversationVariableContext]);

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
        isFlow: item.isFlow,
        steps: item.steps,
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
          isFlow: created.isFlow,
          steps: created.steps,
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
    loadingConversations: loadingConversations || conversationSearch.loading,
    loadingMessages,
    loadingOlderMessages,
    historySyncStatus,
    conversationsLoadFailed: conversationsLoadFailed || conversationSearch.failed,
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
    quickReplies, setQuickReplies, quickReplyCategoryAppearance, quickReplyCategoryAppearanceError, loadQuickReplyCategoryAppearance, saveQuickReplyCategoryAppearance,
    quickRepliesLoading, quickRepliesError,
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
