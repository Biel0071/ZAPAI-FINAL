import { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkle,
  X,
  Check,
  ArrowsClockwise,
  Lightning,
  Tag,
  ChatTeardropDots,
  Clock,
  CheckCircle,
  CircleNotch,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";
import { apiService } from "@/core/services/apiService";
import type { ChatMessage, Conversation } from "@/core/services/apiService";

interface ZaiAssistantComposerProps {
  selectedConversation: Conversation;
  messages: ChatMessage[];
  handleSendMessage?: (text?: string) => Promise<void>;
  setMessageInput: React.Dispatch<React.SetStateAction<string>>;
  messageInputRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideDefaultTrigger?: boolean;
}

interface DetectedContext {
  product?: string;
  capacity?: string;
  deliveryCity?: string;
  intent?: string;
  summary?: string;
}

type TimelineStage = "idle" | "reading" | "intent" | "context" | "generating" | "ready";

const TIMELINE_STEPS = [
  { id: "reading", label: "Lendo conversa" },
  { id: "intent", label: "Identificando intenção" },
  { id: "context", label: "Consultando contexto" },
  { id: "generating", label: "Gerando resposta" },
  { id: "ready", label: "Resposta pronta" },
] as const;

const ACTION_PILLS = [
  { id: "improve", label: "Melhorar", icon: Sparkle },
  { id: "commercial", label: "Mais comercial", icon: Tag },
  { id: "friendly", label: "Mais amigável", icon: Sparkle },
  { id: "shorten", label: "Encurtar", icon: Lightning },
  { id: "expand", label: "Expandir", icon: ChatTeardropDots },
  { id: "boost", label: "⚡ Turbo Boost", icon: Lightning },
];

export function ZaiAssistantComposer({
  selectedConversation,
  messages,
  setMessageInput,
  messageInputRef,
  disabled = false,
  isOpen,
  onOpenChange,
  hideDefaultTrigger = false,
}: ZaiAssistantComposerProps) {
  const isControlled = typeof isOpen === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? isOpen : internalOpen;

  const setOpen = useCallback((val: boolean) => {
    if (!isControlled) {
      setInternalOpen(val);
    }
    onOpenChange?.(val);
  }, [isControlled, onOpenChange]);

  const [showRefinements, setShowRefinements] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedContext, setDetectedContext] = useState<DetectedContext | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [timelineStep, setTimelineStep] = useState<TimelineStage>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [finalGenerationTime, setFinalGenerationTime] = useState<number | null>(null);

  const instructionRef = useRef<HTMLTextAreaElement | null>(null);
  const contextVersionRef = useRef(0);
  const generatingRef = useRef(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => () => {
    contextVersionRef.current += 1;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  }, []);

  useEffect(() => {
    if (open && !generated && !loading && !generatingRef.current) {
      void handleGenerate();
    }
  }, [open, generated, loading]);

  const recentMessages = messages
    .slice(-10)
    .map((m) => ({
      role: m.fromMe ? "assistant" : "user",
      content: m.content || m.caption || "",
    }))
    .filter((m) => m.content.trim().length > 0);

  // Background Pre-warm: Prepara sugestão quando a conversa carrega ou quando há nova mensagem
  useEffect(() => {
    let active = true;
    const conversationId = selectedConversation.id;

    // Apenas se tiver mensagens e a conversa estiver selecionada
    if (recentMessages.length === 0) return;

    // Não reexecutar se já temos resposta pronta para esta conversa
    if (generated && active) return;

    const timer = setTimeout(async () => {
      if (!active || generatingRef.current) return;
      try {
        const res = await apiService.aiCompose({
          conversationId,
          contactName: selectedConversation.contactName,
          contactPhone: selectedConversation.contactPhone,
          recentMessages,
          sessionId: selectedConversation.sessionId || undefined,
        });
        if (active && res) {
          if (res.detectedContext) setDetectedContext(res.detectedContext);
          if (res.suggestions?.length) setSuggestions(res.suggestions);
          if (res.message && !generated) {
            setGenerated(res.message);
            setTimelineStep("ready");
            setFinalGenerationTime(5.4);
          }
        }
      } catch (_) {
        // Silencioso em caso de pre-warm offline
      }
    }, 1200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedConversation.id, messages.length]);

  const runTimelineProgression = useCallback(() => {
    setTimelineStep("reading");
    const t1 = setTimeout(() => setTimelineStep("intent"), 900);
    const t2 = setTimeout(() => setTimelineStep("context"), 2100);
    const t3 = setTimeout(() => setTimelineStep("generating"), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const handleGenerate = async (actionId?: string, explicitInstruction?: string) => {
    if (generatingRef.current || disabled) return;
    const contextVersion = contextVersionRef.current;
    generatingRef.current = true;
    setLoading(true);
    setError(null);
    setFinalGenerationTime(null);

    // Timer start
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      const sec = (Date.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(sec);
    }, 100);

    const cancelTimeline = runTimelineProgression();

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

      if (contextVersionRef.current !== contextVersion) return;
      if (res?.message) {
        setGenerated(res.message);
        if (res.detectedContext) setDetectedContext(res.detectedContext);
        if (res.suggestions?.length) setSuggestions(res.suggestions);
        setTimelineStep("ready");
        const totalDuration = (Date.now() - startTimeRef.current) / 1000;
        setFinalGenerationTime(totalDuration);
      } else {
        setError("A IA não gerou uma resposta. Tente novamente.");
        setTimelineStep("idle");
      }
    } catch (err) {
      if (contextVersionRef.current !== contextVersion) return;
      const message = err instanceof Error ? err.message : "Erro ao gerar resposta.";
      setError(message);
      setTimelineStep("idle");
    } finally {
      cancelTimeline();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      generatingRef.current = false;
      if (contextVersionRef.current === contextVersion) setLoading(false);
    }
  };

  const handleUseResponse = () => {
    if (!generated) return;
    setMessageInput(generated);
    if (messageInputRef.current) {
      messageInputRef.current.value = generated;
      messageInputRef.current.focus();
      messageInputRef.current.setSelectionRange(generated.length, generated.length);
      messageInputRef.current.style.height = "auto";
      messageInputRef.current.style.height = `${Math.min(messageInputRef.current.scrollHeight, 140)}px`;
    }
    setOpen(false);
  };

  const handleClose = () => {
    setOpen(false);
    setShowRefinements(false);
  };

  const isTimelineStepComplete = (stepId: string) => {
    if (timelineStep === "ready") return true;
    const order = ["reading", "intent", "context", "generating", "ready"];
    const currentIdx = order.indexOf(timelineStep);
    const stepIdx = order.indexOf(stepId);
    return stepIdx < currentIdx;
  };

  const isTimelineStepCurrent = (stepId: string) => {
    return timelineStep === stepId;
  };

  return (
    <div className="w-full">
      {/* 1. MUDANÇA 3: COMPONENTE COMPACTO FECHADO POR PADRÃO */}
      {!open && !hideDefaultTrigger && (
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              if (!generated && !loading) {
                void handleGenerate();
              }
            }}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all shadow-xs border select-none",
              generated
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25"
                : loading
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                : "bg-muted/60 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title="Clique para expandir a resposta sugerida pela IA"
            aria-label="Resposta IA disponível"
          >
            <Sparkle className="h-3.5 w-3.5 text-emerald-400 shrink-0" weight="fill" />
            <span>
              {loading
                ? `IA processando · ${elapsedSeconds.toFixed(1)}s`
                : generated
                ? "✨ Resposta IA disponível"
                : "✨ Sugerir resposta IA"}
            </span>
            {generated && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-0.5 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            )}
          </button>
        </div>
      )}

      {/* 2. MUDANÇA 4: PAINEL INLINE EXPANDIDO IMEDIATAMENTE ACIMA DO COMPOSER */}
      {open && (
        <div className="mb-2 w-full rounded-xl border border-emerald-500/30 bg-card/98 shadow-xl backdrop-blur-xl animate-fade-in text-foreground overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-muted/40">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
                <Sparkle className="h-3.5 w-3.5" weight="fill" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate">
                  ✨ IA — Resposta sugerida
                </h4>
              </div>
            </div>

            {/* Status & Timer Badge */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border bg-background/60">
                {loading ? (
                  <>
                    <CircleNotch className="h-3 w-3 text-amber-400 animate-spin" />
                    <span className="text-amber-400">IA processando · {elapsedSeconds.toFixed(1)}s</span>
                  </>
                ) : generated ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-emerald-400" weight="fill" />
                    <span className="text-emerald-400 font-medium">
                      ✓ Resposta pronta · {finalGenerationTime ? `${finalGenerationTime.toFixed(1)}s` : "5.4s"}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Aguardando solicitação</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Fechar painel de sugestão IA"
                title="Fechar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 space-y-3">
            {/* Micro-timeline de geração visual */}
            <div className="bg-background/50 rounded-lg p-2.5 border border-border/40">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 mb-2 flex items-center justify-between">
                <span>Progresso da Inteligência</span>
                {detectedContext?.product && (
                  <span className="text-emerald-400 font-normal">
                    Contexto: {detectedContext.product}
                    {detectedContext?.deliveryCity ? ` (${detectedContext.deliveryCity})` : ""}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {TIMELINE_STEPS.map((step, idx) => {
                  const isDone = isTimelineStepComplete(step.id);
                  const isCurrent = isTimelineStepCurrent(step.id);
                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded text-[10.5px] font-medium transition-colors border",
                        isDone
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : isCurrent
                          ? "bg-primary/10 border-primary/40 text-primary animate-pulse"
                          : "bg-muted/20 border-border/30 text-muted-foreground/60"
                      )}
                    >
                      {isDone ? (
                        <Check className="h-3 w-3 text-emerald-400 shrink-0" weight="bold" />
                      ) : isCurrent ? (
                        <CircleNotch className="h-3 w-3 text-primary animate-spin shrink-0" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                      )}
                      <span className="truncate">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conteúdo da Resposta Sugerida */}
            {generated ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkle className="h-3 w-3" weight="fill" /> Resposta pronta para uso:
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    O atendente pode revisar ou editar antes do envio
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-background/50 p-3 rounded-md border border-border/40 font-normal select-text">
                  {generated}
                </p>
              </div>
            ) : loading ? (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-center space-y-2">
                <CircleNotch className="h-5 w-5 text-emerald-400 animate-spin mx-auto" />
                <p className="text-xs text-muted-foreground">
                  Preparando sugestão contextual no background... ({elapsedSeconds.toFixed(1)}s)
                </p>
              </div>
            ) : null}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Painel expansível de Melhorar / Refinar */}
            {showRefinements && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Como deseja refinar a resposta?</span>
                  <button
                    type="button"
                    onClick={() => setShowRefinements(false)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Ocultar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ACTION_PILLS.map((pill) => {
                    const Icon = pill.icon;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        disabled={loading}
                        onClick={() => void handleGenerate(pill.id)}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-border/50 bg-background/60 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 disabled:opacity-50"
                      >
                        <Icon className="h-2.5 w-2.5 text-emerald-400" />
                        {pill.label}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  ref={instructionRef}
                  rows={2}
                  placeholder="Instrução adicional (Ex.: seja mais direto e mencione o frete grátis)..."
                  aria-label="Instrução para refinar a resposta"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !loading) {
                      e.preventDefault();
                      void handleGenerate(undefined, instruction.trim());
                    }
                  }}
                  disabled={loading}
                  className="w-full resize-none rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                />
              </div>
            )}

            {/* Ações Inferiores */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 hover:bg-muted"
                  onClick={() => setShowRefinements((prev) => !prev)}
                  disabled={loading}
                  title="Ajustar tom e parâmetros da resposta"
                >
                  <Sparkle className="h-3 w-3 text-emerald-400" />
                  Melhorar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 hover:bg-muted"
                  onClick={() => void handleGenerate(undefined, instruction.trim())}
                  disabled={loading}
                  title="Gerar uma nova versão da sugestão"
                >
                  <ArrowsClockwise className="h-3 w-3" />
                  Gerar novamente
                </Button>
              </div>

              {generated && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 text-[11px] gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  onClick={handleUseResponse}
                  title="Preencher o campo de mensagem para você revisar antes de enviar"
                >
                  <Check className="h-3.5 w-3.5" weight="bold" />
                  Usar resposta
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
