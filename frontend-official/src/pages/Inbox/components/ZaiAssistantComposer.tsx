import { useState, useRef, useEffect } from "react";
import { Sparkle, X, PaperPlaneTilt, Check, ArrowsClockwise, Lightning, Tag, ChatTeardropDots } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiService } from "@/services/apiService";
import type { ChatMessage, Conversation } from "@/services/apiService";

interface ZaiAssistantComposerProps {
  selectedConversation: Conversation;
  messages: ChatMessage[];
  handleSendMessage: (text?: string) => Promise<void>;
  setMessageInput: React.Dispatch<React.SetStateAction<string>>;
  messageInputRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
}

interface DetectedContext {
  product?: string;
  capacity?: string;
  deliveryCity?: string;
  intent?: string;
  summary?: string;
}

const DEFAULT_SUGGESTIONS = [
  "Enviar foto do produto",
  "Informar preço e condições",
  "Explicar prazo e entrega",
  "Responder sobre formas de pagamento",
];

const ACTION_PILLS = [
  { id: "improve", label: "Melhorar", icon: Sparkle },
  { id: "shorten", label: "Encurtar", icon: Lightning },
  { id: "expand", label: "Expandir", icon: ChatTeardropDots },
  { id: "commercial", label: "Mais comercial", icon: Tag },
  { id: "friendly", label: "Mais amigável", icon: Sparkle },
  { id: "add_delivery", label: "+ Entrega", icon: Lightning },
  { id: "add_price", label: "+ Preço", icon: Tag },
];

