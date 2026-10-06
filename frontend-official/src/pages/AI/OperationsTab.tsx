import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Headphones,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Send,
  Database,
  Radio,
  Server,
  Cpu,
  Search,
  FileText,
  Filter,
  Check,
  AlertTriangle,
} from "lucide-react";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";
import { useAppStore } from "@/state/stores/appStore";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";

interface OperationsMetrics {
  totalConversations: number;
  openConversations: number;
  waitingConversations: number;
  closedConversations: number;
  avgResponseTimeSeconds: number | null;
  avgHandlingTimeMinutes: number | null;
  slaCompliancePercent: number | null;
  transfersToday: number | null;
  productivityIndex: number | null;
}

interface OperatorItem {
  id: string;
  name: string;
  role: string;
  status: string;
  activeChats: number;
  totalToday: number;
}

interface ProviderStatusItem {
  id: string;
  name: string;
  defaultModel: string;
  status: "operational" | "degraded" | "testing" | "error" | "unknown";
  latencyMs?: number;
  lastTested?: string;
}

interface LogEntry {
  id: string | number;
  level: "info" | "warn" | "error";
  message: string;
  source: string;
  timestamp: string;
  meta?: any;
}

const PROVIDERS_MONITOR: ProviderStatusItem[] = [
  { id: "openai", name: "OpenAI", defaultModel: "gpt-4o-mini", status: "unknown" },
  { id: "groq", name: "Groq (Llama 3.3)", defaultModel: "llama-3.3-70b-versatile", status: "unknown" },
  { id: "deepseek", name: "DeepSeek", defaultModel: "deepseek-chat", status: "unknown" },
  { id: "claude", name: "Anthropic Claude", defaultModel: "claude-3-5-haiku", status: "unknown" },
  { id: "gemini", name: "Google Gemini", defaultModel: "gemini-2.0-flash", status: "unknown" },
  { id: "ollama", name: "Ollama Local", defaultModel: "llama3.1", status: "unknown" },
];

