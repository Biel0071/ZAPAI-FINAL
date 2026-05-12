import { API_BASE_URL, API_ORIGIN } from "@/lib/backendConfig";
import { buildApiHeaders } from "@/lib/apiGuard";
import { type MetricsSummary, type SessionInfo } from "@/services/apiService";
import type {
  AdminGlobalOverview,
  AdminInstanceRow,
  AdminMasterSnapshot,
  AdminMetric,
  MasterApiEndpointDiagnostic,
  NodeHeartbeatDiagnostic,
  AdminUserRow,
  AdminWhatsAppRow,
  BackendHealthStatus,
  InfrastructureSnapshot,
} from "@/types/adminMaster";

type JsonRecord = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 12_000;
const ENDPOINT_404_COOLDOWN_MS = 120_000;
const unavailableEndpoints = new Map<string, number>();

type EndpointProbeResult = {
  endpoint: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  checkedAt: string;
  payload: unknown;
  error: string | null;
};

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as JsonRecord;
  const possible = source.error ?? source.message ?? source.details;
  return typeof possible === "string" && possible.trim() ? possible.trim() : null;
}

async function probeMasterEndpoint(endpoint: string): Promise<EndpointProbeResult> {
  const startedAt = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    const payload = await requestJson(endpoint, "GET");
    return {
      endpoint,
      ok: true,
      statusCode: 200,
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt,
      payload,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    const statusMatch = message.match(/HTTP\s+(\d{3})/i);
    const statusCode = statusMatch ? Number(statusMatch[1]) : null;
    return {
      endpoint,
      ok: false,
      statusCode,
      latencyMs: Math.round(performance.now() - startedAt),
      checkedAt,
      payload: null,
      error: message,
    };
  }
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "online", "connected", "active"].includes(normalized)) return true;
    if (["false", "0", "no", "offline", "disconnected", "inactive"].includes(normalized)) return false;
  }
  return null;
}

function extractStatus(value: unknown): BackendHealthStatus {
  const normalized = String(value ?? "").toLowerCase();
  if (["online", "running", "active", "ok", "healthy", "connected"].includes(normalized)) return "online";
  if (["offline", "down", "error", "stopped", "disconnected", "unhealthy"].includes(normalized)) return "offline";
  return "unknown";
}

function resolveEndpoint(endpoint: string): string {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return path.startsWith("/api/") ? `${API_ORIGIN}${path}` : `${API_BASE_URL}${path}`;
}

async function requestJson(endpoint: string, method: "GET" | "POST", body?: JsonRecord): Promise<unknown> {
  if (method === "GET") {
    const unavailableUntil = unavailableEndpoints.get(endpoint);
    if (unavailableUntil && unavailableUntil > Date.now()) {
      throw new Error(`HTTP 404 (cooldown) ${endpoint}`);
    }
    if (unavailableUntil && unavailableUntil <= Date.now()) {
      unavailableEndpoints.delete(endpoint);
    }
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const apiHeaders = await buildApiHeaders();

    const response = await fetch(resolveEndpoint(endpoint), {
      method,
      signal: controller.signal,
      headers: apiHeaders,
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });

    const raw = await response.text();
    const parsed = raw
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return { message: raw } as JsonRecord;
          }
        })()
      : {};

    if (!response.ok) {
      if (method === "GET" && response.status === 404) {
        unavailableEndpoints.set(endpoint, Date.now() + ENDPOINT_404_COOLDOWN_MS);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return parsed;
  } catch (error) {
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function mapUsers(payload: unknown): AdminUserRow[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as JsonRecord).data)
      ? ((payload as JsonRecord).data as unknown[])
      : [];

  return list
    .filter((item): item is JsonRecord => Boolean(item && typeof item === "object"))
    .map((item, index) => ({
      id: String(item.id ?? item.userId ?? item.user_id ?? `user-${index}`),
      name: String(item.name ?? item.fullName ?? item.displayName ?? item.email ?? "Usuário"),
      company: toText(item.company ?? item.companyName ?? item.tenant),
      email: toText(item.email),
      plan: toText(item.plan ?? item.subscriptionPlan),
      status: toText(item.status),
      dueDate: toText(item.dueDate ?? item.expiresAt ?? item.expirationDate),
      whatsappLimit: toNumber(item.whatsappLimit ?? item.sessionLimit),
      usedSessions: toNumber(item.usedSessions ?? item.sessionsUsed),
      lastLogin: toText(item.lastLogin ?? item.last_login ?? item.lastSeenAt),
    }));
}

