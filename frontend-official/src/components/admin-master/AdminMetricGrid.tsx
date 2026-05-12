import { Pulse, Database, Cpu, HardDrives, ClockCountdown } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminMetric } from "@/types/adminMaster";

type Props = {
  metrics: AdminMetric[];
  loading: boolean;
};

function metricIcon(key: string) {
  if (key.includes("database")) return Database;
  if (key.includes("cpu") || key.includes("ram")) return Cpu;
  if (key.includes("disk")) return HardDrives;
  if (key.includes("uptime")) return ClockCountdown;
  return Pulse;
}

function renderValue(value: AdminMetric["value"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  return value;
}

export function AdminMetricGrid({ metrics, loading }: Props) {
  if (loading) {
    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <Card key={index} className="metric-card rounded-lg border-border/80 bg-card/90">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metricIcon(metric.key);
        return (
          <Card key={metric.key} className="metric-card rounded-lg border-border/80 bg-card/90">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{renderValue(metric.value)}</p>
                  {metric.helper && <p className="mt-1 text-xs text-muted-foreground">{metric.helper}</p>}
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/70 p-2.5">
                  <Icon className="h-4 w-4 text-primary" weight="duotone" />
                </div>
              </div>

              {metric.status && (
                <div className="mt-3">
                  <Badge className={`status-badge ${metric.status === "online" ? "status-online" : metric.status === "offline" ? "status-offline" : "status-busy"}`}>
                    {metric.status}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
