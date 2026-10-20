import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
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
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";
import { ActiveBrainGraph } from "@/components/evolution/ActiveBrainGraph";
import { MemoryDetailDrawer, type MemoryNodeData } from "@/components/evolution/MemoryDetailDrawer";
import { ConversationScoresSection } from "@/components/evolution/ConversationScoresSection";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { createAgentAvatar } from "@/components/avatar-engine/CharacterFactory";
import { useAppStore } from "@/state/stores/appStore";

interface EvolutionOverview {
  score: number | null;
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
  level: number | null;
  levelTitle: string | null;
  totalXp: number | null;
  currentLevelMinXp: number | null;
  nextLevelXp: number | null;
  progressPct: number | null;
  evolutionScore: number | null;
  totalHumanMessages: number | null;
  humanSamplesLearned: number | null;
  activePlaybooks: number | null;
  naturalnessScore: number | null;
  conversionsCount: number | null;
  objectionsLearned: number | null;
  successRate: number | null;
  totalAnalyzed: number | null;
}

export interface EvolutionTabProps {
  agentKey?: string;
  onSelectAgent?: (key: string) => void;
  agents?: any[];
  selectedAgent?: any;
  isSessionConnected?: boolean;
}

const KNOWN_MEMORY_CATEGORIES = [
  { id: "client", label: "Clientes", color: "#06b6d4" },
  { id: "preference", label: "Preferências", color: "#ec4899" },
  { id: "topic", label: "Tópicos & Regras", color: "#10b981" },
  { id: "payment", label: "Pagamentos & PIX", color: "#f59e0b" },
  { id: "delivery", label: "Entrega & Frete", color: "#f43f5e" },
  { id: "product", label: "Produtos", color: "#3b82f6" },
  { id: "objection", label: "Objeções Resolvidas", color: "#8b5cf6" },
];

