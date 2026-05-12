export type NodeLifecycleStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "DEPLOYING" | "RESTARTING" | "UNHEALTHY" | "RECOVERING";

export type NodeHealthState = "healthy" | "unhealthy" | "unknown";

export type RuntimeServiceState = "running" | "stopped" | "degraded" | "unknown";

export type NodeProvider = "aws" | "gcp" | "azure" | "digitalocean" | "hetzner" | "oracle" | "vultr" | "unknown";

export type NodeInfrastructureStatus = {
  docker: RuntimeServiceState;
  nginx: RuntimeServiceState;
  redis: RuntimeServiceState;
  postgres: RuntimeServiceState;
  websocket: RuntimeServiceState;
};

export type NodeBuildInfo = {
  version: string | null;
  buildHash: string | null;
};

export type NodeMetricsSnapshot = {
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  networkInKbps: number | null;
  networkOutKbps: number | null;
  dockerStats: number | null;
  queueSize: number | null;
  redisMemoryMb: number | null;
  activeSessions: number | null;
  qrGenerationCount: number | null;
  reconnectLoops: number | null;
  latencyMs: number | null;
  timestamp: string;
};

export type NodeContainerInfo = {
  id: string;
  name: string;
  status: string;
  image: string | null;
  cpuPercent: number | null;
  ramMb: number | null;
  restartedAt: string | null;
};

export type NodeSessionRouting = {
  sessionId: string;
  phone: string | null;
  nodeId: string;
  nodeName: string;
  status: string;
  failoverEnabled: boolean;
};

export type NodeDeploymentEvent = {
  id: string;
  nodeId: string;
  action: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  buildVersion: string | null;
  buildHash: string | null;
  healthcheckProgress: number | null;
  logLine: string | null;
};

export type NodeLogEntry = {
  id: string;
  level: string;
  service: string;
  message: string;
  timestamp: string;
};

export type NodeDiagnosticsCheck = {
  key: string;
  label: string;
  ok: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  details: string | null;
};

export type NodeControlPlane = {
  id: string;
  name: string;
  hostname: string | null;
  provider: NodeProvider;
  publicIp: string | null;
  uptime: string | null;
  status: NodeLifecycleStatus;
  health: NodeHealthState;
  infra: NodeInfrastructureStatus;
  whatsappSessions: number | null;
  latencyMs: number | null;
  lastSyncAt: string | null;
  build: NodeBuildInfo;
  metrics: NodeMetricsSnapshot | null;
};

export type ClusterOverview = {
  totalNodes: number;
  onlineNodes: number;
  totalSessions: number;
  totalMessages: number;
  queueSize: number;
  websocketConnections: number;
  unhealthyNodes: number;
  failedDeploys: number;
  redisUsageMb: number;
  postgresUsageMb: number;
};

export type NodeDetailsBundle = {
  node: NodeControlPlane | null;
  metricsSeries: NodeMetricsSnapshot[];
  containers: NodeContainerInfo[];
  sessions: NodeSessionRouting[];
  deployments: NodeDeploymentEvent[];
  logs: NodeLogEntry[];
  runtime: Record<string, unknown>;
  websocket: Record<string, unknown>;
  diagnostics: NodeDiagnosticsCheck[];
};
