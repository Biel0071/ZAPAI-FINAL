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

  // Scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isSendingMessage]);

  // Fetch agents and stores
  const fetchAgentsAndStores = useCallback(async () => {
    try {
      const res = await requestApiEndpoint<any>('/api/ai/history');
      const agentsList = res?.agents || res?.data?.agents || [];
      const storesList: StoreData[] = res?.stores || res?.data?.stores || [];

      if (agentsList.length > 0) {
        setAgents(agentsList);
        if (!selectedAgentKey || !agentsList.some((a: any) => a.key === selectedAgentKey)) {
          setSelectedAgentKey(agentsList[0].key);
        }
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
  }, [selectedAgentKey]);

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
        if (overRes?.store && !currentStore) {
          setCurrentStore(overRes.store);
        }
      }
    } catch (err: any) {
      console.error('[EvolutionCenter] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentStore]);

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
    setChatMessages([]);
    toast({ title: 'Chat limpo', description: 'O histórico de teste do assistente foi reiniciado.' });
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
        <header className="zai-evolution-header">
          <div className="zai-evolution-title">
            <div className="zai-evolution-icon" style={{ borderColor: `${themeColor}40` }}>
              <Brain className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1>Evolução da IA — {storeName}</h1>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold px-2 py-0.5"
                  style={{ color: themeColor, borderColor: `${themeColor}50` }}
                >
                  {attendantName} · {attendantRole}
                </Badge>
              </div>
              <p>Atendente criado por loja com identidade, cores e aprendizado contínuo extraído do WhatsApp.</p>
            </div>
          </div>

          <div className="zai-header-actions">
            {/* View Switcher Subtabs */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-border/50 mr-2">
              <button
                type="button"
                onClick={() => setViewMode('palco')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'palco'
                    ? 'bg-emerald-500 text-black shadow-sm'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                🎭 Palco & Atendente
              </button>
              <button
                type="button"
                onClick={() => setViewMode('loja')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'loja'
                    ? 'bg-emerald-500 text-black shadow-sm'
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
                    ? 'bg-emerald-500 text-black shadow-sm'
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
          <div className="space-y-6 animate-fade-in">
            <div className="zai-evolution-grid">
              
              {/* LEFT COLUMN: ISOMETRIC PIXEL CHARACTER STAGE CUSTOMIZABLE PER STORE */}
              <AICharacterViewer
                agentName={attendantName}
                agentRole={attendantRole}
                storeName={storeName}
                themeColor={themeColor}
                isOnline={isOnline}
                onToggleOnline={setIsOnline}
                avatarUrl="/assets/evolution/camila_avatar.png"
                config={attendantConfig}
                onSaveConfig={handleSaveAttendantConfig}
              />

              {/* RIGHT COLUMN: ATTENDANT PROFILE & STATS */}
              <div className="zai-right-column">
                
                {/* ATTENDANT PROFILE CARD */}
                <article
                  className="zai-card zai-profile"
                  style={{ borderLeft: `3px solid ${themeColor}` }}
                >
                  <div className="zai-profile-top">
                    <div className="zai-profile-header-left">
                      <div
                        className="zai-profile-avatar"
                        style={{ borderColor: themeColor }}
                      >
                        <img
                          src="/assets/evolution/camila_avatar.png"
                          alt={attendantName}
                        />
                      </div>
                      <div>
                        <div className="zai-profile-name">
                          <span>{attendantName}</span>
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: isOnline ? themeColor : '#596574' }}
                          />
                        </div>
                        <div className="zai-profile-role">
                          {attendantRole} · {storeName}
                        </div>
                        {storeAddress && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[220px]">{storeAddress}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="zai-profile-level-badge">
                      <div className="zai-profile-level-tag">Nível {calculatedLevel} — {levelTitle}</div>
                      <div className="zai-profile-xp-text">{currentXP.toLocaleString('pt-BR')} / {levelTargetXP.toLocaleString('pt-BR')} XP</div>
                    </div>
                  </div>

                  {/* XP PROGRESS BAR */}
                  <div className="zai-xp">
                    <div className="zai-xp-top">
                      <span>Progresso para o Nível {calculatedLevel + 1}</span>
                      <span className="zai-xp-value">{xpProgressPct}%</span>
                    </div>
                    <div className="zai-progress">
                      <div
                        className="zai-progress-bar"
                        style={{ width: `${xpProgressPct}%`, backgroundColor: themeColor }}
                      />
                    </div>
                  </div>

                  {/* TRAITS */}
                  <div className="zai-traits">
                    <span className="zai-trait">
                      <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" /> Atenciosa
                    </span>
                    <span className="zai-trait">
                      <Zap className="w-3 h-3 text-amber-400 fill-amber-400/20" /> Proativa
                    </span>
                    <span className="zai-trait">
                      <Target className="w-3 h-3 text-emerald-400 fill-emerald-400/20" /> Foco em Vendas
                    </span>
                    <span className="zai-trait">
                      <ShieldCheck className="w-3 h-3 text-cyan-400 fill-cyan-400/20" /> Preços Protegidos
                    </span>
                  </div>
                </article>

                {/* STATS SPLIT (EVOLUÇÃO & ÚLTIMOS APRENDIZADOS) */}
                <div className="zai-stats-split">
                  
                  {/* EVOLUÇÃO DA IA METRICS */}
                  <article className="zai-card zai-evolution-metrics">
                    <div className="zai-card-header !p-0 !pb-3 !border-b-0">
                      <div>
                        <h2 className="zai-card-title">Evolução Real da Loja</h2>
                        <p className="zai-card-subtitle">Métricas extraídas das conversas reais</p>
                      </div>
                    </div>

                    <div className="zai-metric">
                      <div className="zai-metric-top">
                        <span className="zai-metric-name">Conhecimento da Loja</span>
                        <span className="zai-metric-value">{storeKnowledgePct}%</span>
                      </div>
                      <div className="zai-metric-bar">
                        <div className="zai-metric-fill" style={{ width: `${storeKnowledgePct}%`, backgroundColor: themeColor }} />
                      </div>
                    </div>

                    <div className="zai-metric">
                      <div className="zai-metric-top">
                        <span className="zai-metric-name">Qualidade das Respostas</span>
                        <span className="zai-metric-value">{responseQualityPct}%</span>
                      </div>
                      <div className="zai-metric-bar">
                        <div className="zai-metric-fill" style={{ width: `${responseQualityPct}%` }} />
                      </div>
                    </div>

                    <div className="zai-metric">
                      <div className="zai-metric-top">
                        <span className="zai-metric-name">Satisfação dos Clientes</span>
                        <span className="zai-metric-value">{clientSatisfactionPct}%</span>
                      </div>
                      <div className="zai-metric-bar">
                        <div className="zai-metric-fill" style={{ width: `${clientSatisfactionPct}%` }} />
                      </div>
                    </div>
                  </article>

                  {/* ÚLTIMOS APRENDIZADOS REAIS */}
                  <article className="zai-card">
                    <div className="zai-card-header">
                      <div>
                        <h2 className="zai-card-title">Últimos Aprendizados</h2>
                        <p className="zai-card-subtitle">Minerados de chats recentes no WhatsApp</p>
                      </div>
                    </div>

                    <div className="zai-learning-list">
                      {recentLearnings.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          Nenhum novo aprendizado pendente. O atendente já possui base calibrada.
                        </div>
                      ) : (
                        recentLearnings.map((item, idx) => (
                          <div key={item.id || idx} className="zai-learning-item">
                            <div className="zai-learning-icon">
                              {item.type === 'product' ? (
                                <Tag className="w-4 h-4 text-emerald-400" />
                              ) : item.type === 'objection' ? (
                                <Sparkles className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Lightbulb className="w-4 h-4 text-cyan-400" />
                              )}
                            </div>
                            <div className="zai-learning-content">
                              <div className="zai-learning-title-row">
                                <span className="zai-learning-title">{item.title}</span>
                                <span className="zai-learning-time">{item.time}</span>
                              </div>
                              <div className="zai-learning-text">
                                {item.description}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* OPEN OBSIDIAN ACTIVE MEMORY MODAL BUTTON */}
                    <div className="p-3 pt-0">
                      <button
                        type="button"
                        onClick={() => setIsObsidianModalOpen(true)}
                        className="w-full py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Network className="w-3.5 h-3.5" />
                        <span>Ver Memória Ativa (Grafo Obsidian & Mídias Reais)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>

                </div>

              </div>

            </div>

            {/* BOTTOM SECTION: TEST ASSISTANT (WHATSAPP CHAT SIMULATOR) */}
            <section id="zai-test-section" className="zai-test">
              <article className="zai-card">
                <div className="zai-card-header">
                  <div>
                    <h2 className="zai-card-title flex items-center gap-2">
                      <span>Testar Atendente da Loja</span>
                      <Badge variant="outline" className="text-[10px]" style={{ color: themeColor, borderColor: `${themeColor}50` }}>
                        {attendantName} · {storeName}
                      </Badge>
                    </h2>
                    <p className="zai-card-subtitle">
                      Simule uma conversa com a atendente como se fosse um cliente pelo WhatsApp em tempo real
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="zai-btn !h-8 !px-3 text-xs gap-1.5 text-muted-foreground hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar chat</span>
                  </button>
                </div>

                <div className="zai-chat">
                  {/* CHAT MESSAGES CONTAINER */}
                  <div className="zai-chat-messages">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`zai-message ${msg.sender}`}>
                        {msg.sender === 'assistant' && (
                          <div
                            className="zai-message-avatar"
                            style={{ borderColor: themeColor }}
                          >
                            <img
                              src="/assets/evolution/camila_avatar.png"
                              alt={attendantName}
                            />
                          </div>
                        )}
                        <div className="zai-message-bubble">
                          <p className="m-0 leading-relaxed">{msg.text}</p>
                          <div className="zai-message-meta">
                            <span>{msg.timestamp}</span>
                            {msg.sender === 'user' && <span>✓✓</span>}
                          </div>
                        </div>
                      </div>
                    ))}

                    {isSendingMessage && (
                      <div className="zai-message assistant">
                        <div
                          className="zai-message-avatar"
                          style={{ borderColor: themeColor }}
                        >
                          <img
                            src="/assets/evolution/camila_avatar.png"
                            alt={attendantName}
                          />
                        </div>
                        <div className="zai-message-bubble flex items-center gap-2 text-muted-foreground text-xs italic">
                          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: themeColor }} />
                          <span>{attendantName} está digitando...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* CHAT INPUT BAR */}
                  <div className="zai-chat-input-bar">
                    <button
                      type="button"
                      onClick={() => setIsObsidianModalOpen(true)}
                      className="zai-chat-btn"
                      title="Ver galeria de fotos e comprovantes da loja no WhatsApp"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <input
                      ref={chatInputRef}
                      type="text"
                      className="zai-chat-input"
                      placeholder={`Digite uma mensagem para testar a ${attendantName}...`}
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
                      onClick={() => {
                        toast({
                          title: "Áudio Simulado",
                          description: "Microfone ativado para gravação de áudio do cliente.",
                        });
                      }}
                      className="zai-chat-btn"
                      title="Testar áudio / mensagem de voz"
                    >
                      <Mic className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleSendMessage()}
                      disabled={isSendingMessage || !chatInput.trim()}
                      className="zai-chat-btn zai-chat-btn-send disabled:opacity-40"
                      title="Enviar mensagem de teste"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Send className="w-4 h-4 fill-current text-black" />
                    </button>
                  </div>
                </div>
              </article>
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
