import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GitBranch,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Tag,
  ArrowRight,
  ShieldCheck,
  Layers,
  Database,
} from "lucide-react";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { OfficialKnowledgeManager } from "@/components/evolution/OfficialKnowledgeManager";
import { PlaybookManager } from "@/components/evolution/PlaybookManager";
import { cn } from "@/core/lib/utils";

export interface FlowItem {
  id: string;
  name: string;
  trigger: string;
  response: string;
  nextSteps?: string[];
  active?: boolean;
}

const DEFAULT_PLAYBOOKS = [
  {
    id: "pb-price-objection",
    title: "Objeção de Preço (\"Está caro\")",
    trigger: "caro, desconto, menor preco, valor alto",
    category: "Vendas",
    active: true,
    script:
      "Entendo perfeitamente sua preocupação com o investimento! Nossos clientes escolhem nossa solução justamente porque ela se paga em poucos dias com suporte dedicado e garantia. Posso te apresentar as condições de parcelamento sem juros?",
  },
  {
    id: "pb-cart-recovery",
    title: "Recuperação de Interesse",
    trigger: "depois eu vejo, vou pensar, amanha falo",
    category: "Conversão",
    active: true,
    script:
      "Sem problemas! Vou deixar sua condição especial reservada por hoje. Quer que eu te envie um resumo com os principais benefícios para você analisar com calma?",
  },
  {
    id: "pb-lead-qualification",
    title: "Qualificação Rápida",
    trigger: "orcamento, informacoes, quanto custa",
    category: "Qualificação",
    active: true,
    script:
      "Perfeito! Para eu te passar a proposta mais assertiva, me conta: você precisa da solução para uso próprio ou para sua equipe/empresa?",
  },
];

