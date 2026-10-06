import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Briefcase,
  CheckCircle2,
  Clock,
  Activity,
  Award,
  BookOpen,
  Sliders,
  Smartphone,
  ShieldCheck,
  Send,
  Play,
  Pause,
  MessageSquare,
  Sparkles,
  Bot,
  DollarSign,
  Heart,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/state/hooks/use-toast";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";
import { getAgentStatusBadge, getEmployeeAvatar } from "./DigitalTeamView";

interface AgentProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: any;
  onUpdated?: () => void;
  onOpenCustomizer?: (agent: any) => void;
}

export function AgentProfileModal({
  open,
  onOpenChange,
  agent,
  onUpdated,
  onOpenCustomizer,
}: AgentProfileModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "performance" | "knowledge" | "settings" | "test">("overview");
  const [isActive, setIsActive] = useState(agent?.active !== false);
  const [isToggling, setIsToggling] = useState(false);

  // Quick sandbox chat state
  const [testInput, setTestInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "agent"; text: string; time: string }>>([
    {
      role: "agent",
      text: `Olá! Sou ${agent?.name || "o agente"}, atendendo por ${agent?.role || agent?.sector || "Vendas"}. Como posso te orientar hoje?`,
      time: "Agora",
    },
  ]);
  const [isReplying, setIsReplying] = useState(false);
  const [testError, setTestError] = useState("");

  useEffect(() => {
    if (agent) {
      setIsActive(agent.active !== false);
      setTestError("");
      setChatMessages([
        {
          role: "agent",
          text: `Olá! Sou ${agent.name || "o agente"}, atendendo por ${agent.role || agent.sector || "Vendas"}. Como posso te orientar hoje?`,
          time: "Agora",
        },
      ]);
    }
  }, [agent]);

  if (!agent) return null;

  const handleToggleActive = async () => {
    const nextState = !isActive;
    if (nextState && !agent.sessionIds?.length) {
      toast({ title: "Vincule um WhatsApp antes de ativar", variant: "destructive" });
      return;
    }
    setIsToggling(true);
    try {
      await apiService.toggleAIAgent(agent.key, nextState);
      setIsActive(nextState);
      toast({
        title: nextState ? "Agente Ativado" : "Agente Pausado",
        description: `${agent.name} agora está ${nextState ? "ativo(a)" : "pausado(a)"} no atendimento.`,
      });
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar status",
        description: err?.message || "Não foi possível alternar o status do agente.",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testInput.trim() || isReplying) return;
    const userText = testInput.trim();
    setTestInput("");
    setChatMessages((prev) => [
      ...prev,
      { role: "user", text: userText, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    ]);
    setIsReplying(true);
    setTestError("");

    try {
      const res = await apiService.testAIMessage({
        prompt: agent.personality || "",
        message: userText,
        agentKey: agent.key,
        agentName: agent.name,
        sessionId: agent.sessionIds?.[0],
        history: chatMessages.map(message => ({ role: message.role === "agent" ? "assistant" : "user", content: message.text })),
      });
      if (!res.result?.ok || !res.result.response) {
        throw new Error(res.result?.error || res.error || "O provedor não retornou uma resposta.");
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: res.result.response,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Não foi possível testar o agente.");
    } finally {
      setIsReplying(false);
    }
  };

  // Metrics
  const chatsToday = agent.stats?.chatsToday ?? "—";
  const activeChats = agent.stats?.activeChats ?? "—";
  const opportunities = agent.stats?.opportunities ?? "—";
  const percentage = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
  const slaPercent = percentage(agent.stats?.slaPercent);
  const avgResponseTime = agent.stats?.avgResponseTime ?? "—";
  const satisfactionCsat = percentage(agent.stats?.satisfactionCsat);
  const conversionRate = percentage(agent.stats?.conversionRate);
  const autonomousRate = percentage(agent.stats?.autonomousRate);
  const formatPercentage = (value: number | null) => value === null ? "—" : `${value}%`;

  // Activities
  const recentActivities = Array.isArray(agent.recentActivity)
    ? agent.recentActivity
    : [];

  const channelsList = Array.isArray(agent.channels) && agent.channels.length > 0
    ? agent.channels
    : agent.sessionIds?.length ? ["whatsapp"] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-border/80 bg-background text-foreground shadow-2xl">
        {/* HEADER DO AGENTE */}
        <div className="p-6 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={getEmployeeAvatar(agent)}
              alt={agent.name}
              className="h-16 w-16 rounded-2xl object-cover border border-border/80 bg-black/40 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2.5">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">{agent.name}</DialogTitle>
                {(() => {
                  const statusInfo = getAgentStatusBadge({
                    ...agent,
                    active: isActive,
                    status: isActive ? (agent.status === "paused" ? "active" : agent.status || "active") : "paused",
                  });
                  return (
                    <Badge
                      className={cn(
                        "text-[10px] font-semibold py-0.5 px-2",
                        statusInfo.className
                      )}
                    >
                      {statusInfo.label}
                    </Badge>
                  );
                })()}
                {agent.isPlatformAssistant && (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 font-bold">
                    ASSISTENTE ZAI
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                {agent.role || agent.sector || "Assistente de Atendimento"}
              </DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                {channelsList.map((ch: string) => (
                  <span
                    key={ch}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted/40 border border-border/60 text-foreground/80"
                  >
                    <Smartphone className="h-3 w-3 text-emerald-400" />
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isToggling || (!isActive && !agent.sessionIds?.length)}
              title={!isActive && !agent.sessionIds?.length ? "Vincule um WhatsApp antes de ativar o atendimento." : undefined}
              onClick={handleToggleActive}
              className={cn(
                "h-9 text-xs font-semibold gap-1.5",
                isActive
                  ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              )}
            >
              {isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isActive ? "Pausar Atendimento" : "Ativar Atendimento"}</span>
            </Button>

            {onOpenCustomizer && (
              <Button
                type="button"
                size="sm"
                onClick={() => onOpenCustomizer(agent)}
                className="h-9 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 shadow-xs"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Configurar</span>
              </Button>
            )}
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="px-6 pt-3 border-b border-border/60 bg-muted/5">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-2 text-xs font-semibold">
            {[
              { id: "overview", label: "Visão Geral (Hoje)" },
              { id: "activity", label: "Atividade" },
              { id: "performance", label: "Desempenho" },
              { id: "knowledge", label: "Conhecimento" },
              { id: "settings", label: "Configurações" },
              { id: "test", label: "Conversar (Sandbox)" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap",
                  activeTab === t.id
                    ? "bg-emerald-500/15 text-emerald-400 font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-6">
          {/* TAB 1: VISÃO GERAL (HOJE) */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-border/70 bg-card/60">
                  <span className="text-[11px] text-muted-foreground font-medium">Atendimentos Hoje</span>
                  <div className="text-2xl font-bold text-foreground mt-1">{chatsToday}</div>
                </div>
                <div className="p-4 rounded-xl border border-border/70 bg-card/60">
                  <span className="text-[11px] text-muted-foreground font-medium">Em Andamento</span>
                  <div className="text-2xl font-bold text-foreground mt-1">{activeChats}</div>
                  <span className="text-[10px] text-muted-foreground mt-1 inline-block">conversas ativas</span>
                </div>
                <div className="p-4 rounded-xl border border-border/70 bg-card/60">
                  <span className="text-[11px] text-muted-foreground font-medium">Oportunidades</span>
                  <div className="text-2xl font-bold text-foreground mt-1">{opportunities}</div>
                  <span className="text-[10px] text-emerald-400 font-semibold mt-1 inline-block">orçamentos gerados</span>
                </div>
                <div className="p-4 rounded-xl border border-border/70 bg-card/60">
                  <span className="text-[11px] text-muted-foreground font-medium">SLA de Resposta</span>
                  <div className="text-2xl font-bold text-foreground mt-1">{formatPercentage(slaPercent)}</div>
                  <span className="text-[10px] text-muted-foreground mt-1 inline-block">respostas dentro da meta</span>
                </div>
              </div>

              {/* IDENTIDADE E OBJETIVO */}
              <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Identidade do Funcionário</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium">Função:</span>
                    <p className="font-semibold text-foreground mt-0.5">{agent.role || agent.sector || "Vendas"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Personalidade:</span>
                    <p className="font-semibold text-foreground mt-0.5 capitalize">{agent.personalityType || agent.tone || "Não informado"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground font-medium">Objetivo Operacional:</span>
                    <p className="text-foreground mt-0.5 leading-relaxed">{agent.objective || "Não informado"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ATIVIDADE */}
          {activeTab === "activity" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Linha do Tempo de Atividades Recentes</h4>
              </div>

              <div className="space-y-2.5">
                {!recentActivities.length && <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>}
                {recentActivities.map((act: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-start gap-3 text-xs"
                  >
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-muted text-muted-foreground shrink-0 mt-0.5">
                      {act.time}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{act.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DESEMPENHO */}
          {activeTab === "performance" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Tempo Médio de Resposta</span>
                    <span className="font-bold text-foreground">{avgResponseTime}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Satisfação do Cliente (CSAT)</span>
                    <span className="font-bold text-emerald-400">{formatPercentage(satisfactionCsat)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${satisfactionCsat ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Baseado em avaliações e resoluções automáticas</span>
                </div>

                <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Taxa de Conversão</span>
                    <span className="font-bold text-foreground">{formatPercentage(conversionRate)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${conversionRate ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Clientes que fecharam pedido após atendimento</span>
                </div>

                <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Atendimentos Sem Intervenção</span>
                    <span className="font-bold text-emerald-400">{formatPercentage(autonomousRate)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${autonomousRate ?? 0}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Resolvidos 100% pelo agente digital</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONHECIMENTO */}
          {activeTab === "knowledge" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Instruções do agente</h4>
              <div className="p-4 rounded-xl border border-border/60 bg-muted/20 text-xs leading-relaxed whitespace-pre-wrap">
                {agent.personality || "Nenhuma instrução cadastrada."}
              </div>
            </div>
          )}

          {/* TAB 5: CONFIGURAÇÕES OPERACIONAIS */}
          {activeTab === "settings" && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/15 space-y-3">
                <h4 className="font-bold text-foreground">Horário de Funcionamento</h4>
                <p className="text-muted-foreground">
                  {agent.hours || (agent.schedule?.horarioInicio && agent.schedule?.horarioFim ? `${agent.schedule.horarioInicio} às ${agent.schedule.horarioFim}` : "Horário não informado.")}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-muted/15 space-y-3">
                <h4 className="font-bold text-foreground">Permissões de Atendimento</h4>
                <p className="text-muted-foreground">As ações permitidas seguem as configurações e instruções salvas para este agente.</p>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-muted/15 space-y-2">
                <h4 className="font-bold text-foreground">Escalada Humana & Transferência</h4>
                <p className="text-muted-foreground">
                  Quando o cliente solicitar contato com um especialista humano ou o agente identificar um caso complexo, o atendimento é automaticamente sinalizado no Inbox.
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: CONVERSAR (SANDBOX) */}
          {activeTab === "test" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {testError && <p role="alert" className="text-xs text-destructive">{testError}</p>}
              <div className="h-64 rounded-xl border border-border/60 bg-muted/20 p-4 overflow-y-auto space-y-3 text-xs flex flex-col">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-2xl max-w-[80%] leading-relaxed",
                      msg.role === "agent"
                        ? "bg-card border border-border/60 text-foreground self-start rounded-tl-sm"
                        : "bg-emerald-600 text-white self-end rounded-tr-sm"
                    )}
                  >
                    <div className="text-[10px] opacity-75 font-semibold mb-1">
                      {msg.role === "agent" ? agent.name : "Você"} • {msg.time}
                    </div>
                    <div>{msg.text}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder={`Envie uma mensagem de teste para ${agent.name}...`}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendTestMessage();
                  }}
                  className="h-10 text-xs bg-muted/30 border-border/80"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isReplying || !testInput.trim()}
                  onClick={handleSendTestMessage}
                  className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 text-xs gap-1.5 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Enviar</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
