import { create } from "zustand";
import type { Conversation, MetricsSummary, SessionInfo } from "@/services/apiService";

/**
 * Global app store (Zustand).
 *
 * Responsabilidade: centralizar entidades vivas (conversations, metrics, sessions)
 * que são compartilhadas entre múltiplas telas. Evita estados duplicados em
 * Dashboard, Inbox, Connections, Contacts.
 *
 * Não substitui React Query — atua como cache reativo cross-page.
 * Quem fizer fetch deve chamar setConversations / setMetrics / setSessions
 * para hidratar o store.
 */
type AppState = {
  conversations: Conversation[];
  metrics: MetricsSummary | null;
  sessions: SessionInfo[];
  lastSyncAt: number | null;

  setConversations: (listOrUpdater: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  upsertConversation: (conv: Conversation) => void;
  setMetrics: (metrics: MetricsSummary | null) => void;
  setSessions: (sessionsOrUpdater: SessionInfo[] | ((prev: SessionInfo[]) => SessionInfo[])) => void;
  reset: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  conversations: [],
  metrics: null,
  sessions: [],
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

  setSessions: (sessionsOrUpdater) =>
    set((state) => ({
      sessions:
        typeof sessionsOrUpdater === "function"
          ? sessionsOrUpdater(state.sessions)
          : sessionsOrUpdater,
      lastSyncAt: Date.now(),
    })),

  reset: () =>
    set({ conversations: [], metrics: null, sessions: [], lastSyncAt: null }),
}));

