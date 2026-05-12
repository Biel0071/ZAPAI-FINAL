import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-16 px-6 animate-fade-in", className)}>
      <div className="rounded-2xl bg-muted/40 p-5 ring-1 ring-border/50">
        {icon}
      </div>
      <div className="text-center max-w-xs">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
