import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TagIconBadge, TAG_PHOSPHOR_ICONS } from "./TagIconBadge";
import { getTagDescriptor, extractLeadingEmoji, businessLabel } from "@/core/utils/tagEmojis";
import { getTagColor } from "@/pages/Inbox/utils";
import { Tag, Plus, X, CaretDown } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/lib/utils";

export interface StackedTagsBadgeProps {
  tags?: string[];
  maxVisible?: number;
  size?: "xs" | "sm" | "md";
  interactive?: boolean;
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  className?: string;
  showCountLabel?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

const COMMON_TAG_SUGGESTIONS = [
  "Novo Lead",
  "Orçamento",
  "Quente",
  "Follow-up",
  "Ficha Gerada",
  "VIP",
  "Finalizado",
];

export function StackedTagsBadge({
  tags = [],
  maxVisible = 3,
  size = "sm",
  interactive = true,
  onAddTag,
  onRemoveTag,
  className,
  showCountLabel = false,
  align = "start",
  side = "bottom",
}: StackedTagsBadgeProps) {
  const [open, setOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");

  const visibleTags = tags.slice(0, maxVisible);
  const overflowCount = Math.max(0, tags.length - maxVisible);

  const circleSize = size === "xs" ? "h-5 w-5 text-[10px]" : size === "sm" ? "h-6 w-6 text-xs" : "h-7 w-7 text-sm";
  const iconSize = size === "xs" ? "h-2.5 w-2.5" : size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  const handleAdd = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed || !onAddTag) return;
    onAddTag(trimmed);
    setNewTagInput("");
  };

  const handleAddSuggestion = (suggestion: string) => {
    if (!onAddTag || tags.includes(suggestion)) return;
    onAddTag(suggestion);
  };

  const renderMonochromeVisual = (tag: string) => {
    const descriptor = getTagDescriptor(tag);
    if (!descriptor || !descriptor.value || descriptor.type === "none") {
      return <Tag className={cn(iconSize, "opacity-70 text-foreground/80")} weight="bold" />;
    }

    if (descriptor.type === "icon") {
      const IconComponent = TAG_PHOSPHOR_ICONS[descriptor.value] || Tag;
      return <IconComponent className={cn(iconSize, "opacity-80 text-foreground/90")} weight="bold" />;
    }

    return (
      <span
        className="inline-block shrink-0 select-none leading-none opacity-85 grayscale contrast-125"
        style={{ filter: "grayscale(100%) contrast(120%)" }}
      >
        {descriptor.value}
      </span>
    );
  };

  // Stack component trigger
  const stackTrigger = (
    <div
      className={cn(
        "inline-flex items-center group cursor-pointer select-none",
        interactive && "hover:opacity-90",
        className,
      )}
      onClick={(e) => {
        if (interactive) {
          e.stopPropagation();
        }
      }}
    >
      {tags.length === 0 ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 hover:text-foreground italic py-0.5 transition-colors">
          <Plus className="h-3 w-3 opacity-60" />
          <span>Adicionar etiqueta</span>
        </span>
      ) : (
        <div className="flex items-center -space-x-1.5">
          {visibleTags.map((tag, idx) => {
            const label = businessLabel(tag);
            return (
              <span
                key={`${tag}-${idx}`}
                title={label}
                className={cn(
                  "relative inline-flex items-center justify-center rounded-full border border-border/80 bg-card shadow-xs ring-2 ring-background transition-transform duration-150 hover:scale-125 hover:z-30",
                  circleSize,
                )}
                style={{ zIndex: visibleTags.length - idx }}
              >
                {renderMonochromeVisual(tag)}
              </span>
            );
          })}

          {overflowCount > 0 && (
            <span
              className={cn(
                "relative inline-flex items-center justify-center rounded-full border border-border/80 bg-muted/90 text-muted-foreground font-semibold ring-2 ring-background transition-transform duration-150 hover:scale-110 hover:z-30",
                circleSize,
              )}
              style={{ zIndex: 0 }}
              title={`${overflowCount} outras etiquetas`}
            >
              +{overflowCount}
            </span>
          )}
        </div>
      )}

      {showCountLabel && tags.length > 0 && (
        <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground ml-2 transition-colors inline-flex items-center gap-0.5">
          <span>
            {tags.length} etiqueta{tags.length === 1 ? "" : "s"}
          </span>
          <CaretDown className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
        </span>
      )}
    </div>
  );

  if (!interactive) {
    return stackTrigger;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{stackTrigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={16}
        className="w-[340px] sm:w-[380px] max-w-[calc(100vw-2rem)] p-3.5 bg-card/98 dark:bg-[#0c131d]/98 backdrop-blur-xl border border-border/80 dark:border-border/90 shadow-2xl rounded-2xl z-50 text-foreground animate-in fade-in-0 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Tag className="h-3.5 w-3.5" weight="bold" />
            </div>
            <span className="text-xs font-bold text-foreground">Etiquetas do Lead</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
              {tags.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Fechar card de etiquetas"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Current Tags List */}
        <div className="py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Etiquetas Atribuídas
            </p>
            {tags.length > 0 && (
              <span className="text-[10px] text-muted-foreground/70">
                {tags.length} ativa{tags.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {tags.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2.5 text-center rounded-lg bg-muted/20 border border-dashed border-border/40">
              Nenhuma etiqueta vinculada a este contato.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {tags.map((tag) => (
                <TagIconBadge
                  key={tag}
                  tag={tag}
                  size="xs"
                  colorClass={getTagColor(tag)}
                  interactive={false}
                  className="max-w-[200px]"
                  onRemove={onRemoveTag ? () => onRemoveTag(tag) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add New Tag Input */}
        {onAddTag && (
          <div className="pt-2.5 border-t border-border/40 space-y-2">
            <div className="flex gap-1.5">
              <Input
                aria-label="Nova etiqueta"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Adicionar etiqueta..."
                className="h-8 text-xs bg-muted/20 dark:bg-background/60 rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-8 px-2.5 text-xs font-semibold gap-1 rounded-lg shrink-0"
                aria-label="Confirmar nova etiqueta"
                disabled={!newTagInput.trim()}
                onClick={handleAdd}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar</span>
              </Button>
            </div>

            {/* Quick Suggestions */}
            <div className="pt-0.5">
              <span className="text-[10px] font-medium text-muted-foreground/80 block mb-1">
                Sugestões rápidas:
              </span>
              <div className="flex flex-wrap gap-1">
                {COMMON_TAG_SUGGESTIONS.filter((s) => !tags.includes(s)).slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleAddSuggestion(suggestion)}
                    className="inline-flex items-center gap-1 text-[10px] py-0.5 px-2 rounded-full border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-muted-foreground transition-all"
                  >
                    <Plus className="h-2 w-2" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