function mapWhatsAppRows(sessions: SessionInfo[]): AdminWhatsAppRow[] {
  return sessions.map((session) => ({
    id: session.id,
    user: null,
    number: session.phone ?? null,
    status: session.status ?? (session.connected ? "connected" : "disconnected"),
    messagesToday: null,
    lastActivity: null,
  }));
}

function mapInstances(payload: unknown): AdminInstanceRow[] {
  const root = payload && typeof payload === "object" ? (payload as JsonRecord) : {};
  const data = root.data && typeof root.data === "object" ? (root.data as JsonRecord) : root;
  const list = Array.isArray(root)
    ? root
    : Array.isArray(data.instances)
      ? (data.instances as unknown[])
      : Array.isArray(data.nodes)
        ? (data.nodes as unknown[])
        : [];

  return list
    .filter((item): item is JsonRecord => Boolean(item && typeof item === "object"))
    .map((item, index) => {
      const status = extractStatus(item.status ?? item.runtime ?? item.health);
      const whatsappConnected = toBoolean(item.whatsappConnected ?? item.whatsapp ?? item.connected);
      return {
        id: String(item.id ?? item.instanceId ?? item.nodeId ?? `instance-${index}`),
        client: toText(item.client ?? item.customer ?? item.company ?? item.tenant),
        name: String(item.name ?? item.instanceName ?? item.nodeName ?? `Instância ${index + 1}`),
        ip: toText(item.ip ?? item.host ?? item.serverIp),
        domain: toText(item.domain ?? item.hostname ?? item.hostName),
        version: toText(item.version ?? item.buildVersion ?? item.release),
        status,
        uptime: toText(item.uptime ?? item.systemUptime),
        cpu: toText(item.cpu ?? item.cpuUsage),
        ram: toText(item.ram ?? item.memory ?? item.memoryUsage),
        disk: toText(item.disk ?? item.diskUsage ?? item.storage),
        whatsappSessions: toNumber(item.whatsappSessions ?? item.whatsapp_sessions ?? item.sessions ?? item.sessionCount) ??
          (whatsappConnected ? 1 : null),
        whatsappConnected,
        lastHeartbeat: toText(item.lastHeartbeat ?? item.last_heartbeat ?? item.heartbeatAt ?? item.updatedAt),
        heartbeatLatencyMs: toNumber(item.heartbeatLatencyMs ?? item.heartbeat_latency_ms ?? item.latencyMs),
      };
    });
}

function buildGlobalOverview(input: { instances: AdminInstanceRow[]; metrics: MetricsSummary | null }): AdminGlobalOverview {
  const online = input.instances.filter((instance) => instance.status === "online").length;
  const metricsAny = (input.metrics ?? {}) as MetricsSummary & JsonRecord;

  return {
    totalNodes: input.instances.length || null,
    nodesOnline: online || null,
    revenue: toNumber(metricsAny.monthlyRevenue ?? metricsAny.revenueMonth ?? metricsAny.revenue),
    failures: toNumber(metricsAny.failures ?? metricsAny.errors ?? metricsAny.failedJobs),
    alerts: toNumber(metricsAny.alerts ?? metricsAny.warnings ?? metricsAny.incidents),
  };
}

function inferInfrastructure(payload: unknown): InfrastructureSnapshot {
  const raw = payload && typeof payload === "object" ? (payload as JsonRecord) : {};
  const data = raw.data && typeof raw.data === "object" ? (raw.data as JsonRecord) : raw;
  const system = data.system && typeof data.system === "object" ? (data.system as JsonRecord) : data;

  return {
    ip: toText(system.ip ?? system.serverIp),
    domain: toText(system.domain ?? system.host),
    ssl: toText(system.ssl ?? system.tls),
    pm2: toText(system.pm2Status ?? system.pm2),
    postgres: toText(system.postgres ?? system.database ?? system.db),
    docker: toText(system.docker),
    queue: toText(system.queue ?? system.campaignQueue),
    cpu: toText(system.cpu ?? system.cpuUsage),
    ram: toText(system.ram ?? system.memory ?? system.memoryUsage),
    disk: toText(system.disk ?? system.diskUsage),
    uptime: toText(system.uptime ?? system.systemUptime),
  };
}

