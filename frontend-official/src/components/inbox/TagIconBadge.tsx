import React, { useState, useEffect } from "react";
import {
  Target,
  Star,
  Briefcase,
  CurrencyDollar,
  Flame,
  Warning,
  FileText,
  Wrench,
  Package,
  CreditCard,
  Calendar,
  Sun,
  Snowflake,
  Question,
  Info,
  RocketLaunch,
  ShieldCheck,
  Lightbulb,
  Heart,
  Crown,
  Lightning,
  Trophy,
  Key,
  Gift,
  Tag,
  CheckCircle,
  XCircle,
  Handshake,
  ChatText,
  Bell,
  Headset,
  Storefront,
  Sparkle,
  Clock,
  BookmarkSimple,
  UserPlus,
  ArrowDownLeft,
  Scroll,
  X,
  Icon,
} from "@phosphor-icons/react";
import { cn } from "@/core/lib/utils";
import {
  getTagDescriptor,
  extractLeadingEmoji,
  cleanTagName,
  TagVisualDescriptor,
} from "@/core/utils/tagEmojis";
import { TagEmojiPicker } from "./TagEmojiPicker";

// Map of Phosphor icons supported for monochromatic tag rendering
export const TAG_PHOSPHOR_ICONS: Record<string, Icon> = {
  Target,
  Star,
  Briefcase,
  CurrencyDollar,
  Flame,
  Warning,
  FileText,
  Wrench,
  Package,
  CreditCard,
  Calendar,
  Sun,
  Snowflake,
  Question,
  Info,
  RocketLaunch,
  ShieldCheck,
  Lightbulb,
  Heart,
  Crown,
  Lightning,
  Trophy,
  Key,
  Gift,
  Tag,
  CheckCircle,
  XCircle,
  Handshake,
  ChatText,
  Bell,
  Headset,
  Storefront,
  Sparkle,
  Clock,
  BookmarkSimple,
  UserPlus,
  ArrowDownLeft,
  Scroll,
};

export interface TagIconBadgeProps {
  tag: string;
  className?: string;
  colorClass?: string;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
  interactive?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
}

export function TagIconBadge({
  tag,
  className,
  colorClass,
  size = "xs",
  showName = true,
  interactive = true,
  onRemove,
  onClick,
}: TagIconBadgeProps) {
  const [descriptor, setDescriptor] = useState<TagVisualDescriptor>(() => getTagDescriptor(tag));
  const [pickerOpen, setPickerOpen] = useState(false);

  // Re-read descriptor when tag changes or when global tag icons are updated
  useEffect(() => {
    setDescriptor(getTagDescriptor(tag));

    const handleUpdate = () => {
      setDescriptor(getTagDescriptor(tag));
    };

    if (typeof window !== "undefined") {
      window.addEventListener("zapflow:tag-icons-updated", handleUpdate);
      return () => {
        window.removeEventListener("zapflow:tag-icons-updated", handleUpdate);
      };
    }
  }, [tag]);

  const { cleanText } = extractLeadingEmoji(tag);
  const displayName = cleanText || tag;

  // Render the visual element (Phosphor Icon or Emoji)
  const renderVisual = () => {
    if (descriptor.type === "icon") {
      const IconComponent = TAG_PHOSPHOR_ICONS[descriptor.value] || Tag;
      const iconSize = size === "xs" ? "h-3 w-3" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
      return <IconComponent className={cn(iconSize, "shrink-0 currentColor")} weight="bold" />;
    }

    // Emoji type
    const emojiSize = size === "xs" ? "text-[11px]" : size === "sm" ? "text-xs" : "text-sm";
    if (descriptor.isMonochrome) {
      return (
        <span
          className={cn(emojiSize, "inline-block shrink-0 select-none leading-none opacity-85")}
          style={{ filter: "grayscale(100%)" }}
          title={descriptor.label || displayName}
        >
          {descriptor.value}
        </span>
      );
    }

    return (
      <span
        className={cn(emojiSize, "inline-block shrink-0 select-none leading-none")}
        title={descriptor.label || displayName}
      >
        {descriptor.value}
      </span>
    );
  };

  const badgeSizeClasses = {
    xs: "py-0.5 px-1.5 text-[11px] gap-1",
    sm: "py-1 px-2 text-xs gap-1.5",
    md: "py-1.5 px-2.5 text-sm gap-2",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-medium transition-all duration-150 select-none",
        badgeSizeClasses[size],
        colorClass || "bg-muted/40 text-foreground/80 border-border/50",
        className,
      )}
      onClick={onClick}
    >
      {interactive ? (
        <TagEmojiPicker
          tag={tag}
          currentDescriptor={descriptor}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        >
          <button
            type="button"
            className="inline-flex items-center justify-center rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={`Alterar emoji de "${displayName}"`}
            onClick={(e) => {
              e.stopPropagation();
              setPickerOpen(!pickerOpen);
            }}
          >
            {renderVisual()}
          </button>
        </TagEmojiPicker>
      ) : (
        <span className="inline-flex items-center justify-center">{renderVisual()}</span>
      )}

      {showName && <span className="truncate leading-none">{displayName}</span>}

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Remover etiqueta ${displayName}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
