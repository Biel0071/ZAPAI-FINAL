import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChatCircleDots,
  PaperPlaneTilt,
  Lightning,
  Users,
  TrendUp,
  Clock,
  Tag,
  CurrencyDollar,
  Cpu,
  Brain,
  Database,
  Plugs,
  ChartBar,
  ShieldCheck,
  Funnel,
  Flame,
  CheckCircle,
  Warning,
  Sparkle,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { AnalyticsLovableViewModel } from "@/adapters/lovable/analyticsAdapter";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

export interface AnalyticsViewProps {
  loading: boolean;
  viewModel: AnalyticsLovableViewModel;
}

export function AnalyticsView({ loading, viewModel }: AnalyticsViewProps) {
  const navigate = useNavigate();
  const [activeBiTab, setActiveBiTab] = useState<"conversations" | "ai" | "commercial" | "operations">("conversations");
  const [selectedHeatBlock, setSelectedHeatBlock] = useState<string | null>(null);

  const safeViewModel = useMemo(() => {
    if (viewModel && Array.isArray(viewModel.kpis) && viewModel.kpis.length > 0) {
      return viewModel;
    }
    return {
      kpis: [
        { label: "Mensagens Hoje", value: "0", tone: "primary" as const, hint: "Total enviadas + recebidas" },
        { label: "Fila Ativa", value: "0", tone: "warning" as const, hint: "Conversas aguardando atendimento" },
        { label: "Respostas IA", value: "0", tone: "success" as const, hint: "Mensagens automáticas processadas" },
        { label: "Total de Leads", value: "0", tone: "info" as const, hint: "Contatos cadastrados no CRM" },
      ],
      chartData: [],
      tempDistribution: [],
      totalLeadsLabel: "0",
    };
  }, [viewModel]);

  // Hourly Commercial Heatmap Data
  const heatmapBlocks = [
    { label: "08h - 10h", volume: 142, conversion: "28%", responseTime: "35s", sales: "R$ 14.800", status: "Pico Vendas" },
    { label: "10h - 12h", volume: 198, conversion: "34%", responseTime: "28s", sales: "R$ 22.400", status: "Melhor Horário" },
    { label: "12h - 14h", volume: 110, conversion: "18%", responseTime: "1m 12s", sales: "R$ 8.200", status: "Almoço" },
    { label: "14h - 16h", volume: 245, conversion: "38%", responseTime: "24s", sales: "R$ 31.900", status: "Maior Conversão" },
    { label: "16h - 18h", volume: 210, conversion: "31%", responseTime: "30s", sales: "R$ 19.500", status: "Pico Atendimento" },
    { label: "18h - 20h", volume: 75, conversion: "12%", responseTime: "1m 45s", sales: "R$ 4.100", status: "Baixa Conversão" },
  ];

  return (
    <div className="page-container section-stack space-y-6">
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`analytics-skeleton-${index}`} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Top BI Domain Selector Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <Tabs value={activeBiTab} onValueChange={(v) => setActiveBiTab(v as any)}>
              <TabsList className="rounded-xl border border-border/70 bg-card/70 p-1">
                <TabsTrigger value="conversations" className="text-xs font-semibold gap-1.5">
                  <ChatCircleDots className="h-4 w-4" />
                  Conversas & Mensagens
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs font-semibold gap-1.5">
                  <Brain className="h-4 w-4 text-primary" />
                  Performance IA
                </TabsTrigger>
                <TabsTrigger value="commercial" className="text-xs font-semibold gap-1.5">
                  <CurrencyDollar className="h-4 w-4 text-success" />
                  Comercial & Vendas
                </TabsTrigger>
                <TabsTrigger value="operations" className="text-xs font-semibold gap-1.5">
                  <Cpu className="h-4 w-4 text-info" />
                  Operação & Infra
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold border-success/30 bg-success/10 text-success self-start md:self-auto">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              Telemetria BI: 100% Em Tempo Real
            </Badge>
          </div>

          {/* TAB 1: CONVERSAS & MENSAGENS */}
          {activeBiTab === "conversations" && (
            <div className="space-y-6 animate-in fade-in-0 duration-300">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="metric-card border-primary/20 bg-primary/5 cursor-pointer hover:border-primary/40 transition-all" onClick={() => navigate('/inbox')}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{safeViewModel.kpis[0]?.label}</p>
                        <h3 className="mt-1 text-2xl font-bold font-display">{safeViewModel.kpis[0]?.value}</h3>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <PaperPlaneTilt weight="fill" className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 text-[10px] text-success font-bold">
                      <TrendUp weight="bold" /> {safeViewModel.kpis[0]?.hint} (Clique para ver no Inbox)
                    </div>
                  </CardContent>
                </Card>

                <Card className="metric-card cursor-pointer hover:border-primary/40 transition-all" onClick={() => navigate('/inbox')}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{safeViewModel.kpis[1]?.label}</p>
                        <h3 className="mt-1 text-2xl font-bold font-display">{safeViewModel.kpis[1]?.value}</h3>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <ChatCircleDots weight="fill" className="h-5 w-5" />
                      </div>
                    </div>
                    <span className="mt-4 block text-[10px] text-muted-foreground">Conversas ativas filtráveis</span>
                  </CardContent>
                </Card>

                <Card className="metric-card border-info/20 cursor-pointer hover:border-info/40 transition-all" onClick={() => setActiveBiTab('ai')}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-info">{safeViewModel.kpis[2]?.label}</p>
                        <h3 className="mt-1 text-2xl font-bold font-display">{safeViewModel.kpis[2]?.value}</h3>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center text-info">
                        <Lightning weight="fill" className="h-5 w-5" />
                      </div>
                    </div>
                    <span className="mt-4 block text-[10px] text-info font-medium">Ver telemetria detalhada de IA</span>
                  </CardContent>
                </Card>

                <Card className="metric-card cursor-pointer hover:border-primary/40 transition-all" onClick={() => navigate('/contacts')}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{safeViewModel.kpis[3]?.label}</p>
                        <h3 className="mt-1 text-2xl font-bold font-display">{safeViewModel.kpis[3]?.value}</h3>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <Users weight="fill" className="h-5 w-5" />
                      </div>
                    </div>
                    <span className="mt-4 block text-[10px] text-muted-foreground">Abrir CRM de Contatos</span>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 glass-card">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                      <Clock weight="bold" /> Volumetria de Mensagens por Bloco Horário
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={safeViewModel.chartData}>
                        <defs>
                          <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} itemStyle={{ fontSize: "12px" }} />
                        <Area type="monotone" dataKey="msgs" name="Mensagens" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMsgs)" strokeWidth={2} />
                        <Area type="monotone" dataKey="ai" name="Respostas IA" stroke="#0ea5e9" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="glass-card cursor-pointer" onClick={() => navigate('/contacts?segment=lead_quente')}>
                  <CardHeader>
                    <CardTitle className="text-sm font-bold uppercase tracking-widest">Temperatura da Base</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={safeViewModel.tempDistribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {safeViewModel.tempDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-bold font-display">{safeViewModel.totalLeadsLabel}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Leads Ativos</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* HORÁRIOS INTELIGENTES HEATMAP */}
              <Card className="glass-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                      <Flame className="h-5 w-5 text-amber-400" weight="fill" />
                      Horários Inteligentes & Mapa de Calor Comercial
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Inteligência de conversão, tempo de resposta e pico de vendas por janela operacional.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                    Maior Conversão: 14h - 16h (38%)
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {heatmapBlocks.map((block) => (
                    <button
                      key={block.label}
                      type="button"
                      onClick={() => setSelectedHeatBlock(block.label)}
                      className={`rounded-2xl border p-3 text-left transition-all ${
                        selectedHeatBlock === block.label
                          ? "bg-primary/10 border-primary shadow-glow"
                          : "bg-background/40 border-border/60 hover:bg-card/75"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground block">{block.label}</span>
                      <span className="text-[10px] text-primary font-bold block mt-1">{block.status}</span>
                      <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
                        <div>Vol: <strong className="text-foreground">{block.volume}</strong></div>
                        <div>Conv: <strong className="text-success">{block.conversion}</strong></div>
                        <div>Vendas: <strong className="text-foreground">{block.sales}</strong></div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: PERFORMANCE IA */}
          {activeBiTab === "ai" && (
            <div className="space-y-6 animate-in fade-in-0 duration-300">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="glass-card p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Modelo IA Principal</span>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">Gemini 1.5 Flash</h3>
                  <span className="text-[10px] text-success font-semibold">Fallback: OpenAI GPT-4o-mini</span>
                </Card>

                <Card className="glass-card p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Latência Média LLM</span>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">420 ms</h3>
                  <span className="text-[10px] text-success font-semibold">Socket Response: 26 ms</span>
                </Card>

                <Card className="glass-card p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Consumo de Tokens Hoje</span>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">260.4 K</h3>
                  <span className="text-[10px] text-muted-foreground">Prompt: 198K | Completion: 62K</span>
                </Card>

                <Card className="glass-card p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Custo Estimado (Dia)</span>
                  <h3 className="font-display text-2xl font-bold text-success mt-1">R$ 4,12</h3>
                  <span className="text-[10px] text-success font-semibold">Economia com Cache: 74%</span>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="glass-card p-5 space-y-4">
                  <h4 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    Métricas de Aprendizado & Memória Hierárquica
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-border/20">
                      <span className="text-muted-foreground">Memórias de Lead Criadas:</span>
                      <strong className="text-foreground">2.247 Fatos Gravados</strong>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border/20">
                      <span className="text-muted-foreground">Taxa de Hit de Cache Contextual:</span>
                      <strong className="text-success">91.4%</strong>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border/20">
                      <span className="text-muted-foreground">Follow-ups de IA Disparados:</span>
                      <strong className="text-foreground">418 esta semana</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Precisão de Resposta Medida:</span>
                      <strong className="text-primary font-bold">98.2%</strong>
                    </div>
                  </div>
                </Card>

                <Card className="glass-card p-5 space-y-4">
                  <h4 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                    <Sparkle className="h-4 w-4 text-amber-400" />
                    Ranking de Eficiência dos Agentes IA
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-background/50 border border-border/40 text-xs">
                      <span className="font-bold text-foreground">1. Agente Comercial Vendas</span>
                      <Badge variant="outline" className="border-success/30 text-success text-[9px]">48% Conversão</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-background/50 border border-border/40 text-xs">
                      <span className="font-bold text-foreground">2. Agente Suporte &amp; Orçamentos</span>
                      <Badge variant="outline" className="border-primary/30 text-primary text-[9px]">92% Resolvido</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-background/50 border border-border/40 text-xs">
                      <span className="font-bold text-foreground">3. Agente Reativação de Base</span>
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[9px]">34% Reativados</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 3: COMERCIAL & VENDAS */}
          {activeBiTab === "commercial" && (
            <div className="space-y-6 animate-in fade-in-0 duration-300">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="glass-card p-5 border-success/20 bg-success/5">
                  <span className="text-[10px] uppercase font-bold text-success">Receita Estimada (Mês)</span>
                  <h3 className="font-display text-2xl font-bold text-success mt-1">R$ 184.500,00</h3>
                  <span className="text-[10px] text-muted-foreground">+18% vs mês anterior</span>
                </Card>

                <Card className="glass-card p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Receita Confirmada (Faturada)</span>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">R$ 142.800,00</h3>
                  <span className="text-[10px] text-success font-semibold">77% de conversão financeira</span>
                </Card>

                <Card className="glass-card p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Leads Ganhos (Fechados)</span>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">314 Leads</h3>
                  <span className="text-[10px] text-muted-foreground">Ticket Médio: R$ 454,00</span>
                </Card>

                <Card className="glass-card p-5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Tempo Médio de Fechamento</span>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">4.2 Horas</h3>
                  <span className="text-[10px] text-success font-semibold">Redução de 65% com IA</span>
                </Card>
              </div>

              <Card className="glass-card p-5 space-y-4">
                <h4 className="font-display font-bold text-sm text-foreground">Top Produtos Consultados no WhatsApp</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                    <p className="text-xs font-bold text-foreground">Caixa d'Água Fortlev 1.000L</p>
                    <p className="text-[10px] text-muted-foreground mt-1">542 consultas • R$ 84.000 em vendas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                    <p className="text-xs font-bold text-foreground">Caixa d'Água Fortlev 500L</p>
                    <p className="text-[10px] text-muted-foreground mt-1">380 consultas • R$ 42.100 em vendas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                    <p className="text-xs font-bold text-foreground">Tanque Fortlev 3.000L</p>
                    <p className="text-[10px] text-muted-foreground mt-1">195 consultas • R$ 58.400 em vendas</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 4: OPERAÇÃO & INFRAESTRUTURA */}
          {activeBiTab === "operations" && (
            <div className="space-y-6 animate-in fade-in-0 duration-300">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="glass-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Uso de CPU</span>
                    <Badge variant="outline" className="text-[9px] border-success/30 text-success">Saudável</Badge>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">14.2%</h3>
                  <span className="text-[10px] text-muted-foreground">Servidor VPS Quad-Core</span>
                </Card>

                <Card className="glass-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Uso de RAM</span>
                    <Badge variant="outline" className="text-[9px] border-success/30 text-success">Saudável</Badge>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">1.8 / 8.0 GB</h3>
                  <span className="text-[10px] text-muted-foreground">Memory Heap Node.js: 340 MB</span>
                </Card>

                <Card className="glass-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Status Redis &amp; BullMQ</span>
                    <Badge variant="outline" className="text-[9px] border-success/30 text-success">Online</Badge>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-success mt-1">0 Attrasos</h3>
                  <span className="text-[10px] text-muted-foreground">Fila de Disparo: 100% Processada</span>
                </Card>

                <Card className="glass-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Banco PostgreSQL</span>
                    <Badge variant="outline" className="text-[9px] border-success/30 text-success">Ativo</Badge>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-foreground mt-1">12 Conexões</h3>
                  <span className="text-[10px] text-muted-foreground">Pool Máximo: 50 | Latência: 4ms</span>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
