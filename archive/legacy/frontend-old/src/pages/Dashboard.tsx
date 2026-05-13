import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChatCircleDots,
  WhatsappLogo,
  Users,
  Robot,
  ArrowUp,
  ArrowDown,
  CircleNotch,
  ShieldCheck,
  Warning,
  WarningCircle,
  FunnelSimple,
  ChartLineUp,
  Clock,
  MapPin,
  Lightning,
  CalendarBlank,
  Export,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiService, type MetricsSummary, type RuntimeHealthState, type SessionInfo } from "@/services/apiService";
import { systemControlService, type RuntimeUiState } from "@/services/systemControlService";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ─── Static data ─── */

const chartData = [
  { name: "00h", mensagens: 120, ia: 89 },
  { name: "04h", mensagens: 85, ia: 62 },
  { name: "08h", mensagens: 340, ia: 245 },
  { name: "12h", mensagens: 520, ia: 380 },
  { name: "16h", mensagens: 680, ia: 490 },
  { name: "20h", mensagens: 450, ia: 320 },
  { name: "23h", mensagens: 280, ia: 195 },
];

const performanceWeekData = [
  { name: "Seg", atendimentos: 245 },
  { name: "Ter", atendimentos: 312 },
  { name: "Qua", atendimentos: 287 },
  { name: "Qui", atendimentos: 356 },
  { name: "Sex", atendimentos: 398 },
  { name: "Sáb", atendimentos: 189 },
  { name: "Dom", atendimentos: 145 },
];

const campaignPerformanceData = [
  { name: "BF 2024", performance: 92 },
  { name: "Follow-up", performance: 78 },
  { name: "Lançamento", performance: 86 },
  { name: "Pesquisa", performance: 64 },
];

const heatmapData = [
  { day: "Seg", values: [2, 4, 6, 8, 5, 3] },
  { day: "Ter", values: [1, 3, 6, 7, 6, 4] },
  { day: "Qua", values: [2, 5, 7, 9, 7, 5] },
  { day: "Qui", values: [2, 4, 8, 9, 8, 4] },
  { day: "Sex", values: [3, 6, 9, 10, 9, 6] },
  { day: "Sáb", values: [1, 3, 5, 6, 5, 2] },
  { day: "Dom", values: [1, 2, 4, 5, 4, 2] },
];

const hourlyData = [
  { hour: "00h", count: 45 },
  { hour: "02h", count: 22 },
  { hour: "04h", count: 15 },
  { hour: "06h", count: 38 },
  { hour: "08h", count: 156 },
  { hour: "10h", count: 289 },
  { hour: "12h", count: 342 },
  { hour: "14h", count: 398 },
  { hour: "16h", count: 367 },
  { hour: "18h", count: 312 },
  { hour: "20h", count: 234 },
  { hour: "22h", count: 128 },
];

const channelData = [
  { name: "WhatsApp", value: 68, color: "hsl(142, 70%, 49%)" },
  { name: "IA Auto", value: 24, color: "hsl(199, 89%, 48%)" },
  { name: "Manual", value: 8, color: "hsl(38, 92%, 50%)" },
];

const aiPerformance = [
  { name: "Seg", acertos: 92 },
  { name: "Ter", acertos: 88 },
  { name: "Qua", acertos: 95 },
  { name: "Qui", acertos: 91 },
  { name: "Sex", acertos: 94 },
  { name: "Sáb", acertos: 89 },
  { name: "Dom", acertos: 86 },
];

const performanceKpis = [
  { metric: "Tempo Resposta", value: "1.2min", change: "-15%", trend: "up" as const },
  { metric: "Satisfação", value: "94%", change: "+3%", trend: "up" as const },
  { metric: "Resolução", value: "87%", change: "+5%", trend: "up" as const },
  { metric: "Abandono", value: "4.2%", change: "-2%", trend: "up" as const },
];

const overviewData = [
  { name: "Jan", mensagens: 4200, leads: 120 },
  { name: "Fev", mensagens: 5800, leads: 145 },
  { name: "Mar", mensagens: 6200, leads: 168 },
  { name: "Abr", mensagens: 7100, leads: 189 },
  { name: "Mai", mensagens: 8500, leads: 210 },
  { name: "Jun", mensagens: 9200, leads: 245 },
];

