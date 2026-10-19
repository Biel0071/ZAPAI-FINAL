import React, { useState, useEffect } from "react";
import { Clock, StopCircle, Play, Pause, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiService } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";

export interface FlowExecutionData {
  chatId: string;
  conversationId?: string;
  sessionId?: string;
  flowName: string;
  currentStep: number;
  totalSteps: number;
  stepDescription?: string;
  stepDelaySeconds?: number;
  startedAt?: number;
  isPaused?: boolean;
  status?: "preparing" | "running" | "paused" | "sent" | "delivered" | "cancelled" | "completed";
}

export function matchesConversationFlow(
  flow: Partial<FlowExecutionData> | null | undefined,
  context: { conversationId: string; sessionId?: string }
): boolean {
  if (!flow || String(flow.conversationId ?? "") !== context.conversationId) return false;
  return !context.sessionId || String(flow.sessionId ?? "") === context.sessionId;
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

  // Step delay countdown in seconds ("S")
  const defaultStepDelay = flowData?.stepDelaySeconds || 6;
  const [remainingDelaySeconds, setRemainingDelaySeconds] = useState(defaultStepDelay);

  useEffect(() => {
    setIsPaused(Boolean(flowData?.isPaused || flowData?.status === "paused"));
  }, [flowData?.isPaused, flowData?.status]);

  // Reset countdown whenever currentStep advances
  useEffect(() => {
    setRemainingDelaySeconds(flowData?.stepDelaySeconds || 6);
  }, [flowData?.currentStep, flowData?.stepDelaySeconds]);

  useEffect(() => {
    if (!flowData || isPaused || flowData.status === "completed" || flowData.status === "cancelled") {
      return;
    }

    const timer = setInterval(() => {
      setRemainingDelaySeconds((prev) => (prev > 0 ? prev - 1 : defaultStepDelay));
    }, 1000);

    return () => clearInterval(timer);
  }, [flowData, isPaused, defaultStepDelay]);

  if (!flowData) {
    return null;
  }

  const progressPercent = Math.min(
    100,
    Math.round(((flowData.currentStep || 1) / (flowData.totalSteps || 1)) * 100)
  );

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
      {/* Sleek single-line progress bar mounted directly below customer header */}
      <div className="w-full h-9 bg-card/95 backdrop-blur-md border-b border-emerald-500/30 px-3 flex items-center justify-between gap-2 text-xs shadow-sm select-none z-20 overflow-x-auto no-scrollbar">
        {/* Left: Indicator + Flow name + Steps badge */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <div className="relative flex h-2.5 w-2.5 shrink-0">
            {isPaused ? (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            )}
          </div>

          <span className="font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px] flex items-center gap-1 text-[11px]">
            <Zap className="h-3 w-3 text-emerald-400 shrink-0" />
            <span className="truncate">{flowData.flowName}</span>
          </span>

          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] whitespace-nowrap">
            Passo {flowData.currentStep} de {flowData.totalSteps}
          </span>
        </div>

        {/* Center / Right: Delay countdown in seconds ("S") + Percentage ("%") */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted/60 border border-border/60 text-[10px] font-mono text-muted-foreground whitespace-nowrap"
            title="Delay de envio restante da etapa atual"
          >
            <Clock className="h-3 w-3 text-emerald-400" />
            <span>
              {isPaused ? "Pausado" : `Delay: ${remainingDelaySeconds}s`}
            </span>
          </div>

          <div className="flex items-center gap-1.5" title={`Progresso do fluxo: ${progressPercent}%`}>
            <span className="text-[10px] font-mono font-bold text-foreground">{progressPercent}%</span>
            <div className="w-14 sm:w-20 h-1.5 rounded-full bg-muted/80 overflow-hidden border border-border/50">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  isPaused ? "bg-amber-400" : "bg-emerald-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Action buttons: [ Pausar / Ativar ] and [ Cancelar ] */}
          <div className="flex items-center gap-1.5 pl-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTogglePause}
              disabled={togglingPause}
              className={`h-6 px-2 text-[10px] font-medium rounded transition-all ${
                isPaused
                  ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15"
                  : "border-amber-500/40 text-amber-400 hover:bg-amber-500/15"
              }`}
            >
              {isPaused ? (
                <>
                  <Play className="h-2.5 w-2.5 mr-1 fill-current" />
                  <span>Ativar</span>
                </>
              ) : (
                <>
                  <Pause className="h-2.5 w-2.5 mr-1 fill-current" />
                  <span>Pausar</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirmModal(true)}
              disabled={cancelling}
              className="h-6 px-2 text-[10px] font-medium rounded bg-red-600/85 hover:bg-red-600 text-white transition-all flex items-center gap-1"
            >
              <StopCircle className="h-2.5 w-2.5" />
              <span>Cancelar</span>
            </Button>
          </div>
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
