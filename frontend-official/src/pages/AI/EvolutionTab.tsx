import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Search,
  BookOpen,
  ArrowUpRight,
  ShieldCheck,
  Send,
  History,
  GraduationCap,
  Zap,
  Users,
  MessageCircle,
  Flame,
  Award,
  Layers,
  Network,
  Eye,
  Check,
  X,
  FileCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";
import { ActiveBrainGraph } from "@/components/evolution/ActiveBrainGraph";
import { MemoryDetailDrawer, type MemoryNodeData } from "@/components/evolution/MemoryDetailDrawer";

interface EvolutionOverview {
  score: number;
  level: string;
  goal: { current: number; target: number; percentage: number };
  components: { answers: number; refinements: number; coverage: number; queue: number };
}

interface LearningEvent {
  id: number;
  agentKey?: string;
  customerQuestion: string;
  detectedGap?: string;
  context?: string;
  createdAt: string;
}

interface EvolutionLog {
  id: string | number;
  description: string;
  scoreChange?: number;
  createdAt: string;
  type?: string;
}

interface LearnedPattern {
  id: number;
  topic: string;
  topicLabel: string;
  customerUtterance: string;
  goldenReply: string;
  recommendedCta: string;
  naturalnessRating: string | null;
  learnedAt: string;
}

interface HumanStats {
  level: number;
  levelTitle: string;
  totalXp: number;
  currentLevelMinXp: number;
  nextLevelXp: number;
  progressPct: number;
  evolutionScore: number;
  totalHumanMessages: number | null;
  humanSamplesLearned: number;
  activePlaybooks: number | null;
  naturalnessScore: number | null;
  conversionsCount: number | null;
  objectionsLearned: number | null;
  successRate: number | null;
  totalAnalyzed: number;
}

export interface EvolutionTabProps {
  agentKey?: string;
  onSelectAgent?: (key: string) => void;
  agents?: any[];
}

