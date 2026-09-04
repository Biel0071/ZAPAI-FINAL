import React from "react";
import { cn } from "@/lib/utils";
import { WhatsAppMessagePreview } from "@/components/conversations/WhatsAppMessagePreview";
import { CompactCard } from "@/components/ui/card-variants";
import { Timer, ArrowDown } from "@phosphor-icons/react";

interface CampaignPreviewProps {
  payload: {
    objective?: string;
    audience?: string;
    steps?: Array<{
      delay?: string;
      message: string;
      mediaType?: "text" | "image" | "video" | "audio" | "document" | "file" | "sticker" | null;
      mediaName?: string | null;
    }>;
  } | null;
  className?: string;
}

export function CampaignPreview({ payload, className }: CampaignPreviewProps) {
  if (!payload || !payload.steps || payload.steps.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-8 text-center text-muted-foreground", className)}>
        <p className="text-sm">Nenhuma estrutura de campanha gerada ainda.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/20 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estratégia Mapeada</h4>
        <div className="grid gap-2 text-sm">
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">Objetivo</span>
            <span className="text-muted-foreground">{payload.objective || "Não definido"}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">Público-Alvo</span>
            <span className="text-muted-foreground">{payload.audience || "Não definido"}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        {payload.steps.map((step, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <div className="my-2 flex flex-col items-center gap-1 text-muted-foreground">
                <div className="h-4 w-px bg-border"></div>
                <div className="flex items-center gap-1 rounded-full border border-border/50 bg-background px-2 py-0.5 text-[10px] font-medium">
                  <Timer className="h-3 w-3" />
                  {step.delay || "Sem delay"}
                </div>
                <div className="h-4 w-px bg-border"></div>
                <ArrowDown className="h-3 w-3 text-border" />
              </div>
            )}
            <CompactCard className="w-full max-w-md bg-[url('/whatsapp-bg.png')] bg-cover bg-center p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Etapa {index + 1}
                </span>
              </div>
              <div className="flex w-full justify-end">
                <WhatsAppMessagePreview 
                  messageText={step.message} 
                  mediaType={step.mediaType}
                  mediaName={step.mediaName}
                />
              </div>
            </CompactCard>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
