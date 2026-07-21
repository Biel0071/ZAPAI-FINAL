/**
 * RuntimeProvider — Central WebSocket hydration layer.
 *
 * Architecture:
 * - ONE shared Socket.IO connection (managed by socketService.ts)
 * - ONE subscriber registered via connectInboxSocket()
 * - ALL session/QR/conversation events route through Zustand store
 * - Pages read from useAppStore() — no per-page polling or duplicate sockets
 *
 * Data flow:
 *   Backend WS event → socketService → RuntimeProvider subscriber → Zustand store → UI
 *
 * What this provider owns:
 * - WebSocket lifecycle (connect/disconnect/reconnect awareness)
 * - Initial API hydration (sessions, conversations, metrics)
 * - Re-hydration on reconnect
 * - Realtime subscriptions for WhatsApp sessions and QR codes
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { connectInboxSocket, forceReconnectInboxSocket } from "@/runtime/socket/socketManager";
import { apiService, type ChatMessage, type Conversation } from "@/services/apiService";
import { useAppStore, isPhoneMatch } from "@/stores/appStore";
import { API_ORIGIN } from "@/lib/backendConfig";
import { normalizeSession, getSessionId } from "@/services/normalizeSession";
import {
  buildRuntimeCoherenceSnapshot,
  persistRuntimeCoherenceSnapshot,
} from "@/runtime/services/runtimeCoherenceService";
import { parseChatsLoadedPayload, parseContactsLoadedPayload } from "@/runtime/utils/inboxNormalization";
import type { SessionItem } from "@/stores/appStore";

type RuntimeStatus = "online" | "reconnecting" | "offline";
const RUNTIME_DEBUG_LOGS = import.meta.env.DEV;

function runtimeInfo(...args: Parameters<typeof console.info>) {
  if (RUNTIME_DEBUG_LOGS) console.info(...args);
}

function runtimeWarn(...args: Parameters<typeof console.warn>) {
  if (RUNTIME_DEBUG_LOGS) console.warn(...args);
}

type RuntimeContextValue = {
  status: RuntimeStatus;
  connectedSessions: number;
  hydrated: boolean;
  forceRefresh: () => Promise<void>;
  forceReconnect: () => void;
};

const RuntimeContext = createContext<RuntimeContextValue>({
  status: "offline",
  connectedSessions: 0,
  hydrated: false,
  forceRefresh: async () => {},
  forceReconnect: () => {},
});

function isConnectedSession(session: SessionItem): boolean {
  return session.status === "connected";
}

function getPreferredConversationSessionId(sessions: SessionItem[]): string | undefined {
  return sessions.find(isConnectedSession)?.id || sessions[0]?.id || undefined;
}

function normalizeRuntimeIdentityPart(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isSessionMatch(convSessionId?: string, incomingSessionId?: string): boolean {
  if (!incomingSessionId) return true;
  const cSess = String(convSessionId || "main").trim().toLowerCase();
  const iSess = String(incomingSessionId || "main").trim().toLowerCase();
  return cSess === iSess;
}

function resolveConversationIdForRealtimeMessage(
  incoming: Partial<ChatMessage> & {
    contactId?: string;
    phone?: string;
    remoteJid?: string;
    sessionId?: string;
  },
  conversations: Conversation[],
): string | null {
  console.log(`[INBOX REALTIME] [REALTIME_MESSAGE] Resolving conversation for message: id=${incoming.id} phone=${incoming.phone} chatId=${incoming.chatId} conversationId=${incoming.conversationId} sessionId=${incoming.sessionId}`);

  const incomingId = incoming.conversationId || incoming.chatId;
  const incomingPhone = incoming.phone || incoming.chatId || incoming.remoteJid;

  // Check active conversation first to avoid mismatches
  const activeId = useAppStore.getState().activeConversationId;
  console.log(`[INBOX REALTIME] [ACTIVE_CONVERSATION] Current active conversation: ${activeId}`);
  if (activeId) {
    const activeConv = conversations.find((c) => String(c.id) === String(activeId));
    if (activeConv) {
      const isIdMatch = incomingId && (String(activeConv.id) === String(incomingId) || String(activeConv.chatId) === String(incomingId));
      const isPhoneMatched = incomingPhone && (isPhoneMatch(activeConv.phone, incomingPhone) || isPhoneMatch(activeConv.chatId, incomingPhone));
      const sessMatch = isSessionMatch(activeConv.sessionId, incoming.sessionId);

      if ((isIdMatch || isPhoneMatched) && sessMatch) {
        console.log(`[INBOX REALTIME] [SESSION MATCH] [CONVERSATION RESOLVED] Matched incoming message to active conversation: activeId=${activeId}`);
        return activeId;
      }
    }
  }

  // 1. Direct ID match
  if (incomingId) {
    const directMatch = conversations.find((c) =>
      (String(c.id) === String(incomingId) || String(c.chatId) === String(incomingId)) &&
      isSessionMatch(c.sessionId, incoming.sessionId)
    );
    if (directMatch) {
      console.log(`[INBOX REALTIME] [SESSION MATCH] [CONVERSATION RESOLVED] Direct match found: ${directMatch.id}`);
      return directMatch.id;
    }
  }

  // 2. Phone match
  if (incomingPhone) {
    const phoneMatch = conversations.find((c) =>
      (isPhoneMatch(c.phone, incomingPhone) || isPhoneMatch(c.chatId, incomingPhone)) &&
      isSessionMatch(c.sessionId, incoming.sessionId)
    );
    if (phoneMatch) {
      console.log(`[INBOX REALTIME] [SESSION MATCH] [CONVERSATION RESOLVED] Phone match found: ${phoneMatch.id}`);
      return phoneMatch.id;
    }
  }

  // 3. Contact ID match
  const incomingContactId = normalizeRuntimeIdentityPart(incoming.contactId);
  if (incomingContactId) {
    const contactMatch = conversations.find((c) =>
      normalizeRuntimeIdentityPart(c.contactId) === incomingContactId &&
      isSessionMatch(c.sessionId, incoming.sessionId)
    );
    if (contactMatch) {
      console.log(`[INBOX REALTIME] [SESSION MATCH] [CONVERSATION RESOLVED] Contact ID match found: ${contactMatch.id}`);
      return contactMatch.id;
    }
  }

  const fallback = incoming.conversationId || incoming.chatId || null;
  console.log(`[INBOX REALTIME] [CONVERSATION RESOLVED] No database match found. Fallback: ${fallback}`);
  return fallback;
}

export function useRuntime() {
  return useContext(RuntimeContext);
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  // Resolve socket URL once
  const socketUrl = API_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");

  const [status, setStatus] = useState<RuntimeStatus>("offline");
  const [hydrated, setHydrated] = useState(false);

  // Refs for values used inside socket callbacks — prevents effect re-runs
  const disconnectedAtRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const statusRef = useRef<RuntimeStatus>("offline");
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryAttemptedRef = useRef(false);
  const typingTimersRef = useRef<Map<string, any>>(new Map());
  const aiProgressTimersRef = useRef<Map<string, number>>(new Map());

  const clearTypingTimeout = useCallback((conversationId: string) => {
    const existingTimer = typingTimersRef.current.get(conversationId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      typingTimersRef.current.delete(conversationId);
    }
  }, []);

  const setTypingTimeout = useCallback((conversationId: string) => {
    clearTypingTimeout(conversationId);
    const timer = setTimeout(() => {
      useAppStore.getState().updateTypingStatus(conversationId, false);
      typingTimersRef.current.delete(conversationId);
    }, 10000); // 10s timeout
    typingTimersRef.current.set(conversationId, timer);
  }, [clearTypingTimeout]);

  // Keep refs in sync
  hydratedRef.current = hydrated;
  statusRef.current = status;

  const sessions = useAppStore((s) => s.sessions);

  const connectedSessions = Array.isArray(sessions)
    ? sessions.filter((s) => s && s.status === "connected").length
    : 0;

  // Full API refresh — called on mount and on reconnect
  const loadFromApi = useCallback(async (options?: { forceConversations?: boolean }) => {
    const t0 = performance.now();
    runtimeInfo("[Runtime] hydration:start");

    // Render the application immediately. Inbox-level caches/skeletons provide
    // useful content while the network refresh continues progressively.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      setHydrated(true);
    }

    try {
      if (!recoveryAttemptedRef.current) {
        recoveryAttemptedRef.current = true;
        void apiService.recoverSessions().catch((error) => {
          runtimeWarn("[Runtime] session:recover skipped", error instanceof Error ? error.message : error);
        });
      }

      const initialStore = useAppStore.getState();
      const knownSessions = Array.isArray(initialStore.sessions)
        ? initialStore.sessions.map(normalizeSession)
        : [];
      const activeSessionId = initialStore.activeSessionId;
      const conversationSessionId = getPreferredConversationSessionId(knownSessions) || activeSessionId || undefined;

      // These endpoints are independent. Running them together removes an
      // entire network round-trip from every initial load and reconnect.
      const [sessionsResult, conversationsResult, metricsResult] = await Promise.allSettled([
        apiService.listSessions(),
        apiService.getConversations(Boolean(options?.forceConversations), {
          limit: 30,
          sessionId: conversationSessionId,
        }),
        apiService.getMetrics(activeSessionId),
      ]);

      const normalizedSessions =
        sessionsResult.status === "fulfilled" && Array.isArray(sessionsResult.value)
          ? sessionsResult.value.map(normalizeSession)
          : [];

      runtimeInfo("[Runtime] hydration:raw", {
        sessions: sessionsResult.status === "fulfilled" ? sessionsResult.value : sessionsResult,
        conversations: conversationsResult.status === "fulfilled" ? `${Array.isArray(conversationsResult.value) ? conversationsResult.value.length : "NOT_ARRAY"} items` : conversationsResult,
        metrics: metricsResult.status === "fulfilled" ? metricsResult.value : metricsResult,
      });

      const store = useAppStore.getState();
      const sessionsOk = sessionsResult.status === "fulfilled" && Array.isArray(sessionsResult.value);
      const conversationsOk = conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value);
      const metricsOk = metricsResult.status === "fulfilled" && Boolean(metricsResult.value);

      if (sessionsOk) {
        store.setSessions(normalizedSessions);
        for (const session of normalizedSessions) {
          if (session.status === "connected") store.clearLastQr(session.id);
        }
      }
      if (conversationsOk) store.setConversations(conversationsResult.value);
      if (metricsOk) store.setMetrics(metricsResult.value);

      const apiHealthy = sessionsOk && conversationsOk && metricsOk;
      persistRuntimeCoherenceSnapshot(
        buildRuntimeCoherenceSnapshot({
          apiHealthy,
          mismatchReason: apiHealthy ? null : "Carregamento parcial do backend oficial detectado.",
          socketOrigin: socketUrl,
          websocketHealthy: statusRef.current === "online",
        }),
      );

      const elapsed = Math.round(performance.now() - t0);
      const sCount = sessionsOk ? normalizedSessions.length : 0;
      const cCount = conversationsOk ? conversationsResult.value.length : 0;
      runtimeInfo(`[Runtime] hydration:done sessions=${sCount} conversations=${cCount} elapsed=${elapsed}ms`);
    } catch (err) {
      runtimeWarn("[Runtime] hydration:error", err instanceof Error ? err.message : err);
      persistRuntimeCoherenceSnapshot(
        buildRuntimeCoherenceSnapshot({
          apiHealthy: false,
          mismatchReason: "Falha ao carregar dados do backend oficial.",
          socketOrigin: socketUrl,
          websocketHealthy: statusRef.current === "online",
        }),
      );
    } finally {
      hydratedRef.current = true;
      setHydrated(true);
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    await loadFromApi({ forceConversations: true });
  }, [loadFromApi]);

  const forceReconnect = useCallback(() => {
    forceReconnectInboxSocket();
  }, []);

  // Debounced refresh for reconnect — avoid flooding API after brief disconnection
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => void loadFromApi({ forceConversations: true }), 600);
  }, [loadFromApi]);

  // ─── Main effect: WebSocket subscription ─────────────────────
  useEffect(() => {
    if (!socketUrl) return;

    // Initial hydration
    void loadFromApi();

    const disconnect = connectInboxSocket({
      socketUrl,

      onSocketConnected: () => {
        runtimeInfo("[Runtime] socket:connected");
        setStatus("online");
        useAppStore.getState().updateRuntimeStatus("online");
        useAppStore.getState().updateWebsocketHealth("online");
        disconnectedAtRef.current = null;
        persistRuntimeCoherenceSnapshot(
          buildRuntimeCoherenceSnapshot({
            apiHealthy: true,
            mismatchReason: null,
            socketOrigin: socketUrl,
            websocketHealthy: true,
          }),
        );

        // Re-hydrate on reconnect (not on first connect — loadFromApi handles that)
        if (hydratedRef.current) {
          runtimeInfo("[Runtime] reconnect:rehydrating");
          debouncedRefresh();
        }
      },

      onSocketDisconnected: () => {
        const now = Date.now();
        if (!disconnectedAtRef.current) {
          disconnectedAtRef.current = now;
        }
        const elapsed = now - (disconnectedAtRef.current ?? now);
        const nextStatus = elapsed < 30_000 ? "reconnecting" : "offline";
        runtimeWarn(`[Runtime] socket:disconnected status=${nextStatus} elapsed=${elapsed}ms`);
        setStatus(nextStatus);
        useAppStore.getState().updateRuntimeStatus(nextStatus);
        useAppStore.getState().updateWebsocketHealth(
          nextStatus === "reconnecting" ? "reconnecting" : "offline"
        );

        persistRuntimeCoherenceSnapshot(
          buildRuntimeCoherenceSnapshot({
            apiHealthy: true,
            mismatchReason:
              nextStatus === "reconnecting"
                ? "Socket desconectado do runtime oficial; aguardando reconnect controlado."
                : "Socket offline em relação ao runtime oficial.",
            socketOrigin: socketUrl,
            websocketHealthy: false,
          }),
        );
      },

      // ─── Session events → Zustand store ──────────────────
      onQrGenerated: (payload) => {
        const sessionId = getSessionId(payload);
        const qr = payload?.qr ?? payload?.base64 ?? null;
        if (!sessionId || !qr) return;

        runtimeInfo(`[Runtime] qr:generated session=${sessionId}`);
        useAppStore.getState().setLastQr(sessionId, qr);
        useAppStore.getState().upsertSession(
          normalizeSession({ ...payload, id: sessionId, status: "qr" })
        );
      },

      onSessionConnected: (payload) => {
        const session = normalizeSession({ ...payload, status: "connected" });
        runtimeInfo(`[Runtime] session:connected id=${session.id} phone=${session.phone ?? "??"}`);
        useAppStore.getState().upsertSession(session);
        useAppStore.getState().clearLastQr(session.id);
      },

      onSessionDisconnected: (payload) => {
        const session = normalizeSession({ ...payload, status: "disconnected" });
        runtimeWarn(`[Runtime] session:disconnected id=${session.id}`);
        useAppStore.getState().upsertSession(session);
      },

      onSessionStatus: (payload) => {
        const session = normalizeSession(payload);
        runtimeInfo(`[Runtime] session:status id=${session.id} status=${session.status}`);
        useAppStore.getState().upsertSession(session);

        if (session.status === "connected") {
          useAppStore.getState().clearLastQr(session.id);
        }
      },

      onSessionDeleted: (payload) => {
        const sessionId = getSessionId(payload);
        if (!sessionId) return;
        runtimeWarn(`[Runtime] session:deleted id=${sessionId}`);
        useAppStore.getState().removeSession(sessionId);
      },

      // ─── Conversation events → Zustand store ────────────
      onConversationUpdated: (incoming) => {
        if (!incoming?.id) return;
        useAppStore.getState().upsertConversation(incoming);
      },

      onChatsLoaded: (payload) => {
        const loadedChats = parseChatsLoadedPayload(payload);
        if (!loadedChats.length) return;
        const store = useAppStore.getState();
        loadedChats.forEach((chat) => store.upsertConversation(chat));
      },

      onConversationSnapshot: (payload) => {
        const activeConversationId = useAppStore.getState().activeConversationId;
        if (!activeConversationId) return;

        const rawMessages = Array.isArray(payload)
          ? payload
          : payload && typeof payload === "object" && Array.isArray((payload as any).messages)
            ? (payload as any).messages
            : Array.isArray((payload as any).data)
              ? (payload as any).data
              : [];
        if (!rawMessages.length) return;

        const parsedMessages = rawMessages.map((item: any, index: number) => {
          const mediaUrl = item.mediaUrl || item.media_url || item.fileUrl || item.file_url || item.url;
          const mediaType = item.mediaType || item.type;
          return {
            id: String(item.id || `snapshot-${activeConversationId}-${index}`),
            conversationId: String(item.conversationId || item.chatId || activeConversationId),
            content: String(item.content || item.text || item.body || ""),
            fromMe: Boolean(item.fromMe || item.sent || false),
            createdAt: String(item.createdAt || item.created_at || item.timestamp || new Date().toISOString()),
            timestamp: String(item.timestamp || ""),
            status: item.status || "sent",
            isAI: Boolean(item.isAI || false),
            mediaType: mediaType,
            mediaUrl: mediaUrl,
            caption: item.caption,
          } as ChatMessage;
        }).filter((m: any) => m.conversationId === activeConversationId);

        if (parsedMessages.length) {
          const sampleMedia = parsedMessages.find((message) => message.mediaType && message.mediaType !== "text");
        runtimeInfo("[Runtime] conversation_snapshot", {
            conversationId: activeConversationId,
            count: parsedMessages.length,
            sampleMedia: sampleMedia
              ? {
                  id: sampleMedia.id,
                  mediaType: sampleMedia.mediaType,
                  mediaUrl: sampleMedia.mediaUrl ?? null,
                  content: sampleMedia.content ?? null,
                  caption: sampleMedia.caption ?? null,
                }
              : null,
          });
          useAppStore.getState().setMessages(activeConversationId, parsedMessages);
        }
      },

      onContactsLoaded: (payload) => {
        const contacts = parseContactsLoadedPayload(payload);
        if (!contacts.length) return;
        const store = useAppStore.getState();
        store.setConversations((prev) =>
          prev.map((c) => {
            const match = contacts.find((contact) => contact.phone === c.phone);
            if (match) {
              return { ...c, contactName: match.name };
            }
            return c;
          })
        );
      },

      onAiResponse: (incoming) => {
        if (!incoming?.id) return;
        const store = useAppStore.getState();
        console.log(`[INBOX REALTIME] [REALTIME_MESSAGE] AI Response event received: id=${incoming.id}`);
        const conversationId = resolveConversationIdForRealtimeMessage(incoming, store.conversations);
        if (!conversationId) return;

        // Clear typing and AI progress immediately when the generated message arrives.
        store.updateTypingStatus(conversationId, false);
        store.clearAIResponseProgress(conversationId);
        const progressTimer = aiProgressTimersRef.current.get(conversationId);
        if (progressTimer) window.clearTimeout(progressTimer);
        aiProgressTimersRef.current.delete(conversationId);
        clearTypingTimeout(conversationId);

        console.log(`[INBOX REALTIME] [STORE_TARGET] Setting store target for AI Response: conversationId=${conversationId}`);
        const currentConv = store.conversations.find((c) => String(c.id) === String(conversationId));
        const message = {
          ...incoming,
          conversationId,
          chatId: incoming.chatId || currentConv?.chatId || currentConv?.phone,
        } as ChatMessage;
        runtimeInfo(`[Runtime] ai_response id=${incoming.id} conversation=${conversationId}`);
        store.addMessage(conversationId, message);

        store.updateConversationRealtime({
          id: conversationId,
          lastMessage: incoming.content || "",
          updatedAt: incoming.createdAt || new Date().toISOString(),
          phone: incoming.phone || incoming.remoteJid || currentConv?.phone,
          chatId: incoming.chatId || incoming.remoteJid || currentConv?.chatId || currentConv?.phone,
          contactId: incoming.contactId || currentConv?.contactId,
          sessionId: incoming.sessionId || currentConv?.sessionId,
        });
      },

      onAiProgress: (payload) => {
        const store = useAppStore.getState();
        const conversationId = resolveConversationIdForRealtimeMessage(payload, store.conversations) || payload.conversationId;
        if (!conversationId) return;

        store.updateAIResponseProgress(conversationId, { ...payload, conversationId });
        const existingTimer = aiProgressTimersRef.current.get(conversationId);
        if (existingTimer) window.clearTimeout(existingTimer);

        if (["completed", "cancelled", "disabled", "failed", "no_agent"].includes(payload.status)) {
          const timer = window.setTimeout(() => {
            useAppStore.getState().clearAIResponseProgress(conversationId);
            aiProgressTimersRef.current.delete(conversationId);
          }, payload.status === "completed" ? 800 : 6500);
          aiProgressTimersRef.current.set(conversationId, timer);
        }
      },

      onChatArchived: ({ chatId, conversationId }) => {
        const resolvedId = chatId || conversationId;
        if (!resolvedId) return;
        useAppStore.getState().updateConversationRealtime({
          id: resolvedId,
          status: "archived" as any,
        });
      },

      onChatTagUpdated: ({ chatId, conversationId, tag, action }) => {
        const resolvedId = chatId || conversationId;
        if (!resolvedId || !tag) return;
        const store = useAppStore.getState();
        const conv = store.conversations.find((c) => String(c.id) === String(resolvedId));
        if (!conv) return;
        const currentTags = conv.tags || [];
        const nextTags = action === "remove"
          ? currentTags.filter((t) => t !== tag)
          : Array.from(new Set([...currentTags, tag]));
        store.updateConversationRealtime({
          id: resolvedId,
          tags: nextTags,
        });
      },

      // ─── Message events → Zustand store ─────────────────
      onNewMessage: (incoming) => {
        if (!incoming?.id) return;
        const store = useAppStore.getState();
        console.log(`[INBOX REALTIME] [REALTIME_MESSAGE] New message event received: id=${incoming.id}`);
        const conversationId = resolveConversationIdForRealtimeMessage(incoming, store.conversations);
        if (!conversationId) return;

        // Clear typing status immediately for UUID, phone and chatId
        store.updateTypingStatus(conversationId, false);
        clearTypingTimeout(conversationId);

        if (incoming.chatId) {
          store.updateTypingStatus(incoming.chatId, false);
          clearTypingTimeout(incoming.chatId);
          const cleanChatId = incoming.chatId.replace(/@s\.whatsapp\.net$/i, "");
          store.updateTypingStatus(cleanChatId, false);
          clearTypingTimeout(cleanChatId);
        }
        if (incoming.phone) {
          store.updateTypingStatus(incoming.phone, false);
          clearTypingTimeout(incoming.phone);
          const cleanPhone = incoming.phone.replace(/\D/g, "");
          store.updateTypingStatus(cleanPhone, false);
          clearTypingTimeout(cleanPhone);
        }

        console.log(`[INBOX REALTIME] [STORE_TARGET] Setting store target for New message: conversationId=${conversationId}`);
        const currentConv = store.conversations.find((c) => String(c.id) === String(conversationId));
        const message = {
          ...incoming,
          conversationId,
          chatId: incoming.chatId || currentConv?.chatId || currentConv?.phone,
        } as ChatMessage;

        runtimeInfo("[Runtime] new_message", {
          id: incoming.id,
          conversationId,
          status: incoming.status ?? null,
          fromMe: incoming.fromMe ?? null,
          mediaType: incoming.mediaType ?? incoming.messageType ?? null,
          mediaUrl: (incoming as ChatMessage & { fileUrl?: string; file_url?: string }).mediaUrl ?? (incoming as ChatMessage & { fileUrl?: string; file_url?: string }).url ?? (incoming as ChatMessage & { fileUrl?: string; file_url?: string }).fileUrl ?? (incoming as ChatMessage & { fileUrl?: string; file_url?: string }).file_url ?? null,
          content: incoming.content ?? null,
          caption: incoming.caption ?? null,
        });
        store.addMessage(conversationId, message);

        const isActive = store.activeConversationId === conversationId;

        store.updateConversationRealtime({
          id: conversationId,
          lastMessage: incoming.content || "",
          updatedAt: incoming.createdAt || new Date().toISOString(),
          unread: isActive ? 0 : (incoming.fromMe ? 0 : 1) + (currentConv?.unread ?? 0),
          phone: incoming.phone || incoming.remoteJid || currentConv?.phone,
          chatId: incoming.chatId || incoming.remoteJid || currentConv?.chatId || currentConv?.phone,
          contactId: incoming.contactId || currentConv?.contactId,
          sessionId: incoming.sessionId || currentConv?.sessionId,
        });
      },

      onMessageStatus: (payload) => {
        const { messageId, status } = payload;
        let conversationId = payload.conversationId;
        if (!messageId) return;

        // If conversationId is not provided, or looks like a phone number/JID, let's find the conversation UUID in the store
        if (!conversationId || conversationId.includes("@") || /^\+?\d+$/.test(conversationId)) {
          const target = conversationId || payload.chatId || payload.phone || "";
          const cleanTarget = target.replace(/@s\.whatsapp\.net$/i, "").replace(/\D/g, "");

          const state = useAppStore.getState();
          // Try to find by chatId or phone
          const found = state.conversations.find(
            (c) =>
              (c.chatId && c.chatId.replace(/@s\.whatsapp\.net$/i, "") === cleanTarget) ||
              (c.phone && c.phone.replace(/\D/g, "") === cleanTarget) ||
              String(c.id) === String(target)
          );
          if (found) {
            conversationId = found.id;
          } else {
            // Fallback: search messagesByConversationId for this messageId to see which conversation it belongs to
            const entries = Object.entries(state.messagesByConversationId);
            const foundEntry = entries.find(([_, messages]) => messages.some((m) => String(m.id) === String(messageId)));
            if (foundEntry) {
              conversationId = foundEntry[0];
            } else {
              // If still not found, check if target was passed, otherwise skip
              conversationId = target;
            }
          }
        }

        if (!conversationId) return;

        // Clear typing status immediately upon message status change
        const store = useAppStore.getState();
        store.updateTypingStatus(conversationId, false);
        clearTypingTimeout(conversationId);

        if (payload.chatId) {
          store.updateTypingStatus(payload.chatId, false);
          clearTypingTimeout(payload.chatId);
        }
        if (payload.phone) {
          store.updateTypingStatus(payload.phone, false);
          clearTypingTimeout(payload.phone);
        }

        runtimeInfo("[Runtime] message_status", {
          messageId,
          status,
          resolvedConversationId: conversationId,
        });
        store.updateMessageStatus(conversationId, messageId, status as ChatMessage["status"]);
      },

      onMessageDeleted: (payload) => {
        const { messageId, conversationId } = payload;
        if (!messageId || !conversationId) return;
        runtimeWarn(`[Runtime] message_deleted id=${messageId}`);
        useAppStore.getState().deleteMessage(conversationId, messageId);
      },

      onTypingStatus: (payload) => {
        const { conversationId, phone, isTyping } = payload;
        if (!conversationId) return;

        const store = useAppStore.getState();
        const resolvedId = resolveConversationIdForRealtimeMessage(
          { conversationId, phone, remoteJid: conversationId },
          store.conversations
        ) || conversationId;

        // Update for both resolved UUID and raw ID (for safety/backward compatibility)
        store.updateTypingStatus(resolvedId, isTyping);
        if (resolvedId !== conversationId) {
          store.updateTypingStatus(conversationId, isTyping);
        }

        if (isTyping) {
          setTypingTimeout(resolvedId);
          if (resolvedId !== conversationId) {
            setTypingTimeout(conversationId);
          }
        } else {
          clearTypingTimeout(resolvedId);
          if (resolvedId !== conversationId) {
            clearTypingTimeout(conversationId);
          }
        }
      },
      onMetricsUpdated: (metrics) => {
        if (!metrics) return;
        runtimeInfo("[Runtime] metrics_updated", metrics);
        useAppStore.getState().setMetrics(metrics);
      },
    });

    return () => {
      disconnect();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      typingTimersRef.current.forEach((timer) => clearTimeout(timer));
      typingTimersRef.current.clear();
      aiProgressTimersRef.current.forEach((timer) => clearTimeout(timer));
      aiProgressTimersRef.current.clear();
    };
  }, [socketUrl, loadFromApi, debouncedRefresh]);

  // ─── Re-hydrate on tab focus ─────────────────────────────────
  // When the user switches back to this tab after being away,
  // re-fetch sessions & conversations to stay current.
  useEffect(() => {
    let lastVisibleAt = Date.now();

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const elapsed = Date.now() - lastVisibleAt;
      lastVisibleAt = Date.now();

      // Only re-hydrate if tab was hidden for > 30 seconds
      if (elapsed > 30_000 && hydratedRef.current) {
        runtimeInfo(`[Runtime] tab:focused elapsed=${elapsed}ms rehydrating`);
        void loadFromApi({ forceConversations: true });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loadFromApi]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const contextValue = useMemo(() => ({
    status,
    connectedSessions,
    hydrated,
    forceRefresh,
    forceReconnect,
  }), [status, connectedSessions, hydrated, forceRefresh, forceReconnect]);

  const activeSessionId = useAppStore((state) => state.activeSessionId);

  useEffect(() => {
    if (!hydrated) return;
    const fetchMetrics = async () => {
      try {
        const metrics = await apiService.getMetrics(activeSessionId);
        useAppStore.getState().setMetrics(metrics);
      } catch (err) {
        console.error("[Runtime] Failed to fetch metrics for session:", activeSessionId, err);
      }
    };
    fetchMetrics();
  }, [activeSessionId, hydrated]);

  if (!mounted) {
    return null;
  }

  return (
    <RuntimeContext.Provider value={contextValue}>
      {hydrated ? (
        children
      ) : (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0C0F14] text-white">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366]/10 shadow-[0_0_20px_rgba(37,211,102,0.15)]">
              <span className="relative flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-75"></span>
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#25D366]"></span>
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 className="font-display text-sm font-bold tracking-wider text-[#94a3b8] uppercase">Zapflow AI</h2>
              <p className="text-xs text-[#94a3b8]/60">Inicializando runtime do sistema…</p>
            </div>
          </div>
        </div>
      )}
    </RuntimeContext.Provider>
  );
}
