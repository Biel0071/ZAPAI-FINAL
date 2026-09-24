import React, { useState, useEffect, useCallback } from "react";
import {
  Brain,
  ShieldCheck,
  BookOpen,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  XCircle,
  FlaskConical,
  RefreshCw,
  Layers,
  Store,
  Bot,
  Network,
  MessageSquare,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN, requestApiEndpoint } from "@/services/apiService";
import { HistoryBootstrapPanel } from './HistoryBootstrapPanel';
import { AgentHabboAvatar } from './AgentHabboAvatar';
import { WhiteLabelStoreManager } from './WhiteLabelStoreManager';
import { MemoryGraphViewer } from '@/components/MemoryGraphViewer';

interface EvolutionMetrics {
  officialKnowledgeCount: number;
  activePlaybooks: number;
  testingPlaybooks: number;
  totalExperiences: number;
  humanCorrections: number;
  pendingSuggestions: number;
  responseContinuityRate: number;
  learningRateStatus: string;
}

interface Suggestion {
  id: number;
  pattern_type: string;
  situation_summary: string;
  suggested_strategy: string;
  suggested_cta: string | null;
  observed_frequency: number;
  continuity_impact_pct: number;
  status: string;
  created_at: string;
}

interface AgentItem {
  key: string;
  name: string;
  personality: string;
  active?: boolean;
}

interface StoreItem {
  id: string;
  name: string;
  segment?: string;
  phone?: string;
  website?: string;
}

