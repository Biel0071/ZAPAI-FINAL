import React, { useState, useEffect } from "react";
import { Clock, StopCircle, Play, Pause, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiService } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { cn } from "@/core/lib/utils";

export interface FlowExecutionData {
  chatId: string;
  conversationId?: string;
  flowRunId?: string;
  sessionId?: string;
  flowName: string;
  currentStep: number;
  totalSteps: number;
  stepDescription?: string;
  stepDelaySeconds?: number | null;
  /** Epoch ms of the next scheduled send (from the backend queue); null/undefined = unknown. */
  nextSendAt?: number | null;
  startedAt?: number;
  isPaused?: boolean;
  status?: "preparing" | "running" | "paused" | "sent" | "delivered" | "cancelled" | "completed";
}

export function matchesConversationFlow(
  flow: Partial<FlowExecutionData> | null | undefined,
  context: { conversationId: string; sessionId?: string; phone?: string }
): boolean {
  if (!flow) return false;
  const sameConv = Boolean(flow.conversationId && context.conversationId && String(flow.conversationId) === String(context.conversationId));
  const rawA = String(flow.chatId || "").replace(/\D/g, "");
  const rawB = String(context.phone || "").replace(/\D/g, "");
  const samePhone = Boolean(rawA && rawB && (rawA === rawB || rawA.endsWith(rawB) || rawB.endsWith(rawA)));
  if (!sameConv && !samePhone) return false;
  if (context.sessionId && flow.sessionId && flow.sessionId !== "main" && flow.sessionId !== "default" && context.sessionId !== "main" && context.sessionId !== "default") {
    if (String(flow.sessionId) !== String(context.sessionId)) return false;
  }
  return true;
}

/** Seconds left until nextSendAt, or null when there is no real data. */
export function computeRemainingSeconds(nextSendAt: number | null | undefined, now: number): number | null {
  if (typeof nextSendAt !== "number" || !Number.isFinite(nextSendAt)) return null;
  return Math.max(0, (nextSendAt - now) / 1000);
}

