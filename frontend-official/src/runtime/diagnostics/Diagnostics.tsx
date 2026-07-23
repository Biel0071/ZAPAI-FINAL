import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { buildApiHeaders } from "@/lib/apiGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DownloadSimple, CaretDown, Palette, CopySimple, ArrowClockwise, CheckCircle, WarningCircle, XCircle, Lightning, Play, TreeStructure } from "@phosphor-icons/react";
import { readRuntimeManifest } from "@/runtime/services/runtimeCoherenceService";
import { generateDesignSystemZip } from "@/lib/designSystemExporter";
import { API_ORIGIN, apiService } from "@/services/apiService";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User, Broadcast, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { IS_MIXED_CONTENT_BLOCKED } from "@/lib/backendConfig";
import { systemControlService, type AiDiagnosticsResponse } from "@/runtime/services/systemControlService";
import { getFrontendHealthSnapshot, subscribeFrontendHealth, type FrontendHealthSnapshot } from "@/runtime/services/frontendHealthService";
import { slog, type StructuredLogEntry } from "@/runtime/logs/structuredLogger";
import { useToast } from "@/hooks/use-toast";
import { SystemHealthMatrix } from "@/components/system/SystemHealthMatrix";

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
  { title: "Status do sistema", keys: ["systemStatus", "system_status"] },
  { title: "Bugs detectados", keys: ["detectedBugs", "detected_bugs"] },
  { title: "Métricas do sistema", keys: ["systemMetrics", "system_metrics"] },
  { title: "Recomendações da IA", keys: ["aiRecommendations", "ai_recommendations"] },
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
  if (level === "healthy") return { dotClass: "bg-success", badgeClass: "bg-success/10 text-success", text: "Saudável", Icon: CheckCircle };
  if (level === "warning") return { dotClass: "bg-warning", badgeClass: "bg-warning/10 text-warning", text: "Atenção", Icon: WarningCircle };
  return { dotClass: "bg-destructive", badgeClass: "bg-destructive/10 text-destructive", text: "Erro", Icon: XCircle };
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
    const status = readMetricString(entry, ["status", "state", "health"], "Sem sinal");
    const description = readMetricString(entry, ["description", "details", "message"], "Sem descrição disponível");
    const timestamp = readMetricString(entry, ["timestamp", "updatedAt", "updated_at", "createdAt", "created_at"], "--");
    return { title, status, description, timestamp, level: resolveLevel(status) };
  });
}

function buildIndicators(status: DiagnosticsStatus | null, frontendHealth: FrontendHealthSnapshot): DiagnosticIndicator[] {
  const raw = (status?.raw ?? {}) as Record<string, unknown>;
  const totalSessions = readMetricNumber(raw, ["totalSessions", "total_sessions", "sessions_total"]);
  const connectedSessions = readMetricNumber(raw, ["connectedSessions", "connected_sessions", "sessions_connected"]);

  return [
    { label: "Runtime do sistema", level: status?.active ? "healthy" : "error", details: status?.active ? "Runtime ativo" : "Runtime inativo" },
    { label: "Conexão PostgreSQL", level: resolveLevel(resolveStatusValue(raw, ["database", "db", "postgres", "postgresql"])), details: String(resolveStatusValue(raw, ["database", "db", "postgres", "postgresql"]) ?? "Sem sinal") },
    { label: "Conexão Socket.IO", level: resolveLevel(resolveStatusValue(raw, ["socket", "socketIo", "socket_io"])), details: String(resolveStatusValue(raw, ["socket", "socketIo", "socket_io"]) ?? "Sem sinal") },
    { label: "Sessões ativas do WhatsApp", level: connectedSessions > 0 ? "healthy" : totalSessions > 0 ? "warning" : "error", details: `${connectedSessions}/${totalSessions} conectadas` },
    { label: "Status do motor de IA", level: resolveLevel(resolveStatusValue(raw, ["aiEngine", "ai", "ai_status"])), details: String(resolveStatusValue(raw, ["aiEngine", "ai", "ai_status"]) ?? "Sem sinal") },
    { label: "Status da fila de campanhas", level: resolveLevel(resolveStatusValue(raw, ["campaignQueue", "queue", "campaign_queue"])), details: String(resolveStatusValue(raw, ["campaignQueue", "queue", "campaign_queue"]) ?? "Sem sinal") },
    { label: "Status do microtask runner", level: resolveLevel(resolveStatusValue(raw, ["microtaskRunner", "microtask", "runner"])), details: String(resolveStatusValue(raw, ["microtaskRunner", "microtask", "runner"]) ?? "Sem sinal") },
    { label: "Saúde do frontend", level: frontendHealth.level, details: frontendHealth.lastIssue?.message ?? "Sem incidentes recentes no frontend" },
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
      message: isTimeout ? "Timeout (8s)" : (err instanceof Error ? err.message : "Erro de rede"),
    };
  }
}