export function FlowsTab() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Sub-navigation: 'todos' | 'knowledge' | 'playbooks' | 'flows' | 'hours'
  const activeSub = searchParams.get("sub") || "todos";

  const setSubTab = (sub: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (sub === "todos") {
        next.delete("sub");
      } else {
        next.set("sub", sub);
      }
      return next;
    }, { replace: true });
  };

  // Business hours state
  const [openingHour, setOpeningHour] = useState("08:00");
  const [closingHour, setClosingHour] = useState("18:00");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [outsideHoursAutoReply, setOutsideHoursAutoReply] = useState(true);
  const [absenceMessage, setAbsenceMessage] = useState(
    "Olá! No momento estamos fora do nosso horário de atendimento (das 8h às 18h). Deixe sua dúvida que responderemos logo no início do expediente!"
  );
  const [isSavingHours, setIsSavingHours] = useState(false);

  // Flows list state
  const [flows, setFlows] = useState<FlowItem[]>([]);
  const [loadingFlows, setLoadingFlows] = useState(true);

  // Flow Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flowDraft, setFlowDraft] = useState({
    name: "",
    trigger: "",
    response: "",
    nextSteps: "",
  });
  const [isSavingFlow, setIsSavingFlow] = useState(false);

  // Playbooks state
  const [playbooks, setPlaybooks] = useState(DEFAULT_PLAYBOOKS);

  // Load business hours and flows
  const loadData = useCallback(async () => {
    setLoadingFlows(true);
    try {
      const [hoursRes, absenceRes, flowsPayload] = await Promise.all([
        apiService.getBusinessHours(),
        apiService.getAbsenceMessage(),
        requestApiEndpoint<any>("/api/flows").catch(() => []),
      ]);

      if (hoursRes) {
        setOpeningHour(hoursRes.openTime);
        setClosingHour(hoursRes.closeTime);
        setTimezone(hoursRes.timezone);
        setOutsideHoursAutoReply(hoursRes.autoReplyOutsideHours);
      }

      if (absenceRes) {
        setAbsenceMessage(absenceRes.message);
      }

      const list = Array.isArray(flowsPayload)
        ? flowsPayload
        : flowsPayload && typeof flowsPayload === "object" && Array.isArray(flowsPayload.data)
        ? flowsPayload.data
        : [];

      const normalized: FlowItem[] = list
        .filter((item: any) => Boolean(item && typeof item === "object"))
        .map((item: any, idx: number) => ({
          id: String(item.id ?? item.flowId ?? `flow-${idx}`),
          name: String(item.name ?? item.title ?? `Fluxo ${idx + 1}`),
          trigger: String(item.trigger ?? item.keyword ?? ""),
          response: String(item.response ?? item.reply ?? ""),
          nextSteps: Array.isArray(item.nextSteps) ? item.nextSteps.map(String) : [],
          active: item.active !== false,
        }));

      setFlows(normalized);
    } catch (err) {
      console.error("[FlowsTab] Error loading flows:", err);
    } finally {
      setLoadingFlows(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Save Business Hours
  const handleSaveHours = async () => {
    setIsSavingHours(true);
    try {
      await Promise.all([
        apiService.saveBusinessHours({
          openTime: openingHour,
          closeTime: closingHour,
          timezone,
          autoReplyOutsideHours: outsideHoursAutoReply,
        }),
        apiService.saveAbsenceMessage({ enabled: outsideHoursAutoReply, message: absenceMessage }),
      ]);

      toast({
        title: "Regras de atendimento salvas!",
        description: "Os horários de expediente e a resposta de ausência foram atualizados.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar horários",
        description: err?.message || "Não foi possível gravar as regras de atendimento.",
        variant: "destructive",
      });
    } finally {
      setIsSavingHours(false);
    }
  };

  // Open Create Flow Modal
  const handleOpenCreateModal = () => {
    setEditingId(null);
    setFlowDraft({
      name: "",
      trigger: "",
      response: "",
      nextSteps: "",
    });
    setIsDialogOpen(true);
  };

  // Open Edit Flow Modal
  const handleOpenEditModal = (flow: FlowItem) => {
    setEditingId(flow.id);
    setFlowDraft({
      name: flow.name,
      trigger: flow.trigger,
      response: flow.response,
      nextSteps: flow.nextSteps ? flow.nextSteps.join(", ") : "",
    });
    setIsDialogOpen(true);
  };

  // Save or Update Flow
  const handleSaveFlow = async () => {
    if (!flowDraft.trigger.trim() || !flowDraft.response.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a palavra-chave gatilho e a mensagem de resposta.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingFlow(true);
    const payload = {
      id: editingId || `flow-${Date.now()}`,
      name: flowDraft.name.trim() || `Fluxo ${flowDraft.trigger.trim()}`,
      trigger: flowDraft.trigger.trim(),
      response: flowDraft.response.trim(),
      nextSteps: flowDraft.nextSteps
        ? flowDraft.nextSteps.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    };

    try {
      if (editingId) {
        await requestApiEndpoint(`/api/flows/${encodeURIComponent(editingId)}`, "PUT", payload);
        setFlows((prev) => prev.map((f) => (f.id === editingId ? { ...f, ...payload } : f)));
        toast({ title: "Fluxo atualizado com sucesso!" });
      } else {
        await requestApiEndpoint("/api/flows", "POST", payload);
        setFlows((prev) => [payload, ...prev]);
        toast({ title: "Novo fluxo cadastrado com sucesso!" });
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Erro ao salvar fluxo",
        description: err?.message || "Falha ao comunicar com o servidor.",
        variant: "destructive",
      });
    } finally {
      setIsSavingFlow(false);
    }
  };

  // Delete Flow
  const handleDeleteFlow = async (flowId: string) => {
    try {
      await requestApiEndpoint(`/api/flows/${encodeURIComponent(flowId)}`, "DELETE");
      setFlows((prev) => prev.filter((f) => f.id !== flowId));
      toast({ title: "Fluxo excluído com sucesso." });
    } catch (err: any) {
      toast({
        title: "Erro ao excluir fluxo",
        description: err?.message || "Não foi possível remover o fluxo.",
        variant: "destructive",
      });
    }
  };

  // Toggle Playbook
  const handleTogglePlaybook = (id: string) => {
    setPlaybooks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
    toast({ title: "Status do Playbook atualizado." });
  };

  const showAll = activeSub === "todos";
  const showKnowledge = showAll || activeSub === "knowledge";
  const showPlaybooks = showAll || activeSub === "playbooks";
  const showFlows = showAll || activeSub === "flows";
  const showHours = showAll || activeSub === "hours";

  return (
    <div className="space-y-6">
      {/* SUB-NAVIGATION PILLS */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl border border-border/60 bg-muted/20">
        <button
          type="button"
          onClick={() => setSubTab("todos")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            activeSub === "todos"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Visão Completa
        </button>
        <button
          type="button"
          onClick={() => setSubTab("knowledge")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            activeSub === "knowledge"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Conhecimento Oficial</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("playbooks")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            activeSub === "playbooks"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
          <span>Playbooks de Negociação</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("flows")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            activeSub === "flows"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
          <span>Fluxos de Conversa</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("hours")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            activeSub === "hours"
              ? "bg-card text-foreground shadow-xs border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="h-3.5 w-3.5 text-emerald-400" />
          <span>Horário de Atendimento</span>
        </button>
      </div>

      {/* SECTION: OFFICIAL KNOWLEDGE MANAGER */}
      {showKnowledge && (
        <div className="space-y-2">
          <OfficialKnowledgeManager />
        </div>
      )}

      {/* SECTION: PLAYBOOK MANAGER (ADVANCED VISUAL EDITOR) */}
      {showPlaybooks && (
        <div className="space-y-2">
          <PlaybookManager />
        </div>
      )}

      {/* SECTION 1: BUSINESS HOURS & OUTSIDE HOURS RULES */}
      {showHours && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Clock className="h-5 w-5 text-emerald-400" /> Horário de Atendimento & Resposta de Ausência
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Defina quando o robô responde normalmente e o que dizer fora do horário comercial.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Resposta fora de horário:</span>
                <Switch
                  checked={outsideHoursAutoReply}
                  onCheckedChange={setOutsideHoursAutoReply}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Horário de Início</label>
                <Input
                  type="time"
                  value={openingHour}
                  onChange={(e) => setOpeningHour(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Horário de Encerramento</label>
                <Input
                  type="time"
                  value={closingHour}
                  onChange={(e) => setClosingHour(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Fuso Horário</label>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="America/Sao_Paulo"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Mensagem Automática Fora do Horário
              </label>
              <Textarea
                value={absenceMessage}
                onChange={(e) => setAbsenceMessage(e.target.value)}
                rows={3}
                placeholder="Digite a mensagem enviada a clientes que entrarem em contato à noite ou finais de semana..."
                className="text-xs leading-relaxed bg-muted/20 border-border/70"
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                onClick={handleSaveHours}
                disabled={isSavingHours}
                size="sm"
                className="h-9 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5"
              >
                {isSavingHours ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {isSavingHours ? "Salvando..." : "Salvar Regras de Horário"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: CONVERSATION FLOWS & AUTOMATIC TRIGGERS */}
      {showFlows && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <GitBranch className="h-5 w-5 text-emerald-400" /> Fluxos de Conversa & Gatilhos Comerciais
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Responda automaticamente a palavras-chave estratégicas com respostas pré-formatadas.
                </CardDescription>
              </div>

              <Button
                type="button"
                onClick={handleOpenCreateModal}
                size="sm"
                className="h-9 text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" /> Novo Fluxo
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            {loadingFlows ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
                <span className="text-xs">Carregando fluxos de automação...</span>
              </div>
            ) : flows.length === 0 ? (
              <div className="py-10 text-center space-y-3 border border-dashed border-border/60 rounded-xl bg-muted/10">
                <Zap className="h-8 w-8 mx-auto text-muted-foreground/60" />
                <div>
                  <p className="text-xs font-semibold text-foreground">Nenhum fluxo cadastrado</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Crie respostas automáticas para termos comuns como "preço", "catálogo", "pix", etc.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCreateModal}
                  className="h-8 text-xs gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Criar Primeiro Fluxo
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {flows.map((flow) => (
                  <div
                    key={flow.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-emerald-500/40 transition-all space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate">{flow.name}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5 font-mono"
                          >
                            <Tag className="h-2.5 w-2.5 mr-1" /> {flow.trigger}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(flow)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFlow(flow.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/20 p-2 rounded-lg border border-border/40 font-normal">
                      {flow.response}
                    </p>

                    {flow.nextSteps && flow.nextSteps.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <ArrowRight className="h-3 w-3 text-emerald-400" />
                        <span>Próximas etapas: {flow.nextSteps.join(", ")}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 3: SALES & SERVICE PLAYBOOKS (LEGACY QUICK VIEW CARDS) */}
      {showPlaybooks && (
        <Card className="bg-card border-border/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <BookOpen className="h-5 w-5 text-emerald-400" /> Playbooks de Negociação & Respostas Rápidas
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Roteiros comerciais pré-programados para contornar objeções e acelerar conversões.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {playbooks.map((pb) => (
                <div
                  key={pb.id}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all space-y-2.5",
                    pb.active
                      ? "border-emerald-500/40 bg-card shadow-xs"
                      : "border-border/60 bg-muted/10 opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground">
                        {pb.category}
                      </Badge>
                      <h4 className="text-xs font-bold text-foreground mt-1">{pb.title}</h4>
                    </div>
                    <Switch
                      checked={pb.active}
                      onCheckedChange={() => handleTogglePlaybook(pb.id)}
                    />
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Gatilhos:</span> {pb.trigger}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/20 p-2 rounded-lg border border-border/40 font-normal">
                    "{pb.script}"
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CREATE / EDIT FLOW DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingId ? "Editar Fluxo de Conversa" : "Criar Novo Fluxo de Conversa"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Quando o cliente mandar mensagem contendo a palavra-chave, esta resposta será disparada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Nome Identificador</label>
              <Input
                value={flowDraft.name}
                onChange={(e) => setFlowDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Tabela de Preços, Endereço da Loja"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Palavra-chave Gatilho (Trigger)
              </label>
              <Input
                value={flowDraft.trigger}
                onChange={(e) => setFlowDraft((prev) => ({ ...prev, trigger: e.target.value }))}
                placeholder="Ex: preco, orcamento, valor, catalogo"
                className="h-9 text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block">
                Pode ser uma palavra ou termos separados por vírgula.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Mensagem de Resposta</label>
              <Textarea
                value={flowDraft.response}
                onChange={(e) => setFlowDraft((prev) => ({ ...prev, response: e.target.value }))}
                rows={4}
                placeholder="Digite a resposta enviada ao cliente..."
                className="text-xs leading-relaxed bg-muted/20 border-border/70"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Próximas Etapas / Tags Sugeridas (Opcional)
              </label>
              <Input
                value={flowDraft.nextSteps}
                onChange={(e) => setFlowDraft((prev) => ({ ...prev, nextSteps: e.target.value }))}
                placeholder="Ex: enviar_pix, pedir_cep, agendar"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveFlow}
              disabled={isSavingFlow}
              size="sm"
              className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-semibold gap-1.5"
            >
              {isSavingFlow ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isSavingFlow ? "Salvando..." : editingId ? "Atualizar Fluxo" : "Criar Fluxo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
