import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiService, MemoryEntry, MemoryAnalytics } from "@/services/apiService";
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
  FileText
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get memory settings
      const settingsData = await apiService.getMemorySettings(true);
      setEnabled(Boolean(settingsData.enabled));
      setRememberLastOrder(Boolean(settingsData.rememberLastOrder));
      setRememberPreferences(Boolean(settingsData.rememberPreferences));

      // 2. Get analytics
      const analyticsRes = await apiService.getMemoryAnalytics();
      if (analyticsRes && analyticsRes.success) {
        setAnalytics(analyticsRes.data);
      }

      // 3. Search memories (initial query "")
      const searchRes = await apiService.searchMemory("");
      if (searchRes && searchRes.success) {
        setMemories(searchRes.data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar configurações de memória.";
      console.error("[Memory] Load error:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData, retryCount]);

  useEffect(() => {
    if (loading) return;
    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiService.searchMemory(searchQuery);
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
  }, [searchQuery]);

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
      const res = await apiService.flushMemory();
      if (res && res.success) {
        toast({
          title: "Sincronização Concluída",
          description: `${res.data.flushed} memórias sincronizadas no PostgreSQL com sucesso!`,
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

            <div className="flex gap-4 items-center">
              <Button onClick={() => setRetryCount(r => r + 1)} variant="outline" size="sm" className="h-8">Atualizar Dashboard</Button>
            </div>

            {/* Main Content Layout */}
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
                    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/15 px-3.5 py-2.5 transition-colors hover:bg-muted/25">
                      <div className="space-y-0.5 pr-2">
                        <Label htmlFor="memory-enabled" className="cursor-pointer text-xs font-semibold">Memória global</Label>
                        <p className="text-[10px] text-muted-foreground">Persistir fatos contextuais dos chats</p>
                      </div>
                      <Switch id="memory-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/15 px-3.5 py-2.5 transition-colors hover:bg-muted/25">
                      <div className="space-y-0.5 pr-2">
                        <Label htmlFor="memory-last-order" className="cursor-pointer text-xs font-semibold">Lembrar último pedido</Label>
                        <p className="text-[10px] text-muted-foreground">Reter histórico de compras e produtos</p>
                      </div>
                      <Switch id="memory-last-order" checked={rememberLastOrder} onCheckedChange={setRememberLastOrder} disabled={saving || !enabled} />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/15 px-3.5 py-2.5 transition-colors hover:bg-muted/25">
                      <div className="space-y-0.5 pr-2">
                        <Label htmlFor="memory-preferences" className="cursor-pointer text-xs font-semibold">Lembrar preferências</Label>
                        <p className="text-[10px] text-muted-foreground">Salvar gostos, restrições e horários</p>
                      </div>
                      <Switch id="memory-preferences" checked={rememberPreferences} onCheckedChange={setRememberPreferences} disabled={saving || !enabled} />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <Button className="w-full rounded-xl text-xs h-9 shadow-glow font-medium" onClick={() => void handleSaveSettings()} disabled={saving}>
                        {saving ? "Salvando..." : "Salvar Configurações"}
                      </Button>
                      
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

              {/* Right Column: Memory search database & details list */}
              <div className="space-y-6 md:col-span-2">
                
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
                                key={entry.contact_id || index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(index * 0.02, 0.3) }}
                                className="group flex flex-col gap-2.5 rounded-2xl border border-border/60 bg-background/35 p-4 hover:border-primary/50 hover:bg-background/60 transition-all cursor-pointer"
                                onClick={() => {
                                  setSelectedMemory(entry);
                                  setIsDetailOpen(true);
                                }}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold font-display">
                                      {entry.name ? entry.name.charAt(0).toUpperCase() : "U"}
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                                        {entry.name || "Contato"}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground block">{entry.phone || "Sem número"}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <Badge className={`text-[9px] rounded-full px-2 py-0 border-none ${sentimentInfo.bg}`}>
                                      {sentimentInfo.label}
                                    </Badge>
                                    <Badge variant="outline" className="text-[9px] px-2 py-0 border-primary/20 text-primary bg-primary/5">
                                      {entry.intent || "Dúvida"}
                                    </Badge>
                                  </div>
                                </div>

                                {entry.summary && (
                                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 italic bg-muted/5 p-2 rounded-lg border border-border/40">
                                    "{entry.summary}"
                                  </p>
                                )}

                                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/30">
                                  <div className="flex flex-wrap gap-1">
                                    {(entry.tags || []).slice(0, 3).map(tag => (
                                      <span key={tag} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px]">
                                        <Tag className="h-2.5 w-2.5" />
                                        {tag}
                                      </span>
                                    ))}
                                    {(entry.tags || []).length > 3 && (
                                      <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px]">
                                        +{entry.tags.length - 3}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 text-muted-foreground/80">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>
                                      {entry.last_updated ? new Date(entry.last_updated).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Há pouco"}
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

            </div>

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