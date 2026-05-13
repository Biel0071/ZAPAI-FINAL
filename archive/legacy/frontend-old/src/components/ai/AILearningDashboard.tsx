import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightbulb, Info, PencilSimple, Check, X } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { aiLearningService, type LearningDashboardData, type LearningSuggestion } from "@/services/aiLearningService";
import { apiService } from "@/services/apiService";

function InfoTitle({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Informação"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{hint}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

const issueLabel: Record<string, string> = {
  unanswered_question: "Pergunta sem resposta",
  lost_lead: "Lead perdido",
  frequent_question: "Pergunta frequente",
  failed_conversation: "Conversa com falha",
  drop_off: "Ponto de abandono",
};

export function AILearningDashboard({
  onPromptApplied,
}: {
  onPromptApplied?: (payload: { newPrompt: string; promptVersionId: string }) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LearningSuggestion | null>(null);
  const [editResponse, setEditResponse] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editFlow, setEditFlow] = useState("");
  const [dashboard, setDashboard] = useState<LearningDashboardData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aiLearningService.getDashboard();
      setDashboard(data);
    } catch {
      toast({ title: "Não foi possível carregar o AI Learning.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      await aiLearningService.runAnalysisNow();
      toast({ title: "Análise diária executada com sucesso." });
      await load();
    } catch {
      toast({ title: "Erro ao executar análise.", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const apply = async (item: LearningSuggestion) => {
    setApplyingId(item.id);
    try {
      const currentPromptResponse = await apiService.getAIPrompt();
      const currentPrompt = currentPromptResponse?.prompt ?? "";
      const improvement = item.suggestedPromptImprovement || "Melhoria aplicada automaticamente pelo AI Learning.";
      const newPrompt = `${currentPrompt}\n\n[AI Learning ${new Date().toLocaleDateString("pt-BR")}] ${improvement}`.trim();

      await apiService.saveAIPrompt(newPrompt);
      const result = await aiLearningService.applyImprovement(item.id, newPrompt);
      onPromptApplied?.({ newPrompt, promptVersionId: result.promptVersionId });
      toast({ title: "Melhoria aplicada com sucesso." });
      await load();
    } catch {
      toast({ title: "Erro ao aplicar melhoria.", variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  };

  const openEdit = (item: LearningSuggestion) => {
    setEditing(item);
    setEditResponse(item.suggestedResponse ?? "");
    setEditPrompt(item.suggestedPromptImprovement ?? "");
    setEditFlow(item.suggestedNewFlow ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await aiLearningService.editSuggestion(editing.id, {
        suggestedResponse: editResponse,
        suggestedPromptImprovement: editPrompt,
        suggestedNewFlow: editFlow,
      });
      toast({ title: "Sugestão atualizada." });
      setEditing(null);
      await load();
    } catch {
      toast({ title: "Erro ao editar sugestão.", variant: "destructive" });
    }
  };

  const ignore = async (id: string) => {
    try {
      await aiLearningService.ignoreSuggestion(id);
      toast({ title: "Sugestão ignorada." });
      await load();
    } catch {
      toast({ title: "Erro ao ignorar sugestão.", variant: "destructive" });
    }
  };

  const metrics = useMemo(() => {
    if (!dashboard) {
      return {
        totalConversationsAnalyzed: 0,
        missingResponses: 0,
        lostLeads: 0,
        conversionRate: 0,
        promptImprovementsApplied: 0,
      };
    }
    return dashboard.metrics;
  }, [dashboard]);

  return (
    <Card className="glass-card">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <InfoTitle label="AI Learning" hint="Analisa conversas diariamente e sugere melhorias para o atendimento." />
          </CardTitle>
          <Button onClick={() => void runNow()} disabled={running || loading}>Executar análise agora</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-muted/40">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Conversas analisadas</p>
              <p className="text-xl font-semibold">{metrics.totalConversationsAnalyzed}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Sem resposta</p>
              <p className="text-xl font-semibold">{metrics.missingResponses}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Leads perdidos</p>
              <p className="text-xl font-semibold">{metrics.lostLeads}</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Taxa de conversão</p>
              <p className="text-xl font-semibold">{metrics.conversionRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/40">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Melhorias aplicadas</p>
              <p className="text-xl font-semibold">{metrics.promptImprovementsApplied}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <InfoTitle label="Perguntas frequentes" hint="Mostra dúvidas recorrentes dos clientes para orientar melhorias." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dashboard?.frequentQuestions?.length ? (
                dashboard.frequentQuestions.map((item) => (
                  <div key={`${item.question}-${item.count}`} className="flex items-center justify-between rounded-lg border border-border p-2">
                    <p className="text-sm truncate pr-2">{item.question}</p>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma pergunta frequente detectada hoje.</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <InfoTitle label="Pontos de abandono" hint="Identifica onde os clientes param de responder na jornada." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dashboard?.dropPoints?.length ? (
                dashboard.dropPoints.map((item) => (
                  <div key={`${item.point}-${item.count}`} className="flex items-center justify-between rounded-lg border border-border p-2">
                    <p className="text-sm truncate pr-2">{item.point}</p>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum ponto de abandono detectado hoje.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <InfoTitle label="Sugestões de melhoria detectadas hoje" hint="Lista problemas encontrados e propostas automáticas de melhoria." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando sugestões...</p>
            ) : dashboard?.issues?.length ? (
              dashboard.issues.map((item) => (
                <div key={item.id} className="rounded-xl border border-border p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={item.status === "pending" ? "secondary" : "outline"}>{issueLabel[item.issueType] ?? item.issueType}</Badge>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                  <p className="text-sm"><span className="text-muted-foreground">Problema detectado:</span> {item.problemDetected}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Resposta sugerida:</span> {item.suggestedResponse || "-"}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Melhoria de prompt:</span> {item.suggestedPromptImprovement || "-"}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Novo fluxo sugerido:</span> {item.suggestedNewFlow || "-"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void apply(item)} disabled={applyingId === item.id || item.status === "applied"} className="gap-1">
                      <Check className="h-3.5 w-3.5" /> Aplicar melhoria
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="gap-1">
                      <PencilSimple className="h-3.5 w-3.5" /> Editar sugestão
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void ignore(item.id)} className="gap-1">
                      <X className="h-3.5 w-3.5" /> Ignorar sugestão
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma sugestão registrada hoje. A análise diária roda às 02:00.</p>
            )}
          </CardContent>
        </Card>
      </CardContent>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar sugestão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea value={editResponse} onChange={(e) => setEditResponse(e.target.value)} placeholder="Resposta sugerida" />
            <Textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Melhoria de prompt" />
            <Textarea value={editFlow} onChange={(e) => setEditFlow(e.target.value)} placeholder="Novo fluxo sugerido" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => void saveEdit()}>Salvar edição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
