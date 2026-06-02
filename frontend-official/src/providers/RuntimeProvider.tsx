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
import { apiService, type ChatMessage } from "@/services/apiService";
import { useAppStore } from "@/stores/appStore";
import { API_ORIGIN } from "@/lib/backendConfig";
import { normalizeSession, getSessionId } from "@/services/normalizeSession";
import {
  buildRuntimeCoherenceSnapshot,
  persistRuntimeCoherenceSnapshot,
} from "@/runtime/services/runtimeCoherenceService";
import { parseChatsLoadedPayload, parseContactsLoadedPayload } from "@/runtime/utils/inboxNormalization";

type RuntimeStatus = "online" | "reconnecting" | "offline";

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

  // Keep refs in sync
  hydratedRef.current = hydrated;
  statusRef.current = status;

  const sessions = useAppStore((s) => s.sessions);

  const connectedSessions = Array.isArray(sessions)
    ? sessions.filter((s) => s && s.status === "connected").length
    : 0;

  // Full API refresh — called on mount and on reconnect
  const loadFromApi = useCallback(async () => {
    const t0 = performance.now();
    console.info("[Runtime] hydration:start");
    try {
      const [sessionsResult, conversationsResult, metricsResult] = await Promise.allSettled([
        apiService.listSessions(),
        apiService.getConversations(false),
        apiService.getMetrics(),
      ]);

      console.info("[Runtime] hydration:raw", {
        sessions: sessionsResult.status === "fulfilled" ? sessionsResult.value : sessionsResult,
        conversations: conversationsResult.status === "fulfilled" ? `${Array.isArray(conversationsResult.value) ? conversationsResult.value.length : 'NOT_ARRAY'} items` : conversationsResult,
        metrics: metricsResult.status === "fulfilled" ? metricsResult.value : metricsResult,
      });

      const store = useAppStore.getState();
      const sessionsOk = sessionsResult.status === "fulfilled" && Array.isArray(sessionsResult.value);
      const conversationsOk = conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value);
      const metricsOk = metricsResult.status === "fulfilled" && Boolean(metricsResult.value);

      if (sessionsOk) {
        const normalized = sessionsResult.value.map(normalizeSession);
        store.setSessions(normalized);
        for (const session of normalized) {
          if (session.status === "connected") {
            store.clearLastQr(session.id);
          }
        }
      }
      if (conversationsOk) {
        store.setConversations(conversationsResult.value);
      }
      if (metricsOk) {
        store.setMetrics(metricsResult.value);
      }

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
      const sCount = sessionsResult.status === "fulfilled" && Array.isArray(sessionsResult.value) ? sessionsResult.value.length : 0;
      const cCount = conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value) ? conversationsResult.value.length : 0;
      console.info(`[Runtime] hydration:done sessions=${sCount} conversations=${cCount} elapsed=${elapsed}ms`);
    } catch (err) {
      console.warn("[Runtime] hydration:error", err instanceof Error ? err.message : err);
      persistRuntimeCoherenceSnapshot(
        buildRuntimeCoherenceSnapshot({
          apiHealthy: false,
          mismatchReason: "Falha ao carregar dados do backend oficial.",
          socketOrigin: socketUrl,
          websocketHealthy: statusRef.current === "online",
        }),
      );
    } finally {
      setHydrated(true);
    }
  }, []);

  const forceRefresh = useCallback(async () => {
    await loadFromApi();
  }, [loadFromApi]);

  const forceReconnect = useCallback(() => {
    forceReconnectInboxSocket();
  }, []);

  // Debounced refresh for reconnect — avoid flooding API after brief disconnection
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => void loadFromApi(), 3000);
  }, [loadFromApi]);

  // ─── Main effect: WebSocket subscription ─────────────────────
  useEffect(() => {
    if (!socketUrl) return;

    // Initial hydration
    void loadFromApi();

    const disconnect = connectInboxSocket({
      socketUrl,

      onSocketConnected: () => {
        console.info("[Runtime] socket:connected");
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
          console.info("[Runtime] reconnect:rehydrating");
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
        console.warn(`[Runtime] socket:disconnected status=${nextStatus} elapsed=${elapsed}ms`);
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

        console.info(`[Runtime] qr:generated session=${sessionId}`);
        useAppStore.getState().setLastQr(sessionId, qr);
        useAppStore.getState().upsertSession(
          normalizeSession({ ...payload, id: sessionId, status: "qr" })
        );
      },

      onSessionConnected: (payload) => {
        const session = normalizeSession({ ...payload, status: "connected" });
        console.info(`[Runtime] session:connected id=${session.id} phone=${session.phone ?? "??"}`);
        useAppStore.getState().upsertSession(session);
        useAppStore.getState().clearLastQr(session.id);
      },

      onSessionDisconnected: (payload) => {
        const session = normalizeSession({ ...payload, status: "disconnected" });
        console.warn(`[Runtime] session:disconnected id=${session.id}`);
        useAppStore.getState().upsertSession(session);
      },

      onSessionStatus: (payload) => {
        const session = normalizeSession(payload);
        console.info(`[Runtime] session:status id=${session.id} status=${session.status}`);
        useAppStore.getState().upsertSession(session);

        if (session.status === "connected") {
          useAppStore.getState().clearLastQr(session.id);
        }
      },

      onSessionDeleted: (payload) => {
        const sessionId = getSessionId(payload);
        if (!sessionId) return;
        console.warn(`[Runtime] session:deleted id=${sessionId}`);
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
        store.setConversations((prev) => {
          const nextList = [...prev];
          for (const chat of loadedChats) {
            const idx = nextList.findIndex((c) => c.id === chat.id);
            if (idx === -1) {
              nextList.push(chat);
            } else {
              nextList[idx] = { ...nextList[idx], ...chat };
            }
          }
          return nextList;
        });
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
          const mediaUrl = item.mediaUrl || item.media_url || item.url;
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
        const conversationId = incoming.conversationId || incoming.chatId;
        if (!conversationId) return;
        console.info(`[Runtime] ai_response id=${incoming.id} conversation=${conversationId}`);
        useAppStore.getState().addMessage(conversationId, incoming as ChatMessage);

        const store = useAppStore.getState();
        store.updateConversationRealtime({
          id: conversationId,
          lastMessage: incoming.content || "",
          updatedAt: incoming.createdAt || new Date().toISOString(),
        });
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
        const conv = store.conversations.find((c) => c.id === resolvedId);
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
        const conversationId = incoming.conversationId || incoming.chatId;
        if (!conversationId) return;

        console.info(`[Runtime] new_message id=${incoming.id} conversation=${conversationId}`);
        useAppStore.getState().addMessage(conversationId, incoming);

        const store = useAppStore.getState();
        const isActive = store.activeConversationId === conversationId;
        const currentConv = store.conversations.find((c) => c.id === conversationId);

        useAppStore.getState().updateConversationRealtime({
          id: conversationId,
          lastMessage: incoming.content || "",
          updatedAt: incoming.createdAt || new Date().toISOString(),
          unread: isActive ? 0 : (incoming.fromMe ? 0 : 1) + (currentConv?.unread ?? 0),
        });
      },

      onMessageStatus: (payload) => {
        const { messageId, status } = payload;
        let conversationId = payload.conversationId;
        if (!messageId) return;

        // If conversationId is not provided, or looks like a phone number/JID, let's find the conversation UUID in the store
        if (!conversationId || conversationId.includes("@") || /^\+?\d+$/.test(conversationId)) {
          const target = conversationId || "";
          const cleanTarget = target.replace(/@s\.whatsapp\.net$/i, "").replace(/\D/g, "");

          const state = useAppStore.getState();
          // Try to find by chatId or phone
          const found = state.conversations.find(
            (c) =>
              (c.chatId && c.chatId.replace(/@s\.whatsapp\.net$/i, "") === cleanTarget) ||
              (c.phone && c.phone.replace(/\D/g, "") === cleanTarget) ||
              c.id === target
          );
          if (found) {
            conversationId = found.id;
          } else {
            // Fallback: search messagesByConversationId for this messageId to see which conversation it belongs to
            const entries = Object.entries(state.messagesByConversationId);
            const foundEntry = entries.find(([_, messages]) => messages.some((m) => m.id === messageId));
            if (foundEntry) {
              conversationId = foundEntry[0];
            } else {
              // If still not found, check if target was passed, otherwise skip
              conversationId = target;
            }
          }
        }

        if (!conversationId) return;

        console.info(`[Runtime] message_status id=${messageId} status=${status} resolvedConversationId=${conversationId}`);
        useAppStore.getState().updateMessageStatus(conversationId, messageId, status as ChatMessage["status"]);
      },

      onMessageDeleted: (payload) => {
        const { messageId, conversationId } = payload;
        if (!messageId || !conversationId) return;
        console.warn(`[Runtime] message_deleted id=${messageId}`);
        useAppStore.getState().deleteMessage(conversationId, messageId);
      },

      onTypingStatus: (payload) => {
        const { conversationId, isTyping } = payload;
        if (!conversationId) return;
        useAppStore.getState().updateTypingStatus(conversationId, isTyping);
      },
    });

    return () => {
      disconnect();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
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
        console.info(`[Runtime] tab:focused elapsed=${elapsed}ms rehydrating`);
        void loadFromApi();
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
