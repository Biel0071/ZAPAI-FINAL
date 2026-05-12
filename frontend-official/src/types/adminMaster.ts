export type BackendHealthStatus = "online" | "offline" | "unknown";

export type AdminAccessState = "loading" | "granted" | "denied" | "unknown";

export type MetricValue = number | string | null;

export type AdminMetric = {
  key: string;
  label: string;
  value: MetricValue;
  helper?: string;
  status?: BackendHealthStatus;
};

export type AdminUserRow = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  plan: string | null;
  status: string | null;
  dueDate: string | null;
  whatsappLimit: number | null;
  usedSessions: number | null;
  lastLogin: string | null;
};

export type AdminWhatsAppRow = {
  id: string;
  user: string | null;
  number: string | null;
  status: string;
  messagesToday: number | null;
  lastActivity: string | null;
};

export type InstanceStatus = "online" | "offline" | "unknown";

export type AdminInstanceRow = {
  id: string;
  client: string | null;
  name: string;
  ip: string | null;
  domain: string | null;
  version: string | null;
  status: InstanceStatus;
  uptime: string | null;
  cpu: string | null;
  ram: string | null;
  disk: string | null;
  whatsappSessions: number | null;
  whatsappConnected: boolean | null;
  lastHeartbeat: string | null;
  heartbeatLatencyMs: number | null;
};

export type AdminGlobalOverview = {
  totalNodes: number | null;
  nodesOnline: number | null;
  revenue: number | null;
  failures: number | null;
  alerts: number | null;
};

export type InfrastructureSnapshot = {
  ip: string | null;
  domain: string | null;
  ssl: string | null;
  pm2: string | null;
  postgres: string | null;
  docker: string | null;
  queue: string | null;
  cpu: string | null;
  ram: string | null;
  disk: string | null;
  uptime: string | null;
};

export type ImpersonationState = {
  active: boolean;
  userName: string | null;
  userId: string | null;
};

export type MasterApiEndpointDiagnostic = {
  endpoint: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
  checkedAt: string;
};

export type NodeHeartbeatDiagnostic = {
  nodeId: string;
  nodeName: string;
  status: InstanceStatus;
  latencyMs: number | null;
  lastHeartbeat: string | null;
};

export type AdminMasterSnapshot = {
  metrics: AdminMetric[];
  users: AdminUserRow[];
  whatsapp: AdminWhatsAppRow[];
  instances: AdminInstanceRow[];
  nodeHeartbeats: NodeHeartbeatDiagnostic[];
  global: AdminGlobalOverview;
  infrastructure: InfrastructureSnapshot;
  backendStatus: BackendHealthStatus;
  databaseStatus: BackendHealthStatus;
  endpointDiagnostics: MasterApiEndpointDiagnostic[];
  loading: boolean;
  offline: boolean;
  access: AdminAccessState;
  integrationsPending: string[];
  impersonation: ImpersonationState;
};
