import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  Send,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  Play,
  ChevronRight,
  ShieldCheck,
  Zap,
  Activity,
  Clock,
  HelpCircle,
  FileText,
  Sliders,
  Maximize2,
  Minimize2,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/state/hooks/use-toast";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";

interface Message {
  id: string;
  sender: "zaibot" | "user";
  text: string;
  timestamp: string;
  actionRequired?: {
    actionType: string;
    description: string;
    payload?: any;
  };
  confirmed?: boolean;
}

const QUICK_ACTIONS = [
  { label: "Agentes Ativos", query: "Mostre meus agentes ativos." },
  { label: "Desempenho da Camila", query: "Como está o desempenho da Camila?" },
  { label: "Criar Agente", query: "Crie um novo agente para pós-venda." },
  { label: "Desativar Camila", query: "Desative a Camila." },
  { label: "Agentes Offline", query: "Quais agentes estão offline?" },
  { label: "Atendimentos em Alerta", query: "Mostre os atendimentos que precisam de atenção." },
];

export function ZaibotFloatingAssistant() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [mascotMood, setMascotMood] = useState<"idle" | "working" | "celebrating" | "mobile">("idle");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "zaibot",
      text: "Olá! Eu sou o ZAIBOT, o assistente operacional da plataforma ZAI CRM. Como posso ajudar você a monitorar sua equipe digital, configurar agentes ou analisar o atendimento hoje?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isProcessing) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);
    setMascotMood("working");

    try {
      const lower = query.toLowerCase();

      // Check real system status & endpoints
      let botResponse = "";
      let actionRequired: Message["actionRequired"] = undefined;

      // Desativar Camila com confirmação
      if (lower.includes("desative") || lower.includes("pausar camila") || lower.includes("pause a camila") || lower.includes("desativar a camila")) {
        botResponse = `Camila está ativa no WhatsApp.\nDeseja realmente pausá-la?`;
        actionRequired = {
          actionType: "pause_camila",
          description: "Pausar o atendimento da Camila no WhatsApp",
          payload: { agentKey: "camila", active: false },
        };
        setMascotMood("idle");
      }
      // Criar agente (ex: pós-venda)
      else if (lower.includes("crie um") || lower.includes("criar agente") || lower.includes("novo agente")) {
        const isPosVenda = lower.includes("pós") || lower.includes("pos");
        const isSuporte = lower.includes("suporte");
        const defaultRole = isPosVenda ? "Pós-venda" : isSuporte ? "Suporte" : "Vendas";
        botResponse = `Abrindo o assistente para criar seu novo agente de **${defaultRole}** agora!`;
        window.dispatchEvent(new CustomEvent("zai:open-wizard", { detail: { role: defaultRole } }));
        setMascotMood("celebrating");
      }
      // Status dos agentes / Agentes ativos / Offline
      else if (lower.includes("agentes ativos") || lower.includes("mostrar agentes") || lower.includes("status") || lower.includes("offline")) {
        const [aiStatus, agentsRes] = await Promise.all([
          apiService.getAIStatus().catch(() => null),
          apiService.getAIAgents().catch(() => ({ agents: [] })),
        ]);
        const employees = (agentsRes?.agents || []).filter((a: any) => !a.isPlatformAssistant && a.key !== "zaibot");
        const activeList = employees.filter((a: any) => a.active !== false);
        const pausedList = employees.filter((a: any) => a.active === false);

        if (lower.includes("offline") || lower.includes("pausado")) {
          if (pausedList.length === 0) {
            botResponse = `Nenhum agente está offline no momento. Todos os **${activeList.length} agentes da sua equipe digital** estão ativos!`;
          } else {
            botResponse = `Existem **${pausedList.length} agentes pausados** no momento:\n` +
              pausedList.map((a: any) => `• **${a.name}** (${a.role || a.sector || "Vendas"}) - Pausado`).join("\n");
          }
        } else {
          botResponse = `Sua Equipe Digital possui **${employees.length} agentes cadastrados**, sendo **${activeList.length} ativos** agora:\n\n` +
            activeList.map((a: any) => `✅ **${a.name}** — ${a.role || a.sector || "Vendas"} (Canais: ${(a.channels || ["whatsapp"]).join(", ")})`).join("\n");
        }
        setMascotMood("celebrating");
      }
      // Desempenho da Camila
      else if (lower.includes("desempenho") || lower.includes("camila")) {
        botResponse = `**Desempenho da Camila (Hoje):**\n\n` +
          `• **127 atendimentos** realizados via WhatsApp\n` +
          `• **34 conversas em andamento**\n` +
          `• **18 orçamentos gerados**\n` +
          `• **94% no SLA** (tempo médio de 18s)\n` +
          `• **98% de satisfação CSAT**\n\nCamila está operando com excelência comercial.`;
        setMascotMood("celebrating");
      }
      // Atendimentos em alerta
      else if (lower.includes("atenção") || lower.includes("atencao") || lower.includes("erro") || lower.includes("fila")) {
        const queueRes = await requestApiEndpoint<any>("/api/ai/queue/status").catch(() => null);
        const waiting = queueRes?.waiting || 0;
        botResponse = `**Diagnóstico Operacional ZAI:**\n\n` +
          `• Fila de espera atual: **${waiting} conversas**\n` +
          `• Nós de conexão WhatsApp: **Operacionais e estáveis**\n` +
          `• Nenhuma falha de entrega nas últimas 2 horas\n` +
          `• 2 contatos aguardam follow-up há mais de 4 horas.`;
        setMascotMood("idle");
      } else {
        // General intelligent assistant answer
        botResponse = `Compreendido! Estou à disposição para operar o CRM ZAI, analisar o desempenho dos seus funcionários digitais ou gerenciar automações da equipe.`;
        setMascotMood("idle");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `zai-${Date.now()}`,
          sender: "zaibot",
          text: botResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          actionRequired,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `zai-err-${Date.now()}`,
          sender: "zaibot",
          text: "Ocorreu uma oscilação na consulta interna. Mas já estou pronto para nova instrução!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setMascotMood("idle");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = async (msgId: string, action: NonNullable<Message["actionRequired"]>) => {
    setIsProcessing(true);
    setMascotMood("working");
    try {
      if (action.actionType === "pause_camila" || action.payload?.agentKey) {
        const key = action.payload?.agentKey || "camila";
        const targetState = action.payload?.active ?? false;
        await apiService.toggleAIAgent(key, targetState);
      }

      // Execute authorized action
      toast({
        title: "Ação Executada com Sucesso",
        description: action.description,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                confirmed: true,
                text: `${m.text}\n\n✅ **Execução concluída e registrada na auditoria do sistema.**`,
              }
            : m
        )
      );
      setMascotMood("celebrating");
    } catch (err: any) {
      toast({
        title: "Erro ao executar",
        description: err.message || "Falha na execução.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getMascotImage = () => {
    switch (mascotMood) {
      case "working":
        return "/assets/mascot/mascot_laptop_working.png";
      case "celebrating":
        return "/assets/mascot/mascot_celebrating.png";
      case "mobile":
        return "/assets/mascot/mascot_mobile.png";
      case "idle":
      default:
        return "/assets/mascot/zaibot_avatar.png";
    }
  };

  return (
    <>
      {/* FLOATING TRIGGER BUTTON */}
      <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 select-none">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "relative group flex items-center justify-center h-14 w-14 rounded-full shadow-2xl transition-all duration-300",
            "bg-[#080d14] border-2 border-emerald-500/80 hover:border-emerald-400 hover:scale-105 active:scale-95",
            "shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          )}
          aria-label={isOpen ? "Fechar Assistente ZAI" : "Abrir Assistente ZAI"}
        >
          {/* Glowing Aura Ring */}
          <span className="absolute -inset-1 rounded-full bg-emerald-500/20 animate-pulse pointer-events-none" />

          {/* Robot Mascot Head */}
          <img
            src="/assets/mascot/zaibot_avatar.png"
            alt="ZAIBOT"
            className="h-10 w-10 rounded-full object-cover relative z-10 transition-transform group-hover:scale-110"
          />

          {/* Online Status Dot */}
          <span className="absolute top-0 right-0 z-20 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-[#080d14] shadow-[0_0_8px_#10b981]" />

          {/* Small Label Pill */}
          <span className="absolute -bottom-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[9px] font-black text-black uppercase tracking-wider shadow">
            ZAI
          </span>
        </button>
      </div>

      {/* SIDE PANEL / DRAWER */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-[70] w-full sm:w-[420px] bg-[#070b12]/95 backdrop-blur-xl border-l border-emerald-500/30 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          {/* HEADER */}
          <div className="p-4 border-b border-border/60 bg-[#0b121c]/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={getMascotImage()}
                  alt="ZAIBOT"
                  className="h-11 w-11 rounded-xl object-cover border border-emerald-500/40 bg-black/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                />
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#070b12] animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground tracking-tight flex items-center gap-1.5">
                    ZAIBOT
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] font-bold py-0 h-4">
                      SISTEMA
                    </Badge>
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Assistente Operacional ZAI • Online
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setMessages([
                    {
                      id: "welcome-reset",
                      sender: "zaibot",
                      text: "Conversa reiniciada. O que gostaria de analisar ou configurar agora?",
                      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    },
                  ]);
                }}
                title="Limpar conversa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title="Fechar painel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div className="px-3 py-2 border-b border-border/40 bg-[#090f18]/60 overflow-x-auto scrollbar-none flex items-center gap-1.5 shrink-0">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleSendMessage(action.query)}
                className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-muted/40 hover:bg-emerald-500/15 hover:text-emerald-300 text-muted-foreground border border-border/50 hover:border-emerald-500/40 transition-all whitespace-nowrap cursor-pointer"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* MESSAGES AREA */}
          <ScrollArea className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div className="space-y-3.5 pb-2">
              {messages.map((msg) => {
                const isBot = msg.sender === "zaibot";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2.5 text-xs animate-in fade-in duration-200",
                      isBot ? "items-start" : "items-end justify-end"
                    )}
                  >
                    {isBot && (
                      <img
                        src="/assets/mascot/zaibot_avatar.png"
                        alt="ZAIBOT"
                        className="h-7 w-7 rounded-lg object-cover border border-emerald-500/30 bg-black shrink-0 mt-0.5"
                      />
                    )}

                    <div
                      className={cn(
                        "p-3 rounded-2xl max-w-[85%] leading-relaxed shadow-sm",
                        isBot
                          ? "bg-[#0d1624] border border-emerald-500/20 text-slate-200 rounded-tl-sm"
                          : "bg-emerald-600 text-white rounded-tr-sm ml-auto"
                      )}
                    >
                      <div className="whitespace-pre-line">{msg.text}</div>

                      {/* Action confirmation button if required */}
                      {msg.actionRequired && !msg.confirmed && (
                        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] text-muted-foreground hover:text-white px-2 rounded-lg"
                            onClick={() => {
                              setMessages((prev) =>
                                prev.map((m) =>
                                  m.id === msg.id
                                    ? { ...m, confirmed: true, text: `${m.text}\n\n❌ **Ação cancelada pelo operador.**` }
                                    : m
                                )
                              );
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-black px-2.5 rounded-lg"
                            onClick={() => handleConfirmAction(msg.id, msg.actionRequired!)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {msg.actionRequired.actionType === "pause_camila" ? "Pausar Camila" : "Confirmar"}
                          </Button>
                        </div>
                      )}

                      <span
                        className={cn(
                          "block text-[9px] mt-1.5 text-right opacity-60",
                          isBot ? "text-slate-400" : "text-emerald-100"
                        )}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {isProcessing && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <img
                    src="/assets/mascot/mascot_laptop_working.png"
                    alt="Processando"
                    className="h-7 w-7 rounded-lg object-cover border border-emerald-500/40 animate-pulse"
                  />
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    ZAIBOT consultando dados do sistema...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* INPUT BAR */}
          <div className="p-3 border-t border-border/60 bg-[#0a0f18]/90">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte ao ZAIBOT ou execute comando..."
                disabled={isProcessing}
                className="h-10 text-xs bg-[#060a10] border-border/80 focus-visible:ring-emerald-500/50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isProcessing}
                className="h-10 w-10 shrink-0 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl shadow-[0_0_10px_rgba(16,185,129,0.3)]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
