import React, { useState, useEffect } from "react";
import { Clock, StopCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiService.cancelQuickReplyFlow(flowData.chatId);
      toast({
        title: "Fluxo Cancelado",
        description: `A execução do fluxo "${flowData.flowName}" foi interrompida.`,
      });
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
        <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold text-xs bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800/50">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatTimer(elapsedSeconds)}</span>
        </div>

        <div className="w-24 bg-muted/50 rounded-full h-1.5 overflow-hidden border border-border/40 hidden md:block">
          <div
            className="bg-emerald-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleCancel}
          disabled={cancelling}
          className="h-7 text-[11px] px-2.5 rounded-lg flex items-center gap-1 shrink-0 bg-red-600/90 hover:bg-red-600"
        >
          <StopCircle className="h-3.5 w-3.5" />
          <span>{cancelling ? "Cancelando..." : "Cancelar Fluxo"}</span>
        </Button>
      </div>
    </div>
  );
}
