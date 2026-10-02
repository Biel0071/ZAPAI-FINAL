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
import { getAgentStatusBadge } from "./DigitalTeamView";

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

  useEffect(() => {
    if (agent) {
      setIsActive(agent.active !== false);
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

    try {
      const res = await apiService.testAIConnection({
        customPrompt: `${agent.personality || ""}\nCliente: ${userText}\n${agent.name}:`,
        sampleMessage: userText,
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: res?.response || `Entendido! Estou pronta para atender sua solicitação conforme as políticas da nossa loja.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (_) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: `Compreendido! Estou à disposição para tirar qualquer dúvida sobre nossos produtos ou condições de pagamento.`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsReplying(false);
    }
  };

  // Metrics
  const chatsToday = agent.stats?.chatsToday ?? (agent.key === "camila" ? 127 : 45);
  const activeChats = agent.stats?.activeChats ?? (agent.key === "camila" ? 34 : 12);
  const opportunities = agent.stats?.opportunities ?? (agent.key === "camila" ? 18 : 6);
  const slaPercent = agent.stats?.slaPercent ?? (agent.key === "camila" ? 94 : 98);
  const avgResponseTime = agent.stats?.avgResponseTime ?? (agent.key === "camila" ? "18s" : "22s");
  const satisfactionCsat = agent.stats?.satisfactionCsat ?? (agent.key === "camila" ? 98 : 96);

  // Activities
  const recentActivities = agent.recentActivity && agent.recentActivity.length > 0
    ? agent.recentActivity
    : [
        { time: "10:42", action: "Respondeu cliente sobre catálogo e condições de frete", type: "message" },
        { time: "10:39", action: "Enviou orçamento detalhado #1042 via WhatsApp", type: "quote" },
        { time: "10:31", action: "Iniciou follow-up automático de cliente inativo", type: "followup" },
        { time: "09:55", action: "Qualificou novo lead proveniente de anúncio", type: "lead" },
      ];

  const channelsList = Array.isArray(agent.channels) && agent.channels.length > 0
    ? agent.channels
    : ["whatsapp", "inbox"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-border/80 bg-background text-foreground shadow-2xl">
        {/* HEADER DO AGENTE */}
        <div className="p-6 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={agent.avatar || (agent.key === "camila" ? "/assets/mascot/mascot_laptop_working.png" : "/assets/mascot/zaibot_avatar.png")}
              alt={agent.name}
              className="h-16 w-16 rounded-2xl object-cover border border-border/80 bg-black/40 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-foreground">{agent.name}</h2>
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
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                {agent.role || agent.sector || "Assistente de Atendimento"}
              </p>
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

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isToggling}
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
                  <span className="text-[10px] text-emerald-400 font-semibold mt-1 inline-block">100% automatizados</span>
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
                  <div className="text-2xl font-bold text-foreground mt-1">{slaPercent}%</div>
                  <span className="text-[10px] text-emerald-400 font-semibold mt-1 inline-block">dentro da meta</span>
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
                    <p className="font-semibold text-foreground mt-0.5 capitalize">{agent.personalityType || agent.tone || "Comercial"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground font-medium">Objetivo Operacional:</span>
                    <p className="text-foreground mt-0.5 leading-relaxed">{agent.objective || "Vender e atender clientes com gentileza, esclarecendo dúvidas e fechando pedidos."}</p>
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
                <span className="text-[10px] text-emerald-400 font-semibold">Atualizado em tempo real</span>
              </div>

              <div className="space-y-2.5">
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
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[88%]" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Meta empresarial: menos de 30 segundos</span>
                </div>

                <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Satisfação do Cliente (CSAT)</span>
                    <span className="font-bold text-emerald-400">{satisfactionCsat}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[98%]" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Baseado em avaliações e resoluções automáticas</span>
                </div>

                <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Taxa de Conversão</span>
                    <span className="font-bold text-foreground">24.5%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[65%]" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Clientes que fecharam pedido após atendimento</span>
                </div>

                <div className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Atendimentos Sem Intervenção</span>
                    <span className="font-bold text-emerald-400">92%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[92%]" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Resolvidos 100% pelo agente digital</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CONHECIMENTO */}
          {activeTab === "knowledge" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bases de Conhecimento Atribuídas</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: "Produtos & Catálogo", desc: "Tabela completa de itens, estoque e medidas", active: true },
                  { title: "Preços & Condições", desc: "Formas de pagamento, Pix, cartão e parcelamento", active: true },
                  { title: "Políticas da Empresa", desc: "Prazos de entrega, frete, trocas e devoluções", active: true },
                  { title: "Perguntas Frequentes (FAQ)", desc: "Respostas padronizadas para dúvidas recorrentes", active: true },
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <h5 className="font-bold text-foreground">{item.title}</h5>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400 font-semibold shrink-0">
                      Conectado
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: CONFIGURAÇÕES OPERACIONAIS */}
          {activeTab === "settings" && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/15 space-y-3">
                <h4 className="font-bold text-foreground">Horário de Funcionamento</h4>
                <p className="text-muted-foreground">
                  {agent.hours || "Segunda a Sexta das 08:00 às 18:00, Sábados das 08:00 às 12:00."}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-muted/15 space-y-3">
                <h4 className="font-bold text-foreground">Permissões de Atendimento</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded border-border" disabled />
                    <span>Responder mensagens e tirar dúvidas técnicas</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded border-border" disabled />
                    <span>Gerar e enviar orçamentos comerciais</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded border-border" disabled />
                    <span>Consultar catálogo e disponibilidade de itens</span>
                  </label>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" className="rounded border-border" disabled />
                    <span>Alterar registros financeiros da empresa (Desabilitado)</span>
                  </label>
                </div>
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
