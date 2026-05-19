import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChatCircleDots,
  WhatsappLogo,
  Users,
  Robot,
  ArrowUp,
  ArrowDown,
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
import { DashboardView } from "@/lovable/pages/DashboardView";
import { createDashboardLovableViewModel } from "@/adapters/lovable/dashboardAdapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatGridSkeleton } from "@/components/ui/loading-skeleton";
import { apiService, type Conversation, type MetricsSummary, type RuntimeHealthState, type SessionInfo } from "@/services/apiService";
import { reportFrontendIssue } from "@/services/frontendHealthService";
import { useAppStore } from "@/stores/appStore";
import { useRuntime } from "@/providers/RuntimeProvider";
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

const STATUS_POLL_MS = 15_000;
const HEAVY_REFRESH_MS = 30_000;

/* ─── Helpers ─── */

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

const formatTime = (value?: string): string => {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
  { title: "Mensagens enviadas", key: "messagesSent" as const, change: "", trend: "up" as const, icon: ChatCircleDots, color: "primary" as const },
  { title: "Mensagens recebidas", key: "messagesReceived" as const, change: "", trend: "up" as const, icon: Users, color: "success" as const },
  { title: "Respostas IA", key: "aiResponses" as const, change: "", trend: "up" as const, icon: Robot, color: "info" as const },
  { title: "Tempo de resposta", key: "responseTimeSeconds" as const, change: "", trend: "up" as const, icon: Clock, color: "warning" as const },
  { title: "Tokens usados", key: "tokensUsed" as const, change: "", trend: "up" as const, icon: Robot, color: "warning" as const },
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
  borderRadius: "12px",
};

const formatMetricValue = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("pt-BR") : "Sem endpoint configurado";

