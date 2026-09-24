import React, { useState, useEffect } from "react";
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
  ArrowRight,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { API_ORIGIN } from "@/services/apiService";
import { HistoryBootstrapPanel } from './HistoryBootstrapPanel';

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

export function EvolutionCenter() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<EvolutionMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchMetricsAndSuggestions = async () => {
    try {
      setLoading(true);
      const [metRes, sugRes] = await Promise.all([
        fetch(`${API_ORIGIN}/api/ai/evolution/metrics`, { credentials: "omit" }),
        fetch(`${API_ORIGIN}/api/ai/evolution/suggestions`, { credentials: "omit" })
      ]);

      if (metRes.ok) {
        const mJson = await metRes.json();
        if (mJson.success) setMetrics(mJson.data);
      }

      if (sugRes.ok) {
        const sJson = await sugRes.json();
        if (sJson.success) setSuggestions(sJson.data);
      }
    } catch (err: any) {
      console.error("[EvolutionCenter] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricsAndSuggestions();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(id);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/suggestions/${id}/approve`, {
        method: "POST",
        credentials: "omit"
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Playbook Aprovado!",
          description: "A estratégia foi promovida a playbook ativo oficial da IA.",
        });
        fetchMetricsAndSuggestions();
      } else {
        toast({ title: "Erro ao aprovar", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestSandbox = async (id: number) => {
    try {
      setActionLoading(id);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/suggestions/${id}/test`, {
        method: "POST",
        credentials: "omit"
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Iniciado Teste Sandbox (10%)",
          description: "O playbook será testado em 10% dos atendimentos sem alterar preços oficiais.",
        });
        fetchMetricsAndSuggestions();
      } else {
        toast({ title: "Erro ao iniciar teste", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setActionLoading(id);
      const res = await fetch(`${API_ORIGIN}/api/ai/evolution/suggestions/${id}/reject`, {
        method: "POST",
        credentials: "omit"
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Sugestão rejeitada", description: "O padrão foi descartado." });
        fetchMetricsAndSuggestions();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <HistoryBootstrapPanel />
      {/* Top Banner: Architecture & Continuous Learning status */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-background to-teal-500/10 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white font-semibold flex items-center gap-1.5 px-3 py-1">
                <Brain className="w-3.5 h-3.5" />
                Agente Evolutivo 5 Camadas
              </Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                Aprendizado supervisionado
              </Badge>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Evolution Center — Aprendizado Contínuo Supervisionado
            </h2>
            <p className="text-sm text-muted-foreground max-w-3xl">
              A IA não aprende sozinha de forma caótica: ela segue uma <strong>hierarquia estrita</strong> onde a
              verdade oficial da loja (preços e regras) prevalece sempre, enquanto estratégias comerciais evoluem
              a partir das melhores práticas dos atendentes humanos.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetricsAndSuggestions}
            disabled={loading}
            className="flex items-center gap-2 self-start md:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar Métricas
          </Button>
        </div>

        {/* 5-Layer Authority Flow Diagram */}
        <div className="mt-6 pt-4 border-t border-border/40 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="font-semibold text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 1. Verdade Oficial
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Preços, Fretes e Políticas (Imutável)</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="font-semibold text-blue-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> 2. Memória Clientes
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Bairro, Itens Cotados, Preferências</p>
          </div>
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="font-semibold text-purple-400 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" /> 3. Playbooks
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Roteiros e CTAs Comerciais Validados</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="font-semibold text-amber-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 4. Experiência
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Ação x Reação x Intervenções</p>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 col-span-2 sm:col-span-1">
            <div className="font-semibold text-teal-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 5. Evolução
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Mineração de Padrões & Sandbox</p>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/50 bg-card/60 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Verdade Oficial</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">
                {metrics?.officialKnowledgeCount ?? 6} itens
              </h3>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Preços & Fretes Protegidos
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/60 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Playbooks Ativos</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">
                {metrics?.activePlaybooks ?? 3}
                {(metrics?.testingPlaybooks ?? 0) > 0 && (
                  <span className="text-xs font-normal text-amber-400 ml-1.5">
                    (+{metrics?.testingPlaybooks} sandbox)
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Estratégias Comerciais
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
              <BookOpen className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/60 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Continuidade de Resposta</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">
                {metrics?.responseContinuityRate ?? 74}%
              </h3>
              <p className="text-[11px] text-blue-400 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Clientes que mantêm o chat
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/60 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sugestões Evolutivas</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">
                {suggestions.filter(s => s.status === "pending").length} pendentes
              </h3>
              <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Padrões minerados da loja
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section: Pending Evolutionary Suggestions & Approval Workflow */}
      <Card className="border border-border/60 bg-card/40 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Sugestões de Evolução Comportamental Mineradas
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Padrões detectados nas conversas reais onde intervenções humanas geraram melhores resultados.
                Aprove para aplicar a 100% da IA ou teste em 10% dos atendimentos (Sandbox A/B).
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {suggestions.length} identificadas
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {suggestions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
              Nenhum padrão novo aguardando aprovação no momento. A IA está operando com os playbooks oficiais.
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="p-4 rounded-xl border border-border/50 bg-background/50 hover:border-primary/30 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={sug.status === "approved" ? "default" : sug.status === "testing" ? "secondary" : "outline"}
                        className={
                          sug.status === "approved"
                            ? "bg-emerald-600 text-white"
                            : sug.status === "testing"
                            ? "bg-amber-600 text-white"
                            : "border-amber-500/30 text-amber-400"
                        }
                      >
                        {sug.status === "approved"
                          ? "Playbook Aprovado"
                          : sug.status === "testing"
                          ? "Em Teste Sandbox (10%)"
                          : "Aguardando Aprovação"}
                      </Badge>
                      <span className="text-xs font-semibold text-foreground">
                        {sug.situation_summary}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Frequência: <strong>{sug.observed_frequency}x</strong></span>
                      <span className="text-emerald-400 font-medium">
                        +{sug.continuity_impact_pct}% continuidade prevista
                      </span>
                    </div>
                  </div>

                  <div className="bg-muted/20 rounded-lg p-3 text-xs space-y-1.5 border border-border/30">
                    <p className="text-foreground">
                      <strong className="text-muted-foreground">Estratégia Recomendada:</strong> {sug.suggested_strategy}
                    </p>
                    {sug.suggested_cta && (
                      <p className="text-foreground">
                        <strong className="text-muted-foreground">CTA Sugerido:</strong> "{sug.suggested_cta}"
                      </p>
                    )}
                  </div>

                  {sug.status === "pending" && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground hover:text-destructive h-8"
                        disabled={actionLoading === sug.id}
                        onClick={() => handleReject(sug.id)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8"
                        disabled={actionLoading === sug.id}
                        onClick={() => handleTestSandbox(sug.id)}
                      >
                        <FlaskConical className="w-3.5 h-3.5 mr-1" /> Testar Sandbox (10%)
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                        disabled={actionLoading === sug.id}
                        onClick={() => handleApprove(sug.id)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar Playbook Oficial
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export default EvolutionCenter;