function extractDataObject(payload: unknown): JsonRecord {
  if (!payload || typeof payload !== "object") return {};
  const raw = payload as JsonRecord;
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data as JsonRecord;
  }
  return raw;
}

function buildMetrics(input: {
  users: AdminUserRow[];
  sessions: SessionInfo[];
  metrics: MetricsSummary | null;
  infra: InfrastructureSnapshot;
  backendStatus: BackendHealthStatus;
  databaseStatus: BackendHealthStatus;
  heartbeatAt: string | null;
}): AdminMetric[] {
  const onlineSessions = input.sessions.filter((session) => String(session.status ?? "").toLowerCase().includes("connected") || session.connected).length;
  const offlineSessions = Math.max(input.sessions.length - onlineSessions, 0);
  const blockedUsers = input.users.filter((user) => String(user.status ?? "").toLowerCase().includes("block")).length;
  const onlineUsers = input.users.filter((user) => String(user.status ?? "").toLowerCase().includes("online")).length;

  const metricsAny = extractDataObject(input.metrics) as MetricsSummary & JsonRecord;
  const messagesToday = toNumber(metricsAny.messagesToday ?? metricsAny.todayMessages ?? metricsAny.totalMessages ?? metricsAny.messages);
  const monthlyRevenue = toNumber(metricsAny.monthlyRevenue ?? metricsAny.revenueMonth ?? metricsAny.revenue);
  const apiConsumption = toNumber(
    metricsAny.apiConsumption ??
      metricsAny.apiRequests ??
      metricsAny.apiUsage ??
      metricsAny.requestsToday ??
      metricsAny.totalRequests,
  );

  return [
    { key: "total-users", label: "Total usuários", value: input.users.length || null },
    { key: "online-users", label: "Usuários online", value: onlineUsers || null },
    { key: "blocked-users", label: "Contas bloqueadas", value: blockedUsers || null },
    { key: "wa-online", label: "Sessões WhatsApp online", value: onlineSessions || null },
    { key: "wa-offline", label: "Sessões WhatsApp offline", value: offlineSessions || null },
    { key: "messages-today", label: "Mensagens hoje", value: messagesToday },
    { key: "api-consumption", label: "Consumo API", value: apiConsumption },
    { key: "heartbeat", label: "Heartbeat", value: input.heartbeatAt },
    { key: "monthly-revenue", label: "Receita mensal", value: monthlyRevenue !== null ? `R$ ${monthlyRevenue.toLocaleString("pt-BR")}` : null },
    { key: "cpu", label: "CPU VPS", value: input.infra.cpu },
    { key: "ram", label: "RAM VPS", value: input.infra.ram },
    { key: "disk", label: "Disco VPS", value: input.infra.disk },
    { key: "uptime", label: "Uptime", value: input.infra.uptime },
    { key: "backend", label: "Backend status", value: input.backendStatus, status: input.backendStatus },
    { key: "database", label: "Banco status", value: input.databaseStatus, status: input.databaseStatus },
  ];
}

