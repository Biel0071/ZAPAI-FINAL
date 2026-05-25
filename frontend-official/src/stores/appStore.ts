import { create } from "zustand";
import type { Conversation, MetricsSummary, ChatMessage } from "@/services/apiService";

export type RuntimeStatus =
  | "offline"
  | "connecting"
  | "online"
  | "reconnecting"
  | "degraded";

export type SessionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "qr"
  | "error"
  | "unknown";

export type SessionItem = {
  id: string;
  name: string;
  phone?: string | null;
  profilePicture?: string | null;
  pushName?: string | null;
  status: SessionStatus;
  updatedAt?: string | null;
  raw?: any;
};

type AppState = {
  conversations: Conversation[];
  metrics: MetricsSummary | null;
  sessions: SessionItem[];
  lastQr: Record<string, string | null>;
  lastSyncAt: number | null;

  runtimeStatus: RuntimeStatus;
  websocketHealth: "online" | "offline" | "reconnecting";
  apiHealth: "ONLINE" | "RECONNECTING" | "OFFLINE";
  apiLatency: number | null;
  activeConversationId: string | null;
  messagesByConversationId: Record<string, ChatMessage[]>;
  unreadCounters: Record<string, number>;
  reconnectState: { attempts: number; lastAttemptAt: number | null };
  typingUsers: Record<string, boolean>;

  setConversations: (listOrUpdater: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  upsertConversation: (conv: Conversation) => void;
  setMetrics: (metrics: MetricsSummary | null) => void;

  setSessions: (sessions: SessionItem[]) => void;
  upsertSession: (session: SessionItem) => void;
  removeSession: (sessionId: string) => void;

  setLastQr: (sessionId: string, qr: string | null) => void;
  clearLastQr: (sessionId: string) => void;
  clearAllQrs: () => void;
  reset: () => void;

  updateRuntimeStatus: (status: RuntimeStatus) => void;
  updateWebsocketHealth: (health: "online" | "offline" | "reconnecting") => void;
  updateApiHealth: (health: "ONLINE" | "RECONNECTING" | "OFFLINE", latency?: number | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: ChatMessage["status"]) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  updateConversationRealtime: (conv: Partial<Conversation> & { id: string }) => void;
  updateReconnectState: (updater: (prev: AppState["reconnectState"]) => AppState["reconnectState"]) => void;
  updateTypingStatus: (conversationId: string, isTyping: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  conversations: [],
  metrics: null,
  sessions: [],
  lastQr: {},
  lastSyncAt: null,

  runtimeStatus: "offline",
  websocketHealth: "offline",
  apiHealth: "ONLINE",
  apiLatency: null,
  activeConversationId: null,
  messagesByConversationId: {},
  unreadCounters: {},
  reconnectState: { attempts: 0, lastAttemptAt: null },
  typingUsers: {},

  setConversations: (listOrUpdater) =>
    set((state) => ({
      conversations:
        typeof listOrUpdater === "function"
          ? listOrUpdater(state.conversations)
          : listOrUpdater,
      lastSyncAt: Date.now(),
    })),

  upsertConversation: (conv) =>
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conv.id);
      if (idx === -1) {
        return { conversations: [conv, ...state.conversations] };
      }
      const next = state.conversations.slice();
      next[idx] = { ...next[idx], ...conv };
      return { conversations: next };
    }),

  setMetrics: (metrics) => set({ metrics, lastSyncAt: Date.now() }),

  setSessions: (sessions) => set(() => ({ sessions, lastSyncAt: Date.now() })),

  upsertSession: (session) =>
    set((state) => {
      const index = state.sessions.findIndex((s) => s.id === session.id);
      if (index === -1) {
        return { sessions: [session, ...state.sessions], lastSyncAt: Date.now() };
      }

      const next = [...state.sessions];
      next[index] = { ...next[index], ...session };
      return { sessions: next, lastSyncAt: Date.now() };
    }),

  removeSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      lastQr: Object.fromEntries(
        Object.entries(state.lastQr).filter(([key]) => key !== sessionId)
      ),
      lastSyncAt: Date.now(),
    })),

  setLastQr: (sessionId, qr) =>
    set((state) => ({
      lastQr: { ...state.lastQr, [sessionId]: qr },
    })),

  clearLastQr: (sessionId) =>
    set((state) => {
      const next = { ...state.lastQr };
      delete next[sessionId];
      return { lastQr: next };
    }),

  clearAllQrs: () => set(() => ({ lastQr: {} })),

  reset: () =>
    set({
      conversations: [],
      metrics: null,
      sessions: [],
      lastQr: {},
      lastSyncAt: null,
      runtimeStatus: "offline",
      websocketHealth: "offline",
      activeConversationId: null,
      messagesByConversationId: {},
      unreadCounters: {},
      reconnectState: { attempts: 0, lastAttemptAt: null },
      typingUsers: {},
    }),

  updateRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),

  updateWebsocketHealth: (websocketHealth) => set({ websocketHealth }),

  updateApiHealth: (apiHealth, apiLatency = null) => set({ apiHealth, apiLatency }),

  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [conversationId]: messages,
      },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const current = state.messagesByConversationId[conversationId] ?? [];
      
      // If we already have this message by ID, do nothing
      if (current.some((m) => m.id === message.id)) {
        return {};
      }

      let next = current.slice();
      
      // Optimização: Se for uma mensagem real que enviamos e o ID não for temporário,
      // podemos substituir o correspondente temporário ("temp-") mais antigo para este chat.
      if (message.fromMe && !message.id.startsWith("temp-")) {
        const tempIdx = next.findIndex((m) => m.id.startsWith("temp-"));
        if (tempIdx !== -1) {
          next[tempIdx] = message;
          return {
            messagesByConversationId: {
              ...state.messagesByConversationId,
              [conversationId]: next,
            },
          };
        }
      }

      next.push(message);
      // Ordena de forma ascendente por data
      next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: next,
        },
      };
    }),

  updateMessageStatus: (conversationId, messageId, status) =>
    set((state) => {
      const current = state.messagesByConversationId[conversationId] ?? [];
      const updated = current.map((m) =>
        m.id === messageId ? { ...m, status } : m
      );
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: updated,
        },
      };
    }),

  deleteMessage: (conversationId, messageId) =>
    set((state) => {
      const current = state.messagesByConversationId[conversationId] ?? [];
      const filtered = current.filter((m) => m.id !== messageId);
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: filtered,
        },
      };
    }),

  updateConversationRealtime: (conv) =>
    set((state) => {
      const idx = state.conversations.findIndex((c) => c.id === conv.id);
      if (idx === -1) {
        // Se a conversa não existir na lista, adicionamos como nova (cast parcial para Conversation)
        return { conversations: [conv as Conversation, ...state.conversations] };
      }
      const next = state.conversations.slice();
      next[idx] = { ...next[idx], ...conv };
      return { conversations: next };
    }),

  updateReconnectState: (updater) =>
    set((state) => ({
      reconnectState: updater(state.reconnectState),
    })),

  updateTypingStatus: (conversationId, isTyping) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: isTyping,
      },
    })),
}));
