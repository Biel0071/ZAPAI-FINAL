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

export function EvolutionTab() {
  const { toast } = useToast();

  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("default");
  const [isLoading, setIsLoading] = useState(true);

  // Score & Overview
  const [overview, setOverview] = useState<EvolutionOverview>({
    score: 82,
    level: "Avançado",
    goal: { current: 16, target: 20, percentage: 80 },
    components: { answers: 35, refinements: 25, coverage: 16, queue: 6 },
  });

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
      const [evoRes, learnRes] = await Promise.all([
        apiService.getAgentEvolution(agentKey).catch(() => null),
        apiService.getAgentLearning(agentKey).catch(() => null),
      ]);

      if (evoRes?.evolution) {
        setOverview({
          score: Number(evoRes.evolution.score) || 0,
          level: evoRes.evolution.level || "Iniciante",
          goal: {
            current: Number(evoRes.evolution.goal?.current) || 0,
            target: Number(evoRes.evolution.goal?.target) || 20,
            percentage: Number(evoRes.evolution.goal?.percentage) || 0,
          },
          components: {
            answers: Number(evoRes.evolution.components?.answers) || 0,
            refinements: Number(evoRes.evolution.components?.refinements) || 0,
            coverage: Number(evoRes.evolution.components?.coverage) || 0,
            queue: Number(evoRes.evolution.components?.queue) || 0,
          },
        });
      }

      if (evoRes?.history && Array.isArray(evoRes.history)) {
        setHistoryLogs(evoRes.history);
      }

      if (learnRes?.pending && Array.isArray(learnRes.pending)) {
        setLearningEvents(learnRes.pending);
      } else {
        setLearningEvents([]);
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
        description: "Digite como o robô deve responder a essa dúvida antes de ensinar.",
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

      // Reload data to reflect score increase
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
              Acompanhe o aprendizado autônomo, resolva lacunas e turbine o score do agente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {agents.length > 1 && (
            <Select value={selectedAgentKey} onValueChange={setSelectedAgentKey}>
              <SelectTrigger className="h-9 text-xs w-[180px]">
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
            variant="outline"
            size="sm"
            onClick={handleDetectGaps}
            disabled={isDetectingGaps}
            className="h-9 text-xs gap-1.5 border-border/70 hover:border-purple-500/50"
          >
            <Search className={cn("h-3.5 w-3.5", isDetectingGaps && "animate-spin")} />
            {isDetectingGaps ? "Analisando Conversas..." : "Escanear Lacunas"}
          </Button>
        </div>
      </div>

      {/* SECTION 1: SCORE OVERVIEW & 4 PILLARS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Score Card (5 cols on lg) */}
        <Card className="lg:col-span-5 bg-card border-border/80 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Brain className="h-4 w-4 text-purple-400" /> Score de Inteligência do Agente
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Nível de maturidade baseado na assertividade e conhecimento absorvido.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="relative flex items-center justify-center">
              <div className="h-32 w-32 rounded-full border-4 border-purple-500/20 flex flex-col items-center justify-center bg-purple-500/5 shadow-inner">
                <span className="text-4xl font-black text-purple-400 font-display">
                  {overview.score}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Pontos
                </span>
              </div>
            </div>

            <div className="text-center space-y-1">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-3 py-0.5 uppercase font-bold tracking-wider">
                Nível: {overview.level}
              </Badge>
              <p className="text-[11px] text-muted-foreground pt-1">
                Meta atual: {overview.goal.current} / {overview.goal.target} aprendizados ({overview.goal.percentage}%)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4 Pillars Card (7 cols on lg) */}
        <Card className="lg:col-span-7 bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> Composição dos Pilares de Inteligência
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Distribuição dos pontos que definem a assertividade e autonomia do agente.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Pilar 1: Respostas Assertivas */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Respostas Assertivas & Precisão</span>
                <span className="text-muted-foreground font-mono font-bold">{overview.components.answers} / 40 pts</span>
              </div>
              <Progress value={(overview.components.answers / 40) * 100} className="h-2 bg-muted/40" />
            </div>

            {/* Pilar 2: Refinamentos Aplicados */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Refinamentos & Instruções Próprias</span>
                <span className="text-muted-foreground font-mono font-bold">{overview.components.refinements} / 30 pts</span>
              </div>
              <Progress value={(overview.components.refinements / 30) * 100} className="h-2 bg-muted/40" />
            </div>

            {/* Pilar 3: Cobertura de Dúvidas */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Cobertura da Base de Conhecimento</span>
                <span className="text-muted-foreground font-mono font-bold">{overview.components.coverage} / 20 pts</span>
              </div>
              <Progress value={(overview.components.coverage / 20) * 100} className="h-2 bg-muted/40" />
            </div>

            {/* Pilar 4: Otimização de Fila */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-foreground">Retenção de Fila & Triagem Rápida</span>
                <span className="text-muted-foreground font-mono font-bold">{overview.components.queue} / 10 pts</span>
              </div>
              <Progress value={(overview.components.queue / 10) * 100} className="h-2 bg-muted/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 2: LEARNING GAPS (DÚVIDAS NÃO RESPONDIDAS) */}
      <Card className="bg-card border-border/80 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <HelpCircle className="h-5 w-5 text-amber-400" /> Central de Aprendizado (Lacunas Detectadas)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Perguntas reais de clientes que o robô não soube responder com 100% de segurança.
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
                Seu atendente está respondendo todas as dúvidas dos clientes com confiança.
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
                      placeholder="Como o agente deve responder a isso no futuro? Digite a resposta oficial..."
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

      {/* SECTION 3: EVOLUTION TIMELINE & HISTORY */}
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
