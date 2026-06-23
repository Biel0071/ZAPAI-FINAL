import { buildApiHeaders } from "@/lib/apiGuard";
import { API_BASE_URL, API_ORIGIN } from "@/lib/backendConfig";
import type {
  ClusterOverview,
  NodeContainerInfo,
  NodeControlPlane,
  NodeDeploymentEvent,
  NodeDetailsBundle,
  NodeDiagnosticsCheck,
  NodeHealthState,
  NodeLifecycleStatus,
  NodeLogEntry,
  NodeMetricsSnapshot,
  NodeProvider,
  NodeSessionRouting,
  RuntimeServiceState,
} from "@/types/masterNode";

type JsonRecord = Record<string, unknown>;

const REQUEST_TIMEOUT_MS = 12_000;
const ENDPOINT_404_COOLDOWN_MS = 120_000;
const unavailableEndpoints = new Map<string, number>();

export const WS_CHANNELS = {
  master: "/ws/master",
  nodes: "/ws/nodes",
  deployments: "/ws/deployments",
  metrics: "/ws/metrics",
} as const;

const DEPLOY_ACTIONS = {
  deployLatest: "deploy-latest",
  restartNode: "restart-node",
  restartBackend: "restart-backend",
  restartNginx: "restart-nginx",
  clearCache: "clear-cache",
  pruneDocker: "prune-docker",
  rebuildFrontend: "rebuild-frontend",
  rotateLogs: "rotate-logs",
  syncEnv: "sync-env",
  updateCompose: "update-compose",
} as const;

export type DeployAction = keyof typeof DEPLOY_ACTIONS;

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProvider(value: unknown): NodeProvider {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["aws", "amazon"].includes(normalized)) return "aws";
  if (["gcp", "google"].includes(normalized)) return "gcp";
  if (["azure", "microsoft-azure"].includes(normalized)) return "azure";
  if (["digitalocean", "do"].includes(normalized)) return "digitalocean";
  if (["hetzner"].includes(normalized)) return "hetzner";
  if (["oracle", "oci"].includes(normalized)) return "oracle";
  if (["vultr"].includes(normalized)) return "vultr";
  return "unknown";
}

function normalizeServiceState(value: unknown): RuntimeServiceState {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["running", "online", "up", "connected", "healthy", "ok"].includes(normalized)) return "running";
  if (["stopped", "offline", "down", "disconnected", "disabled"].includes(normalized)) return "stopped";
  if (["degraded", "warning", "restart", "recovering"].includes(normalized)) return "degraded";
  return "unknown";
}

function normalizeLifecycleStatus(value: unknown): NodeLifecycleStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["online", "running", "active", "ready"].includes(normalized)) return "ONLINE";
  if (["offline", "down", "stopped"].includes(normalized)) return "OFFLINE";
  if (["degraded", "warning"].includes(normalized)) return "DEGRADED";
  if (["deploying", "deploy"].includes(normalized)) return "DEPLOYING";
  if (["restarting", "restart"].includes(normalized)) return "RESTARTING";
  if (["unhealthy", "failed", "error"].includes(normalized)) return "UNHEALTHY";
  if (["recovering", "healing"].includes(normalized)) return "RECOVERING";
  return "OFFLINE";
}

function normalizeHealth(value: unknown): NodeHealthState {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["healthy", "ok", "online", "pass"].includes(normalized)) return "healthy";
  if (["unhealthy", "failed", "error", "critical"].includes(normalized)) return "unhealthy";
  return "unknown";
}

function toList(payload: unknown): JsonRecord[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as JsonRecord).data)
      ? ((payload as JsonRecord).data as unknown[])
      : [];

  return list.filter((item): item is JsonRecord => Boolean(item && typeof item === "object"));
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
    const headers = await buildApiHeaders();
    const response = await fetch(resolveEndpoint(endpoint), {
      method,
      headers,
      signal: controller.signal,
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
  } finally {
    window.clearTimeout(timeout);
  }
}

function resolveEndpoint(endpoint: string): string {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/")) {
    return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
  }
  const base = API_BASE_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

function mapMetricsSnapshot(input: JsonRecord, fallbackAt?: string): NodeMetricsSnapshot {
  return {
    cpuPercent: toNumber(input.cpuPercent ?? input.cpu ?? input.cpu_usage),
    ramPercent: toNumber(input.ramPercent ?? input.ram ?? input.memory ?? input.memory_usage),
    diskPercent: toNumber(input.diskPercent ?? input.disk ?? input.disk_usage),
    networkInKbps: toNumber(input.networkInKbps ?? input.netIn ?? input.network_in_kbps),
    networkOutKbps: toNumber(input.networkOutKbps ?? input.netOut ?? input.network_out_kbps),
    dockerStats: toNumber(input.dockerStats ?? input.containersRunning ?? input.docker_stats),
    queueSize: toNumber(input.queueSize ?? input.queue ?? input.jobs_pending),
    redisMemoryMb: toNumber(input.redisMemoryMb ?? input.redis_memory_mb ?? input.redis_memory),
    activeSessions: toNumber(input.activeSessions ?? input.whatsappSessions ?? input.sessions_active),
    qrGenerationCount: toNumber(input.qrGenerationCount ?? input.qrCount ?? input.qr_generation),
    reconnectLoops: toNumber(input.reconnectLoops ?? input.reconnects ?? input.reconnect_loops),
    latencyMs: toNumber(input.latencyMs ?? input.latency ?? input.ping),
    timestamp: toText(input.timestamp ?? input.updatedAt ?? input.createdAt) ?? fallbackAt ?? new Date().toISOString(),
  };
}

