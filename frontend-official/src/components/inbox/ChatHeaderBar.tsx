import { type ReactNode, useMemo, useState, useEffect } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getTagEmoji, cleanTagName } from "@/core/utils/tagEmojis";
import { cn } from "@/core/lib/utils";

interface ChatHeaderBarProps {
  contactName: string;
  avatar?: string;
  initials: string;
  isMobile: boolean;
  onBack?: () => void;
  onContactClick?: () => void;
  rightActions?: ReactNode;
  statusLabel?: string;
  phoneLabel?: string;
  statusBadges?: ReactNode;
  tags?: string[];
}

export function ChatHeaderBar({
  contactName,
  avatar,
  initials,
  isMobile,
  onBack,
  onContactClick,
  rightActions,
  statusLabel,
  phoneLabel,
  statusBadges,
  tags,
}: ChatHeaderBarProps) {
  const [tagVersion, setTagVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTagVersion((v) => v + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("zapflow:tag-icons-updated", handleUpdate);
      return () => window.removeEventListener("zapflow:tag-icons-updated", handleUpdate);
    }
  }, []);

  const tagEmojis = useMemo(() => {
    if (!tags || !Array.isArray(tags) || tags.length === 0) return [];
    const results: { tag: string; emoji: string; name: string }[] = [];
    for (const t of tags) {
      const emoji = getTagEmoji(t);
      if (emoji) {
        results.push({
          tag: t,
          emoji,
          name: cleanTagName(t) || t,
        });
      }
    }
    return results;
  }, [tags, tagVersion]);
  const isOnlineOrTyping = statusLabel === "online" || statusLabel === "digitando..." || statusLabel === "gravando áudio...";

  return (
    <div className="flex min-h-16 items-center justify-between gap-2 sm:gap-3 border-b border-border/70 bg-card/85 px-2 sm:px-3 py-2 md:px-4 backdrop-blur supports-[backdrop-filter]:bg-card/50 select-none relative z-20">
      <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 min-w-0 flex-1">
        {isMobile && Boolean(onBack) && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-9 sm:w-9 rounded-full hover:bg-muted text-foreground flex items-center justify-center shrink-0 -ml-1 transition-all active:scale-95"
            onClick={onBack}
            aria-label="Voltar para a lista de conversas"
            title="Voltar para conversas"
          >
            <ArrowLeft className="h-5 w-5" weight="bold" />
          </Button>
        )}

        <div
          role={onContactClick ? "button" : undefined}
          tabIndex={onContactClick ? 0 : undefined}
          onClick={onContactClick}
          onKeyDown={(e) => {
            if (onContactClick && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onContactClick();
            }
          }}
          className={cn(
            "flex items-center gap-2 sm:gap-3 min-w-0 flex-1",
            onContactClick && "cursor-pointer rounded-lg p-1 -m-1 hover:bg-muted/50 transition-colors"
          )}
          title={onContactClick ? "Ver detalhes do contato" : undefined}
        >
          <Avatar className="h-10 w-10 sm:h-11 sm:w-11 border border-border/50 shrink-0">
            {avatar ? (
              <AvatarImage
                src={avatar}
                alt={contactName}
                loading="lazy"
                className="object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
            <AvatarFallback className="bg-primary/10 font-bold text-xs sm:text-sm text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="truncate font-semibold text-xs sm:text-sm md:text-base leading-tight text-foreground">
                {contactName}
              </h3>
              {tagEmojis.length > 0 && (
                <div className="hidden sm:inline-flex items-center gap-1 shrink-0 ml-1">
                  {tagEmojis.slice(0, 3).map((item, idx) => (
                    <span
                      key={idx}
                      title={item.name}
                      className="text-xs md:text-sm leading-none select-none inline-block hover:scale-110 transition-transform cursor-default"
                    >
                      {item.emoji}
                    </span>
                  ))}
                  {tagEmojis.length > 3 && (
                    <span className="text-[10px] text-muted-foreground/70 font-mono font-normal">
                      +{tagEmojis.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
            {phoneLabel && (
              <span className="truncate text-[10px] sm:text-[11px] leading-tight text-muted-foreground font-mono">
                {phoneLabel}
              </span>
            )}
            <div className="mt-0.5 sm:mt-1 flex min-w-0 flex-wrap items-center gap-1 sm:gap-1.5">
              {statusLabel && (
                <span
                  className={cn(
                    "text-[10px] leading-tight text-muted-foreground",
                    isOnlineOrTyping && "text-emerald-400 font-medium"
                  )}
                >
                  {statusLabel}
                </span>
              )}
              {statusBadges}
            </div>
          </div>
        </div>
      </div>

      {rightActions}
    </div>
  );
}