export async function loadAdminMasterSnapshot(): Promise<AdminMasterSnapshot> {
  const probes = await Promise.all([
    probeMasterEndpoint("/api/cluster/overview"),
    probeMasterEndpoint("/api/cluster/nodes"),
    probeMasterEndpoint("/api/cluster/metrics"),
    probeMasterEndpoint("/api/cluster/deployments"),
    probeMasterEndpoint("/api/system/runtime/status"),
    probeMasterEndpoint("/api/health"),
    probeMasterEndpoint("/api/session-status"),
    probeMasterEndpoint("/api/system/error-log"),
  ]);

  const probeByEndpoint = new Map(probes.map((probe) => [probe.endpoint, probe]));
  const endpointDiagnostics: MasterApiEndpointDiagnostic[] = probes.map((probe) => ({
    endpoint: probe.endpoint,
    ok: probe.ok,
    statusCode: probe.statusCode,
    latencyMs: probe.latencyMs,
    checkedAt: probe.checkedAt,
    error: probe.error ?? readErrorMessage(probe.payload),
  }));
  const pending = endpointDiagnostics
    .filter((item) => !item.ok)
    .map((item) => `${item.endpoint} falhou (${item.statusCode ?? "sem status"}) ${item.error ?? "sem detalhe"}`);

  const access = "granted" as const;
  const sessionsProbe = probeByEndpoint.get("/api/session-status");
  const sessions: SessionInfo[] =
    sessionsProbe?.ok
      ? toList(sessionsProbe.payload).map((item, index) => ({
          id: String(item.id ?? item.sessionId ?? item.session_id ?? `session-${index}`),
          name: toText(item.name ?? item.sessionName ?? item.session_name) ?? undefined,
          phone: toText(item.phone ?? item.phoneNumber ?? item.phone_number) ?? undefined,
          connected: toBoolean(item.connected ?? item.isConnected ?? item.online) ?? undefined,
          status: toText(item.status) ?? undefined,
        }))
      : [];

  const metricsProbe = probeByEndpoint.get("/api/cluster/metrics");
  const heartbeatProbe = probeByEndpoint.get("/api/health");
  const runtimeProbe = probeByEndpoint.get("/api/system/runtime/status");
  const instancesProbe = probeByEndpoint.get("/api/cluster/nodes");
  const usersProbe = undefined;

  const metrics = metricsProbe?.ok ? (extractDataObject(metricsProbe.payload) as MetricsSummary) : null;
  const heartbeatPayload = heartbeatProbe?.ok ? heartbeatProbe.payload : null;
  const runtimePayload = runtimeProbe?.ok ? runtimeProbe.payload : null;
  const users: AdminUserRow[] = usersProbe?.ok ? mapUsers(usersProbe.payload) : [];
  const instances = instancesProbe?.ok ? mapInstances(instancesProbe.payload) : [];

  const infra = inferInfrastructure(runtimePayload ?? heartbeatPayload);
  const healthRaw = heartbeatPayload && typeof heartbeatPayload === "object" ? (heartbeatPayload as JsonRecord) : {};
  const healthData = healthRaw.data && typeof healthRaw.data === "object" ? (healthRaw.data as JsonRecord) : healthRaw;
  const systemRaw = healthData.system && typeof healthData.system === "object" ? (healthData.system as JsonRecord) : healthData;

  const runtimeRaw = runtimePayload && typeof runtimePayload === "object" ? (runtimePayload as JsonRecord) : {};
  const runtimeData = runtimeRaw.data && typeof runtimeRaw.data === "object" ? (runtimeRaw.data as JsonRecord) : runtimeRaw;

  const backendStatus = extractStatus(runtimeData.runtime ?? runtimeData.status ?? systemRaw.runtime ?? systemRaw.backend ?? "unknown");
  const databaseStatus = extractStatus(systemRaw.database ?? systemRaw.db ?? systemRaw.postgres ?? "unknown");
  const heartbeatAt = toText(systemRaw.lastHeartbeat ?? systemRaw.last_heartbeat ?? runtimeData.lastHeartbeat ?? runtimeData.updatedAt ?? runtimeData.timestamp);
  const nodeHeartbeats: NodeHeartbeatDiagnostic[] = instances.map((node) => ({
    nodeId: node.id,
    nodeName: node.name,
    status: node.status,
    latencyMs: node.heartbeatLatencyMs,
    lastHeartbeat: node.lastHeartbeat,
  }));

  const offline = !heartbeatProbe?.ok && !runtimeProbe?.ok;

  return {
    metrics: buildMetrics({ users, sessions, metrics, infra, backendStatus, databaseStatus, heartbeatAt }),
    users,
    whatsapp: mapWhatsAppRows(sessions),
    instances,
    nodeHeartbeats,
    global: buildGlobalOverview({ instances, metrics }),
    infrastructure: infra,
    backendStatus,
    databaseStatus,
    endpointDiagnostics,
    loading: false,
    offline,
    access,
    integrationsPending: pending,
    impersonation: { active: false, userId: null, userName: null },
  };
}

