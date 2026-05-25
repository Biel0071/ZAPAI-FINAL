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
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { connectInboxSocket, forceReconnectInboxSocket } from "@/services/socketService";
import { apiService } from "@/services/apiService";
import { useAppStore } from "@/stores/appStore";
import { API_ORIGIN } from "@/lib/backendConfig";
import { normalizeSession, getSessionId } from "@/services/normalizeSession";
import {
  buildRuntimeCoherenceSnapshot,
  persistRuntimeCoherenceSnapshot,
} from "@/services/runtimeCoherenceService";

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
  const [status, setStatus] = useState<RuntimeStatus>("offline");
  const [hydrated, setHydrated] = useState(false);

  // Refs for values used inside socket callbacks — prevents effect re-runs
  const disconnectedAtRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep hydratedRef in sync
  hydratedRef.current = hydrated;

  const sessions = useAppStore((s) => s.sessions);

  const connectedSessions = sessions.filter(
    (s) => s.status === "connected",
  ).length;

  const forceRefresh = useCallback(async () => {
    try {
      const response = await apiService.listSessions();
      const normalized = (response ?? []).map(normalizeSession);

      useAppStore.getState().setSessions(normalized);

      for (const session of normalized) {
        if (session.status === "connected") {
          useAppStore.getState().clearLastQr(session.id);
        }
      }
    } catch (err) {
      console.warn("[Runtime] forceRefresh:error", err);
    }
  }, []);

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
          websocketHealthy: status === "online",
        }),
      );

      setHydrated(true);
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
          websocketHealthy: status === "online",
        }),
      );
    }
  }, [status]);

  const forceReconnect = useCallback(() => {
    forceReconnectInboxSocket();
  }, []);

  // Debounced refresh for reconnect — avoid flooding API after brief disconnection
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => void loadFromApi(), 3000);
  }, [loadFromApi]);

  // Resolve socket URL once
  const socketUrl = API_ORIGIN || (typeof window !== "undefined" ? window.location.origin : "");

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

  const contextValue: RuntimeContextValue = {
    status,
    connectedSessions,
    hydrated,
    forceRefresh,
    forceReconnect,
  };

  return <RuntimeContext.Provider value={contextValue}>{children}</RuntimeContext.Provider>;
}
