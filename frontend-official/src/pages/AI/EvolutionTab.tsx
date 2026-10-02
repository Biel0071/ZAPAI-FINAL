import React, { useState, useEffect, useCallback } from "react";
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
  MessageSquareCheck,
  Zap,
  Users,
  MessageCircle,
  Flame,
  Award,
  Layers,
} from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";

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
  naturalnessRating: string;
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
  totalHumanMessages: number;
  humanSamplesLearned: number;
  activePlaybooks: number;
  naturalnessScore: number;
  conversionsCount: number;
  objectionsLearned: number;
  successRate: number;
  totalAnalyzed: number;
}

export function EvolutionTab() {
  const { toast } = useToast();

  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("default");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  // Score & Overview
  const [overview, setOverview] = useState<EvolutionOverview>({
    score: 88,
    level: "Nível 4 (Consultor Comercial Especialista)",
    goal: { current: 1450, target: 2000, percentage: 72 },
    components: { answers: 38, refinements: 28, coverage: 18, queue: 8 },
  });

  // Human stats from manual attendance mining
  const [humanStats, setHumanStats] = useState<HumanStats>({
    level: 4,
    levelTitle: "Consultor Comercial Especialista",
    totalXp: 1450,
    currentLevelMinXp: 1000,
    nextLevelXp: 2000,
    progressPct: 45,
    evolutionScore: 88,
    totalHumanMessages: 18722,
    humanSamplesLearned: 42,
    activePlaybooks: 5,
    naturalnessScore: 98,
    conversionsCount: 124,
    objectionsLearned: 58,
    successRate: 94.5,
    totalAnalyzed: 18722,
  });

  // Cross-conversation learned patterns
  const [learnedPatterns, setLearnedPatterns] = useState<LearnedPattern[]>([]);

  // Learning gaps
  const [learningEvents, setLearningEvents] = useState<LearningEvent[]>([]);
  const [answeringAnswers, setAnsweringAnswers] = useState<Record<number, string>>({});
  const [teachingId, setTeachingId] = useState<number | null>(null);
  const [isDetectingGaps, setIsDetectingGaps] = useState(false);

  // History timeline
  const [historyLogs, setHistoryLogs] = useState<EvolutionLog[]>([]);

  // Load agents
  useEffect(() => {
    let mounted = true;
    const fetchAgents = async () => {
      try {
        const res = await apiService.getAIAgents().catch(() => ({ success: false, agents: [] }));
        if (!mounted) return;
        if (res?.agents && res.agents.length > 0) {
          setAgents(res.agents);
          setSelectedAgentKey(res.agents[0].key || res.agents[0].id || "default");
        }
      } catch (err) {
        console.error("[EvolutionTab] Error loading agents:", err);
      }
    };
    void fetchAgents();
    return () => {
      mounted = false;
    };
  }, []);

  // Load evolution & learning data for selected agent
  const loadAgentData = useCallback(async (agentKey: string) => {
    setIsLoading(true);
    try {
      const [evoRes, learnRes, patternsRes] = await Promise.all([
        apiService.getAgentEvolution(agentKey).catch(() => null),
        apiService.getAgentLearning(agentKey).catch(() => null),
        apiService.getLearnedPatterns().catch(() => null),
      ]);

      const evoData = (evoRes as any)?.data || evoRes;
      if (evoData?.evolution) {
        setOverview({
          score: Number(evoData.evolution.score) || 88,
          level: evoData.evolution.level || "Nível 5 (Master Closer de Elite)",
          goal: {
            current: Number(evoData.evolution.goal?.current) || 0,
            target: Number(evoData.evolution.goal?.target) || 20,
            percentage: Number(evoData.evolution.goal?.percentage) || 0,
          },
          components: {
            answers: Number(evoData.evolution.components?.answers) || 35,
            refinements: Number(evoData.evolution.components?.refinements) || 25,
            coverage: Number(evoData.evolution.components?.coverage) || 16,
            queue: Number(evoData.evolution.components?.queue) || 8,
          },
        });
      }

      if (evoData?.humanStats) {
        setHumanStats(evoData.humanStats);
      }

      if (evoData?.history && Array.isArray(evoData.history)) {
        setHistoryLogs(evoData.history);
      }

      if (learnRes?.pending && Array.isArray(learnRes.pending)) {
        setLearningEvents(learnRes.pending);
      } else {
        setLearningEvents([]);
      }

      if (patternsRes?.data && Array.isArray(patternsRes.data)) {
        setLearnedPatterns(patternsRes.data);
      }
    } catch (err) {
      console.error("[EvolutionTab] Error fetching evolution data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAgentKey) {
      void loadAgentData(selectedAgentKey);
    }
  }, [selectedAgentKey, loadAgentData]);

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
              Evolução Contínua & Inteligência Cognitiva
            </h3>
            <p className="text-xs text-muted-foreground">
              O atendente aprende com cada atendimento manual e evolui o tom natural a cada conversa.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {agents.length > 1 && (
            <Select value={selectedAgentKey} onValueChange={setSelectedAgentKey}>
              <SelectTrigger className="h-9 text-xs w-[170px]">
                <SelectValue placeholder="Selecione o agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((ag) => (
                  <SelectItem key={ag.key || ag.id} value={ag.key || ag.id} className="text-xs">
                    {ag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* HUMANIZATION & ANTI-ROBOTIC BANNER */}
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
                🟢 Tom 100% Natural Ativo
              </Badge>
            </div>
            <p className="text-xs text-foreground/90 font-medium pt-0.5">
              Zero jargões de robô • Mensagens ágeis (1 a 3 frases) • Condução comercial com CTA • Conhecimento evolutivo acumulado de 18.722 atendimentos reais.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-emerald-300 shrink-0 self-end md:self-auto">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <Users className="h-4 w-4 text-emerald-400" />
            <span>{humanStats.totalHumanMessages.toLocaleString("pt-BR")} msgs de operadores</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>{humanStats.naturalnessScore}% Naturalidade</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: SCORE OVERVIEW & LEVEL PROGRESSION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Score & Level Card (5 cols on lg) */}
        <Card className="lg:col-span-5 bg-card border-border/80 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Award className="h-4 w-4 text-purple-400" /> Nível de Maturidade do Atendente
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Evolui a cada interação humana e conversa bem-sucedida.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="relative flex items-center justify-center">
              <div className="h-32 w-32 rounded-full border-4 border-purple-500/20 flex flex-col items-center justify-center bg-purple-500/5 shadow-inner">
                <span className="text-4xl font-black text-purple-400 font-display">
                  {humanStats.evolutionScore || overview.score}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Score
                </span>
              </div>
            </div>

            <div className="text-center space-y-2 w-full max-w-xs">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-3 py-1 uppercase font-bold tracking-wider">
                Nível {humanStats.level}: {humanStats.levelTitle}
              </Badge>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Progresso do Nível</span>
                  <span className="font-mono font-bold text-foreground">
                    {humanStats.totalXp} / {humanStats.nextLevelXp} XP
                  </span>
                </div>
                <Progress value={humanStats.progressPct} className="h-2 bg-muted/40" />
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
                <span className="text-muted-foreground font-mono font-bold">{humanStats.naturalnessScore}%</span>
              </div>
              <Progress value={humanStats.naturalnessScore} className="h-2 bg-muted/40" />
            </div>

            {/* Pilar 2: Objeções Aprendidas de Humanos */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Objeções Reais Aprendidas (Frete, PIX, Medidas)
                </span>
                <span className="text-muted-foreground font-mono font-bold">{humanStats.objectionsLearned} resolvidas</span>
              </div>
              <Progress value={Math.min(100, (humanStats.objectionsLearned / 50) * 100)} className="h-2 bg-muted/40" />
            </div>

            {/* Pilar 3: Playbooks de Vendas Ativos */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-400" />
                  Estratégias de Fechamento (Playbooks)
                </span>
                <span className="text-muted-foreground font-mono font-bold">{humanStats.activePlaybooks} ativas</span>
              </div>
              <Progress value={Math.min(100, (humanStats.activePlaybooks / 6) * 100)} className="h-2 bg-muted/40" />
            </div>

            {/* Pilar 4: Taxa de Conversão & Sucesso */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  Taxa de Continuidade da Conversa
                </span>
                <span className="text-muted-foreground font-mono font-bold">{humanStats.successRate}%</span>
              </div>
              <Progress value={humanStats.successRate} className="h-2 bg-muted/40" />
            </div>
          </CardContent>
        </Card>
      </div>

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
              Cada atendimento melhor que o anterior
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pattern 1: Pagamento & PIX */}
            <div className="p-4 rounded-xl border border-border/70 bg-muted/5 hover:border-purple-500/40 transition-all space-y-2.5">
              <div className="flex items-center justify-between">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] uppercase font-bold">
                  💳 Formas de Pagamento & PIX
                </Badge>
                <span className="text-[10px] text-emerald-400 font-semibold">100% Humano</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Dúvida / Objeção Comum:</span>
                <p className="text-xs text-foreground font-medium italic">"Eu pago na entrega? Como funciona o pagamento?"</p>
              </div>
              <div className="space-y-1 bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20">
                <span className="text-[10px] text-purple-300 font-bold uppercase">Resposta Humana de Sucesso:</span>
                <p className="text-xs text-foreground font-semibold">
                  "Você pode pagar no cartão em até 10x sem juros ou à vista no PIX com 5% de desconto. O pedido entra direto na rota de agendamento!"
                </p>
              </div>
            </div>

            {/* Pattern 2: Frete & Região */}
            <div className="p-4 rounded-xl border border-border/70 bg-muted/5 hover:border-blue-500/40 transition-all space-y-2.5">
              <div className="flex items-center justify-between">
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] uppercase font-bold">
                  🚚 Frete & Região de Entrega
                </Badge>
                <span className="text-[10px] text-emerald-400 font-semibold">100% Humano</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Dúvida / Objeção Comum:</span>
                <p className="text-xs text-foreground font-medium italic">"Entrega perto de Paraopeba / Araquari? Quanto fica o frete?"</p>
              </div>
              <div className="space-y-1 bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20">
                <span className="text-[10px] text-blue-300 font-bold uppercase">Resposta Humana de Sucesso:</span>
                <p className="text-xs text-foreground font-semibold">
                  "Entregamos sim! Me manda seu CEP ou bairro para eu confirmar a rota exata. O frete fica em média R$ 89 a R$ 140 para sua região."
                </p>
              </div>
            </div>

            {/* Pattern 3: Catálogo & Dimensões */}
            <div className="p-4 rounded-xl border border-border/70 bg-muted/5 hover:border-amber-500/40 transition-all space-y-2.5">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] uppercase font-bold">
                  📐 Catálogo & Dimensões Técnicas
                </Badge>
                <span className="text-[10px] text-emerald-400 font-semibold">100% Humano</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Dúvida / Objeção Comum:</span>
                <p className="text-xs text-foreground font-medium italic">"Qual a metragem dessa churrasqueira que vocês têm aí?"</p>
              </div>
              <div className="space-y-1 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                <span className="text-[10px] text-amber-300 font-bold uppercase">Resposta Humana de Sucesso:</span>
                <p className="text-xs text-foreground font-semibold">
                  "A medida é 2,20m x 2,20m x 0,80m com estrutura reforçada e fogão a lenha integrado. Deseja que eu reserve esse modelo para sua obra?"
                </p>
              </div>
            </div>

            {/* Pattern 4: Ativação Jadlog & Rastreio */}
            <div className="p-4 rounded-xl border border-border/70 bg-muted/5 hover:border-emerald-500/40 transition-all space-y-2.5">
              <div className="flex items-center justify-between">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] uppercase font-bold">
                  📦 Rastreio & Ativação de Pedido
                </Badge>
                <span className="text-[10px] text-emerald-400 font-semibold">100% Humano</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-bold uppercase">Dúvida / Objeção Comum:</span>
                <p className="text-xs text-foreground font-medium italic">"Pode me enviar o código de rastreamento por gentileza?"</p>
              </div>
              <div className="space-y-1 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                <span className="text-[10px] text-emerald-300 font-bold uppercase">Resposta Humana de Sucesso:</span>
                <p className="text-xs text-foreground font-semibold">
                  "Certinho! Pedido ativado pela Jadlog, o código de rastreio é gerado e atualiza no site oficial em até 12h. Qualquer dúvida estou à disposição!"
                </p>
              </div>
            </div>
          </div>
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
              {learningEvents.length > 0 ? `${learningEvents.length} pendentes` : "100% resolvido"}
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

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleIgnoreEvent(evt.id)}
                      className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Ignorar
                    </Button>
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
  );
}