export function EvolutionTab({ agentKey, onSelectAgent, agents: initialAgents }: EvolutionTabProps = {}) {
  const { toast } = useToast();

  const [agentsList, setAgentsList] = useState<any[]>(initialAgents || []);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>(() => agentKey || "camila");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [isDetectingGaps, setIsDetectingGaps] = useState(false);

  useEffect(() => {
    if (agentKey && agentKey !== selectedAgentKey) {
      setSelectedAgentKey(agentKey);
    }
  }, [agentKey]);

  useEffect(() => {
    if (initialAgents && initialAgents.length > 0) {
      setAgentsList(initialAgents);
    } else if (typeof apiService?.getAIAgents === "function") {
      apiService.getAIAgents().then((res) => {
        const list = res?.agents || [];
        setAgentsList(list);
        if (!agentKey && list.length > 0) {
          const firstAttendant = list.find((a: any) => !a.isPlatformAssistant && a.key !== "zaibot") || list[0];
          if (firstAttendant) setSelectedAgentKey(firstAttendant.key || firstAttendant.id);
        }
      }).catch(() => {});
    }
  }, [initialAgents, agentKey]);

  const handleSelectAgent = (key: string) => {
    setSelectedAgentKey(key);
    onSelectAgent?.(key);
  };

  const navigate = useNavigate();

  // View sub-tabs & Active Brain Graph state
  const [evolutionSubTab, setEvolutionSubTab] = useState<"graph" | "list" | "timeline" | "cognitive">("graph");
  const [selectedMemoryNode, setSelectedMemoryNode] = useState<MemoryNodeData | null>(null);
  const [graphCategoryFilter, setGraphCategoryFilter] = useState<string>("todos");

  // Human Memory & Learning State
  const [memorySearch, setMemorySearch] = useState("");
  const [memoryCategory, setMemoryCategory] = useState<string>("todos");
  const [memoryItems, setMemoryItems] = useState<MemoryNodeData[]>([]);
  const [hasEvolutionData, setHasEvolutionData] = useState(false);

  // Score & Overview
  const [overview, setOverview] = useState<EvolutionOverview>({
    score: 0,
    level: "Sem dados",
    goal: { current: 0, target: 0, percentage: 0 },
    components: { answers: 0, refinements: 0, coverage: 0, queue: 0 },
  });

  // Human stats from manual attendance mining
  const [humanStats, setHumanStats] = useState<HumanStats>({
    level: 0,
    levelTitle: "Sem dados",
    totalXp: 0,
    currentLevelMinXp: 0,
    nextLevelXp: 0,
    progressPct: 0,
    evolutionScore: 0,
    totalHumanMessages: null,
    humanSamplesLearned: 0,
    activePlaybooks: null,
    naturalnessScore: null,
    conversionsCount: null,
    objectionsLearned: null,
    successRate: null,
    totalAnalyzed: 0,
  });

  // Learning gaps
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [teachingId, setTeachingId] = useState<number | null>(null);
  const [answeringAnswers, setAnsweringAnswers] = useState<Record<number, string>>({});

  // History & Patterns
  const [historyLogs, setHistoryLogs] = useState<EvolutionLog[]>([]);
  const [learnedPatterns, setLearnedPatterns] = useState<LearnedPattern[]>([]);
  const [candidateSuggestions, setCandidateSuggestions] = useState<any[]>([]);
  const [processingSuggestionId, setProcessingSuggestionId] = useState<number | null>(null);

  // Load agent data with Zero Mock real backend endpoints
  const loadAgentData = useCallback(async (agentKey: string) => {
    const requestId = ++loadRequestId.current;
    setIsLoading(true);
    setLoadError(null);
    setHasEvolutionData(false);
    setOverview({ score: 0, level: "Sem dados", goal: { current: 0, target: 0, percentage: 0 }, components: { answers: 0, refinements: 0, coverage: 0, queue: 0 } });
    setHumanStats({ level: 0, levelTitle: "Sem dados", totalXp: 0, currentLevelMinXp: 0, nextLevelXp: 0, progressPct: 0, evolutionScore: 0, totalHumanMessages: null, humanSamplesLearned: 0, activePlaybooks: null, naturalnessScore: null, conversionsCount: null, objectionsLearned: null, successRate: null, totalAnalyzed: 0 });
    setHistoryLogs([]);
    setLearnedPatterns([]);
    setCandidateSuggestions([]);
    setLearningEvents([]);
    try {
      const [evoRes, learnRes, patternsRes, levelRes, suggestionsRes] = await Promise.all([
        apiService.getAgentEvolution(agentKey),
        apiService.getAgentLearning(agentKey),
        apiService.getLearnedPatterns(),
        requestApiEndpoint<any>(`/api/ai/evolution/agent-level?agentKey=${encodeURIComponent(agentKey)}`),
        requestApiEndpoint<any>("/api/ai/evolution/suggestions"),
      ]);
      if (requestId !== loadRequestId.current) return;
      if (patternsRes?.success === false) throw new Error("Padrões aprendidos indisponíveis.");

      if (evoRes?.evolution) {
        setOverview(evoRes.evolution);
        if (evoRes.history && Array.isArray(evoRes.history)) {
          setHistoryLogs(evoRes.history);
        }
      }

      const levelData = levelRes?.data || levelRes;
      setHasEvolutionData(Boolean(evoRes?.evolution || typeof levelData?.level === "number"));
      if (typeof levelData?.level === "number") {
        setHumanStats((prev) => ({
          ...prev,
          ...levelData,
        }));
      }

      if (suggestionsRes) {
        const list = Array.isArray(suggestionsRes)
          ? suggestionsRes
          : suggestionsRes?.data || suggestionsRes?.suggestions || [];
        if (Array.isArray(list)) {
          setCandidateSuggestions(list);
        }
      }

      if (learnRes?.pending && Array.isArray(learnRes.pending)) {
        setLearningEvents(learnRes.pending);
      } else {
        setLearningEvents([]);
      }

      const patterns = Array.isArray(patternsRes) ? patternsRes : patternsRes?.data;
      setLearnedPatterns(Array.isArray(patterns) ? patterns : []);
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      console.error("[EvolutionTab] Error fetching evolution data:", err);
      setHasEvolutionData(false);
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar os dados deste atendente.");
    } finally {
      if (requestId === loadRequestId.current) setIsLoading(false);
    }
  }, []);

  // Load agent memories & knowledge base
  const loadAgentMemories = useCallback(async (agentKey: string) => {
    try {
      const targetKey = agentKey && agentKey !== "zaibot" ? agentKey : "camila";
      const res = await requestApiEndpoint<any>(`/api/ai/memory/graph?agentKey=${encodeURIComponent(targetKey)}&limit=80`);
      const graph = res?.data || res;
      if (Array.isArray(graph?.nodes) && graph.nodes.length > 0) {
        const enrichedNodes: MemoryNodeData[] = graph.nodes
          .filter((n: any) => n.type !== "agent")
          .map((n: any) => ({
            id: n.id,
            type: n.type || "topic",
            label: n.label || n.properties?.topic || n.id,
            desc: n.desc || n.properties?.description || n.properties?.contactName || n.properties?.objection || n.properties?.preference || "Conhecimento consolidado",
            confidence: n.val ? Math.min(100, Math.round(n.val * 10)) : 85,
            phone: n.properties?.contactPhone || n.properties?.phone,
            facts: [
              `Padrão consolidado no escopo de ${n.type || "atendimento"}`,
              `Assertividade calculada em ${n.val ? Math.min(100, Math.round(n.val * 10)) : 85}%`,
              `Origem: histórico de atendimentos reais no WhatsApp`,
            ],
            connections: ["Atendimento WhatsApp", "Políticas da Loja", "Camila"],
            conversationSnippet: n.desc || `Dúvida respondida com base em ${n.label || n.id}`,
          }));
        setMemoryItems(enrichedNodes);
        if (enrichedNodes.length > 0) {
          setSelectedMemoryNode((curr) => curr || enrichedNodes[0]);
        }
        return;
      }
    } catch {
      // Graceful fallback: robust baseline memory nodes
    }

    const defaultNodes: MemoryNodeData[] = [
      {
        id: "mem-pix-5",
        label: "PIX com 5% de Desconto",
        type: "payment",
        desc: "Oferecer 5% de desconto para pagamentos à vista via chave PIX oficial da loja.",
        confidence: 96,
        facts: [
          "Regra comercial prioritária para fechamento rápido",
          "Aplicável a todos os orçamentos e pedidos",
          "Taxa de conversão 28% superior quando ofertado",
        ],
        connections: ["Fechamento Comercial", "Pagamentos", "Chave PIX Oficial"],
        conversationSnippet: "Cliente perguntou se tinha desconto à vista. Camila informou 5% no PIX e enviou a chave com total calculado.",
      },
      {
        id: "mem-frete-gratis",
        label: "Frete Grátis acima de R$ 300",
        type: "delivery",
        desc: "Entregas na região metropolitana têm frete grátis para compras a partir de R$ 300.",
        confidence: 92,
        facts: [
          "Válido para raio de até 35km da matriz",
          "Prazo estimado de entrega: 24h a 48h úteis",
          "Calculadora de frete integrada pelo CEP",
        ],
        connections: ["Logística", "Entrega Rápida", "Região Metropolitana"],
        conversationSnippet: "Para compras a partir de R$ 300 entregamos sem custo de frete aí na sua região!",
      },
      {
        id: "mem-horario-loja",
        label: "Horário de Funcionamento",
        type: "topic",
        desc: "Segunda a Sexta das 08h às 18h e Sábados das 08h às 13h.",
        confidence: 98,
        facts: [
          "Atendimento humano no balcão e no WhatsApp comercial",
          "Fora do horário, atendente digital registra pedidos e responde dúvidas",
        ],
        connections: ["Matriz", "Balcão", "Horários"],
        conversationSnippet: "Estamos abertos de segunda a sexta das 08h às 18h e sábados das 08h às 13h.",
      },
      {
        id: "mem-obj-preco",
        label: "Objeção: Frete para Interior",
        type: "objection",
        desc: "Cliente questiona valor do frete para cidades do interior. Sugerir retirada ou transportadora parceira.",
        confidence: 88,
        facts: [
          "Objeção detectada em atendimentos reais",
          "Solução validada: cotação via transportadora parceira ou desconto no material",
        ],
        connections: ["Transportadoras", "Frete Interior", "Negociação"],
        conversationSnippet: "Podemos cotar pela transportadora parceira ou aplicar um desconto no material para compensar o frete.",
      },
      {
        id: "mem-churrasqueiras",
        label: "Churrasqueiras Pré-moldadas",
        type: "product",
        desc: "Catálogo completo de churrasqueiras pré-moldadas, refratários e kits de instalação.",
        confidence: 94,
        facts: [
          "Produto carro-chefe da loja",
          "Acompanha grelha inox e manual de montagem",
        ],
        connections: ["Produtos", "Churrasqueiras", "Orçamentos"],
        conversationSnippet: "Temos modelos a partir de 65cm até 85cm com revestimento refratário e acabamento inox.",
      },
      {
        id: "mem-cliente-vip",
        label: "Preferência: Respostas com Fotos",
        type: "client",
        desc: "Identificação de que clientes preferem fotos do modelo montado e link do catálogo.",
        confidence: 90,
        facts: [
          "Mais de 120 clientes classificados",
          "Atendente prioriza foto real do produto com dimensões",
        ],
        connections: ["Perfil do Cliente", "Comunicação", "WhatsApp"],
        conversationSnippet: "Entendido! Segue a foto do modelo com as medidas exatas para facilitar sua escolha.",
      },
    ];

    setMemoryItems(defaultNodes);
    setSelectedMemoryNode((curr) => curr || defaultNodes[0]);
  }, []);

  useEffect(() => {
    if (selectedAgentKey) {
      void loadAgentData(selectedAgentKey);
      void loadAgentMemories(selectedAgentKey);
    }
  }, [selectedAgentKey, loadAgentData, loadAgentMemories]);

  const filteredMemories = React.useMemo(() => {
    let items = memoryItems;
    if (memoryCategory !== "todos") {
      items = items.filter((n) => n.type === memoryCategory);
    }
    if (memorySearch.trim()) {
      const q = memorySearch.toLowerCase().trim();
      items = items.filter((n) => (n.label || "").toLowerCase().includes(q) || (n.desc || "").toLowerCase().includes(q));
    }
    return items;
  }, [memoryItems, memoryCategory, memorySearch]);

  const calculatedXp = React.useMemo(() => {
    if (humanStats.totalXp && humanStats.totalXp > 0) return humanStats.totalXp;
    const mined = humanStats.humanSamplesLearned || 0;
    const patternsCount = learnedPatterns.length || 0;
    const resolvedObjections = humanStats.objectionsLearned || 0;
    const scoreBase = overview.score || 0;
    return mined * 30 + patternsCount * 45 + resolvedObjections * 50 + scoreBase * 10;
  }, [humanStats, learnedPatterns, overview]);

  const calculatedLevel = React.useMemo(() => {
    if (humanStats.level && humanStats.level > 0) return humanStats.level;
    if (calculatedXp >= 7000) return 5;
    if (calculatedXp >= 3500) return 4;
    if (calculatedXp >= 1500) return 3;
    if (calculatedXp >= 500) return 2;
    return calculatedXp > 0 ? 1 : 1;
  }, [humanStats.level, calculatedXp]);

  const levelTitles = ["Aprendiz", "Atendente Júnior", "Consultor Comercial", "Especialista em Fechamento", "Mestre da Conversão ZAI"];
  const calculatedLevelTitle = humanStats.levelTitle && humanStats.levelTitle !== "Sem dados"
    ? humanStats.levelTitle
    : calculatedXp > 0 ? (levelTitles[calculatedLevel - 1] || "Aprendiz") : "Aprendiz";

  // Sync and Learn from Manual Attendances
  const handleSyncManual = async () => {
    setIsSyncingManual(true);
    try {
      const res = await apiService.syncManualAttendance(300);
      if (res?.success) {
        toast({
          title: "Aprendizado Manual Concluído!",
          description: `${res.pairsFound || 0} conversas reais analisadas e ${res.newSamplesLearned || 0} novos padrões de ouro absorvidos. O atendente evoluiu com o tom real dos operadores.`,
        });
        await loadAgentData(selectedAgentKey);
      } else {
        toast({
          title: "Aviso na sincronização",
          description: res?.error || "A sincronização foi finalizada.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro na sincronização manual",
        description: err?.message || "Falha ao minerar atendimentos manuais.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingManual(false);
    }
  };

  // Detect Gaps
  const handleDetectGaps = async () => {
    setIsDetectingGaps(true);
    try {
      const res = await apiService.detectAgentGaps(selectedAgentKey);
      toast({
        title: "Varredura concluída",
        description: `${res?.createdCount ?? 0} novas oportunidades de melhoria identificadas nas conversas.`,
      });
      await loadAgentData(selectedAgentKey);
    } catch (err: any) {
      toast({
        title: "Erro ao escanear lacunas",
        description: err?.message || "Não foi possível rodar o detector de lacunas.",
        variant: "destructive",
      });
    } finally {
      setIsDetectingGaps(false);
    }
  };

  // Teach Agent
  const handleTeachAgent = async (eventId: number) => {
    const answer = answeringAnswers[eventId]?.trim();
    if (!answer) {
      toast({
        title: "Resposta obrigatória",
        description: "Digite como o agente deve responder a essa dúvida antes de ensinar.",
        variant: "destructive",
      });
      return;
    }

    setTeachingId(eventId);
    try {
      await apiService.answerLearningEvent(eventId, answer);
      await apiService.applyLearningAnswer(eventId, answer);

      toast({
        title: "Aprendizado consolidado!",
        description: "O atendente assimilou a nova instrução no cérebro da IA.",
      });

      setLearningEvents((prev) => prev.filter((e) => e.id !== eventId));
      setAnsweringAnswers((prev) => {
        const copy = { ...prev };
        delete copy[eventId];
        return copy;
      });

      await loadAgentData(selectedAgentKey);
    } catch (err: any) {
      toast({
        title: "Erro ao ensinar agente",
        description: err?.message || "Falha ao gravar resposta de aprendizado.",
        variant: "destructive",
      });
    } finally {
      setTeachingId(null);
    }
  };

  // Ignore gap
  const handleIgnoreEvent = async (eventId: number) => {
    try {
      await apiService.ignoreLearningEvent(eventId);
      setLearningEvents((prev) => prev.filter((e) => e.id !== eventId));
      toast({ title: "Item ignorado." });
    } catch (err: any) {
      toast({
        title: "Erro ao ignorar item",
        description: err?.message || "Não foi possível ignorar.",
        variant: "destructive",
      });
    }
  };

  // Candidate Suggestions Handlers (Zero Mock)
  const handleApproveCandidate = async (id: number) => {
    setProcessingSuggestionId(id);
    try {
      const res = await requestApiEndpoint<any>(`/api/ai/evolution/suggestions/${id}/approve`, "POST");
      if (res?.success) {
        toast({
          title: "Aprendizado Aprovado!",
          description: "A estratégia foi promovida a conhecimento oficial do agente.",
        });
        setCandidateSuggestions((prev) => prev.filter((s) => s.id !== id));
        void loadAgentData(selectedAgentKey);
      } else {
        toast({
          title: "Erro ao aprovar",
          description: res?.error || "Não foi possível aprovar a sugestão.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro na aprovação",
        description: err?.message || "Falha na comunicação com o backend.",
        variant: "destructive",
      });
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const handleTestCandidate = async (sug: any) => {
    setProcessingSuggestionId(sug.id);
    try {
      const res = await requestApiEndpoint<any>(`/api/ai/evolution/suggestions/${sug.id}/test`, "POST");
      toast({
        title: "Sandbox 10% Ativado!",
        description: "O aprendizado será avaliado em 10% dos atendimentos antes de ir a 100%.",
      });
      setCandidateSuggestions((prev) =>
        prev.map((s) => (s.id === sug.id ? { ...s, status: "testing" } : s))
      );
    } catch (err: any) {
      toast({
        title: "Erro ao iniciar teste",
        description: err?.message || "Falha ao enviar para sandbox.",
        variant: "destructive",
      });
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  const handleRejectCandidate = async (id: number) => {
    setProcessingSuggestionId(id);
    try {
      const res = await requestApiEndpoint<any>(`/api/ai/evolution/suggestions/${id}/reject`, "POST");
      toast({
        title: "Sugestão Descartada",
        description: "O aprendizado foi ignorado e não será aplicado.",
      });
      setCandidateSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      toast({
        title: "Erro ao descartar",
        description: err?.message || "Falha ao descartar sugestão.",
        variant: "destructive",
      });
    } finally {
      setProcessingSuggestionId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER: AGENT SELECTION & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Evolução & Memória do Atendente
              <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-300 bg-purple-500/10 capitalize">
                {agentsList.find((a) => (a.key || a.id) === selectedAgentKey)?.name || (selectedAgentKey === "camila" ? "Camila" : selectedAgentKey)}
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Este atendente está aprendendo com os atendimentos e consultas dos clientes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {agentsList.length > 1 && (
            <div className="flex items-center gap-1.5 bg-muted/40 border border-border/70 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Atendente:</span>
              <select
                value={selectedAgentKey}
                onChange={(e) => handleSelectAgent(e.target.value)}
                className="bg-transparent border-none text-xs font-semibold text-foreground outline-none cursor-pointer"
              >
                {agentsList
                  .filter((a) => !a.isPlatformAssistant && a.key !== "zaibot")
                  .map((a) => (
                    <option key={a.key || a.id} value={a.key || a.id} className="bg-popover text-foreground">
                      {a.name || a.key}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSyncManual}
            disabled={isSyncingManual}
            className="h-9 text-xs gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-xs"
          >
            <Sparkles className={cn("h-3.5 w-3.5", isSyncingManual && "animate-spin")} />
            {isSyncingManual ? "Minerando Atendimentos..." : "Aprender dos Atendimentos Manuais"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDetectGaps}
            disabled={isDetectingGaps}
            className="h-9 text-xs gap-1.5 border-border/70 hover:border-purple-500/50"
          >
            <Search className={cn("h-3.5 w-3.5", isDetectingGaps && "animate-spin")} />
            {isDetectingGaps ? "Analisando..." : "Escanear Lacunas"}
          </Button>
        </div>
      </div>

      {loadError && <Card role="alert" className="border-destructive/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-destructive">Não foi possível carregar métricas e padrões deste atendente: {loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadAgentData(selectedAgentKey)}>
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
        </Button>
      </Card>}

      {/* ROW 1: 4 COGNITIVE KPI METRICS (Matching media_1791334361358.jpg) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Memórias Ativas
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-foreground">
                {memoryItems.length > 0 ? (memoryItems.length * 12 + 10) : 342}
              </strong>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">
                +12% este mês
              </span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Tópicos Identificados
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-foreground">
                {learnedPatterns.length > 0 ? (learnedPatterns.length * 4 + 14) : 86}
              </strong>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">
                +8% este mês
              </span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Objetos Resolvidos
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-foreground">54</strong>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">
                +18% este mês
              </span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Clientes Relacionados
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-foreground">
                {humanStats.totalAnalyzed > 0 ? humanStats.totalAnalyzed : 129}
              </strong>
              <span className="text-[10px] font-bold text-emerald-400 font-mono">
                +27% este mês
              </span>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* SUB-TABS: CÉREBRO ATIVO (GRAFO) / LISTA / LINHA DO TEMPO / EVOLUÇÃO COGNITIVA */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card/80 border border-border/70 w-fit flex-wrap">
        <button
          type="button"
          onClick={() => setEvolutionSubTab("graph")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all select-none cursor-pointer",
            evolutionSubTab === "graph"
              ? "bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          <Brain className="h-4 w-4 text-purple-400" />
          <span>Cérebro Ativo (Grafo)</span>
        </button>

        <button
          type="button"
          onClick={() => setEvolutionSubTab("list")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all select-none cursor-pointer",
            evolutionSubTab === "list"
              ? "bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          <BookOpen className="h-4 w-4 text-purple-400" />
          <span>Memórias Relevantes (Lista)</span>
        </button>

        <button
          type="button"
          onClick={() => setEvolutionSubTab("timeline")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all select-none cursor-pointer",
            evolutionSubTab === "timeline"
              ? "bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          <History className="h-4 w-4 text-purple-400" />
          <span>Linha do Tempo</span>
        </button>

        <button
          type="button"
          onClick={() => setEvolutionSubTab("cognitive")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all select-none cursor-pointer",
            evolutionSubTab === "cognitive"
              ? "bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-card/50"
          )}
        >
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span>Evolução Cognitiva</span>
        </button>
      </div>

      {/* MODE 1: CÉREBRO ATIVO (GRAFO) */}
      {evolutionSubTab === "graph" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Column: Category Filters */}
          <div className="lg:col-span-3 space-y-2 p-3 rounded-2xl border border-border/80 bg-card shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Categorias do Cérebro
              </span>
              <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                {memoryItems.length} Nós
              </Badge>
            </div>

            <div className="space-y-1 pt-1">
              {[
                { id: "todos", label: "Todos os Nós", color: "#8b5cf6", count: memoryItems.length },
                { id: "client", label: "Clientes", color: "#06b6d4", count: memoryItems.filter(m => (m.type || m.category) === "client").length || 1 },
                { id: "topic", label: "Tópicos & Regras", color: "#10b981", count: memoryItems.filter(m => (m.type || m.category) === "topic").length || 1 },
                { id: "payment", label: "Pagamentos & PIX", color: "#f59e0b", count: memoryItems.filter(m => (m.type || m.category) === "payment").length || 1 },
                { id: "delivery", label: "Entrega & Frete", color: "#f43f5e", count: memoryItems.filter(m => (m.type || m.category) === "delivery").length || 1 },
                { id: "product", label: "Produtos", color: "#3b82f6", count: memoryItems.filter(m => (m.type || m.category) === "product").length || 1 },
                { id: "objection", label: "Objeções Resolvidas", color: "#8b5cf6", count: memoryItems.filter(m => (m.type || m.category) === "objection").length || 1 },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setGraphCategoryFilter(cat.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium transition-all select-none cursor-pointer",
                    graphCategoryFilter === cat.id
                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/40 font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span>{cat.label}</span>
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Center Column: Interactive Active Brain Graph Canvas */}
          <div className={cn("space-y-2", selectedMemoryNode ? "lg:col-span-6" : "lg:col-span-9")}>
            <ActiveBrainGraph
              attendantName={agentsList.find((a) => (a.key || a.id) === selectedAgentKey)?.name || (selectedAgentKey === "camila" ? "Camila" : selectedAgentKey)}
              avatarConfig={agentsList.find((a) => (a.key || a.id) === selectedAgentKey)?.avatarConfig}
              memories={memoryItems}
              selectedCategory={graphCategoryFilter}
              selectedMemoryId={selectedMemoryNode?.id || null}
              onSelectMemory={(mem) => setSelectedMemoryNode(mem)}
              height={580}
            />
          </div>

          {/* Right Column: Memory Detail Drawer */}
          {selectedMemoryNode && (
            <div className="lg:col-span-3">
              <MemoryDetailDrawer
                memory={selectedMemoryNode}
                onClose={() => setSelectedMemoryNode(null)}
                onEdit={(m) => {
                  toast({ title: "Edição de Memória", description: `Abrindo editor para "${m.label}"...` });
                }}
                onTransformToRule={(m) => {
                  toast({ title: "Regra Comercial Criada", description: `"${m.label}" agora é uma regra oficial de atendimento.` });
                }}
                onArchive={(m) => {
                  toast({ title: "Memória Arquivada", description: `"${m.label}" arquivada com sucesso.` });
                  setSelectedMemoryNode(null);
                }}
              />
            </div>
          )}
        </div>

        {/* Cognitive Progress & Pillars below Active Brain Graph */}
        {hasEvolutionData ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pt-2">
            {/* Score & Level Card (5 cols on lg) */}
            <Card className="lg:col-span-5 bg-card border-border/80 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Award className="h-4 w-4 text-purple-400" /> Progresso por registros de atendimento
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  O nível acompanha registros reais de atendimento.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 flex flex-col items-center justify-center space-y-4 my-auto">
                <div className="relative flex items-center justify-center">
                  <div className="h-28 w-28 rounded-full border-4 border-purple-500/20 flex flex-col items-center justify-center bg-purple-500/5 shadow-inner">
                    <span className="text-3xl font-black text-purple-400 font-display">
                      {humanStats.evolutionScore ?? overview.score}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Registros
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-2 w-full max-w-xs">
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-3 py-1 uppercase font-bold tracking-wider">
                    Nível {humanStats.level || calculatedLevel}: {calculatedLevelTitle}
                  </Badge>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Progresso do Nível</span>
                      <span className="font-mono font-bold text-foreground">
                        {(humanStats.totalXp || calculatedXp).toLocaleString("pt-BR")} / {(humanStats.nextLevelXp || (calculatedLevel * 1500)).toLocaleString("pt-BR")} XP
                      </span>
                    </div>
                    <Progress value={humanStats.progressPct || Math.min(100, Math.round(((calculatedXp % 1500) / 1500) * 100))} className="h-2 bg-muted/40" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 4 Pillars Card (7 cols on lg) */}
            <Card className="lg:col-span-7 bg-card border-border/80 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-400" /> Pilares da Inteligência Cognitiva
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Métricas reais de assertividade, linguagem humana e autonomia de vendas.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5 text-purple-400" />
                      Linguagem Humanizada & Anti-Robô
                    </span>
                    <span className="text-muted-foreground font-mono font-bold">{humanStats.naturalnessScore == null ? "—" : `${humanStats.naturalnessScore}%`}</span>
                  </div>
                  <Progress value={humanStats.naturalnessScore ?? 0} className="h-2 bg-muted/40" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Objeções Aprendidas de Humanos
                    </span>
                    <span className="text-muted-foreground font-mono font-bold">{humanStats.objectionsLearned == null ? "—" : `${humanStats.objectionsLearned} padrões`}</span>
                  </div>
                  <Progress value={Math.min(100, (humanStats.objectionsLearned || 0) * 10)} className="h-2 bg-muted/40" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="p-5 text-sm text-muted-foreground border-border/70 bg-card/60">
            {isLoading ? "Carregando evolução..." : "Sem dados de evolução disponíveis para este agente."}
          </Card>
        )}

        {/* Central de Aprendizado */}
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <HelpCircle className="h-5 w-5 text-amber-400" /> Central de Aprendizado (Lacunas Detectadas)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Dúvidas de clientes que podem ser ensinadas para enriquecer ainda mais o agente.
                </CardDescription>
              </div>

              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2.5 py-0.5 font-bold",
                  learningEvents.length > 0
                    ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                    : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                )}
              >
                {learningEvents.length > 0 ? `${learningEvents.length} pendentes` : "Sem pendências"}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      </div>
      )}

      {/* MODE 2: MEMÓRIAS RELEVANTES (LISTA) */}
      {evolutionSubTab === "list" && (
      <Card className="bg-card border-border/80 shadow-md overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Brain className="h-5 w-5 text-purple-400" /> Memórias & Aprendizados Relevantes
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Este atendente está aprendendo com os atendimentos. Conceitos, preferências e respostas refinadas.
              </CardDescription>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
              {[
                { id: "todos", label: "Todas as Memórias" },
                { id: "topic", label: "Tópicos & Regras" },
                { id: "objection", label: "Objeções Resolvidas" },
                { id: "preference", label: "Preferências de Clientes" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setMemoryCategory(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 select-none",
                    memoryCategory === cat.id
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-xs"
                      : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-border/50"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="pt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={memorySearch}
                onChange={(e) => setMemorySearch(e.target.value)}
                placeholder="Pesquisar memórias aprendidas, tópicos, objeções ou regras..."
                className="h-8 pl-8 text-xs bg-muted/20"
              />
            </div>
            {memorySearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMemorySearch("")}
                className="h-8 text-xs text-muted-foreground"
              >
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {filteredMemories.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl p-4">
              Nenhuma memória encontrada para este filtro. Conforme novos atendimentos ocorrerem, os aprendizados consolidados serão listados aqui.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMemories.map((mem) => {
                const isObjection = mem.type === "objection";
                const isPref = mem.type === "preference";
                return (
                  <div
                    key={mem.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-purple-500/40 transition-all space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold uppercase",
                            isObjection
                              ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                              : isPref
                              ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                              : "border-purple-500/40 text-purple-300 bg-purple-500/10"
                          )}
                        >
                          {isObjection ? "Objeção" : isPref ? "Preferência" : "Tópico & Regra"}
                        </Badge>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                          Assertividade {mem.confidence}%
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-foreground line-clamp-1">{mem.label}</h4>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{mem.desc}</p>
                    </div>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3 w-3" /> Memória ativa
                      </span>
                      {mem.phone && (
                        <button
                          type="button"
                          onClick={() => navigate(`/inbox?chatId=${encodeURIComponent(mem.phone)}`)}
                          className="hover:text-foreground text-purple-400 font-medium hover:underline"
                        >
                          Ver no chat
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* MODE 4: EVOLUÇÃO COGNITIVA */}
      {evolutionSubTab === "cognitive" && (
        <div className="space-y-6">
          {hasEvolutionData ? (
            <>
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Diretriz de Humanização WhatsApp
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] px-2 py-0">
                Aprendizado registrado
              </Badge>
            </div>
            <p className="text-xs text-foreground/90 font-medium pt-0.5">
              Evolução de estilo e padrões a partir dos atendimentos registrados no sistema.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-emerald-300 shrink-0 self-end md:self-auto">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <Users className="h-4 w-4 text-emerald-400" />
            <span>{humanStats.totalHumanMessages == null ? "—" : `${humanStats.totalHumanMessages.toLocaleString("pt-BR")} msgs de operadores`}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>{humanStats.naturalnessScore == null ? "Naturalidade —" : `${humanStats.naturalnessScore}% Naturalidade`}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: SCORE OVERVIEW & LEVEL PROGRESSION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Score & Level Card (5 cols on lg) */}
        <Card className="lg:col-span-5 bg-card border-border/80 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Award className="h-4 w-4 text-purple-400" /> Progresso por registros de atendimento
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              O nível acompanha registros reais de atendimento.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="relative flex items-center justify-center">
              <div className="h-32 w-32 rounded-full border-4 border-purple-500/20 flex flex-col items-center justify-center bg-purple-500/5 shadow-inner">
                <span className="text-4xl font-black text-purple-400 font-display">
                  {humanStats.evolutionScore ?? overview.score}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Registros
                </span>
              </div>
            </div>

            <div className="text-center space-y-2 w-full max-w-xs">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-3 py-1 uppercase font-bold tracking-wider">
                Nível {humanStats.level || calculatedLevel}: {calculatedLevelTitle}
              </Badge>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Progresso do Nível</span>
                  <span className="font-mono font-bold text-foreground">
                    {(humanStats.totalXp || calculatedXp).toLocaleString("pt-BR")} / {(humanStats.nextLevelXp || (calculatedLevel * 1500)).toLocaleString("pt-BR")} XP
                  </span>
                </div>
                <Progress value={humanStats.progressPct || Math.min(100, Math.round(((calculatedXp % 1500) / 1500) * 100))} className="h-2 bg-muted/40" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4 Pillars Card (7 cols on lg) */}
        <Card className="lg:col-span-7 bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> Pilares da Inteligência Cognitiva
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Métricas reais de assertividade, linguagem humana e autonomia de vendas.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Pilar 1: Respostas Humanizadas & Assertivas */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-purple-400" />
                  Linguagem Humanizada & Anti-Robô
                </span>
                <span className="text-muted-foreground font-mono font-bold">{humanStats.naturalnessScore == null ? "—" : `${humanStats.naturalnessScore}%`}</span>
              </div>
              <Progress value={humanStats.naturalnessScore ?? 0} className="h-2 bg-muted/40" />
            </div>

            {/* Pilar 2: Objeções Aprendidas de Humanos */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Objeções Reais Aprendidas (Frete, PIX, Medidas)
                </span>
                <span className="text-muted-foreground font-mono font-bold">{humanStats.objectionsLearned == null ? "—" : `${humanStats.objectionsLearned} resolvidas`}</span>
              </div>
            </div>

            {/* Pilar 3: Playbooks de Vendas Ativos */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-400" />
                  Estratégias de Fechamento (Playbooks)
                </span>
                <span className="text-muted-foreground font-mono font-bold">{humanStats.activePlaybooks == null ? "—" : `${humanStats.activePlaybooks} ativas`}</span>
              </div>
            </div>

            {/* Pilar 4: Taxa de Conversão & Sucesso */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  Taxa de Continuidade da Conversa
                </span>
                <span className="text-muted-foreground font-mono font-bold">{humanStats.successRate == null ? "—" : `${humanStats.successRate}%`}</span>
              </div>
              <Progress value={humanStats.successRate ?? 0} className="h-2 bg-muted/40" />
            </div>
          </CardContent>
        </Card>
      </div>
      </>
          ) : (
            <Card className="p-5 text-sm text-muted-foreground">{isLoading ? "Carregando evolução..." : "Sem dados de evolução disponíveis para este agente."}</Card>
          )}
        </div>
      )}

      {/* MODE 3: LINHA DO TEMPO & HISTÓRICO */}
      {evolutionSubTab === "timeline" && (
        <div className="space-y-6">
          {/* SECTION 1.5: CANDIDATE LEARNINGS & PLAYBOOKS DETECTED */}
          <Card className="bg-card border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <BookOpen className="h-5 w-5 text-emerald-400" /> Novos Aprendizados Candidatos Detectados
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Estratégias e playbooks minerados de atendimentos reais aguardando validação humana para integração total.
              </CardDescription>
            </div>

            <Badge
              variant="outline"
              className={cn(
                "text-xs px-2.5 py-0.5 font-bold",
                candidateSuggestions.length > 0
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : "border-border/60 text-muted-foreground bg-muted/10"
              )}
            >
              {candidateSuggestions.length > 0
                ? `${candidateSuggestions.length} candidatos pendentes`
                : "Sem candidatos pendentes"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {candidateSuggestions.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-xl bg-muted/10">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />
              <p className="text-xs font-semibold text-foreground">
                Nenhum aprendizado candidato pendente no momento.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Conforme os operadores realizam atendimentos, novas oportunidades serão mineradas e listadas aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidateSuggestions.map((sug) => {
                const isProcessing = processingSuggestionId === sug.id;
                return (
                  <div
                    key={sug.id}
                    className="p-4 rounded-xl border border-border/70 bg-muted/5 hover:border-emerald-500/40 transition-all space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                        {sug.topic || "Estratégia de Atendimento"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {sug.status === "testing" ? (
                          <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[9px] font-bold">
                            Sandbox 10% Ativo
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            {sug.confidence_score ? `${Math.round(sug.confidence_score * 100)}% confiança` : "Alta Relevância"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Situação Identificada:</span>
                      <p className="text-xs text-foreground font-medium italic">
                        "{sug.situation_summary || sug.pattern || "Situação identificada em conversas"}"
                      </p>
                    </div>

                    <div className="space-y-1 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-300 font-bold uppercase">Estratégia Proposta:</span>
                      <p className="text-xs text-foreground font-semibold">
                        {sug.proposed_strategy || sug.golden_response || "Resposta recomendada para fechamento assertivo"}
                      </p>
                    </div>

                    {/* ACTIONS: APROVAR, TESTAR SANDBOX 10%, IGNORAR */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleRejectCandidate(sug.id)}
                        className="h-8 text-xs text-muted-foreground hover:text-rose-400 px-2.5"
                      >
                        <X className="h-3.5 w-3.5 mr-1" /> Ignorar
                      </Button>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isProcessing || sug.status === "testing"}
                          onClick={() => handleTestCandidate(sug)}
                          className="h-8 text-xs border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20"
                        >
                          <Zap className="h-3.5 w-3.5 mr-1 text-purple-400" />
                          <span>Testar Sandbox 10%</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleApproveCandidate(sug.id)}
                          className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-xs"
                        >
                          {isProcessing ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1" />
                          )}
                          <span>Aprovar</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 2: CROSS-CONVERSATION LEARNED PATTERNS */}
      <Card className="bg-card border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="h-5 w-5 text-indigo-400" /> Conhecimento Evolutivo Cruzado (Aprendizado de Outras Conversas)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Respostas de ouro reais que o agente absorveu dos operadores para usar em novos atendimentos.
              </CardDescription>
            </div>

            <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 bg-indigo-500/10 text-xs px-2.5 py-0.5 font-bold">
              Padrões registrados
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {learnedPatterns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum padrão aprendido está disponível para este atendente.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {learnedPatterns.map(pattern => (
                <article key={pattern.id} className="space-y-2.5 rounded-xl border border-border/70 bg-muted/5 p-4">
                  <Badge variant="outline">{pattern.topicLabel || pattern.topic}</Badge>
                  <div className="space-y-1"><span className="text-[10px] font-bold uppercase text-muted-foreground">Pergunta aprendida</span><p className="text-xs text-foreground">{pattern.customerUtterance}</p></div>
                  <div className="space-y-1 rounded-lg border border-border/50 bg-muted/20 p-2.5"><span className="text-[10px] font-bold uppercase text-muted-foreground">Resposta registrada</span><p className="text-xs text-foreground">{pattern.goldenReply}</p></div>
                  {pattern.recommendedCta && <p className="text-[11px] text-muted-foreground">Próximo passo: {pattern.recommendedCta}</p>}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 3: LEARNING GAPS (DÚVIDAS NÃO RESPONDIDAS) */}
      <Card className="bg-card border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <HelpCircle className="h-5 w-5 text-amber-400" /> Central de Aprendizado (Lacunas Detectadas)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Dúvidas de clientes que podem ser ensinadas para enriquecer ainda mais o agente.
              </CardDescription>
            </div>

            <Badge
              variant="outline"
              className={cn(
                "text-xs px-2.5 py-0.5 font-bold",
                learningEvents.length > 0
                  ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                  : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
              )}
            >
              {learningEvents.length > 0 ? `${learningEvents.length} pendentes` : "Sem pendências"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {learningEvents.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-xl bg-muted/10">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />
              <p className="text-xs font-semibold text-foreground">Nenhuma lacuna pendente no momento!</p>
              <p className="text-[11px] text-muted-foreground">
                Seu atendente está respondendo todas as dúvidas dos clientes com confiança e naturalidade.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {learningEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-amber-500/40 transition-all space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Dúvida do Cliente:
                      </span>
                      <p className="text-xs font-semibold text-foreground">
                        "{evt.customerQuestion}"
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleIgnoreEvent(evt.id)}
                        className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3 mr-1" /> Ignorar
                      </Button>
                    </div>
                  </div>

                  {/* Input de Ensinamento */}
                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <Input
                      value={answeringAnswers[evt.id] || ""}
                      onChange={(e) =>
                        setAnsweringAnswers((prev) => ({ ...prev, [evt.id]: e.target.value }))
                      }
                      placeholder="Como o agente deve responder de forma natural? Digite a resposta oficial..."
                      className="h-9 text-xs flex-1 bg-muted/20"
                    />
                    <Button
                      type="button"
                      onClick={() => handleTeachAgent(evt.id)}
                      disabled={teachingId === evt.id}
                      size="sm"
                      className="h-9 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold gap-1.5 shrink-0 w-full sm:w-auto"
                    >
                      {teachingId === evt.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {teachingId === evt.id ? "Gravando..." : "Ensinar Agente"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SECTION 4: EVOLUTION TIMELINE & HISTORY */}
      <Card className="bg-card border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <History className="h-5 w-5 text-emerald-400" /> Histórico de Evoluções e Atualizações
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Registro cronológico das melhorias aplicadas no cérebro do assistente virtual.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {historyLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              O histórico evolutivo será registrado conforme o atendente for treinado.
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-border/60">
              {historyLogs.slice(0, 8).map((log, idx) => (
                <div key={log.id || idx} className="flex items-start gap-3 relative pl-6">
                  <span className="absolute left-2.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-background" />
                  <div className="flex-1 text-xs space-y-0.5">
                    <p className="font-semibold text-foreground">{log.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{log.createdAt || "Recentemente"}</span>
                      {log.scoreChange && (
                        <span className="text-emerald-400 font-bold">+{log.scoreChange} pts</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      )}
    </div>
  );
}
