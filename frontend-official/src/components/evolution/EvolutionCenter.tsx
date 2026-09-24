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
  Lightbulb
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN, requestApiEndpoint, apiService } from "@/services/apiService";
import { HistoryBootstrapPanel } from './HistoryBootstrapPanel';
import { WhiteLabelStoreManager } from './WhiteLabelStoreManager';
import { AICharacterViewer } from './AICharacterViewer';
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

interface StoreItem {
  id: string;
  name: string;
  segment?: string;
  phone?: string;
  website?: string;
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
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [currentStore, setCurrentStore] = useState<StoreItem | null>(null);

  // Character stage online/offline state
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Obsidian Memory Modal
  const [isObsidianModalOpen, setIsObsidianModalOpen] = useState<boolean>(false);

  // Metrics & Suggestions
  const [metrics, setMetrics] = useState<EvolutionMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Memory Graph Data
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[]; stats?: any }>({ nodes: [], edges: [] });
  const [graphLoading, setGraphLoading] = useState(false);

  // Interactive Test Chat Messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'user',
      text: 'Olá, vocês entregam tinta acrílica no bairro Jardim América?',
      timestamp: '14:31',
    },
    {
      id: 'msg-2',
      sender: 'assistant',
      text: 'Olá! Entregamos sim no Jardim América. Para esse bairro o frete é grátis em compras acima de R$ 150. Qual cor e acabamento você precisa?',
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
      const storesList = res?.stores || res?.data?.stores || [];

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
        setCurrentStore(storesList[0]);
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
        requestApiEndpoint<any>('/api/ai/evolution/metrics').catch(() => null),
        requestApiEndpoint<any>('/api/ai/evolution/suggestions').catch(() => null)
      ]);

      if (metRes) {
        const metricsData = metRes?.data || metRes?.stats || metRes;
        setMetrics(metricsData);
      }

      if (sugRes) {
        const list = Array.isArray(sugRes) ? sugRes : (sugRes?.data || sugRes?.suggestions || []);
        if (Array.isArray(list)) setSuggestions(list);
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
        agentName: activeAgent?.name || 'Camila',
        prompt: activeAgent?.personality,
      });

      const replyText =
        response?.result?.response ||
        `Perfeito! Anotei sua solicitação sobre "${text}". Como posso te ajudar a finalizar seu pedido com o melhor preço?`;

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
        text: 'Olá! No momento estamos com grande volume de mensagens, mas seu pedido tem prioridade máxima. Deseja cotar com entrega imediata?',
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
            <div className="zai-evolution-icon">
              <Brain className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1>Evolução da IA</h1>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 font-semibold px-2 py-0.5">
                  ZAI ENTERPRISE
                </Badge>
              </div>
              <p>Acompanhe o aprendizado, memória e nível de maturidade do seu atendente.</p>
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
                🎭 Palco & Assistente
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
                🏪 Loja & Conhecimento
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
              
              {/* LEFT COLUMN: ISOMETRIC PIXEL CHARACTER STAGE */}
              <AICharacterViewer
                agentName={activeAgent?.name || "Camila"}
                agentRole="Assistente de Vendas"
                isOnline={isOnline}
                onToggleOnline={setIsOnline}
                avatarUrl="/assets/evolution/camila_avatar.png"
              />

              {/* RIGHT COLUMN: CAMILA PROFILE & STATS */}
              <div className="zai-right-column">
                
                {/* CAMILA PROFILE CARD */}
                <article className="zai-card zai-profile">
                  <div className="zai-profile-top">
                    <div className="zai-profile-header-left">
                      <div className="zai-profile-avatar">
                        <img
                          src="/assets/evolution/camila_avatar.png"
                          alt="Camila Avatar"
                        />
                      </div>
                      <div>
                        <div className="zai-profile-name">
                          <span>{activeAgent?.name || "Camila"}</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        </div>
                        <div className="zai-profile-role">
                          Atendente Principal · {currentStore?.name || "Depósito Vista Alegre"}
                        </div>
                      </div>
                    </div>

                    <div className="zai-profile-level-badge">
                      <div className="zai-profile-level-tag">Nível 12 — Especialista em Vendas</div>
                      <div className="zai-profile-xp-text">2.480 / 3.000 XP</div>
                    </div>
                  </div>

                  {/* XP PROGRESS BAR */}
                  <div className="zai-xp">
                    <div className="zai-xp-top">
                      <span>Progresso para o Nível 13</span>
                      <span className="zai-xp-value">82%</span>
                    </div>
                    <div className="zai-progress">
                      <div className="zai-progress-bar" style={{ width: "82%" }} />
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
                  </div>
                </article>

                {/* STATS SPLIT (EVOLUÇÃO & ÚLTIMOS APRENDIZADOS) */}
                <div className="zai-stats-split">
                  
                  {/* EVOLUÇÃO DA IA METRICS */}
                  <article className="zai-card zai-evolution-metrics">
                    <div className="zai-card-header !p-0 !pb-3 !border-b-0">
                      <div>
                        <h2 className="zai-card-title">Evolução da IA</h2>
                        <p className="zai-card-subtitle">Métricas de precisão e aprendizado contínuo</p>
                      </div>
                    </div>

                    <div className="zai-metric">
                      <div className="zai-metric-top">
                        <span className="zai-metric-name">Conhecimento da Loja</span>
                        <span className="zai-metric-value">85%</span>
                      </div>
                      <div className="zai-metric-bar">
                        <div className="zai-metric-fill" style={{ width: "85%" }} />
                      </div>
                    </div>

                    <div className="zai-metric">
                      <div className="zai-metric-top">
                        <span className="zai-metric-name">Qualidade das Respostas</span>
                        <span className="zai-metric-value">78%</span>
                      </div>
                      <div className="zai-metric-bar">
                        <div className="zai-metric-fill" style={{ width: "78%" }} />
                      </div>
                    </div>

                    <div className="zai-metric">
                      <div className="zai-metric-top">
                        <span className="zai-metric-name">Satisfação dos Clientes</span>
                        <span className="zai-metric-value">92%</span>
                      </div>
                      <div className="zai-metric-bar">
                        <div className="zai-metric-fill" style={{ width: "92%" }} />
                      </div>
                    </div>
                  </article>

                  {/* ÚLTIMOS APRENDIZADOS */}
                  <article className="zai-card">
                    <div className="zai-card-header">
                      <div>
                        <h2 className="zai-card-title">Últimos Aprendizados</h2>
                        <p className="zai-card-subtitle">Extraídos de chats reais recentes</p>
                      </div>
                    </div>

                    <div className="zai-learning-list">
                      <div className="zai-learning-item">
                        <div className="zai-learning-icon">
                          <Lightbulb className="w-4 h-4" />
                        </div>
                        <div className="zai-learning-content">
                          <div className="zai-learning-title-row">
                            <span className="zai-learning-title">Tinta Coral Rende Muito 18L</span>
                            <span className="zai-learning-time">Hoje, 14:32</span>
                          </div>
                          <div className="zai-learning-text">
                            Preço R$ 289,90 no PIX, rendimento até 150m².
                          </div>
                        </div>
                      </div>

                      <div className="zai-learning-item">
                        <div className="zai-learning-icon">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="zai-learning-content">
                          <div className="zai-learning-title-row">
                            <span className="zai-learning-title">Objeção: Entrega Zona Sul</span>
                            <span className="zai-learning-time">Hoje, 11:15</span>
                          </div>
                          <div className="zai-learning-text">
                            Confirmado prazo de até 4h e taxa de R$ 25,00.
                          </div>
                        </div>
                      </div>

                      <div className="zai-learning-item">
                        <div className="zai-learning-icon">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div className="zai-learning-content">
                          <div className="zai-learning-title-row">
                            <span className="zai-learning-title">Preço Cimento CP-II 50kg</span>
                            <span className="zai-learning-time">Ontem, 18:40</span>
                          </div>
                          <div className="zai-learning-text">
                            R$ 33,90 a vista / R$ 32,20 PIX lote &gt; 10 sacos.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* OPEN OBSIDIAN ACTIVE MEMORY MODAL BUTTON */}
                    <div className="p-3 pt-0">
                      <button
                        type="button"
                        onClick={() => setIsObsidianModalOpen(true)}
                        className="w-full py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Network className="w-3.5 h-3.5" />
                        <span>Ver todos (Grafo Obsidian & Mídias)</span>
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
                    <h2 className="zai-card-title">Testar Assistente</h2>
                    <p className="zai-card-subtitle">
                      Simule uma conversa como se fosse um cliente pelo WhatsApp em tempo real
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
                          <div className="zai-message-avatar">
                            <img
                              src="/assets/evolution/camila_avatar.png"
                              alt="Camila"
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
                        <div className="zai-message-avatar">
                          <img
                            src="/assets/evolution/camila_avatar.png"
                            alt="Camila"
                          />
                        </div>
                        <div className="zai-message-bubble flex items-center gap-2 text-muted-foreground text-xs italic">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>Camila está digitando...</span>
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
                      title="Anexar ou inspecionar mídias da loja na memória"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <input
                      ref={chatInputRef}
                      type="text"
                      className="zai-chat-input"
                      placeholder="Digite uma mensagem para testar a Camila..."
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
                    >
                      <Send className="w-4 h-4 fill-current" />
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
                      A assistente Camila já está operando com os playbooks oficiais validados na loja.
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
          agentName={activeAgent?.name || "Camila"}
          storeName={currentStore?.name || "Depósito Vista Alegre"}
        />

      </div>
    </div>
  );
}

export default EvolutionCenter;
