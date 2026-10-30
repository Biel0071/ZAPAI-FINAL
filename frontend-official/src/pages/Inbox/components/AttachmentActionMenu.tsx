import React, { useState, useEffect } from "react";
import {
  FileText,
  Image as ImageIcon,
  Camera,
  Headphones,
  User,
  ChartBarHorizontal,
  Calendar,
  Sticker,
  QrCode,
  Storefront,
  Lightning,
  Receipt,
  PushPin,
  Paperclip,
  X,
} from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";

export interface ActionMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  defaultPinned?: boolean;
}

export const ACTION_MENU_ITEMS: ActionMenuItem[] = [
  {
    id: "documento",
    label: "Documento",
    icon: FileText,
    iconColor: "text-purple-400",
    bgColor: "bg-purple-500/15 group-hover:bg-purple-500/25",
  },
  {
    id: "fotos_videos",
    label: "Fotos e vídeos",
    icon: ImageIcon,
    iconColor: "text-blue-400",
    bgColor: "bg-blue-500/15 group-hover:bg-blue-500/25",
  },
  {
    id: "camera",
    label: "Câmera",
    icon: Camera,
    iconColor: "text-pink-400",
    bgColor: "bg-pink-500/15 group-hover:bg-pink-500/25",
  },
  {
    id: "audio",
    label: "Áudio",
    icon: Headphones,
    iconColor: "text-orange-400",
    bgColor: "bg-orange-500/15 group-hover:bg-orange-500/25",
  },
  {
    id: "contato",
    label: "Contato",
    icon: User,
    iconColor: "text-cyan-400",
    bgColor: "bg-cyan-500/15 group-hover:bg-cyan-500/25",
  },
  {
    id: "enquete",
    label: "Enquete",
    icon: ChartBarHorizontal,
    iconColor: "text-yellow-400",
    bgColor: "bg-yellow-500/15 group-hover:bg-yellow-500/25",
  },
  {
    id: "evento",
    label: "Evento",
    icon: Calendar,
    iconColor: "text-rose-400",
    bgColor: "bg-rose-500/15 group-hover:bg-rose-500/25",
  },
  {
    id: "nova_figurinha",
    label: "Nova figurinha",
    icon: Sticker,
    iconColor: "text-emerald-400",
    bgColor: "bg-emerald-500/15 group-hover:bg-emerald-500/25",
  },
  {
    id: "pix",
    label: "Pix",
    icon: QrCode,
    iconColor: "text-emerald-400",
    bgColor: "bg-emerald-500/15 group-hover:bg-emerald-500/25",
  },
  {
    id: "catalogo",
    label: "Catálogo",
    icon: Storefront,
    iconColor: "text-slate-300",
    bgColor: "bg-slate-500/15 group-hover:bg-slate-500/25",
    defaultPinned: true,
  },
  {
    id: "quick_replies",
    label: "Resposta rápida",
    icon: Lightning,
    iconColor: "text-amber-400",
    bgColor: "bg-amber-500/15 group-hover:bg-amber-500/25",
    defaultPinned: true,
  },
  {
    id: "cobrar",
    label: "Cobrar",
    icon: Receipt,
    iconColor: "text-sky-400",
    bgColor: "bg-sky-500/15 group-hover:bg-sky-500/25",
    defaultPinned: true,
  },
];

const STORAGE_KEY = "zapai_inbox_pinned_actions";
const DEFAULT_PINNED = ["catalogo", "cobrar", "quick_replies"];

interface AttachmentActionMenuProps {
  disabled?: boolean;
  onAction: (actionId: string) => void;
  pinnedIds: string[];
  onTogglePin: (actionId: string) => void;
  className?: string;
}

export function usePinnedActions() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return DEFAULT_PINNED;
  });

  const togglePin = (actionId: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_) {}
      const item = ACTION_MENU_ITEMS.find((it) => it.id === actionId);
      if (next.includes(actionId)) {
        toast.success(`"${item?.label || actionId}" fixado no rodapé.`);
      } else {
        toast.info(`"${item?.label || actionId}" desafixado (ocultado do rodapé).`);
      }
      return next;
    });
  };

  return { pinnedIds, togglePin };
}

export function AttachmentActionMenu({
  disabled = false,
  onAction,
  pinnedIds,
  onTogglePin,
  className,
}: AttachmentActionMenuProps) {
  const [open, setOpen] = useState(false);

  const handleItemClick = (actionId: string) => {
    setOpen(false);
    onAction(actionId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-muted-foreground hover:text-emerald-400 hover:bg-muted/50 transition-colors select-none",
            open && "text-emerald-400 bg-muted/60",
            className
          )}
          aria-label="Anexar e opções"
          title="Anexar e ferramentas WhatsApp"
          data-testid="attachment-menu-trigger"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={12}
        className="w-[260px] p-1.5 rounded-2xl border border-[#2a3942] bg-[#182229] backdrop-blur-md shadow-2xl shadow-black/80 flex flex-col z-50 text-[#e9edef] animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="px-3 py-1.5 border-b border-[#2a3942]/60 flex items-center justify-between text-[11px] text-[#8696a0]">
          <span>Opções de Envio</span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <PushPin className="h-3 w-3" weight="fill" /> Fixar / Ocultar
          </span>
        </div>

        <div className="py-1 space-y-0.5 max-h-[380px] overflow-y-auto">
          {ACTION_MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isPinned = pinnedIds.includes(item.id);

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className="w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-3 text-left hover:bg-[#202c33] cursor-pointer transition-colors group select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      item.bgColor
                    )}
                  >
                    <Icon className={cn("h-4 w-4", item.iconColor)} weight="bold" />
                  </div>
                  <span className="text-xs font-medium text-[#e9edef] group-hover:text-white truncate">
                    {item.label}
                  </span>
                </div>

                {/* PIN / HIDE toggle button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(item.id);
                  }}
                  className={cn(
                    "h-6 w-6 rounded-md flex items-center justify-center transition-colors shrink-0",
                    isPinned
                      ? "text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25"
                      : "text-[#8696a0]/50 hover:text-[#8696a0] hover:bg-[#2a3942]"
                  )}
                  title={isPinned ? "Desafixar do rodapé (ocultar)" : "Fixar no rodapé (PIN)"}
                  aria-label={isPinned ? "Desafixar" : "Fixar"}
                >
                  <PushPin
                    className="h-3.5 w-3.5"
                    weight={isPinned ? "fill" : "regular"}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
