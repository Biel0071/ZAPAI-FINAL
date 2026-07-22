import React, { useState } from "react";
import { Play, X, Image as ImageIcon, Video, Mic, FileText, Clock, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export interface QuickResponseItem {
  id?: string;
  label: string;
  text: string;
  mediaUrl?: string;
  fileUrl?: string;
  mediaType?: "image" | "video" | "audio" | "document";
  steps?: Array<{
    id?: string;
    type: "text" | "image" | "video" | "audio" | "document";
    value: string;
    caption?: string;
    filename?: string;
    delayMs?: number;
  }>;
}

interface QuickResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickReply: QuickResponseItem | null;
  onDispatch: (item: QuickResponseItem, customDelayMs: number) => Promise<void>;
}

export function QuickResponseModal({ isOpen, onClose, quickReply, onDispatch }: QuickResponseModalProps) {
  const { toast } = useToast();
  const [dispatching, setDispatching] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(2);

  if (!quickReply) return null;

  const stepsList = quickReply.steps && quickReply.steps.length > 0
    ? quickReply.steps
    : [
        {
          type: (quickReply.mediaType || (quickReply.mediaUrl ? "image" : "text")) as any,
          value: quickReply.mediaUrl || quickReply.fileUrl || quickReply.text,
          caption: quickReply.text,
          delayMs: 1500,
        }
      ];

  const hasMedia = stepsList.some((s) => s.type !== "text") || Boolean(quickReply.mediaUrl || quickReply.fileUrl);

  const handleSend = async () => {
    setDispatching(true);
    try {
      await onDispatch(quickReply, delaySeconds * 1000);
      toast({
        title: "Disparo Iniciado!",
        description: `O fluxo "${quickReply.label}" foi disparado para o cliente.`,
      });
      onClose();
    } catch (err: any) {
      toast({
        title: "Erro no Disparo",
        description: err.message || "Falha ao disparar resposta rápida.",
        variant: "destructive",
      });
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-emerald-400" /> Disparar Resposta Rápida
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Confira o conteúdo, mídias e etapas antes de disparar o fluxo para este atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Título / Identificação</Label>
            <p className="font-bold text-foreground text-xs bg-background/50 p-2 rounded border border-border/40">
              {quickReply.label}
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conteúdo do Envio</Label>
            <div className="bg-background/60 p-2.5 rounded-lg border border-border/50 space-y-2 font-sans">
              <p className="whitespace-pre-wrap text-foreground/90 leading-relaxed text-[11px]">
                {quickReply.text}
              </p>

              {hasMedia && (
                <div className="pt-2 border-t border-border/30 space-y-1">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">Mídias e Anexos Inclusos:</span>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {stepsList.map((st, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] text-emerald-300 font-semibold">
                        {st.type === "image" && <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />}
                        {st.type === "video" && <Video className="h-3.5 w-3.5 text-emerald-400" />}
                        {st.type === "audio" && <Mic className="h-3.5 w-3.5 text-emerald-400" />}
                        {st.type === "document" && <FileText className="h-3.5 w-3.5 text-emerald-400" />}
                        <span className="capitalize">{st.type !== "text" ? st.type : "Mídia"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold text-muted-foreground">Intervalo de Digitação (segundos)</Label>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">{delaySeconds}s</span>
            </div>
            <Input
              type="number"
              min={0}
              max={30}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value) || 0)}
              className="h-8 text-xs bg-background"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={dispatching}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{dispatching ? "Disparando..." : "Disparar Resposta Rápida"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
