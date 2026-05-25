import type { ReactNode } from "react";
import { CaretLeft } from "@phosphor-icons/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface ChatHeaderBarProps {
  contactName: string;
  phone?: string;
  avatar?: string;
  initials: string;
  isMobile: boolean;
  onBack?: () => void;
  rightActions?: ReactNode;
  statusLabel?: string;
  showStatusDot?: boolean;
}

export function ChatHeaderBar({
  contactName,
  phone,
  avatar,
  initials,
  isMobile,
  onBack,
  rightActions,
  statusLabel,
  showStatusDot = true,
}: ChatHeaderBarProps) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-border/70 bg-card/80 px-3 md:px-4">
      <div className="flex items-center gap-2 md:gap-3">
        {isMobile && (
          <Button variant="ghost" size="icon" className="h-11 min-h-11" onClick={onBack} aria-label="Voltar para conversas">
            <CaretLeft className="h-5 w-5" />
          </Button>
        )}

        <Avatar className="h-10 w-10">
          {avatar ? <AvatarImage src={avatar} alt={contactName} loading="lazy" /> : null}
          <AvatarFallback className="bg-primary/10 font-semibold text-primary">{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <h3 className="font-semibold">{contactName}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {phone || "Sem número"}
            {showStatusDot && <span className="mx-1 text-destructive">•</span>}
            {statusLabel ?? ""}
          </p>
        </div>
      </div>

      {rightActions}
    </div>
  );
}
