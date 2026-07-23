import React, { useEffect, useState } from "react";
import { Brain, Sparkles, TrendingUp, RefreshCw, Clock, ArrowRight, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/apiService";

export interface AIExecutiveInsightData {
  companyId: string;
  generatedAt: string;
  nextUpdateAt: string;
  intervalHours: number;
  flowStatus: string;
  sentiment: string;
  recommendation: string;
  metricsSummary: {
    conversasAtivasHoje: number;
    mensagensHoje: number;
    mensagensRecebidas: number;
    mensagensEnviadas: number;
    taxaDeRetornoPercent: number;
  };
  summaryText: string;
}

interface AIExecutiveInsightsCardProps {
  className?: string;
}

export function AIExecutiveInsightsCard({ className = "" }: AIExecutiveInsightsCardProps) {
  const [insight, setInsight] = useState<AIExecutiveInsightData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await apiService.getExecutiveAIInsights();
      if (res.success && res.data) {
        setInsight(res.data);
      }
    } catch (err) {
      console.error("[AI_INSIGHTS_CARD] Error fetching insights:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  if (loading && !insight) {
    return (
      <Card className={`bg-card/80 border-border/80 p-6 text-center ${className}`}>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Analisando fluxo e métricas do dia com Inteligência Artificial...</span>
        </div>
      </Card>
    );
  }

  if (!insight) return null;

  const generatedTime = new Date(insight.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const nextTime = new Date(insight.nextUpdateAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/80 border border-emerald-500/30 shadow-2xl backdrop-blur-xl ${className}`}>
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
        <Brain className="h-32 w-32 text-emerald-400" />
      </div>

      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Diagnóstico de IA do Dia (Análise de 3 em 3h)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span>Atualizado às {generatedTime} (Próximo ciclo: {nextTime})</span>
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Dados Reais PostgreSQL
            </Badge>
            <Button onClick={fetchInsights} variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-background/60 p-3 rounded-xl border border-border/50">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Conversas Ativas</span>
            <span className="text-lg font-black text-foreground">{insight.metricsSummary.conversasAtivasHoje}</span>
          </div>

          <div className="bg-background/60 p-3 rounded-xl border border-border/50">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Mensagens Hoje</span>
            <span className="text-lg font-black text-foreground">{insight.metricsSummary.mensagensHoje}</span>
          </div>

          <div className="bg-background/60 p-3 rounded-xl border border-border/50">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Retorno de Clientes</span>
            <span className="text-lg font-black text-emerald-400">{insight.metricsSummary.taxaDeRetornoPercent}%</span>
          </div>

          <div className="bg-background/60 p-3 rounded-xl border border-border/50">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Status do Fluxo</span>
            <span className="text-xs font-bold text-amber-300 truncate block mt-1">{insight.flowStatus}</span>
          </div>
        </div>

        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-300 font-bold">
            <TrendingUp className="h-4 w-4" />
            <span>Insight Estratégico da IA:</span>
          </div>
          <p className="text-foreground/90 font-medium leading-relaxed text-xs">
            {insight.summaryText}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
