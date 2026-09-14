import { useState, useRef, useEffect } from "react";
import { Sparkle, X, PaperPlaneTilt, PencilSimple } from "@phosphor-icons/react";
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
  const instructionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => instructionRef.current?.focus(), 60);
    }
  }, [open]);

  const recentMessages = messages
    .slice(-10)
    .map((m) => ({
      role: m.fromMe ? "assistant" : "user",
      content: m.content || m.caption || "",
    }))
    .filter((m) => m.content.trim().length > 0);

  const handleGenerate = async () => {
    if (!instruction.trim()) return;
    setLoading(true);
    setError(null);
    setGenerated(null);

    try {
      const res = await apiService.aiCompose({
        conversationId: selectedConversation.id,
        contactName: selectedConversation.contactName,
        instruction: instruction.trim(),
        recentMessages,
        sessionId: selectedConversation.sessionId || undefined,
      });

      if (res?.message) {
        setGenerated(res.message);
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

  const handleEdit = () => {
    if (!generated) return;
    setMessageInput(generated);
    messageInputRef.current?.focus();
    handleClose();
  };

  const handleSend = async () => {
    if (!generated || sendingMessage) return;
    try {
      setSendingMessage(true);
      await handleSendMessage(generated);
      handleClose();
    } catch (err) {
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
      {/* Panel — floats above composer using absolute positioning */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-40 mb-2 mx-auto max-w-3xl rounded-xl border border-emerald-500/30 bg-[#181d26]/98 shadow-2xl backdrop-blur-xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkle className="h-3.5 w-3.5" weight="fill" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground leading-tight flex items-center gap-1.5">
                  Assistente ZAI
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </h4>
                <span className="text-[10px] text-muted-foreground">Copiloto do atendimento</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Fechar assistente"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="px-3.5 py-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Contexto: conversa com <strong className="text-foreground">{selectedConversation.contactName || "Cliente"}</strong></span>
              <span className="text-[10px] text-emerald-400 font-medium">Modo Copiloto</span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              O que você quer responder ao cliente?
            </p>

            <textarea
              ref={instructionRef}
              rows={2}
              placeholder="Ex: fala que conseguimos entregar amanha e pergunta manha ou tarde"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !loading) {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
              disabled={loading}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 scrollbar-none text-foreground"
            />

            {generated && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <p className="text-[10px] font-semibold text-emerald-400 mb-1">Resposta gerada:</p>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {generated}
                </p>
              </div>
            )}

            {error && (
              <p className="text-[11px] text-destructive">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              {generated ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-3 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={handleEdit}
                  >
                    <PencilSimple className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-3 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => void handleSend()}
                    disabled={sendingMessage}
                  >
                    {sendingMessage ? (
                      <>
                        <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <PaperPlaneTilt className="h-3.5 w-3.5" weight="fill" />
                        Enviar
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-[11px] gap-1.5"
                    onClick={() => { setGenerated(null); setError(null); }}
                    disabled={loading}
                  >
                    <Sparkle className="h-3.5 w-3.5" />
                    Gerar novamente
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-[11px] gap-1.5",
                    loading
                      ? "bg-emerald-600/60 text-white cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                  onClick={() => void handleGenerate()}
                  disabled={loading || !instruction.trim()}
                >
                  {loading ? (
                    <>
                      <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Gerando resposta...
                    </>
                  ) : (
                    <>
                      <Sparkle className="h-3.5 w-3.5" weight="fill" />
                      Melhorar e Enviar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trigger button — inline in the composer toolbar */}
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
        aria-label={open ? "Fechar Assistente ZAI" : "Abrir Assistente ZAI"}
        disabled={disabled}
        title="Assistente ZAI"
      >
        <Sparkle className="h-5 w-5" weight={open ? "fill" : "regular"} />
      </Button>
    </>
  );
}
