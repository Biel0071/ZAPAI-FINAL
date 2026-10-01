import { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen,
  Sparkles,
  TrendingUp,
  Store,
  MessageSquare,
  Send,
  Trash2,
  ArrowRight,
  Play,
  CheckCheck,
  Plus,
  Settings,
  HelpCircle,
  Clock,
  MapPin,
  FileText,
  ShieldCheck,
  Bot,
  ChevronRight,
  Layers,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  ShoppingBag,
  CreditCard
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/state/hooks/use-toast";
import { requestApiEndpoint, apiService } from "@/core/services/apiService";
import { HistoryBootstrapPanel } from './HistoryBootstrapPanel';
import { WhiteLabelStoreManager, StoreData } from './WhiteLabelStoreManager';
import { AICharacterViewer, AttendantConfig } from './AICharacterViewer';
import './evolucao-ia.css';

interface EvolutionMetrics {
  officialKnowledgeCount: number;
  activePlaybooks: number;
  testingPlaybooks: number;
  totalExperiences: number;
  humanCorrections: number;
  pendingSuggestions: number;
  responseContinuityRate: number | null;
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
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

const QUICK_TEST_QUESTIONS = [
  { label: "Horários", icon: Clock, query: "Qual é o horário de atendimento de vocês?" },
  { label: "Catálogo", icon: ShoppingBag, query: "Quais produtos vocês têm disponíveis?" },
  { label: "Pagamento", icon: CreditCard, query: "Quais são as formas de pagamento aceitas?" },
  { label: "Endereço", icon: MapPin, query: "Qual é o endereço e localização da loja?" },
  { label: "Entrega", icon: MessageSquare, query: "Vocês fazem entrega? Como funciona o frete?" },
];

export function EvolutionCenter({
  onManageAgents,
  onOperation,
}: {
  onManageAgents?: () => void;
  onOperation?: () => void;
}) {
  const { toast } = useToast();

  // Dialog Modals
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);

  // Active tab on left column: 'knowledge' | 'learnings'
  const [activeIntelTab, setActiveIntelTab] = useState<'knowledge' | 'learnings'>('knowledge');
  const [showAllRecentLearnings, setShowAllRecentLearnings] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Agent & Store states
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>('');
  const [stores, setStores] = useState<StoreData[]>([]);
  const [currentStore, setCurrentStore] = useState<StoreData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  // Character stage online/offline state
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Metrics, Overview & Suggestions
  const [metrics, setMetrics] = useState<EvolutionMetrics | null>(null);
  const [evolutionOverview, setEvolutionOverview] = useState<EvolutionOverview | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({ metrics: false, overview: false, suggestions: false });

  // Current store active attributes
  const attendantName = currentStore?.attendant_name || 'Atendente';
  const attendantRole = currentStore?.attendant_role || 'Assistente';
  const storeName = currentStore?.name || 'Loja não configurada';
  const themeColor = currentStore?.theme_color || '#10b981';
  const attendantConfig: AttendantConfig = currentStore?.attendant_config || {
    clothingColor: themeColor,
    hairColor: '#4a2c11',
    clothingStyle: 'uniforme_loja',
    accessories: ['headset', 'cracha'],
    scene: 'escritorio_zai',
    gender: 'female',
  };

  // Interactive Test Chat Messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatContextVersionRef = useRef(0);

  const resetChat = () => {
    chatContextVersionRef.current += 1;
    setChatMessages([]);
    setChatInput('');
    setIsSendingMessage(false);
  };

  // Scroll to bottom of chat only when user or assistant sends a message
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
    setHistoryLoading(true);
    try {
      const res = await requestApiEndpoint<any>('/api/ai/history');
      const agentsList = res?.agents || res?.data?.agents || [];
      const storesList: StoreData[] = res?.stores || res?.data?.stores || [];
      setHistoryError(false);

      if (agentsList.length > 0) {
        setAgents(agentsList);
        setSelectedAgentKey((prevKey) => {
          if (prevKey && agentsList.some((a: any) => a.key === prevKey)) {
            return prevKey;
          }
          return agentsList[0]?.key || prevKey;
        });
      } else {
        setAgents([]);
        setSelectedAgentKey('');
      }

      if (storesList.length > 0) {
        setStores(storesList);
        setCurrentStore((prev) => {
          if (!prev) return storesList[0];
          return storesList.find((s) => s.id === prev.id) || storesList[0];
        });
      } else {
        setStores([]);
        setCurrentStore(null);
      }
    } catch (err) {
      console.error('[EvolutionCenter] Error loading agents/stores:', err);
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
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
      const overviewStats = overRes?.stats || overRes?.data?.stats;
      setLoadErrors({ metrics: !metRes, overview: !overviewStats, suggestions: !sugRes });

      if (metRes) {
        const metricsData = metRes?.data || metRes?.stats || metRes;
        setMetrics(metricsData);
      } else setMetrics(null);

      if (sugRes) {
        const list = Array.isArray(sugRes) ? sugRes : (sugRes?.data || sugRes?.suggestions || []);
        if (Array.isArray(list)) setSuggestions(list);
      } else setSuggestions([]);

      if (overRes) {
        if (overviewStats) setEvolutionOverview(overviewStats);
        else setEvolutionOverview(null);
        if (overRes?.store) {
          setCurrentStore((prev) => prev || overRes.store);
        }
      } else setEvolutionOverview(null);
    } catch (err: any) {
      console.error('[EvolutionCenter] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgentsAndStores();
    fetchMetricsAndSuggestions();
  }, [fetchAgentsAndStores, fetchMetricsAndSuggestions]);

  const activeAgent = agents.find((a) => a.key === selectedAgentKey) || agents[0];
  const canTest = Boolean(!historyLoading && !historyError && activeAgent && currentStore);

  // Completeness of the selected store profile, based on configured fields.
  const storeKnowledgePct = Math.min(100, Math.max(0, Math.round(
    (Boolean(currentStore?.catalog_summary) ? 30 : 0) +
    (Boolean(currentStore?.policies) ? 25 : 0) +
    (Boolean(currentStore?.business_hours) ? 15 : 0) +
    (Boolean(currentStore?.address) ? 15 : 0) +
    (Boolean(currentStore?.knowledge) ? 15 : 0)
  )));

  const recentLearnings = evolutionOverview?.recent_learnings ?? [];

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
    resetChat();
    await fetchAgentsAndStores();
  };

  // Send message in test chat simulator
  const handleSendMessage = async (customText?: string) => {
    const text = (customText ?? chatInput).trim();
    if (!text || isSendingMessage || !activeAgent || !currentStore) return;

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: time,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!customText) setChatInput('');
    setIsSendingMessage(true);
    const contextVersion = chatContextVersionRef.current;

    try {
      const response = await apiService.testAIMessage({
        message: text,
        agentKey: activeAgent.key,
        agentName: activeAgent.name,
        prompt: [
          activeAgent.personality,
          `Você é ${activeAgent.name} e atende em nome da loja ${storeName}. Use apenas informações confirmadas da loja; se algo estiver ausente, peça confirmação.`,
          currentStore.address && `Endereço: ${currentStore.address}`,
          currentStore.business_hours && `Horários: ${currentStore.business_hours}`,
          currentStore.catalog_summary && `Catálogo: ${currentStore.catalog_summary}`,
          currentStore.policies && `Políticas: ${currentStore.policies}`,
          currentStore.knowledge && `Conhecimento da loja: ${currentStore.knowledge}`,
        ].filter(Boolean).join('\n\n'),
        history: chatMessages.filter((message) => !message.isError).slice(-12).map((message) => ({
          role: message.sender,
          content: message.text,
        })),
      });

      const replyText = response?.result?.response || response?.error || 'Não foi possível obter uma resposta da IA. Tente novamente.';

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        isError: !response?.result?.response,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      if (contextVersion === chatContextVersionRef.current) {
        setChatMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (error: any) {
      const fallbackMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: error?.message || `Erro de conexão. O servidor da IA não está respondendo. Verifique se o provedor está configurado em Operação.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      if (contextVersion === chatContextVersionRef.current) {
        setChatMessages((prev) => [...prev, fallbackMsg]);
      }
    } finally {
      if (contextVersion === chatContextVersionRef.current) setIsSendingMessage(false);
    }
  };

  const handleClearChat = () => {
    resetChat();
    toast({ title: 'Chat reiniciado', description: 'Envie uma nova pergunta para testar o atendente.' });
  };

  const handleQuickQuestion = (queryText: string) => {
    if (!canTest || isSendingMessage) return;
    setChatInput(queryText);
    void handleSendMessage(queryText);
  };

  const handleCopyPrompt = () => {
    if (!activeAgent?.personality) return;
    navigator.clipboard.writeText(activeAgent.personality);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
    toast({ title: 'Prompt copiado', description: 'Instruções do agente copiadas para a área de transferência.' });
  };

  return (
    <div className="zai-evolution-page">
      <div className="zai-evolution-content space-y-5">
        
        {/* TOP BAR / AGENT HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-[#0c121d] shadow-xl">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.15)] shrink-0"
              style={{
                backgroundColor: `${themeColor}15`,
                border: `1px solid ${themeColor}40`,
                color: themeColor,
              }}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  {activeAgent?.name || 'Seu Primeiro Agente'}
                </h1>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold px-2 py-0.5"
                  style={{ color: themeColor, borderColor: `${themeColor}50` }}
                >
                  {storeName}
                </Badge>

                {/* Multi-store selector */}
                {stores.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-[#080c14] px-2 py-1 rounded-lg border border-border/60">
                    <Store className="w-3.5 h-3.5 text-muted-foreground" />
                    <select
                      value={currentStore?.id || ''}
                      onChange={(e) => {
                        const selected = stores.find((s) => s.id === e.target.value);
                        if (selected) {
                          setCurrentStore(selected);
                          resetChat();
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

                {/* Multi-agent selector */}
                {agents.length > 1 && (
                  <label className="flex items-center gap-1.5 bg-[#080c14] px-2 py-1 rounded-lg border border-border/60 text-xs text-slate-400">
                    Agente
                    <select
                      value={selectedAgentKey}
                      onChange={(event) => {
                        setSelectedAgentKey(event.target.value);
                        resetChat();
                      }}
                      className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer max-w-[140px]"
                      aria-label="Agente usado no teste"
                    >
                      {agents.map((agent) => (
                        <option key={agent.key} value={agent.key} className="bg-[#0d131f] text-white">
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Central do agente: personalidade, base de conhecimento e sandbox de teste em tempo real.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowStoreModal(true)}
              className="text-xs h-8.5 rounded-xl border-white/10 hover:border-emerald-500/40 text-slate-200 hover:text-white bg-[#080d16]"
            >
              <Store className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              <span>Configurar Loja</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setShowCreateAgentModal(true)}
              className="text-xs h-8.5 rounded-xl font-semibold shadow-sm"
              style={{ backgroundColor: themeColor, color: '#000' }}
            >
              <Plus className="w-3.5 h-3.5 mr-1 text-black" />
              <span>Novo Agente</span>
            </Button>
          </div>
        </header>

        {/* ONBOARDING HERO BANNER IF NO AGENT CONFIGURED */}
        {!historyLoading && !historyError && agents.length === 0 && (
          <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5 sm:p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <img
                src="/assets/evolution/habbo_avatar.png"
                alt="Mascote ZAI"
                className="h-16 w-16 shrink-0 rounded-2xl bg-emerald-500/10 object-contain [image-rendering:pixelated]"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-400">Vamos começar</p>
                <h3 className="mt-1 text-xl font-bold text-white">Crie o primeiro atendente inteligente da sua loja</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                  Defina o nome da loja, os horários e o tom de voz do seu assistente. Você poderá testar as respostas antes de ativar o atendimento oficial no WhatsApp.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setShowCreateAgentModal(true)}
                className="font-semibold"
                style={{ backgroundColor: themeColor, color: '#000' }}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Começar · Criar agente
              </Button>
            </div>
          </section>
        )}

        {/* MAIN SPLIT WORKSPACE: LEFT (AGENT PROFILE & INTEL) | RIGHT (WHATSAPP SANDBOX) */}
        {(!agents.length && historyLoading) ? (
          <div className="h-[400px] rounded-2xl border border-white/10 bg-[#0c121d] flex items-center justify-center text-sm text-slate-400">
            Carregando inteligência do agente...
          </div>
        ) : historyError ? (
          <div className="h-[320px] rounded-2xl border border-amber-500/20 bg-[#0c121d] flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-semibold text-white">Não foi possível carregar lojas e agentes</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchAgentsAndStores()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* LEFT COLUMN: CHARACTER STAGE, STORE KNOWLEDGE & EVOLUTION TABS */}
            <div className="lg:col-span-6 xl:col-span-7 space-y-4">
              
              {/* 1. CHARACTER STAGE WITH PIXEL ART VIEWER */}
              <section aria-label="Visual do Atendente">
                {currentStore ? (
                  <AICharacterViewer
                    agentName={activeAgent?.name || attendantName}
                    agentRole={attendantRole}
                    storeName={storeName}
                    themeColor={themeColor}
                    isOnline={isOnline}
                    onToggleOnline={setIsOnline}
                    avatarUrl={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                    config={attendantConfig}
                    onSaveConfig={handleSaveAttendantConfig}
                  />
                ) : (
                  <div className="h-[310px] rounded-2xl border border-dashed border-white/15 bg-[#0c121d] flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <Store className="w-8 h-8 text-emerald-400" />
                    <p className="text-sm font-semibold text-white">Configure sua loja</p>
                    <p className="text-xs text-slate-400">Adicione os dados da empresa para visualizar o avatar da loja.</p>
                    <Button type="button" size="sm" onClick={() => setShowStoreModal(true)}>
                      Configurar Loja
                    </Button>
                  </div>
                )}
              </section>

              {/* 2. STORE KNOWLEDGE STATUS & PILLARS */}
              <section className="bg-[#0c121d] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Base de Conhecimento Oficial
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold"
                      style={{ color: themeColor, borderColor: `${themeColor}40` }}
                    >
                      {currentStore ? `${storeKnowledgePct}% Completo` : 'Pendente'}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setShowStoreModal(true)}
                      className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Editar</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#111823] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${currentStore ? storeKnowledgePct : 0}%`,
                      backgroundColor: themeColor,
                    }}
                  />
                </div>

                {/* 4 Essential Pillars Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                  {/* Pillar: Horários */}
                  <div className="p-2.5 rounded-xl bg-[#080d16] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5 text-[11px]">
                        <Clock className="w-3 h-3 text-emerald-400" /> Horário
                      </span>
                      {currentStore?.business_hours ? (
                        <span className="text-[10px] text-emerald-400 font-bold">✓ Ativo</span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-medium">Pendente</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {currentStore?.business_hours || 'Sem horários definidos. O agente pode não informar quando está aberto.'}
                    </p>
                  </div>

                  {/* Pillar: Catálogo */}
                  <div className="p-2.5 rounded-xl bg-[#080d16] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5 text-[11px]">
                        <ShoppingBag className="w-3 h-3 text-emerald-400" /> Catálogo
                      </span>
                      {currentStore?.catalog_summary ? (
                        <span className="text-[10px] text-emerald-400 font-bold">✓ Ativo</span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-medium">Pendente</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {currentStore?.catalog_summary || 'Sem resumo de produtos. O agente usará apenas respostas gerais.'}
                    </p>
                  </div>

                  {/* Pillar: Políticas */}
                  <div className="p-2.5 rounded-xl bg-[#080d16] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5 text-[11px]">
                        <CreditCard className="w-3 h-3 text-emerald-400" /> Políticas & Pagamentos
                      </span>
                      {currentStore?.policies ? (
                        <span className="text-[10px] text-emerald-400 font-bold">✓ Ativo</span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-medium">Pendente</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {currentStore?.policies || 'Sem formas de pagamento ou políticas de garantia informadas.'}
                    </p>
                  </div>

                  {/* Pillar: Endereço */}
                  <div className="p-2.5 rounded-xl bg-[#080d16] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-semibold flex items-center gap-1.5 text-[11px]">
                        <MapPin className="w-3 h-3 text-emerald-400" /> Endereço & Local
                      </span>
                      {currentStore?.address ? (
                        <span className="text-[10px] text-emerald-400 font-bold">✓ Ativo</span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-medium">Pendente</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {currentStore?.address || 'Sem endereço físico cadastrado.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. SEGMENTED TABS: INSTRUÇÕES DO AGENTE VS APRENDIZADOS E PLAYBOOKS */}
              <section className="bg-[#0c121d] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveIntelTab('knowledge')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        activeIntelTab === 'knowledge'
                          ? 'bg-emerald-500 text-black font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Bot className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                      Instruções do Agente
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIntelTab('learnings')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                        activeIntelTab === 'learnings'
                          ? 'bg-emerald-500 text-black font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <TrendingUp className="inline w-3.5 h-3.5" />
                      <span>Evolução & Playbooks</span>
                      {suggestions.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300 font-bold">
                          {suggestions.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {activeIntelTab === 'knowledge' && (
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                      title="Copiar prompt do agente"
                    >
                      {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPrompt ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  )}
                </div>

                {/* TAB CONTENT: INSTRUÇÕES DO AGENTE */}
                {activeIntelTab === 'knowledge' && (
                  <div className="space-y-3 text-xs animate-fade-in">
                    <div className="p-3 rounded-xl bg-[#080d16] border border-white/5 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                        Personalidade & Tom de Voz
                      </span>
                      <p className="text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[160px] overflow-y-auto pr-1">
                        {activeAgent?.personality || 'Nenhuma instrução específica informada para este agente. O agente atenderá com o tom padrão da plataforma.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Respostas blindadas: Não inventa preços ou produtos não cadastrados.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={onManageAgents}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                        >
                          Gerenciar equipe →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CONTENT: APRENDIZADOS & PLAYBOOKS */}
                {activeIntelTab === 'learnings' && (
                  <div className="space-y-4 text-xs animate-fade-in">
                    {/* Operational metrics */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-xl bg-[#080d16] border border-white/5 text-center">
                        <span className="block text-[10px] text-slate-400">Experiências</span>
                        <span className="text-base font-bold text-blue-400">
                          {metrics?.totalExperiences ?? 0}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#080d16] border border-white/5 text-center">
                        <span className="block text-[10px] text-slate-400">Correções</span>
                        <span className="text-base font-bold text-amber-400">
                          {metrics?.humanCorrections ?? 0}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#080d16] border border-white/5 text-center">
                        <span className="block text-[10px] text-slate-400">Playbooks Minerados</span>
                        <span className="text-base font-bold text-emerald-400">
                          {suggestions.length}
                        </span>
                      </div>
                    </div>

                    {/* Recent Learnings List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          Últimos Aprendizados
                        </span>
                        {recentLearnings.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setShowAllRecentLearnings((open) => !open)}
                            className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            {showAllRecentLearnings ? 'Ver menos' : 'Ver todos'}
                          </button>
                        )}
                      </div>

                      {recentLearnings.length === 0 ? (
                        <p className="text-slate-400 py-3 text-center text-xs">
                          Nenhum aprendizado registrado ainda. Conforme a IA responde aos clientes, novos padrões surgirão aqui.
                        </p>
                      ) : (
                        recentLearnings.slice(0, showAllRecentLearnings ? 8 : 3).map((item, idx) => (
                          <div key={item.id || idx} className="p-2.5 rounded-xl bg-[#080d16] border border-white/5 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-white truncate text-[11px]">{item.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{item.description}</p>
                            </div>
                            <span className="text-[9px] text-slate-500 shrink-0">{item.time || 'Recente'}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Playbook Suggestions */}
                    {suggestions.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                          Playbooks Minerados das Conversas
                        </span>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {suggestions.map((sug) => (
                            <div key={sug.id} className="p-3 rounded-xl bg-[#080d16] border border-white/5 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <Badge
                                  variant="outline"
                                  className={sug.status === "approved" ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}
                                >
                                  {sug.status === "approved" ? "Aprovado" : "Aguardando aprovação"}
                                </Badge>
                                <span className="text-emerald-400 font-bold text-[10px]">
                                  +{sug.continuity_impact_pct}% continuidade
                                </span>
                              </div>
                              <p className="font-semibold text-white text-[11px]">{sug.situation_summary}</p>
                              <p className="text-slate-400 text-[10px] leading-relaxed">
                                <strong className="text-slate-200">Estratégia:</strong> {sug.suggested_strategy}
                              </p>
                              {sug.suggested_cta && (
                                <p className="text-emerald-300 text-[10px]">
                                  <strong>CTA:</strong> "{sug.suggested_cta}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

            </div>

            {/* RIGHT COLUMN: WHATSAPP TEST SANDBOX (SIMULATOR IN VIEW AT ALL TIMES) */}
            <div className="lg:col-span-6 xl:col-span-5">
              <section className="bg-[#0c121d] border border-white/10 rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[580px] sticky top-4">

                {/* SANDBOX HEADER (WhatsApp Styled) */}
                <div className="bg-[#1f2c34] p-3.5 border-b border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-500/50 bg-black shrink-0">
                      <img
                        src={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                        alt={attendantName}
                        className="w-full h-full object-cover"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                        <span>{activeAgent?.name || attendantName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({storeName})</span>
                      </h2>
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Online na prévia (Sandbox)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearChat}
                    disabled={chatMessages.length === 0}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Limpar mensagens do teste"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* QUICK-TEST CHIPS BAR */}
                <div className="p-2.5 bg-[#111b21] border-b border-white/5 flex items-center gap-1.5 overflow-x-auto select-none no-scrollbar">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> Teste Rápido:
                  </span>
                  {QUICK_TEST_QUESTIONS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleQuickQuestion(item.query)}
                      disabled={isSendingMessage || !canTest}
                      className="px-2.5 py-1 rounded-full bg-[#1e2a30] hover:bg-emerald-500/20 text-slate-200 hover:text-emerald-300 text-[10px] font-semibold border border-white/5 hover:border-emerald-500/40 transition-all shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <item.icon className="w-3 h-3 text-emerald-400" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* CHAT MESSAGES BODY */}
                <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-[#0b141a] min-h-[360px] max-h-[460px]">
                  {chatMessages.length === 0 ? (
                    <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center p-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">Simulador WhatsApp do Agente</h4>
                      <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                        Envie uma mensagem ou clique em um dos botões de <strong className="text-emerald-400">Teste Rápido</strong> acima para avaliar como {activeAgent?.name || attendantName} responde aos clientes.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start items-start gap-2'}`}
                      >
                        {msg.sender === 'assistant' && (
                          <div className="w-6 h-6 rounded-lg overflow-hidden border border-emerald-500/40 mt-1 bg-black shrink-0">
                            <img
                              src={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                              alt={attendantName}
                              className="w-full h-full object-cover"
                              style={{ imageRendering: "pixelated" }}
                            />
                          </div>
                        )}
                        <div
                          className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] shadow-md leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-[#005c4b] text-white rounded-tr-none'
                              : msg.isError
                              ? 'bg-amber-950/60 text-amber-200 border border-amber-500/30 rounded-tl-none'
                              : 'bg-[#202c33] text-slate-100 rounded-tl-none'
                          }`}
                        >
                          <p className="m-0 whitespace-pre-wrap">{msg.text}</p>
                          <div className="text-[9px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                            <span>{msg.timestamp}</span>
                            {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-emerald-400" />}
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {isSendingMessage && (
                    <div className="flex justify-start items-start gap-2">
                      <div className="w-6 h-6 rounded-lg overflow-hidden border border-emerald-500/40 mt-1 bg-black shrink-0">
                        <img
                          src={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                          alt={attendantName}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                      <div className="bg-[#202c33] text-slate-300 px-3 py-2 rounded-2xl rounded-tl-none text-xs flex items-center gap-2 italic">
                        <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: themeColor }} />
                        <span>{attendantName} está digitando...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* CHAT INPUT BAR */}
                <div className="p-3 bg-[#202c33] border-t border-white/5 space-y-1.5">
                  <div className="flex items-center gap-2 bg-[#2a3942] rounded-xl px-3 py-1.5 border border-white/5">
                    <input
                      ref={chatInputRef}
                      type="text"
                      placeholder={canTest ? `Escreva para testar ${activeAgent?.name || attendantName}...` : "Configure o agente para testar"}
                      aria-label="Mensagem para testar o atendente"
                      className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none px-1"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void handleSendMessage();
                        }
                      }}
                      disabled={isSendingMessage || !canTest}
                    />

                    <button
                      type="button"
                      onClick={() => void handleSendMessage()}
                      disabled={isSendingMessage || !chatInput.trim() || !canTest}
                      className="w-8 h-8 rounded-lg text-black flex items-center justify-center transition-all shadow-md disabled:opacity-40 cursor-pointer shrink-0"
                      style={{ backgroundColor: themeColor }}
                      title="Enviar mensagem para o simulador"
                    >
                      <Send className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    Respostas geradas usando as regras e dados oficiais cadastrados na loja.
                  </p>
                </div>

              </section>
            </div>

          </div>
        )}

      </div>

      {/* MODAL 1: STORE CONFIGURATION DIALOG */}
      <Dialog open={showStoreModal} onOpenChange={setShowStoreModal}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto bg-[#0d131f] border border-white/10 text-white p-5 sm:p-6 shadow-2xl z-50">
          <DialogHeader className="border-b border-white/10 pb-3 mb-2">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-white">
              <Store className="w-4 h-4 text-emerald-400" />
              <span>Configuração da Loja & Conhecimento Oficial</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Altere catálogo, horários, políticas e informações que o atendente utilizará no WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <WhiteLabelStoreManager
            key={currentStore?.id || 'new-store'}
            initialStoreId={currentStore?.id}
            onStoreSelected={(selectedStore) => {
              setCurrentStore(selectedStore);
              resetChat();
            }}
            onStoreUpdated={(updatedStore) => {
              setCurrentStore(updatedStore);
              resetChat();
              void fetchAgentsAndStores();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CREATE AGENT / WHATSAPP IMPORT DIALOG */}
      <Dialog open={showCreateAgentModal} onOpenChange={setShowCreateAgentModal}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto bg-[#0d131f] border border-white/10 text-white p-5 sm:p-6 shadow-2xl z-50">
          <DialogHeader className="border-b border-white/10 pb-3 mb-2">
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-white">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Criar ou Treinar Agente de Atendimento</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Crie seu agente a partir do histórico de conversas do WhatsApp ou personalize as instruções manualmente.
            </DialogDescription>
          </DialogHeader>

          <HistoryBootstrapPanel
            guided
            requestedMode="store"
            onAgentCreated={() => {
              setShowCreateAgentModal(false);
              void fetchAgentsAndStores();
            }}
            onClose={() => {
              setShowCreateAgentModal(false);
              void fetchAgentsAndStores();
            }}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default EvolutionCenter;