export function OperationsTab() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const websocketHealth = useAppStore((state) => state.websocketHealth);
  const sessions = useAppStore((state) => state.sessions);

  // Sub-navigation: 'todos' | 'dashboard' | 'providers' | 'queue' | 'logs'
  const activeSub = searchParams.get("sub") || "todos";

  const setSubTab = (sub: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (sub === "todos") {
        next.delete("sub");
      } else {
        next.set("sub", sub);
      }
      return next;
    }, { replace: true });
  };

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OperationsMetrics | null>(null);

  const [operators, setOperators] = useState<OperatorItem[]>([]);

  // Providers Live Test state
  const [providersState, setProvidersState] = useState<ProviderStatusItem[]>(PROVIDERS_MONITOR);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // Audit Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all");

  // Fetch metrics
  const fetchOperationsData = useCallback(async () => {
    setLoading(true);
    try {
      const opsRes = await apiService.fetchOperationsMetrics().catch(() => null);

      const operations = opsRes?.data || opsRes;
      if (operations?.metrics) {
        setMetrics(operations.metrics);
        setOperators(operations.operators || []);
      } else {
        setMetrics(null);
        setOperators([]);
      }
    } catch (err) {
      console.error("[OperationsTab] Error fetching metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await requestApiEndpoint<any>("/api/logs?limit=50").catch(() => null);
      if (res?.logs && Array.isArray(res.logs)) {
        setLogs(res.logs);
      } else if (Array.isArray(res)) {
        setLogs(res);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("[OperationsTab] Error fetching logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void fetchOperationsData();
    void fetchAuditLogs();
    const interval = setInterval(fetchOperationsData, 20000);
    return () => clearInterval(interval);
  }, [fetchOperationsData, fetchAuditLogs]);

  // Ping test individual provider
  const handleTestProvider = async (prov: ProviderStatusItem) => {
    setTestingProviderId(prov.id);
    const start = Date.now();
    try {
      const res = await apiService.testAIMessage({
        message: "Ping de integridade operacional ZAI.",
        prompt: "Responda apenas: PONG",
        providerId: prov.id,
        model: prov.defaultModel,
      });

      const elapsed = Date.now() - start;
      const latency = res.result?.responseTimeMs ?? elapsed;
      const isSuccess = Boolean(res.result?.ok && res.result.response);

      setProvidersState((prev) =>
        prev.map((p) =>
          p.id === prov.id
            ? {
                ...p,
                status: isSuccess ? "operational" : "error",
                latencyMs: latency,
                lastTested: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              }
            : p
        )
      );

      toast({
        title: isSuccess ? `Provedor ${prov.name} OK` : `Falha em ${prov.name}`,
        description: isSuccess
          ? `Latência: ${latency}ms | Resposta recebida.`
          : res.result?.error || res.error || "Não foi possível validar o provedor.",
        variant: isSuccess ? "default" : "destructive",
      });
    } catch (err: any) {
      setProvidersState((prev) =>
        prev.map((p) => (p.id === prov.id ? { ...p, status: "error" } : p))
      );
      toast({
        title: `Erro ao testar ${prov.name}`,
        description: err?.message || "Timeout de conexão.",
        variant: "destructive",
      });
    } finally {
      setTestingProviderId(null);
    }
  };

  const activeSessionsCount = sessions.filter(
    (s: any) => s.status === "connected"
  ).length;

  const showAll = activeSub === "todos";
  const showDashboard = showAll || activeSub === "dashboard";
  const showProviders = showAll || activeSub === "providers";
  const showQueue = showAll || activeSub === "queue";
  const showLogs = showAll || activeSub === "logs";

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = logLevelFilter === "all" || log.level === logLevelFilter;
    const matchesSearch = logSearch
      ? log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.source.toLowerCase().includes(logSearch.toLowerCase())
      : true;
    return matchesLevel && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* SUB-NAVIGATION PILLS */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl border border-border/60 bg-muted/20">
        <button
          type="button"
          onClick={() => setSubTab("todos")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            activeSub === "todos"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Visão Geral
        </button>
        <button
          type="button"
          onClick={() => setSubTab("dashboard")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            activeSub === "dashboard"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span>Métricas Operacionais</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("providers")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            activeSub === "providers"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Cpu className="h-3.5 w-3.5 text-emerald-400" />
          <span>Status dos Provedores</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("queue")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            activeSub === "queue"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Send className="h-3.5 w-3.5 text-emerald-400" />
          <span>Fila de mensagens</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("logs")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            activeSub === "logs"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileText className="h-3.5 w-3.5 text-emerald-400" />
          <span>Auditoria & Logs</span>
        </button>
      </div>

      {/* SECTION 1: TOP OPERATIONAL METRICS */}
      {showDashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <Card className="bg-card border-border/70 p-4 space-y-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
              Fila de Espera
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black text-amber-400">
                {metrics?.waitingConversations ?? "—"}
              </span>
              <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[9px] uppercase font-bold">
                {metrics ? "Atualizado" : "Indisponível"}
              </Badge>
            </div>
          </Card>

          <Card className="bg-card border-border/70 p-4 space-y-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
              Conversas Abertas
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black text-emerald-400">
                {metrics?.openConversations ?? "—"}
              </span>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/70 p-4 space-y-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
              Conversas encerradas (total)
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black text-foreground">
                {metrics?.closedConversations ?? "—"}
              </span>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>

          <Card className="bg-card border-border/70 p-4 space-y-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
              Tempo Médio Resposta
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black text-cyan-400">
                {metrics?.avgResponseTimeSeconds == null ? "—" : `${metrics.avgResponseTimeSeconds}s`}
              </span>
              <Clock className="h-4 w-4 text-cyan-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/70 p-4 space-y-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
              Conformidade SLA
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black text-emerald-400">
                {metrics?.slaCompliancePercent == null ? "—" : `${Math.min(100, Math.max(0, metrics.slaCompliancePercent))}%`}
              </span>
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/70 p-4 space-y-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
              Produtividade
            </span>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black text-purple-400">
                {metrics?.productivityIndex == null ? "—" : `${Math.min(100, Math.max(0, metrics.productivityIndex))}%`}
              </span>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
          </Card>
        </div>
      )}

      {/* SECTION 2: CONNECTION NODES & SYSTEM HEALTH */}
      {showDashboard && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Activity className="h-5 w-5 text-emerald-400" /> Status dos Nós de Conexão & Processamento
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Conexões em tempo real e acesso aos diagnósticos do sistema.
                </CardDescription>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchOperationsData}
                disabled={loading}
                className="h-8 text-xs gap-1.5 self-start sm:self-auto border-border/70"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Atualizar Status
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              {/* Banco de Dados */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    PostgreSQL
                  </span>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-base font-black text-muted-foreground">—</p>
                <Link to="/settings?tab=diagnostics" className="text-[10px] text-emerald-400 block hover:underline">Consultar diagnóstico</Link>
              </div>

              {/* WebSocket Realtime */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Socket Realtime
                  </span>
                  <Radio className="h-4 w-4 text-emerald-400" />
                </div>
                <p className={cn("text-base font-black", websocketHealth === "online" ? "text-emerald-400" : "text-muted-foreground")}>
                  {websocketHealth === "online" ? "Operacional" : websocketHealth === "reconnecting" ? "Reconectando" : "Desconectado"}
                </p>
                <span className="text-[10px] text-muted-foreground block">Eventos de chat em tempo real</span>
              </div>

              {/* Conexões WhatsApp */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    WhatsApp (Baileys)
                  </span>
                  <Server className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-base font-black text-foreground">
                  {activeSessionsCount} / {sessions.length} ativas
                </p>
                <span className="text-[10px] text-muted-foreground block">Sessões sincronizadas</span>
              </div>

              {/* Sync Engine & Fila */}
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/10 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Fila de mensagens
                  </span>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-base font-black text-muted-foreground">—</p>
                <Link to="/settings?tab=queue" className="text-[10px] text-emerald-400 block hover:underline">Consultar fila</Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION: PROVIDER STATUS & LIVE PING */}
      {showProviders && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Cpu className="h-5 w-5 text-emerald-400" /> Status dos Provedores & Testes Ao Vivo
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Teste a resposta e o tempo de retorno dos provedores configurados.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {providersState.map((prov) => {
                const isTesting = testingProviderId === prov.id;
                return (
                  <div
                    key={prov.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-emerald-500/40 transition-all space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                          {prov.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{prov.name}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">{prov.defaultModel}</span>
                        </div>
                      </div>

                      <Badge
                        className={cn(
                          "text-[9px] uppercase font-bold",
                          prov.status === "operational"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : prov.status === "unknown" ? "bg-muted/40 text-muted-foreground border-border/60" : "bg-destructive/20 text-destructive border-destructive/40"
                        )}
                      >
                        {prov.status === "operational" ? "Operacional" : prov.status === "unknown" ? "Não testado" : "Erro"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/30 text-xs">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 text-cyan-400" />
                        Latência: <strong className="text-foreground font-mono">{prov.latencyMs === undefined ? "—" : `${prov.latencyMs}ms`}</strong>
                      </span>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestProvider(prov)}
                        disabled={isTesting}
                        className="h-7 text-[11px] px-2.5 border-border/70 gap-1 hover:border-emerald-500/50"
                      >
                        <RefreshCw className={cn("h-3 w-3", isTesting && "animate-spin text-emerald-400")} />
                        <span>{isTesting ? "Testando..." : "Testar Ping"}</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 3: OUTBOUND QUEUE */}
      {showQueue && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Send className="h-5 w-5 text-emerald-400" /> Fila de mensagens
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Consulte as mensagens pendentes, tentativas e falhas na fila de envio.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            <Button asChild size="sm" className="h-9 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5">
              <Link to="/settings?tab=queue"><Send className="h-3.5 w-3.5" />Abrir fila de mensagens</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* SECTION: AUDIT & AI LOGS */}
      {showLogs && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <FileText className="h-5 w-5 text-emerald-400" /> Auditoria & Logs Operacionais da IA
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Histórico de decisões, gatilhos acionados e eventos do pipeline.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="relative w-44 sm:w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Filtrar logs..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fetchAuditLogs}
                  disabled={loadingLogs}
                  className="h-8 text-xs gap-1.5 border-border/70"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingLogs && "animate-spin")} />
                  <span>Atualizar</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold mr-1">Nível:</span>
              {["all", "info", "warn", "error"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLogLevelFilter(lvl)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    logLevelFilter === lvl
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {lvl === "all" ? "Todos" : lvl}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loadingLogs ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                <span>Carregando registros de auditoria...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum log encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="divide-y divide-border/40 text-xs font-mono max-h-96 overflow-y-auto scrollbar-thin">
                {filteredLogs.map((log, idx) => (
                  <div key={log.id || idx} className="p-3 flex items-start justify-between gap-3 hover:bg-muted/20">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            "text-[9px] uppercase font-bold px-1.5 py-0",
                            log.level === "error"
                              ? "bg-destructive/20 text-destructive border-destructive/40"
                              : log.level === "warn"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          )}
                        >
                          {log.level}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          [{log.source || "system"}]
                        </span>
                      </div>
                      <p className="text-xs text-foreground font-sans leading-relaxed">{log.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 4: OPERATORS & ATTENDANTS TABLE */}
      {showDashboard && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Headphones className="h-5 w-5 text-emerald-400" /> Operadores & Atendentes em Carga
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Distribuição de conversas ativas e volume de atendimento por operador.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {operators.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Indicadores por operador indisponíveis nesta consulta.
              </div>
            ) : (
              <div className="divide-y divide-border/40 text-xs">
                {operators.map((op) => (
                  <div
                    key={op.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                        {op.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">{op.name}</p>
                        <span className="text-[10px] text-muted-foreground truncate block">{op.role}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/20">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          Chats Ativos
                        </span>
                        <span className="font-bold text-foreground">{op.activeChats} em andamento</span>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                          Total Hoje
                        </span>
                        <span className="font-bold text-emerald-400">{op.totalToday} atendimentos</span>
                      </div>

                      <Badge
                        className={cn(
                          "text-[10px] uppercase font-bold px-2 py-0.5 shrink-0",
                          op.status === "online"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-muted text-muted-foreground border-border/60"
                        )}
                      >
                        {op.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
