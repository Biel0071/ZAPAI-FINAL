import React, { useState } from "react";
import { cn } from "@/core/lib/utils";
import {
  ShieldCheck,
  TrendUp,
  Target,
  Gauge,
  Lightning,
  Sparkle,
  CheckCircle,
  Warning,
  Info,
  Clock,
  ArrowRight,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface MaturationProgressionStep {
  stage: number;
  phase: string;
  limit: number;
  speed: string;
  status: "atual" | "concluido" | "proximo";
}

export interface CampaignMaturationData {
  sessionId: string;
  daysActive: number;
  totalLifetimeMessages: number;
  firstMessageAt: string;
  stage: number;
  stageName: string;
  recommendedDailyLimit: number;
  sentToday: number;
  campaignSentToday: number;
  remainingQuota: number;
  progressPercent: number;
  safeSpeedRecommendation: "safe" | "balanced" | "fast";
  riskLevel: string;
  progressionTable: MaturationProgressionStep[];
}

interface ChipMaturationCardProps {
  data: CampaignMaturationData | null;
  loading?: boolean;
  onSelectRecommendedSpeed?: (speed: "safe" | "balanced" | "fast") => void;
}

export function ChipMaturationCard({
  data,
  loading = false,
  onSelectRecommendedSpeed,
}: ChipMaturationCardProps) {
  const [showRampTable, setShowRampTable] = useState(false);

  if (loading || !data) {
    return (
      <Card className="rounded-2xl border-border/70 bg-card/60 animate-pulse">
        <CardContent className="p-4 h-24 flex items-center justify-center text-xs text-muted-foreground">
          Carregando indicadores de maturação do chip e meta diária...
        </CardContent>
      </Card>
    );
  }

  const isNearLimit = data.progressPercent >= 80 && data.progressPercent < 100;
  const isOverLimit = data.progressPercent >= 100;

  return (
    <Card className="rounded-2xl border-border/70 bg-gradient-to-r from-card/90 via-card/60 to-background/50 shadow-sm overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Lado Esquerdo: Identificação do Chip e Estágio */}
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Target className="h-6 w-6" weight="fill" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-foreground">
                  Maturação do Chip & Meta Diária Anti-Ban
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium py-0 px-2 rounded-full",
                    data.stage >= 4
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                      : data.stage >= 3
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                      : "border-blue-500/40 bg-blue-500/15 text-blue-400"
                  )}
                >
                  {data.stageName}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                <span>Conexão ativa: <strong className="text-foreground">{data.sessionId}</strong></span>
                <span>•</span>
                <span>Idade operacional: <strong className="text-foreground">{data.daysActive} dias</strong></span>
                <span>•</span>
                <span>Histórico: <strong className="text-foreground">{data.totalLifetimeMessages.toLocaleString("pt-BR")} msgs</strong></span>
              </p>
            </div>
          </div>

          {/* Lado Direito: Barra de Progresso da Meta Diária */}
          <div className="flex flex-col gap-2 min-w-[280px] lg:w-80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <TrendUp className="h-3.5 w-3.5 text-primary" />
                Meta Diária Recomendada:
              </span>
              <span className="font-bold text-foreground">
                {data.sentToday} / {data.recommendedDailyLimit} <span className="font-normal text-muted-foreground">({data.progressPercent}%)</span>
              </span>
            </div>

            {/* Barra de Progresso com Cores Inteligentes */}
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary/80">
              <div
                className={cn(
                  "h-full transition-all duration-500 rounded-full",
                  isOverLimit
                    ? "bg-rose-500"
                    : isNearLimit
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, data.progressPercent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{data.remainingQuota > 0 ? `${data.remainingQuota} disparos restantes hoje` : "Meta diária atingida"}</span>
              <button
                type="button"
                onClick={() => setShowRampTable(!showRampTable)}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                {showRampTable ? "Ocultar Rampa" : "Ver Rampa de Metas"}
                {showRampTable ? <CaretUp className="h-3 w-3" /> : <CaretDown className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Tabela Retrátil de Rampa de Maturação */}
        {showRampTable && (
          <div className="mt-4 pt-4 border-t border-border/60 space-y-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" weight="fill" />
                Rampa Progressiva de Aquecimento (Meta Anti-Ban)
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Recomendação da Meta e diretrizes do WhatsApp Business
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-xs">
              {data.progressionTable.map((step) => {
                const isCurrent = step.status === "atual";
                const isDone = step.status === "concluido";

                return (
                  <div
                    key={step.stage}
                    className={cn(
                      "rounded-xl border p-2.5 flex flex-col justify-between h-full transition-all",
                      isCurrent
                        ? "border-primary/80 bg-primary/10 shadow-sm ring-1 ring-primary/40"
                        : isDone
                        ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground"
                        : "border-border/50 bg-background/30 text-muted-foreground/80"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-foreground">{step.phase}</span>
                        {isCurrent ? (
                          <Badge className="text-[9px] py-0 px-1 bg-primary text-primary-foreground">Atual</Badge>
                        ) : isDone ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" weight="fill" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-base font-bold text-foreground">
                        {step.limit} <span className="text-[10px] font-normal text-muted-foreground">msgs/dia</span>
                      </p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px]">
                      <span className="font-medium text-foreground/90">{step.speed}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-background/50 border border-border/50 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-info shrink-0" />
                Dica: Respeitar o limite diário da rampa garante que o chip alcance alta reputação sem risco de bloqueio.
              </span>
              {onSelectRecommendedSpeed && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] shrink-0 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => onSelectRecommendedSpeed("safe")}
                >
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" weight="fill" />
                  Aplicar Modo Seguro
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
