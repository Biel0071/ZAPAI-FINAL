import { API_BASE_URL } from '@/config/runtime';

export type AdminMasterOverview = {
  generatedAt: string;
  master?: {
    enabled: boolean;
    hostname: string;
    registrationTokenConfigured: boolean;
  };
  infra: {
    cpuPercent: number;
    ramPercent: number;
    disk?: {
      usedPercent?: number | null;
      totalBytes?: number | null;
      freeBytes?: number | null;
    };
    uptimeSec: number;
    nodeUptimeSec: number;
    platform: string;
    services?: {
      pm2?: boolean;
      docker?: boolean;
      nginx?: boolean;
      openresty?: boolean;
    };
  };
  backend: {
    health: "healthy" | "degraded" | "down" | string;
    runtimeActive: boolean;
    runtimeStatus: string;
    queueJobs: number;
    logsStream: string;
  };
  database: {
    online: boolean;
    size: string;
    connections: number;
  };
  whatsapp: {
    totalSessions: number;
    onlineSessions: number;
    pendingQr: number;
    activeNumbers: number;
    sessionErrors: number;
  };
  users: {
    totalUsers: number | null;
    admins: number | null;
    accessesToday: number | null;
    plans: number | null;
  };
  nodes?: {
    summary?: {
      total_nodes?: number;
      online_nodes?: number;
      offline_nodes?: number;
    };
    nodes?: Array<{
      node_id: string;
      name: string;
      ip_address: string;
      domain?: string | null;
      api_port?: number | null;
      status: "online" | "offline" | "pending" | string;
      last_heartbeat?: string | null;
      last_seen?: string | null;
      cpu_usage?: number | null;
      memory_usage?: number | null;
      disk_usage?: number | null;
      uptime_seconds?: number | null;
    }>;
  };
};

function resolveAuthToken(): string {
  if (typeof window === "undefined") return "";
  const keys = ["auth_token", "zapai_auth_token", "jwt_token", "token"];
  for (const key of keys) {
    const value = String(localStorage.getItem(key) || "").trim();
    if (value) return value;
  }
  return "";
}

export async function getAdminMasterOverview(): Promise<AdminMasterOverview> {
  const token = resolveAuthToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/api/admin/master/overview`, { headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Failed to load admin overview (${response.status})`);
  }

  return (await response.json()) as AdminMasterOverview;
}

export async function requestBackendRestart(): Promise<{ accepted: boolean; message: string }> {
  const token = resolveAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/api/admin/master/actions/restart-backend`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Failed to request restart (${response.status})`);
  }

  return (await response.json()) as { accepted: boolean; message: string };
}