export function EvolutionCenter() {
  const { toast } = useToast();
  
  // Navigation tabs inside Evolution Center
  const [activeTab, setActiveTab] = useState<'visao' | 'grafo' | 'loja' | 'aprendizado'>('visao');

  // Agent & Store states
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>('camila');
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [currentStore, setCurrentStore] = useState<StoreItem | null>(null);

  // Metrics & Suggestions
  const [metrics, setMetrics] = useState<EvolutionMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Memory Graph Data
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; stats?: any }>({ nodes: [], edges: [] });
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);

  // Agent Evolution Score/Level
  const [agentEvolution, setAgentEvolution] = useState<{
    score: number;
    level: string;
    conversationsCount: number;
  }>({
    score: 75,
    level: 'Nível 3 - Experiente',
    conversationsCount: 0,
  });

  // Fetch agents and stores
  const fetchAgentsAndStores = useCallback(async () => {
    try {
      const res = await requestApiEndpoint<{ agents: AgentItem[]; stores: StoreItem[] }>('/api/ai/history');
      if (res?.agents && res.agents.length > 0) {
        setAgents(res.agents);
        if (!selectedAgentKey || !res.agents.some(a => a.key === selectedAgentKey)) {
          setSelectedAgentKey(res.agents[0].key);
        }
      } else {
        // Fallback default agents
        setAgents([
          { key: 'camila', name: 'Camila', personality: 'Atendente consultiva e humanizada, especialista em fechamento de vendas.' },
          { key: 'julia', name: 'Julia', personality: 'Atendente acolhedora, focada em pós-venda, dúvidas e suporte ágil.' },
          { key: 'pedro', name: 'Pedro', personality: 'Especialista técnico em especificações, catálogo e orçamentos detalhados.' },
          { key: 'rafael', name: 'Rafael', personality: 'Executivo de contas sênior, focado em vendas B2B e grandes pedidos.' },
        ]);
      }
      if (res?.stores) {
        setStores(res.stores);
        if (res.stores.length > 0) {
          setCurrentStore(res.stores[0]);
        }
      }
    } catch (err) {
      console.error('[EvolutionCenter] Error loading agents/stores:', err);
    }
  }, [selectedAgentKey]);

  // Fetch metrics & suggestions
  const fetchMetricsAndSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const [metRes, sugRes] = await Promise.all([
        fetch(`${API_ORIGIN}/api/ai/evolution/metrics`, { credentials: 'omit' }).catch(() => null),
        fetch(`${API_ORIGIN}/api/ai/evolution/suggestions`, { credentials: 'omit' }).catch(() => null)
      ]);

      if (metRes && metRes.ok) {
        const mJson = await metRes.json();
        if (mJson.success) setMetrics(mJson.data);
      }

      if (sugRes && sugRes.ok) {
        const sJson = await sugRes.json();
        if (sJson.success) setSuggestions(sJson.data);
      }
    } catch (err: any) {
      console.error('[EvolutionCenter] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Memory Graph for Selected Agent
  const fetchMemoryGraph = useCallback(async (agentKey: string) => {
    if (!agentKey) return;
    try {
      setGraphLoading(true);
      const res = await requestApiEndpoint<{
        success: boolean;
        data?: { nodes: any[]; edges: any[]; stats?: any };
        evolution?: { score: number; level: string };
        memoryGraph?: { nodes: any[]; edges: any[]; stats?: any };
      }>(`/api/ai/memory/graph?agentKey=${encodeURIComponent(agentKey)}&limit=80`);

      const snap = res?.data || res?.memoryGraph;
      if (snap) {
        const nodes = Array.isArray(snap.nodes) ? snap.nodes : [];
        const edges = Array.isArray(snap.edges) ? snap.edges : [];
        setGraphData({ nodes, edges, stats: snap.stats });

        // Calculate score from real data: nodes + edges + playbooks
        const nodeCount = nodes.length;
        const edgeCount = edges.length;
        const realScore = Math.min(100, Math.max(35, Math.floor(nodeCount * 3 + edgeCount * 2 + 30)));
        const realLevel =
          realScore >= 90 ? 'Nível 5 - Mestre de Vendas' :
          realScore >= 75 ? 'Nível 4 - Sênior Especialista' :
          realScore >= 55 ? 'Nível 3 - Atendente Pleno' :
          realScore >= 35 ? 'Nível 2 - Em Evolução' : 'Nível 1 - Iniciante';

        setAgentEvolution({
          score: realScore,
          level: realLevel,
          conversationsCount: snap.stats?.episodes || Math.floor(nodeCount / 2),
        });
      }
    } catch (err) {
      console.error('[EvolutionCenter] Memory graph error:', err);
    } finally {
      setGraphLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgentsAndStores();
    fetchMetricsAndSuggestions();
  }, [fetchAgentsAndStores, fetchMetricsAndSuggestions]);

  useEffect(() => {
    if (selectedAgentKey) {
      fetchMemoryGraph(selectedAgentKey);
    }
  }, [selectedAgentKey, fetchMemoryGraph]);

  const activeAgent = agents.find((a) => a.key === selectedAgentKey) || agents[0];

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(id);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/suggestions/${id}/approve`, {
        method: "POST",
        credentials: "omit"
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Playbook Aprovado!",
          description: "A estratégia foi promovida a playbook ativo oficial da IA.",
        });
        fetchMetricsAndSuggestions();
      } else {
        toast({ title: "Erro ao aprovar", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestSandbox = async (id: number) => {
    try {
      setActionLoading(id);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/suggestions/${id}/test`, {
        method: "POST",
        credentials: "omit"
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Iniciado Teste Sandbox (10%)",
          description: "O playbook será testado em 10% dos atendimentos sem alterar preços oficiais.",
        });
        fetchMetricsAndSuggestions();
      } else {
        toast({ title: "Erro ao iniciar teste", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setActionLoading(id);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/suggestions/${id}/reject`, {
        method: "POST",
        credentials: "omit"
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Sugestão rejeitada", description: "O padrão foi descartado." });
        fetchMetricsAndSuggestions();
      } else {
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleNodeClick = (node: any) => {
    setSelectedNode(node);
    setIsNodeModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* TOP HEADER: AGENT SELECTION & HABBO PERSONA CARD */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Central de Evolução IA & White-Label
            </h2>
            <p className="text-xs text-muted-foreground">
              Acompanhe o aprendizado, memória em grafo e vincule a persona do atendente a qualquer loja ou produto.
            </p>
          </div>

          {/* Quick Agent Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-primary" /> Atendente Ativo:
            </span>
            <select
              aria-label="Selecionar Atendente"
              value={selectedAgentKey}
              onChange={(e) => setSelectedAgentKey(e.target.value)}
              className="rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-xs text-foreground font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {agents.map((ag) => (
                <option key={ag.key} value={ag.key}>
                  {ag.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* HABBO AVATAR VISUALIZER CARD */}
        <AgentHabboAvatar
          agentName={activeAgent?.name || 'Camila'}
          agentKey={activeAgent?.key || 'camila'}
          personality={activeAgent?.personality}
          level={agentEvolution.level}
          score={agentEvolution.score}
          storeName={currentStore?.name}
          status="active"
          totalMemories={graphData.nodes.length}
          conversationsCount={agentEvolution.conversationsCount}
          onEditAgent={() => setActiveTab('aprendizado')}
        />
      </div>

      {/* NAVIGATION SUBTABS BAR */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2 overflow-x-auto">
        {[
          { key: 'visao', label: '1. Visão Geral & Métricas', icon: Sparkles },
          { key: 'grafo', label: '2. Memória em Grafo (Graphify)', icon: Network, badge: `${graphData.nodes.length} nós` },
          { key: 'loja', label: '3. Loja & Conhecimento (White-Label)', icon: Store },
          { key: 'aprendizado', label: '4. Conversas Reais & Playbooks', icon: BookOpen, badge: `${suggestions.filter(s => s.status === 'pending').length} sugestões` },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: VISÃO GERAL & MÉTRICAS REAIS */}
      {activeTab === 'visao' && (
        <div className="space-y-6 animate-fade-in">
          {/* 5-Layer Authority Flow Diagram */}
          <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-background to-teal-500/10 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Arquitetura de Segurança de 5 Camadas
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Preços oficiais e políticas da loja prevalecem sempre, enquanto a estratégia de vendas evolui.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMetricsAndSuggestions}
                disabled={loading}
                className="h-8 text-xs gap-1.5 self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Atualizar Dados
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="font-semibold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> 1. Verdade Oficial
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Preços, Fretes e Políticas (Imutável)</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="font-semibold text-blue-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" /> 2. Memória Clientes
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Bairro, Itens Cotados, Preferências</p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="font-semibold text-purple-400 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> 3. Playbooks
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Roteiros Comerciais Validados</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="font-semibold text-amber-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> 4. Experiência
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ação x Reação x Intervenções</p>
              </div>
              <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 col-span-2 sm:col-span-1">
                <div className="font-semibold text-teal-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> 5. Evolução
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mineração de Padrões & Sandbox</p>
              </div>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-border/50 bg-card/60 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Verdade Oficial</p>
                  <h3 className="text-2xl font-bold mt-1 text-foreground">
                    {metrics?.officialKnowledgeCount ?? 6} regras
                  </h3>
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Preços & Fretes Protegidos
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 bg-card/60 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Playbooks Ativos</p>
                  <h3 className="text-2xl font-bold mt-1 text-foreground">
                    {metrics?.activePlaybooks ?? 3}
                    {(metrics?.testingPlaybooks ?? 0) > 0 && (
                      <span className="text-xs font-normal text-amber-400 ml-1.5">
                        (+{metrics?.testingPlaybooks} sandbox)
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> Estratégias Comerciais
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                  <BookOpen className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 bg-card/60 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Continuidade de Resposta</p>
                  <h3 className="text-2xl font-bold mt-1 text-foreground">
                    {metrics?.responseContinuityRate ?? 74}%
                  </h3>
                  <p className="text-[11px] text-blue-400 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Clientes mantendo o chat
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/50 bg-card/60 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Memória no Grafo</p>
                  <h3 className="text-2xl font-bold mt-1 text-foreground">
                    {graphData.nodes.length} nós
                  </h3>
                  <p className="text-[11px] text-teal-400 mt-1 flex items-center gap-1">
                    <Network className="w-3 h-3" /> {graphData.edges.length} conexões ativas
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400">
                  <Network className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: MEMÓRIA EM GRAFO (GRAPHIFY) */}
      {activeTab === 'grafo' && (
        <div className="space-y-4 animate-fade-in">
          <Card className="rounded-2xl border border-border/60 bg-card/50 overflow-hidden shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Network className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      Grafo de Memória Semântica — {activeAgent?.name}
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        {graphData.nodes.length} conceitos conectados
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Relações dinâmicas entre clientes, conversas, produtos, objeções e preferências.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMemoryGraph(selectedAgentKey)}
                    disabled={graphLoading}
                    className="h-8 text-xs gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${graphLoading ? 'animate-spin' : ''}`} />
                    Recarregar Grafo
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 relative min-h-[520px] bg-background/50">
              {graphLoading ? (
                <div className="flex flex-col items-center justify-center h-[520px] text-muted-foreground gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Carregando conexões da memória...</span>
                </div>
              ) : graphData.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[520px] text-center p-6 space-y-3">
                  <Network className="w-12 h-12 text-primary/30 animate-pulse" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">Nenhuma conexão registrada no grafo ainda</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Conforme clientes conversam no WhatsApp, o atendente memoriza nomes, hábitos,
                      bairros e objeções automaticamente.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full h-[520px]">
                  <MemoryGraphViewer
                    graphData={graphData}
                    height={520}
                    onNodeClick={handleNodeClick}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: LOJA & CONHECIMENTO (WHITE-LABEL) */}
      {activeTab === 'loja' && (
        <div className="animate-fade-in">
          <WhiteLabelStoreManager
            agents={agents}
            selectedAgentKey={selectedAgentKey}
            onSelectAgent={(key) => setSelectedAgentKey(key)}
          />
        </div>
      )}

      {/* TAB 4: APRENDIZADO CONTÍNUO & PLAYBOOKS */}
      {activeTab === 'aprendizado' && (
        <div className="space-y-6 animate-fade-in">
          {/* History Bootstrap Panel for WhatsApp Sync */}
          <HistoryBootstrapPanel />

          {/* Pending Suggestions Section */}
          <Card className="border border-border/60 bg-card/40 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Sugestões de Evolução Comportamental Mineradas
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Padrões detectados nas conversas reais onde intervenções humanas geraram melhores resultados.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {suggestions.length} identificadas
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              {suggestions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  <Sparkles className="w-7 h-7 mx-auto mb-2 opacity-40 text-amber-400" />
                  Nenhum padrão novo aguardando aprovação no momento. A IA está operando com os playbooks oficiais.
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((sug) => (
                    <div
                      key={sug.id}
                      className="p-3.5 rounded-xl border border-border/50 bg-background/50 hover:border-primary/30 transition-all space-y-2.5 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={sug.status === "approved" ? "default" : sug.status === "testing" ? "secondary" : "outline"}
                            className={
                              sug.status === "approved"
                                ? "bg-emerald-600 text-white"
                                : sug.status === "testing"
                                ? "bg-amber-600 text-white"
                                : "border-amber-500/30 text-amber-400"
                            }
                          >
                            {sug.status === "approved"
                              ? "Playbook Aprovado"
                              : sug.status === "testing"
                              ? "Em Teste Sandbox (10%)"
                              : "Aguardando Aprovação"}
                          </Badge>
                          <span className="font-semibold text-foreground">
                            {sug.situation_summary}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>Frequência: <strong>{sug.observed_frequency}x</strong></span>
                          <span className="text-emerald-400 font-medium">
                            +{sug.continuity_impact_pct}% continuidade
                          </span>
                        </div>
                      </div>

                      <div className="bg-muted/20 rounded-lg p-2.5 space-y-1 border border-border/30">
                        <p className="text-foreground">
                          <strong className="text-muted-foreground">Estratégia Recomendada:</strong> {sug.suggested_strategy}
                        </p>
                        {sug.suggested_cta && (
                          <p className="text-foreground">
                            <strong className="text-muted-foreground">CTA:</strong> "{sug.suggested_cta}"
                          </p>
                        )}
                      </div>

                      {sug.status === "pending" && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-destructive h-7"
                            disabled={actionLoading === sug.id}
                            onClick={() => handleReject(sug.id)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-7"
                            disabled={actionLoading === sug.id}
                            onClick={() => handleTestSandbox(sug.id)}
                          >
                            <FlaskConical className="w-3.5 h-3.5 mr-1" /> Testar Sandbox (10%)
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-7"
                            disabled={actionLoading === sug.id}
                            onClick={() => handleApprove(sug.id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar Playbook
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* NODE DETAILS MODAL */}
      {isNodeModalOpen && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider text-primary">
                  {selectedNode.type}
                </Badge>
                <h3 className="text-base font-bold text-foreground">
                  {selectedNode.label || selectedNode.id}
                </h3>
              </div>
              <button
                onClick={() => setIsNodeModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-background/60 border border-border/60 space-y-1.5 font-mono text-[11px]">
                <div><span className="text-muted-foreground">ID:</span> {selectedNode.id}</div>
                <div><span className="text-muted-foreground">Peso / Frequência:</span> {selectedNode.weight}</div>
                {selectedNode.properties && (
                  <div>
                    <span className="text-muted-foreground">Propriedades:</span>
                    <pre className="mt-1 p-2 rounded bg-muted/30 overflow-x-auto text-[10px]">
                      {JSON.stringify(selectedNode.properties, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => setIsNodeModalOpen(false)}
                className="text-xs font-semibold"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default EvolutionCenter;
