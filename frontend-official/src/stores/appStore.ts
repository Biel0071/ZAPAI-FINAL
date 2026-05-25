import { create } from "zustand";
import type { Conversation, MetricsSummary } from "@/services/apiService";

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
};

export const useAppStore = create<AppState>((set) => ({
  conversations: [],
  metrics: null,
  sessions: [],
  lastQr: {},
  lastSyncAt: null,

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
    set({ conversations: [], metrics: null, sessions: [], lastQr: {}, lastSyncAt: null }),
}));
