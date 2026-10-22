import { useState, type ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  lastSeenLabel?: string;
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
  lastSeenLabel,
  statusBadges,
}: ChatHeaderBarProps) {
  const [showDetailedPresence, setShowDetailedPresence] = useState(false);
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
          <div className="relative shrink-0">
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

            {/* Presença do contato: Bolinha Verde para Online / Vermelha para Offline */}
            <span
              className="absolute -bottom-0.5 -right-0.5 z-10 flex h-3.5 w-3.5 items-center justify-center pointer-events-none"
              title={isOnlineOrTyping ? "Online agora" : "Offline"}
            >
              {isOnlineOrTyping ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-background shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-background shadow-xs" />
              )}
            </span>
          </div>

          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="truncate font-semibold text-xs sm:text-sm md:text-base leading-tight text-foreground flex items-center gap-1.5">
                <span className="truncate">{contactName}</span>
              </h3>
            </div>
            {phoneLabel && (
              <span className="truncate text-[10px] sm:text-[11px] leading-tight text-muted-foreground font-mono">
                {phoneLabel}
              </span>
            )}
            <div className="mt-0.5 sm:mt-1 flex min-w-0 flex-wrap items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetailedPresence((prev) => !prev);
                }}
                className={cn(
                  "text-[10px] leading-tight font-medium flex items-center gap-1 cursor-pointer hover:underline px-1 py-0.5 rounded transition-colors",
                  isOnlineOrTyping
                    ? "text-emerald-400 font-semibold hover:bg-emerald-500/10"
                    : "text-muted-foreground/80 hover:bg-muted"
                )}
                title="Clique para alternar entre status e última visualização"
              >
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                    isOnlineOrTyping ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                  )}
                />
                <span>
                  {showDetailedPresence
                    ? (isOnlineOrTyping
                        ? "Online agora"
                        : (lastSeenLabel ? `Visto por último: ${lastSeenLabel}` : "Visto recentemente"))
                    : (statusLabel || (isOnlineOrTyping ? "online" : "offline"))}
                </span>
              </button>
              {statusBadges}
            </div>
          </div>
        </div>
      </div>

      {rightActions}
    </div>
  );
}