export function EvolutionTab({ agentKey, onSelectAgent, agents: initialAgents, selectedAgent, isSessionConnected: propIsSessionConnected }: EvolutionTabProps = {}) {
  const storeSessions = useAppStore((state) => state.sessions);
  const hasLiveSession = storeSessions.length > 0
    ? storeSessions.some((s) => s.connected || s.status === "connected")
    : true;
  const isSessionConnected = propIsSessionConnected !== undefined ? propIsSessionConnected : hasLiveSession;
  const { toast } = useToast();
  const onSelectAgentRef = useRef(onSelectAgent);
  onSelectAgentRef.current = onSelectAgent;

  const [agentsList, setAgentsList] = useState<any[]>(initialAgents || []);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>(() => agentKey || "");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const memoryRequestId = useRef(0);
  const [memoryLoading, setMemoryLoading] = useState(Boolean(agentKey));
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [isDetectingGaps, setIsDetectingGaps] = useState(false);

  useEffect(() => {
    setSelectedAgentKey(agentKey || "");
  }, [agentKey]);

  useEffect(() => {
    if (initialAgents && initialAgents.length > 0) {
      setAgentsList(initialAgents);
      if (!agentKey && !onSelectAgentRef.current) {
        const firstAttendant = initialAgents.find((a: any) => !a.isPlatformAssistant && a.key !== "zaibot");
        if (firstAttendant) setSelectedAgentKey(firstAttendant.key || firstAttendant.id);
      }
    } else if (typeof apiService?.getAIAgents === "function") {
      apiService.getAIAgents().then((res) => {
        const list = res?.agents || [];
        setAgentsList(list);
        if (!agentKey && !onSelectAgentRef.current && list.length > 0) {
          const firstAttendant = list.find((a: any) => !a.isPlatformAssistant && a.key !== "zaibot");
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

  const currentAgent = React.useMemo(() => {
    if (selectedAgent && (!selectedAgentKey || (selectedAgent.key || selectedAgent.id) === selectedAgentKey)) {
      return selectedAgent;
    }
    return agentsList.find((a) => (a.key || a.id) === selectedAgentKey) || selectedAgent || null;
  }, [selectedAgent, agentsList, selectedAgentKey]);

  const currentAvatarConfig = React.useMemo(() => {
    if (currentAgent?.avatarConfig) return currentAgent.avatarConfig;
    const name = currentAgent?.name || selectedAgentKey || "Atendente";
    return createAgentAvatar({
      agentId: currentAgent?.key || currentAgent?.id || selectedAgentKey || "default",
      name,
      role: currentAgent?.role || "Atendente",
      gender: currentAgent?.character?.gender || (name.toLowerCase().includes("carlos") ? "male" : "female"),
    });
  }, [currentAgent, selectedAgentKey]);

  // Date filter state ("all" | "today" | "7d" | "30d" | "custom")
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "7d" | "30d" | "custom">("all");
  const [customDateStart, setCustomDateStart] = useState<string>("");
  const [customDateEnd, setCustomDateEnd] = useState<string>("");

  // View sub-tabs & Active Brain Graph state
  const [evolutionSubTab, setEvolutionSubTab] = useState<"graph" | "list" | "timeline" | "cognitive" | "conversations">("graph");
  const [selectedMemoryNode, setSelectedMemoryNode] = useState<MemoryNodeData | null>(null);
  const [graphCategoryFilter, setGraphCategoryFilter] = useState<string>("todos");

  // Human Memory & Learning State
  const [memorySearch, setMemorySearch] = useState("");
  const [memoryCategory, setMemoryCategory] = useState<string>("todos");
  const [memoryPage, setMemoryPage] = useState(1);
  const [memoryItems, setMemoryItems] = useState<MemoryNodeData[]>([]);
  const [centralConnectionIds, setCentralConnectionIds] = useState<Array<string | number>>([]);
  const [hasEvolutionData, setHasEvolutionData] = useState(false);

  // Score & Overview
  const [overview, setOverview] = useState<EvolutionOverview>({
    score: null,
    level: "Sem dados",
    goal: { current: 0, target: 0, percentage: 0 },
    components: { answers: 0, refinements: 0, coverage: 0, queue: 0 },
  });

  // Human stats from manual attendance mining
  const [humanStats, setHumanStats] = useState<HumanStats>({
    level: null,
    levelTitle: null,
    totalXp: null,
    currentLevelMinXp: null,
    nextLevelXp: null,
    progressPct: null,
    evolutionScore: null,
    totalHumanMessages: null,
    humanSamplesLearned: null,
    activePlaybooks: null,
    naturalnessScore: null,
    conversionsCount: null,
    objectionsLearned: null,
    successRate: null,
    totalAnalyzed: null,
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
  const [storeAlgorithms, setStoreAlgorithms] = useState<any[]>([]);
  const [followupEngineStatus, setFollowupEngineStatus] = useState<any | null>(null);
  const [isRunningFollowupScan, setIsRunningFollowupScan] = useState(false);

  // Load agent data with Zero Mock real backend endpoints
  const loadAgentData = useCallback(async (agentKey: string) => {
    const requestId = ++loadRequestId.current;
    setIsLoading(true);
    setLoadError(null);
    setHasEvolutionData(false);
    setOverview({ score: null, level: "Sem dados", goal: { current: 0, target: 0, percentage: 0 }, components: { answers: 0, refinements: 0, coverage: 0, queue: 0 } });
    setHumanStats({ level: null, levelTitle: null, totalXp: null, currentLevelMinXp: null, nextLevelXp: null, progressPct: null, evolutionScore: null, totalHumanMessages: null, humanSamplesLearned: null, activePlaybooks: null, naturalnessScore: null, conversionsCount: null, objectionsLearned: null, successRate: null, totalAnalyzed: null });
    setHistoryLogs([]);
    setLearnedPatterns([]);
    setCandidateSuggestions([]);
    setLearningEvents([]);
    setStoreAlgorithms([]);
    setFollowupEngineStatus(null);
    try {
      const [evoRes, learnRes, patternsRes, levelRes, suggestionsRes, algoRes] = await Promise.all([
        apiService.getAgentEvolution(agentKey),
        apiService.getAgentLearning(agentKey),
        apiService.getLearnedPatterns(),
        requestApiEndpoint<any>(`/api/ai/evolution/agent-level?agentKey=${encodeURIComponent(agentKey)}`),
        requestApiEndpoint<any>("/api/ai/evolution/suggestions"),
        requestApiEndpoint<any>("/api/ai/evolution/lead-algorithms").catch(() => null),
      ]);
      if (requestId !== loadRequestId.current) return;
      if ([evoRes, learnRes, patternsRes, levelRes, suggestionsRes].some((response) => response?.success === false)) {
        throw new Error("Não foi possível carregar os dados de evolução deste atendente.");
      }

      if (evoRes?.evolution) {
        setOverview(evoRes.evolution);
        if (evoRes.history && Array.isArray(evoRes.history)) {
          setHistoryLogs(evoRes.history);
        }
      }

      const levelData = levelRes?.data || levelRes;
      const hasLevelData = Boolean(levelData && typeof levelData === "object" && Object.keys(levelData).some((key) => key !== "success"));
      const algoPayload = algoRes?.data || algoRes;
      const algoList = Array.isArray(algoPayload?.storeEvolutionAlgorithms) ? algoPayload.storeEvolutionAlgorithms : [];
      if (algoList.length > 0) {
        setStoreAlgorithms(algoList);
      }
      if (algoPayload?.aiFollowupEngine) {
        setFollowupEngineStatus(algoPayload.aiFollowupEngine);
      }

      setHasEvolutionData(Boolean(evoRes?.evolution || hasLevelData || algoList.length > 0));
      if (hasLevelData) {
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
    const requestId = ++memoryRequestId.current;
    setMemoryItems([]);
    setCentralConnectionIds([]);
    setSelectedMemoryNode(null);
    setGraphCategoryFilter("todos");
    setMemoryCategory("todos");
    setMemorySearch("");
    setMemoryError(null);
    if (!agentKey) {
      setMemoryLoading(false);
      return;
    }
    setMemoryLoading(true);
    try {
      const res = await requestApiEndpoint<any>(`/api/ai/memory/graph?agentKey=${encodeURIComponent(agentKey)}&limit=80`);
      if (requestId !== memoryRequestId.current) return;
      if (res?.success === false) throw new Error(res.error || "Falha ao consultar memórias.");
      const graph = res?.data || res;
      const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
      const edges = Array.isArray(graph?.edges) ? graph.edges : [];
      const visibleNodes = nodes.filter((node: any) => node.type !== "agent");
      const agentIds = new Set(nodes.filter((node: any) => node.type === "agent").map((node: any) => String(node.id)));
      const labels = new Map(visibleNodes.map((node: any) => [String(node.id), node.label || node.properties?.topic || String(node.id)]));
      const relations = new Map<string, Set<string>>();
      const centralRelations = new Set<string>();
      for (const edge of edges) {
        const source = String(edge.source?.id ?? edge.source);
        const target = String(edge.target?.id ?? edge.target);
        if (agentIds.has(source) && labels.has(target)) centralRelations.add(target);
        if (agentIds.has(target) && labels.has(source)) centralRelations.add(source);
        if (!labels.has(source) || !labels.has(target)) continue;
        if (!relations.has(source)) relations.set(source, new Set());
        if (!relations.has(target)) relations.set(target, new Set());
        relations.get(source)!.add(target);
        relations.get(target)!.add(source);
      }
      const enrichedNodes: MemoryNodeData[] = visibleNodes.map((node: any) => {
        const properties = node.properties || {};
        const directConfidence = node.confidence ?? properties.confidence ?? properties.confidenceScore;
        const facts = properties.facts ?? properties.observations;
        const id = String(node.id);
        const type = node.type === "contact" ? "client" : node.type || node.category || "unknown";
        return {
          id: node.id,
          type,
          category: node.category,
          label: node.label || properties.topic || id,
          desc: node.desc || node.description || properties.description || properties.summary || properties.contactName || properties.objection || properties.preference,
          confidence: typeof directConfidence === "number" && Number.isFinite(directConfidence) ? directConfidence : undefined,
          phone: properties.contactPhone || properties.phone,
          facts: Array.isArray(facts) ? facts.filter((fact: unknown): fact is string => typeof fact === "string") : undefined,
          connections: [...(relations.get(id) || [])].map((relatedId) => labels.get(relatedId)!).filter(Boolean),
          connectionIds: [...(relations.get(id) || [])],
          conversationSnippet: properties.conversationSnippet || properties.exampleConversation,
          createdAt: node.createdAt || properties.createdAt,
        };
      });
      setMemoryItems(enrichedNodes);
      setCentralConnectionIds([...centralRelations]);
      setSelectedMemoryNode(enrichedNodes[0] || null);
    } catch (err) {
      if (requestId !== memoryRequestId.current) return;
      setMemoryItems([]);
      setCentralConnectionIds([]);
      setSelectedMemoryNode(null);
      setMemoryError(err instanceof Error ? err.message : "Não foi possível carregar as memórias.");
    } finally {
      if (requestId === memoryRequestId.current) setMemoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAgentKey) {
      void loadAgentData(selectedAgentKey);
      void loadAgentMemories(selectedAgentKey);
    } else {
      ++loadRequestId.current;
      ++memoryRequestId.current;
      setIsLoading(false);
      setMemoryItems([]);
      setCentralConnectionIds([]);
      setSelectedMemoryNode(null);
      setMemoryLoading(false);
      setMemoryError(null);
      setLoadError(null);
      setHasEvolutionData(false);
      setHistoryLogs([]);
      setLearnedPatterns([]);
      setCandidateSuggestions([]);
      setLearningEvents([]);
    }
  }, [selectedAgentKey, loadAgentData, loadAgentMemories]);

  const matchesDateFilter = useCallback(
    (rawDate?: string | number | null) => {
      if (dateFilter === "all") return true;
      if (!rawDate) return false;
      const parsed = new Date(rawDate).getTime();
      if (!Number.isFinite(parsed)) return false;

      const now = new Date();
      if (dateFilter === "today") {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return parsed >= startOfDay;
      }
      if (dateFilter === "7d") {
        return parsed >= Date.now() - 7 * 24 * 60 * 60 * 1000;
      }
      if (dateFilter === "30d") {
        return parsed >= Date.now() - 30 * 24 * 60 * 60 * 1000;
      }
      if (dateFilter === "custom") {
        if (customDateStart) {
          const startMs = new Date(`${customDateStart}T00:00:00`).getTime();
          if (Number.isFinite(startMs) && parsed < startMs) return false;
        }
        if (customDateEnd) {
          const endMs = new Date(`${customDateEnd}T23:59:59.999`).getTime();
          if (Number.isFinite(endMs) && parsed > endMs) return false;
        }
        return true;
      }
      return true;
    },
    [dateFilter, customDateStart, customDateEnd]
  );

  const dateFilteredMemoryItems = React.useMemo(
    () => memoryItems.filter((item) => matchesDateFilter(item.createdAt)),
    [memoryItems, matchesDateFilter]
  );

  const dateFilteredLearnedPatterns = React.useMemo(
    () => learnedPatterns.filter((p) => matchesDateFilter(p.learnedAt)),
    [learnedPatterns, matchesDateFilter]
  );

  const dateFilteredCandidateSuggestions = React.useMemo(
    () => candidateSuggestions.filter((s) => matchesDateFilter(s.created_at || s.createdAt || s.updated_at)),
    [candidateSuggestions, matchesDateFilter]
  );

  const dateFilteredLearningEvents = React.useMemo(
    () => learningEvents.filter((e) => matchesDateFilter(e.createdAt)),
    [learningEvents, matchesDateFilter]
  );

  const dateFilteredHistoryLogs = React.useMemo(
    () => historyLogs.filter((h) => matchesDateFilter(h.createdAt)),
    [historyLogs, matchesDateFilter]
  );

  const filteredMemories = React.useMemo(() => {
    let items = dateFilteredMemoryItems;
    if (memoryCategory !== "todos") {
      items = items.filter((n) => (n.type === memoryCategory || n.category === memoryCategory));
    }
    if (memorySearch.trim()) {
      const q = memorySearch.toLowerCase().trim();
      items = items.filter((n) => (n.label || "").toLowerCase().includes(q) || (n.desc || "").toLowerCase().includes(q));
    }
    return items;
  }, [dateFilteredMemoryItems, memoryCategory, memorySearch]);

  const memoryCategories = React.useMemo(() => {
    const presentTypes = new Set(dateFilteredMemoryItems.map((memory) => memory.type || memory.category || "unknown"));
    const knownIds = new Set(KNOWN_MEMORY_CATEGORIES.map((category) => category.id));
    const known = KNOWN_MEMORY_CATEGORIES
      .filter((category) => presentTypes.has(category.id))
      .map((category) => ({
        ...category,
        count: dateFilteredMemoryItems.filter((memory) => (memory.type || memory.category) === category.id).length,
      }));
    const additional = [...presentTypes]
      .filter((type) => !knownIds.has(type))
      .map((type, index) => ({
        id: type,
        label: type === "unknown" ? "Sem categoria" : type.replace(/[_-]/g, " ").replace(/^\w/, (letter) => letter.toLocaleUpperCase("pt-BR")),
        color: ["#14b8a6", "#f97316", "#a855f7", "#84cc16"][index % 4],
        count: dateFilteredMemoryItems.filter((memory) => (memory.type || memory.category || "unknown") === type).length,
      }));
    return [...known, ...additional];
  }, [dateFilteredMemoryItems]);

  useEffect(() => {
    setMemoryPage(1);
  }, [memoryCategory, memorySearch, dateFilter, customDateStart, customDateEnd]);

  useEffect(() => {
    if (
      selectedMemoryNode &&
      graphCategoryFilter !== "todos" &&
      (selectedMemoryNode.type || selectedMemoryNode.category) !== graphCategoryFilter
    ) {
      setSelectedMemoryNode(null);
    }
  }, [graphCategoryFilter, selectedMemoryNode]);

  const MEMORY_PAGE_SIZE = 10;
  const totalMemoryPages = Math.max(1, Math.ceil(filteredMemories.length / MEMORY_PAGE_SIZE));
  const paginatedMemories = React.useMemo(() => {
    const start = (memoryPage - 1) * MEMORY_PAGE_SIZE;
    return filteredMemories.slice(start, start + MEMORY_PAGE_SIZE);
  }, [filteredMemories, memoryPage]);

  // Sync and Learn from Manual Attendances
  const handleSyncManual = async () => {
    if (!selectedAgentKey) return;
    setIsSyncingManual(true);
    try {
      const res = await apiService.syncManualAttendance(300);
      if (res?.success) {
        toast({
          title: "Aprendizado Manual Concluído!",
          description: `${res.pairsFound ?? "—"} conversas analisadas e ${res.newSamplesLearned ?? "—"} novos padrões registrados.`,
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
    if (!selectedAgentKey) return;
    setIsDetectingGaps(true);
    try {
      const res = await apiService.detectAgentGaps(selectedAgentKey);
      toast({
        title: "Varredura concluída",
        description: `${res?.createdCount ?? "—"} oportunidades de melhoria identificadas nas conversas.`,
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
          {selectedAgentKey ? (
            <div className="h-12 w-12 rounded-2xl bg-[#091120] border border-purple-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <ZaiAvatarRenderer
                avatar={currentAvatarConfig}
                state={currentAgent?.active === false || !isSessionConnected ? "IDLE" : "WORKING"}
                size="sm"
                showAura={false}
                showStatusBadge={false}
                showBrandingLayer={false}
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <GraduationCap className="h-5 w-5" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Evolução & Memória do Atendente
              {selectedAgentKey && <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-300 bg-purple-500/10 capitalize">
                {currentAgent?.name || selectedAgentKey}
              </Badge>}
            </h3>
            <p className="text-xs text-muted-foreground">
              {selectedAgentKey ? "Memórias e métricas registradas pelo sistema para este atendente." : "Selecione um atendente para consultar seus dados."}
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

          {selectedAgentKey && <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleSyncManual}
            disabled={isSyncingManual}
            className="h-9 text-xs gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-xs"
          >
            <Sparkles className={cn("h-3.5 w-3.5", isSyncingManual && "animate-spin")} />
            {isSyncingManual ? "Minerando Atendimentos..." : "Aprender dos Atendimentos Manuais"}
          </Button>}

          {selectedAgentKey && <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDetectGaps}
            disabled={isDetectingGaps}
            className="h-9 text-xs gap-1.5 border-border/70 hover:border-purple-500/50"
          >
            <Search className={cn("h-3.5 w-3.5", isDetectingGaps && "animate-spin")} />
            {isDetectingGaps ? "Analisando..." : "Escanear Lacunas"}
          </Button>}
        </div>
      </div>

      {/* WHATSAPP OFFLINE / PAUSE BANNER */}
      {!isSessionConnected && (
        <div className="p-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <div>
              <p className="font-bold text-red-200">WhatsApp Desconectado — Atendente em Pausa Operacional</p>
              <p className="text-[11px] text-red-300/80">
                O atendente está offline. Novas memórias e evolução em tempo real serão sincronizadas assim que a sessão for conectada.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-red-500/40 bg-red-500/20 text-red-300 text-[10px] shrink-0 font-mono">
            ⏸ ZAP OFF
          </Badge>
        </div>
      )}

      {!selectedAgentKey ? (
        <Card role="status" className="p-8 text-center border-border/70 bg-card/60">
          <p className="text-sm font-medium text-foreground">{agentsList.length ? "Selecione um atendente para ver suas memórias." : "Nenhum atendente disponível."}</p>
          <p className="mt-1 text-xs text-muted-foreground">Os dados de memória e evolução aparecerão aqui quando houver um atendente selecionado.</p>
        </Card>
      ) : <>

      {loadError && <Card role="alert" className="border-destructive/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-destructive">Não foi possível carregar métricas e padrões deste atendente: {loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadAgentData(selectedAgentKey)}>
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
        </Button>
      </Card>}

      {/* ROW 1: 4 COGNITIVE KPI METRICS (Canonical Height 72–84px, Real Data) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="h-[76px] p-3 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Memórias Ativas
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-foreground">
                {!isSessionConnected ? "0" : (memoryLoading ? "…" : memoryError ? "—" : dateFilteredMemoryItems.length)}
              </strong>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5" />
          </div>
        </div>

        <div className="h-[76px] p-3 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Tópicos Identificados
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-foreground">
                {!isSessionConnected ? "0" : (isLoading ? "…" : loadError ? "—" : dateFilteredLearnedPatterns.length)}
              </strong>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="h-[76px] p-3 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Objeções Aprendidas
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-foreground">
                {!isSessionConnected ? "0" : (loadError ? "—" : humanStats.objectionsLearned ?? "—")}
              </strong>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="h-[76px] p-3 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Atendimentos Analisados
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-foreground">
                {!isSessionConnected ? "0" : (loadError ? "—" : humanStats.totalAnalyzed ?? "—")}
              </strong>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* SUB-TABS & DATE FILTER BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
            <span>Cérebro Ativo</span>
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
            <span>Memórias Relevantes</span>
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

          <button
            type="button"
            onClick={() => setEvolutionSubTab("conversations")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all select-none cursor-pointer",
              evolutionSubTab === "conversations"
                ? "bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <Award className="h-4 w-4 text-purple-400" />
            <span>Pontuação Real & Conversas</span>
          </button>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-card/80 border border-border/70 w-fit" data-testid="evolution-date-filter">
          <span className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-purple-400" />
            <span>Período:</span>
          </span>
          {(
            [
              { id: "all", label: "Geral" },
              { id: "today", label: "Hoje" },
              { id: "7d", label: "7D" },
              { id: "30d", label: "30D" },
              { id: "custom", label: "Personalizado" },
            ] as const
          ).map((period) => (
            <button
              key={period.id}
              type="button"
              onClick={() => setDateFilter(period.id)}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all select-none cursor-pointer",
                dateFilter === period.id
                  ? "bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              )}
            >
              {period.label}
            </button>
          ))}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5">
              <input
                type="date"
                aria-label="Data inicial"
                value={customDateStart}
                onChange={(e) => setCustomDateStart(e.target.value)}
                className="h-7 px-2 rounded-lg bg-muted/40 border border-border/70 text-[11px] text-foreground outline-none focus:border-purple-500/50"
              />
              <span className="text-[10px] text-muted-foreground">até</span>
              <input
                type="date"
                aria-label="Data final"
                value={customDateEnd}
                onChange={(e) => setCustomDateEnd(e.target.value)}
                className="h-7 px-2 rounded-lg bg-muted/40 border border-border/70 text-[11px] text-foreground outline-none focus:border-purple-500/50"
              />
            </div>
          )}
        </div>
      </div>

      {/* MODE 1: CÉREBRO ATIVO (GRAFO) */}
      {evolutionSubTab === "graph" && (
        <div className="space-y-6">
          <div className={cn(
            "grid grid-cols-1 gap-4 items-start",
            selectedMemoryNode
              ? "xl:grid-cols-[240px_minmax(0,1fr)_320px]"
              : "xl:grid-cols-[240px_minmax(0,1fr)]"
          )}>
          {/* Left Column: Category Filters */}
          <div className="min-w-0 space-y-2 p-3 rounded-2xl border border-border/80 bg-card shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Categorias do Cérebro
              </span>
              <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                {!isSessionConnected ? 0 : (memoryLoading ? "…" : memoryError ? "—" : dateFilteredMemoryItems.length)} Nós
              </Badge>
            </div>

            <div className="space-y-1 pt-1">
              {[
                { id: "todos", label: "Todos os Nós", color: "#8b5cf6", count: !isSessionConnected ? 0 : dateFilteredMemoryItems.length },
                ...memoryCategories,
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
                {!isSessionConnected ? 0 : (memoryLoading ? "…" : memoryError ? "—" : cat.count)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Center Column: Interactive Active Brain Graph Canvas */}
          <div className="min-w-0 space-y-2">
            {memoryLoading ? (
              <div role="status" className="min-h-[220px] rounded-2xl border border-border/70 bg-card/60 flex items-center justify-center text-sm text-muted-foreground">Carregando memórias…</div>
            ) : memoryError ? (
              <div role="alert" className="min-h-[220px] rounded-2xl border border-destructive/40 bg-card/60 p-5 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-destructive">Não foi possível carregar as memórias: {memoryError}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadAgentMemories(selectedAgentKey)}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>
              </div>
            ) : dateFilteredMemoryItems.length === 0 ? (
              <div role="status" className="min-h-[220px] rounded-2xl border border-dashed border-border/70 bg-card/40 p-5 flex flex-col items-center justify-center gap-2 text-center">
                <Brain className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Nenhuma memória registrada</p>
                <p className="text-xs text-muted-foreground">
                  {memoryItems.length > 0 ? "Nenhuma memória encontrada para o período selecionado." : "As memórias aparecerão aqui quando forem registradas pelo sistema."}
                </p>
              </div>
            ) : <ActiveBrainGraph
              attendantName={currentAgent?.name || selectedAgentKey}
              avatarConfig={currentAvatarConfig}
              memories={!isSessionConnected ? [] : dateFilteredMemoryItems}
              centralConnectionIds={centralConnectionIds}
              selectedCategory={graphCategoryFilter}
              selectedMemoryId={!isSessionConnected ? null : (selectedMemoryNode?.id || null)}
              onSelectMemory={(mem) => setSelectedMemoryNode(mem)}
              onSelectCategory={(cat) => setGraphCategoryFilter(cat)}
              height={580}
              isSessionConnected={isSessionConnected}
            />}
          </div>

          {/* Right Column: Memory Detail Drawer */}
          {selectedMemoryNode && isSessionConnected && (
            <div className="min-w-0">
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
                <div className="relative flex items-center justify-center gap-4">
                  <div className="h-24 w-24 rounded-2xl bg-[#091120] border border-purple-500/30 flex items-center justify-center overflow-hidden shadow-inner">
                    <ZaiAvatarRenderer
                      avatar={currentAvatarConfig}
                      state={currentAgent?.active === false ? "IDLE" : "WORKING"}
                      size="md"
                      showAura={false}
                      showStatusBadge={false}
                      showBrandingLayer={false}
                    />
                  </div>
                  <div className="h-24 w-24 rounded-full border-4 border-purple-500/20 flex flex-col items-center justify-center bg-purple-500/5 shadow-inner">
                    <span className="text-2xl font-black text-purple-400 font-display">
                      {humanStats.evolutionScore ?? overview.score ?? "—"}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Registros
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-2 w-full max-w-xs">
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-3 py-1 uppercase font-bold tracking-wider">
                    Nível {humanStats.level ?? "—"}: {humanStats.levelTitle || "—"}
                  </Badge>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Progresso do Nível</span>
                      <span className="font-mono font-bold text-foreground">
                        {humanStats.totalXp == null ? "—" : humanStats.totalXp.toLocaleString("pt-BR")} / {humanStats.nextLevelXp == null ? "—" : humanStats.nextLevelXp.toLocaleString("pt-BR")} XP
                      </span>
                    </div>
                    {humanStats.progressPct == null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : <Progress value={humanStats.progressPct} className="h-2 bg-muted/40" />}
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
                  {humanStats.naturalnessScore == null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : <Progress value={humanStats.naturalnessScore} className="h-2 bg-muted/40" />}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Objeções Aprendidas de Humanos
                    </span>
                    <span className="text-muted-foreground font-mono font-bold">{humanStats.objectionsLearned == null ? "—" : `${humanStats.objectionsLearned} padrões`}</span>
                  </div>
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
                  isLoading || loadError
                    ? "border-border/60 text-muted-foreground bg-muted/10"
                    : learningEvents.length > 0
                    ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                    : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                )}
              >
                {isLoading ? "…" : loadError ? "—" : learningEvents.length > 0 ? `${learningEvents.length} pendentes` : "Sem pendências"}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      </div>
      )}

      {/* MODE 2: MEMÓRIAS RELEVANTES (LISTA COM PAGINAÇÃO CANÔNICA) */}
      {evolutionSubTab === "list" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className={cn(selectedMemoryNode ? "lg:col-span-8" : "lg:col-span-12")}>
            <Card className="bg-card border-border/80 shadow-md overflow-hidden flex flex-col">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                      <Brain className="h-5 w-5 text-purple-400" /> Memórias Relevantes
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {filteredMemories.length} memórias consolidadas para este atendente (10 por página).
                    </CardDescription>
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                    {[
                      { id: "todos", label: "Todas as Memórias" },
                      ...memoryCategories.map((c) => ({ id: c.id, label: c.label })),
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setMemoryCategory(cat.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 select-none cursor-pointer",
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
                    {memoryLoading ? "Carregando memórias…" : memoryError ? "Não foi possível carregar as memórias." : memoryItems.length === 0 ? "Nenhuma memória registrada para este atendente." : "Nenhuma memória encontrada para este filtro."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {paginatedMemories.map((mem) => {
                      const isObjection = mem.type === "objection";
                      const isPref = mem.type === "preference";
                      const categoryLabel = KNOWN_MEMORY_CATEGORIES.find((category) => category.id === (mem.type || mem.category))?.label
                        || ((mem.type || mem.category) === "unknown" ? "Sem categoria" : (mem.type || mem.category || "—").replace(/[_-]/g, " "));
                      const isSelected = selectedMemoryNode?.id === mem.id;
                      return (
                        <div
                          key={mem.id}
                          onClick={() => setSelectedMemoryNode(mem)}
                          className={cn(
                            "p-3 rounded-xl border transition-all space-y-1.5 flex flex-col justify-between min-h-[110px] max-h-[140px] cursor-pointer select-none",
                            isSelected
                              ? "bg-purple-950/20 border-purple-500 shadow-sm shadow-purple-500/10"
                              : "border-border/70 bg-card/60 hover:bg-card hover:border-purple-500/40"
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] font-bold uppercase py-0",
                                  isObjection
                                    ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                                    : isPref
                                    ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                                    : "border-purple-500/40 text-purple-300 bg-purple-500/10"
                                )}
                              >
                                {isObjection ? "Objeção" : isPref ? "Preferência" : categoryLabel}
                              </Badge>
                            <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                                Assertividade {mem.confidence == null ? "—" : `${mem.confidence}%`}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-foreground line-clamp-1">{mem.label}</h4>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{mem.desc}</p>
                          </div>

                          <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-3 w-3" /> Ativa
                            </span>
                            {mem.phone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/inbox?chatId=${encodeURIComponent(mem.phone!)}`);
                                }}
                                className="hover:text-foreground text-purple-400 font-medium hover:underline cursor-pointer"
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

              {totalMemoryPages > 1 && (
                <CardFooter className="pt-2 pb-3 border-t border-border/40 flex justify-center">
                  <Pagination
                    currentPage={memoryPage}
                    totalPages={totalMemoryPages}
                    pageSize={MEMORY_PAGE_SIZE}
                    onPageChange={setMemoryPage}
                  />
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Side Drawer in List Mode when a memory is selected */}
          {selectedMemoryNode && (
            <div className="lg:col-span-4">
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
      )}

      {/* MODE 3 & 4: LINHA DO TEMPO & EVOLUÇÃO COGNITIVA UNIFICADAS */}
      {(evolutionSubTab === "timeline" || evolutionSubTab === "cognitive") && (
        <div className="space-y-6">
          {hasEvolutionData ? (
            <>
              {(humanStats.totalHumanMessages != null || humanStats.naturalnessScore != null) && <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
      </div>}

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
            <div className="relative flex items-center justify-center gap-4">
              <div className="h-28 w-28 rounded-2xl bg-[#091120] border border-purple-500/30 flex items-center justify-center overflow-hidden shadow-inner">
                <ZaiAvatarRenderer
                  avatar={currentAvatarConfig}
                  state={currentAgent?.active === false ? "IDLE" : "WORKING"}
                  size="md"
                  showAura={false}
                  showStatusBadge={false}
                  showBrandingLayer={false}
                />
              </div>
              <div className="h-28 w-28 rounded-full border-4 border-purple-500/20 flex flex-col items-center justify-center bg-purple-500/5 shadow-inner">
                <span className="text-3xl font-black text-purple-400 font-display">
                  {humanStats.evolutionScore ?? overview.score ?? "—"}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Registros
                </span>
              </div>
            </div>

            <div className="text-center space-y-2 w-full max-w-xs">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-3 py-1 uppercase font-bold tracking-wider">
                Nível {humanStats.level ?? "—"}: {humanStats.levelTitle || "—"}
              </Badge>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Progresso do Nível</span>
                  <span className="font-mono font-bold text-foreground">
                    {humanStats.totalXp == null ? "—" : humanStats.totalXp.toLocaleString("pt-BR")} / {humanStats.nextLevelXp == null ? "—" : humanStats.nextLevelXp.toLocaleString("pt-BR")} XP
                  </span>
                </div>
                {humanStats.progressPct == null ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : <Progress value={humanStats.progressPct} className="h-2 bg-muted/40" />}
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
              {humanStats.naturalnessScore == null ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : <Progress value={humanStats.naturalnessScore} className="h-2 bg-muted/40" />}
            </div>

            {/* Pilar 2: Objeções Aprendidas de Humanos */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Objeções Aprendidas
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
              {humanStats.successRate == null ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : <Progress value={humanStats.successRate} className="h-2 bg-muted/40" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 2: ALGORITMOS DE EVOLUÇÃO DA LOJA (PADRÃO DA LOJA + ESTILO POR LEAD) & FOLLOW-UP IA */}
      {storeAlgorithms.length > 0 && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Network className="h-4 w-4 text-emerald-400" />
                  Algoritmos de Evolução da Loja (Padrão da Loja + Estilo de Conversa por Lead)
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  A atendente mantém o padrão oficial da loja enquanto adapta automaticamente o estilo de conversa e o follow-up para cada perfil de lead.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {followupEngineStatus && (
                  <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                    Follow-up IA Automático: {followupEngineStatus.active ? "ATIVO" : "PRONTO"} • {followupEngineStatus.followupMonitoredLeads ?? 0} monitorados
                  </Badge>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isRunningFollowupScan}
                  onClick={async () => {
                    setIsRunningFollowupScan(true);
                    try {
                      const res = await requestApiEndpoint<any>("/api/ai/evolution/followup-scan", "POST", { force: true, maxBatch: 3 });
                      const d = res?.data || res;
                      toast({
                        title: "Varredura de Follow-up IA Executada",
                        description: `Avaliados: ${d?.evaluated ?? 0} leads • Disparados: ${d?.dispatched ?? 0} • Protegidos (já compraram): ${d?.skippedPurchased ?? 0}`,
                      });
                      void loadAgentData(selectedAgentKey);
                    } catch (err: any) {
                      toast({
                        title: "Erro ao rodar varredura",
                        description: err?.message || "Não foi possível acionar o follow-up agora.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsRunningFollowupScan(false);
                    }
                  }}
                  className="h-8 text-xs border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isRunningFollowupScan && "animate-spin")} />
                  {isRunningFollowupScan ? "Verificando Leads..." : "Verificar Follow-up IA"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {storeAlgorithms.map((algo: any) => (
                <div
                  key={algo.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-muted/5 hover:border-emerald-500/40 transition-all flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono font-bold border-purple-500/40 text-purple-300 bg-purple-500/10">
                        {algo.code}
                      </Badge>
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                        {algo.activeLeadsCount ?? 0} leads
                      </Badge>
                    </div>
                    <h4 className="text-xs font-bold text-foreground leading-snug">{algo.name}</h4>
                    <p className="text-[11px] text-purple-300 font-medium">{algo.styleLabel}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{algo.storeStandardRule}</p>
                  </div>
                  <div className="pt-2 border-t border-border/40 text-[10px] text-foreground/80 line-clamp-2">
                    <strong className="text-emerald-400">Diretriz IA:</strong> {algo.directive}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </>
          ) : (
            <Card className="p-5 text-sm text-muted-foreground">{isLoading ? "Carregando evolução..." : "Sem dados de evolução disponíveis para este agente."}</Card>
          )}

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
                isLoading || loadError
                  ? "border-border/60 text-muted-foreground bg-muted/10"
                  : dateFilteredCandidateSuggestions.length > 0
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : "border-border/60 text-muted-foreground bg-muted/10"
              )}
            >
              {isLoading ? "…" : loadError ? "—" : dateFilteredCandidateSuggestions.length > 0
                ? `${dateFilteredCandidateSuggestions.length} candidatos pendentes`
                : "Sem candidatos pendentes"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {dateFilteredCandidateSuggestions.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-xl bg-muted/10">
              {!loadError && !isLoading && <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />}
              <p className="text-xs font-semibold text-foreground">
                {isLoading ? "Carregando candidatos…" : loadError ? "Não foi possível consultar os candidatos." : "Nenhum aprendizado candidato pendente no momento."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {loadError ? "Tente novamente para consultar os dados mais recentes." : "As oportunidades registradas aparecerão aqui para validação."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dateFilteredCandidateSuggestions.map((sug) => {
                const isProcessing = processingSuggestionId === sug.id;
                const rawScore = typeof sug.confidence_score === "number" && Number.isFinite(sug.confidence_score)
                  ? sug.confidence_score
                  : (typeof sug.relevancePct === "number" && Number.isFinite(sug.relevancePct) ? sug.relevancePct : null);

                const normalizedScore = rawScore == null ? null : (rawScore <= 1 && rawScore > 0 ? Math.round(rawScore * 100) : Math.round(rawScore));

                const confidence = rawScore == null
                  ? "—"
                  : `${normalizedScore}% confiança`;

                const isHighRelevance = normalizedScore != null && normalizedScore >= 85;
                const isSandboxRecommended = normalizedScore != null && normalizedScore < 85 && normalizedScore > 0;

                return (
                  <div
                    key={sug.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-card/60 hover:border-emerald-500/40 transition-all space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                          {sug.topic || "—"}
                        </Badge>
                        {isHighRelevance && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[9px] font-bold">
                            Aprovação Direta (≥ 85%)
                          </Badge>
                        )}
                        {isSandboxRecommended && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[9px] font-bold">
                            Sandbox Recomendado (&lt; 85%)
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {sug.status === "testing" ? (
                          <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[9px] font-bold">
                            Teste em andamento (10%)
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                            {confidence}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Situação Identificada:</span>
                      <p className="text-xs text-foreground font-medium italic line-clamp-2">
                        {sug.situation_summary || sug.pattern || "—"}
                      </p>
                    </div>

                    <div className="space-y-0.5 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Estratégia Proposta:</span>
                      <p className="text-xs text-foreground font-semibold line-clamp-3">
                        {sug.proposed_strategy || sug.suggested_strategy || sug.golden_response || "—"}
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
                        className="h-7 text-xs text-muted-foreground hover:text-rose-400 px-2"
                      >
                        <X className="h-3 w-3 mr-1" /> Ignorar
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isProcessing || sug.status === "testing"}
                          onClick={() => handleTestCandidate(sug)}
                          className={cn(
                            "h-7 text-xs px-2.5",
                            isSandboxRecommended
                              ? "border-amber-500/50 text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 font-bold shadow-xs"
                              : "border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20"
                          )}
                        >
                          <Zap className="h-3 w-3 mr-1 text-purple-400" />
                          <span>Testar Sandbox 10%</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleApproveCandidate(sug.id)}
                          className={cn(
                            "h-7 text-xs px-3 font-semibold shadow-xs",
                            isHighRelevance
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white font-bold ring-1 ring-emerald-400"
                              : "bg-emerald-500/80 hover:bg-emerald-600 text-white"
                          )}
                        >
                          {isProcessing ? (
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Check className="h-3 w-3 mr-1" />
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
          {dateFilteredLearnedPatterns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{isLoading ? "Carregando padrões…" : loadError ? "Não foi possível carregar os padrões deste atendente." : "Nenhum padrão aprendido registrado para este atendente."}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dateFilteredLearnedPatterns.map(pattern => (
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
                isLoading || loadError
                  ? "border-border/60 text-muted-foreground bg-muted/10"
                  : dateFilteredLearningEvents.length > 0
                  ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                  : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
              )}
            >
              {isLoading ? "…" : loadError ? "—" : dateFilteredLearningEvents.length > 0 ? `${dateFilteredLearningEvents.length} pendentes` : "Sem pendências"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {dateFilteredLearningEvents.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-border/60 rounded-xl bg-muted/10">
              {!loadError && !isLoading && <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />}
              <p className="text-xs font-semibold text-foreground">{isLoading ? "Carregando lacunas…" : loadError ? "Não foi possível consultar as lacunas." : "Nenhuma lacuna pendente registrada."}</p>
              <p className="text-[11px] text-muted-foreground">
                {loadError ? "Tente novamente para consultar os dados mais recentes." : "As lacunas registradas aparecerão aqui para validação."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {dateFilteredLearningEvents.map((evt) => (
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
          {dateFilteredHistoryLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {isLoading ? "Carregando histórico…" : loadError ? "Não foi possível carregar o histórico deste atendente." : "Nenhuma atualização de evolução registrada para este atendente."}
            </div>
          ) : (
            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-border/60">
              {dateFilteredHistoryLogs.slice(0, 8).map((log, idx) => (
                <div key={log.id || idx} className="flex items-start gap-3 relative pl-6">
                  <span className="absolute left-2.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-background" />
                  <div className="flex-1 text-xs space-y-0.5">
                    <p className="font-semibold text-foreground">{log.description}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{log.createdAt || "—"}</span>
                      {log.scoreChange != null && (
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

      {/* MODE 5: CONVERSAS & PONTUAÇÃO REAL (XP TRANSPARENTE) */}
      {evolutionSubTab === "conversations" && (
        <ConversationScoresSection
          agentKey={selectedAgentKey}
          onJumpToInbox={(convId) => {
            navigate(`/inbox?conversationId=${convId}`);
          }}
        />
      )}
      </>}
    </div>
  );
}