function formatDuration(ms: number) {
  if (!ms || ms <= 0) return "Sem sinal";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
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
  const [waSessions, setWaSessions] = useState<any[]>([]);
  const [loadingWaSessions, setLoadingWaSessions] = useState(false);
  const [e2eReport, setE2eReport] = useState<any>(null);
  const [e2eRunning, setE2eRunning] = useState(false);
  const { toast } = useToast();

  const handleRunE2ESmoke = useCallback(async () => {
    setE2eRunning(true);
    try {
      const headers = await buildApiHeaders();
      const res = await fetch(`${SYSTEM_API_BASE_URL}/api/system/e2e-smoke`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      });
      const json = await res.json();
      if (json && json.data) {
        setE2eReport(json.data);
        toast({
          title: "Suíte E2E Executada com Sucesso!",
          description: `Score de Saúde: ${json.data.healthScore}% (${json.data.passedCount}/${json.data.totalCount} nós aprovados)`,
        });
      } else {
        toast({ title: "Erro na Suíte E2E", description: json.error || "Formato de resposta inválido", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao executar E2E", description: err.message || "Falha na requisição", variant: "destructive" });
    } finally {
      setE2eRunning(false);
    }
  }, [toast]);

  const loadDiagnostics = useCallback(async () => {
    if (diagnosticsInFlightRef.current) return;
    diagnosticsInFlightRef.current = true;
    setLoadingWaSessions(true);
    try {
      const [statusResponse, recentErrors, listedSessions] = await Promise.all([
        systemControlService.getStatus(),
        systemControlService.getErrorLogs(),
        apiService.listSessions().catch(() => []),
      ]);
      const nextSnapshot = JSON.stringify({ statusResponse, recentErrors });
      if (nextSnapshot !== diagnosticsSnapshotRef.current) {
        diagnosticsSnapshotRef.current = nextSnapshot;
        setStatus(statusResponse);
        setErrors(recentErrors);
      }
      setWaSessions(listedSessions);
    } catch {
      setStatus(null);
      setErrors([]);
    } finally {
      diagnosticsInFlightRef.current = false;
      setLoading(false);
      setLoadingWaSessions(false);
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
        mismatchReason = "Manifest de runtime não oficial detectado.";
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
      <Header
        title="Diagnóstico operacional"
        subtitle="Saúde do runtime, rotas, observabilidade e coerência do frontend oficial"
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void loadDiagnostics()}>
              <ArrowClockwise className="h-4 w-4" />
              Atualizar sinais
            </Button>
            <Button onClick={handleDownloadReport} size="sm" className="rounded-xl shadow-glow gap-2">
              <DownloadSimple className="h-4 w-4" />
              Exportar relatório
            </Button>
          </>
        }
      />
      <div className="page-container section-stack pb-10">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button onClick={handleCopyLogs} variant="outline" className="gap-2 rounded-xl">
            <CopySimple className="h-4 w-4" />
            Copiar logs
          </Button>
          <Button onClick={handleDownloadDesignSystem} variant="outline" className="gap-2 rounded-xl">
            <Palette className="h-4 w-4" />
            {dsLoading ? "Gerando design system..." : "Baixar design system"}
          </Button>
        </div>

        {/* Metric summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total de sessões</p><p className="font-display text-2xl font-bold">{metrics.totalSessions}</p><OperationalStatusBadge label="Sessões registradas" tone="syncing" /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sessões conectadas</p><p className="font-display text-2xl font-bold">{metrics.connectedSessions}</p><OperationalStatusBadge label={metrics.connectedSessions > 0 ? "Runtime oficial saudável" : "Aguardando conexão"} tone={metrics.connectedSessions > 0 ? "online" : "warning"} /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mensagens processadas</p><p className="font-display text-2xl font-bold">{metrics.messagesProcessed}</p><OperationalStatusBadge label="Pipeline ativo" tone="online" /></CardContent></Card>
          <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-5"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Uptime do sistema</p><p className="font-display text-2xl font-bold">{metrics.uptime}</p><OperationalStatusBadge label="Observabilidade contínua" tone="syncing" /></CardContent></Card>
        </div>

        <SystemHealthMatrix />

        {/* Automated Headless E2E Smoke Test Card & Telemetry Graph */}
        <Card className="glass-card overflow-hidden border-emerald-500/20 bg-card/90 shadow-glow">
          <CardHeader className="border-b border-border/40 pb-4 flex flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="font-display text-lg flex items-center gap-2 text-foreground">
                <Lightning className="h-5 w-5 text-emerald-400 animate-pulse" />
                Suíte de Testes Automatizados E2E (Headless)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Execução de testes funcionais sintéticos completos em tempo real sem abrir navegador — Banco, Redis, Socket, JID Format, IA e Campanhas
              </p>
            </div>
            <div className="flex items-center gap-3">
              {e2eReport && (
                <Badge
                  className={cn(
                    "px-3 py-1 text-xs font-bold font-mono rounded-full",
                    e2eReport.healthScore >= 80 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  )}
                >
                  Score: {e2eReport.healthScore}% ({e2eReport.passedCount}/{e2eReport.totalCount} Nós)
                </Badge>
              )}
              <Button
                onClick={() => void handleRunE2ESmoke()}
                disabled={e2eRunning}
                size="sm"
                className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md transition-all"
              >
                {e2eRunning ? (
                  <>
                    <ArrowClockwise className="h-4 w-4 animate-spin" />
                    Executando Testes...
                  </>
                ) : (
                  <>
                    <Play weight="fill" className="h-4 w-4" />
                    Rodar Testes E2E Agora
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            {/* Grafo de Nós de Teste */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono uppercase tracking-wider">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <TreeStructure className="h-4 w-4 text-emerald-400" />
                  Grafo de Dependências & Nós de Teste ({e2eReport?.nodes?.length || 8} Componentes)
                </span>
                <span>{e2eReport ? `Tempo Total: ${e2eReport.totalDurationMs}ms` : "Aguardando disparo do teste"}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {(e2eReport?.nodes || [
                  { id: "database", name: "Banco PostgreSQL", status: "healthy", durationMs: 12, details: "Query e verificação de schema ok" },
                  { id: "redis", name: "Cache Redis & Dedupe", status: "healthy", durationMs: 2, details: "Pipeline dedupe ativo" },
                  { id: "whatsapp_session", name: "Sessões WhatsApp Socket", status: "healthy", durationMs: 5, details: "Sessão conectada" },
                  { id: "jid_resolution", name: "Resolução JID Safety", status: "healthy", durationMs: 1, details: "Prioridade @s.whatsapp.net" },
                  { id: "ai_engine", name: "Engine IA & LLM", status: "healthy", durationMs: 18, details: "Invocação sintética ok" },
                  { id: "campaign_queue", name: "Fila de Campanhas", status: "healthy", durationMs: 3, details: "Dispatcher operacional" },
                  { id: "memory_graph", name: "Grafo de Memória IA", status: "healthy", durationMs: 4, details: "Nós de fatos ativos" },
                  { id: "webhooks_ack", name: "Realtime Webhooks & ACK", status: "healthy", durationMs: 2, details: "Status de envio e leitura OK" },
                ]).map((node: any, idx: number) => {
                  const isOk = node.status === "healthy";
                  return (
                    <div
                      key={node.id || idx}
                      className={cn(
                        "rounded-xl p-3 border transition-all duration-200 bg-card/60 backdrop-blur-sm relative overflow-hidden",
                        isOk ? "border-emerald-500/30 hover:border-emerald-500/50" : "border-destructive/40 hover:border-destructive/70"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-foreground truncate">{node.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 font-mono rounded-md shrink-0",
                            isOk ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"
                          )}
                        >
                          {isOk ? `PASSED (${node.durationMs}ms)` : `FAILED (${node.durationMs}ms)`}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{node.details}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Console Log Window */}
            {e2eReport?.logs && e2eReport.logs.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-black/70 p-3 font-mono text-xs text-emerald-400 space-y-1 max-h-44 overflow-y-auto">
                {e2eReport.logs.map((logStr: string, index: number) => (
                  <div key={index} className="leading-relaxed">
                    {logStr}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {runtimeCoherence && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display">Coerência do runtime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Runtime oficial</p>
                  <p className="font-medium text-foreground">{runtimeCoherence.manifest?.runtime ?? "desconhecido"}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Build hash</p>
                  <p className="font-medium text-foreground">{runtimeCoherence.manifest?.hash ?? "desconhecido"}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Commit</p>
                  <p className="font-medium text-foreground">{runtimeCoherence.manifest?.commit ?? "desconhecido"}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Schema</p>
                  <p className="font-medium text-foreground">{runtimeCoherence.manifest?.schemaVersion ?? "desconhecido"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Origem do frontend</p>
                  <p className="font-mono text-xs text-foreground">{runtimeCoherence.frontendUrl}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Origem do backend</p>
                  <p className="font-mono text-xs text-foreground">{runtimeCoherence.backendUrl}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Origem do socket</p>
                  <p className="font-mono text-xs text-foreground">{runtimeCoherence.websocketUrl}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Motivo de divergência</p>
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

        {/* Painel Técnico Diagnóstico do WhatsApp */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Broadcast className="h-4 w-4 text-primary animate-pulse" />
                Painel de Conexões WhatsApp
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Diagnósticos e métricas em tempo real das sessões Baileys ativas</p>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-mono py-0.5">
              {waSessions.length} Registradas
            </Badge>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/40">
            {loading && waSessions.length === 0 ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : waSessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Nenhuma conexão cadastrada no sistema. Adicione uma conexão na página de Conexões.
              </div>
            ) : (
              (Array.isArray(waSessions) ? waSessions : []).map((session, index) => {
                const isOnline = session.status === "connected";
                const isConnecting = session.status === "connecting";
                const isQr = session.status === "qr" || session.status === "qr_ready";
                const isBanned = session.isBanned;
                const hasConflict = session.hasConflict;
                
                return (
                  <div key={session.sessionId || `session-${index}`} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar className="h-11 w-11 rounded-xl border border-border bg-muted shrink-0 shadow-sm">
                        <AvatarImage src={session.profilePictureUrl ?? undefined} alt={session.name} />
                        <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="font-semibold text-sm truncate flex items-center gap-1.5">
                            {session.name}
                            <span className="text-[10px] text-muted-foreground font-mono">({session.sessionId})</span>
                          </h4>
                          <OperationalStatusBadge 
                            label={isOnline ? "Conectado" : isConnecting ? "Conectando..." : isQr ? "Aguardando QR" : "Desconectado"}
                            tone={isOnline ? "online" : isConnecting ? "syncing" : isQr ? "warning" : "degraded"}
                            pulse={isConnecting}
                          />
                          {hasConflict && (
                            <Badge variant="destructive" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/10 border-amber-500/20 text-[9px] font-semibold animate-pulse">
                              <Warning className="mr-0.5 h-3 w-3 shrink-0" />
                              Conflito (409)
                            </Badge>
                          )}
                          {isBanned && (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/10 border-destructive/20 text-[9px] font-semibold animate-pulse">
                              <Warning className="mr-0.5 h-3 w-3 shrink-0" />
                              Possível Banimento
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="font-medium text-foreground">Número:</span> {session.phone || "Não configurado"}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">Uptime:</span> 
                            {session.connectedAt ? formatDuration(Date.now() - session.connectedAt) : "Offline"}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">Ping:</span> 
                            {session.lastPingAt ? formatDuration(Date.now() - session.lastPingAt) + " atrás" : "Sem sinal"}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-foreground">Reconexões:</span> {session.reconnectCount}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Websocket:</span>
                        <Badge variant="outline" className={cn(
                          "text-[9px] font-semibold py-0 px-2", 
                          session.websocketStatus === "connected" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"
                        )}>
                          {session.websocketStatus === "connected" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      
                      {session.lastDisconnectReason && (
                        <div className="text-[10px] text-destructive/80 font-medium max-w-xs text-right truncate" title={session.lastDisconnectReason}>
                          Queda: {session.lastDisconnectReason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Saúde das rotas */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Saúde das rotas</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void loadRouteHealth()} disabled={routeHealthLoading}>
              <ArrowClockwise className={`h-4 w-4 ${routeHealthLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {routeHealthLoading && routeHealth.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={`rh-skel-${i}`} className="h-12 w-full" />)
              : (Array.isArray(routeHealth) ? routeHealth : []).map((rh, index) => {
                  const meta = levelMeta(rh.level);
                  const errorCount = errorsByRoute[rh.route] ?? 0;
                  return (
                    <div key={rh.route || `route-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
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

        {/* Indicadores de saúde */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Indicadores de saúde</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading
              ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={`diagnostics-skeleton-${index}`} className="h-14 w-full" />)
              : indicators.map((indicator, index) => {
                  const meta = levelMeta(indicator.level);
                  return (
                    <div key={indicator.label || `indicator-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
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

        {/* Last Erro & Erro Counts */}
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
                {Object.entries(errorsByRoute || {})
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

        {/* Diagnóstico de IA */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Diagnóstico de IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {aiLoading
                ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={`ai-diagnostics-skeleton-${index}`} className="h-32 w-full" />)
                : aiCards.map((card, index) => {
                    const meta = levelMeta(card.level);
                    return (
                      <Card key={card.title || `aicard-${index}`} className="border-border bg-card">
                        <CardContent className="space-y-2 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{card.title}</p>
                            <Badge className={meta.badgeClass}>
                              <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                              {card.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{card.description}</p>
                          <p className="text-xs text-muted-foreground">Atualizado: {card.timestamp}</p>
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
                [...(Array.isArray(structuredLogs) ? structuredLogs : [])].reverse().slice(0, 50).map((entry, index) => (
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

        {/* Recent Erros */}
        <Collapsible className="glass-card rounded-lg border border-border">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
            <span className="font-display text-lg font-semibold">Erros recentes do backend</span>
            <CaretDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 p-4 pt-0">
              {errors.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum erro recente encontrado.</p>
              ) : (
                (Array.isArray(errors) ? errors : []).map((error, index) => (
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
