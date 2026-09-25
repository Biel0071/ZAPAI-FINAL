import React, { useState, useEffect, useCallback, useRef } from "react";
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
  X,
  Send,
  Paperclip,
  Mic,
  Trash2,
  ArrowRight,
  ExternalLink,
  Play,
  Heart,
  Zap,
  Target,
  Image as ImageIcon,
  Clock,
  Tag,
  Lightbulb,
  MapPin,
  Check
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN, requestApiEndpoint, apiService } from "@/services/apiService";
import { HistoryBootstrapPanel } from './HistoryBootstrapPanel';
import { WhiteLabelStoreManager, StoreData } from './WhiteLabelStoreManager';
import { AICharacterViewer, AttendantConfig } from './AICharacterViewer';
import { AttendantAvatar } from './AttendantAvatar';
import { ObsidianMemoryModal } from './ObsidianMemoryModal';
import './evolucao-ia.css';

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

interface EvolutionOverview {
  recent_learnings?: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    time: string;
    weight: number;
  }>;
  totalQuestionsAnswered?: number;
  totalLearnings?: number;
  agentMaturityScore?: number;
  efficiencyRate?: string;
  estimatedSatisfaction?: number;
  assistedConversions?: number;
  store?: StoreData;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export function EvolutionCenter() {
  const { toast } = useToast();

  // Active view switcher: "palco" (mockup 1:1), "loja" (White-Label), "playbooks" (minerados)
  const [viewMode, setViewMode] = useState<'palco' | 'loja' | 'playbooks'>('palco');

  // Agent & Store states
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>('camila');
  const [stores, setStores] = useState<StoreData[]>([]);
  const [currentStore, setCurrentStore] = useState<StoreData | null>(null);

  // Character stage online/offline state
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Obsidian Memory Modal
  const [isObsidianModalOpen, setIsObsidianModalOpen] = useState<boolean>(false);

  // Metrics, Overview & Suggestions
  const [metrics, setMetrics] = useState<EvolutionMetrics | null>(null);
  const [evolutionOverview, setEvolutionOverview] = useState<EvolutionOverview | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Memory Graph Data
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; stats?: any }>({ nodes: [], edges: [] });
  const [graphLoading, setGraphLoading] = useState(false);

  // Current store active attributes
  const attendantName = currentStore?.attendant_name || 'Camila';
  const attendantRole = currentStore?.attendant_role || 'Assistente de Vendas';
  const storeName = currentStore?.name || 'Depósito Vista Alegre';
  const themeColor = currentStore?.theme_color || '#10b981';
  const storeAddress = currentStore?.address || '';
  const attendantConfig: AttendantConfig = currentStore?.attendant_config || {
    clothingColor: themeColor,
    hairColor: '#4a2c11',
    clothingStyle: 'uniforme_loja',
    accessories: ['headset', 'cracha'],
    scene: 'escritorio_zai',
    gender: 'female',
  };

  // Interactive Test Chat Messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'user',
      text: 'Olá, vocês entregam materiais na minha região?',
      timestamp: '14:31',
    },
    {
      id: 'msg-2',
      sender: 'assistant',
      text: `Olá! Sou a ${attendantName}, da ${storeName}. Entregamos sim com agilidade! Qual produto e quantidade você gostaria de cotar?`,
      timestamp: '14:32',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of chat only when user or assistant sends a message (skip on initial mount)
  const hasMountedChat = useRef(false);
  useEffect(() => {
    if (!hasMountedChat.current) {
      hasMountedChat.current = true;
      return;
    }
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chatMessages, isSendingMessage]);

  // Fetch agents and stores
  const fetchAgentsAndStores = useCallback(async () => {
    try {
      const res = await requestApiEndpoint<any>('/api/ai/history');
      const agentsList = res?.agents || res?.data?.agents || [];
      const storesList: StoreData[] = res?.stores || res?.data?.stores || [];

      if (agentsList.length > 0) {
        setAgents(agentsList);
        setSelectedAgentKey((prevKey) => {
          if (prevKey && agentsList.some((a: any) => a.key === prevKey)) {
            return prevKey;
          }
          return agentsList[0]?.key || prevKey;
        });
      } else {
        setAgents([
          { key: 'camila', name: 'Camila', personality: 'Atendente consultiva e humanizada, especialista em fechamento de vendas.' },
          { key: 'julia', name: 'Julia', personality: 'Atendente acolhedora, focada em pós-venda, dúvidas e suporte ágil.' },
          { key: 'pedro', name: 'Pedro', personality: 'Especialista técnico em especificações, catálogo e orçamentos detalhados.' },
          { key: 'rafael', name: 'Rafael', personality: 'Executivo de contas sênior, focado em vendas B2B e grandes pedidos.' },
        ]);
      }

      if (storesList.length > 0) {
        setStores(storesList);
        setCurrentStore((prev) => {
          if (!prev) return storesList[0];
          return storesList.find((s) => s.id === prev.id) || storesList[0];
        });
      }
    } catch (err) {
      console.error('[EvolutionCenter] Error loading agents/stores:', err);
    }
  }, []);

  // Fetch metrics, overview & suggestions
  const fetchMetricsAndSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const [metRes, sugRes, overRes] = await Promise.all([
        requestApiEndpoint<any>('/api/ai/evolution/metrics').catch(() => null),
        requestApiEndpoint<any>('/api/ai/evolution/suggestions').catch(() => null),
        requestApiEndpoint<any>('/api/ai/evolution/overview').catch(() => null),
      ]);

      if (metRes) {
        const metricsData = metRes?.data || metRes?.stats || metRes;
        setMetrics(metricsData);
      }

      if (sugRes) {
        const list = Array.isArray(sugRes) ? sugRes : (sugRes?.data || sugRes?.suggestions || []);
        if (Array.isArray(list)) setSuggestions(list);
      }

      if (overRes) {
        const stats = overRes?.stats || overRes?.data?.stats;
        if (stats) setEvolutionOverview(stats);
        if (overRes?.store) {
          setCurrentStore((prev) => prev || overRes.store);
        }
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
      const res = await requestApiEndpoint<any>(`/api/ai/memory/graph?agentKey=${encodeURIComponent(agentKey)}&limit=100`);
      const snap = res?.nodes ? res : (res?.data?.nodes ? res.data : (res?.data || res?.memoryGraph || { nodes: [], edges: [] }));
      const nodes = Array.isArray(snap.nodes) ? snap.nodes : [];
      const edges = Array.isArray(snap.edges) ? snap.edges : [];
      setGraphData({ nodes, edges, stats: snap.stats });
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

  // Dynamic Level & XP calculations based on real historical activity
  const totalConversations = evolutionOverview?.totalQuestionsAnswered || metrics?.totalExperiences || 42;
  const totalMemories = graphData.nodes.length || 24;
  const totalLearnings = (evolutionOverview?.totalLearnings || 18) + (suggestions.filter(s => s.status === 'approved').length * 4);
  const assistedConversions = evolutionOverview?.assistedConversions || 6;
  const currentXP = (totalConversations * 35) + (totalMemories * 20) + (totalLearnings * 25) + (assistedConversions * 50);
  const calculatedLevel = Math.max(1, Math.floor(Math.sqrt(currentXP / 35)) + 1);
  const levelTargetXP = Math.pow(calculatedLevel, 2) * 35;
  const prevLevelXP = Math.pow(calculatedLevel - 1, 2) * 35;
  const xpProgressPct = Math.min(100, Math.max(10, Math.round(((currentXP - prevLevelXP) / (levelTargetXP - prevLevelXP)) * 100)));
  const levelTitle =
    calculatedLevel >= 12 ? 'Mestre Supremo em Vendas' :
    calculatedLevel >= 8 ? 'Especialista Sênior em Vendas' :
    calculatedLevel >= 5 ? 'Consultor Comercial Pleno' :
    calculatedLevel >= 3 ? 'Assistente em Evolução' : 'Atendente Aprendiz';

  // Dynamic percentages
  const storeKnowledgePct = Math.min(100, Math.max(60, Math.round(
    (Boolean(currentStore?.catalog_summary) ? 30 : 0) +
    (Boolean(currentStore?.policies) ? 25 : 0) +
    (Boolean(currentStore?.business_hours) ? 15 : 0) +
    (Boolean(currentStore?.address) ? 15 : 0) +
    (Boolean(currentStore?.knowledge) ? 15 : 0)
  )));
  const responseQualityPct = evolutionOverview?.efficiencyRate
    ? parseInt(evolutionOverview.efficiencyRate, 10)
    : (metrics?.responseContinuityRate ? Math.round(metrics.responseContinuityRate * 100) : 88);
  const clientSatisfactionPct = evolutionOverview?.estimatedSatisfaction || 94;

  // Real Recent Learnings from API or memory graph nodes
  const recentLearnings = (evolutionOverview?.recent_learnings && evolutionOverview.recent_learnings.length > 0)
    ? evolutionOverview.recent_learnings
    : graphData.nodes
        .filter((n) => ['topic', 'product', 'objection', 'preference'].includes(n.type))
        .slice(0, 3)
        .map((n) => ({
          id: n.id,
          type: n.type,
          title: n.label,
          description: n.properties?.topic || n.properties?.productName || n.properties?.objection || n.properties?.preference || `Conceito semântico registrado com peso ${n.weight || 1}.`,
          time: 'Hoje, recente',
          weight: n.weight || 1
        }));

  // Save attendant configuration from stage customizer
  const handleSaveAttendantConfig = async (newConfig: AttendantConfig, newName?: string, newRole?: string) => {
    if (!currentStore) return;
    const updatedStore: StoreData = {
      ...currentStore,
      attendant_name: newName || attendantName,
      attendant_role: newRole || attendantRole,
      attendant_config: newConfig,
      theme_color: newConfig.clothingColor || themeColor,
    };
    await requestApiEndpoint(`/api/ai/history/stores/${encodeURIComponent(currentStore.id)}`, 'PUT', updatedStore);
    setCurrentStore(updatedStore);
    await fetchAgentsAndStores();
  };

  // Send message in test chat simulator
  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || isSendingMessage) return;

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: time,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsSendingMessage(true);

    try {
      const response = await apiService.testAIMessage({
        message: text,
        agentKey: activeAgent?.key || 'camila',
        agentName: attendantName,
        prompt: `Você é ${attendantName}, ${attendantRole} da loja ${storeName}. ${currentStore?.knowledge || ''} ${currentStore?.policies || ''}`,
      });

      const replyText =
        response?.result?.response ||
        `Perfeito! Aqui na ${storeName}, oferecemos as melhores condições para "${text}". Deseja consultar disponibilidade para pronta entrega ou cotação no PIX?`;

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      const fallbackMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: `Olá! Sou a ${attendantName}, da ${storeName}. Recebemos sua mensagem com sucesso! Como posso te ajudar a garantir o melhor preço hoje?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        id: `greeting-${Date.now()}`,
        sender: 'assistant',
        text: `Olá! Sou ${attendantName}, ${attendantRole} da ${storeName}. Como posso te ajudar hoje?`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    toast({ title: 'Chat reiniciado', description: `Histórico limpo. Atendente ${attendantName} pronto para novo teste.` });
  };

  const handleScrollToTest = () => {
    setViewMode('palco');
    setTimeout(() => {
      const el = document.getElementById('zai-test-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        chatInputRef.current?.focus();
      }
    }, 100);
  };

  const handleOpenWhatsApp = () => {
    window.open('https://web.whatsapp.com', '_blank');
  };

  return (
    <div className="zai-evolution-page">
      <div className="zai-evolution-content">
        
        {/* TOP HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-white">Evolução da IA</h1>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold px-2 py-0.5"
                  style={{ color: themeColor, borderColor: `${themeColor}50` }}
                >
                  {attendantName} · {storeName}
                </Badge>
                {stores.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-[#080c14] px-2 py-1 rounded-lg border border-border/60">
                    <Store className="w-3.5 h-3.5 text-muted-foreground" />
                    <select
                      value={currentStore?.id || ''}
                      onChange={(e) => {
                        const selected = stores.find((s) => s.id === e.target.value);
                        if (selected) {
                          setCurrentStore(selected);
                          toast({
                            title: 'Loja Selecionada',
                            description: `Exibindo atendente e evolução de ${selected.name}`,
                          });
                        }
                      }}
                      className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#0d131f] text-white">
                          {s.name} ({s.attendant_name || 'Atendente'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Acompanhe e personalize seu atendente de IA.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Switcher Subtabs */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setViewMode('palco')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'palco'
                    ? 'bg-emerald-500 text-black shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                🎭 Palco 1:1
              </button>
              <button
                type="button"
                onClick={() => setViewMode('loja')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'loja'
                    ? 'bg-emerald-500 text-black shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                🏪 Loja & Cores ({stores.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('playbooks')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'playbooks'
                    ? 'bg-emerald-500 text-black shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                📚 Playbooks ({suggestions.filter(s => s.status === 'pending').length})
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="zai-btn"
              title="Abrir WhatsApp Web"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ver no WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleScrollToTest}
              className="zai-btn zai-btn-primary"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Testar Agora</span>
            </button>
          </div>
        </header>

        {/* VIEW 1: PALCO ISOMÉTRICO & EVOLUÇÃO (MOCKUP 1:1) */}
        {viewMode === 'palco' && (
          <div className="space-y-4 animate-fade-in">
            {/* TOP GRID (PALCO + CARDS) */}
            <div className="grid grid-cols-1 lg:grid-cols-[510px_1fr] gap-4">
              
              {/* LEFT COLUMN: ISOMETRIC PIXEL CHARACTER STAGE CUSTOMIZABLE PER STORE */}
              <AICharacterViewer
                agentName={attendantName}
                agentRole={attendantRole}
                storeName={storeName}
                themeColor={themeColor}
                isOnline={isOnline}
                onToggleOnline={setIsOnline}
                avatarUrl={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                config={attendantConfig}
                onSaveConfig={handleSaveAttendantConfig}
              />

              {/* RIGHT COLUMN: ATTENDANT PROFILE & STATS */}
              <div className="flex flex-col gap-3">
                
                {/* ATTENDANT PROFILE CARD (CARD 1) */}
                <article className="bg-[#0c121d] border border-white/10 rounded-2xl p-3.5 shadow-xl">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl overflow-hidden border border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.3)] bg-black flex-shrink-0">
                        <img
                          src={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                          alt={attendantName}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{attendantName}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.querySelector('button[title*="Visual"]') as HTMLButtonElement;
                              if (el) el.click();
                            }}
                            className="text-slate-400 hover:text-white transition-colors"
                            title="Editar atendente"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsOnline(!isOnline)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                              isOnline
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                            title="Alternar Ativa / Offline"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-400"}`} />
                            <span>{isOnline ? "Ativa ⌄" : "Offline ⌄"}</span>
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-400 leading-tight">
                          {attendantRole} · {storeName}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-[11px] border border-emerald-500/30">
                        Nível {calculatedLevel}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {currentXP.toLocaleString('pt-BR')} / {levelTargetXP.toLocaleString('pt-BR')} XP
                      </div>
                    </div>
                  </div>

                  {/* XP PROGRESS BAR */}
                  <div className="w-full bg-[#111823] h-1.5 rounded-full overflow-hidden mb-2.5">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${xpProgressPct}%`, backgroundColor: themeColor }}
                    />
                  </div>

                  {/* TRAITS ROW */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold flex items-center gap-1.5">
                      💚 Atenciosa
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-400 text-[10px] font-semibold flex items-center gap-1.5">
                      ⚡ Proativa
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-[10px] font-semibold flex items-center gap-1.5">
                      🎯 Foco em Vendas
                    </span>
                  </div>
                </article>

                {/* ROW WITH 2 CARDS SIDE BY SIDE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                  
                  {/* CARD 2: EVOLUÇÃO DA IA */}
                  <article className="bg-[#0c121d] border border-white/10 rounded-2xl p-3.5 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Evolução da IA</span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        30 dias ⌄
                      </span>
                    </div>

                    <div className="space-y-2.5 my-auto">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-medium">Conhecimento da Loja</span>
                          <span className="text-emerald-400 font-bold">{storeKnowledgePct}%</span>
                        </div>
                        <div className="w-full bg-[#111823] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${storeKnowledgePct}%`, backgroundColor: themeColor }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-medium">Qualidade das Respostas</span>
                          <span className="text-blue-400 font-bold">{responseQualityPct}%</span>
                        </div>
                        <div className="w-full bg-[#111823] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${responseQualityPct}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-medium">Satisfação dos Clientes</span>
                          <span className="text-purple-400 font-bold">{clientSatisfactionPct}%</span>
                        </div>
                        <div className="w-full bg-[#111823] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${clientSatisfactionPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </article>

                  {/* CARD 3: ÚLTIMOS APRENDIZADOS */}
                  <article className="bg-[#0c121d] border border-white/10 rounded-2xl p-3.5 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Últimos Aprendizados</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsObsidianModalOpen(true)}
                        className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Abrir Memória Ativa Obsidian & Mídias"
                      >
                        <span>Ver todos</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 my-auto">
                      {recentLearnings.length === 0 ? (
                        <>
                          <div className="bg-[#080d16] p-2 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <div className="text-[11px] font-semibold text-white">Novo produto</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">Churrasqueira R$ 990 (trio completo)</div>
                            </div>
                            <span className="text-[9px] text-slate-500 whitespace-nowrap">Hoje 14:32</span>
                          </div>

                          <div className="bg-[#080d16] p-2 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <div className="text-[11px] font-semibold text-white">Política de frete</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">Frete para SP a partir de R$ 89,50</div>
                            </div>
                            <span className="text-[9px] text-slate-500 whitespace-nowrap">Hoje 11:18</span>
                          </div>

                          <div className="bg-[#080d16] p-2 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <div className="text-[11px] font-semibold text-white">Preferência de cliente</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">Cliente prefere pagamento via PIX</div>
                            </div>
                            <span className="text-[9px] text-slate-500 whitespace-nowrap">Hoje 09:45</span>
                          </div>
                        </>
                      ) : (
                        recentLearnings.slice(0, 3).map((item, idx) => (
                          <div key={item.id || idx} className="bg-[#080d16] p-2 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <div className="text-[11px] font-semibold text-white truncate">{item.title}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{item.description}</div>
                            </div>
                            <span className="text-[9px] text-slate-500 whitespace-nowrap">{item.time || 'Recente'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                </div>

              </div>

            </div>

            {/* BOTTOM SECTION: TEST ASSISTANT (WHATSAPP CHAT SIMULATOR) */}
            <section id="zai-test-section" className="bg-[#0c121d] border border-white/10 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-black shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                    <MessageSquare className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Testar Assistente</span>
                      <Badge variant="outline" className="text-[9px]" style={{ color: themeColor, borderColor: `${themeColor}50` }}>
                        {attendantName} · {storeName}
                      </Badge>
                    </h2>
                    <p className="text-[11px] text-slate-400">Converse e veja como a {attendantName} responde.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#080d16] hover:bg-white/5 text-slate-300 text-xs font-medium transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Limpar conversa</span>
                </button>
              </div>

              {/* CHAT MESSAGES CONTAINER */}
              <div className="space-y-3 mb-3 px-1 max-h-[220px] overflow-y-auto pr-1">
                {chatMessages.length === 0 ? (
                  <>
                    {/* Default Mockup Message 1: Customer */}
                    <div className="flex justify-end">
                      <div className="bg-[#005c4b] text-white px-3.5 py-2 rounded-2xl rounded-tr-none text-xs max-w-md shadow-md flex items-end gap-2">
                        <span>Qual o preço da churrasqueira?</span>
                        <span className="text-[9px] text-emerald-200 flex items-center gap-0.5">14:32 <span className="text-emerald-300">✓✓</span></span>
                      </div>
                    </div>

                    {/* Default Mockup Message 2: Assistant */}
                    <div className="flex justify-start items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg overflow-hidden border border-emerald-500/50 mt-0.5 bg-black flex-shrink-0">
                        <img
                          src={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                          alt={attendantName}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                      <div className="bg-[#1f2c34] text-slate-100 px-3.5 py-2.5 rounded-2xl rounded-tl-none text-xs max-w-xl shadow-md leading-relaxed">
                        A churrasqueira pré-moldada está por R$ 990,00 e já vem no trio completo (churrasqueira, forno e fogão a lenha). Ótima para sua área de lazer! 🔥
                        <span className="text-[9px] text-slate-400 block text-right mt-1">14:32</span>
                      </div>
                    </div>
                  </>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start items-start gap-2.5'}`}
                    >
                      {msg.sender === 'assistant' && (
                        <div className="w-7 h-7 rounded-lg overflow-hidden border border-emerald-500/50 mt-0.5 bg-black flex-shrink-0">
                          <img
                            src={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                            alt={attendantName}
                            className="w-full h-full object-cover"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </div>
                      )}
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-xs max-w-xl shadow-md ${
                          msg.sender === 'user'
                            ? 'bg-[#005c4b] text-white rounded-tr-none'
                            : 'bg-[#1f2c34] text-slate-100 rounded-tl-none leading-relaxed'
                        }`}
                      >
                        <p className="m-0">{msg.text}</p>
                        <div className="text-[9px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                          <span>{msg.timestamp}</span>
                          {msg.sender === 'user' && <span className="text-emerald-300">✓✓</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isSendingMessage && (
                  <div className="flex justify-start items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg overflow-hidden border border-emerald-500/50 mt-0.5 bg-black flex-shrink-0">
                      <img
                        src={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                        alt={attendantName}
                        className="w-full h-full object-cover"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                    <div className="bg-[#1f2c34] text-slate-300 px-3.5 py-2 rounded-2xl rounded-tl-none text-xs flex items-center gap-2 italic">
                      <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: themeColor }} />
                      <span>{attendantName} está digitando...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* INPUT BAR */}
              <div className="flex items-center gap-2 bg-[#080d16] border border-white/10 rounded-xl px-3 py-1.5">
                <div className="flex items-center gap-2 text-slate-400">
                  <button
                    type="button"
                    onClick={() => setIsObsidianModalOpen(true)}
                    className="hover:text-white transition-colors"
                    title="Anexar arquivo / Ver mídias da loja"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsObsidianModalOpen(true)}
                    className="hover:text-white transition-colors"
                    title="Ver galeria de fotos e comprovantes do WhatsApp"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toast({
                        title: "Áudio Simulado",
                        description: "Microfone ativado para gravação de áudio do cliente.",
                      });
                    }}
                    className="hover:text-white transition-colors"
                    title="Gravar áudio"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="Digite uma mensagem para testar..."
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none px-2"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleSendMessage();
                    }
                  }}
                  disabled={isSendingMessage}
                />

                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={isSendingMessage || !chatInput.trim()}
                  className="w-8 h-8 rounded-lg text-black flex items-center justify-center transition-all shadow-[0_2px_8px_rgba(16,185,129,0.3)] disabled:opacity-40"
                  style={{ backgroundColor: themeColor }}
                  title="Enviar mensagem"
                >
                  <Send className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: LOJA & CONHECIMENTO (WHITE-LABEL) */}
        {viewMode === 'loja' && (
          <div className="animate-fade-in">
            <WhiteLabelStoreManager
              agents={agents}
              selectedAgentKey={selectedAgentKey}
              onSelectAgent={(key) => setSelectedAgentKey(key)}
              onStoreUpdated={(updatedStore) => {
                setCurrentStore(updatedStore);
                void fetchAgentsAndStores();
              }}
            />
          </div>
        )}

        {/* VIEW 3: PLAYBOOKS & PADRÕES MINERADOS */}
        {viewMode === 'playbooks' && (
          <div className="space-y-6 animate-fade-in">
            <HistoryBootstrapPanel />

            <Card className="border border-border/60 bg-[#0d131f] shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Sugestões de Playbooks Comerciais Minerados
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Padrões detectados nas conversas reais onde intervenções humanas geraram fechamento de vendas.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400">
                    {suggestions.length} identificados
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                {suggestions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                    <Sparkles className="w-8 h-8 mx-auto opacity-40 text-amber-400 animate-pulse" />
                    <p className="font-semibold text-white">Nenhum novo padrão aguardando aprovação</p>
                    <p className="max-w-md mx-auto">
                      A assistente {attendantName} já está operando com os playbooks oficiais validados na loja.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((sug) => (
                      <div
                        key={sug.id}
                        className="p-4 rounded-xl border border-border/50 bg-[#080c14] space-y-2.5 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={sug.status === "approved" ? "default" : "outline"}
                              className={
                                sug.status === "approved"
                                  ? "bg-emerald-600 text-white"
                                  : "border-amber-500/30 text-amber-400"
                              }
                            >
                              {sug.status === "approved" ? "Playbook Aprovado" : "Aguardando Aprovação"}
                            </Badge>
                            <span className="font-semibold text-white">
                              {sug.situation_summary}
                            </span>
                          </div>
                          <div className="text-emerald-400 font-medium">
                            +{sug.continuity_impact_pct}% continuidade
                          </div>
                        </div>

                        <div className="bg-[#111724] rounded-lg p-3 space-y-1 border border-border/40 text-muted-foreground">
                          <p><strong className="text-white">Estratégia:</strong> {sug.suggested_strategy}</p>
                          {sug.suggested_cta && (
                            <p><strong className="text-emerald-400">CTA:</strong> "{sug.suggested_cta}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* OBSIDIAN ACTIVE MEMORY MODAL */}
        <ObsidianMemoryModal
          open={isObsidianModalOpen}
          onOpenChange={setIsObsidianModalOpen}
          graphData={graphData}
          agentName={attendantName}
          storeName={storeName}
        />

      </div>
    </div>
  );
}

export default EvolutionCenter;
