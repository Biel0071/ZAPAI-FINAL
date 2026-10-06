import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ShieldCheck, Loader2 } from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";

interface ZaiPlatformAssistantViewProps {
  onOpenNewAgentWizard?: (defaultRole?: string) => void;
  onRefreshAgents?: () => void | Promise<void>;
}

interface CopilotMessage {
  id: number;
  sender: "zaibot" | "user";
  text: string;
  link?: { to: string; label: string };
  action?: { agentKey: string; agentName: string; active: boolean };
  confirmed?: boolean;
  error?: string;
}

const SUGGESTIONS = [
  "Como estão os atendimentos hoje?",
  "Quantos leads foram qualificados?",
  "Qual atendente está ativo?",
  "Como está a fila do WhatsApp?",
  "Ver desempenho dos agentes",
  "Status das conexões WhatsApp",
  "Lojas e horários",
  "Mostrar atendentes",
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function ZaiPlatformAssistantView({ onOpenNewAgentWizard, onRefreshAgents }: ZaiPlatformAssistantViewProps) {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const processing = useRef(false);
  const nextId = useRef(1);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    { id: 0, sender: "zaibot", text: "Olá! Sou o ZAIBOT, seu copiloto da operação WhatsApp.\nPosso consultar atendentes, conexões, lojas, fila e uso de IA. Como posso ajudar agora?" },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const handleSendMessage = async (suggestion?: string) => {
    const query = (suggestion || input).trim();
    if (!query || processing.current) return;
    processing.current = true;
    setIsProcessing(true);
    setInput("");
    setMessages((current) => [...current, { id: nextId.current++, sender: "user", text: query }]);
    const answer: CopilotMessage = { id: nextId.current++, sender: "zaibot", text: "" };
    try {
      const lower = normalize(query);
      if (/paus|desativ|deslig|ativar|ative/.test(lower)) {
        const response = await apiService.getAIAgents();
        if (response.success === false) throw new Error("Consulta de atendentes indisponível.");
        const agents = (response.agents || []).filter((agent: any) => !agent.isPlatformAssistant && agent.key !== "zaibot");
        const words = lower.split(/[^a-z0-9]+/).filter(Boolean);
        const matches = agents.filter((agent: any) => [agent.name, agent.key].filter(Boolean).some((name) => {
          const nameWords = normalize(String(name)).split(/[^a-z0-9]+/).filter(Boolean);
          return nameWords.length > 0 && nameWords.every((word) => words.includes(word));
        }));
        if (matches.length !== 1) {
          answer.text = "Informe o nome completo de um atendente para ativar ou pausar. Disponíveis: " + (agents.map((agent: any) => agent.name).join(", ") || "nenhum cadastrado");
        } else {
          const agent = matches[0];
          const active = !/paus|desativ|deslig/.test(lower);
          if (active && !agent.sessionIds?.length) {
            answer.text = `Vincule um WhatsApp a ${agent.name} antes de ativar o atendimento.`;
            answer.link = { to: "/attendants", label: "Vincular WhatsApp" };
          } else {
            answer.text = `${active ? "Ativar" : "Pausar"} ${agent.name}? A alteração será salva na configuração do atendente.`;
            answer.action = { agentKey: agent.key, agentName: agent.name, active };
          }
        }
      } else if (/cria|novo/.test(lower) && /agente|atendente/.test(lower)) {
        answer.text = "Use o cadastro para revisar a identidade e o WhatsApp do novo atendente.";
        onOpenNewAgentWizard?.(/pos.venda/.test(lower) ? "Pós-venda" : undefined);
      } else if (/follow|automacao|orcamento/.test(lower)) {
        answer.text = "Configure e revise o fluxo na área de automações.";
        answer.link = { to: "/ai?tab=flows", label: "Abrir automações" };
      } else if (/cliente|sem resposta|nao receberam|conversa/.test(lower)) {
        answer.text = "Consulte as conversas e acompanhe os clientes pelo Inbox.";
        answer.link = { to: "/inbox", label: "Abrir Inbox" };
      } else if (/tarefa|pendente/.test(lower)) {
        answer.text = "Consulte as pendências registradas na operação.";
        answer.link = { to: "/ai?tab=operations", label: "Abrir operação" };
      } else if (/perda|venda perdida|analise/.test(lower)) {
        answer.text = "Consulte os indicadores registrados no dashboard.";
        answer.link = { to: "/dashboard?tab=analytics", label: "Abrir indicadores" };
      } else if (/atendimento.*hoje|hoje.*atendimento|quantos.*lead|lead/.test(lower)) {
        const response = await apiService.getAIMetrics();
        const metrics = response.data || response;
        answer.text = `Resumo da operação hoje:\n• Mensagens enviadas pela IA: ${metrics.messagesToday ?? 0}\n• Tokens consumidos: ${metrics.tokensToday ?? 0}\n• Operação ativa e respondendo em tempo real.`;
        answer.link = { to: "/ai?tab=operations", label: "Ver operação detalhada" };
      } else if (/desempenho|metrica|uso/.test(lower)) {
        const response = await apiService.getAIMetrics();
        const metrics = response.data || response;
        answer.text = `Uso de IA hoje: ${metrics.messagesToday ?? "não informado"} respostas • ${metrics.tokensToday ?? "não informado"} tokens.`;
        answer.link = { to: "/ai?tab=operations", label: "Ver operação" };
      } else if (/fila|atencao|alerta/.test(lower)) {
        answer.text = "Acompanhe e revise os itens da fila na operação.";
        answer.link = { to: "/settings?tab=queue", label: "Abrir fila" };
      } else if (/conex|whatsapp|offline/.test(lower)) {
        const connections = await apiService.getConnections({ throwOnError: true });
        answer.text = connections.length
          ? connections.map((session: any) => `${session.sessionName || session.name || session.sessionId}: ${session.status || "estado indisponível"}`).join("\n")
          : "Nenhuma conexão disponível nesta consulta.";
        answer.link = { to: "/connections", label: "Abrir conexões" };
      } else if (/loja|horario/.test(lower)) {
        const response = await apiService.getStores();
        if (response.success === false) throw new Error("Consulta de lojas indisponível.");
        answer.text = response.stores.length
          ? response.stores.map((store: any) => `${store.name} • ${store.numbers?.length ?? 0} WhatsApps vinculados`).join("\n")
          : "Nenhuma loja cadastrada.";
        answer.link = { to: "/attendants?section=business", label: "Dados comerciais do WhatsApp" };
      } else if (/agente|atendente|status|ativo/.test(lower)) {
        const response = await apiService.getAIAgents();
        if (response.success === false) throw new Error("Consulta de atendentes indisponível.");
        const agents = (response.agents || []).filter((agent: any) => !agent.isPlatformAssistant && agent.key !== "zaibot");
        answer.text = agents.length ? agents.map((agent: any) => `${agent.name} • ${agent.active === false ? "pausado" : "habilitado"} • ${agent.sessionIds?.length ?? 0} WhatsApps`).join("\n") : "Nenhum atendente cadastrado.";
        answer.link = { to: "/attendants", label: "Ver atendentes" };
      } else {
        answer.text = "Posso consultar atendentes, lojas, conexões, fila e uso de IA. Escolha uma pergunta sugerida acima ou informe o nome do atendente que deseja ativar ou pausar.";
      }
    } catch (error) {
      answer.text = `Não foi possível consultar: ${error instanceof Error ? error.message : "serviço indisponível"}. Tente novamente.`;
    } finally {
      setMessages((current) => [...current, answer].slice(-60));
      processing.current = false;
      setIsProcessing(false);
    }
  };

  const confirmAction = async (message: CopilotMessage) => {
    if (!message.action || processing.current) return;
    processing.current = true;
    setIsProcessing(true);
    try {
      const result = await apiService.toggleAIAgent(message.action.agentKey, message.action.active);
      if (result.success === false) throw new Error("O serviço não salvou a alteração.");
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, confirmed: true, error: undefined, text: `${message.action!.agentName}: ${message.action!.active ? "habilitado" : "pausado"}. Alteração salva.` } : item));
      await onRefreshAgents?.();
    } catch (error) {
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, error: error instanceof Error ? error.message : "Não foi possível salvar." } : item));
    } finally {
      processing.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card: ZAIBOT Mascot Avatar, Name and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-background to-background">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src="/assets/mascot/zaibot_avatar.png"
              alt="ZAIBOT"
              className="h-14 w-14 rounded-2xl border-2 border-emerald-500/50 object-cover bg-background shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            />
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-background" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-display text-foreground">ZAIBOT</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                Copiloto ZAI
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Atendentes, lojas e operação do sistema WhatsApp.</p>
          </div>
        </div>
      </div>

      {/* Interactive Chat Console with Suggestions */}
      <div className="rounded-2xl border border-border/70 bg-card/40 flex flex-col h-[min(580px,70vh)] min-h-[380px] overflow-hidden">
        {/* Suggested Questions Row */}
        <div className="p-2.5 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <span className="text-[11px] font-semibold text-emerald-400">Perguntas Padrão & Sugeridas:</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isProcessing}
                onClick={() => void handleSendMessage(suggestion)}
                className="shrink-0 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground hover:bg-emerald-500/15 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4" role="log" aria-label="Conversa com assistente">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex gap-2.5", message.sender === "user" && "justify-end")}>
              {message.sender === "zaibot" && (
                <img
                  src="/assets/mascot/zaibot_avatar.png"
                  alt="ZAIBOT"
                  className="h-7 w-7 rounded-full border border-emerald-500/40 object-cover shrink-0 mt-0.5 shadow-xs"
                />
              )}
              <div className={cn("rounded-2xl p-3 max-w-[90%] text-sm whitespace-pre-line", message.sender === "user" ? "bg-emerald-600 text-white" : "border border-border/60 bg-card")}>
                {message.text}
                {message.link && <Link to={message.link.to} className="block mt-2 text-emerald-400 font-medium hover:underline">{message.link.label}</Link>}
                {message.action && !message.confirmed && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Revisar alteração</p>
                    {message.error && <p role="alert" className="text-xs text-amber-400">{message.error}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" disabled={isProcessing} onClick={() => setMessages(current => current.map(item => item.id === message.id ? { ...item, confirmed: true, text: "Alteração cancelada.", error: undefined } : item))}>Cancelar</Button>
                      <Button size="sm" disabled={isProcessing} onClick={() => void confirmAction(message)} className="bg-emerald-600 hover:bg-emerald-500">{message.action.active ? "Ativar" : "Pausar"} {message.action.agentName}</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isProcessing && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-emerald-400" />Consultando o sistema…</p>}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void handleSendMessage(); }} className="flex gap-2 p-3 border-t border-border/60 bg-card/60">
          <Input aria-label="Mensagem para o assistente" placeholder="Consulte a operação ou informe o nome de um atendente…" value={input} onChange={event => setInput(event.target.value)} disabled={isProcessing} className="min-w-0" />
          <Button type="submit" disabled={isProcessing || !input.trim()} className="bg-emerald-600 hover:bg-emerald-500 text-white"><Send className="h-4 w-4 mr-2" />Enviar</Button>
        </form>
      </div>
    </div>
  );
}
