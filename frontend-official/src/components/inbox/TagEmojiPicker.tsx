import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowCounterClockwise, Sparkle, MagnifyingGlass, Check } from "@phosphor-icons/react";
import {
  TagVisualDescriptor,
  DETERMINISTIC_ICON_PALETTE,
  POPULAR_BUSINESS_EMOJIS,
  setCustomTagDescriptor,
  resetTagDescriptor,
  cleanTagName,
} from "@/core/utils/tagEmojis";
import { TAG_PHOSPHOR_ICONS } from "./TagIconBadge";
import { cn } from "@/core/lib/utils";

interface TagEmojiPickerProps {
  tag: string;
  currentDescriptor: TagVisualDescriptor;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (descriptor: TagVisualDescriptor) => void;
}

export function TagEmojiPicker({
  tag,
  currentDescriptor,
  children,
  open,
  onOpenChange,
  onSelect,
}: TagEmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<"icons" | "emojis">("emojis");
  const [search, setSearch] = useState("");
  const [monochromeEmoji, setMonochromeEmoji] = useState(false);

  const displayName = cleanTagName(tag) || tag;

  const handleSelectIcon = (iconName: string, label: string) => {
    const desc: TagVisualDescriptor = {
      type: "icon",
      value: iconName,
      isMonochrome: true,
      label,
    };
    setCustomTagDescriptor(tag, desc);
    onSelect?.(desc);
    onOpenChange?.(false);
  };

  const handleSelectEmoji = (emoji: string, label: string) => {
    const desc: TagVisualDescriptor = {
      type: "emoji",
      value: emoji,
      isMonochrome: monochromeEmoji,
      label,
    };
    setCustomTagDescriptor(tag, desc);
    onSelect?.(desc);
    onOpenChange?.(false);
  };

  const handleReset = () => {
    resetTagDescriptor(tag);
    onOpenChange?.(false);
  };

  const handleCustomInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && search.trim()) {
      e.preventDefault();
      const val = search.trim();
      // If entered text is an icon name
      if (TAG_PHOSPHOR_ICONS[val]) {
        handleSelectIcon(val, val);
      } else {
        // Assume emoji or custom character
        handleSelectEmoji(val, val);
      }
    }
  };

  // Filtered lists
  const filteredIcons = DETERMINISTIC_ICON_PALETTE.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredEmojis = POPULAR_BUSINESS_EMOJIS.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.emoji.includes(search) ||
      item.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-80 p-3 bg-popover text-popover-foreground border-border shadow-xl rounded-xl z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkle className="h-3.5 w-3.5 text-primary shrink-0" weight="fill" />
            <h4 className="text-xs font-semibold truncate">
              Personalizar: <span className="text-primary">{displayName}</span>
            </h4>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground gap-1"
            title="Restaurar ícone/emoji padrão"
          >
            <ArrowCounterClockwise className="h-3 w-3" />
            Padrão
          </Button>
        </div>

        {/* Tab Toggle: Monochromatic Icons vs Emojis */}
        <div className="flex rounded-lg bg-muted/60 p-0.5 mb-2.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("icons")}
            className={cn(
              "flex-1 py-1 px-2 rounded-md font-medium transition-all text-center",
              activeTab === "icons"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Ícones Monocromáticos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("emojis")}
            className={cn(
              "flex-1 py-1 px-2 rounded-md font-medium transition-all text-center",
              activeTab === "emojis"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Emojis
          </button>
        </div>

        {/* Search / Custom input */}
        <div className="relative mb-2.5">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleCustomInput}
            placeholder={
              activeTab === "icons"
                ? "Buscar ícone ou pressione Enter..."
                : "Buscar emoji ou colar emoji e Enter..."
            }
            className="h-7 pl-8 text-xs bg-background"
          />
        </div>

        {/* Content Area */}
        {activeTab === "icons" ? (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Ícones vetoriais com a cor da etiqueta</span>
              <span className="text-[9px] font-mono">{filteredIcons.length} disponíveis</span>
            </p>
            <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto pr-1">
              {filteredIcons.map((item) => {
                const IconComp = TAG_PHOSPHOR_ICONS[item.name];
                if (!IconComp) return null;
                const isSelected =
                  currentDescriptor.type === "icon" && currentDescriptor.value === item.name;

                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelectIcon(item.name, item.label)}
                    className={cn(
                      "flex flex-col items-center justify-center h-9 rounded-md transition-all hover:bg-primary/10 hover:text-primary",
                      isSelected
                        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-xs"
                        : "text-foreground/80 bg-muted/20",
                    )}
                    title={`${item.label} (${item.name})`}
                  >
                    <IconComp className="h-4 w-4" weight="bold" />
                  </button>
                );
              })}
              {filteredIcons.length === 0 && (
                <div className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                  Nenhum ícone encontrado. Pressione Enter para salvar como emoji customizado.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Monochromatic toggle for emojis */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] text-muted-foreground">Efeito monocromático:</span>
              <button
                type="button"
                onClick={() => setMonochromeEmoji(!monochromeEmoji)}
                className={cn(
                  "h-5 px-2 rounded-full text-[10px] font-medium transition-colors border",
                  monochromeEmoji
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border/50",
                )}
              >
                {monochromeEmoji ? "Monocromático Ativo" : "Cores Naturais"}
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1 max-h-44 overflow-y-auto pr-1">
              {filteredEmojis.map((item) => {
                const isSelected =
                  currentDescriptor.type === "emoji" && currentDescriptor.value === item.emoji;

                return (
                  <button
                    key={item.emoji}
                    type="button"
                    onClick={() => handleSelectEmoji(item.emoji, item.label)}
                    className={cn(
                      "flex items-center justify-center h-9 rounded-md text-base transition-all hover:scale-110 hover:bg-muted",
                      isSelected
                        ? "ring-2 ring-primary bg-primary/10"
                        : "bg-muted/20 hover:bg-muted/50",
                    )}
                    style={monochromeEmoji ? { filter: "grayscale(100%) opacity(0.85)" } : undefined}
                    title={`${item.label} (${item.category})`}
                  >
                    {item.emoji}
                  </button>
                );
              })}
              {filteredEmojis.length === 0 && (
                <div className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                  Pressione Enter para usar &quot;{search}&quot; como emoji.
                </div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
