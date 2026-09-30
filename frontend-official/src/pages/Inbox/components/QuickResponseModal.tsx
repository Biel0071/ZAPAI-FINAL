import { useEffect, useRef, useState } from "react";
import { FileText, Send, Workflow } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProtectedMediaUrl } from "@/core/runtime/hooks/useProtectedMediaUrl";
import type { QuickReplyItem, QuickReplyMediaItem } from "../types";
import { getMediaTypeLabel } from "../utils";

export type QuickResponseItem = QuickReplyItem;

function StepPreview({ step }: { step: QuickReplyMediaItem }) {
  const url = useProtectedMediaUrl(step.type === "text" ? null : step.value);
  if (step.type === "text") return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{step.value}</p>;
  return (
    <div className="space-y-2">
      {url && (step.type === "image" || step.type === "sticker") ? <img src={url} alt={step.filename || "Prévia da imagem"} className="max-h-48 w-full rounded-lg object-contain" />
        : url && step.type === "video" ? <video src={url} controls preload="metadata" className="max-h-48 w-full rounded-lg" />
          : url && step.type === "audio" ? <audio src={url} controls preload="metadata" className="w-full" />
            : <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-3"><FileText className="h-5 w-5 text-muted-foreground" /><span className="break-all text-sm">{step.filename || getMediaTypeLabel(step.type)}</span></div>}
      {step.caption && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{step.caption}</p>}
    </div>
  );
}

interface QuickResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickReply: QuickReplyItem | null;
  recipientName?: string;
  disabled?: boolean;
  onDispatch: (item: QuickReplyItem, customDelayMs: number) => Promise<void>;
}

export function QuickResponseModal({ isOpen, onClose, quickReply, recipientName, disabled = false, onDispatch }: QuickResponseModalProps) {
  const [dispatching, setDispatching] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const dispatchRef = useRef(false);
  useEffect(() => { setError(null); setDelaySeconds(2); }, [quickReply?.id, isOpen]);
  if (!quickReply) return null;
  const steps: QuickReplyMediaItem[] = quickReply.isFlow && quickReply.steps?.length
    ? quickReply.steps
    : quickReply.items?.length ? quickReply.items : [{ type: "text", value: quickReply.text }];
  const handleSend = async () => {
    if (dispatchRef.current || disabled || !quickReply.id) return;
    dispatchRef.current = true;
    setDispatching(true);
    setError(null);
    try {
      await onDispatch(quickReply, Math.min(60, Math.max(0, delaySeconds)) * 1000);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível colocar a resposta na fila. Confira a conexão e tente novamente.");
    } finally {
      dispatchRef.current = false;
      setDispatching(false);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open && !dispatching) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base"><Workflow className="h-5 w-5 text-primary" />Prévia da resposta rápida</DialogTitle>
          <DialogDescription className="text-sm">Confira o conteúdo salvo antes de enviar{recipientName ? ` para ${recipientName}` : " para este cliente"}.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-1">
          <p className="text-sm font-semibold">{quickReply.title}</p>
          <ol className="space-y-3">{steps.map((step, index) => (
            <li key={step.id || index} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">Etapa {index + 1} · {getMediaTypeLabel(step.type)}</p>
              <StepPreview step={step} />
            </li>
          ))}</ol>
          {steps.length > 1 && <div className="space-y-2"><Label htmlFor="quick-reply-delay" className="text-sm">Intervalo entre etapas (segundos)</Label><Input id="quick-reply-delay" type="number" min={0} max={60} value={delaySeconds} onChange={event => setDelaySeconds(Math.min(60, Math.max(0, Number(event.target.value) || 0)))} className="h-10 text-sm" /></div>}
          <p className="text-xs leading-relaxed text-muted-foreground">O envio executa esta resposta cadastrada. Para alterar o conteúdo, edite a resposta rápida antes de enviar.</p>
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          {disabled && <p className="text-xs text-amber-500">Conecte o WhatsApp e aguarde o envio atual para continuar.</p>}
        </div>
        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button variant="outline" disabled={dispatching} onClick={onClose}>Cancelar</Button>
          <Button onClick={() => void handleSend()} disabled={dispatching || disabled || !quickReply.id} className="gap-2"><Send className="h-4 w-4" />{dispatching ? "Colocando na fila…" : "Confirmar envio"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
