import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { buildApiHeaders } from "@/lib/apiGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DownloadSimple, CaretDown, Palette, CopySimple, ArrowClockwise, CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react";
import { readRuntimeManifest, type RuntimeCoherenceSnapshot } from "@/services/runtimeCoherenceService";
import { generateDesignSystemZip } from "@/lib/designSystemExporter";
import { API_ORIGIN } from "@/services/apiService";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { IS_MIXED_CONTENT_BLOCKED } from "@/lib/backendConfig";
import { systemControlService, type AiDiagnosticsResponse } from "@/services/systemControlService";
import { getFrontendHealthSnapshot, subscribeFrontendHealth, type FrontendHealthSnapshot } from "@/services/frontendHealthService";
import { slog, type StructuredLogEntry } from "@/lib/structuredLogger";
import { useToast } from "@/hooks/use-toast";

const SYSTEM_API_BASE_URL = API_ORIGIN;

type HealthLevel = "healthy" | "warning" | "error";

type DiagnosticIndicator = {
  label: string;
  level: HealthLevel;
  details: string;
};

type SystemErrorLog = {
  timestamp: string;
  service: string;
  message: string;
};

type AiDiagnosticCard = {
  title: string;
  status: string;
  description: string;
  timestamp: string;
  level: HealthLevel;
};

type DiagnosticsStatus = Awaited<ReturnType<typeof systemControlService.getStatus>>;

type RouteHealthResult = {
  route: string;
  status: number | "timeout" | "error";
  responseTime: number;
  level: HealthLevel;
  message: string;
};

type RuntimeCoherenceCard = {
  manifest: ReturnType<typeof readRuntimeManifest>;
  backendUrl: string;
  frontendUrl: string;
  websocketUrl: string;
  mismatchReason: string | null;
};

const AI_DIAGNOSTIC_DEFINITIONS = [
  { title: "System Status", keys: ["systemStatus", "system_status"] },
  { title: "Detected Bugs", keys: ["detectedBugs", "detected_bugs"] },
  { title: "System Metrics", keys: ["systemMetrics", "system_metrics"] },
  { title: "AI Recommendations", keys: ["aiRecommendations", "ai_recommendations"] },
] as const;

const ROUTE_HEALTH_ENDPOINTS = [
  "/api/health",
  "/api/session-status",
  "/api/conversations",
  "/api/contacts",
];

function resolveLevel(status?: string | boolean | null): HealthLevel {
  if (typeof status === "boolean") return status ? "healthy" : "error";
  const normalized = String(status ?? "").toLowerCase();
  if (["healthy", "ok", "connected", "online", "active", "running", "ready"].includes(normalized)) return "healthy";
  if (["warning", "degraded", "slow", "pending", "connecting"].includes(normalized)) return "warning";
  return "error";
}

function levelMeta(level: HealthLevel) {
  if (level === "healthy") return { dotClass: "bg-success", badgeClass: "bg-success/10 text-success", text: "Healthy", Icon: CheckCircle };
  if (level === "warning") return { dotClass: "bg-warning", badgeClass: "bg-warning/10 text-warning", text: "Warning", Icon: WarningCircle };
  return { dotClass: "bg-destructive", badgeClass: "bg-destructive/10 text-destructive", text: "Error", Icon: XCircle };
}

function readMetricNumber(source: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

function readMetricString(source: Record<string, unknown>, keys: string[], fallback = "--"): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function resolveStatusValue(raw: Record<string, unknown>, keys: string[]): string | boolean | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" || typeof value === "boolean") return value;
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      if (typeof nested.status === "string" || typeof nested.status === "boolean") return nested.status as string | boolean;
      if (typeof nested.connected === "boolean") return nested.connected;
      if (typeof nested.active === "boolean") return nested.active;
    }
  }
  return null;
}

