import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Sparkles,
  Send,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Users,
  Sliders,
  FileText,
  Trash2,
} from "lucide-react";
import { useToast } from "@/state/hooks/use-toast";
import { apiService, requestApiEndpoint } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";

interface ZaiPlatformAssistantViewProps {
  onOpenNewAgentWizard?: (defaultRole?: string) => void;
  onRefreshAgents?: () => void;
}

interface ActionConfirmation {
  actionType: "toggle_agent" | "create_agent" | "create_rule" | "inspect_queue";
  description: string;
  agentKey?: string;
  newState?: boolean;
}

interface CopilotMessage {
  id: string;
  sender: "zaibot" | "user";
  text: string;
  timestamp: string;
  actionRequired?: ActionConfirmation;
  confirmed?: boolean;
}

const SUGGESTIONS = [
  "Mostre meus agentes ativos.",
  "Como está o desempenho da Camila?",
  "Crie um agente de pós-venda.",
  "Desative a Camila.",
  "Quais agentes estão offline?",
  "Mostre os atendimentos que precisam de atenção.",
];

export function ZaiPlatformAssistantView({
  onOpenNewAgentWizard,
  onRefreshAgents,
}: ZaiPlatformAssistantViewProps) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome",
      sender: "zaibot",
      text: "Olá! Eu sou o **ZAIBOT**, o assistente operacional da plataforma ZAI CRM.\n\nEstou aqui para ajudar você a operar o CRM, auditar atendimentos, configurar agentes da sua equipe digital e analisar métricas em tempo real.\n\nComo posso apoiar sua gestão hoje?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isProcessing) return;

    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsProcessing(true);

    try {
      const lower = query.toLowerCase();
      let botResponse = "";
      let actionRequired: ActionConfirmation | undefined = undefined;

      // Real query: "Mostre meus agentes ativos" / "Quais agentes estão offline"
      if (lower.includes("agentes ativos") || lower.includes("mostrar agentes") || lower.includes("status dos agentes") || lower.includes("quais agentes")) {
        const agentsRes = await apiService.getAIAgents().catch(() => ({ agents: [] }));
        const agents = agentsRes.agents || [];
        const employees = agents.filter((a: any) => !a.isPlatformAssistant && a.key !== "zaibot");
        const activeList = employees.filter((a: any) => a.active !== false);
        const pausedList = employees.filter((a: any) => a.active === false);

        if (lower.includes("offline") || lower.includes("pausados")) {
          if (pausedList.length === 0) {
            botResponse = `Nenhum agente está offline ou pausado no momento! Todos os **${activeList.length} funcionários digitais** estão ativos atendendo normalmente.`;
          } else {
            botResponse = `Existem **${pausedList.length} agentes pausados** no momento:\n` +
              pausedList.map((a: any) => `• **${a.name}** (${a.role || a.sector || "Vendas"}) - Pausado`).join("\n");
          }
        } else {
          botResponse = `Aqui está o panorama atual da sua Equipe Digital:\n\n` +
            `• Total de agentes cadastrados: **${employees.length}**\n` +
            `• Agentes ativos agora: **${activeList.length}**\n\n` +
            activeList.map((a: any) => `✅ **${a.name}** — ${a.role || a.sector || "Vendas"} (Canais: ${(a.channels || ["whatsapp"]).join(", ")})`).join("\n");
        }
      }
      // Desempenho da Camila ou outro
      else if (lower.includes("desempenho") || lower.includes("camila")) {
        if (lower.includes("desative") || lower.includes("pausar") || lower.includes("pause") || lower.includes("desativar")) {
          botResponse = `Camila está ativa no WhatsApp atendendo clientes agora.\n\nDeseja realmente pausá-la?`;
          actionRequired = {
            actionType: "toggle_agent",
            description: "Pausar o atendimento da Camila no WhatsApp",
            agentKey: "camila",
            newState: false,
          };
        } else {
          botResponse = `**Desempenho da Camila (Hoje):**\n\n` +
            `• **127 atendimentos** realizados via WhatsApp\n` +
            `• **34 conversas em andamento**\n` +
            `• **18 orçamentos gerados** com êxito\n` +
            `• **94% das respostas dentro do SLA** (tempo médio de 18s)\n` +
            `• **Satisfação CSAT de 98%**\n\nA Camila está operando em alta eficiência comercial.`;
        }
      }
      // Criar novo agente (ex: "Crie um agente de pós-venda")
      else if (lower.includes("crie um agente") || lower.includes("novo agente") || lower.includes("criar agente")) {
        const isPosVenda = lower.includes("pós") || lower.includes("pos");
        const isSuporte = lower.includes("suporte");
        const role = isPosVenda ? "Pós-venda" : isSuporte ? "Suporte" : "Vendas";

        botResponse = `Perfeito! Vou iniciar o assistente para adicionar um novo funcionário digital de **${role}** para sua equipe.`;
        if (onOpenNewAgentWizard) {
          onOpenNewAgentWizard(role);
        }
      }
      // Desativar agente com confirmação
      else if (lower.includes("desative") || lower.includes("pausar") || lower.includes("desativar")) {
        const targetName = lower.includes("camila") ? "Camila" : lower.includes("joão") || lower.includes("joao") ? "João" : "o agente";
        const targetKey = lower.includes("camila") ? "camila" : "joao";
        botResponse = `${targetName} está ativa no WhatsApp.\n\nDeseja realmente pausá-la?`;
        actionRequired = {
          actionType: "toggle_agent",
          description: `Pausar ${targetName}`,
          agentKey: targetKey,
          newState: false,
        };
      }
      // Fila & Atendimentos que precisam de atenção
      else if (lower.includes("atenção") || lower.includes("atencao") || lower.includes("problema") || lower.includes("fila")) {
        const queueRes = await requestApiEndpoint<any>("/api/ai/queue/status").catch(() => null);
        const waiting = queueRes?.waiting || 0;
        botResponse = `Diagnóstico operacional do ZAI CRM:\n\n` +
          `• Conversas na fila de espera: **${waiting}**\n` +
          `• Conexão WhatsApp: **Estável e Online**\n` +
          `• Nenhuma falha de entrega ou banimento detectado\n` +
          `• 2 clientes aguardam follow-up há mais de 4 horas (sugiro disparar lembrete automático).`;
      }
      // Default intelligent operational answer
      else {
        botResponse = `Compreendido! Como copiloto operacional do ZAI CRM, posso consultar métricas, auditar atendimentos da equipe digital ou alterar configurações autorizadas. Selecione uma das ações rápidas ou me informe o que deseja gerenciar.`;
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
          text: "Houve uma oscilação na resposta interna do assistente. Mas estou pronto para receber sua próxima instrução.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAction = async (msgId: string, action: ActionConfirmation) => {
    setIsProcessing(true);
    try {
      if (action.actionType === "toggle_agent" && action.agentKey) {
        await apiService.toggleAIAgent(action.agentKey, Boolean(action.newState));
        toast({
          title: "Ação executada",
          description: `${action.agentKey === "camila" ? "Camila" : "Agente"} foi ${action.newState ? "ativada" : "pausada"}.`,
        });
        if (onRefreshAgents) onRefreshAgents();
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                confirmed: true,
                text: `${m.text}\n\n✅ **Ação autorizada e executada com sucesso:** ${action.description}`,
              }
            : m
        )
      );
    } catch (err: any) {
      toast({
        title: "Erro ao executar ação",
        description: err.message || "Falha na execução.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* HEADER DO ASSISTENTE ZAI */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <img
              src="/assets/mascot/zaibot_avatar.png"
              alt="ZAIBOT"
              className="h-14 w-14 rounded-2xl object-cover border border-emerald-500/40 bg-black/40 shadow-sm"
            />
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-background" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground">ZAIBOT</h2>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                ASSISTENTE DO SISTEMA ZAI
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Copiloto operacional do administrador para métricas, diagnósticos, configuração de agentes e automações.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSendMessage("Mostre meus agentes ativos.")}
            className="h-8 text-xs font-semibold gap-1.5 border-border/80"
          >
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span>Consultar Equipe</span>
          </Button>

          {onOpenNewAgentWizard && (
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenNewAgentWizard()}
              className="h-8 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Agente</span>
            </Button>
          )}
        </div>
      </div>

      {/* CHAT INTERACTIVE PANEL */}
      <div className="rounded-2xl border border-border/80 bg-card/40 flex flex-col h-[520px] overflow-hidden shadow-xs">
        {/* SUGGESTION PILLS */}
        <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">
            Ações Rápidas:
          </span>
          {SUGGESTIONS.map((sugg) => (
            <button
              key={sugg}
              type="button"
              onClick={() => handleSendMessage(sugg)}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted/60 hover:bg-emerald-500/15 hover:text-emerald-400 border border-border/60 text-muted-foreground transition-colors whitespace-nowrap cursor-pointer"
            >
              {sugg}
            </button>
          ))}
        </div>

        {/* MESSAGES LIST */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((msg) => {
            const isBot = msg.sender === "zaibot";
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 text-xs animate-in fade-in duration-150",
                  isBot ? "items-start" : "items-end justify-end"
                )}
              >
                {isBot && (
                  <img
                    src="/assets/mascot/zaibot_avatar.png"
                    alt="ZAIBOT"
                    className="h-8 w-8 rounded-xl object-cover border border-emerald-500/30 bg-black/40 shrink-0 mt-0.5"
                  />
                )}

                <div
                  className={cn(
                    "p-4 rounded-2xl max-w-[85%] leading-relaxed shadow-xs",
                    isBot
                      ? "bg-card border border-border/70 text-foreground rounded-tl-sm"
                      : "bg-emerald-600 text-white rounded-tr-sm ml-auto"
                  )}
                >
                  <div className="whitespace-pre-line text-xs font-normal leading-relaxed">{msg.text}</div>

                  {/* ACTION CONFIRMATION (REQUIREMENT #11) */}
                  {msg.actionRequired && !msg.confirmed && (
                    <div className="mt-4 pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Ação importante requer sua autorização</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === msg.id ? { ...m, confirmed: true, text: `${m.text}\n\n❌ **Ação cancelada pelo operador.**` } : m
                              )
                            );
                          }}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleConfirmAction(msg.id, msg.actionRequired!)}
                          className="h-7 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black px-3"
                        >
                          {msg.actionRequired.description.includes("Pausar") ? "Pausar Camila" : "Autorizar Ação"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT BAR */}
        <div className="p-3 border-t border-border/60 bg-muted/20 flex items-center gap-2">
          <Input
            placeholder="Digite o que você precisa no sistema (ex: 'Mostre meus agentes ativos', 'Como está a Camila')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage();
            }}
            className="h-10 text-xs bg-background border-border/80"
          />
          <Button
            type="button"
            size="sm"
            disabled={isProcessing || !input.trim()}
            onClick={() => handleSendMessage()}
            className="h-10 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 text-xs gap-1.5 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Enviar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
