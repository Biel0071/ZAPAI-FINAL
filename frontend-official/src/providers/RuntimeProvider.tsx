/**
 * RuntimeProvider — Central WebSocket hydration layer.
 *
 * Wraps the authenticated portion of the app and:
 * 1. Maintains a single shared Socket.IO connection
 * 2. Hydrates Zustand store with real-time data (sessions, metrics, conversations)
 * 3. Provides runtime status (online/offline/reconnecting) to all children
 * 4. Eliminates the need for per-page polling where WebSocket covers the same data
 *
 * All pages consume data through useAppStore (Zustand) which this provider
 * keeps in sync with the backend via WebSocket events.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { connectInboxSocket, forceReconnectInboxSocket } from "@/services/socketService";
import { apiService, type Conversation, type SessionInfo } from "@/services/apiService";
import { useAppStore } from "@/stores/appStore";
import { API_ORIGIN } from "@/lib/backendConfig";

type RuntimeStatus = "online" | "reconnecting" | "offline";

type RuntimeContextValue = {
  /** Current WebSocket connection status */
  status: RuntimeStatus;
  /** Number of connected WhatsApp sessions */
  connectedSessions: number;
  /** Whether the initial hydration has completed */
  hydrated: boolean;
  /** Force a full data refresh from the API */
  forceRefresh: () => Promise<void>;
  /** Force WebSocket reconnection */
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

// Debounce helper
function useDebouncedCallback<T extends (...args: unknown[]) => void>(fn: T, delayMs: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(
    ((...args: unknown[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delayMs);
    }) as T,
    [delayMs],
  );
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RuntimeStatus>("offline");
  const [hydrated, setHydrated] = useState(false);
  const disconnectedAtRef = useRef<number | null>(null);

  const setConversations = useAppStore((s) => s.setConversations);
  const setSessions = useAppStore((s) => s.setSessions);
  const setMetrics = useAppStore((s) => s.setMetrics);
  const sessions = useAppStore((s) => s.sessions);

  const connectedSessions = sessions.filter(
    (s) => s.connected || (s.status ?? "").toLowerCase() === "connected",
  ).length;

  // Full API refresh (used on initial load + reconnect)
  const loadFromApi = useCallback(async () => {
    try {
      const [sessionsResult, conversationsResult, metricsResult] = await Promise.allSettled([
        apiService.listSessions(),
        apiService.getConversations(false),
        apiService.getMetrics(),
      ]);

      if (sessionsResult.status === "fulfilled" && Array.isArray(sessionsResult.value)) {
        setSessions(sessionsResult.value);
      }
      if (conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value)) {
        setConversations(conversationsResult.value);
      }
      if (metricsResult.status === "fulfilled" && metricsResult.value) {
        setMetrics(metricsResult.value);
      }

      setHydrated(true);
    } catch {
      // Silent — health watcher reports errors separately
    }
  }, [setConversations, setMetrics, setSessions]);

  // Debounced refresh for reconnection (avoid flooding after reconnect)
  const debouncedRefresh = useDebouncedCallback(loadFromApi, 3000);

  const forceReconnect = useCallback(() => {
    forceReconnectInboxSocket();
  }, []);

  // Resolve the socket URL — use API_ORIGIN or window.location.origin
  const socketUrl = API_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    if (!socketUrl) return;

    // Initial hydration from API
    void loadFromApi();

    const disconnect = connectInboxSocket({
      socketUrl,
      onSocketConnected: () => {
        setStatus("online");
        disconnectedAtRef.current = null;

        // Re-hydrate on reconnect (but not on first connect — loadFromApi handles that)
        if (hydrated) {
          debouncedRefresh();
        }
      },
      onSocketDisconnected: () => {
        const now = Date.now();
        if (!disconnectedAtRef.current) {
          disconnectedAtRef.current = now;
        }
        // Show "reconnecting" for first 30s, then "offline"
        const elapsed = now - (disconnectedAtRef.current ?? now);
        setStatus(elapsed < 30_000 ? "reconnecting" : "offline");
      },

      // Session events → update Zustand sessions store
      onSessionConnected: (payload) => {
        if (!payload.sessionId) return;
        setSessions((prev: SessionInfo[]) => {
          const existing = prev.find((s) => s.id === payload.sessionId);
          if (existing) {
            return prev.map((s) =>
              s.id === payload.sessionId
                ? { ...s, connected: true, status: "connected", phone: payload.phone ?? s.phone }
                : s,
            );
          }
          return [
            ...prev,
            {
              id: payload.sessionId!,
              connected: true,
              status: "connected",
              phone: payload.phone,
            },
          ];
        });
      },
      onSessionDisconnected: (payload) => {
        if (!payload.sessionId) return;
        setSessions((prev: SessionInfo[]) =>
          prev.map((s) =>
            s.id === payload.sessionId ? { ...s, connected: false, status: "disconnected" } : s,
          ),
        );
      },
      onSessionStatus: (payload) => {
        if (!payload.sessionId) return;
        setSessions((prev: SessionInfo[]) =>
          prev.map((s) =>
            s.id === payload.sessionId
              ? {
                  ...s,
                  connected: payload.status?.toLowerCase() === "connected",
                  status: payload.status,
                }
              : s,
          ),
        );
      },
      onSessionDeleted: (payload) => {
        if (!payload.sessionId) return;
        setSessions((prev: SessionInfo[]) => prev.filter((s) => s.id !== payload.sessionId));
      },

      // Conversation events → update Zustand conversations store
      onConversationUpdated: (incoming) => {
        if (!incoming?.id) return;
        const store = useAppStore.getState();
        const existing = store.conversations.find((c) => c.id === incoming.id);
        if (existing) {
          store.upsertConversation({ ...existing, ...incoming });
        } else {
          store.upsertConversation(incoming);
        }
      },
    });

    return () => disconnect();
  }, [socketUrl, loadFromApi, hydrated, debouncedRefresh, setSessions]);

  const contextValue: RuntimeContextValue = {
    status,
    connectedSessions,
    hydrated,
    forceRefresh: loadFromApi,
    forceReconnect,
  };

  return <RuntimeContext.Provider value={contextValue}>{children}</RuntimeContext.Provider>;
}
