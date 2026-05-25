import { Flame, Snowflake, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";

type TemperatureValue = "quente" | "morno" | "frio";

type Score = number | null | undefined;

function resolveTemperature(input?: string | Score): TemperatureValue {
  if (typeof input === "string") {
    const normalized = input.toLowerCase();
    if (["hot", "quente", "ready_to_buy"].includes(normalized)) return "quente";
    if (["warm", "morno"].includes(normalized)) return "morno";
    return "frio";
  }

  const score = typeof input === "number" ? input : 0;
  if (score >= 80) return "quente";
  if (score >= 40) return "morno";
  return "frio";
}

const CONFIG: Record<TemperatureValue, { label: string; icon: typeof Flame; cls: string }> = {
  quente: { label: "Quente", icon: Flame, cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  morno: { label: "Morno", icon: Thermometer, cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  frio: { label: "Frio", icon: Snowflake, cls: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
};

interface TemperatureBadgeProps {
  temperature?: string;
  score?: Score;
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
}

export function TemperatureBadge({
  temperature,
  score,
  size = "sm",
  className,
  showLabel = true,
}: TemperatureBadgeProps) {
  const resolved = resolveTemperature(temperature ?? score);
  const config = CONFIG[resolved];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        config.cls,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {showLabel && config.label}
    </span>
  );
}
