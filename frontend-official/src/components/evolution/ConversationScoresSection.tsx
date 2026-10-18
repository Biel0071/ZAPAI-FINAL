import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Award,
  TrendingUp,
  MessageCircle,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Zap,
  Layers,
  ChevronRight,
  Filter,
  Flame,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";

export interface ConversationScoreItem {
  conversationId: number;
  contactName: string;
  contactPhone: string;
  algorithmCode: string;
  algorithmName: string;
  conversationStyle: string;
  algorithm?: {
    code: string;
    name: string;
    style: string;
  };
  cadastralXp: number;
  productXp: number;
  sheetXp: number;
  conversionXp: number;
  qualityXp: number;
  totalXp: number;
  milestones: {
    cadastral: { xp: number; max: number; achieved: boolean; details: string; nameConfirmed?: boolean; addressConfirmed?: boolean; phoneConfirmed?: boolean };
    product: { xp: number; max: number; achieved: boolean; details: string };
    sheet: { xp: number; max: number; achieved: boolean; details: string };
    conversion: { xp: number; max: number; achieved: boolean; details: string };
    quality: { xp: number; max: number; achieved: boolean; details: string; zeroRepetitions?: boolean; zeroDelirium?: boolean };
  };
  breakdown: {
    cadastralXp: number;
    productXp: number;
    sheetXp: number;
    conversionXp: number;
    qualityXp: number;
  };
  evaluationSummary?: string;
  funnelStage: string;
  hasOrderSheet?: boolean;
  evaluatedAt: string;
  updatedAt?: string;
}

export interface ConversationScoresSectionProps {
  agentKey?: string;
  onJumpToInbox?: (conversationId: number, phone?: string) => void;
}

const ALGORITHM_CONFIG: Record<string, { label: string; badgeClass: string; icon: any }> = {
  "ALGO-01": {
    label: "ALGO-01: Fechamento Rápido & PIX",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: Zap,
  },
  "ALGO-02": {
    label: "ALGO-02: Consultivo Técnico & Catálogo",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: Sparkles,
  },
  "ALGO-03": {
    label: "ALGO-03: Negociador & Parcelamento 10x",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: TrendingUp,
  },
  "ALGO-04": {
    label: "ALGO-04: Reativação Inteligente",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: RefreshCw,
  },
  "ALGO-05": {
    label: "ALGO-05: Pós-Venda Protegido",
    badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    icon: ShieldCheck,
  },
};