function readAiEntry(raw: AiDiagnosticsResponse | null, keys: readonly string[]): Record<string, unknown> {
  if (!raw) return {};
  for (const key of keys) {
    const candidate = raw[key];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }
  return {};
}

function buildAiDiagnosticCards(raw: AiDiagnosticsResponse | null): AiDiagnosticCard[] {
  return AI_DIAGNOSTIC_DEFINITIONS.map(({ title, keys }) => {
    const entry = readAiEntry(raw, keys);
    const status = readMetricString(entry, ["status", "state", "health"], "No signal");
    const description = readMetricString(entry, ["description", "details", "message"], "No description available");
    const timestamp = readMetricString(entry, ["timestamp", "updatedAt", "updated_at", "createdAt", "created_at"], "--");
    return { title, status, description, timestamp, level: resolveLevel(status) };
  });
}

function buildIndicators(status: DiagnosticsStatus | null, frontendHealth: FrontendHealthSnapshot): DiagnosticIndicator[] {
  const raw = (status?.raw ?? {}) as Record<string, unknown>;
  const totalSessions = readMetricNumber(raw, ["totalSessions", "total_sessions", "sessions_total"]);
  const connectedSessions = readMetricNumber(raw, ["connectedSessions", "connected_sessions", "sessions_connected"]);

  return [
    { label: "System Runtime", level: status?.active ? "healthy" : "error", details: status?.active ? "Runtime active" : "Runtime inactive" },
    { label: "PostgreSQL connection", level: resolveLevel(resolveStatusValue(raw, ["database", "db", "postgres", "postgresql"])), details: String(resolveStatusValue(raw, ["database", "db", "postgres", "postgresql"]) ?? "No signal") },
    { label: "Socket.IO connection", level: resolveLevel(resolveStatusValue(raw, ["socket", "socketIo", "socket_io"])), details: String(resolveStatusValue(raw, ["socket", "socketIo", "socket_io"]) ?? "No signal") },
    { label: "Active WhatsApp sessions", level: connectedSessions > 0 ? "healthy" : totalSessions > 0 ? "warning" : "error", details: `${connectedSessions}/${totalSessions} connected` },
    { label: "AI engine status", level: resolveLevel(resolveStatusValue(raw, ["aiEngine", "ai", "ai_status"])), details: String(resolveStatusValue(raw, ["aiEngine", "ai", "ai_status"]) ?? "No signal") },
    { label: "Campaign queue status", level: resolveLevel(resolveStatusValue(raw, ["campaignQueue", "queue", "campaign_queue"])), details: String(resolveStatusValue(raw, ["campaignQueue", "queue", "campaign_queue"]) ?? "No signal") },
    { label: "Microtask runner status", level: resolveLevel(resolveStatusValue(raw, ["microtaskRunner", "microtask", "runner"])), details: String(resolveStatusValue(raw, ["microtaskRunner", "microtask", "runner"]) ?? "No signal") },
    { label: "Frontend health", level: frontendHealth.level, details: frontendHealth.lastIssue?.message ?? "No recent frontend issues" },
  ];
}

async function checkRouteHealth(route: string): Promise<RouteHealthResult> {
  if (!SYSTEM_API_BASE_URL || IS_MIXED_CONTENT_BLOCKED) {
    return {
      route,
      status: "error",
      responseTime: 0,
      level: "warning",
      message: "API origin indisponível no ambiente atual",
    };
  }

  const url = route.startsWith("/api/") ? `${SYSTEM_API_BASE_URL}${route}` : `${SYSTEM_API_BASE_URL}/api${route}`;
  const start = performance.now();
  try {
    const headers = await buildApiHeaders();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      method: "GET",
      headers: Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== "content-type")),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const responseTime = Math.round(performance.now() - start);
    const level: HealthLevel = response.ok ? "healthy" : response.status < 500 ? "warning" : "error";
    return { route, status: response.status, responseTime, level, message: response.ok ? "OK" : `HTTP ${response.status}` };
  } catch (err) {
    const responseTime = Math.round(performance.now() - start);
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    return {
      route,
      status: isTimeout ? "timeout" : "error",
      responseTime,
      level: "error",
      message: isTimeout ? "Timeout (8s)" : (err instanceof Error ? err.message : "Network error"),
    };
  }
}

