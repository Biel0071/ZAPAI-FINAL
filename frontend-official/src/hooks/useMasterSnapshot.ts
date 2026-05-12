import { useCallback, useEffect, useState } from "react";
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

export function useMasterSnapshot() {
  const [snapshot, setSnapshot] = useState<AdminMasterSnapshot>(INITIAL_SNAPSHOT);
  const [refreshing, setRefreshing] = useState(false);

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
    void refresh();
    const timer = window.setInterval(() => void refresh({ silent: true }), 5_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { snapshot, refresh, refreshing };
}