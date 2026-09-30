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
  ArrowLeft,
  Play,
  CheckCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function HistoryBootstrapDisclosure() {
  const [open, setOpen] = useState(false);
  return (
    <details className="rounded-2xl border border-white/10 bg-[#0c121d] p-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-semibold text-white">Criar agente a partir do histórico do WhatsApp</summary>
      {open && <div className="pt-4"><HistoryBootstrapPanel /></div>}
    </details>
  );
}

export function EvolutionCenter({ onManageAgents, onOperation }: { onManageAgents?: () => void; onOperation?: () => void }) {
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<'overview' | 'settings'>('overview');
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showLearnings, setShowLearnings] = useState(false);
  const [showAllRecentLearnings, setShowAllRecentLearnings] = useState(false);

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
  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || isSendingMessage || !activeAgent || !currentStore) return;

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
        text: error?.message || `Erro de conexão. O servidor da IA não está respondendo. Verifique se sua provedora está configurada.`,
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

  const handleScrollToTest = () => {
    setViewMode('overview');
    setTimeout(() => {
      const el = document.getElementById('zai-test-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        chatInputRef.current?.focus();
      }
    }, 100);
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
                <h2 className="text-lg font-bold tracking-tight text-white">{activeAgent?.name || 'Seu primeiro agente'}</h2>
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold px-2 py-0.5"
                  style={{ color: themeColor, borderColor: `${themeColor}50` }}
                >
                  {storeName}
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
                {agents.length > 0 && (
                  <label className="flex items-center gap-1.5 bg-[#080c14] px-2 py-1 rounded-lg border border-border/60 text-xs text-slate-400">
                    Agente
                    <select
                      value={selectedAgentKey}
                      onChange={(event) => {
                        setSelectedAgentKey(event.target.value);
                        resetChat();
                      }}
                      className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer max-w-[150px]"
                      aria-label="Agente usado no teste"
                    >
                      {agents.map((agent) => <option key={agent.key} value={agent.key} className="bg-[#0d131f] text-white">{agent.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">Personalidade, capacidades e teste do atendimento em um só lugar.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button type="button" className="zai-btn" onClick={() => setShowCreateAgent(open => !open)}>{showCreateAgent ? 'Fechar criação' : 'Criar agente'}</button>
            {/* View Switcher Subtabs */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'overview'
                    ? 'bg-emerald-500 text-black shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                <TrendingUp className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" /> Visão geral
              </button>
              <button
                type="button"
                onClick={() => setViewMode('settings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'settings'
                    ? 'bg-emerald-500 text-black shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                <Store className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" /> Configuração
              </button>
            </div>

            <button
              type="button"
              onClick={handleScrollToTest}
              className="zai-btn zai-btn-primary"
              disabled={!canTest}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Testar Agora</span>
            </button>
          </div>
        </header>

        {!historyLoading && !historyError && (!activeAgent || showCreateAgent) && <section className="mb-5 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <img src="/assets/evolution/habbo_avatar.png" alt="Mascote ZAI" className="h-16 w-16 shrink-0 rounded-2xl bg-emerald-500/10 object-contain [image-rendering:pixelated]" />
            <div className="min-w-0"><p className="text-xs font-semibold text-emerald-400">ZAI te ajuda a começar</p><h3 className="mt-1 text-xl font-bold text-white">Um agente com a identidade da sua loja</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Informe sua loja e as regras de atendimento. Revise o agente, teste suas respostas e ative quando estiver pronto.</p></div>
          </div>
          <ol className="my-5 grid gap-3 sm:grid-cols-3">{['Defina sua loja e seu agente', 'Teste e revise as respostas', 'Conecte o WhatsApp e ative a IA'].map((step, index) => <li key={step} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-slate-300"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400">{index + 1}</span>{step}</li>)}</ol>
          {showCreateAgent ? <HistoryBootstrapPanel guided requestedMode="store" onAgentCreated={() => { setShowCreateAgent(false); void fetchAgentsAndStores(); }} onClose={() => { setShowCreateAgent(false); void fetchAgentsAndStores(); }} /> : <button type="button" className="zai-btn zai-btn-primary" onClick={() => setShowCreateAgent(true)}>Começar · Criar agente</button>}
        </section>}

        {activeAgent && viewMode === 'overview' && <section className="mb-5 grid gap-3 rounded-2xl border border-white/10 bg-[#0c121d] p-4 sm:grid-cols-[1fr_auto]">
          <div><h3 className="text-sm font-semibold text-white">Capacidades do agente</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">Responde com suas instruções, consulta o conhecimento oficial e usa o contexto da conversa. Aprendizados e estratégias podem ser revisados abaixo.</p><details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-emerald-400">Ver instruções e personalidade</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{activeAgent.personality || 'Este agente ainda não tem instruções cadastradas.'}</p></details></div>
          <div className="flex flex-wrap items-start gap-2"><button type="button" className="zai-btn" onClick={onManageAgents}>Editar agente</button><button type="button" className="zai-btn" onClick={onOperation}>Ativação e conexões</button></div>
        </section>}

        {/* Visão geral: desempenho, teste e aprendizados */}
        {viewMode === 'overview' && (activeAgent || historyLoading || historyError) && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* TOP GRID (PALCO + CARDS) */}
            <div className="order-2 xl:order-1 grid grid-cols-1 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-4 xl:gap-6">
              
              {/* LEFT COLUMN: ISOMETRIC PIXEL CHARACTER STAGE CUSTOMIZABLE PER STORE */}
              <div className="order-2 xl:order-1">
              {historyLoading ? (
                <div className="h-[310px] rounded-2xl border border-white/10 bg-[#0c121d] flex items-center justify-center text-xs text-slate-400">Carregando loja e agentes...</div>
              ) : historyError ? (
                <div className="h-[310px] rounded-2xl border border-amber-500/20 bg-[#0c121d] flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm font-semibold text-white">Não foi possível carregar lojas e agentes</p>
                  <button type="button" className="zai-btn" onClick={() => void fetchAgentsAndStores()}>Tentar novamente</button>
                </div>
              ) : currentStore ? <AICharacterViewer
                agentName={activeAgent?.name || attendantName}
                agentRole={attendantRole}
                storeName={storeName}
                themeColor={themeColor}
                isOnline={isOnline}
                onToggleOnline={setIsOnline}
                avatarUrl={currentStore?.attendant_config?.avatarUrl || "/assets/evolution/habbo_avatar.png"}
                config={attendantConfig}
                onSaveConfig={handleSaveAttendantConfig}
              /> : (
                <div className="h-[310px] rounded-2xl border border-dashed border-white/15 bg-[#0c121d] flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Store className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm font-semibold text-white">Configure sua loja</p>
                  <p className="text-xs text-slate-400">Adicione dados e personalize o atendente para ver a prévia.</p>
                  <button type="button" className="zai-btn zai-btn-primary" onClick={() => setViewMode('settings')}>Abrir configuração</button>
                </div>
              )}
              </div>

              {/* RIGHT COLUMN: ATTENDANT PROFILE & STATS */}
              <div className="order-1 xl:order-2 flex flex-col gap-3">
                
                {/* Indicadores e aprendizados */}
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3 flex-1">
                  
                  {/* Dados reais da operação */}
                  <article className="bg-[#0c121d] border border-white/10 rounded-2xl p-3.5 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Resumo da operação</span>
                      </div>
                    </div>
                    {loadErrors.metrics && !loading && <p className="text-[11px] text-amber-300 mb-2">Não foi possível carregar os indicadores da empresa.</p>}

                    <div className="space-y-2.5 my-auto">
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-medium">Cadastro da loja</span>
                          <span className="text-emerald-400 font-bold">{currentStore ? `${storeKnowledgePct}%` : '—'}</span>
                        </div>
                        <div className="w-full bg-[#111823] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${currentStore ? storeKnowledgePct : 0}%`, backgroundColor: themeColor }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] border-t border-white/5 pt-2">
                        <span className="text-slate-300 font-medium">Experiências analisadas na empresa</span>
                        <span className="text-blue-400 font-bold">{metrics?.totalExperiences ?? '—'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 font-medium">Correções humanas</span>
                        <span className="text-amber-400 font-bold">{metrics?.humanCorrections ?? '—'}</span>
                      </div>
                    </div>
                  </article>

                  {/* CARD 3: ÚLTIMOS APRENDIZADOS */}
                  <article className="bg-[#0c121d] border border-white/10 rounded-2xl p-3.5 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Aprendizados da empresa</span>
                      </div>
                      {recentLearnings.length > 3 && <button
                        type="button"
                        onClick={() => setShowAllRecentLearnings((open) => !open)}
                        className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                        aria-expanded={showAllRecentLearnings}
                      >
                        <span>{showAllRecentLearnings ? 'Ver menos' : 'Ver todos'}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>}
                    </div>

                    <div className="space-y-1.5 my-auto">
                      {loading ? (
                        <p className="text-xs text-slate-400 py-5">Carregando aprendizados...</p>
                      ) : loadErrors.overview ? (
                        <p className="text-xs text-amber-300 py-5">Não foi possível carregar os aprendizados.</p>
                      ) : recentLearnings.length === 0 ? (
                        <p className="text-xs text-slate-400 py-5">Nenhum aprendizado registrado ainda.</p>
                      ) : (
                        recentLearnings.slice(0, showAllRecentLearnings ? 10 : 3).map((item, idx) => (
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
            <section id="zai-test-section" className="order-1 xl:order-2 bg-[#0c121d] border border-white/10 rounded-2xl p-4 shadow-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-black shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                    <MessageSquare className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                      <span>Testar Assistente</span>
                      <Badge variant="outline" className="text-[9px]" style={{ color: themeColor, borderColor: `${themeColor}50` }}>
                        {activeAgent?.name || 'Agente'} · {storeName}
                      </Badge>
                    </h2>
                    <p className="text-[11px] text-slate-400">Simule respostas de {activeAgent?.name || 'um agente'} com os dados de {storeName}.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClearChat}
                  disabled={chatMessages.length === 0}
                  className="self-end sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#080d16] hover:bg-white/5 text-slate-300 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Limpar conversa</span>
                </button>
              </div>

              {/* CHAT MESSAGES CONTAINER */}
              <div className="space-y-3 mb-3 px-1 min-h-[160px] max-h-[300px] overflow-y-auto pr-1">
                {chatMessages.length === 0 ? (
                  <div className="h-[160px] flex flex-col items-center justify-center text-center text-slate-400">
                    <MessageSquare className="w-6 h-6 mb-2 text-emerald-400/70" />
                    <p className="text-xs font-medium text-slate-200">{historyError ? 'Teste indisponível no momento' : canTest ? 'Teste as respostas do atendente' : 'Configure loja e agente para testar'}</p>
                    <p className="text-[11px] mt-1">{historyError ? 'Recarregue lojas e agentes para continuar.' : canTest ? 'Envie uma pergunta para começar a conversa.' : 'Complete a configuração antes de enviar uma pergunta.'}</p>
                  </div>
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
                            : msg.isError ? 'bg-amber-950/40 text-amber-200 rounded-tl-none leading-relaxed' : 'bg-[#1f2c34] text-slate-100 rounded-tl-none leading-relaxed'
                        }`}
                      >
                        <p className="m-0">{msg.text}</p>
                        <div className="text-[9px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                          <span>{msg.timestamp}</span>
                          {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-emerald-400" />}
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
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="Digite uma mensagem para testar..."
                  aria-label="Mensagem para testar o atendente"
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none px-2"
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

        {/* Configuração da loja e do atendente */}
        {viewMode === 'settings' && (
          <div className="space-y-4 animate-fade-in">
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
            <HistoryBootstrapDisclosure />
          </div>
        )}

        {viewMode === 'overview' && (
          <section className="mt-4 rounded-2xl border border-white/10 bg-[#0c121d] overflow-hidden">
            <button
              type="button"
              aria-expanded={showLearnings}
              onClick={() => setShowLearnings((open) => !open)}
              className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4" /></span>
                <span>
                  <span className="block text-sm font-semibold text-white">Aprendizados e sugestões</span>
                  <span className="block text-xs text-slate-400">Revise os padrões encontrados nas conversas da empresa.</span>
                </span>
              </span>
              <span className="text-xs font-semibold text-amber-400 whitespace-nowrap">
                {loadErrors.suggestions ? 'Sugestões indisponíveis' : `${suggestions.filter((item) => item.status === 'pending').length} pendentes`} · {showLearnings ? 'Recolher' : 'Ver detalhes'}
              </span>
            </button>
            {showLearnings && <div className="space-y-4 p-4 pt-0 animate-fade-in">
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
                {loadErrors.suggestions ? (
                  <p className="text-center py-8 text-xs text-amber-300">Não foi possível carregar as sugestões. Atualize a página para tentar novamente.</p>
                ) : suggestions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                    <Sparkles className="w-8 h-8 mx-auto opacity-40 text-amber-400 animate-pulse" />
                    <p className="font-semibold text-white">Nenhum padrão identificado ainda</p>
                    <p className="max-w-md mx-auto">
                      Quando houver padrões detectados nas conversas, eles aparecerão aqui para revisão.
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
            </div>}
          </section>
        )}

      </div>
    </div>
  );
}

export default EvolutionCenter;