export function formatCountdown(seconds: number | null): string {
  if (seconds === null) return "—";
  const whole = Math.ceil(seconds);
  if (whole <= 60) return `${whole}s`;
  const mm = Math.floor(whole / 60);
  const ss = whole % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Percent = steps already sent / total steps + intra-step elapsed time. */
export function computeProgressPercent(
  sent: number | undefined,
  total: number | undefined,
  timing?: { nextSendAt?: number | null; stepDelaySeconds?: number | null; now?: number }
): number {
  const totalSteps = Number(total) > 0 ? Number(total) : 0;
  if (!totalSteps) return 0;
  const completed = Math.max(0, Math.min(Number(sent) || 0, totalSteps));
  if (completed >= totalSteps) return 100;

  let intraRatio = 0;
  if (timing?.nextSendAt && timing?.stepDelaySeconds && timing.stepDelaySeconds > 0 && timing.now) {
    const remaining = Math.max(0, (timing.nextSendAt - timing.now) / 1000);
    intraRatio = Math.max(0, Math.min(1, 1 - (remaining / timing.stepDelaySeconds)));
  }

  const exactPercent = ((completed + intraRatio) / totalSteps) * 100;
  return Math.min(99, Math.max(0, Math.round(exactPercent)));
}

interface FlowExecutionBannerProps {
  flowData: FlowExecutionData | null;
  onCancelFlow?: () => void;
}

export function FlowExecutionBanner({ flowData, onCancelFlow }: FlowExecutionBannerProps) {
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [isPaused, setIsPaused] = useState(Boolean(flowData?.isPaused || flowData?.status === "paused"));
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setIsPaused(Boolean(flowData?.isPaused || flowData?.status === "paused"));
  }, [flowData?.isPaused, flowData?.status]);

  // Real countdown & smooth charging: derived from nextSendAt, refreshed every 250ms.
  const hasTimer = Boolean(flowData) && !isPaused && flowData?.nextSendAt != null;
  useEffect(() => {
    if (!hasTimer) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [hasTimer]);

  if (!flowData) {
    return null;
  }

  const remainingSeconds = computeRemainingSeconds(flowData.nextSendAt, now);
  const isSending = Boolean(flowData.nextSendAt != null && now >= flowData.nextSendAt && !isPaused && flowData.status !== "completed");
  const progressPercent = computeProgressPercent(flowData.currentStep, flowData.totalSteps, {
    nextSendAt: flowData.nextSendAt,
    stepDelaySeconds: flowData.stepDelaySeconds,
    now,
  });
  const stepLabel = `Etapa ${Math.min(Math.max(0, flowData.currentStep || 0), flowData.totalSteps || 0)} de ${flowData.totalSteps || 0}`;
  const timerText = isPaused ? "—" : formatCountdown(remainingSeconds);

  const handleTogglePause = async () => {
    if (!flowData.chatId || !flowData.conversationId) return;
    setTogglingPause(true);
    try {
      if (isPaused) {
        await apiService.resumeQuickReplyFlow(flowData.chatId, {
          conversationId: flowData.conversationId,
          sessionId: flowData.sessionId,
        });
        setIsPaused(false);
        toast({
          title: "Fluxo Retomado",
          description: `Disparo do fluxo "${flowData.flowName}" ativado.`,
        });
      } else {
        await apiService.pauseQuickReplyFlow(flowData.chatId, {
          conversationId: flowData.conversationId,
          sessionId: flowData.sessionId,
        });
        setIsPaused(true);
        toast({
          title: "Fluxo Pausado",
          description: `Disparo do fluxo "${flowData.flowName}" pausado temporariamente.`,
        });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao alterar estado do fluxo",
        description: err.message || "Não foi possível pausar ou ativar o fluxo.",
        variant: "destructive",
      });
    } finally {
      setTogglingPause(false);
    }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      if (!flowData.conversationId) throw new Error("Identificador da conversa não encontrado.");
      await apiService.cancelQuickReplyFlow(flowData.chatId, {
        conversationId: flowData.conversationId,
        sessionId: flowData.sessionId,
      });
      toast({
        title: "Fluxo Cancelado com Sucesso",
        description: `A execução do fluxo "${flowData.flowName}" foi cancelada.`,
      });
      setShowConfirmModal(false);
      if (onCancelFlow) onCancelFlow();
    } catch (err: any) {
      toast({
        title: "Erro ao Cancelar Fluxo",
        description: err.message || "Não foi possível cancelar o fluxo.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      {/* Sleek 2x height progress bar mounted directly below customer header */}
      <div
        key={flowData.flowRunId || flowData.conversationId}
        data-testid="flow-banner"
        className="w-full h-16 bg-card/95 backdrop-blur-md border-b-2 border-emerald-500/40 px-3 sm:px-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs shadow-md select-none z-20 overflow-hidden animate-conversation-swap"
      >
        {/* Left: charging bolt + flow name + step label */}
        <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
          <div
            className={cn(
              "relative h-9 w-9 rounded-xl shrink-0 flex items-center justify-center border transition-colors duration-300",
              isPaused ? "bg-amber-500/10 border-amber-500/40" : "bg-emerald-500/10 border-emerald-500/40"
            )}
            title={isPaused ? "Disparo pausado" : `Disparo carregando: ${progressPercent}%`}
            data-testid="flow-bolt"
            data-percent={progressPercent}
          >
            <Zap className="absolute h-5 w-5 text-muted-foreground/40" aria-hidden />
            <Zap
              data-testid="flow-bolt-fill"
              className={cn("absolute h-5 w-5 fill-current transition-[clip-path] duration-500 ease-out", isPaused ? "text-amber-400" : "text-emerald-400")}
              style={{ clipPath: `inset(${100 - progressPercent}% 0 0 0)` }}
              aria-hidden
            />
          </div>
          <div className="flex flex-col min-w-0 justify-center leading-tight">
            <span className="font-bold text-foreground text-sm truncate max-w-[110px] sm:max-w-[200px]">{flowData.flowName}</span>
            <span data-testid="flow-step-label" className="text-[11px] text-muted-foreground whitespace-nowrap">{stepLabel}</span>
          </div>
        </div>

        {/* Center: timer + percentage + bar */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 justify-self-center">
          <div
            className="flex items-center gap-1.5 text-base font-mono text-foreground whitespace-nowrap"
            title="Tempo restante para o envio da próxima mensagem"
          >
            <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
            <span data-testid="flow-timer" className="font-semibold tabular-nums">{timerText}</span>
          </div>
          <div className="flex items-center gap-2" title={`Progresso do fluxo: ${progressPercent}%`}>
            <span data-testid="flow-percent" className={cn("text-lg font-mono font-bold tabular-nums", isPaused ? "text-amber-400" : "text-emerald-400")}>{progressPercent}%</span>
            <div className="w-16 sm:w-32 h-2.5 rounded-full bg-muted/80 overflow-hidden border border-border/50 hidden xs:block">
              <div
                className={cn("h-full rounded-full transition-all duration-500 ease-out", isPaused ? "bg-amber-400" : "bg-emerald-500")}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 justify-self-end shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTogglePause}
            disabled={togglingPause}
            aria-label={isPaused ? "Retomar disparo" : "Pausar disparo"}
            title={isPaused ? "Retomar disparo (▶️)" : "Pausar disparo (⏸️)"}
            className={cn(
              "h-9 w-9 p-0 rounded-lg transition-all shadow-xs flex items-center justify-center text-sm",
              isPaused
                ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/25 hover:border-emerald-400"
                : "border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/25 hover:border-amber-400"
            )}
          >
            {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowConfirmModal(true)}
            disabled={cancelling}
            aria-label="Cancelar disparo"
            title="Cancelar disparo (⏹️)"
            className="h-9 w-9 p-0 rounded-lg bg-red-600/85 hover:bg-red-600 text-white transition-all shadow-xs flex items-center justify-center text-sm"
          >
            <StopCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Confirmation modal for cancellation */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" /> Cancelar envio do fluxo?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Deseja cancelar o disparo do fluxo <strong className="text-foreground">{flowData.flowName}</strong>?
              Atualmente na etapa <strong className="text-emerald-400">{flowData.currentStep} de {flowData.totalSteps}</strong> ({progressPercent}%).
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl space-y-1 text-xs my-2">
            <span className="font-bold text-red-300 block">Atenção:</span>
            <p className="text-muted-foreground text-[11px]">
              O cancelamento irá interromper o envio das etapas restantes da fila de disparo para este cliente no WhatsApp.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmModal(false)}
              className="h-8 text-xs font-semibold"
            >
              Continuar Disparo
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={confirmCancel}
              disabled={cancelling}
              className="h-8 text-xs bg-red-600 hover:bg-red-700 font-bold"
            >
              {cancelling ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
