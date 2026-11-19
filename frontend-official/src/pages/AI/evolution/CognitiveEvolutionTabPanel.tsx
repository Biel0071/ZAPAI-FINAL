import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  GitBranch,
  History,
  Layers,
  MessageSquareQuote,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";
import {
  type AgentVersionItem,
  type CognitiveEvidenceItem,
  type CognitiveEvolutionResponse,
  type CognitiveProposal,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "./types";

interface CognitiveEvolutionTabPanelProps {
  agentKey: string;
  refreshTrigger?: number;
  onDataChanged?: () => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.error ||
    anyErr?.response?.data?.message ||
    (err instanceof Error ? err.message : null) ||
    fallback
  );
}

function renderEvidenceSamples(items?: CognitiveEvidenceItem[]) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Nenhuma amostra textual de conversa anexada a esta proposta.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((ev, idx) => {
        const convLabel = ev.conversationId ? `Conversa #${ev.conversationId}` : ev.contactName || `Amostra ${idx + 1}`;
        const customerText = ev.customerUtterance || ev.utterance || ev.excerpt || ev.snippet || ev.quote || ev.summary;
        const replyText = ev.aiReply || ev.reply;
        return (
          <div
            key={`${ev.conversationId || ev.id || idx}`}
            className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-1 text-xs"
          >
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="font-mono font-semibold text-emerald-300 flex items-center gap-1">
                <MessageSquareQuote className="h-3 w-3" /> {convLabel}
              </span>
              {ev.createdAt && <span>{formatDateTime(ev.createdAt)}</span>}
            </div>
            {customerText && (
              <p className="text-xs text-foreground leading-relaxed">
                <span className="text-muted-foreground font-semibold">Trecho: </span>
                "{customerText}"
              </p>
            )}
            {replyText && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <span className="text-emerald-400 font-semibold">Resposta observada: </span>
                {replyText}
              </p>
            )}
            {ev.outcome && (
              <p className="text-[10px] text-emerald-300/90 font-medium">Desfecho: {ev.outcome}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatImpactLabel(proposal: CognitiveProposal): string {
  const pct = proposal.continuityImpactPct;
  if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) return "—";
  const num = Number(pct);
  const prefix = num > 0 ? "+" : "";
  return `${prefix}${formatPercent(num)} continuidade`;
}

export function CognitiveEvolutionTabPanel({
  agentKey,
  refreshTrigger = 0,
  onDataChanged,
}: CognitiveEvolutionTabPanelProps) {
  const { toast } = useToast();
  const requestIdRef = useRef(0);

  const [data, setData] = useState<CognitiveEvolutionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProposalId, setBusyProposalId] = useState<string | number | null>(null);
  const [busyVersionId, setBusyVersionId] = useState<string | number | null>(null);

  const loadPipeline = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      if (typeof apiService?.getCognitiveEvolution !== "function") {
        throw new Error("Serviço de evolução cognitiva indisponível.");
      }
      const res = await apiService.getCognitiveEvolution(
        agentKey && agentKey !== "all" ? agentKey : undefined,
        60
      );
      if (reqId !== requestIdRef.current) return;
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Não foi possível carregar o pipeline evolutivo.");
      }
      setData(res);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setData(null);
      setError(extractErrorMessage(err, "Falha ao carregar evolução cognitiva do PostgreSQL."));
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, [agentKey, refreshTrigger]);

  useEffect(() => {
    void loadPipeline();
  }, [loadPipeline]);

  const handleApprove = async (proposal: CognitiveProposal) => {
    setBusyProposalId(proposal.id);
    try {
      const res = await apiService.approveEvolutionProposal(proposal.id);
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Falha ao aprovar melhoria.");
      }
      toast({
        title: "Melhoria aprovada e aplicada",
        description: `"${proposal.title}" foi promovida a playbook ativo e memória corporativa.`,
      });
      await loadPipeline();
      onDataChanged?.();
    } catch (err) {
      toast({
        title: "Erro ao aprovar melhoria",
        description: extractErrorMessage(err, "Não foi possível aprovar a proposta."),
        variant: "destructive",
      });
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleReject = async (proposal: CognitiveProposal) => {
    setBusyProposalId(proposal.id);
    try {
      const res = await apiService.rejectEvolutionProposal(proposal.id);
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Falha ao rejeitar proposta.");
      }
      toast({
        title: "Proposta rejeitada",
        description: `"${proposal.title}" foi movida para o histórico de rejeições.`,
      });
      await loadPipeline();
      onDataChanged?.();
    } catch (err) {
      toast({
        title: "Erro ao rejeitar proposta",
        description: extractErrorMessage(err, "Não foi possível rejeitar a proposta."),
        variant: "destructive",
      });
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleRollbackProposal = async (proposal: CognitiveProposal) => {
    setBusyProposalId(proposal.id);
    try {
      const res = await apiService.rollbackEvolutionProposal(proposal.id);
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Falha ao executar rollback.");
      }
      toast({
        title: "Rollback executado",
        description: `A melhoria "${proposal.title}" foi revertida e registrada no histórico.`,
      });
      await loadPipeline();
      onDataChanged?.();
    } catch (err) {
      toast({
        title: "Erro no rollback",
        description: extractErrorMessage(err, "Não foi possível reverter a melhoria."),
        variant: "destructive",
      });
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleRollbackVersion = async (version: AgentVersionItem) => {
    const targetKey = version.agent_key || (agentKey && agentKey !== "all" ? agentKey : "");
    if (!targetKey) {
      toast({
        title: "Atendente não identificado",
        description: "Selecione um atendente específico para restaurar versões.",
        variant: "destructive",
      });
      return;
    }
    setBusyVersionId(version.id);
    try {
      const res = await apiService.rollbackAgentVersion(targetKey, version.id);
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Falha ao restaurar versão.");
      }
      toast({
        title: "Versão restaurada",
        description: `Atendente "${targetKey}" restaurado para a versão #${version.version_number ?? version.id}.`,
      });
      await loadPipeline();
      onDataChanged?.();
    } catch (err) {
      toast({
        title: "Erro ao restaurar versão",
        description: extractErrorMessage(err, "Não foi possível executar o rollback da versão."),
        variant: "destructive",
      });
    } finally {
      setBusyVersionId(null);
    }
  };

  const identified = data?.identified || [];
  const pendingApproval = data?.pendingApproval || [];
  const applied = data?.applied || [];
  const history = data?.history || [];
  const versions = data?.versions || [];

  if (error) {
    return (
      <Card role="alert" className="border-destructive/40 bg-destructive/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-destructive">Não foi possível carregar a evolução cognitiva</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadPipeline()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
        </Button>
      </Card>
    );
  }

  if (isLoading && !data) {
    return (
      <div role="status" className="space-y-4">
        {[0, 1, 2].map((idx) => (
          <Card key={idx} className="border-border/70 bg-card/70 p-5 space-y-3 animate-pulse">
            <div className="h-4 w-56 bg-muted/50 rounded" />
            <div className="h-24 w-full bg-muted/30 rounded-xl" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* PIPELINE SUMMARY HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono">
            1. Identificados: {formatNumber(identified.length)}
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
          <Badge variant="outline" className="border-orange-500/40 bg-orange-500/10 text-orange-300 font-mono">
            2. Aguardando Aprovação: {formatNumber(pendingApproval.length)}
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-mono">
            3. Aplicados: {formatNumber(applied.length)}
          </Badge>
          <Badge variant="outline" className="border-border/70 text-muted-foreground font-mono">
            Histórico: {formatNumber(history.length)}
          </Badge>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadPipeline()}
          disabled={isLoading}
          className="h-8 text-xs self-start sm:self-auto"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isLoading && "animate-spin")} />
          Atualizar Pipeline
        </Button>
      </div>

      {/* STAGE 1: APRENDIZADOS IDENTIFICADOS */}
      <Card className="border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Eye className="h-4 w-4 text-amber-400" />
                1. Aprendizados Identificados
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Padrões preliminares detectados que ainda aguardam confirmação multi-conversa antes de pedir aprovação.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono">
              {formatNumber(identified.length)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {identified.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              Nenhum aprendizado preliminar em observação no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {identified.map((item) => (
                <div key={item.id} className="rounded-xl border border-border/70 bg-background/40 p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-300">
                        Em coleta de evidências
                      </Badge>
                      {item.patternType && (
                        <Badge variant="outline" className="text-[10px] font-mono border-border/70 text-muted-foreground">
                          {item.patternType}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {formatNumber(item.observedFrequency)} ocorrências
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.afterBehavior || "—"}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <span>Agente: <strong className="text-foreground">{item.agentKey || "—"}</strong></span>
                    <span>Impacto observado: <strong className="text-emerald-300">{formatImpactLabel(item)}</strong></span>
                    <span>Atualizado: {formatDateTime(item.updatedAt || item.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* STAGE 2: MELHORIAS AGUARDANDO APROVAÇÃO */}
      <Card className="border-emerald-500/30 bg-card/90 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                2. Melhorias Aguardando Aprovação
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Compare Antes vs Depois, analise as amostras de conversas e decida se a melhoria deve ser aplicada.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] border-orange-500/40 bg-orange-500/10 text-orange-300 font-mono">
              {formatNumber(pendingApproval.length)} pendentes
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {pendingApproval.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-6 text-center space-y-1.5">
              <CheckCircle2 className="h-7 w-7 mx-auto text-emerald-400" />
              <p className="text-xs font-semibold text-foreground">Nenhuma melhoria aguardando aprovação</p>
              <p className="text-[11px] text-muted-foreground">
                Novas propostas aparecerão aqui quando acumularem evidências suficientes em múltiplas conversas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApproval.map((proposal) => {
                const isBusy = busyProposalId === proposal.id;
                return (
                  <div
                    key={proposal.id}
                    className="rounded-xl border border-border/80 bg-background/45 p-4 space-y-3.5"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] border-orange-500/40 bg-orange-500/10 text-orange-300">
                            {proposal.stage === "testing" ? "Em validação" : "Aguardando aprovação"}
                          </Badge>
                          {proposal.patternType && (
                            <Badge variant="outline" className="text-[10px] font-mono border-border/70 text-muted-foreground">
                              {proposal.patternType}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] border-border/70 text-muted-foreground">
                            Agente: {proposal.agentKey || "—"}
                          </Badge>
                        </div>
                        <h4 className="text-sm font-bold text-foreground">{proposal.title}</h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-lg border border-border/70 bg-card/60 font-mono text-[11px]">
                          Evidências: <strong>{formatNumber(proposal.observedFrequency)}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-mono text-[11px]">
                          Impacto: <strong>{formatImpactLabel(proposal)}</strong>
                        </span>
                      </div>
                    </div>

                    {/* ANTES vs DEPOIS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                          Antes (Comportamento Atual)
                        </span>
                        <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                          {proposal.beforeBehavior || "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Depois (Melhoria Proposta)
                        </span>
                        <p className="text-xs text-foreground whitespace-pre-line leading-relaxed font-medium">
                          {proposal.afterBehavior || "—"}
                        </p>
                        {proposal.suggestedCta && (
                          <p className="text-[11px] text-emerald-300/90 pt-1">
                            CTA sugerido: {proposal.suggestedCta}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* EVIDENCE SAMPLES */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Amostras de Evidência ({Array.isArray(proposal.evidenceItems) ? proposal.evidenceItems.length : 0})
                      </span>
                      {renderEvidenceSamples(proposal.evidenceItems)}
                    </div>

                    {/* GOVERNANCE ACTIONS */}
                    <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Proposta #{proposal.id} • Identificada em {formatDateTime(proposal.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleReject(proposal)}
                          className="h-8 text-xs border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleApprove(proposal)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                        >
                          {isBusy ? (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Aprovar & Aplicar
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

      {/* STAGE 3: MELHORIAS APLICADAS & HISTÓRICO + VERSÕES */}
      <div className="space-y-4">
        <Card className="border-border/80 bg-card/85 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  3. Melhorias Aplicadas & Histórico
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Registro auditável de melhorias ativas, aprovadores, versões vinculadas e rollback em 1 clique.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[11px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-mono">
                {formatNumber(applied.length)} ativas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-5">
            {/* 3A. APPLIED PROPOSALS */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Melhorias Aplicadas em Produção
              </h4>
              {applied.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-5 text-center text-xs text-muted-foreground">
                  Nenhuma melhoria aplicada no momento.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {applied.map((item) => {
                    const isBusy = busyProposalId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                              Aplicada
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-mono border-border/70 text-foreground">
                              Versão {item.appliedVersionId != null ? `#${item.appliedVersionId}` : "—"}
                            </Badge>
                            {item.proposedPlaybookId != null && (
                              <Badge variant="outline" className="text-[10px] font-mono border-border/70 text-muted-foreground">
                                Playbook #{item.proposedPlaybookId}
                              </Badge>
                            )}
                            <span className="text-[11px] font-mono text-emerald-300">
                              {formatImpactLabel(item)}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.afterBehavior || "—"}</p>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                            <span className="inline-flex items-center gap-1">
                              <UserCheck className="h-3 w-3 text-emerald-400" />
                              Aprovado por: <strong className="text-foreground">{item.approvedBy || "—"}</strong>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(item.approvedAt || item.updatedAt)}
                            </span>
                            <span>Evidências: {formatNumber(item.observedFrequency)}</span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleRollbackProposal(item)}
                          className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0 self-start lg:self-center"
                        >
                          {isBusy ? (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Rollback
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3B. HISTORY (ROLLED BACK & REJECTED) */}
            <div className="space-y-2.5 pt-2 border-t border-border/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Histórico de Rollbacks & Rejeições ({formatNumber(history.length)})
              </h4>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum rollback ou rejeição registrado no histórico.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => {
                    const isRolledBack = item.stage === "rolled_back";
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/70 bg-background/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                isRolledBack
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                              )}
                            >
                              {isRolledBack ? "Revertida (Rollback)" : "Rejeitada"}
                            </Badge>
                            {item.appliedVersionId != null && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Versão #{item.appliedVersionId}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              • Responsável: {item.approvedBy || "—"}
                            </span>
                          </div>
                          <p className="font-semibold text-foreground">{item.title}</p>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                          {formatDateTime(item.rolledBackAt || item.updatedAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3C. AGENT SNAPSHOT VERSIONS */}
            <div className="space-y-2.5 pt-2 border-t border-border/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-emerald-400" /> Versões de Snapshot do Atendente ({formatNumber(versions.length)})
              </h4>
              {versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {agentKey === "all"
                    ? "Selecione um atendente específico no filtro superior para visualizar e restaurar snapshots de versão."
                    : "Nenhuma versão de snapshot registrada para este atendente."}
                </p>
              ) : (
                <div className="space-y-2">
                  {versions.map((ver) => {
                    const isBusy = busyVersionId === ver.id;
                    return (
                      <div
                        key={ver.id}
                        className="rounded-xl border border-border/70 bg-background/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                              v{ver.version_number ?? ver.id} (ID #{ver.id})
                            </Badge>
                            {ver.change_scope && (
                              <Badge variant="outline" className="text-[10px] border-border/70 text-muted-foreground">
                                {ver.change_scope}
                              </Badge>
                            )}
                            {ver.reason && (
                              <span className="text-[11px] text-foreground font-medium">{ver.reason}</span>
                            )}
                          </div>
                          {ver.summary && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              Perfil: {ver.summary.personalityPreset || "—"} • Tom: {ver.summary.tone || "—"} • Modelo:{" "}
                              {ver.summary.modelId || "—"}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            Por: {ver.created_by || "—"} • {formatDateTime(ver.created_at)}
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleRollbackVersion(ver)}
                          className="h-8 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 shrink-0 self-start sm:self-center"
                        >
                          {isBusy ? (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Rollback
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