function mapNode(item: JsonRecord): NodeControlPlane {
  const runtime = (item.runtime && typeof item.runtime === "object" ? item.runtime : {}) as JsonRecord;
  const services = (item.services && typeof item.services === "object" ? item.services : {}) as JsonRecord;

  return {
    id: String(item.id ?? item.nodeId ?? crypto.randomUUID()),
    name: String(item.name ?? item.nodeName ?? "Node"),
    hostname: toText(item.hostname ?? item.domain ?? item.host),
    provider: normalizeProvider(item.provider ?? item.cloudProvider),
    publicIp: toText(item.publicIp ?? item.ip ?? item.public_ip),
    uptime: toText(item.uptime ?? item.systemUptime),
    status: normalizeLifecycleStatus(item.status ?? runtime.status),
    health: normalizeHealth(item.health ?? runtime.health),
    infra: {
      docker: normalizeServiceState(services.docker ?? item.dockerStatus ?? runtime.docker),
      nginx: normalizeServiceState(services.nginx ?? item.nginxStatus ?? runtime.nginx),
      redis: normalizeServiceState(services.redis ?? item.redisStatus ?? runtime.redis),
      postgres: normalizeServiceState(services.postgres ?? services.db ?? item.postgresStatus ?? runtime.postgres),
      websocket: normalizeServiceState(services.websocket ?? item.websocketStatus ?? runtime.websocket),
    },
    whatsappSessions: toNumber(item.whatsappSessions ?? item.sessions ?? runtime.activeSessions),
    latencyMs: toNumber(item.latencyMs ?? item.latency ?? runtime.ping),
    lastSyncAt: toText(item.lastSyncAt ?? item.lastHeartbeat ?? item.updatedAt),
    build: {
      version: toText(item.version ?? item.buildVersion ?? item.release),
      buildHash: toText(item.buildHash ?? item.hash ?? item.commit),
    },
    metrics: item.metrics && typeof item.metrics === "object" ? mapMetricsSnapshot(item.metrics as JsonRecord, toText(item.updatedAt) ?? undefined) : null,
  };
}

function aggregateCluster(nodes: NodeControlPlane[], payload: JsonRecord): ClusterOverview {
  const totalSessions = nodes.reduce((acc, node) => acc + (node.whatsappSessions ?? 0), 0);
  const queueSize = nodes.reduce((acc, node) => acc + (node.metrics?.queueSize ?? 0), 0);
  const redisUsageMb = nodes.reduce((acc, node) => acc + (node.metrics?.redisMemoryMb ?? 0), 0);

  return {
    totalNodes: toNumber(payload.totalNodes) ?? nodes.length,
    onlineNodes: toNumber(payload.onlineNodes) ?? nodes.filter((node) => node.status === "ONLINE").length,
    totalSessions: toNumber(payload.totalSessions) ?? totalSessions,
    totalMessages: toNumber(payload.totalMessages) ?? 0,
    queueSize: toNumber(payload.queueSize) ?? queueSize,
    websocketConnections: toNumber(payload.websocketConnections) ?? 0,
    unhealthyNodes: toNumber(payload.unhealthyNodes) ?? nodes.filter((node) => node.health === "unhealthy").length,
    failedDeploys: toNumber(payload.failedDeploys) ?? 0,
    redisUsageMb: toNumber(payload.redisUsageMb) ?? redisUsageMb,
    postgresUsageMb: toNumber(payload.postgresUsageMb) ?? 0,
  };
}

export async function loadNodesControlPlane() {
  const [nodesPayload, clusterPayload] = await Promise.all([
    requestJson("/api/cluster/nodes", "GET").catch(() => ({ nodes: [] })),
    requestJson("/api/cluster/overview", "GET").catch(() => ({})),
  ]);

  const nodes = toList(nodesPayload).map(mapNode);
  const clusterRaw = (clusterPayload && typeof clusterPayload === "object" ? clusterPayload : {}) as JsonRecord;
  const cluster = aggregateCluster(nodes, clusterRaw);

  return { nodes, cluster, wsChannels: WS_CHANNELS };
}

