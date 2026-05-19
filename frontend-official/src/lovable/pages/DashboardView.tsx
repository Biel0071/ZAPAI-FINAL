import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardLovableViewModel } from "@/adapters/lovable/dashboardAdapter";

export function DashboardView({ viewModel }: { viewModel: DashboardLovableViewModel }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm text-muted-foreground">Fila operacional</p>
            <h3 className="mt-2 font-display text-4xl font-bold">0</h3>
          </div>
          <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            0 pendentes
          </Badge>
        </CardContent>
      </Card>

      <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm text-muted-foreground">Status do runtime</p>
            <h3 className="mt-2 font-display text-4xl font-bold">{viewModel.runtimeStatus === "online" ? "Online" : "Offline"}</h3>
          </div>
          <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {viewModel.runtimeStatus === "online" ? "ONLINE" : "OFFLINE"}
          </Badge>
        </CardContent>
      </Card>

      <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-sm text-muted-foreground">Saúde do websocket</p>
            <h3 className="mt-2 font-display text-4xl font-bold">{viewModel.websocketHealthy ? 1 : 0}</h3>
          </div>
          <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {viewModel.websocketHealthy ? "ONLINE" : "DEGRADADO"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
