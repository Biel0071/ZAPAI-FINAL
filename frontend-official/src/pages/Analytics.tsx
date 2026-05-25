import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiService, type MetricsSummary, type Conversation } from "@/services/apiService";
import { motion } from "framer-motion";
import {
  ChatCircleDots,
  Users,
  Robot,
  ChartLineUp,
  Globe,
  ArrowClockwise,
} from "@phosphor-icons/react";
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
  Legend,
} from "recharts";

export default function Analytics() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (force = false) => {
    try {
      const [metricsResult, conversationsResult] = await Promise.allSettled([
        apiService.getMetrics(),
        apiService.getConversations(force, { limit: 200 }),
      ]);

      if (metricsResult.status === "fulfilled") {
        setMetrics(metricsResult.value);
      }

      if (conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value)) {
        setConversations(conversationsResult.value);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadData(true);
  };

  const conversationCount = useMemo(() => conversations.length, [conversations]);

  // Compute daily message statistics
  const chartData = useMemo(() => {
    const daysName = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    const base = Array.from({ length: 7 }, (_, index) => ({
      name: daysName[index],
      mensagens: 0,
      ia: 0,
    }));

    conversations.forEach((conversation) => {
      const date = new Date(conversation.updatedAt);
      const day = date.getDay();
      const mappedDay = day === 0 ? 6 : day - 1;
      base[mappedDay].mensagens += 1;
      if (conversation.isAI) {
        base[mappedDay].ia += 1;
      }
    });
    return base;
  }, [conversations]);

  // Compute DDD coverage distribution
  const dddRegions = useMemo(() => {
    const byDdd = new Map<string, { ddd: string; region: string; count: number }>();
    conversations.forEach((conversation) => {
      const digits = String(conversation.phone ?? "").replace(/\D/g, "");
      const ddd = digits.slice(0, 2);
      if (!ddd || ddd.length < 2) return;
      const current = byDdd.get(ddd) ?? { ddd, region: `DDD ${ddd}`, count: 0 };
      current.count += 1;
      byDdd.set(ddd, current);
    });

    const list = [...byDdd.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const total = list.reduce((sum, item) => sum + item.count, 0);
    return list.map((item) => ({
      ...item,
      pct: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }, [conversations]);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header
        title="Relatórios & Analytics"
        subtitle="Mapeamento de tráfego, eficiência de IA e origens de contato"
      />
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-container section-stack p-6 space-y-6"
      >
        <div className="flex items-center justify-end gap-2">
          <Badge variant="outline" className="px-3 py-1">
            Fonte: Backend em Produção
          </Badge>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent text-foreground transition-all disabled:opacity-50"
          >
            <ArrowClockwise className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`analytics-skel-card-${index}`} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Skeleton className="h-[380px] xl:col-span-2 rounded-xl" />
              <Skeleton className="h-[380px] rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="metric-card hover-lift rounded-xl border-border/70 bg-card/85">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mensagens hoje</p>
                    <p className="mt-1 text-3xl font-bold font-display">
                      {Number(metrics?.messagesToday ?? metrics?.todayMessages ?? metrics?.totalMessages ?? 0).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ChatCircleDots className="w-6 h-6 text-primary" weight="duotone" />
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card hover-lift rounded-xl border-border/70 bg-card/85">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversas ativas</p>
                    <p className="mt-1 text-3xl font-bold font-display">
                      {Number(metrics?.activeChats ?? metrics?.chats ?? 0).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-success" weight="duotone" />
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card hover-lift rounded-xl border-border/70 bg-card/85">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Respostas IA</p>
                    <p className="mt-1 text-3xl font-bold font-display">
                      {Number(metrics?.aiResponses ?? metrics?.ai ?? 0).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                    <Robot className="w-6 h-6 text-info" weight="duotone" />
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card hover-lift rounded-xl border-border/70 bg-card/85">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversas carregadas</p>
                    <p className="mt-1 text-3xl font-bold font-display">
                      {conversationCount.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Globe className="w-6 h-6 text-warning" weight="duotone" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts & Map Distribution */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Traffic volume chart */}
              <Card className="glass-card xl:col-span-2">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2 text-base">
                    <ChartLineUp className="h-5 w-5 text-primary" />
                    Tráfego semanal de atendimentos
                  </CardTitle>
                  <CardDescription>
                    Distribuição de conversas humanas versus interações assistidas por IA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={290}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorMensagens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorIA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/70" />
                      <XAxis dataKey="name" className="text-xs font-medium" />
                      <YAxis className="text-xs font-medium" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area
                        type="monotone"
                        name="Volume Total"
                        dataKey="mensagens"
                        stroke="hsl(var(--primary))"
                        fillOpacity={1}
                        fill="url(#colorMensagens)"
                        strokeWidth={2.5}
                      />
                      <Area
                        type="monotone"
                        name="Interações IA"
                        dataKey="ia"
                        stroke="hsl(199, 89%, 48%)"
                        fillOpacity={1}
                        fill="url(#colorIA)"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Geographic/DDD breakdown */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2 text-base">
                    <Globe className="h-5 w-5 text-warning" />
                    Origem de Contatos por DDD
                  </CardTitle>
                  <CardDescription>
                    Distribuição regional das últimas 200 interações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-1">
                  {dddRegions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <Globe className="h-10 w-10 text-muted-foreground/50 mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">Aguardando contatos</p>
                      <p className="text-xs text-muted-foreground/75 mt-1">Conecte o canal para mapear DDDs reais.</p>
                    </div>
                  ) : (
                    dddRegions.map((region) => (
                      <div key={region.ddd} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-foreground">{region.region}</span>
                          <span className="text-muted-foreground">{region.count} contatos ({region.pct}%)</span>
                        </div>
                        <Progress value={region.pct} className="h-2 bg-muted" />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Performance analysis bar chart */}
            <div className="grid grid-cols-1 gap-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display text-base">Engajamento Diário e Cobertura Comercial</CardTitle>
                  <CardDescription>Compara volume absoluto de contatos com o processamento do robô</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/70" />
                      <XAxis dataKey="name" className="text-xs font-medium" />
                      <YAxis className="text-xs font-medium" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Bar name="Volume Geral" dataKey="mensagens" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar name="Atendimento IA" dataKey="ia" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

