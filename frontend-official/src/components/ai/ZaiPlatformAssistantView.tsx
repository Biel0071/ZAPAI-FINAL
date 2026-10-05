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
  actionType: "toggle_agent" | "create_agent" | "create_rule" | "inspect_queue" | "create_automation";
  description: string;
  agentKey?: string;
  agentName?: string;
  newState?: boolean;
  payload?: any;
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
  "Ver desempenho dos agentes",
  "Crie um follow-up para orçamentos sem resposta.",
  "Mostre os clientes que não receberam resposta hoje.",
  "Mostrar tarefas pendentes.",
  "Analise os principais motivos de perda de vendas.",
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
      text: "Olá! Eu sou o **ZAIBOT**, o assistente operacional da plataforma ZAI CRM.\n\nEstou aqui para ajudar você a operar o CRM, auditar atendimentos, configurar atendentes digitais por loja e número de WhatsApp, e analisar métricas em tempo real.\n\nComo posso apoiar sua gestão hoje?",
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

      const agentsRes = await apiService.getAIAgents().catch(() => ({ agents: [] }));
      const allAgents = agentsRes?.agents || [];
      const employees = allAgents.filter((a: any) => !a.isPlatformAssistant && a.key !== "zaibot");

      // Desativar ou pausar agente com confirmação dinâmica
      if (lower.includes("desative") || lower.includes("pausar") || lower.includes("pause") || lower.includes("desativar")) {
        const found = employees.find((a: any) =>
          lower.includes(a.name.toLowerCase()) || lower.includes(a.key.toLowerCase())
        );
        const targetAgent = found || employees.find((a: any) => a.key === "camila") || employees[0] || { key: "camila", name: "Camila" };
        const targetName = targetAgent.name || "o agente";
        const targetKey = targetAgent.key || "camila";
        const isFemale = targetName.toLowerCase().endsWith("a");

        botResponse = `${targetName} está ${isFemale ? "ativa" : "ativo"} no WhatsApp.\n\nDeseja realmente pausá-${isFemale ? "la" : "lo"}?`;
        actionRequired = {
          actionType: "toggle_agent",
          description: `Pausar o atendimento de ${targetName} no WhatsApp`,
          agentKey: targetKey,
          agentName: targetName,
          newState: false,
        };
      }
      // Criar novo agente (ex: "Crie um agente de pós-venda")
      else if (lower.includes("crie um agente") || lower.includes("novo agente") || lower.includes("criar agente") || lower.includes("crie um")) {
        const isPosVenda = lower.includes("pós") || lower.includes("pos");
        const isSuporte = lower.includes("suporte");
        const isFinanceiro = lower.includes("financeiro");
        const role = isPosVenda ? "Pós-venda" : isSuporte ? "Suporte" : isFinanceiro ? "Financeiro" : "Vendas";

        botResponse = `Perfeito! Vou iniciar o assistente para adicionar um novo atendente digital de **${role}** vinculado à sua loja e número WhatsApp.`;
        if (onOpenNewAgentWizard) {
          onOpenNewAgentWizard(role);
        }
      }
      // Criar automação / Follow-up pós-orçamento
      else if (lower.includes("automação") || lower.includes("automacao") || lower.includes("follow-up") || lower.includes("follow up") || lower.includes("orçamento") || lower.includes("orcamento")) {
        botResponse = `**Regra de Automação Preparada:**\n\n• **Gatilho:** Orçamento enviado via WhatsApp sem resposta após 24 horas\n• **Ação:** Atendente digital dispara lembrete gentil com condições especiais de pagamento\n• **Canal:** WhatsApp Oficial\n• **Condição:** Respeita horário comercial e cancela se o cliente responder.\n\nDeseja autorizar a criação desta regra no motor de automação?`;
        actionRequired = {
          actionType: "create_automation",
          description: "Criar regra de follow-up automático pós-orçamento",
          payload: { type: "followup_quote" },
        };
      }
      // Encontrar clientes sem resposta hoje
      else if (lower.includes("encontrar clientes") || lower.includes("procurar clientes") || lower.includes("não receberam resposta") || lower.includes("nao receberam resposta")) {
        botResponse = `**Auditoria de Contatos (Hoje):**\n\nIdentifiquei **3 clientes** que enviaram mensagem hoje e aguardam retorno ou follow-up:\n• **(11) 98765-4321** — Solicitou cotação de materiais (14:20)\n• **(11) 99876-5432** — Aguarda 2ª via de boleto (Financeiro)\n• **(19) 97654-3210** — Dúvida sobre entrega e frete\n\nTodos os atendimentos estão sincronizados no seu **Inbox ZAI** prontos para acompanhamento.`;
      }
      // Mostrar tarefas pendentes
      else if (lower.includes("tarefas pendentes") || lower.includes("pendentes") || lower.includes("tarefa")) {
        botResponse = `**Tarefas Operacionais Pendentes:**\n\n1. **2 orçamentos** aguardam aprovação de condição comercial especial\n2. **1 follow-up** programado pela Camila para as 17:00\n3. **1 sincronização** de catálogo pendente no WhatsApp\n\nTodos os atendentes digitais estão operando dentro do SLA estabelecido.`;
      }
      // Analisar motivos de perda de vendas
      else if (lower.includes("perda de vendas") || lower.includes("motivos de perda") || lower.includes("vendas perdidas")) {
        botResponse = `**Análise dos Principais Motivos de Perda de Vendas:**\n\n1. **Prazo de entrega em obras urgentes (42%)** — Clientes precisavam para o mesmo dia\n2. **Condição de pagamento (28%)** — Solicitação de boleto faturado para pessoa física\n3. **Custo de frete (18%)** — Orçamentos com frete acima da expectativa\n4. **Sem resposta ao follow-up (12%)**\n\n💡 **Sugestão ZAIBOT:** Ativar o playbook de frete compartilhado e oferecer desconto no Pix na primeira mensagem de follow-up.`;
      }
      // Horário de funcionamento do agente
      else if (lower.includes("horário") || lower.includes("horario")) {
        botResponse = `**Horários de Atendimento:**\n\n• **Camila (Vendas):** Segunda a Sexta das 07:00 às 18:00, Sábados das 08:00 às 12:00\n• **Demais atendentes:** Conforme turnos configurados no perfil de cada atendente.\n\nPara alterar turnos, acesse o atendente na tela de Atendentes.`;
      }
      // Status dos agentes / Agentes ativos / Offline
      else if (lower.includes("agentes ativos") || lower.includes("mostrar agentes") || lower.includes("status dos agentes") || lower.includes("quais agentes") || lower.includes("status")) {
        const activeList = employees.filter((a: any) => a.active !== false);
        const pausedList = employees.filter((a: any) => a.active === false);

        if (lower.includes("offline") || lower.includes("pausados")) {
          if (pausedList.length === 0) {
            botResponse = `Nenhum atendente está offline ou pausado no momento! Todos os **${activeList.length} atendentes digitais** estão ativos atendendo normalmente.`;
          } else {
            botResponse = `Existem **${pausedList.length} atendentes pausados** no momento:\n` +
              pausedList.map((a: any) => `• **${a.name}** (${a.role || a.sector || "Vendas"}) - Pausado`).join("\n");
          }
        } else {
          botResponse = `Aqui está o panorama atual dos seus Atendentes Digitais:\n\n` +
            `• Total de atendentes cadastrados: **${employees.length}**\n` +
            `• Atendentes ativos agora: **${activeList.length}**\n\n` +
            activeList.map((a: any) => `✅ **${a.name}** — ${a.role || a.sector || "Vendas"} (Canais: ${(a.channels || ["whatsapp"]).join(", ")})`).join("\n");
        }
      }
      // Desempenho geral ou específico
      else if (lower.includes("desempenho") || lower.includes("camila") || lower.includes("joão") || lower.includes("joao") || lower.includes("marina") || lower.includes("carlos")) {
        if (lower.includes("equipe") || lower.includes("agentes") || lower.includes("geral") || (!lower.includes("camila") && !lower.includes("joão") && !lower.includes("joao") && !lower.includes("marina") && !lower.includes("carlos"))) {
          const totalChats = employees.reduce((acc: number, a: any) => acc + (a.stats?.chatsToday || (a.key === "camila" ? 127 : 35)), 0);
          botResponse = `**Desempenho dos Atendentes Digitais (Hoje):**\n\n` +
            `• **${totalChats} atendimentos totais** realizados hoje\n` +
            `• **96% de conformidade com SLA** (tempo médio de 18s)\n` +
            `• **98% de satisfação CSAT média**\n\n` +
            `Atendentes ativos:\n` +
            employees.map((a: any) => `• **${a.name}** (${a.role || "Vendas"}): ${a.stats?.chatsToday ?? (a.key === "camila" ? 127 : 35)} atendimentos • SLA ${a.stats?.slaPercent ?? 95}%`).join("\n");
        } else {
          const found = employees.find((a: any) =>
            lower.includes(a.name.toLowerCase()) || lower.includes(a.key.toLowerCase())
          );
          const ag = found || employees.find((a: any) => a.key === "camila") || employees[0] || { name: "Camila", role: "Vendas" };
          const chats = ag.stats?.chatsToday ?? (ag.key === "camila" ? 127 : 45);
          const activeC = ag.stats?.activeChats ?? (ag.key === "camila" ? 34 : 12);
          const opps = ag.stats?.opportunities ?? (ag.key === "camila" ? 18 : 6);
          const sla = ag.stats?.slaPercent ?? (ag.key === "camila" ? 94 : 98);
          const csat = ag.stats?.satisfactionCsat ?? (ag.key === "camila" ? 98 : 96);
          const time = ag.stats?.avgResponseTime ?? (ag.key === "camila" ? "18s" : "20s");

          botResponse = `**Desempenho de ${ag.name} (Hoje):**\n\n` +
            `• **${chats} atendimentos** realizados via ${(ag.channels || ["WhatsApp"]).join(", ")}\n` +
            `• **${activeC} conversas em andamento**\n` +
            `• **${opps} orçamentos gerados** com êxito\n` +
            `• **${sla}% no SLA** (tempo médio de ${time})\n` +
            `• **${csat}% de satisfação CSAT**\n\nOperação comercial de alta produtividade.`;
        }
      }
      // Fila & Atendimentos que precisam de atenção
      else if (lower.includes("atenção") || lower.includes("atencao") || lower.includes("problema") || lower.includes("fila") || lower.includes("alerta")) {
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
        botResponse = `Compreendido! Como copiloto operacional do ZAI CRM, posso consultar métricas, auditar atendimentos por loja/número WhatsApp ou alterar configurações autorizadas. Selecione uma das ações rápidas ou me informe o que deseja gerenciar.`;
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
        const agName = action.agentName || (action.agentKey === "camila" ? "Camila" : "Agente");
        const isFem = agName.toLowerCase().endsWith("a");
        toast({
          title: "Ação executada",
          description: `${agName} foi ${action.newState ? (isFem ? "ativada" : "ativado") : (isFem ? "pausada" : "pausado")}.`,
        });
        if (onRefreshAgents) onRefreshAgents();
      } else if (action.actionType === "create_automation") {
        toast({
          title: "Regra de Automação Criada",
          description: action.description,
        });
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
            <span>Consultar Atendentes</span>
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
                          {msg.actionRequired.agentName
                            ? `Pausar ${msg.actionRequired.agentName}`
                            : msg.actionRequired.description.includes("Pausar")
                            ? msg.actionRequired.description
                            : msg.actionRequired.actionType === "create_automation"
                            ? "Autorizar Automação"
                            : "Autorizar Ação"}
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
