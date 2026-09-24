import { useCallback, useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { MemoryGraphViewer } from "@/components/MemoryGraphViewer";
import { apiService, requestApiEndpoint, MemoryEntry, MemoryAnalytics } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Brain,
  MagnifyingGlass,
  Database,
  ChartPieSlice,
  Gear,
  Tag,
  Clock,
  ChatCircle,
  Checks,
  Coins,
  Cpu,
  Sparkle,
  TrendUp,
  WarningCircle,
  FileText,
  TreeStructure,
  Lightbulb,
  User,
  ShoppingBag,
  Target,
  ArrowsClockwise,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Question,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";

// Constants removed. Using real analytics from API.

const SENTIMENT_COLORS = {
  positive: "#10b981", // Emerald 500
  neutral: "#64748b",  // Slate 500
  negative: "#f43f5e"  // Rose 500
};

export default function Memory() {
  const [sessions, setSessions] = useState<{ session_id: string; session_name: string }[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    requestApiEndpoint<{ sessions: typeof sessions }>('/api/ai/history')
      .then((data) => {
        if (alive) {
          setSessions(data.sessions || []);
          if (data.sessions?.[0]?.session_id) {
            setSessionId(data.sessions[0].session_id);
          }
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div className="px-6 pt-4 flex items-center justify-between border-b border-border/40 pb-3 bg-background/50 backdrop-blur">
        <div className="flex items-center gap-2">
          <Label htmlFor="whatsapp-connection-select" className="text-sm font-medium text-foreground">Conexão WhatsApp:</Label>
          <select
            id="whatsapp-connection-select"
            aria-label="WhatsApp da memória"
            className="ml-2 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            <option value="">Todas as conexões (Geral)</option>
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.session_name || s.session_id}
              </option>
            ))}
          </select>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
      <ScopedMemory key={sessionId || 'all'} sessionId={sessionId} />
    </>
  );
}

