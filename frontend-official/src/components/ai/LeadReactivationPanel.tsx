import { useState } from "react";
import { Lightning, ArrowClockwise, UserCirclePlus, Snowflake, ThermometerHot, CaretRight } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiService } from "@/services/apiService";
import { notify } from "@/services/notifyService";
import { cn } from "@/lib/utils";

type ReactivationAction = "reactivate_ai" | "send_followup" | "mark_cold" | "escalate" | "no_action";

interface LeadRecommendation {
  conversationId: number | string;
  phone: string;
  name: string;
  temperature: string;
  funnelStage: string;
  lastActivity: string;
  aiEnabled: boolean;
  action: ReactivationAction;
  reason: string;
  priority: string;
  suggestedMessage?: string;
}

interface AnalysisResult {
  totalAnalyzed: number;
  recommendations: LeadRecommendation[];
  summary: { toReactivate: number; toFollowUp: number; toCold: number; noAction: number };
  generatedAt: string;
}

const ACTION_META: Record<ReactivationAction, { label: string; icon: any; tone: string }> = {
  reactivate_ai: { label: "Reativar IA", icon: Lightning, tone: "text-primary bg-primary/10 border-primary/30" },
  send_followup: { label: "Follow-up", icon: UserCirclePlus, tone: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  mark_cold: { label: "Marcar Frio", icon: Snowflake, tone: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  escalate: { label: "Escalar", icon: CaretRight, tone: "text-destructive bg-destructive/10 border-destructive/30" },
  no_action: { label: "Sem ação", icon: ArrowClockwise, tone: "text-muted-foreground bg-muted/10 border-border" },
};

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.round(diff / (1000 * 60 * 60));
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.round(hours / 24);
  return `${days}d atrás`;
}

export function LeadReactivationPanel() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [manualSearch, setManualSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const searchContacts = async () => {
    const term = manualSearch.trim();
    if (!term || term.length < 2) return;
    setSearchLoading(true);
    try {
      const conversations = await apiService.getConversations(false, { limit: 100 });
      const list = Array.isArray(conversations) ? conversations : [];
      const filtered = list.filter((c: any) => {
        const name = c.contactName || c.name || "";
        const phone = c.phone || c.lead_phone || "";
        const haystack = `${name} ${phone}`.toLowerCase();
        return haystack.includes(term.toLowerCase());
      }).slice(0, 10);
      setSearchResults(filtered);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const reactivateManual = async (contact: any) => {
    try {
      await apiService.reactivateLeads([{ conversationId: contact.id, action: "reactivate_ai" }]);
      const label = contact.contactName || contact.name || contact.phone;
      notify.success(`IA reativada para ${label}`);
      setSearchResults((prev) => prev.filter((c) => c.id !== contact.id));
    } catch (err: any) {
      notify.error(err?.message || "Falha ao reativar");
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const res: any = await apiService.getLeadReactivationAnalysis();
      const data = res?.data ?? res;
      setAnalysis(data);
      if (data.recommendations?.length > 0) {
        setSelectedIds(new Set(data.recommendations.map((r: LeadRecommendation) => r.conversationId)));
      }
    } catch (err: any) {
      notify.error("Falha ao analisar leads: " + (err?.message || "erro"));
    } finally {
      setLoading(false);
    }
  };

  const executeSelected = async () => {
    if (!analysis || selectedIds.size === 0) return;
    setExecuting(true);
    try {
      const actions = analysis.recommendations
        .filter((r) => selectedIds.has(r.conversationId))
        .map((r) => ({ conversationId: r.conversationId, action: r.action, message: r.suggestedMessage }));
      const res: any = await apiService.reactivateLeads(actions);
      const data = res?.data ?? res;
      notify.success(`${data?.executed ?? actions.length} leads reativados com sucesso`);
      setAnalysis(null);
      setSelectedIds(new Set());
    } catch (err: any) {
      notify.error("Falha ao executar reativações: " + (err?.message || "erro"));
    } finally {
      setExecuting(false);
    }
  };

  const toggleSelect = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <ThermometerHot className="h-5 w-5 text-primary" weight="duotone" />
          Reativação Inteligente de Leads
        </CardTitle>
        <Button
          onClick={runAnalysis}
          disabled={loading}
          className="gap-2 rounded-xl shadow-glow"
          size="sm"
        >
          <ArrowClockwise className={cn("h-4 w-4", loading && "animate-spin")} />
          {loading ? "Analisando..." : "Analisar Leads"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis && !loading && (
          <p className="text-sm text-muted-foreground">
            Clique em "Analisar Leads" para identificar conversas inativas que podem ser reativadas pela IA.
            O sistema analisa temperatura, funil, tags e tempo de inatividade para recomendar ações.
          </p>
        )}

        {analysis && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-center">
                <p className="font-display text-xl font-bold text-primary">{analysis.summary.toReactivate}</p>
                <p className="text-[10px] text-muted-foreground">Reativar IA</p>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-center">
                <p className="font-display text-xl font-bold text-amber-400">{analysis.summary.toFollowUp}</p>
                <p className="text-[10px] text-muted-foreground">Follow-up</p>
              </div>
              <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 p-3 text-center">
                <p className="font-display text-xl font-bold text-blue-400">{analysis.summary.toCold}</p>
                <p className="text-[10px] text-muted-foreground">Marcar Frio</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/10 p-3 text-center">
                <p className="font-display text-xl font-bold">{analysis.totalAnalyzed}</p>
                <p className="text-[10px] text-muted-foreground">Analisados</p>
              </div>
            </div>

            {analysis.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedIds.size}/{analysis.recommendations.length} selecionados
                  </p>
                  <Button
                    onClick={executeSelected}
                    disabled={executing || selectedIds.size === 0}
                    size="sm"
                    className="gap-2 rounded-xl shadow-glow"
                  >
                    <Lightning className="h-4 w-4" weight="fill" />
                    {executing ? "Executando..." : `Reativar ${selectedIds.size} leads`}
                  </Button>
                </div>

                <div className="scrollbar-thin max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {analysis.recommendations.map((lead) => {
                    const meta = ACTION_META[lead.action] || ACTION_META.no_action;
                    const Icon = meta.icon;
                    const selected = selectedIds.has(lead.conversationId);
                    return (
                      <button
                        key={lead.conversationId}
                        type="button"
                        onClick={() => toggleSelect(lead.conversationId)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                          selected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/70 bg-background/40 hover:bg-card/70",
                        )}
                      >
                        <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border", meta.tone)}>
                          <Icon className="h-4 w-4" weight="bold" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{lead.name}</span>
                            <Badge variant="secondary" className="rounded-full text-[9px]">
                              {lead.temperature}
                            </Badge>
                            {lead.priority === "high" && (
                              <Badge className="rounded-full bg-destructive/15 text-[9px] text-destructive">urgente</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.reason}</p>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(lead.lastActivity)}</span>
                          <Badge variant="outline" className={cn("rounded-full text-[9px]", meta.tone)}>
                            {meta.label}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {analysis.recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos os leads estão ativos ou foram atendidos recentemente. Nenhuma reativação necessária no momento.
              </p>
            )}
          </>
        )}

        {/* Busca manual de contatos para reativação */}
        <div className="border-t border-border/50 pt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Reativar lead manualmente (buscar por nome ou número)</p>
          <div className="flex gap-2">
            <Input
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              placeholder="Nome ou telefone do lead..."
              className="rounded-xl"
              onKeyDown={(e) => e.key === "Enter" && void searchContacts()}
            />
            <Button onClick={() => void searchContacts()} size="sm" className="gap-1.5 rounded-xl" disabled={searchLoading}>
              {searchLoading ? <ArrowClockwise className="h-4 w-4 animate-spin" /> : <Lightning className="h-4 w-4" />}
              Buscar
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="scrollbar-thin max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {searchResults.map((contact: any) => (
                <div
                  key={contact.id || contact.phone}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium truncate">{contact.contactName || contact.name || contact.phone}</span>
                    {(contact.contactName || contact.name) && contact.phone && (
                      <span className="ml-2 text-xs text-muted-foreground">{contact.phone}</span>
                    )}
                    {contact.lead_temperature && (
                      <Badge variant="secondary" className="ml-2 rounded-full text-[9px]">{contact.lead_temperature}</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 rounded-lg text-xs"
                    onClick={() => void reactivateManual(contact)}
                  >
                    <Lightning className="h-3.5 w-3.5" />
                    Reativar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default LeadReactivationPanel;
