import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  Layers,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { cn } from "@/core/lib/utils";
import {
  type EvolutionMainTab,
  type MemoryOverviewResponse,
  formatNumber,
  formatPercent,
} from "./types";

interface OverviewTabPanelProps {
  data: MemoryOverviewResponse | null;
  isLoading: boolean;
  error: string | null;
  periodLabel: string;
  onRetry: () => void;
  onNavigateTab: (tab: EvolutionMainTab) => void;
}

interface MetricTileProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accentClass?: string;
}

function MetricTile({ label, value, hint, icon, accentClass }: MetricTileProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-3.5 flex items-start justify-between gap-3">
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</p>
        <p className="text-xl font-bold font-mono tracking-tight text-foreground">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground/90 leading-snug">{hint}</p>}
      </div>
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border",
          accentClass || "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        )}
      >
        {icon}
      </div>
    </div>
  );
}

export function OverviewTabPanel({
  data,
  isLoading,
  error,
  periodLabel,
  onRetry,
  onNavigateTab,
}: OverviewTabPanelProps) {
  if (error) {
    return (
      <Card role="alert" className="border-destructive/40 bg-destructive/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-destructive">
            Não foi possível carregar a visão geral de Memória & Evolução
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
        </Button>
      </Card>
    );
  }

  if (isLoading && !data) {
    return (
      <div role="status" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <Card key={idx} className="border-border/70 bg-card/70 p-5 space-y-3 animate-pulse">
            <div className="h-4 w-40 bg-muted/50 rounded" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 bg-muted/30 rounded-xl" />
              <div className="h-20 bg-muted/30 rounded-xl" />
              <div className="h-20 bg-muted/30 rounded-xl" />
              <div className="h-20 bg-muted/30 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <Card role="status" className="border-border/70 bg-card/60 p-8 text-center space-y-2">
        <p className="text-sm font-semibold text-foreground">Sem dados de evolução disponíveis</p>
        <p className="text-xs text-muted-foreground">
          O backend não retornou métricas para o filtro selecionado.
        </p>
      </Card>
    );
  }

  const accumulated = data.accumulated;
  const periodMetrics = data.periodMetrics;
  const pending = data.pending;
  const applied = data.applied;

  const aiTurns = periodMetrics?.aiTurnsExecuted;
  const continuedTurns = periodMetrics?.customerContinuedTurns;
  const computedContinuityRate =
    typeof aiTurns === "number" && Number.isFinite(aiTurns) && aiTurns > 0 && typeof continuedTurns === "number" && Number.isFinite(continuedTurns)
      ? Number(((continuedTurns / aiTurns) * 100).toFixed(1))
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 1. DADOS ACUMULADOS */}
        <Card className="border-border/80 bg-card/85 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Database className="h-4 w-4 text-emerald-400" />
                  Dados Acumulados
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Base histórica consolidada no PostgreSQL (independente do filtro de período).
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                Histórico Total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricTile
              label="Conversas Totais"
              value={formatNumber(accumulated?.conversationsTotal)}
              hint="Conversas registradas para a empresa/canal"
              icon={<MessageSquare className="h-4 w-4" />}
              accentClass="border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
            />
            <MetricTile
              label="Memórias Ativas"
              value={formatNumber(accumulated?.activeMemories)}
              hint="Conhecimento ativo no cérebro da IA"
              icon={<Brain className="h-4 w-4" />}
              accentClass="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            />
            <MetricTile
              label="Objeções Identificadas"
              value={formatNumber(accumulated?.objectionsIdentified)}
              hint="Objeções catalogadas para contorno"
              icon={<ShieldAlert className="h-4 w-4" />}
              accentClass="border-violet-500/30 bg-violet-500/10 text-violet-400"
            />
            <MetricTile
              label="Estratégias Ativas"
              value={formatNumber(accumulated?.strategiesActive)}
              hint="Playbooks comerciais aprovados em vigor"
              icon={<Layers className="h-4 w-4" />}
              accentClass="border-teal-500/30 bg-teal-500/10 text-teal-400"
            />
          </CardContent>
        </Card>

        {/* 2. DADOS DO PERÍODO */}
        <Card className="border-border/80 bg-card/85 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Activity className="h-4 w-4 text-sky-400" />
                  Dados do Período
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Atividade filtrada pelo recorte temporal selecionado ({periodLabel}).
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] border-sky-500/40 bg-sky-500/10 text-sky-300">
                {periodLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricTile
              label="Conversas Analisadas"
              value={formatNumber(periodMetrics?.conversationsAnalyzed)}
              hint="Conversas com atividade no período"
              icon={<MessageSquare className="h-4 w-4" />}
              accentClass="border-sky-500/30 bg-sky-500/10 text-sky-400"
            />
            <MetricTile
              label="Aprendizados Recentes"
              value={formatNumber(periodMetrics?.recentLearnings)}
              hint="Memórias recentes + novos candidatos"
              icon={<Sparkles className="h-4 w-4" />}
              accentClass="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            />
            <MetricTile
              label="Turnos Executados pela IA"
              value={formatNumber(periodMetrics?.aiTurnsExecuted)}
              hint="Respostas registradas em eventos de experiência"
              icon={<Activity className="h-4 w-4" />}
              accentClass="border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
            />
            <MetricTile
              label="Turnos com Continuidade"
              value={formatNumber(periodMetrics?.customerContinuedTurns)}
              hint={
                computedContinuityRate != null
                  ? `Taxa no período: ${formatPercent(computedContinuityRate)}`
                  : "Clientes que responderam após a IA"
              }
              icon={<CheckCircle2 className="h-4 w-4" />}
              accentClass="border-teal-500/30 bg-teal-500/10 text-teal-400"
            />
          </CardContent>
        </Card>

        {/* 3. PENDENTES DE ANÁLISE */}
        <Card className="border-border/80 bg-card/85 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Pendentes de Análise
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Candidatos em observação ou aguardando aprovação humana antes de afetar prompts.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab("cognitive")}
                className="h-7 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 px-2"
              >
                Revisar fila <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricTile
              label="Aprendizados Identificados"
              value={formatNumber(pending?.identifiedLearnings)}
              hint="Coletando evidências multi-conversa"
              icon={<Sparkles className="h-4 w-4" />}
              accentClass="border-amber-500/30 bg-amber-500/10 text-amber-400"
            />
            <MetricTile
              label="Aguardando Aprovação"
              value={formatNumber(pending?.awaitingApproval)}
              hint="Prontos para revisão Antes/Depois"
              icon={<Clock className="h-4 w-4" />}
              accentClass="border-orange-500/30 bg-orange-500/10 text-orange-400"
            />
            <MetricTile
              label="Total em Análise"
              value={formatNumber(pending?.totalPendingAnalysis)}
              hint="Soma de itens ainda não aplicados"
              icon={<GitBranch className="h-4 w-4" />}
              accentClass="border-zinc-500/30 bg-zinc-500/10 text-zinc-300"
            />
          </CardContent>
        </Card>

        {/* 4. EFETIVAMENTE APLICADOS */}
        <Card className="border-border/80 bg-card/85 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Efetivamente Aplicados
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Evoluções promovidas por aprovação humana e playbooks ativos com histórico de rollback.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab("memory")}
                  className="h-7 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 px-2"
                >
                  Memórias <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigateTab("results")}
                  className="h-7 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 px-2"
                >
                  Resultados <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricTile
              label="Melhorias Comprovadas"
              value={formatNumber(applied?.provenImprovements)}
              hint="Propostas aprovadas e aplicadas em produção"
              icon={<CheckCircle2 className="h-4 w-4" />}
              accentClass="border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            />
            <MetricTile
              label="Playbooks Ativos"
              value={formatNumber(applied?.activePlaybooks)}
              hint="Estratégias oficiais usadas pelo atendente"
              icon={<Layers className="h-4 w-4" />}
              accentClass="border-teal-500/30 bg-teal-500/10 text-teal-400"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
