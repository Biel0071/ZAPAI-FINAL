import React, { useState, useEffect } from "react";
import { Clock, StopCircle, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { apiService } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";

export interface FlowExecutionData {
  chatId: string;
  flowName: string;
  currentStep: number;
  totalSteps: number;
  stepDescription?: string;
  startedAt?: number;
  status?: "running" | "cancelled" | "completed";
}

interface FlowExecutionBannerProps {
  flowData: FlowExecutionData | null;
  onCancelFlow?: () => void;
}

export function FlowExecutionBanner({ flowData, onCancelFlow }: FlowExecutionBannerProps) {
  const { toast } = useToast();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (!flowData || !flowData.startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - (flowData.startedAt || Date.now())) / 1000);
      setElapsedSeconds(seconds >= 0 ? seconds : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [flowData]);

  if (!flowData || flowData.status === "cancelled" || flowData.status === "completed") {
    return null;
  }

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const progressPercent = Math.min(
    100,
    Math.round(((flowData.currentStep || 1) / (flowData.totalSteps || 1)) * 100)
  );

  const estimatedSecondsLeft = Math.max(0, (flowData.totalSteps - flowData.currentStep) * 1.5);
  const isPaused = false; // Placeholder for future state

  const confirmCancel = async () => {
    setCancelling(true);
    try {
      await apiService.cancelQuickReplyFlow(flowData.chatId);
      toast({
        title: "Fluxo Cancelado com Sucesso",
        description: `A execução do fluxo "${flowData.flowName}" foi interrompida.`,
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
      <div className="w-full bg-gradient-to-r from-emerald-950/90 via-card to-emerald-950/90 border-b border-emerald-500/40 p-2.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shadow-md animate-fade-in z-20">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground truncate max-w-[200px] sm:max-w-[300px]">
                ⚡ Fluxo em Execução: {flowData.flowName}
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-[10px] border border-emerald-500/30">
                Etapa {flowData.currentStep}/{flowData.totalSteps}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate max-w-[320px]">
              {flowData.stepDescription || "Enviando conteúdo e mídias do fluxo..."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-border/30 pt-1.5 sm:pt-0">
          <div className="flex flex-col items-end mr-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Tempo Decorrido</span>
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-xs bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800/50">
              <Clock className="h-3 w-3" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>
          </div>

          <div className="flex flex-col items-end mr-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Tempo até o final</span>
            <div className="flex items-center gap-1.5 text-blue-400 font-mono font-bold text-xs bg-blue-950/60 px-2 py-1 rounded border border-blue-800/50">
              <Clock className="h-3 w-3" />
              <span>{formatTimer(Math.round(estimatedSecondsLeft))}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 items-end mr-4 hidden md:flex w-24">
            <div className="flex justify-between w-full text-[10px] text-muted-foreground font-bold">
              <span>Progresso</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden border border-border/40">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex gap-1.5 items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toast({ title: "Pausar", description: "Função de pausar em breve." })}
              className="h-7 text-[11px] px-2.5 rounded-lg font-semibold bg-background hover:bg-muted"
            >
              Pausar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toast({ title: "Reiniciar", description: "Função de reiniciar em breve." })}
              className="h-7 text-[11px] px-2.5 rounded-lg font-semibold bg-background hover:bg-muted"
            >
              Reiniciar
            </Button>
          </div>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowConfirmModal(true)}
            disabled={cancelling}
            className="h-7 text-[11px] px-2.5 rounded-lg flex items-center gap-1 shrink-0 bg-red-600/90 hover:bg-red-600 font-semibold"
          >
            <StopCircle className="h-3.5 w-3.5" />
            <span>Cancelar Fluxo</span>
          </Button>
        </div>
      </div>

      {/* Pop-up Modal de Confirmação de Cancelamento de Disparo */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" /> Interromper Disparo de Fluxo?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Você está prestes a cancelar o disparo do fluxo <strong className="text-foreground">{flowData.flowName}</strong>. 
              Atualmente na etapa <strong className="text-emerald-400">{flowData.currentStep} de {flowData.totalSteps}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl space-y-1 text-xs my-2">
            <span className="font-bold text-red-300 block">Atenção:</span>
            <p className="text-muted-foreground text-[11px]">
              O cancelamento irá interromper o envio das etapas restantes da fila de disparo para este atendimento no WhatsApp.
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
