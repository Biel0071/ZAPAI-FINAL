import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Brain,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileText,
  Layers,
  MessageSquare,
  Receipt,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";
import {
  type ConversationExplanationResponse,
  type ConversationResultRow,
  MEMORY_CATEGORY_BY_ID,
  MEMORY_SCOPE_LABELS,
  formatConfidencePct,
  formatCurrencyBRL,
  formatDateTime,
  formatDurationSec,
  formatLatencyMs,
  formatNumber,
} from "./types";

interface ConversationExplainabilitySheetProps {
  conversation: ConversationResultRow | null;
  onClose: () => void;
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

function displayText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function ConversationExplainabilitySheet({
  conversation,
  onClose,
}: ConversationExplainabilitySheetProps) {
  const navigate = useNavigate();
  const requestIdRef = useRef(0);

  const [data, setData] = useState<ConversationExplanationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExplanation = useCallback(async (convId: number | string) => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      if (typeof apiService?.explainConversationDecision !== "function") {
        throw new Error("Serviço de explicabilidade indisponível.");
      }
      const res = await apiService.explainConversationDecision(convId);
      if (reqId !== requestIdRef.current) return;
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Não foi possível explicar esta conversa.");
      }
      setData(res as ConversationExplanationResponse);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setData(null);
      setError(extractErrorMessage(err, "Erro ao consultar auditoria da conversa."));
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (conversation?.id != null) {
      void loadExplanation(conversation.id);
    } else {
      ++requestIdRef.current;
      setData(null);
      setError(null);
      setIsLoading(false);
    }
  }, [conversation?.id, loadExplanation]);

  const conv = data?.conversation;
  const config = data?.configurationUsed;
  const model = data?.modelUsed;
  const memories = data?.retrievedMemories || [];
  const turns = data?.turns || [];
  const outcome = data?.outcome;
  const sheets = outcome?.sheets || [];
  const quotes = outcome?.quotes || [];
  const orders = outcome?.orders || [];

  return (
    <Sheet open={Boolean(conversation)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto bg-card border-l border-border/80 p-5 space-y-5"
      >
        <SheetHeader className="space-y-2 border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
              Explicabilidade • Conversa #{conversation?.id ?? "—"}
            </Badge>
            {conversation?.id != null && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(`/inbox?conversationId=${conversation.id}`)}
                className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
              >
                <ExternalLink className="h-3 w-3" /> Abrir no Inbox
              </Button>
            )}
          </div>

          <SheetTitle className="text-base font-bold text-foreground">
            {conv?.name || conversation?.contact_name || "Conversa sem nome"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Telefone: {conv?.phone || conversation?.contact_phone || "—"}</span>
            <span>Atendente: {conv?.agentName || conversation?.agent_name || "—"}</span>
            <span>Sessão: {conv?.sessionId || conversation?.session_id || "—"}</span>
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div role="status" className="py-10 text-center space-y-2 text-xs text-muted-foreground">
            <RefreshCw className="h-6 w-6 mx-auto animate-spin text-emerald-400" />
            <p>Carregando auditoria completa da decisão no PostgreSQL...</p>
          </div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-destructive">{error}</p>
            {conversation?.id != null && (
              <Button type="button" variant="outline" size="sm" onClick={() => void loadExplanation(conversation.id)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
              </Button>
            )}
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* 1. CONFIGURAÇÃO UTILIZADA */}
            <section className="rounded-xl border border-border/70 bg-background/40 p-3.5 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5" /> Configuração Utilizada
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Personalidade</span>
                  <strong className="text-foreground">{displayText(config?.personalityPreset)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Objetivo</span>
                  <strong className="text-foreground">{displayText(config?.objective)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Tom</span>
                  <strong className="text-foreground">{displayText(config?.tone)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Estilo de Resposta</span>
                  <strong className="text-foreground">{displayText(config?.responseStyle)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Temperatura</span>
                  <strong className="font-mono text-foreground">{displayText(config?.temperature)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Modo de Roteamento</span>
                  <strong className="text-foreground">{displayText(config?.routingMode || model?.routingMode)}</strong>
                </div>
              </div>
            </section>

            {/* 2. MODELO, PROVEDOR & ESTRATÉGIA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <section className="rounded-xl border border-border/70 bg-background/40 p-3.5 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" /> Modelo e Provedor
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Provedor:</span>
                    <strong className="text-foreground font-mono">{displayText(model?.provider)}</strong>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Modelo:</span>
                    <strong className="text-foreground font-mono truncate">{displayText(model?.model)}</strong>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Escopo Credencial:</span>
                    <strong className="text-foreground">{displayText(model?.credentialScope)}</strong>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Latência / Tokens:</span>
                    <strong className="font-mono text-foreground">
                      {formatLatencyMs(model?.latencyMs)} • {formatNumber(model?.tokens)} tok
                    </strong>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border/70 bg-background/40 p-3.5 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Estratégia Aplicada
                </h4>
                <p className="text-sm font-bold text-foreground">
                  {data.appliedStrategy || "—"}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="text-[10px] border-border/70">
                    Funil: {conv?.funnelStage || "—"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-border/70">
                    Temperatura Lead: {conv?.leadTemperature || "—"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-border/70">
                    Intenção: {conv?.leadIntent || "—"}
                  </Badge>
                </div>
              </section>
            </div>

            {/* 3. MEMÓRIAS RECUPERADAS */}
            <section className="rounded-xl border border-border/70 bg-background/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" /> Memórias Recuperadas ({formatNumber(memories.length)})
                </h4>
              </div>
              {memories.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma memória recuperada registrada nos turnos desta conversa.
                </p>
              ) : (
                <div className="space-y-2">
                  {memories.map((mem) => {
                    const catMeta = mem.category ? MEMORY_CATEGORY_BY_ID[mem.category] : null;
                    return (
                      <div key={mem.id} className="rounded-lg border border-border/60 bg-card/60 p-2.5 space-y-1 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={cn("text-[10px]", catMeta?.badgeClass || "border-border/70")}>
                              {catMeta?.label || mem.category || "Memória"}
                            </Badge>
                            {mem.memory_scope && (
                              <span className="text-[10px] text-muted-foreground">
                                {MEMORY_SCOPE_LABELS[mem.memory_scope] || mem.memory_scope}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Confiança: {formatConfidencePct(mem.confidence)}
                          </span>
                        </div>
                        <p className="font-semibold text-foreground">{mem.label || "—"}</p>
                        {mem.content && <p className="text-[11px] text-muted-foreground">{mem.content}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 4. TURNOS DE ATENDIMENTO */}
            <section className="rounded-xl border border-border/70 bg-background/40 p-3.5 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Turnos de Atendimento ({formatNumber(turns.length)})
              </h4>
              {turns.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum turno de experiência registrado para esta conversa.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {turns.map((turn) => (
                    <div key={turn.id} className="rounded-lg border border-border/60 bg-card/60 p-3 space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {turn.intent_detected && (
                            <Badge variant="outline" className="text-[10px] border-sky-500/30 text-sky-300">
                              Intenção: {turn.intent_detected}
                            </Badge>
                          )}
                          {turn.strategy_applied && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">
                              {turn.strategy_applied}
                            </Badge>
                          )}
                          {turn.human_intervened && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                              Intervenção humana
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono">{formatDateTime(turn.created_at)}</span>
                      </div>

                      {turn.customer_utterance && (
                        <p className="text-foreground">
                          <span className="text-muted-foreground font-semibold">Cliente: </span>
                          {turn.customer_utterance}
                        </p>
                      )}
                      {turn.ai_reply && (
                        <p className="text-muted-foreground">
                          <span className="text-emerald-400 font-semibold">IA: </span>
                          {turn.ai_reply}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                        <span>
                          Cliente continuou:{" "}
                          <strong className="text-foreground">
                            {turn.customer_replied == null ? "—" : turn.customer_replied ? "Sim" : "Não"}
                          </strong>
                        </span>
                        <span>
                          Tempo resposta cliente:{" "}
                          <strong className="font-mono text-foreground">
                            {formatDurationSec(turn.customer_replied_seconds)}
                          </strong>
                        </span>
                        {turn.funnel_outcome && (
                          <span>
                            Desfecho: <strong className="text-foreground">{turn.funnel_outcome}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 5. RESULTADO COMERCIAL REAL */}
            <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Resultado Comercial Real
                </h4>
                {outcome?.score?.total_xp != null && (
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-300">
                    XP Conversa: {formatNumber(outcome.score.total_xp)}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3 text-sky-400" /> Fichas
                  </span>
                  <strong className="text-sm font-mono text-foreground">{formatNumber(sheets.length)}</strong>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Receipt className="h-3 w-3 text-amber-400" /> Orçamentos
                  </span>
                  <strong className="text-sm font-mono text-foreground">{formatNumber(quotes.length)}</strong>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3 text-emerald-400" /> Pedidos
                  </span>
                  <strong className="text-sm font-mono text-foreground">{formatNumber(orders.length)}</strong>
                </div>
              </div>

              {orders.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-emerald-300">Pedidos Confirmados</span>
                  {orders.map((ord) => (
                    <div key={ord.id} className="rounded-lg border border-emerald-500/25 bg-background/50 px-3 py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {ord.order_title || ord.order_id || `Pedido #${ord.id}`} ({ord.status || "—"})
                      </span>
                      <strong className="font-mono text-emerald-300">{formatCurrencyBRL(ord.total_amount)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {quotes.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-amber-300">Orçamentos Gerados</span>
                  {quotes.map((q) => (
                    <div key={q.id} className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {q.quote_number || `Orçamento #${q.id}`} ({q.status || "—"})
                      </span>
                      <strong className="font-mono text-foreground">{formatCurrencyBRL(q.total_amount)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {sheets.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-sky-300">Fichas de Atendimento</span>
                  {sheets.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        Ficha #{s.id} • {s.payment_method || "—"} ({s.status || "—"})
                      </span>
                      <strong className="font-mono text-foreground">{formatCurrencyBRL(s.total_price)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {orders.length === 0 && quotes.length === 0 && sheets.length === 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Nenhuma ficha, orçamento ou pedido vinculado a esta conversa até o momento.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