export async function impersonateUser(userId: string, userName: string) {
  await requestJson("/api/admin/impersonate", "POST", { userId });
  return { active: true, userId, userName };
}

export async function stopImpersonation() {
  await requestJson("/api/admin/impersonate/stop", "POST");
  return { active: false, userId: null, userName: null };
}

export async function executeInstanceAction(instanceId: string, action: string) {
  void instanceId;
  void action;
  throw new Error("Ação remota indisponível neste backend");
}

function toList(payload: unknown): JsonRecord[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as JsonRecord).data)
      ? ((payload as JsonRecord).data as unknown[])
      : [];

  return list.filter((item): item is JsonRecord => Boolean(item && typeof item === "object"));
}

export type MasterVersionRow = {
  id: string;
  version: string;
  channel: string | null;
  publishedAt: string | null;
  status: string | null;
};

export type MasterRemoteUpdateRow = {
  id: string;
  node: string;
  version: string | null;
  status: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type MasterLogRow = {
  id: string;
  timestamp: string;
  service: string;
  level: string;
  message: string;
};

export type MasterBillingRow = {
  id: string;
  node: string | null;
  client: string;
  plan: string | null;
  amount: number | null;
  dueDate: string | null;
  status: string | null;
};

export type MasterAdminRow = {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  status: string | null;
  lastAccess: string | null;
};

export async function loadMasterVersions(): Promise<MasterVersionRow[]> {
  const payload = await requestJson("/api/cluster/deployments", "GET");
  return toList(payload).map((item, index) => ({
    id: String(item.id ?? `version-${index}`),
    version: String(item.version ?? item.tag ?? item.release ?? "—"),
    channel: toText(item.channel ?? item.environment),
    publishedAt: toText(item.publishedAt ?? item.createdAt ?? item.created_at),
    status: toText(item.status),
  }));
}

export async function loadMasterRemoteUpdates(): Promise<MasterRemoteUpdateRow[]> {
  const payload = await requestJson("/api/cluster/deployments", "GET");
  return toList(payload).map((item, index) => ({
    id: String(item.id ?? `update-${index}`),
    node: String(item.node ?? item.instance ?? item.instanceName ?? "Node"),
    version: toText(item.version ?? item.targetVersion),
    status: toText(item.status),
    startedAt: toText(item.startedAt ?? item.started_at ?? item.createdAt),
    finishedAt: toText(item.finishedAt ?? item.finished_at ?? item.updatedAt),
  }));
}

export async function loadMasterLogs(): Promise<MasterLogRow[]> {
  const payload = await requestJson("/api/system/error-log", "GET");
  return toList(payload)
    .map((item, index) => ({
      id: String(item.id ?? `log-${index}`),
      timestamp: String(item.timestamp ?? item.createdAt ?? new Date().toISOString()),
      service: String(item.service ?? item.source ?? "system"),
      level: String(item.level ?? item.severity ?? "error"),
      message: String(item.message ?? item.error ?? "Sem mensagem"),
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function loadMasterBilling(): Promise<MasterBillingRow[]> {
  const payload = await requestJson("/api/cluster/nodes", "GET");
  return toList(payload).map((item, index) => ({
    id: String(item.id ?? `billing-${index}`),
    node: toText(item.node ?? item.instance ?? item.instanceName ?? item.server),
    client: String(item.client ?? item.customer ?? item.company ?? "Cliente"),
    plan: toText(item.plan),
    amount: toNumber(item.amount ?? item.value ?? item.total),
    dueDate: toText(item.dueDate ?? item.due_date),
    status: toText(item.status),
  }));
}

export async function loadMasterAdmins(): Promise<MasterAdminRow[]> {
  const payload = await requestJson("/api/session-status", "GET");
  return toList(payload).map((item, index) => ({
    id: String(item.id ?? `admin-${index}`),
    name: String(item.name ?? item.sessionName ?? item.phone ?? "Operador"),
    email: null,
    role: "admin",
    status: toText(item.status ?? item.connected),
    lastAccess: toText(item.lastAccess ?? item.updatedAt ?? item.last_seen_at),
  }));
}
