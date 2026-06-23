import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type OperationalTone = "online" | "offline" | "syncing" | "warning" | "degraded";

const toneClassMap: Record<OperationalTone, string> = {
  online: "bg-success/15 text-success border-success/30",
  offline: "bg-muted/70 text-muted-foreground border-border",
  syncing: "bg-info/15 text-info border-info/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  degraded: "bg-destructive/10 text-destructive border-destructive/25",
};

interface OperationalStatusBadgeProps {
  label: string;
  tone: OperationalTone;
  pulse?: boolean;
  className?: string;
}

export function OperationalStatusBadge({ label, tone, pulse = false, className }: OperationalStatusBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-6 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-wide",
        toneClassMap[tone],
        className,
      )}
    >
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full",
          pulse && "pulse",
          tone === "online"
            ? "bg-success"
            : tone === "syncing"
              ? "bg-info"
              : tone === "warning"
                ? "bg-warning"
                : tone === "degraded"
                  ? "bg-destructive"
                  : "bg-muted-foreground",
        )}
      />
      {label}
    </Badge>
  );
}
