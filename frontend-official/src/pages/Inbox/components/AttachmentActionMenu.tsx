import React, { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Camera,
  Headphones,
  User,
  ChartBarHorizontal,
  Calendar,
  Sticker,
  Storefront,
  Lightning,
  Receipt,
  PushPin,
  Paperclip,
} from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/core/lib/utils";

// Authentic WhatsApp Web Pix Icon (Diamond shape)
export function PixDiamondIcon({ className = "h-5 w-5", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M12.0001 2.50024L18.7072 9.20735C19.0977 9.59787 19.0977 10.231 18.7072 10.6216L12.0001 17.3287L5.29297 10.6216C4.90244 10.231 4.90244 9.59787 5.29297 9.20735L12.0001 2.50024ZM12.0001 5.32867L7.41429 9.91447L12.0001 14.5003L16.5859 9.91447L12.0001 5.32867Z" />
    </svg>
  );
}

export interface ActionMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  defaultPinned?: boolean;
}

export const ACTION_MENU_ITEMS: ActionMenuItem[] = [
  {
    id: "documento",
    label: "Documento",
    icon: FileText,
    iconColor: "text-[#7f66ff]",
  },
  {
    id: "fotos_videos",
    label: "Fotos e vídeos",
    icon: ImageIcon,
    iconColor: "text-[#007bfc]",
  },
  {
    id: "camera",
    label: "Câmera",
    icon: Camera,
    iconColor: "text-[#ec407a]",
  },
  {
    id: "audio",
    label: "Áudio",
    icon: Headphones,
    iconColor: "text-[#ff7800]",
  },
  {
    id: "contato",
    label: "Contato",
    icon: User,
    iconColor: "text-[#0288d1]",
  },
  {
    id: "enquete",
    label: "Enquete",
    icon: ChartBarHorizontal,
    iconColor: "text-[#ffb703]",
  },
  {
    id: "evento",
    label: "Evento",
    icon: Calendar,
    iconColor: "text-[#eb3b5a]",
  },
  {
    id: "nova_figurinha",
    label: "Nova figurinha",
    icon: Sticker,
    iconColor: "text-[#00a884]",
  },
  {
    id: "pix",
    label: "Pix",
    icon: PixDiamondIcon,
    iconColor: "text-[#00d68f]",
  },
  {
    id: "catalogo",
    label: "Catálogo",
    icon: Storefront,
    iconColor: "text-[#53bdeb]",
    defaultPinned: true,
  },
  {
    id: "quick_replies",
    label: "Resposta rápida",
    icon: Lightning,
    iconColor: "text-[#fbc02d]",
    defaultPinned: true,
  },
  {
    id: "cobrar",
    label: "Cobrar",
    icon: Receipt,
    iconColor: "text-[#00a3da]",
    defaultPinned: true,
  },
];

const STORAGE_KEY = "zapai_inbox_pinned_actions";
const DEFAULT_PINNED = ["catalogo", "cobrar", "quick_replies", "pix"];

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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
            "h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] transition-colors select-none",
            open && "text-[#e9edef] bg-[#202c33]",
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
        className="w-[230px] p-1.5 rounded-2xl border border-[#2a3942] bg-[#202c33] backdrop-blur-md shadow-2xl shadow-black/80 flex flex-col z-50 text-[#e9edef] animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
      >
        <div className="py-1 space-y-0.5 max-h-[440px] overflow-y-auto pr-0.5">
          {ACTION_MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isPinned = pinnedIds.includes(item.id);

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className="w-full px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-left hover:bg-[#111b21]/70 cursor-pointer transition-colors group select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={cn("h-5 w-5 flex items-center justify-center shrink-0", item.iconColor)}>
                    <Icon className="h-5 w-5" weight="fill" />
                  </div>
                  <span className="text-[14px] font-normal text-[#e9edef] group-hover:text-white truncate">
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
                    "h-6 w-6 rounded-md flex items-center justify-center transition-all shrink-0",
                    isPinned
                      ? "text-emerald-400 bg-emerald-500/15 opacity-100 hover:bg-emerald-500/25"
                      : "text-[#8696a0] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[#2a3942]"
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