function mapContainer(item: JsonRecord): NodeContainerInfo {
  return {
    id: String(item.id ?? item.containerId ?? crypto.randomUUID()),
    name: String(item.name ?? item.containerName ?? "container"),
    status: String(item.status ?? "unknown"),
    image: toText(item.image ?? item.imageName),
    cpuPercent: toNumber(item.cpuPercent ?? item.cpu),
    ramMb: toNumber(item.ramMb ?? item.memoryMb ?? item.ram),
    restartedAt: toText(item.restartedAt ?? item.lastRestartAt),
  };
}

function mapSessionRouting(item: JsonRecord): NodeSessionRouting {
  return {
    sessionId: String(item.sessionId ?? item.id ?? crypto.randomUUID()),
    phone: toText(item.phone ?? item.phoneNumber),
    nodeId: String(item.nodeId ?? item.instanceId ?? ""),
    nodeName: String(item.nodeName ?? item.instanceName ?? "Node"),
    status: String(item.status ?? "unknown"),
    failoverEnabled: Boolean(item.failoverEnabled ?? item.failover),
  };
}

function mapDeployment(item: JsonRecord): NodeDeploymentEvent {
  return {
    id: String(item.id ?? item.deploymentId ?? crypto.randomUUID()),
    nodeId: String(item.nodeId ?? item.instanceId ?? ""),
    action: String(item.action ?? item.operation ?? "deploy"),
    status: String(item.status ?? "pending"),
    startedAt: toText(item.startedAt ?? item.createdAt),
    finishedAt: toText(item.finishedAt ?? item.updatedAt),
    buildVersion: toText(item.version ?? item.buildVersion),
    buildHash: toText(item.buildHash ?? item.hash),
    healthcheckProgress: toNumber(item.healthcheckProgress ?? item.progress),
    logLine: toText(item.logLine ?? item.message),
  };
}

function mapLog(item: JsonRecord): NodeLogEntry {
  return {
    id: String(item.id ?? crypto.randomUUID()),
    level: String(item.level ?? item.severity ?? "info"),
    service: String(item.service ?? "system"),
    message: String(item.message ?? item.error ?? "Sem mensagem"),
    timestamp: String(item.timestamp ?? item.createdAt ?? new Date().toISOString()),
  };
}

function mapDiagnostic(item: JsonRecord): NodeDiagnosticsCheck {
  return {
    key: String(item.key ?? item.endpoint ?? crypto.randomUUID()),
    label: String(item.label ?? item.name ?? item.endpoint ?? "check"),
    ok: Boolean(item.ok ?? item.success),
    latencyMs: toNumber(item.latencyMs ?? item.latency),
    statusCode: toNumber(item.statusCode ?? item.status),
    details: toText(item.details ?? item.error),
  };
}

export async function loadNodeDetails(nodeId: string): Promise<NodeDetailsBundle> {
  const [nodesPayload, metricsPayload, deploymentsPayload, logsPayload, runtimePayload, sessionsPayload] =
    await Promise.all([
      requestJson("/api/cluster/nodes", "GET").catch(() => []),
      requestJson("/api/cluster/metrics", "GET").catch(() => []),
      requestJson("/api/cluster/deployments", "GET").catch(() => []),
      requestJson("/api/system/error-log", "GET").catch(() => []),
      requestJson("/api/system/runtime/status", "GET").catch(() => ({})),
      requestJson("/api/session-status", "GET").catch(() => []),
    ]);

  const node = toList(nodesPayload).map(mapNode).find((candidate) => candidate.id === nodeId) ?? null;

  const metricsSeries = toList(metricsPayload).map((item) => mapMetricsSnapshot(item));
  const containers: NodeContainerInfo[] = [];
  const sessions = toList(sessionsPayload)
    .filter((item) => {
      const candidateNodeId = String(item.nodeId ?? item.instanceId ?? item.node_id ?? "").trim();
      return candidateNodeId === "" || candidateNodeId === nodeId;
    })
    .map(mapSessionRouting);
  const deployments = toList(deploymentsPayload).map(mapDeployment).filter((deploy) => deploy.nodeId === nodeId || deploy.nodeId === "");
  const logs = toList(logsPayload).map(mapLog);
  const runtime = (runtimePayload && typeof runtimePayload === "object" ? runtimePayload : {}) as Record<string, unknown>;
  const websocket = {
    status: runtime.status ?? runtime.runtime ?? "unknown",
    source: "runtime-status",
  } as Record<string, unknown>;
  const diagnostics: NodeDiagnosticsCheck[] = [];

  return { node, metricsSeries, containers, sessions, deployments, logs, runtime, websocket, diagnostics };
}

export async function runDeployAction(nodeId: string, action: DeployAction) {
  void nodeId;
  void action;
  throw new Error("Ação remota indisponível neste backend");
}

export async function moveSessionToNode(sessionId: string, targetNodeId: string) {
  void sessionId;
  void targetNodeId;
  throw new Error("Roteamento de sessão indisponível neste backend");
}