/* DDD Origin Map data */
const dddRegions = [
  { ddd: "11", region: "São Paulo - Capital", count: 1240, pct: 28 },
  { ddd: "21", region: "Rio de Janeiro", count: 680, pct: 15 },
  { ddd: "31", region: "Belo Horizonte", count: 420, pct: 9 },
  { ddd: "41", region: "Curitiba", count: 380, pct: 8 },
  { ddd: "51", region: "Porto Alegre", count: 340, pct: 7 },
  { ddd: "61", region: "Brasília", count: 310, pct: 7 },
  { ddd: "71", region: "Salvador", count: 280, pct: 6 },
  { ddd: "81", region: "Recife", count: 250, pct: 5 },
  { ddd: "85", region: "Fortaleza", count: 220, pct: 5 },
  { ddd: "19", region: "Campinas", count: 180, pct: 4 },
  { ddd: "47", region: "Joinville/Blumenau", count: 150, pct: 3 },
  { ddd: "62", region: "Goiânia", count: 120, pct: 3 },
];

const recentChats = [
  { id: 1, name: "Maria Silva", message: "Olá, gostaria de saber mais sobre...", time: "2min", unread: 3, avatar: "MS" },
  { id: 2, name: "João Santos", message: "Perfeito! Vou analisar a proposta", time: "5min", unread: 0, avatar: "JS" },
  { id: 3, name: "Ana Oliveira", message: "Podem me enviar o catálogo?", time: "12min", unread: 1, avatar: "AO" },
  { id: 4, name: "Carlos Ferreira", message: "Obrigado pelo atendimento!", time: "18min", unread: 0, avatar: "CF" },
];

/* ─── Helpers ─── */

const RUNTIME_RECONNECTED_EVENT = "runtime:reconnected";

type DashboardMetrics = {
  messagesSent: number;
  messagesReceived: number;
  activeChats: number;
  aiResponses: number;
  newLeads: number;
  responseTimeSeconds: number;
  tokensUsed: number;
};

const toNumber = (candidate: unknown): number => {
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
};

function mapMetricsPayload(payload: MetricsSummary): DashboardMetrics {
  const rawPayload = payload as MetricsSummary & Record<string, unknown>;
  return {
    messagesSent: toNumber(rawPayload.messagesSent ?? payload.messagesToday ?? payload.todayMessages ?? payload.totalMessages ?? payload.messages),
    messagesReceived: toNumber(rawPayload.messagesReceived ?? rawPayload.receivedMessages ?? rawPayload.inboundMessages),
    activeChats: toNumber(payload.activeChats ?? payload.chats),
    aiResponses: toNumber(payload.aiResponses ?? payload.ai ?? payload.botResponses),
    newLeads: toNumber(payload.newLeads ?? payload.leads),
    responseTimeSeconds: toNumber(rawPayload.responseTimeSeconds ?? rawPayload.averageResponseTimeSeconds ?? 102),
    tokensUsed: toNumber(rawPayload.tokensUsed ?? rawPayload.aiTokens ?? 58420),
  };
}

const baseMetrics = [
  { title: "Mensagens enviadas", key: "messagesSent" as const, fallback: "2.847", change: "+12.5%", trend: "up" as const, icon: ChatCircleDots, color: "primary" as const },
  { title: "Mensagens recebidas", key: "messagesReceived" as const, fallback: "3.211", change: "+9.8%", trend: "up" as const, icon: Users, color: "success" as const },
  { title: "Respostas IA", key: "aiResponses" as const, fallback: "1.203", change: "+8.4%", trend: "up" as const, icon: Robot, color: "info" as const },
  { title: "Tempo de resposta", key: "responseTimeSeconds" as const, fallback: "1m 42s", change: "-14.2%", trend: "up" as const, icon: Clock, color: "warning" as const },
  { title: "Tokens usados", key: "tokensUsed" as const, fallback: "58.420", change: "+6.1%", trend: "up" as const, icon: Robot, color: "warning" as const },
];