export function ConversationScoresSection({ agentKey = "camila", onJumpToInbox }: ConversationScoresSectionProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isSweeping, setIsSweeping] = useState(false);
  const [search, setSearch] = useState("");
  const [algorithmFilter, setAlgorithmFilter] = useState("todos");
  const [milestoneFilter, setMilestoneFilter] = useState("todos");
  const [selectedScore, setSelectedScore] = useState<ConversationScoreItem | null>(null);

  const [scores, setScores] = useState<ConversationScoreItem[]>([]);
  const [summary, setSummary] = useState({
    totalConversations: 0,
    totalEarnedXp: 0,
    averageScore: 0,
    totalConversions: 0,
    totalSheets: 0,
  });

  const loadScores = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await requestApiEndpoint(
        `/api/ai/evolution/conversation-scores?agentKey=${encodeURIComponent(agentKey)}`
      );
      if (res?.data) {
        const d = res.data;
        if (Array.isArray(d)) {
          setScores(d);
          setSummary({
            totalConversations: d.length,
            totalEarnedXp: d.reduce((acc: number, item: any) => acc + (item.totalXp || 0), 0),
            averageScore: d.length > 0 ? Math.round(d.reduce((acc: number, item: any) => acc + (item.totalXp || 0), 0) / d.length) : 0,
            totalConversions: d.filter((item: any) => (item.conversionXp || 0) > 0).length,
            totalSheets: d.filter((item: any) => item.hasOrderSheet || (item.sheetXp || 0) > 0).length,
          });
        } else {
          setScores(d.scores || []);
          setSummary({
            totalConversations: d.totalConversations ?? d.scores?.length ?? 0,
            totalEarnedXp: d.totalEarnedXp ?? 0,
            averageScore: d.averageScore ?? 0,
            totalConversions: d.totalConversions ?? 0,
            totalSheets: d.totalSheets ?? 0,
          });
        }
      }
    } catch (err: any) {
      console.warn("[ConversationScoresSection] Failed to load scores:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [agentKey]);

  useEffect(() => {
    loadScores();
  }, [loadScores]);

  const handleSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await requestApiEndpoint("/api/ai/evolution/conversation-scores/sweep", {
        method: "POST",
        body: JSON.stringify({ limit: 50, agentKey }),
      });
      toast({
        title: "Varredura Concluída",
        description: `${res?.scoredCount ?? 0} conversas foram avaliadas com pontuação real!`,
      });
      await loadScores();
    } catch (err: any) {
      toast({
        title: "Erro na varredura",
        description: err?.message || "Não foi possível varrer conversas.",
        variant: "destructive",
      });
    } finally {
      setIsSweeping(false);
    }
  };

  const handleNavigateInbox = (conversationId: number, phone?: string) => {
    if (onJumpToInbox) {
      onJumpToInbox(conversationId, phone);
      return;
    }
    navigate(`/inbox?conversationId=${conversationId}`);
  };

  const filteredScores = React.useMemo(() => {
    return scores.filter((item) => {
      if (algorithmFilter !== "todos" && item.algorithmCode !== algorithmFilter) {
        return false;
      }
      if (milestoneFilter === "sheet" && item.sheetXp === 0) return false;
      if (milestoneFilter === "conversion" && item.conversionXp === 0) return false;
      if (milestoneFilter === "high_xp" && item.totalXp < 100) return false;
      if (milestoneFilter === "cadastral" && item.cadastralXp < 15) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = (item.contactName || "").toLowerCase().includes(q);
        const matchesPhone = (item.contactPhone || "").includes(q);
        const matchesId = String(item.conversationId).includes(q);
        const matchesAlgo = (item.algorithmName || "").toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesId || matchesAlgo;
      }

      return true;
    });
  }, [scores, algorithmFilter, milestoneFilter, search]);

  return (
    <div className="space-y-4" data-testid="conversation-scores-section">
      {/* HEADER & METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              XP Total Acumulado
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-bold font-mono text-purple-400">
                {isLoading ? "…" : `+${summary.totalEarnedXp} XP`}
              </strong>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
            <Flame className="h-5 w-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Conversas Avaliadas
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-bold font-mono text-foreground">
                {isLoading ? "…" : summary.totalConversations}
              </strong>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Média XP / Conversa
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-bold font-mono text-foreground">
                {isLoading ? "…" : `${summary.averageScore} XP`}
              </strong>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Award className="h-5 w-5" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl border border-border/80 bg-card/80 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Fichas & Conversões
            </span>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl font-bold font-mono text-foreground">
                {isLoading ? "…" : `${summary.totalSheets} / ${summary.totalConversions}`}
              </strong>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <FileCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-card/80 border border-border/70">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, telefone ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background/50 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Select value={algorithmFilter} onValueChange={setAlgorithmFilter}>
            <SelectTrigger className="h-9 w-[190px] text-xs">
              <SelectValue placeholder="Filtrar Algoritmo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Algoritmos</SelectItem>
              <SelectItem value="ALGO-01">ALGO-01: Fechamento Rápido</SelectItem>
              <SelectItem value="ALGO-02">ALGO-02: Consultivo Técnico</SelectItem>
              <SelectItem value="ALGO-03">ALGO-03: Negociador / 10x</SelectItem>
              <SelectItem value="ALGO-04">ALGO-04: Reativação</SelectItem>
              <SelectItem value="ALGO-05">ALGO-05: Pós-Venda</SelectItem>
            </SelectContent>
          </Select>

          <Select value={milestoneFilter} onValueChange={setMilestoneFilter}>
            <SelectTrigger className="h-9 w-[170px] text-xs">
              <SelectValue placeholder="Filtrar Marco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Marcos</SelectItem>
              <SelectItem value="cadastral">Coleta Completa (+25 XP)</SelectItem>
              <SelectItem value="sheet">Ficha Gerada (+40 XP)</SelectItem>
              <SelectItem value="conversion">Avanço Funil (+50 XP)</SelectItem>
              <SelectItem value="high_xp">Alta Pontuação (100+ XP)</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSweep}
            disabled={isSweeping}
            className="h-9 text-xs cursor-pointer ml-auto"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isSweeping && "animate-spin")} />
            Varrer Conversas
          </Button>
        </div>
      </div>

      {/* CONVERSATION CARDS LIST */}
      {isLoading ? (
        <Card className="p-8 text-center bg-card/50 border-border/70">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <RefreshCw className="h-4 w-4 animate-spin text-purple-400" />
            Carregando pontuação real de conversas...
          </div>
        </Card>
      ) : filteredScores.length === 0 ? (
        <Card className="p-8 text-center bg-card/50 border-border/70 space-y-2">
          <p className="text-sm font-semibold text-foreground">Nenhuma conversa encontrada</p>
          <p className="text-xs text-muted-foreground">
            {search || algorithmFilter !== "todos" || milestoneFilter !== "todos"
              ? "Tente ajustar os filtros de busca acima."
              : "Clique em 'Varrer Conversas' para pontuar as conversas recentes da loja."}
          </p>
          <Button variant="outline" size="sm" onClick={handleSweep} className="mt-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Pontuar Conversas Agora
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredScores.map((item) => {
            const algoInfo = ALGORITHM_CONFIG[item.algorithmCode] || {
              label: `${item.algorithmCode}: ${item.algorithmName}`,
              badgeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30",
              icon: Zap,
            };
            const AlgoIcon = algoInfo.icon;

            return (
              <div
                key={item.conversationId}
                className="p-4 rounded-2xl border border-border/80 bg-card/70 hover:bg-card hover:border-purple-500/40 transition-all shadow-xs space-y-3"
              >
                {/* TOP ROW: CLIENT INFO + XP BADGE */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                      #{item.conversationId}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-foreground">
                          {item.contactName}
                        </strong>
                        <span className="text-xs text-muted-foreground font-mono">
                          {item.contactPhone}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-medium py-0 px-2 flex items-center gap-1", algoInfo.badgeClass)}
                        >
                          <AlgoIcon className="h-3 w-3" />
                          <span>{algoInfo.label}</span>
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          Funil: {item.funnelStage}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* REAL XP BADGE */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-sm flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 text-emerald-400" />
                      +{item.totalXp} XP
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNavigateInbox(item.conversationId, item.contactPhone)}
                      className="h-8 text-xs cursor-pointer border-border/80 hover:border-purple-500/50"
                      title="Abrir no Inbox"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Inbox
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedScore(item)}
                      className="h-8 text-xs cursor-pointer text-purple-400 hover:text-purple-300"
                    >
                      Detalhes
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>

                {/* BOTTOM ROW: 5 ITEMIZED MILESTONES */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1 border-t border-border/50 text-[11px]">
                  {/* 1. Cadastral */}
                  <div
                    className={cn(
                      "p-2 rounded-xl border flex flex-col justify-between",
                      item.cadastralXp >= 15
                        ? "bg-emerald-500/5 border-emerald-500/20 text-foreground"
                        : "bg-muted/20 border-border/60 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[10px]">Coleta Cadastral</span>
                      <span className="font-mono font-bold text-emerald-400">+{item.cadastralXp} XP</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate mt-1" title={item.milestones?.cadastral?.details}>
                      {item.milestones?.cadastral?.details || "Pendente"}
                    </span>
                  </div>

                  {/* 2. Product */}
                  <div
                    className={cn(
                      "p-2 rounded-xl border flex flex-col justify-between",
                      item.productXp > 0
                        ? "bg-blue-500/5 border-blue-500/20 text-foreground"
                        : "bg-muted/20 border-border/60 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[10px]">Especificação</span>
                      <span className="font-mono font-bold text-blue-400">+{item.productXp} XP</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate mt-1" title={item.milestones?.product?.details}>
                      {item.milestones?.product?.details || "Pendente"}
                    </span>
                  </div>

                  {/* 3. Sheet */}
                  <div
                    className={cn(
                      "p-2 rounded-xl border flex flex-col justify-between",
                      item.sheetXp > 0
                        ? "bg-amber-500/5 border-amber-500/20 text-foreground"
                        : "bg-muted/20 border-border/60 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[10px]">Ficha / Orçamento</span>
                      <span className="font-mono font-bold text-amber-400">+{item.sheetXp} XP</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate mt-1" title={item.milestones?.sheet?.details}>
                      {item.sheetXp > 0 ? "Ficha Emitida" : "Sem Ficha"}
                    </span>
                  </div>

                  {/* 4. Conversion */}
                  <div
                    className={cn(
                      "p-2 rounded-xl border flex flex-col justify-between",
                      item.conversionXp > 0
                        ? "bg-purple-500/5 border-purple-500/20 text-foreground"
                        : "bg-muted/20 border-border/60 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[10px]">Avanço de Funil</span>
                      <span className="font-mono font-bold text-purple-400">+{item.conversionXp} XP</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate mt-1" title={item.milestones?.conversion?.details}>
                      {item.conversionXp > 0 ? "Avançou" : "Inicial"}
                    </span>
                  </div>

                  {/* 5. Quality */}
                  <div
                    className={cn(
                      "p-2 rounded-xl border flex flex-col justify-between col-span-2 sm:col-span-1",
                      item.qualityXp === 15
                        ? "bg-teal-500/5 border-teal-500/20 text-foreground"
                        : "bg-destructive/5 border-destructive/20 text-destructive"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[10px]">Qualidade & Zero Delírio</span>
                      <span className="font-mono font-bold text-teal-400">+{item.qualityXp} XP</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate mt-1" title={item.milestones?.quality?.details}>
                      {item.qualityXp === 15 ? "100% Conforme" : "Com Alerta"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL INSPECTION MODAL */}
      {selectedScore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          onClick={() => setSelectedScore(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-400" />
                  Auditoria de Evolução: Conversa #{selectedScore.conversationId}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cliente: {selectedScore.contactName} ({selectedScore.contactPhone})
                </p>
              </div>
              <div className="px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-500/40 font-mono font-bold text-purple-300 text-sm">
                +{selectedScore.totalXp} XP Total
              </div>
            </div>

            {/* ALGORITHM CARD */}
            <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400">
                  Algoritmo Aplicado: {selectedScore.algorithmCode}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Estilo: {selectedScore.conversationStyle}
                </span>
              </div>
              <p className="text-xs text-foreground font-medium">
                {selectedScore.algorithmName}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Diretriz de Atendimento: Adaptado ao perfil do lead com foco no padrão canônico da loja e sem delírios.
              </p>
            </div>

            {/* 5 ITEMIZED MILESTONES WITH FULL EXPLANATION */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Detalhamento dos Marcos (+XP)
              </h4>

              <div className="space-y-2 text-xs">
                {/* Cadastral */}
                <div className="p-3 rounded-xl border border-border/80 bg-background/50 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">1. Coleta de Dados Cadastrais (+15 a +25 XP)</span>
                    <p className="text-[11px] text-muted-foreground">{selectedScore.milestones?.cadastral?.details}</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 shrink-0">
                    +{selectedScore.cadastralXp} XP
                  </span>
                </div>

                {/* Product */}
                <div className="p-3 rounded-xl border border-border/80 bg-background/50 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">2. Especificação de Produto (+20 XP)</span>
                    <p className="text-[11px] text-muted-foreground">{selectedScore.milestones?.product?.details}</p>
                  </div>
                  <span className="font-mono font-bold text-blue-400 shrink-0">
                    +{selectedScore.productXp} XP
                  </span>
                </div>

                {/* Sheet */}
                <div className="p-3 rounded-xl border border-border/80 bg-background/50 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">3. Geração de Ficha / Orçamento (+40 XP)</span>
                    <p className="text-[11px] text-muted-foreground">{selectedScore.milestones?.sheet?.details}</p>
                  </div>
                  <span className="font-mono font-bold text-amber-400 shrink-0">
                    +{selectedScore.sheetXp} XP
                  </span>
                </div>

                {/* Conversion */}
                <div className="p-3 rounded-xl border border-border/80 bg-background/50 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">4. Conversão / Avanço de Funil (+50 XP)</span>
                    <p className="text-[11px] text-muted-foreground">{selectedScore.milestones?.conversion?.details}</p>
                  </div>
                  <span className="font-mono font-bold text-purple-400 shrink-0">
                    +{selectedScore.conversionXp} XP
                  </span>
                </div>

                {/* Quality */}
                <div className="p-3 rounded-xl border border-border/80 bg-background/50 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">5. Qualidade de Atendimento (+15 XP)</span>
                    <p className="text-[11px] text-muted-foreground">{selectedScore.milestones?.quality?.details}</p>
                  </div>
                  <span className="font-mono font-bold text-teal-400 shrink-0">
                    +{selectedScore.qualityXp} XP
                  </span>
                </div>
              </div>
            </div>

            {/* MODAL ACTIONS */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedScore(null)}
                className="text-xs cursor-pointer"
              >
                Fechar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const convId = selectedScore.conversationId;
                  const phone = selectedScore.contactPhone;
                  setSelectedScore(null);
                  handleNavigateInbox(convId, phone);
                }}
                className="text-xs cursor-pointer bg-purple-600 hover:bg-purple-700 text-white"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir Atendimento no Inbox
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