/* ─── Component ─── */

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const runtime = useRuntime();

  // Read sessions and conversations from the shared Zustand store
  // (hydrated in real-time by RuntimeProvider via WebSocket)
  const sessions = useAppStore((s) => s.sessions);
  const conversations = useAppStore((s) => s.conversations);
  const storeMetrics = useAppStore((s) => s.metrics);

  const [sessionState, setSessionState] = useState<RuntimeHealthState>("offline");
  const [activeSessions, setActiveSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [isSystemLoading, setIsSystemLoading] = useState(true);
  const [metricsSnapshot, setMetricsSnapshot] = useState<DashboardMetrics | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const initialTab = searchParams.get("tab") ?? "overview";
    return ["overview", "performance", "conversations", "ai", "schedule", "map"].includes(initialTab)
      ? initialTab
      : "overview";
  });
  const lastHeavyFetchAtRef = useRef(0);

  // Sync metrics from store when RuntimeProvider hydrates them
  useEffect(() => {
    if (storeMetrics) {
      setMetricsSnapshot(mapMetricsPayload(storeMetrics));
    }
  }, [storeMetrics]);

  const loadStatus = useCallback(async () => {
    try {
      const shouldRefreshHeavyData =
        Date.now() - lastHeavyFetchAtRef.current >= HEAVY_REFRESH_MS;

      // Health status is Dashboard-specific — not covered by RuntimeProvider
      const [healthStatusResult, metricsResult] = await Promise.allSettled([
        apiService.getRuntimeSessionHealth(),
        shouldRefreshHeavyData ? apiService.getMetrics() : Promise.resolve({} as MetricsSummary),
      ]);

      if (shouldRefreshHeavyData) {
        lastHeavyFetchAtRef.current = Date.now();
      }

      const healthStatus =
        healthStatusResult.status === "fulfilled"
          ? healthStatusResult.value
          : ({ sessions: "offline", activeSessions: 0, totalSessions: 0 } as const);

      setSessionState(healthStatus.sessions);
      setActiveSessions(healthStatus.activeSessions);
      setTotalSessions(healthStatus.totalSessions);

      if (metricsResult.status === "fulfilled" && shouldRefreshHeavyData) {
        setMetricsSnapshot(mapMetricsPayload(metricsResult.value));
      }

    } catch (error) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "dashboard.loadStatus",
        message: error instanceof Error ? error.message : "Falha ao carregar status do sistema",
      });
      setSessionState("offline");
    } finally {
      setIsSystemLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const run = async () => { if (isMounted) await loadStatus(); };
    void run();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void run();
    }, STATUS_POLL_MS);
    return () => { isMounted = false; window.clearInterval(intervalId); };
  }, [loadStatus]);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab") ?? "overview";
    const normalizedTab = ["overview", "performance", "conversations", "ai", "schedule", "map"].includes(tabFromUrl)
      ? tabFromUrl
      : "overview";
    setActiveTab((prev) => (prev === normalizedTab ? prev : normalizedTab));
  }, [searchParams]);

  const handleTabChange = useCallback(
    (nextTab: string) => {
      setActiveTab(nextTab);
      setSearchParams(nextTab === "overview" ? {} : { tab: nextTab }, { replace: true });
    },
    [setSearchParams],
  );

  const numberHealth = useMemo(() => {
    if (sessionState === "online") return { label: "Safe", icon: ShieldCheck, className: "bg-success/15 text-success" };
    if (sessionState === "offline") return { label: "Attention", icon: Warning, className: "bg-warning/15 text-warning" };
    return { label: "Risk", icon: WarningCircle, className: "bg-destructive/15 text-destructive" };
  }, [sessionState]);

  const resolveMetricValue = useCallback((key: string) => {
    if (!metricsSnapshot) return undefined;
    if (key === "responseTimeSeconds") {
      const s = metricsSnapshot.responseTimeSeconds;
      return typeof s === "number" ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : undefined;
    }
    return (metricsSnapshot as Record<string, unknown>)[key] as number | undefined;
  }, [metricsSnapshot]);

  const sessionLabel = sessionState === "online" ? "Online" : "Offline";

  const conversationsByRecency = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [conversations],
  );

  const recentChats = useMemo(
    () =>
      conversationsByRecency.slice(0, 8).map((conversation) => ({
        id: String(conversation.id),
        name: conversation.contactName || conversation.phone || "Contato",
        message: conversation.lastMessage || "",
        time: formatTime(conversation.updatedAt),
        unread: Number(conversation.unread ?? 0),
        avatar: (conversation.contactName || conversation.phone || "C")
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word[0]?.toUpperCase() ?? "")
          .join(""),
      })),
    [conversationsByRecency],
  );

  const groupedConversations = useMemo(() => {
    const channels = [
      { name: "WhatsApp", count: conversations.length, color: "hsl(var(--primary))" },
      {
        name: "IA Auto",
        count: conversations.filter((conversation) => Boolean(conversation.isAI)).length,
        color: "hsl(var(--info))",
      },
      {
        name: "Manual",
        count: conversations.filter((conversation) => !conversation.isAI).length,
        color: "hsl(var(--warning))",
      },
    ];

    const total = channels.reduce((sum, item) => sum + item.count, 0);
    return channels.map((item) => ({
      name: item.name,
      color: item.color,
      value: total > 0 ? Math.round((item.count / total) * 100) : 0,
      count: item.count,
    }));
  }, [conversations]);

  const chartData = useMemo(() => {
    const buckets = new Map<number, { name: string; mensagens: number; ia: number }>();
    for (let hour = 0; hour <= 20; hour += 4) {
      buckets.set(hour, { name: `${String(hour).padStart(2, "0")}h`, mensagens: 0, ia: 0 });
    }

    conversations.forEach((conversation) => {
      const hour = new Date(conversation.updatedAt).getHours();
      const bucketHour = Math.max(0, Math.min(20, Math.floor(hour / 4) * 4));
      const bucket = buckets.get(bucketHour);
      if (!bucket) return;
      bucket.mensagens += 1;
      if (conversation.isAI) bucket.ia += 1;
    });

    return [...buckets.values()];
  }, [conversations]);

  const performanceWeekData = useMemo(() => {
    const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const base = weekdayNames.map((name) => ({ name, atendimentos: 0 }));
    conversations.forEach((conversation) => {
      const day = new Date(conversation.updatedAt).getDay();
      base[day].atendimentos += 1;
    });
    return base;
  }, [conversations]);

  const hourlyData = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, index) => {
      const hour = index * 2;
      return { hour: `${String(hour).padStart(2, "0")}h`, count: 0 };
    });
    conversations.forEach((conversation) => {
      const hour = new Date(conversation.updatedAt).getHours();
      const bucket = Math.max(0, Math.min(11, Math.floor(hour / 2)));
      base[bucket].count += 1;
    });
    return base;
  }, [conversations]);

  const aiPerformance = useMemo(() => {
    const week = performanceWeekData;
    const total = week.reduce((sum, item) => sum + item.atendimentos, 0);
    const totalAi = conversations.filter((conversation) => conversation.isAI).length;
    const aiShare = total > 0 ? Math.round((totalAi / total) * 100) : 0;
    return week.map((item) => ({ name: item.name, acertos: Math.max(0, Math.min(100, aiShare || 0)) }));
  }, [conversations, performanceWeekData]);

  const overviewData = useMemo(() => {
    const monthly = new Map<string, { name: string; mensagens: number; leads: number }>();
    conversations.forEach((conversation) => {
      const date = new Date(conversation.updatedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!monthly.has(key)) {
        monthly.set(key, {
          name: date.toLocaleDateString("pt-BR", { month: "short" }),
          mensagens: 0,
          leads: 0,
        });
      }
      const month = monthly.get(key)!;
      month.mensagens += 1;
      if ((conversation.unread ?? 0) > 0) month.leads += 1;
    });

    return [...monthly.values()].slice(-6);
  }, [conversations]);

  const campaignPerformanceData = useMemo(
    () => [
      { name: "Sessões ativas", performance: totalSessions > 0 ? Math.round((activeSessions / totalSessions) * 100) : 0 },
      { name: "Resposta IA", performance: metricsSnapshot?.aiResponses ? Math.min(100, Math.round((metricsSnapshot.aiResponses / Math.max(metricsSnapshot.messagesSent || 1, 1)) * 100)) : 0 },
      { name: "Conversas", performance: Math.min(100, conversations.length) },
      { name: "Leads", performance: Math.min(100, metricsSnapshot?.newLeads ?? 0) },
    ],
    [activeSessions, conversations.length, metricsSnapshot?.aiResponses, metricsSnapshot?.messagesSent, metricsSnapshot?.newLeads, totalSessions],
  );

  const performanceKpis = useMemo(() => {
    const responseSeconds = metricsSnapshot?.responseTimeSeconds ?? 0;
    const aiCoverage = metricsSnapshot?.messagesSent ? Math.round(((metricsSnapshot.aiResponses || 0) / Math.max(metricsSnapshot.messagesSent, 1)) * 100) : 0;
    const unreadTotal = conversations.reduce((sum, conversation) => sum + Number(conversation.unread ?? 0), 0);
    return [
      { metric: "Tempo Resposta", value: responseSeconds ? `${Math.floor(responseSeconds / 60)}m ${Math.round(responseSeconds % 60)}s` : "--", change: "", trend: "up" as const },
      { metric: "Cobertura IA", value: `${aiCoverage}%`, change: "", trend: "up" as const },
      { metric: "Conversas ativas", value: String(conversations.length), change: "", trend: "up" as const },
      { metric: "Não lidas", value: String(unreadTotal), change: "", trend: "up" as const },
    ];
  }, [conversations, metricsSnapshot]);

  const heatmapData = useMemo(() => {
    const dayRows = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => ({ day, values: [0, 0, 0, 0, 0, 0] }));
    conversations.forEach((conversation) => {
      const date = new Date(conversation.updatedAt);
      const weekday = date.getDay();
      const rowIndex = weekday === 0 ? 6 : weekday - 1;
      const bucketIndex = Math.max(0, Math.min(5, Math.floor(Math.max(date.getHours() - 6, 0) / 3)));
      dayRows[rowIndex].values[bucketIndex] += 1;
    });
    return dayRows;
  }, [conversations]);

  const dddRegions = useMemo(() => {
    const byDdd = new Map<string, { ddd: string; region: string; count: number }>();
    conversations.forEach((conversation) => {
      const digits = String(conversation.phone ?? "").replace(/\D/g, "");
      const ddd = digits.slice(0, 2);
      if (!ddd) return;
      const current = byDdd.get(ddd) ?? { ddd, region: `DDD ${ddd}`, count: 0 };
      current.count += 1;
      byDdd.set(ddd, current);
    });

    const list = [...byDdd.values()].sort((a, b) => b.count - a.count);
    const total = list.reduce((sum, item) => sum + item.count, 0);
    return list.map((item) => ({
      ...item,
      pct: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }, [conversations]);

  const maxDddCount = Math.max(...dddRegions.map(r => r.count), 1);

  const lovableDashboardViewModel = createDashboardLovableViewModel({
    conversations,
    metrics: storeMetrics,
    sessions,
    runtimeStatus: runtime.status,
  });

  return (
    <div className="min-h-screen">
      <Header title="CRM Operacional" subtitle="Operação comercial unificada" />

      <div className="page-container section-stack">
        {/* Top bar: Number health + Tab navigation */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="w-full justify-start overflow-x-auto rounded-lg border border-border/70 bg-card/70 p-1 xl:w-auto">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="conversations">Conversas</TabsTrigger>
              <TabsTrigger value="ai">IA</TabsTrigger>
              <TabsTrigger value="schedule">Horários</TabsTrigger>
              <TabsTrigger value="map">Mapa de Origem</TabsTrigger>
            </TabsList>
          </Tabs>
          <OperationalStatusBadge
            label={`Number health · ${numberHealth.label}`}
            tone={sessionState === "online" ? "online" : sessionState === "offline" ? "warning" : "offline"}
            pulse={sessionState !== "online"}
            className="self-start"
          />
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in-0 duration-300">
            <DashboardView viewModel={lovableDashboardViewModel} />

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Conversas ativas</p><p className="mt-1 font-display text-2xl font-bold">{metricsSnapshot?.activeChats ?? 0}</p></CardContent></Card>
              <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads novos</p><p className="mt-1 font-display text-2xl font-bold">{metricsSnapshot?.newLeads ?? 0}</p></CardContent></Card>
              <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sessões online</p><p className="mt-1 font-display text-2xl font-bold">{activeSessions}/{Math.max(totalSessions, 1)}</p></CardContent></Card>
              <Card className="metric-card rounded-2xl border-border/70 bg-card/85"><CardContent className="space-y-2 p-4"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estado da operação</p><p className="font-display text-2xl font-bold">{sessionLabel}</p><OperationalStatusBadge label={sessionLabel === "Online" ? "Operação saudável" : "Operação degradada"} tone={sessionLabel === "Online" ? "online" : "offline"} /></CardContent></Card>
            </div>

            {/* KPI Cards */}
            {isSystemLoading ? (
              <StatGridSkeleton count={5} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                {baseMetrics.map((metric) => {
                const color = metricColorClasses(metric.color);
                const resolvedValue = resolveMetricValue(metric.key);
                return (
                  <Card key={metric.title} className="metric-card hover-lift rounded-lg border-border/70 bg-card/80">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground font-medium">{metric.title}</p>
                          <h3 className="text-3xl font-bold font-display mt-1">
                            {typeof resolvedValue === "string" ? resolvedValue : formatMetricValue(resolvedValue as number | undefined)}
                          </h3>
                          {!String(formatMetricValue(resolvedValue as number | undefined)).includes("Sem endpoint") && (
                            <div className="flex items-center gap-1 mt-2">
                              {metric.trend === "up" ? <ArrowUp className="w-4 h-4 text-success" weight="bold" /> : <ArrowDown className="w-4 h-4 text-destructive" weight="bold" />}
                              {metric.change ? <span className={`text-sm font-medium ${metric.trend === "up" ? "text-success" : "text-destructive"}`}>{metric.change}</span> : null}
                            </div>
                          )}
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
            )}

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

              <Card className="glass-card h-full rounded-lg border-border/70 bg-card/85">
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

            <div className="grid grid-cols-1 gap-6">
              <Card className="glass-card rounded-lg border-border/70 bg-card/85">
                <CardHeader><CardTitle className="font-display">Sessões WhatsApp</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {sessions.length === 0 && !isSystemLoading && (
                    <EmptyState
                      icon={<WhatsappLogo className="h-6 w-6 text-muted-foreground" weight="duotone" />}
                      title="Nenhuma sessão conectada"
                      description="Assim que uma sessão entrar online, ela aparece aqui com status operacional e saúde em tempo real."
                      className="py-10"
                    />
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

              <Card className="glass-card h-full rounded-lg border-border/70 bg-card/85">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <ChatCircleDots weight="duotone" className="w-5 h-5 text-primary" />
                    Por Canal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={groupedConversations} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {groupedConversations.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4">
                    {groupedConversations.map((channel) => (
                      <div key={channel.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }} />
                          <span className="text-sm">{channel.name}</span>
                        </div>
                        <span className="text-sm font-medium">{channel.value}% ({channel.count})</span>
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
              <Card className="glass-card rounded-lg border-border/70 bg-card/85">
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

              <Card className="glass-card rounded-lg border-border/70 bg-card/85">
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
                      <p className="text-2xl font-bold mt-1">{formatMetricValue(metricsSnapshot?.aiResponses)}</p>
                    </div>
                    <div className="rounded-xl border border-border p-4 text-center">
                      <p className="text-sm text-muted-foreground">Tokens consumidos</p>
                      <p className="text-2xl font-bold mt-1">{formatMetricValue(metricsSnapshot?.tokensUsed)}</p>
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

              <Card className="glass-card rounded-lg border-border/70 bg-card/85">
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
            <Card className="glass-card rounded-lg border-border/70 bg-card/85">
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
