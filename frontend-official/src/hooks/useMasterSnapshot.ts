import { useCallback, useEffect, useRef, useState } from "react";
import { loadAdminMasterSnapshot } from "@/services/adminMasterService";
import type { AdminMasterSnapshot } from "@/types/adminMaster";

const INITIAL_SNAPSHOT: AdminMasterSnapshot = {
  metrics: [],
  users: [],
  whatsapp: [],
  instances: [],
  nodeHeartbeats: [],
  global: {
    totalNodes: null,
    nodesOnline: null,
    revenue: null,
    failures: null,
    alerts: null,
  },
  infrastructure: {
    ip: null,
    domain: null,
    ssl: null,
    pm2: null,
    postgres: null,
    docker: null,
    queue: null,
    cpu: null,
    ram: null,
    disk: null,
    uptime: null,
  },
  backendStatus: "unknown",
  databaseStatus: "unknown",
  endpointDiagnostics: [],
  loading: true,
  offline: false,
  access: "loading",
  integrationsPending: [],
  impersonation: { active: false, userId: null, userName: null },
};

// 60 s when visible — this is a heavy admin endpoint (infra metrics, nodes, Redis).
// 5 s was generating 720 requests/hour/tab with zero benefit over WebSocket events.
const POLL_INTERVAL_MS = 60_000;

export function useMasterSnapshot() {
  const [snapshot, setSnapshot] = useState<AdminMasterSnapshot>(INITIAL_SNAPSHOT);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await loadAdminMasterSnapshot();
      setSnapshot(data);
    } catch {
      setSnapshot((prev) => ({ ...prev, loading: false, offline: true }));
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const schedule = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        // Skip polling when tab is backgrounded — saves server resources and battery
        if (document.hidden) return;
        void refresh({ silent: true });
      }, POLL_INTERVAL_MS);
    };

    void refresh();
    schedule();

    // When tab becomes visible again after being hidden, refresh immediately
    const handleVisibilityChange = () => {
      if (!document.hidden && mounted) void refresh({ silent: true });
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  return { snapshot, refresh, refreshing };
}