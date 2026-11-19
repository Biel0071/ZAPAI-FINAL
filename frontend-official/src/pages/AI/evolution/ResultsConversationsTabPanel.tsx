import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Award,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  Flame,
  MessageSquare,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";
import { ConversationExplainabilitySheet } from "./ConversationExplainabilitySheet";
import {
  type ConversationResultRow,
  type PeriodFilter,
  type ResultsAndConversationsResponse,
  formatCurrencyBRL,
  formatDateTime,
  formatDurationSec,
  formatLatencyMs,
  formatNumber,
  formatPercent,
  resolvePeriodDates,
} from "./types";

interface ResultsConversationsTabPanelProps {
  agentKey: string;
  sessionId: string;
  period: PeriodFilter;
  customStart: string;
  customEnd: string;
  periodLabel: string;
  refreshTrigger?: number;
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

export function ResultsConversationsTabPanel({
  agentKey,
  sessionId,
  period,
  customStart,
  customEnd,
  periodLabel,
  refreshTrigger = 0,
}: ResultsConversationsTabPanelProps) {
  const requestIdRef = useRef(0);

  const [data, setData] = useState<ResultsAndConversationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<ConversationResultRow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadResults = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      if (typeof apiService?.getResultsAndConversations !== "function") {
        throw new Error("Serviço de resultados e conversas indisponível.");
      }
      const range = resolvePeriodDates(period, customStart, customEnd);
      const res = await apiService.getResultsAndConversations({
        agentKey: agentKey && agentKey !== "all" ? agentKey : undefined,
        sessionId: sessionId && sessionId !== "all" ? sessionId : undefined,
        period: range.period,
        start: range.start,
        end: range.end,
        search: debouncedSearch || undefined,
        limit: 40,
      });
      if (reqId !== requestIdRef.current) return;
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Não foi possível carregar os resultados.");
      }
      setData(res);
    } catch (err) {
      if (reqId !== requestIdRef.current) return;
      setData(null);
      setError(extractErrorMessage(err, "Falha ao carregar resultados e conversas do PostgreSQL."));
    } finally {
      if (reqId === requestIdRef.current) setIsLoading(false);
    }
  }, [agentKey, sessionId, period, customStart, customEnd, debouncedSearch, refreshTrigger]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const metrics = data?.metrics;
  const byAlgorithm = data?.byAlgorithm || [];
  const conversations = data?.conversations || [];

  if (error) {
    return (
      <Card role="alert" className="border-destructive/40 bg-destructive/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-destructive">Não foi possível carregar resultados e conversas</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadResults()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar novamente
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border/80 bg-card/85 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Conversas Analisadas</span>
            <MessageSquare className="h-4 w-4 text-sky-400" />
          </div>
          <p className="text-xl font-bold font-mono text-foreground">
            {isLoading && !data ? "…" : formatNumber(metrics?.conversationsAnalyzed)}
          </p>
          <p className="text-[10px] text-muted-foreground">Recorte: {periodLabel}</p>
        </Card>

        <Card className="border-border/80 bg-card/85 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Qualificadas / Objeções</span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold font-mono text-foreground">
            {isLoading && !data
              ? "…"
              : `${formatNumber(metrics?.qualifiedConversations)} / ${formatNumber(metrics?.objectionsCount)}`}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-violet-400" /> Leads quentes/qualificados e objeções
          </p>
        </Card>

        <Card className="border-border/80 bg-card/85 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Conversões & Vendas</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-300">
            {isLoading && !data ? "…" : formatCurrencyBRL(metrics?.salesRevenue)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Conversões: <strong className="text-foreground">{formatNumber(metrics?.conversionsCount)}</strong> • Pedidos:{" "}
            <strong className="text-foreground">{formatNumber(metrics?.salesCount)}</strong> • Fichas:{" "}
            <strong className="text-foreground">{formatNumber(metrics?.sheetsCount)}</strong> • Orçamentos:{" "}
            <strong className="text-foreground">{formatNumber(metrics?.quotesCount)}</strong>
          </p>
        </Card>

        <Card className="border-border/80 bg-card/85 p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Continuidade & Latência</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-foreground">
            {isLoading && !data ? "…" : formatPercent(metrics?.continuityRatePct)}
          </p>
          <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2">
            <span>IA: <strong className="font-mono text-foreground">{formatLatencyMs(metrics?.avgAiLatencyMs)}</strong></span>
            <span>• Cliente: <strong className="font-mono text-foreground">{formatDurationSec(metrics?.avgCustomerReplySec)}</strong></span>
          </p>
        </Card>
      </div>

      {/* RESULTADOS POR ALGORITMO */}
      <Card className="border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Network className="h-4 w-4 text-emerald-400" />
                Resultados por Algoritmo
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Desempenho comparativo entre estratégias de atendimento registradas no PostgreSQL.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] font-mono border-emerald-500/30 text-emerald-300">
              {formatNumber(byAlgorithm.length)} algoritmos
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && !data ? (
            <div role="status" className="p-6 text-center text-xs text-muted-foreground">
              Carregando resultados por algoritmo...
            </div>
          ) : byAlgorithm.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhuma métrica por algoritmo registrada no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-4 font-semibold">Algoritmo</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Conversas</th>
                    <th className="py-2.5 px-4 font-semibold text-right">XP Médio</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Conversões</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Taxa Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {byAlgorithm.map((algo) => {
                    const convRate =
                      algo.conversations > 0 ? Number(((algo.conversions / algo.conversations) * 100).toFixed(1)) : null;
                    return (
                      <tr key={algo.code} className="hover:bg-background/40 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                              {algo.code}
                            </Badge>
                            <span className="font-semibold text-foreground">{algo.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-foreground">
                          {formatNumber(algo.conversations)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-foreground">
                          {formatNumber(algo.avgXp)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-300 font-semibold">
                          {formatNumber(algo.conversions)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                          {formatPercent(convRate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEARCHABLE CONVERSATIONS TABLE */}
      <Card className="border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Award className="h-4 w-4 text-emerald-400" />
                Conversas Auditáveis
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Clique em qualquer conversa para abrir a explicabilidade completa (configuração, modelo, memórias, estratégia e resultado comercial).
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar nome ou telefone..."
                  className="h-8 pl-8 text-xs bg-background/50"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadResults()}
                disabled={isLoading}
                className="h-8 text-xs shrink-0"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading && !data ? (
            <div role="status" className="p-8 text-center text-xs text-muted-foreground">
              Carregando conversas...
            </div>
          ) : conversations.length === 0 ? (
            <div role="status" className="p-8 text-center space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Nenhuma conversa encontrada</p>
              <p>Ajuste o período, canal WhatsApp ou termo de busca para consultar conversas registradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-background/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-4 font-semibold">Contato</th>
                    <th className="py-2.5 px-4 font-semibold">Atendente / Sessão</th>
                    <th className="py-2.5 px-4 font-semibold">Funil & Lead</th>
                    <th className="py-2.5 px-4 font-semibold">Modelo & Estratégia</th>
                    <th className="py-2.5 px-4 font-semibold text-right">XP / Pedido</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Atividade</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Auditoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {conversations.map((conv) => (
                    <tr
                      key={conv.id}
                      tabIndex={0}
                      onClick={() => setSelectedConversation(conv)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedConversation(conv);
                        }
                      }}
                      className="hover:bg-emerald-500/5 focus:bg-emerald-500/10 focus:outline-none transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-4">
                        <p className="font-semibold text-foreground">{conv.contact_name || "Contato"}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{conv.contact_phone || "—"}</p>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-foreground">{conv.agent_name || "—"}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{conv.session_id || "—"}</p>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-[10px] border-border/70">
                            {conv.funnel_stage || "—"}
                          </Badge>
                          {conv.lead_temperature && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                              {conv.lead_temperature}
                            </Badge>
                          )}
                          {conv.lead_intent && (
                            <span className="text-[10px] text-muted-foreground">{conv.lead_intent}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-mono text-[11px] text-foreground">
                          {conv.last_provider || "—"}
                          {conv.last_model ? ` / ${conv.last_model}` : ""}
                        </p>
                        <p className="text-[10px] text-emerald-300/90 truncate max-w-[200px]">
                          {conv.last_strategy || conv.algorithm_code || "—"}
                        </p>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <span className="font-mono font-semibold text-foreground">
                            {conv.total_xp == null ? "—" : `${formatNumber(conv.total_xp)} XP`}
                          </span>
                          {conv.has_order_sheet && (
                            <Badge variant="outline" className="text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Ficha/Pedido
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(conv.last_activity_at)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConversation(conv);
                          }}
                          className="h-7 px-2 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Explicar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConversationExplainabilitySheet
        conversation={selectedConversation}
        onClose={() => setSelectedConversation(null)}
      />
    </div>
  );
}
