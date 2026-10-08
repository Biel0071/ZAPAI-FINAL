import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Eye,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Mic,
  Minimize2,
  Paperclip,
  Plus,
  Save,
  Send,
  Smile,
  Sparkles,
  Trash2,
  Video,
  Workflow,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/state/hooks/use-toast";
import { apiService } from "@/core/services/apiService";
import { useProtectedMediaUrl } from "@/core/runtime/hooks/useProtectedMediaUrl";
import type { QuickReplyItem, QuickReplyMediaItem } from "../types";
import {
  detectMediaType,
  fileToBase64,
  getMediaTypeLabel,
  interpolateTemplateVariables,
} from "../utils";
import { QuickReplyTagsPicker } from "./QuickReplyTagsPicker";

export type QuickResponseItem = QuickReplyItem;

interface QuickResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickReply: QuickReplyItem | null;
  recipientName?: string;
  recipientPhone?: string;
  disabled?: boolean;
  onDispatch: (
    item: QuickReplyItem,
    customDelayMs: number,
    customSteps?: QuickReplyMediaItem[]
  ) => Promise<void>;
  onSaveTemplate?: (updated: QuickReplyItem) => void;
}

const COMMON_EMOJIS = ["😊", "👍", "👋", "🚀", "🔥", "🙏", "✅", "📦", "💬", "⭐"];