const Diagnostics = memo(function Diagnostics() {
  const [status, setStatus] = useState<DiagnosticsStatus | null>(null);
  const [errors, setErrors] = useState<SystemErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [frontendHealth, setFrontendHealth] = useState<FrontendHealthSnapshot>(getFrontendHealthSnapshot);
  const [aiDiagnostics, setAiDiagnostics] = useState<AiDiagnosticsResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [dsLoading, setDsLoading] = useState(false);
  const [routeHealth, setRouteHealth] = useState<RouteHealthResult[]>([]);
  const [routeHealthLoading, setRouteHealthLoading] = useState(true);
  const [runtimeCoherence, setRuntimeCoherence] = useState<RuntimeCoherenceCard | null>(null);
  const [structuredLogs, setStructuredLogs] = useState<StructuredLogEntry[]>(slog.getLogs);
  const [errorsByRoute, setErrorsByRoute] = useState<Record<string, number>>({});
  const diagnosticsSnapshotRef = useRef("");
  const aiDiagnosticsSnapshotRef = useRef("");
  const diagnosticsInFlightRef = useRef(false);
  const aiDiagnosticsInFlightRef = useRef(false);
  const routeHealthInFlightRef = useRef(false);
  const runtimeCoherenceInFlightRef = useRef(false);
  const { toast } = useToast();

  const loadDiagnostics = useCallback(async () => {
    if (diagnosticsInFlightRef.current) return;
    diagnosticsInFlightRef.current = true;
    try {
      const [statusResponse, recentErrors] = await Promise.all([
        systemControlService.getStatus(),
        systemControlService.getErrorLogs(),
      ]);
      const nextSnapshot = JSON.stringify({ statusResponse, recentErrors });
      if (nextSnapshot !== diagnosticsSnapshotRef.current) {
        diagnosticsSnapshotRef.current = nextSnapshot;
        setStatus(statusResponse);
        setErrors(recentErrors);
      }
    } catch {
      setStatus(null);
      setErrors([]);
    } finally {
      diagnosticsInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const loadAiDiagnostics = useCallback(async () => {
    if (aiDiagnosticsInFlightRef.current) return;
    aiDiagnosticsInFlightRef.current = true;
    try {
      const aiResponse = await systemControlService.getAiDiagnostics();
      const nextSnapshot = JSON.stringify(aiResponse);
      if (nextSnapshot !== aiDiagnosticsSnapshotRef.current) {
        aiDiagnosticsSnapshotRef.current = nextSnapshot;
        setAiDiagnostics(aiResponse);
      }
    } catch {
      setAiDiagnostics(null);
    } finally {
      aiDiagnosticsInFlightRef.current = false;
      setAiLoading(false);
    }
  }, []);

  const loadRouteHealth = useCallback(async () => {
    if (routeHealthInFlightRef.current) return;
    routeHealthInFlightRef.current = true;
    setRouteHealthLoading(true);
    try {
      const results = await Promise.all(ROUTE_HEALTH_ENDPOINTS.map(checkRouteHealth));
      setRouteHealth(results);
    } finally {
      routeHealthInFlightRef.current = false;
      setRouteHealthLoading(false);
    }
  }, []);

  const loadRuntimeCoherence = useCallback(async () => {
    if (runtimeCoherenceInFlightRef.current) return;
    runtimeCoherenceInFlightRef.current = true;
    try {
      const coherence = await systemControlService.getRuntimeCoherence();
      const identity = (coherence.runtimeIdentity ?? {}) as Record<string, unknown>;
      const frontendUrl = String(identity.frontendUrl ?? "http://localhost:8080");
      const backendUrl = String(identity.backendUrl ?? API_ORIGIN ?? "http://127.0.0.1:4025");
      const websocketUrl = String(identity.websocketUrl ?? backendUrl);
      const manifest = readRuntimeManifest();
      let mismatchReason: string | null = null;

      if (manifest?.runtime !== "official") {
        mismatchReason = "Runtime manifest não oficial detectado.";
      } else if (manifest?.frontend !== "8080") {
        mismatchReason = "Porta de frontend divergente do runtime oficial.";
      } else if (manifest?.backend !== "4025") {
        mismatchReason = "Porta de backend divergente do runtime oficial.";
      }

      setRuntimeCoherence({
        manifest,
        backendUrl,
        frontendUrl,
        websocketUrl,
        mismatchReason,
      });
    } catch {
      setRuntimeCoherence(null);
    } finally {
      runtimeCoherenceInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeFrontendHealth(setFrontendHealth);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribeLogs = slog.subscribe(() => {
      setStructuredLogs(slog.getLogs());
      setErrorsByRoute(slog.getErrorsByRoute());
    });
    setErrorsByRoute(slog.getErrorsByRoute());
    return () => unsubscribeLogs();
  }, []);

  useEffect(() => {
    void loadDiagnostics();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadDiagnostics();
    }, 45_000);
    return () => window.clearInterval(intervalId);
  }, [loadDiagnostics]);

  useEffect(() => {
    void loadAiDiagnostics();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadAiDiagnostics();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadAiDiagnostics]);

  useEffect(() => {
    void loadRouteHealth();
    void loadRuntimeCoherence();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadRouteHealth();
      void loadRuntimeCoherence();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadRouteHealth, loadRuntimeCoherence]);

  const indicators = useMemo(() => buildIndicators(status, frontendHealth), [status, frontendHealth]);
  const aiCards = useMemo(() => buildAiDiagnosticCards(aiDiagnostics), [aiDiagnostics]);

  const metrics = useMemo(() => {
    const raw = (status?.raw ?? {}) as Record<string, unknown>;
    return {
      totalSessions: readMetricNumber(raw, ["totalSessions", "total_sessions", "sessions_total"]),
      connectedSessions: readMetricNumber(raw, ["connectedSessions", "connected_sessions", "sessions_connected"]),
      messagesProcessed: readMetricNumber(raw, ["messagesProcessed", "messages_processed", "processedMessages"]),
      uptime: readMetricString(raw, ["uptime", "systemUptime", "system_uptime"]),
    };
  }, [status]);

  const lastError = useMemo(() => slog.getLastError(), [structuredLogs]);

  const handleDownloadReport = useCallback(() => {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      status,
      frontendHealth,
      indicators,
      aiDiagnostics,
      metrics,
      recentErrors: errors,
      routeHealth,
      structuredLogs: structuredLogs.slice(-50),
      errorsByRoute,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `system-report-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [aiDiagnostics, errors, frontendHealth, indicators, metrics, status, routeHealth, structuredLogs, errorsByRoute]);

  const handleCopyLogs = useCallback(() => {
    const logText = structuredLogs
      .slice(-100)
      .map((entry) => `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.route ? `(${entry.route}) ` : ""}${entry.message}${entry.error ? ` — ${entry.error}` : ""}`)
      .join("\n");
    navigator.clipboard.writeText(logText).then(() => {
      toast({ title: "Logs copiados", description: "Os últimos 100 logs foram copiados para a área de transferência." });
    }).catch(() => {
      toast({ title: "Erro", description: "Não foi possível copiar os logs.", variant: "destructive" });
    });
  }, [structuredLogs, toast]);

  const handleDownloadDesignSystem = useCallback(async () => {
    setDsLoading(true);
    try {
      const blob = await generateDesignSystemZip();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `zapai-design-system-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen">
      <Header title="System Diagnostics" subtitle="Real-time infrastructure health for developers and admins" />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button onClick={handleCopyLogs} variant="outline" className="gap-2">
            <CopySimple className="h-4 w-4" />
            Copiar Logs
          </Button>
          <Button onClick={handleDownloadDesignSystem} variant="outline" className="gap-2">
            <Palette className="h-4 w-4" />
            {dsLoading ? "Generating..." : "Download Design System"}
          </Button>
          <Button onClick={handleDownloadReport} className="gap-2">
            <DownloadSimple className="h-4 w-4" />
            Download system report
          </Button>
        </div>

        {/* Metric summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total de sessões</p><p className="font-display text-2xl font-bold">{metrics.totalSessions}</p><OperationalStatusBadge label="Sessões registradas" tone="syncing" /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sessões conectadas</p><p className="font-display text-2xl font-bold">{metrics.connectedSessions}</p><OperationalStatusBadge label={metrics.connectedSessions > 0 ? "Runtime saudável" : "Aguardando conexão"} tone={metrics.connectedSessions > 0 ? "online" : "warning"} /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mensagens processadas</p><p className="font-display text-2xl font-bold">{metrics.messagesProcessed}</p><OperationalStatusBadge label="Pipeline ativo" tone="online" /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Uptime do sistema</p><p className="font-display text-2xl font-bold">{metrics.uptime}</p><OperationalStatusBadge label="Observabilidade contínua" tone="syncing" /></CardContent></Card>
        </div>

        {runtimeCoherence && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display">Runtime Coherence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Runtime</p>
                  <p className="font-medium text-foreground">{runtimeCoherence.manifest?.runtime ?? "unknown"}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Build hash</p>
                  <p className="font-medium text-foreground">{runtimeCoherence.manifest?.hash ?? "unknown"}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Commit</p>
                  <p className="font-medium text-foreground">{runtimeCoherence.manifest?.commit ?? "unknown"}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Schema</p>
                  <p className="font-medium text-foreground">{runtimeCoherence.manifest?.schemaVersion ?? "unknown"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Frontend origin</p>
                  <p className="font-mono text-xs text-foreground">{runtimeCoherence.frontendUrl}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Backend origin</p>
                  <p className="font-mono text-xs text-foreground">{runtimeCoherence.backendUrl}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Socket origin</p>
                  <p className="font-mono text-xs text-foreground">{runtimeCoherence.websocketUrl}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Mismatch reason</p>
                <div className="mt-2">
                  <OperationalStatusBadge
                    label={runtimeCoherence.mismatchReason ?? "Nenhuma divergência detectada com o runtime oficial"}
                    tone={runtimeCoherence.mismatchReason ? "warning" : "online"}
                    pulse={Boolean(runtimeCoherence.mismatchReason)}
                    className="max-w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Route Health Checks */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Route Health Check</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void loadRouteHealth()} disabled={routeHealthLoading}>
              <ArrowClockwise className={`h-4 w-4 ${routeHealthLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {routeHealthLoading && routeHealth.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={`rh-skel-${i}`} className="h-12 w-full" />)
              : routeHealth.map((rh) => {
                  const meta = levelMeta(rh.level);
                  const errorCount = errorsByRoute[rh.route] ?? 0;
                  return (
                    <div key={rh.route} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-medium">{rh.route}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {rh.message} • {rh.responseTime}ms
                          {errorCount > 0 && <span className="ml-2 text-destructive">({errorCount} erros recentes)</span>}
                        </p>
                      </div>
                      <Badge className={meta.badgeClass}>
                        <meta.Icon className="mr-1 h-3.5 w-3.5" />
                        {typeof rh.status === "number" ? rh.status : rh.status}
                      </Badge>
                    </div>
                  );
                })}
          </CardContent>
        </Card>

        {/* Health Indicators */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Health Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading
              ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={`diagnostics-skeleton-${index}`} className="h-14 w-full" />)
              : indicators.map((indicator) => {
                  const meta = levelMeta(indicator.level);
                  return (
                    <div key={indicator.label} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="min-w-0">
                        <p className="font-medium">{indicator.label}</p>
                        <p className="truncate text-sm text-muted-foreground">{indicator.details}</p>
                      </div>
                      <Badge className={meta.badgeClass}>
                        <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                        {meta.text}
                      </Badge>
                    </div>
                  );
                })}
          </CardContent>
        </Card>

        {/* Last Error & Error Counts */}
        {lastError && (
          <Card className="border-destructive/30 glass-card">
            <CardHeader>
              <CardTitle className="font-display text-destructive">Última falha registrada</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm"><span className="font-medium">Rota:</span> {lastError.route ?? "N/A"}</p>
              <p className="text-sm"><span className="font-medium">Mensagem:</span> {lastError.message}</p>
              <p className="text-sm"><span className="font-medium">Erro:</span> {lastError.error ?? "N/A"}</p>
              {lastError.suggestion && <p className="text-sm text-warning"><span className="font-medium">Sugestão:</span> {lastError.suggestion}</p>}
              <p className="text-xs text-muted-foreground">{lastError.timestamp}</p>
            </CardContent>
          </Card>
        )}

        {Object.keys(errorsByRoute).length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display">Erros por Rota</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(errorsByRoute)
                  .sort(([, a], [, b]) => b - a)
                  .map(([route, count]) => (
                    <div key={route} className="flex items-center justify-between rounded-lg border border-border bg-card p-2">
                      <span className="font-mono text-sm">{route}</span>
                      <Badge variant="destructive">{count}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Diagnostics */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">AI Diagnostics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {aiLoading
                ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={`ai-diagnostics-skeleton-${index}`} className="h-32 w-full" />)
                : aiCards.map((card) => {
                    const meta = levelMeta(card.level);
                    return (
                      <Card key={card.title} className="border-border bg-card">
                        <CardContent className="space-y-2 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{card.title}</p>
                            <Badge className={meta.badgeClass}>
                              <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                              {card.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{card.description}</p>
                          <p className="text-xs text-muted-foreground">Updated: {card.timestamp}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
          </CardContent>
        </Card>

        {/* Structured Logs */}
        <Collapsible className="glass-card rounded-lg border border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
            <span className="font-display text-lg font-semibold">Structured Logs ({structuredLogs.length})</span>
            <CaretDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="max-h-96 space-y-2 overflow-y-auto p-4 pt-0">
              {structuredLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum log registrado.</p>
              ) : (
                [...structuredLogs].reverse().slice(0, 50).map((entry, index) => (
                  <div key={`log-${index}`} className="rounded-lg border border-border bg-card p-2 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.level === "error" ? "destructive" : entry.level === "warn" ? "secondary" : "default"} className="text-[10px] px-1.5 py-0">
                        {entry.level.toUpperCase()}
                      </Badge>
                      <span className="text-muted-foreground">[{entry.scope}]</span>
                      {entry.route && <span className="text-primary">{entry.route}</span>}
                      {entry.statusCode && <span className="text-muted-foreground">HTTP {entry.statusCode}</span>}
                    </div>
                    <p className="mt-1">{entry.message}</p>
                    {entry.error && <p className="text-destructive">{entry.error}</p>}
                    <p className="text-muted-foreground">{entry.timestamp}</p>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Recent Errors */}
        <Collapsible className="glass-card rounded-lg border border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
            <span className="font-display text-lg font-semibold">Recent Backend Errors</span>
            <CaretDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 p-4 pt-0">
              {errors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent errors found.</p>
              ) : (
                errors.map((error, index) => (
                  <div key={`${error.timestamp}-${index}`} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-xs text-muted-foreground">{error.timestamp}</p>
                    <p className="text-sm font-medium">{error.service}</p>
                    <p className="text-sm text-muted-foreground">{error.message}</p>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
});

export default Diagnostics;
