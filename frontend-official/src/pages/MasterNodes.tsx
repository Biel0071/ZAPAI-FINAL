import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowsClockwise, Cpu, HardDrives, Lightning, Network, Pulse, Timer } from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMasterNodesControlPlane } from "@/state/hooks/useMasterNodesControlPlane";
import type { NodeControlPlane, RuntimeServiceState } from "@/core/types/masterNode";

function statusClasses(status: NodeControlPlane["status"]) {
  if (status === "ONLINE") return "status-online";
  if (status === "UNHEALTHY") return "bg-destructive/15 text-destructive";
  if (status === "DEGRADED") return "status-busy";
  if (status === "DEPLOYING" || status === "RESTARTING" || status === "RECOVERING") return "bg-info/15 text-info";
  if (status === "UNKNOWN") return "bg-muted text-muted-foreground";
  return "status-offline";
}

function serviceClasses(state: RuntimeServiceState) {
  if (state === "running") return "bg-success/15 text-success";
  if (state === "degraded") return "bg-warning/15 text-warning";
  if (state === "stopped") return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
}

function metric(value: number | null, suffix = "%") {
  if (value === null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}${suffix}`;
}

function uptimeLabel(value: string | null) {
  if (!value) return "—";
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return value;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function servicePill(label: string, value: RuntimeServiceState) {
  return (
    <div className={`rounded-md px-2 py-1 text-[11px] font-medium ${serviceClasses(value)}`} key={label}>
      {label}: {value}
    </div>
  );
}

export default function MasterNodes() {
  const { nodes, cluster, loading, error, refresh } = useMasterNodesControlPlane();

  const clusterCards = useMemo(
    () => [
      { label: "Total nodes", value: cluster?.totalNodes ?? null, icon: Network },
      { label: "Nodes online", value: cluster?.onlineNodes, icon: Lightning },
      { label: "Total sessões", value: cluster?.totalSessions, icon: Pulse },
      { label: "Mensagens", value: cluster?.totalMessages, icon: Timer },
      { label: "Queue", value: cluster?.queueSize, icon: HardDrives },
      { label: "Websocket", value: cluster?.websocketConnections, icon: Cpu },
      { label: "Nodes unhealthy", value: cluster?.unhealthyNodes, icon: Pulse },
      { label: "Deploys falhos", value: cluster?.failedDeploys, icon: Lightning },
      { label: "Redis MB", value: cluster?.redisUsageMb, icon: HardDrives },
      { label: "Postgres MB", value: cluster?.postgresUsageMb, icon: HardDrives },
    ],
    [cluster],
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header title="Control Plane · Nodes" subtitle="Orquestração multi-VPS com monitoramento em tempo real" />
      <div className="page-container section-stack">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {clusterCards.map((item) => (
            <Card key={item.label} className="metric-card rounded-lg">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-bold font-display">{item.value == null ? "—" : item.value.toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-card rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display text-lg">VPS Nodes conectadas</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Status engine: ONLINE · OFFLINE · DEGRADED · DEPLOYING · RESTARTING · UNHEALTHY · RECOVERING</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <ArrowsClockwise className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

            {nodes.length === 0 ? (
              <div className="rounded-lg border border-border/70 bg-card/50 p-8 text-center text-sm text-muted-foreground">
                Nenhum node reportado pelo backend no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                {nodes.map((node) => (
                  <Card key={node.id} className="metric-card rounded-lg border-border/70 bg-card/80">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold">{node.name}</p>
                          <p className="text-xs text-muted-foreground">{node.hostname ?? "sem hostname"} · {node.provider}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`status-badge ${statusClasses(node.status)}`}>{node.status}</Badge>
                          <Badge className={`status-badge ${node.health === "healthy" ? "status-online" : node.health === "unhealthy" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                            {node.health}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                        <div>IP: <span className="text-foreground">{node.publicIp ?? "—"}</span></div>
                        <div>Uptime: <span className="text-foreground">{uptimeLabel(node.uptime)}</span></div>
                        <div>Latência: <span className="text-foreground">{node.latencyMs == null ? "—" : `${node.latencyMs}ms`}</span></div>
                        <div>Sessões: <span className="text-foreground">{node.whatsappSessions ?? "—"}</span></div>
                        <div>Versão: <span className="text-foreground">{node.build.version ?? "—"}</span></div>
                        <div>Build: <span className="text-foreground">{node.build.buildHash ?? "—"}</span></div>
                        <div>Sync: <span className="text-foreground">{node.lastSyncAt ?? "—"}</span></div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {servicePill("Docker", node.infra.docker)}
                        {servicePill("Nginx", node.infra.nginx)}
                        {servicePill("Redis", node.infra.redis)}
                        {servicePill("Postgres", node.infra.postgres)}
                        {servicePill("Websocket", node.infra.websocket)}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                        <div className="rounded-md border border-border/70 bg-card/70 p-2">
                          <p className="text-muted-foreground">CPU</p>
                          <p className="font-semibold text-foreground">{metric(node.metrics?.cpuPercent ?? null)}</p>
                        </div>
                        <div className="rounded-md border border-border/70 bg-card/70 p-2">
                          <p className="text-muted-foreground">RAM</p>
                          <p className="font-semibold text-foreground">{metric(node.metrics?.ramPercent ?? null)}</p>
                        </div>
                        <div className="rounded-md border border-border/70 bg-card/70 p-2">
                          <p className="text-muted-foreground">Disco</p>
                          <p className="font-semibold text-foreground">{metric(node.metrics?.diskPercent ?? null)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild size="sm" className="h-8">
                          <Link to={`/nodes/${encodeURIComponent(node.id)}`}>Abrir detalhes</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="h-8">
                          <Link to={`/deployments?node=${encodeURIComponent(node.id)}`}>Deploy center</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