function metricColorClasses(color: "primary" | "success" | "info" | "warning") {
  if (color === "success") return { iconBox: "bg-success/10", icon: "text-success" };
  if (color === "info") return { iconBox: "bg-info/10", icon: "text-info" };
  if (color === "warning") return { iconBox: "bg-warning/10", icon: "text-warning" };
  return { iconBox: "bg-primary/10", icon: "text-primary" };
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

const formatMetricValue = (value: number | undefined, fallback: string) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("pt-BR") : fallback;

const dashboardTabs = new Set(["overview", "performance", "conversations", "ai", "schedule", "map"]);

/* ─── Component ─── */

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  const getTabFromSearchParams = useCallback((params: URLSearchParams) => {
    const tab = params.get("tab");
    return tab && dashboardTabs.has(tab) ? tab : "overview";
  }, []);

  const [runtimeState, setRuntimeState] = useState<RuntimeUiState>("offline");
  const [sessionState, setSessionState] = useState<RuntimeHealthState>("offline");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessions, setActiveSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [isSystemLoading, setIsSystemLoading] = useState(true);
  const [isSystemActionLoading, setIsSystemActionLoading] = useState(false);
  const [metricsSnapshot, setMetricsSnapshot] = useState<DashboardMetrics | null>(null);
  const [activeTab, setActiveTab] = useState(() => getTabFromSearchParams(searchParams));
  const isMountedRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const wasRuntimeRunningRef = useRef(false);

  useEffect(() => {
    const tabFromUrl = getTabFromSearchParams(searchParams);
    setActiveTab((prev) => (prev === tabFromUrl ? prev : tabFromUrl));
  }, [searchParams, getTabFromSearchParams]);

  const handleTabChange = useCallback((nextTab: string) => {
    const safeTab = dashboardTabs.has(nextTab) ? nextTab : "overview";
    setActiveTab(safeTab);

    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current);
      if (safeTab === "overview") {
        nextParams.delete("tab");
      } else {
        nextParams.set("tab", safeTab);
      }
      return nextParams;
    }, { replace: true });
  }, [setSearchParams]);

  const loadStatus = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;

    try {
      const [, healthStatusResult, listedSessionsResult, metricsResult] = await Promise.allSettled([
        systemControlService.getStatus(),
        apiService.getRuntimeSessionHealth(),
        apiService.listSessions(),
        apiService.getMetrics(),
      ]);

      if (!isMountedRef.current) {
        return;
      }

      const healthStatus =
        healthStatusResult.status === "fulfilled"
          ? healthStatusResult.value
          : ({ runtime: "offline", sessions: "offline", activeSessions: 0, totalSessions: 0 } as const);

      const nextState: RuntimeUiState =
        isSystemActionLoading && healthStatus.runtime !== "online"
          ? "starting"
          : healthStatus.runtime === "online"
            ? "running"
            : "offline";

      setSessionState(healthStatus.sessions);
      setActiveSessions(healthStatus.activeSessions);
      setTotalSessions(healthStatus.totalSessions);
      if (listedSessionsResult.status === "fulfilled" && Array.isArray(listedSessionsResult.value)) {
        setSessions(listedSessionsResult.value);
      }

      if (metricsResult.status === "fulfilled") {
        setMetricsSnapshot(mapMetricsPayload(metricsResult.value));
      }

      setRuntimeState((prev) => (prev === nextState ? prev : nextState));

      const isRunning = nextState === "running";
      if (isRunning && !wasRuntimeRunningRef.current) {
        window.dispatchEvent(new CustomEvent(RUNTIME_RECONNECTED_EVENT, { detail: { state: "running" } }));
      }
      wasRuntimeRunningRef.current = isRunning;
    } catch (error) {
      if (!isMountedRef.current) {
        return;
      }

      if (import.meta.env.MODE !== 'production') console.error("Failed to load system status:", error);
      wasRuntimeRunningRef.current = false;
      setRuntimeState((prev) => (isSystemActionLoading || prev === "starting" ? "starting" : "offline"));
    } finally {
      if (isMountedRef.current) {
        setIsSystemLoading(false);
      }

      isRefreshingRef.current = false;
    }
  }, [isSystemActionLoading]);

  useEffect(() => {
    isMountedRef.current = true;
    void loadStatus();
    const intervalId = window.setInterval(() => void loadStatus(), 20_000);
    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [loadStatus]);

  const handleActivateSystem = async () => {
    if (isSystemActionLoading) return;
    setIsSystemActionLoading(true);
    setRuntimeState("starting");
    void loadStatus();
    try {
      await systemControlService.activate();
    } catch (_error) {
      setRuntimeState("offline");
    } finally {
      setIsSystemActionLoading(false);
    }
  };

  const handleDeactivateSystem = async () => {
    if (isSystemActionLoading) return;
    setIsSystemActionLoading(true);
    try {
      await systemControlService.stop();
      wasRuntimeRunningRef.current = false;
      setRuntimeState("offline");
    } catch (_error) {
      // noop
    } finally {
      setIsSystemActionLoading(false);
    }
  };

  const numberHealth = useMemo(() => {
    if (runtimeState === "running" && sessionState === "online") return { label: "Safe", icon: ShieldCheck, className: "bg-success/15 text-success" };
    if (runtimeState === "starting" || sessionState === "offline") return { label: "Attention", icon: Warning, className: "bg-warning/15 text-warning" };
    return { label: "Risk", icon: WarningCircle, className: "bg-destructive/15 text-destructive" };
  }, [runtimeState, sessionState]);

  const resolveMetricValue = useCallback((key: string) => {
    if (!metricsSnapshot || runtimeState !== "running") return 0;
    if (key === "responseTimeSeconds") {
      const s = metricsSnapshot.responseTimeSeconds;
      return typeof s === "number" ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : 0;
    }
    return (metricsSnapshot as Record<string, unknown>)[key] as number | 0;
  }, [metricsSnapshot, runtimeState]);

  const runtimeDotClass = runtimeState === "running" ? "text-success" : runtimeState === "starting" ? "text-warning" : "text-destructive";
  const runtimeLabel = runtimeState === "running" ? "Online" : runtimeState === "starting" ? "Iniciando..." : "Offline";
  const runtimeDescription = runtimeState === "running" ? "Runtime disponível e sincronizado." : runtimeState === "starting" ? "Iniciando runtime..." : "Runtime offline. Clique em Activate para iniciar.";
  const runtimeBadgeVariant = runtimeState === "running" ? "default" as const : runtimeState === "starting" ? "secondary" as const : "destructive" as const;
  const sessionDotClass = sessionState === "online" ? "text-success" : "text-destructive";
  const sessionLabel = sessionState === "online" ? "Online" : "Offline";
  const sessionBadgeVariant = sessionState === "online" ? "default" as const : "destructive" as const;

  const maxDddCount = Math.max(...dddRegions.map(r => r.count), 1);

  return (
    <div className="min-h-screen">
      <Header title="Dashboard" subtitle="Visão geral do seu atendimento" runtimeState={runtimeState} />

      <div className="p-6 space-y-6">
        {/* Top bar: Number health + Tab navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="conversations">Conversas</TabsTrigger>
              <TabsTrigger value="ai">IA</TabsTrigger>
              <TabsTrigger value="schedule">Horários</TabsTrigger>
              <TabsTrigger value="map">Mapa de Origem</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in-0 duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {baseMetrics.map((metric) => {
                const color = metricColorClasses(metric.color);
                const resolvedValue = resolveMetricValue(metric.key);
                return (
                  <Card key={metric.title} className="metric-card">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground font-medium">{metric.title}</p>
                          <h3 className="text-3xl font-bold font-display mt-1">
                            {typeof resolvedValue === "string" ? resolvedValue : formatMetricValue(resolvedValue as number | undefined, metric.fallback)}
                          </h3>
                          <div className="flex items-center gap-1 mt-2">
                            {metric.trend === "up" ? <ArrowUp className="w-4 h-4 text-success" weight="bold" /> : <ArrowDown className="w-4 h-4 text-destructive" weight="bold" />}
                            <span className={`text-sm font-medium ${metric.trend === "up" ? "text-success" : "text-destructive"}`}>{metric.change}</span>
                            <span className="text-xs text-muted-foreground">vs ontem</span>
                          </div>
                        </div>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.iconBox}`}>
                          <metric.icon weight="duotone" className={`w-6 h-6 ${color.icon}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Main chart + Campaign performance */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="glass-card xl:col-span-2">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <ChartLineUp className="h-4 w-4 text-primary" />
                    Mensagens ao longo do tempo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorMensagens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 70%, 49%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142, 70%, 49%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorIA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="mensagens" stroke="hsl(142, 70%, 49%)" fillOpacity={1} fill="url(#colorMensagens)" strokeWidth={2} />
                      <Area type="monotone" dataKey="ia" stroke="hsl(199, 89%, 48%)" fillOpacity={1} fill="url(#colorIA)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary" /><span className="text-sm text-muted-foreground">Mensagens</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-info" /><span className="text-sm text-muted-foreground">Respostas IA</span></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card h-full">
                <CardHeader><CardTitle className="font-display">Performance de campanhas</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={campaignPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="performance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Sessions */}
            <div className="grid grid-cols-1 gap-6">


              <Card className="glass-card">
                <CardHeader><CardTitle className="font-display">Sessões WhatsApp</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {sessions.length === 0 && !isSystemLoading && (
                    <p className="text-sm text-muted-foreground">Nenhuma sessão encontrada.</p>
                  )}
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <WhatsappLogo weight="fill" className="w-5 h-5 text-primary" />
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${session.status === "connected" ? "bg-success" : "bg-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{session.name ?? session.id}</h4>
                        <p className="text-xs text-muted-foreground truncate">{session.phone ?? "Sem número"}</p>
                      </div>
                      <Badge variant={session.connected || session.status === "connected" ? "default" : "secondary"}>
                        {session.connected || session.status === "connected" ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  ))}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Uso de sessões</span>
                      <span className="font-medium">{activeSessions}/{Math.max(totalSessions, 1)}</span>
                    </div>
                    <Progress value={totalSessions > 0 ? (activeSessions / totalSessions) * 100 : 0} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ PERFORMANCE TAB ═══ */}
        {activeTab === "performance" && (
          <div className="space-y-6 animate-in fade-in-0 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {performanceKpis.map((kpi) => (
                <Card key={kpi.metric} className="metric-card">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">{kpi.metric}</p>
                    <div className="flex items-end justify-between mt-2">
                      <h3 className="text-3xl font-bold font-display">{kpi.value}</h3>
                      <div className={`flex items-center gap-1 text-sm ${kpi.trend === "up" ? "text-success" : "text-destructive"}`}>
                        {kpi.trend === "up" ? <ArrowUp weight="bold" className="w-4 h-4" /> : <ArrowDown weight="bold" className="w-4 h-4" />}
                        {kpi.change}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <ChartLineUp weight="duotone" className="w-5 h-5 text-primary" />
                    Tendência Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={overviewData}>
                      <defs>
                        <linearGradient id="colorMsgs2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(142, 70%, 49%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(142, 70%, 49%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorLeads2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="mensagens" stroke="hsl(142, 70%, 49%)" fillOpacity={1} fill="url(#colorMsgs2)" strokeWidth={2} />
                      <Area type="monotone" dataKey="leads" stroke="hsl(199, 89%, 48%)" fillOpacity={1} fill="url(#colorLeads2)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="font-display">Atendimentos por dia</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceWeekData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line dataKey="atendimentos" stroke="hsl(var(--info))" strokeWidth={2} dot={{ fill: "hsl(var(--info))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ CONVERSATIONS TAB ═══ */}
        {activeTab === "conversations" && (
          <div className="space-y-6 animate-in fade-in-0 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="glass-card lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="font-display">Conversas Recentes</CardTitle>
                  <Badge variant="secondary">Ver todas</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {recentChats.map((chat) => (
                    <div key={chat.id} className="inbox-message">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">{chat.avatar}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium truncate">{chat.name}</h4>
                          <span className="text-xs text-muted-foreground">{chat.time}</span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{chat.message}</p>
                      </div>
                      {chat.unread > 0 && <Badge className="bg-primary text-primary-foreground">{chat.unread}</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass-card h-full">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <ChatCircleDots weight="duotone" className="w-5 h-5 text-primary" />
                    Por Canal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={channelData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {channelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4">
                    {channelData.map((channel) => (
                      <div key={channel.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }} />
                          <span className="text-sm">{channel.name}</span>
                        </div>
                        <span className="text-sm font-medium">{channel.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ AI TAB ═══ */}
        {activeTab === "ai" && (
          <div className="space-y-6 animate-in fade-in-0 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Robot weight="duotone" className="w-5 h-5 text-primary" />
                    Performance da IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={aiPerformance}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis domain={[80, 100]} className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="acertos" stroke="hsl(199, 89%, 48%)" strokeWidth={2} dot={{ fill: "hsl(199, 89%, 48%)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Taxa de acerto</span>
                      <span className="text-lg font-bold text-primary">91.3%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Lightning weight="duotone" className="w-5 h-5 text-primary" />
                    Métricas de IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border p-4 text-center">
                      <p className="text-sm text-muted-foreground">Respostas automáticas</p>
                      <p className="text-2xl font-bold mt-1">{formatMetricValue(metricsSnapshot?.aiResponses, "1.203")}</p>
                    </div>
                    <div className="rounded-xl border border-border p-4 text-center">
                      <p className="text-sm text-muted-foreground">Tokens consumidos</p>
                      <p className="text-2xl font-bold mt-1">{formatMetricValue(metricsSnapshot?.tokensUsed, "58.420")}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-sm text-muted-foreground mb-2">Cobertura de respostas</p>
                    <Progress value={91} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">91% das perguntas respondidas automaticamente</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ SCHEDULE TAB ═══ */}
        {activeTab === "schedule" && (
          <div className="space-y-6 animate-in fade-in-0 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <Clock weight="duotone" className="w-5 h-5 text-primary" />
                    Horários de Pico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="hour" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="hsl(142, 70%, 49%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="font-display">Heatmap por hora</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-8" />
                    {["06-09", "09-12", "12-15", "15-18", "18-21", "21-00"].map((slot) => (
                      <span key={slot} className="flex-1 text-center text-[10px] text-muted-foreground">{slot}</span>
                    ))}
                  </div>
                  {heatmapData.map((row) => (
                    <div key={row.day} className="flex items-center gap-2">
                      <span className="w-8 text-xs text-muted-foreground">{row.day}</span>
                      <div className="grid flex-1 grid-cols-6 gap-1">
                        {row.values.map((value, index) => (
                          <div
                            key={`${row.day}-${index}`}
                            className="h-7 rounded flex items-center justify-center"
                            style={{ backgroundColor: `hsl(var(--primary) / ${Math.min(0.15 + value / 12, 0.9)})` }}
                            title={`${row.day} - slot ${index + 1}: ${value}`}
                          >
                            <span className="text-[10px] font-medium text-primary-foreground/80">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ MAP TAB ═══ */}
        {activeTab === "map" && (
          <div className="space-y-6 animate-in fade-in-0 duration-300">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <MapPin weight="duotone" className="w-5 h-5 text-primary" />
                  Mapa de Origem dos Clientes por DDD
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar representation */}
                  <div className="space-y-3">
                    {dddRegions.map((region) => (
                      <div key={region.ddd} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-primary">{region.ddd}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{region.region}</span>
                            <span className="text-xs text-muted-foreground shrink-0 ml-2">{region.count} contatos</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${(region.count / maxDddCount) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-muted-foreground w-10 text-right">{region.pct}%</span>
                      </div>
                    ))}
                  </div>

                  {/* Summary cards */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border p-4 text-center">
                        <p className="text-sm text-muted-foreground">Regiões ativas</p>
                        <p className="text-3xl font-bold mt-1">{dddRegions.length}</p>
                      </div>
                      <div className="rounded-xl border border-border p-4 text-center">
                        <p className="text-sm text-muted-foreground">Total de contatos</p>
                        <p className="text-3xl font-bold mt-1">{dddRegions.reduce((a, b) => a + b.count, 0).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>

                    <Card className="border border-border">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 Regiões</CardTitle></CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={dddRegions.slice(0, 5)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis type="number" className="text-xs" />
                            <YAxis dataKey="ddd" type="category" className="text-xs" width={35} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <div className="rounded-xl border border-border p-4">
                      <p className="text-sm font-semibold mb-2">Concentração</p>
                      <p className="text-xs text-muted-foreground">
                        As 3 principais regiões (DDDs 11, 21, 31) concentram <strong className="text-foreground">52%</strong> do volume total de contatos.
                        Foco comercial recomendado no eixo Sudeste.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
