import type { ReactNode } from "react";
import { CaretLeft } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatHeaderBarProps {
  contactName: string;
  avatar?: string;
  initials: string;
  isMobile: boolean;
  onBack?: () => void;
  rightActions?: ReactNode;
  statusLabel?: string;
}

export function ChatHeaderBar({
  contactName,
  avatar,
  initials,
  isMobile,
  onBack,
  rightActions,
  statusLabel,
}: ChatHeaderBarProps) {
  const isOnlineOrTyping = statusLabel === "online" || statusLabel === "digitando...";

  return (
    <div className="flex h-16 items-center justify-between border-b border-border/70 bg-card/85 px-3 md:px-4 backdrop-blur supports-[backdrop-filter]:bg-card/50 select-none">
      <div className="flex items-center gap-2 md:gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" className="h-11 min-h-11" onClick={onBack} aria-label="Voltar para conversas">
            <CaretLeft className="h-5 w-5" />
          </Button>
        )}

        <Avatar className="h-11 w-11 border border-border/50">
          {avatar ? <AvatarImage src={avatar} alt={contactName} loading="lazy" /> : null}
          <AvatarFallback className="bg-primary/10 font-bold text-sm text-primary">{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex flex-col justify-center">
          <h3 className="font-semibold text-sm md:text-base leading-tight text-foreground">{contactName}</h3>
          {statusLabel && (
            <span className={cn(
              "text-xs leading-tight text-muted-foreground",
              isOnlineOrTyping && "text-emerald-400 font-medium animate-pulse"
            )}>
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {rightActions}
    </div>
  );
}