function ScopedMemory({ sessionId }: { sessionId: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(false);
  const [rememberLastOrder, setRememberLastOrder] = useState(false);
  const [rememberPreferences, setRememberPreferences] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [analytics, setAnalytics] = useState<MemoryAnalytics | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MemoryEntry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"overview" | "graph" | "evolution" | "contacts">("overview");
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [graphStats, setGraphStats] = useState<any>(null);
  const [evolutionData, setEvolutionData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>("all");
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("camila");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEnabled(true);
      setRememberLastOrder(true);
      setRememberPreferences(true);

      // 2. Get analytics (passes sessionId if present)
      const analyticsRes = await apiService.getMemoryAnalytics(sessionId || undefined);
      if (analyticsRes && analyticsRes.success) {
        setAnalytics(analyticsRes.data);
      }

      // 3. Search memories (initial query "")
      const searchRes = await apiService.searchMemory("", sessionId || undefined);
      if (searchRes && searchRes.success) {
        setMemories(searchRes.data);
      }

      // 4. Load Active Memory Graph & Evolution
      try {
        const evoRes = await apiService.getAgentEvolution(selectedAgentKey);
        if (evoRes && evoRes.success) {
          setEvolutionData(evoRes);
          if (evoRes.memoryGraph?.nodes?.length) {
            setGraphData(evoRes.memoryGraph);
          }
        }
      } catch (_) {}

      try {
        const graphRes = await apiService.getMemoryGraph(selectedAgentKey, 60, sessionId || undefined);
        if (graphRes && graphRes.success && graphRes.data) {
          if (graphRes.data.nodes?.length) {
            setGraphData({
              nodes: graphRes.data.nodes,
              edges: graphRes.data.edges || [],
            });
          }
          if (graphRes.data.stats) {
            setGraphStats(graphRes.data.stats);
          }
        }
      } catch (_) {}
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar configurações de memória.";
      console.error("[Memory] Load error:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedAgentKey]);

  const filteredGraphNodes = useMemo(() => {
    if (nodeTypeFilter === "all") return graphData.nodes || [];
    return (graphData.nodes || []).filter((n) => n.type === nodeTypeFilter || n.type === "agent");
  }, [graphData.nodes, nodeTypeFilter]);

  const filteredGraphEdges = useMemo(() => {
    const nodeIds = new Set(filteredGraphNodes.map((n) => n.id));
    return (graphData.edges || []).filter((e) => {
      const src = typeof e.source === "object" ? e.source.id : e.source;
      const tgt = typeof e.target === "object" ? e.target.id : e.target;
      return nodeIds.has(src) && nodeIds.has(tgt);
    });
  }, [graphData.edges, filteredGraphNodes]);

  useEffect(() => {
    void loadData();
  }, [loadData, retryCount]);

  useEffect(() => {
    if (loading) return;
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiService.searchMemory(searchQuery,sessionId);
        if (res && res.success) {
          setMemories(res.data);
        }
      } catch (err) {
        console.error("[Memory] search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, sessionId]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await apiService.saveMemorySettings({ enabled, rememberLastOrder, rememberPreferences });
      toast({ title: "Configurações de memória salvas com sucesso." });
      void loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao salvar configurações.";
      toast({ title: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const res = await apiService.flushMemory(sessionId);
      if (res && res.success) {
        toast({
          title: "Sincronização Concluída",
          description: `${res.data.flushed} mensagens processadas neste lote. Atualize para consultar o estado.`,
        });
        void loadData();
      } else {
        toast({
          title: "Erro na Sincronização",
          description: "Não foi possível persistir as memórias no banco de dados.",
          variant: "destructive"
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha na sincronização.";
      toast({
        title: "Erro na API",
        description: msg,
        variant: "destructive"
      });
    } finally {
      setFlushing(false);
    }
  };

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  // Determine if using demo data or real data
  const isDemoData = !analytics || analytics.totalContacts === 0;

  // Prepare sentiment data
  const sentimentData = [
    { name: "Positivo", value: analytics?.sentiments?.positive || 0, color: SENTIMENT_COLORS.positive },
    { name: "Neutro", value: analytics?.sentiments?.neutral || 0, color: SENTIMENT_COLORS.neutral },
    { name: "Negativo", value: analytics?.sentiments?.negative || 0, color: SENTIMENT_COLORS.negative }
  ].filter(d => d.value > 0);

  const intentData = Object.entries(analytics?.intents || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], i) => ({
      name,
      value,
      color: ["#3b82f6", "#10b981", "#f59e0b", "#a855f7", "#ec4899"][i % 5]
    }));

  // Create a placeholder token history based on today if we don't have historical data yet
  const tokenHistory = [
    { date: "Hoje", tokens: analytics?.totalTokens || 0, cost: ((analytics?.totalTokens || 0) / 1000) * 0.002 }
  ];

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header title="Central de Memória da IA" subtitle="Acompanhe a cognição, aprendizado e persistência da IA em tempo real." />
      
      <div className="page-container section-stack pb-12">
        {error ? (
          <Card className="glass-card rounded-2xl border-destructive/30">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <WarningCircle className="h-6 w-6 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="font-display text-lg font-semibold text-foreground">Falha ao carregar memória</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={handleRetry}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 w-full animate-pulse rounded-2xl bg-muted/40" />
              ))}
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="h-[400px] w-full animate-pulse rounded-2xl bg-muted/40 md:col-span-1" />
              <div className="h-[400px] w-full animate-pulse rounded-2xl bg-muted/40 md:col-span-2" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Enterprise KPIs Banner */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="glass-card rounded-2xl border-border/70 border-l-4 border-l-emerald-500 overflow-hidden shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Contatos Aprendidos</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-display font-black text-foreground">{analytics?.totalContacts || 0}</h3>
                      <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5">
                        <TrendUp className="h-3 w-3" /> Cognição ativa
                      </span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Brain className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card rounded-2xl border-border/70 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Mensagens na Memória</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-display font-black text-foreground">{analytics?.totalMessages || 0}</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Fatos extraídos de chats</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                    <ChatCircle className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card rounded-2xl border-border/70 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Tokens Estimados</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-display font-black text-foreground">{(analytics?.totalTokens || 0).toLocaleString()}</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Uso de contexto estimado</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Cpu className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card rounded-2xl border-border/70 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Custo Contextual</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-display font-black text-foreground">${(((analytics?.totalTokens || 0) / 1000) * 0.002).toFixed(4)}</h3>
                      <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5">
                        <Sparkle className="h-3 w-3" /> Otimização ativa
                      </span>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <Coins className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Navigation Tabs Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
              <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
                <TabsList className="bg-muted/40 p-1 rounded-xl">
                  <TabsTrigger value="overview" className="text-xs font-semibold flex items-center gap-1.5">
                    <ChartPieSlice size={16} /> Visão Geral & Métricas
                  </TabsTrigger>
                  <TabsTrigger value="graph" className="text-xs font-semibold flex items-center gap-1.5">
                    <TreeStructure size={16} className="text-emerald-400" /> Grafo Ativo de Memória (Graphify)
                  </TabsTrigger>
                  <TabsTrigger value="evolution" className="text-xs font-semibold flex items-center gap-1.5">
                    <TrendUp size={16} className="text-indigo-400" /> Evolução do Atendente
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="text-xs font-semibold flex items-center gap-1.5">
                    <User size={16} /> Registros de Contatos ({memories.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                {activeTab === "graph" && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs">
                    {filteredGraphNodes.length} Nós • {filteredGraphEdges.length} Conexões
                  </Badge>
                )}
                <Button onClick={() => setRetryCount((r) => r + 1)} variant="outline" size="sm" className="h-8 rounded-xl text-xs gap-1.5">
                  <ArrowsClockwise size={14} /> Atualizar
                </Button>
              </div>
            </div>

            {/* TAB 1: VISÃO GERAL */}
            {activeTab === "overview" && (
              <div className="grid gap-6 md:grid-cols-3">
                {/* Left Column: Settings and Stats Charts */}
                <div className="space-y-6 md:col-span-1">
                  {/* Memory Settings Card */}
                  <Card className="glass-card rounded-2xl border-border/70">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Gear className="h-4.5 w-4.5 text-primary" />
                        <CardTitle className="text-base font-display">Configurações</CardTitle>
                      </div>
                      <CardDescription className="text-xs">Ajuste o comportamento do mecanismo de aprendizado.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">Memória automática desta conexão. Configure vínculo com loja e evolução na tela de Conexões.</p>
                      <div className="flex flex-col gap-2 pt-2">
                        <Button variant="outline" className="w-full rounded-xl text-xs h-9 font-medium gap-1.5 border-border/80 hover:bg-muted/50" onClick={handleFlush} disabled={flushing}>
                          <Database className="h-3.5 w-3.5" />
                          {flushing ? "Sincronizando..." : "Sincronizar no PostgreSQL"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* State & Database Status Panel */}
                  <Card className="glass-card rounded-2xl border-border/70">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4.5 w-4.5 text-secondary" />
                        <CardTitle className="text-base font-display">Status do Mecanismo</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="text-muted-foreground">Tabela de Memória</span>
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-none text-[10px]">
                          <Checks className="h-3 w-3 mr-0.5 inline" /> Criada (Postgres)
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="text-muted-foreground">Sincronização Periódica</span>
                        <span className="font-semibold text-foreground">Habilitada (A cada 60s)</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                        <span className="text-muted-foreground">Compressão Semântica</span>
                        <Badge variant="outline" className="text-[9px] border-secondary/30 text-secondary">Ativa (LlamaIndex)</Badge>
                      </div>
                      <div className="flex justify-between items-center py-1.5">
                        <span className="text-muted-foreground">Uso de GPU/Embeddings</span>
                        <span className="text-foreground font-semibold">Serviço Externo (OpenAI)</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sentiment Pie Chart */}
                  <Card className="glass-card rounded-2xl border-border/70">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <ChartPieSlice className="h-4.5 w-4.5 text-emerald-400" />
                        <CardTitle className="text-base font-display">Análise de Sentimento</CardTitle>
                      </div>
                      <CardDescription className="text-xs">Distribuição de sentimentos detectados nos contatos.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-3 pb-5">
                      {sentimentData.length > 0 ? (
                        <div className="h-40 w-full relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={sentimentData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={65}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {sentimentData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ 
                                  backgroundColor: "rgba(30, 41, 59, 0.9)", 
                                  border: "1px solid rgba(148, 163, 184, 0.2)",
                                  borderRadius: "8px",
                                  color: "#fff",
                                  fontSize: "11px"
                                }} 
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-[10px] uppercase text-muted-foreground">Total</span>
                            <span className="text-lg font-bold">{analytics?.totalContacts || 0}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
                          Nenhum sentimento detectado
                        </div>
                      )}
                      
                      {/* Legend */}
                      <div className="flex gap-4 text-[10px] mt-2 justify-center w-full">
                        {sentimentData.map(item => (
                          <div key={item.name} className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-muted-foreground">{item.name}: <strong>{item.value}</strong></span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Highlights & Token Usage */}
                <div className="space-y-6 md:col-span-2">
                  {/* Cognitive Graph Summary Card */}
                  <Card className="glass-card rounded-2xl border-border/70">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-display flex items-center gap-2">
                          <TreeStructure className="h-4.5 w-4.5 text-emerald-400" />
                          Grafo Cognitivo Ativo
                        </CardTitle>
                        <CardDescription className="text-xs">Topologia semântica do atendente em tempo real.</CardDescription>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs h-8 rounded-xl" onClick={() => setActiveTab("graph")}>
                        Ver Grafo Completo <ArrowRight size={14} className="ml-1" />
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-card/60 border border-border/50">
                          <p className="text-[10px] uppercase text-muted-foreground font-semibold">Tópicos</p>
                          <p className="text-xl font-bold text-foreground mt-0.5">{graphStats?.topics || 0}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-card/60 border border-border/50">
                          <p className="text-[10px] uppercase text-muted-foreground font-semibold">Objeções</p>
                          <p className="text-xl font-bold text-rose-400 mt-0.5">{graphStats?.objections || 0}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-card/60 border border-border/50">
                          <p className="text-[10px] uppercase text-muted-foreground font-semibold">Preferências</p>
                          <p className="text-xl font-bold text-lime-400 mt-0.5">{graphStats?.preferences || 0}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-card/60 border border-border/50">
                          <p className="text-[10px] uppercase text-muted-foreground font-semibold">Conexões</p>
                          <p className="text-xl font-bold text-indigo-400 mt-0.5">{graphData.edges?.length || 0}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        O Grafo Ativo de Memória correlaciona o cliente aos produtos de interesse, hábitos de conversação e objeções para antecipar respostas com segurança.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Token Chart */}
                  <Card className="glass-card rounded-2xl border-border/70">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4.5 w-4.5 text-primary" />
                        <CardTitle className="text-base font-display">Consumo de Contexto (Tokens)</CardTitle>
                      </div>
                      <CardDescription className="text-xs">Volume de dados injetados dinamicamente nos prompts.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-56 w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tokenHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                          <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}`} />
                          <RechartsTooltip 
                            contentStyle={{ 
                              backgroundColor: "rgba(30, 41, 59, 0.95)", 
                              border: "1px solid rgba(148, 163, 184, 0.2)",
                              borderRadius: "8px",
                              color: "#fff",
                              fontSize: "11px"
                            }} 
                            itemStyle={{ color: "#10b981", fontWeight: 600 }}
                            formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Uso']}
                            labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="tokens" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorTokens)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* TAB 2: GRAFO ATIVO DE MEMÓRIA (GRAPHIFY) */}
            {activeTab === "graph" && (
              <div className="space-y-6">
                {/* Node Type Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 mr-1">
                    <Target size={14} /> Filtrar Nós:
                  </span>
                  {[
                    { key: "all", label: "Todos os Nós", count: graphData.nodes?.length || 0, color: "bg-primary/20 text-primary border-primary/40" },
                    { key: "contact", label: "Contatos", count: graphStats?.contacts || graphData.nodes?.filter(n => n.type === 'contact').length || 0, color: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
                    { key: "topic", label: "Tópicos", count: graphStats?.topics || graphData.nodes?.filter(n => n.type === 'topic').length || 0, color: "bg-pink-500/20 text-pink-400 border-pink-500/40" },
                    { key: "episode", label: "Episódios", count: graphStats?.episodes || graphData.nodes?.filter(n => n.type === 'episode').length || 0, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
                    { key: "product", label: "Produtos", count: graphStats?.products || graphData.nodes?.filter(n => n.type === 'product').length || 0, color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
                    { key: "objection", label: "Objeções", count: graphStats?.objections || graphData.nodes?.filter(n => n.type === 'objection').length || 0, color: "bg-rose-500/20 text-rose-400 border-rose-500/40" },
                    { key: "preference", label: "Preferências", count: graphStats?.preferences || graphData.nodes?.filter(n => n.type === 'preference').length || 0, color: "bg-lime-500/20 text-lime-400 border-lime-500/40" },
                    { key: "habit", label: "Hábitos", count: graphStats?.habits || graphData.nodes?.filter(n => n.type === 'habit').length || 0, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
                    { key: "insight", label: "Insights", count: graphStats?.insights || graphData.nodes?.filter(n => n.type === 'insight').length || 0, color: "bg-teal-500/20 text-teal-400 border-teal-500/40" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setNodeTypeFilter(filter.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        nodeTypeFilter === filter.key
                          ? `${filter.color} shadow-sm ring-1 ring-white/20`
                          : "bg-card/60 text-muted-foreground border-border/50 hover:bg-muted/40"
                      }`}
                    >
                      {filter.label}
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/60 font-mono">
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  {/* Graph Canvas Visualizer */}
                  <Card className="glass-card rounded-2xl border-border/70 overflow-hidden md:col-span-2 shadow-sm flex flex-col">
                    <CardHeader className="pb-2 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-display flex items-center gap-2">
                          <TreeStructure size={18} className="text-emerald-400" />
                          Topologia Cognitiva em Grafo (Graphify)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Nós semânticos capturados por atendente e conexão: entidades, conversas, tópicos e relações.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                        {filteredGraphNodes.length} nós ativos
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 min-h-[550px] relative bg-background/50">
                      {filteredGraphNodes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[550px] text-center p-8">
                          <TreeStructure size={48} className="text-muted-foreground/30 mb-3" />
                          <p className="font-semibold text-foreground text-sm">Grafo de Memória em Construção</p>
                          <p className="text-xs text-muted-foreground max-w-sm mt-1">
                            À medida que os clientes interagem com a IA no WhatsApp, o grafo mapeia automaticamente entidades, intenções, produtos e hábitos.
                          </p>
                        </div>
                      ) : (
                        <MemoryGraphViewer
                          graphData={{ nodes: filteredGraphNodes, edges: filteredGraphEdges }}
                          height={550}
                          onNodeClick={(node) => setSelectedNode(node)}
                        />
                      )}
                    </CardContent>
                  </Card>

                  {/* Node Details / Inspector Sidebar */}
                  <div className="space-y-6 md:col-span-1">
                    <Card className="glass-card rounded-2xl border-border/70 shadow-sm">
                      <CardHeader className="pb-3 border-b border-border/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Lightbulb size={18} className="text-amber-400" />
                            <CardTitle className="text-base font-display">Inspetor do Nó</CardTitle>
                          </div>
                          {selectedNode && (
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                              {selectedNode.type}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          {selectedNode ? "Detalhes do elemento cognitivo selecionado no grafo." : "Clique em qualquer nó do grafo para inspecionar suas conexões."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4 text-xs">
                        {selectedNode ? (
                          <div className="space-y-3 animate-fadeIn">
                            <div>
                              <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Rótulo / Identificador</span>
                              <p className="text-sm font-bold text-foreground mt-0.5">{selectedNode.label || selectedNode.id}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 py-2 border-y border-border/40">
                              <div>
                                <span className="text-[10px] text-muted-foreground">Tipo de Nó</span>
                                <p className="font-semibold text-foreground uppercase text-[11px]">{selectedNode.type}</p>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground">Peso / Frequência</span>
                                <p className="font-semibold text-emerald-400 font-mono text-sm">{selectedNode.weight || 1}x</p>
                              </div>
                            </div>

                            {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Metadados & Contexto</span>
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 space-y-1 font-mono text-[11px]">
                                  {Object.entries(selectedNode.properties).map(([k, v]) => (
                                    <div key={k} className="flex justify-between gap-2 overflow-hidden text-ellipsis">
                                      <span className="text-muted-foreground">{k}:</span>
                                      <span className="text-foreground truncate max-w-[150px]">{String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Connected Edges */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Conexões no Grafo</span>
                              <div className="max-h-36 overflow-y-auto space-y-1 scrollbar-thin">
                                {graphData.edges?.filter(e => (typeof e.source === 'object' ? e.source.id : e.source) === selectedNode.id || (typeof e.target === 'object' ? e.target.id : e.target) === selectedNode.id).map((edge, idx) => {
                                  const targetId = (typeof edge.target === 'object' ? edge.target.id : edge.target);
                                  const sourceId = (typeof edge.source === 'object' ? edge.source.id : edge.source);
                                  const isOutgoing = sourceId === selectedNode.id;
                                  return (
                                    <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-card border border-border/40 text-[11px]">
                                      <ArrowRight size={12} className={isOutgoing ? "text-primary" : "text-emerald-400"} />
                                      <span className="text-muted-foreground font-medium">{edge.relation}</span>
                                      <span className="text-foreground truncate ml-auto">{isOutgoing ? targetId : sourceId}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <Target size={32} className="opacity-40 mb-2" />
                            <p className="font-medium text-xs">Nenhum nó selecionado</p>
                            <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-[200px]">
                              Navegue pelo canvas e clique em qualquer nó para inspecionar seus dados semânticos.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Taxonomy Cognitive Summary Card */}
                    <Card className="glass-card rounded-2xl border-border/70 shadow-sm">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Resumo da Arquitetura de Memória
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-border/30">
                          <span className="text-muted-foreground">Episódios Conversacionais</span>
                          <span className="font-semibold">{graphStats?.episodes || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-border/30">
                          <span className="text-muted-foreground">Tópicos e Conceitos</span>
                          <span className="font-semibold">{(graphStats?.topics || 0) + (graphStats?.concepts || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-border/30">
                          <span className="text-muted-foreground">Objeções & Dúvidas</span>
                          <span className="font-semibold text-rose-400">{graphStats?.objections || 0}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-border/30">
                          <span className="text-muted-foreground">Hábitos e Preferências</span>
                          <span className="font-semibold text-lime-400">{(graphStats?.preferences || 0) + (graphStats?.habits || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-muted-foreground">Relações no Grafo</span>
                          <span className="font-bold text-foreground font-mono">{graphData.edges?.length || 0}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ATTENDANT EVOLUTION */}
            {activeTab === "evolution" && (
              <div className="space-y-6">
                {/* Evolution Level & Score Banner */}
                <Card className="glass-card rounded-2xl border-border/70 border-l-4 border-l-indigo-500 overflow-hidden shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/40 text-xs">
                            Evolução Contínua Ativa
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Atendente: <strong className="text-foreground capitalize">{selectedAgentKey}</strong>
                          </span>
                        </div>
                        <h3 className="text-2xl font-display font-black text-foreground">
                          {evolutionData?.evolution?.level || "Nível 1 (Iniciante)"}
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-xl">
                          O atendente evolui dinamicamente conforme atende clientes reais e armazena padrões, preferências e objeções no Grafo Ativo de Memória.
                        </p>
                      </div>

                      <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-2xl border border-border/50">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pontuação Cognitiva</span>
                          <div className="text-3xl font-display font-black text-indigo-400">
                            {evolutionData?.evolution?.score || 10}<span className="text-xs text-muted-foreground font-normal">/100</span>
                          </div>
                        </div>
                        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                          <Sparkle size={28} weight="duotone" />
                        </div>
                      </div>
                    </div>

                    {/* Progress to Next Goal */}
                    <div className="mt-6 space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-muted-foreground">Progresso no Nível Atual</span>
                        <span className="text-foreground">
                          {evolutionData?.evolution?.goal?.current || 0} / {evolutionData?.evolution?.goal?.target || 10} conversas ({evolutionData?.evolution?.goal?.percentage || 0}%)
                        </span>
                      </div>
                      <Progress value={evolutionData?.evolution?.goal?.percentage || 0} className="h-2 rounded-full" />
                    </div>
                  </CardContent>
                </Card>

                {/* Score Components Breakdown */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <Card className="glass-card rounded-2xl border-border/70 p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Conversas Qualificadas</span>
                      <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Máx 40 pts</Badge>
                    </div>
                    <div className="text-2xl font-display font-black text-foreground">
                      {evolutionData?.evolution?.components?.answers || 0} <span className="text-xs text-muted-foreground font-normal">pts</span>
                    </div>
                    <Progress value={((evolutionData?.evolution?.components?.answers || 0) / 40) * 100} className="h-1.5" />
                  </Card>

                  <Card className="glass-card rounded-2xl border-border/70 p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Refinamentos de Estilo</span>
                      <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">Máx 30 pts</Badge>
                    </div>
                    <div className="text-2xl font-display font-black text-foreground">
                      {evolutionData?.evolution?.components?.refinements || 0} <span className="text-xs text-muted-foreground font-normal">pts</span>
                    </div>
                    <Progress value={((evolutionData?.evolution?.components?.refinements || 0) / 30) * 100} className="h-1.5" />
                  </Card>

                  <Card className="glass-card rounded-2xl border-border/70 p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Cobertura de Tópicos</span>
                      <Badge variant="outline" className="text-[10px] text-pink-400 border-pink-500/30">Máx 20 pts</Badge>
                    </div>
                    <div className="text-2xl font-display font-black text-foreground">
                      {evolutionData?.evolution?.components?.coverage || 0} <span className="text-xs text-muted-foreground font-normal">pts</span>
                    </div>
                    <Progress value={((evolutionData?.evolution?.components?.coverage || 0) / 20) * 100} className="h-1.5" />
                  </Card>

                  <Card className="glass-card rounded-2xl border-border/70 p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">Fila Zero-Gaps</span>
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Máx 10 pts</Badge>
                    </div>
                    <div className="text-2xl font-display font-black text-foreground">
                      {evolutionData?.evolution?.components?.queue || 0} <span className="text-xs text-muted-foreground font-normal">pts</span>
                    </div>
                    <Progress value={((evolutionData?.evolution?.components?.queue || 0) / 10) * 100} className="h-1.5" />
                  </Card>
                </div>

                {/* Evolution History Timeline */}
                <Card className="glass-card rounded-2xl border-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <Clock className="h-4.5 w-4.5 text-primary" />
                      Histórico Evolutivo do Atendente
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Registro contínuo e auditável de lições, refinamentos e adaptações de linguagem aplicadas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {evolutionData?.history && evolutionData.history.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                        {evolutionData.history.map((log: any, i: number) => (
                          <div key={log.id || i} className="p-3.5 rounded-xl border border-border/50 bg-card/60 flex items-start justify-between gap-4 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] uppercase font-bold text-indigo-400 border-indigo-500/30">
                                  {log.change_type || 'Adaptação'}
                                </Badge>
                                <span className="text-muted-foreground text-[10px]">
                                  {new Date(log.created_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <p className="font-semibold text-foreground">{log.source_description || 'Ajuste cognitivo aplicado'}</p>
                            </div>
                            <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-1" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 text-muted-foreground border border-dashed border-border/40 rounded-xl">
                        <CheckCircle size={32} className="mx-auto mb-2 opacity-40 text-emerald-400" />
                        <p className="text-xs font-semibold text-foreground">Nenhuma alteração pendente</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          O atendente está sincronizado com a base de conhecimento e aprendizados recentes.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 4: REGISTROS DE CONTATOS */}
            {activeTab === "contacts" && (
              <div className="space-y-6">
                {/* Search Database Card */}
                <Card className="glass-card rounded-2xl border-border/70">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg font-display flex items-center gap-1.5">
                          <Database className="h-5 w-5 text-primary" />
                          Explorador de Memórias Contextuais
                        </CardTitle>
                        <CardDescription className="text-xs">Consulte e verifique o que a IA aprendeu de cada contato.</CardDescription>
                      </div>
                      
                      {/* Search Bar */}
                      <div className="relative w-full sm:w-64">
                        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nome, fone, tag..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-9 text-xs pl-9 pr-8 rounded-xl bg-background/50 border-border/80 focus-visible:ring-primary"
                        />
                        {isSearching && (
                          <div className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    
                    <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1.5 scrollbar-thin animate-fadeIn">
                      <AnimatePresence mode="popLayout">
                        {memories.length === 0 ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/40 rounded-2xl bg-muted/5"
                          >
                            <Brain className="h-10 w-10 text-muted-foreground/60 mb-2" />
                            <p className="text-sm font-semibold text-foreground">Nenhuma memória encontrada</p>
                            <p className="text-xs text-muted-foreground max-w-sm mt-1">
                              A IA ainda não registrou memórias para esta busca ou não há conversas ativas. As memórias são formadas automaticamente à medida que as conversas avançam.
                            </p>
                          </motion.div>
                        ) : (
                          memories.map((entry, index) => {
                            const sentimentInfo = 
                              entry.sentiment === "positive" 
                                ? { bg: "bg-emerald-500/10 text-emerald-400", label: "Positivo" }
                                : entry.sentiment === "negative"
                                ? { bg: "bg-rose-500/10 text-rose-400", label: "Negativo" }
                                : { bg: "bg-slate-500/10 text-slate-400", label: "Neutro" };

                            return (
                              <motion.div
                                key={entry.id || entry.phone || index}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.2, delay: index * 0.02 }}
                                onClick={() => {
                                  setSelectedMemory(entry);
                                  setIsDetailOpen(true);
                                }}
                                className="group p-4 rounded-xl border border-border/60 bg-card/40 hover:bg-card/90 hover:border-primary/40 transition-all cursor-pointer flex flex-col gap-2 relative shadow-sm"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs font-display">
                                      {entry.name ? entry.name.charAt(0).toUpperCase() : "U"}
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                        {entry.name || "Contato sem nome"}
                                        {entry.phone && (
                                          <span className="text-[10px] text-muted-foreground font-mono font-normal">
                                            ({entry.phone})
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className={`text-[9px] px-2 py-0.5 border-none ${sentimentInfo.bg}`}>
                                      {sentimentInfo.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-border/80 text-muted-foreground uppercase">
                                      {entry.intent || "geral"}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Summary preview */}
                                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                  {entry.summary || "Sem resumo computado ainda. As interações estão sendo analisadas."}
                                </p>

                                {/* Tags and Meta info */}
                                <div className="flex items-center justify-between pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                                  <div className="flex flex-wrap gap-1 items-center max-w-[80%]">
                                    {entry.tags && entry.tags.length > 0 ? (
                                      entry.tags.slice(0, 3).map((tag, tIndex) => (
                                        <span key={tIndex} className="px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground font-medium">
                                          #{tag}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="italic opacity-60">Sem etiquetas</span>
                                    )}
                                    {entry.tags && entry.tags.length > 3 && (
                                      <span className="text-[9px] font-semibold text-muted-foreground">
                                        +{entry.tags.length - 3}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {entry.last_updated ? new Date(entry.last_updated).toLocaleDateString("pt-BR") : "Recente"}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </AnimatePresence>
                    </div>

                  </CardContent>
                </Card>

                {/* Intent & Token Usage Chart */}
                <div className="grid gap-6 sm:grid-cols-2">
                  
                  {/* Intent Bar Chart */}
                  <Card className="glass-card rounded-2xl border-border/70">
                    <CardHeader className="pb-1">
                      <div className="flex items-center gap-2">
                        <ChartPieSlice className="h-4.5 w-4.5 text-primary" />
                        <CardTitle className="text-base font-display">Intenções Mapeadas</CardTitle>
                      </div>
                      <CardDescription className="text-xs">Categorias de intenção identificadas pela IA.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3">
                      {intentData.length > 0 ? (
                        <div className="h-44 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={intentData} layout="vertical" margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" horizontal={true} vertical={false} />
                              <XAxis type="number" stroke="rgba(148, 163, 184, 0.4)" fontSize={9} />
                              <YAxis dataKey="name" type="category" stroke="rgba(148, 163, 184, 0.4)" fontSize={9} width={80} />
                              <RechartsTooltip 
                                contentStyle={{ 
                                  backgroundColor: "rgba(30, 41, 59, 0.9)", 
                                  border: "1px solid rgba(148, 163, 184, 0.2)",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  color: "#fff"
                                }} 
                              />
                              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12}>
                                {intentData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
                          Nenhuma intenção catalogada
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Token Growth Area Chart */}
                  <Card className="glass-card rounded-2xl border-border/70">
                    <CardHeader className="pb-1">
                      <div className="flex items-center gap-2">
                        <TrendUp className="h-4.5 w-4.5 text-emerald-400" />
                        <CardTitle className="text-base font-display">Acumulado de Tokens</CardTitle>
                      </div>
                      <CardDescription className="text-xs">Volume de memória sincronizado por dia.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 flex flex-col justify-end h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tokenHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#64748b" 
                            fontSize={9} 
                            tickLine={false} 
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis 
                            stroke="#64748b" 
                            fontSize={9} 
                            tickLine={false} 
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                          />
                          <RechartsTooltip 
                            contentStyle={{ 
                              backgroundColor: "rgba(30, 41, 59, 0.9)", 
                              border: "1px solid rgba(148, 163, 184, 0.2)",
                              borderRadius: "8px",
                              color: "#fff",
                              fontSize: "11px"
                            }} 
                            itemStyle={{ color: "#10b981", fontWeight: 600 }}
                            formatter={(value: number) => [`${value.toLocaleString()} tokens`, 'Uso']}
                            labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="tokens" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorTokens)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                </div>

              </div>
            )}

          </div>
        )}
      </div>

      {/* Inspection Drawer (Sheet) */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-md w-full bg-card/95 border-l border-border/80 text-foreground overflow-y-auto pr-3">
          <SheetHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-base font-bold font-display">
                {selectedMemory?.name ? selectedMemory.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="text-left">
                <SheetTitle className="text-base font-bold font-display text-foreground">{selectedMemory?.name || "Detalhes do Contato"}</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">{selectedMemory?.phone || "Sem telefone"}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {selectedMemory && (
            <div className="py-5 space-y-6">
              
              {/* Intent & Sentiment Badges */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-border p-3 bg-background/40">
                  <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider mb-1">Intenção Identificada</span>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5 py-0.5 w-full justify-center">
                    {selectedMemory.intent || "Dúvida"}
                  </Badge>
                </div>
                
                <div className="rounded-xl border border-border p-3 bg-background/40">
                  <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider mb-1">Sentimento Geral</span>
                  <Badge variant="outline" className={`text-xs border-none py-0.5 w-full justify-center ${
                    selectedMemory.sentiment === "positive" 
                      ? "bg-emerald-500/10 text-emerald-400" 
                      : selectedMemory.sentiment === "negative"
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-slate-500/10 text-slate-400"
                  }`}>
                    {selectedMemory.sentiment === "positive" ? "Positivo" : selectedMemory.sentiment === "negative" ? "Negativo" : "Neutro"}
                  </Badge>
                </div>
              </div>

              {/* AI Executive Summary */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-primary flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Resumo Cognitivo da IA
                </Label>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-foreground italic">
                  "{selectedMemory.summary || "Sem resumo disponível para este contato. A IA compila e atualiza este resumo conforme o contato avança."}"
                </div>
              </div>

              {/* Tags Section */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  Etiquetas Aprendidas
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMemory.tags && selectedMemory.tags.length > 0 ? (
                    selectedMemory.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5 rounded">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Nenhuma etiqueta aprendida ainda.</span>
                  )}
                </div>
              </div>

              {/* Metrics section */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <TrendUp className="h-4 w-4" />
                  Estatísticas do Contato
                </Label>
                <div className="rounded-xl border border-border bg-background/25 p-3 text-xs space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Mensagens processadas</span>
                    <span className="font-semibold">{selectedMemory.metrics?.totalMessages || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Áudios compartilhados</span>
                    <span className="font-semibold">{selectedMemory.metrics?.audioRequests || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Última atualização</span>
                    <span>{selectedMemory.last_updated ? new Date(selectedMemory.last_updated).toLocaleString("pt-BR") : "Desconhecido"}</span>
                  </div>
                </div>
              </div>

              {/* Chat Transcript Accordion/Scroller */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <ChatCircle className="h-4 w-4" />
                  Diálogos Gravados no Contexto ({selectedMemory.messages?.length || 0})
                </Label>
                <div className="rounded-xl border border-border bg-background/10 max-h-48 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
                  {selectedMemory.messages && selectedMemory.messages.length > 0 ? (
                    selectedMemory.messages.map((msg, i) => {
                      const isUser = msg.role === "user";
                      return (
                        <div key={i} className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                            isUser 
                              ? "bg-primary text-white rounded-tr-none" 
                              : "bg-muted/70 text-foreground rounded-tl-none border border-border/50"
                          }`}>
                            {msg.content}
                          </div>
                          <span className="text-[8px] text-muted-foreground px-1">
                            {isUser ? "Cliente" : "IA Assistente"}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-muted-foreground">
                      Nenhuma mensagem gravada na memória de contexto.
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-border flex items-center gap-2">
                <Button className="flex-1 rounded-xl text-xs h-9 font-medium" onClick={() => {
                  setIsDetailOpen(false);
                  navigate("/inbox");
                }}>
                  <ChatCircle className="h-4 w-4 mr-1.5" />
                  Abrir no Chat ao Vivo
                </Button>
                
                <Button variant="outline" className="rounded-xl text-xs h-9 font-medium border-border/80" onClick={() => setIsDetailOpen(false)}>
                  Fechar
                </Button>
              </div>

            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}