export function QuickResponseModal({
  isOpen,
  onClose,
  quickReply,
  recipientName,
  recipientPhone,
  disabled = false,
  onDispatch,
  onSaveTemplate,
}: QuickResponseModalProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<QuickReplyMediaItem[]>([]);
  const [title, setTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [dispatching, setDispatching] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeInputRefs = useRef<{ [key: number]: HTMLTextAreaElement | null }>({});
  const dispatchRef = useRef(false);

  // Initialize or reset state when opening modal
  useEffect(() => {
    if (!quickReply || !isOpen) return;

    setTitle(quickReply.title || quickReply.text || "Resposta rápida");
    setError(null);
    setDispatching(false);
    setSavingTemplate(false);

    const sourceSteps: QuickReplyMediaItem[] =
      quickReply.isFlow && quickReply.steps?.length
        ? quickReply.steps.map((s) => ({
            id: s.id || `step-${Math.random().toString(36).substring(2, 8)}`,
            type: s.type,
            value: s.value,
            filename: s.filename,
            caption: s.caption || "",
            typingSeconds: Math.round((s.typingMs ?? 5000) / 1000) || 5,
            delaySeconds: Math.round((s.delayMs ?? 5000) / 1000) || 5,
            viewOnce: Boolean(s.viewOnce),
          }))
        : quickReply.items?.length
        ? quickReply.items.map((it) => ({
            id: it.id || `item-${Math.random().toString(36).substring(2, 8)}`,
            type: it.type,
            value: it.value,
            filename: it.filename,
            caption: it.caption || "",
            typingSeconds: Math.round((it.typingMs ?? 5000) / 1000) || 5,
            delaySeconds: Math.round((it.delayMs ?? 5000) / 1000) || 5,
            viewOnce: Boolean(it.viewOnce),
          }))
        : [
            {
              id: `item-${Date.now()}`,
              type: "text",
              value: quickReply.text || "",
              typingSeconds: 5,
              delaySeconds: 5,
            },
          ];

    setItems(sourceSteps);
    setFocusedIndex(0);
  }, [quickReply?.id, isOpen]);

  if (!quickReply) return null;

  // Insert tag into the currently focused textarea
  const handleInsertTag = (tag: string) => {
    const targetIdx = focusedIndex >= 0 && focusedIndex < items.length ? focusedIndex : 0;
    const targetEl = activeInputRefs.current[targetIdx];

    const currentItem = items[targetIdx];
    if (!currentItem) return;

    const isText = currentItem.type === "text";
    const currentVal = isText ? currentItem.value : currentItem.caption || "";

    if (targetEl) {
      const start = targetEl.selectionStart ?? currentVal.length;
      const end = targetEl.selectionEnd ?? currentVal.length;
      const nextVal = currentVal.substring(0, start) + tag + " " + currentVal.substring(end);

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === targetIdx
            ? isText
              ? { ...item, value: nextVal }
              : { ...item, caption: nextVal }
            : item
        )
      );

      setTimeout(() => {
        targetEl.focus();
        targetEl.setSelectionRange(start + tag.length + 1, start + tag.length + 1);
      }, 50);
    } else {
      const nextVal = currentVal ? `${currentVal} ${tag} ` : `${tag} `;
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === targetIdx
            ? isText
              ? { ...item, value: nextVal }
              : { ...item, caption: nextVal }
            : item
        )
      );
    }
  };

  // Insert emoji
  const handleInsertEmoji = (emoji: string, index: number) => {
    const targetEl = activeInputRefs.current[index];
    const currentItem = items[index];
    if (!currentItem) return;

    const isText = currentItem.type === "text";
    const currentVal = isText ? currentItem.value : currentItem.caption || "";

    if (targetEl) {
      const start = targetEl.selectionStart ?? currentVal.length;
      const end = targetEl.selectionEnd ?? currentVal.length;
      const nextVal = currentVal.substring(0, start) + emoji + currentVal.substring(end);

      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? isText
              ? { ...it, value: nextVal }
              : { ...it, caption: nextVal }
            : it
        )
      );
      setTimeout(() => {
        targetEl.focus();
        targetEl.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 50);
    } else {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? isText
              ? { ...it, value: currentVal + emoji }
              : { ...it, caption: currentVal + emoji }
            : it
        )
      );
    }
  };

  // Add block
  const handleAddTextBlock = () => {
    const nextItem: QuickReplyMediaItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: "text",
      value: "",
      typingSeconds: 5,
      delaySeconds: 5,
    };
    setItems((prev) => [...prev, nextItem]);
    setFocusedIndex(items.length);
  };

  // Add media block via file selection
  const handleAddMediaFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = detectMediaType(file);
      try {
        const base64 = await fileToBase64(file);
        const dataUrl = `data:${file.type};base64,${base64}`;
        setItems((prev) => [
          ...prev,
          {
            id: `item-${Date.now()}-${i}`,
            type,
            value: dataUrl,
            filename: file.name,
            caption: "",
            typingSeconds: 5,
            delaySeconds: 5,
            viewOnce: false,
          },
        ]);
      } catch (err) {
        toast({
          title: "Erro no arquivo",
          description: `Não foi possível carregar ${file.name}.`,
          variant: "destructive",
        });
      }
    }
    e.target.value = "";
  };

  // Delete block
  const handleDeleteBlock = (index: number) => {
    if (items.length <= 1) {
      toast({
        title: "Atenção",
        description: "A resposta rápida precisa ter pelo menos um bloco.",
      });
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    if (focusedIndex >= index) setFocusedIndex(Math.max(0, focusedIndex - 1));
  };

  // Move block
  const handleMoveBlock = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const clone = [...prev];
      const [removed] = clone.splice(index, 1);
      clone.splice(target, 0, removed);
      return clone;
    });
    setFocusedIndex(target);
  };

  // Save changes to the original template in database
  const handleSaveToTemplate = async () => {
    if (!quickReply.id) return;
    setSavingTemplate(true);
    try {
      const payload = {
        title: title.trim() || quickReply.title,
        category: quickReply.category,
        favorite: quickReply.favorite,
        tags: quickReply.tags || [],
        isFlow: items.length > 1,
        items:
          items.length <= 1
            ? items.map((it) => ({
                type: it.type,
                value: it.value,
                filename: it.filename,
                caption: it.caption,
                delayMs: (it.delaySeconds ?? 5) * 1000,
                typingMs: (it.typingSeconds ?? 5) * 1000,
                viewOnce: it.viewOnce,
              }))
            : undefined,
        steps:
          items.length > 1
            ? items.map((it) => ({
                id: it.id,
                type: it.type,
                value: it.value,
                filename: it.filename,
                caption: it.caption,
                delayMs: (it.delaySeconds ?? 5) * 1000,
                typingMs: (it.typingSeconds ?? 5) * 1000,
                viewOnce: it.viewOnce,
              }))
            : undefined,
      };

      const updated = await apiService.updateQuickReply(quickReply.id, payload);
      toast({
        title: "Modelo Salvo com Sucesso",
        description: `As alterações em "${title}" foram gravadas no banco de dados.`,
      });
      if (onSaveTemplate) onSaveTemplate(updated);
    } catch (err: any) {
      toast({
        title: "Erro ao Salvar Modelo",
        description: err.message || "Não foi possível salvar o modelo.",
        variant: "destructive",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Dispatch current sequence with real typing and step delays to conversation
  const handleSend = async () => {
    if (dispatchRef.current || disabled || !quickReply.id) return;

    // Validate that items have content
    const validItems = items.filter((it) => it.value.trim() || it.caption?.trim());
    if (validItems.length === 0) {
      setError("Adicione pelo menos uma mensagem com texto ou arquivo.");
      return;
    }

    dispatchRef.current = true;
    setDispatching(true);
    setError(null);

    try {
      // Build normalized steps with custom typing and delay seconds
      const stepsToDispatch: QuickReplyMediaItem[] = validItems.map((it) => ({
        id: it.id,
        type: it.type,
        value: it.value,
        filename: it.filename,
        caption: it.caption || "",
        typingSeconds: it.typingSeconds ?? 5,
        delaySeconds: it.delaySeconds ?? 5,
        typingMs: (it.typingSeconds ?? 5) * 1000,
        delayMs: (it.delaySeconds ?? 5) * 1000,
        viewOnce: Boolean(it.viewOnce),
      }));

      // Delay to pass to onDispatch (respecting step interval)
      const delayMsToPass = quickReply.steps?.[1]?.delayMs ?? (stepsToDispatch[1]?.delaySeconds ? stepsToDispatch[1].delaySeconds * 1000 : 2000);

      const isModified =
        items.some((it, idx) => {
          const orig = quickReply.steps?.[idx] || quickReply.items?.[idx];
          if (!orig) return true;
          return it.value !== orig.value || (it.caption || "") !== (orig.caption || "");
        }) || items.length !== (quickReply.steps?.length || quickReply.items?.length || 1);

      if (isModified) {
        await onDispatch(quickReply, delayMsToPass, stepsToDispatch);
      } else {
        await onDispatch(quickReply, delayMsToPass);
      }
      toast({
        title: "Disparo Iniciado",
        description: `Enviando ${stepsToDispatch.length} etapa(s) com simulação de digitação e delay.`,
      });
      onClose();
    } catch (err: any) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar o envio da resposta rápida. Verifique a conexão."
      );
    } finally {
      dispatchRef.current = false;
      setDispatching(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !dispatching) onClose();
      }}
    >
      <DialogContent
        className={`flex flex-col rounded-2xl border border-border/80 bg-gradient-to-b from-card/95 via-card to-background/98 p-0 text-foreground shadow-2xl backdrop-blur-2xl transition-all duration-200 ${
          isExpanded
            ? "max-h-[96dvh] max-w-4xl h-[92vh]"
            : "max-h-[90dvh] max-w-2xl h-[85vh]"
        }`}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Editar e enviar resposta rápida</DialogTitle>
          <DialogDescription>Ajuste as etapas, texto e delays da resposta rápida</DialogDescription>
        </DialogHeader>

        {/* HEADER (Matching Image 2) */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 text-primary">
              <Workflow className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-bold text-base bg-transparent border-b border-transparent hover:border-border/60 focus:border-primary focus:outline-none px-1 text-foreground"
                  title="Clique para editar o título"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Editar e enviar resposta rápida
                {recipientName ? ` para ${recipientName}` : ""}
              </p>
            </div>
          </div>

          {/* Header Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* #Tags Popover Trigger (Image 3) */}
            <QuickReplyTagsPicker onSelectTag={handleInsertTag} />

            {/* Expand / Minimize */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={isExpanded ? "Reduzir janela" : "Expandir janela"}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>

            {/* Close */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* SCROLLABLE BLOCKS LIST */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 scrollbar-thin">
          {items.map((item, idx) => {
            const isText = item.type === "text";
            const isImage = item.type === "image" || item.type === "sticker";
            const isAudio = item.type === "audio";
            const isVideo = item.type === "video";
            const isDoc = !isText && !isImage && !isAudio && !isVideo;

            return (
              <div
                key={item.id || idx}
                className={`relative rounded-xl border p-4 shadow-sm transition-all ${
                  focusedIndex === idx
                    ? "border-primary/50 bg-card/90 shadow-md ring-1 ring-primary/20"
                    : "border-border/60 bg-muted/15 hover:border-border"
                }`}
                onClick={() => setFocusedIndex(idx)}
              >
                {/* Block Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    {isText && <FileText className="h-4 w-4 text-emerald-400" />}
                    {isImage && <ImageIcon className="h-4 w-4 text-cyan-400" />}
                    {isAudio && <Mic className="h-4 w-4 text-blue-400" />}
                    {isVideo && <Video className="h-4 w-4 text-purple-400" />}
                    {isDoc && <Paperclip className="h-4 w-4 text-amber-400" />}
                    <span className="text-xs font-bold text-foreground">
                      {isText
                        ? "Criar Mensagem de Texto"
                        : isImage
                        ? "Criar Mensagem de Imagem"
                        : isAudio
                        ? "Criar Mensagem de Áudio"
                        : isVideo
                        ? "Criar Mensagem de Vídeo"
                        : "Criar Mensagem de Documento"}
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Etapa {idx + 1} de {items.length}
                    </span>
                  </div>

                  {/* Move & Delete */}
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveBlock(idx, "up");
                      }}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Mover para cima"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={idx === items.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveBlock(idx, "down");
                      }}
                      className="h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Mover para baixo"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBlock(idx);
                      }}
                      className="h-6 w-6 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                      title="Excluir esta etapa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* 1. TYPING DELAY CONFIG (Simulação de Digitação) */}
                <div className="mb-3 flex items-center justify-between rounded-lg bg-background/50 border border-border/40 p-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground/90 font-medium">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Exibir para o cliente que a mensagem está sendo digitada por</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={item.typingSeconds ?? 5}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                        setItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, typingSeconds: val } : it))
                        );
                      }}
                      className="h-7 w-14 text-center font-bold text-xs bg-card border-border/70"
                    />
                    <span className="text-muted-foreground font-medium">Segundos</span>
                  </div>
                </div>

                {/* 2. BLOCK CONTENT */}
                {isText ? (
                  <div className="space-y-2">
                    <textarea
                      ref={(el) => {
                        activeInputRefs.current[idx] = el;
                      }}
                      value={item.value}
                      onFocus={() => setFocusedIndex(idx)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, value: val } : it))
                        );
                      }}
                      placeholder="Olá, tudo bem? Vi que se interessou na nossa loja..."
                      className="w-full min-h-[90px] rounded-lg border border-border/60 bg-background/60 p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-normal"
                    />
                    {/* Common Emoji Bar below text */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                        <Smile className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                        {COMMON_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleInsertEmoji(emoji, idx)}
                            className="rounded p-1 text-sm hover:bg-muted transition-transform active:scale-95"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {item.value.length} caracteres
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border border-border/40 bg-background/40 p-3">
                    {/* Media Preview */}
                    <MediaBlockPreview item={item} />

                    {/* View Once Toggle (Imagem com visualização única) */}
                    {isImage && (
                      <div className="flex items-center justify-between border-t border-border/30 pt-2 text-xs">
                        <Label htmlFor={`view-once-${idx}`} className="cursor-pointer font-medium">
                          Imagem com visualização única
                        </Label>
                        <Switch
                          id={`view-once-${idx}`}
                          checked={Boolean(item.viewOnce)}
                          onCheckedChange={(checked) => {
                            setItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, viewOnce: checked } : it))
                            );
                          }}
                        />
                      </div>
                    )}

                    {/* Media Caption with focus tracking */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-muted-foreground uppercase">
                        Legenda do arquivo (opcional)
                      </Label>
                      <textarea
                        ref={(el) => {
                          activeInputRefs.current[idx] = el;
                        }}
                        value={item.caption || ""}
                        onFocus={() => setFocusedIndex(idx)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, caption: val } : it))
                          );
                        }}
                        placeholder="Escreva uma legenda opcional para acompanhar a mídia..."
                        className="w-full min-h-[50px] rounded-md border border-border/60 bg-background/50 p-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* 3. NEXT ACTION WAIT DELAY (Aguarde para chamar a próxima ação) */}
                <div className="mt-3 flex items-center justify-between rounded-lg bg-background/50 border border-border/40 p-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground/90 font-medium">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span>Aguarde para chamar a proxima ação por</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={60}
                      value={item.delaySeconds ?? 5}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                        setItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, delaySeconds: val } : it))
                        );
                      }}
                      className="h-7 w-14 text-center font-bold text-xs bg-card border-border/70"
                    />
                    <span className="text-muted-foreground font-medium">Segundos</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ADD STEP BUTTONS */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddTextBlock}
              className="h-8 gap-1.5 text-xs border-dashed border-border hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Mensagem de Texto
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 gap-1.5 text-xs border-dashed border-border hover:border-primary hover:text-primary"
            >
              <Paperclip className="h-3.5 w-3.5" /> Adicionar Mídia / Arquivo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleAddMediaFiles(e)}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive font-medium"
            >
              {error}
            </p>
          )}

          {disabled && (
            <p className="text-xs text-amber-500 font-medium">
              Conecte o WhatsApp e aguarde o envio atual para continuar.
            </p>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3">
          {/* Secondary Left Buttons: Save to template or cancel */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingTemplate || dispatching}
              onClick={() => void handleSaveToTemplate()}
              className="gap-1.5 text-xs"
              title="Salva as alterações permanentemente no modelo da resposta rápida"
            >
              <Save className="h-3.5 w-3.5" />
              {savingTemplate ? "Salvando..." : "Salvar no modelo"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={dispatching}
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
          </div>

          {/* Primary Right Button: Floating / Prominent Green Send Button (✈) */}
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={dispatching || disabled || !quickReply.id}
            className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-5 rounded-full shadow-lg hover:shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="h-4 w-4" />
            <span>{dispatching ? "Colocando na fila…" : "Confirmar envio"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Media Preview Sub-component
function MediaBlockPreview({ item }: { item: QuickReplyMediaItem }) {
  const protectedUrl = useProtectedMediaUrl(
    item.type === "text" ? null : item.value.startsWith("data:") ? item.value : item.value
  );

  const displayUrl = item.value.startsWith("data:") ? item.value : protectedUrl;

  if (item.type === "image" || item.type === "sticker") {
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 rounded-lg overflow-hidden border border-border/60 bg-background shadow-xs">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={item.filename || "Prévia"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold text-foreground truncate">{item.filename || "Imagem"}</p>
          <p className="text-[11px] text-muted-foreground">Formato: Imagem WhatsApp</p>
        </div>
      </div>
    );
  }

  if (item.type === "video") {
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 rounded-lg overflow-hidden border border-border/60 bg-background shadow-xs">
          {displayUrl ? (
            <video src={displayUrl} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Video className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold text-foreground truncate">{item.filename || "Vídeo"}</p>
          <p className="text-[11px] text-muted-foreground">Formato: Vídeo WhatsApp</p>
        </div>
      </div>
    );
  }

  if (item.type === "audio") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <Mic className="h-4 w-4 text-blue-400" />
          <span className="font-semibold text-foreground truncate">{item.filename || "Áudio WhatsApp"}</span>
        </div>
        {displayUrl && (
          <audio controls src={displayUrl} className="w-full h-8 rounded border border-border/40" />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 border border-border/40">
      <FileText className="h-6 w-6 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-semibold text-foreground truncate">{item.filename || "Documento"}</p>
        <p className="text-[10px] text-muted-foreground uppercase">{item.type || "Arquivo"}</p>
      </div>
    </div>
  );
}