export function ZaiAssistantComposer({
  selectedConversation,
  messages,
  handleSendMessage,
  setMessageInput,
  messageInputRef,
  disabled = false,
}: ZaiAssistantComposerProps) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedContext, setDetectedContext] = useState<DetectedContext | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const instructionRef = useRef<HTMLTextAreaElement | null>(null);

  const recentMessages = messages
    .slice(-10)
    .map((m) => ({
      role: m.fromMe ? "assistant" : "user",
      content: m.content || m.caption || "",
    }))
    .filter((m) => m.content.trim().length > 0);

  // Ao abrir o assistente, carregar o contexto detectado da conversa
  useEffect(() => {
    if (!open) return;
    setTimeout(() => instructionRef.current?.focus(), 80);

    let active = true;
    void (async () => {
      try {
        const res = await apiService.aiCompose({
          conversationId: selectedConversation.id,
          contactName: selectedConversation.contactName,
          contactPhone: selectedConversation.contactPhone,
          recentMessages,
          sessionId: selectedConversation.sessionId || undefined,
        });
        if (active && res?.detectedContext) {
          setDetectedContext(res.detectedContext);
          if (res.suggestions?.length) {
            setSuggestions(res.suggestions);
          }
        }
      } catch (_) {
        // Silencioso se der timeout no preload
      }
    })();

    return () => {
      active = false;
    };
  }, [open, selectedConversation.id]);

  const handleGenerateWithAction = async (actionId?: string, explicitInstruction?: string) => {
    setLoading(true);
    setError(null);

    const currentDraft = messageInputRef.current?.value?.trim() || "";
    const effectiveInstruction = explicitInstruction !== undefined ? explicitInstruction : instruction.trim();

    try {
      const res = await apiService.aiCompose({
        conversationId: selectedConversation.id,
        contactName: selectedConversation.contactName,
        contactPhone: selectedConversation.contactPhone,
        currentDraft: currentDraft || undefined,
        action: actionId,
        instruction: effectiveInstruction || undefined,
        recentMessages,
        sessionId: selectedConversation.sessionId || undefined,
      });

      if (res?.message) {
        setGenerated(res.message);
        if (res.detectedContext) setDetectedContext(res.detectedContext);
        if (res.suggestions?.length) setSuggestions(res.suggestions);
      } else {
        setError("A IA não gerou uma resposta. Tente novamente.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar resposta.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseResponse = () => {
    if (!generated) return;
    setMessageInput(generated);
    if (messageInputRef.current) {
      messageInputRef.current.value = generated;
      messageInputRef.current.focus();
    }
    handleClose();
  };

  const handleDirectSend = async () => {
    if (!generated || sendingMessage) return;
    try {
      setSendingMessage(true);
      await handleSendMessage(generated);
      handleClose();
    } catch (_) {
      setError("Erro ao enviar mensagem via WhatsApp.");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setInstruction("");
    setGenerated(null);
    setError(null);
    setLoading(false);
    setSendingMessage(false);
  };

  return (
    <>
      {/* Painel Contextual ancorado sobre o compositor */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-40 mb-2 mx-auto max-w-2xl rounded-xl border border-emerald-500/30 bg-[#161a22]/98 shadow-2xl backdrop-blur-xl animate-fade-in text-foreground overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-muted/40">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                <Sparkle className="h-3.5 w-3.5" weight="fill" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground leading-tight flex items-center gap-1.5">
                  Assistente de Atendimento Contextual
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </h4>
                <span className="text-[10px] text-muted-foreground">Copiloto em tempo real com memória viva</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              aria-label="Fechar assistente"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-3.5 space-y-3">
            {/* Banner de Contexto Detectado */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <span className="font-semibold text-emerald-300 shrink-0">Contexto detectado:</span>
                <span className="truncate text-emerald-100/90">
                  {detectedContext?.product || "Identificando produto..."}
                  {detectedContext?.capacity ? ` (${detectedContext.capacity})` : ""}
                  {detectedContext?.deliveryCity ? ` • ${detectedContext.deliveryCity}` : ""}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded shrink-0">
                {detectedContext?.intent || "Atendimento"}
              </span>
            </div>

            {/* Sugestões Rápidas de Resposta */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Sugestões Rápidas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={loading}
                    onClick={() => void handleGenerateWithAction(undefined, sug)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-border/60 bg-muted/30 hover:bg-emerald-500/15 hover:border-emerald-500/40 text-foreground transition-colors disabled:opacity-50"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Ações Rápidas para transformar texto já digitado */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Ações sobre o texto:
              </span>
              <div className="flex flex-wrap gap-1">
                {ACTION_PILLS.map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      disabled={loading}
                      onClick={() => void handleGenerateWithAction(pill.id)}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-border/50 bg-background/50 hover:bg-primary/10 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      <Icon className="h-2.5 w-2.5 text-primary" />
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo "Como posso melhorar?" */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Instrução livre ou melhoria:</span>
                <span className="text-[10px]">Enter para gerar</span>
              </div>
              <textarea
                ref={instructionRef}
                rows={2}
                placeholder="Ex: responda de forma mais curta / adicione o prazo de entrega / informe o pix com 5% de desconto"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !loading) {
                    e.preventDefault();
                    void handleGenerateWithAction(undefined, instruction.trim());
                  }
                }}
                disabled={loading}
                className="w-full resize-none rounded-lg border border-border/70 bg-background/80 px-3 py-1.5 text-xs placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
              />
            </div>

            {/* Resposta Gerada pela IA */}
            {generated && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkle className="h-3 w-3" weight="fill" /> Sugestão da IA:
                  </span>
                  <span className="text-[10px] text-muted-foreground">Revise antes de enviar</span>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-background/40 p-2.5 rounded-md border border-border/40 font-normal">
                  {generated}
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] gap-1 hover:bg-muted"
                    onClick={() => void handleGenerateWithAction(undefined, instruction.trim())}
                    disabled={loading}
                  >
                    <ArrowsClockwise className="h-3 w-3" />
                    Gerar novamente
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-3 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                    onClick={handleUseResponse}
                  >
                    <Check className="h-3.5 w-3.5" weight="bold" />
                    USAR RESPOSTA
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-3 text-[11px] gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                    onClick={() => void handleDirectSend()}
                    disabled={sendingMessage}
                  >
                    <PaperPlaneTilt className="h-3.5 w-3.5" weight="fill" />
                    {sendingMessage ? "Enviando..." : "Enviar Direto"}
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-[11px] text-destructive">{error}</p>}

            {!generated && (
              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  onClick={() => void handleGenerateWithAction(undefined, instruction.trim())}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Sparkle className="h-3.5 w-3.5" weight="fill" />
                      Gerar Sugestão Contextual
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Botão de disparo do assistente na toolbar do compositor */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-11 min-h-11 shrink-0 transition-colors",
          open
            ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            : "text-muted-foreground hover:text-emerald-400"
        )}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Fechar Assistente Contextual" : "Abrir Assistente Contextual"}
        disabled={disabled}
        title="Assistente Contextual IA"
      >
        <Sparkle className="h-5 w-5" weight={open ? "fill" : "regular"} />
      </Button>
    </>
  );
}
