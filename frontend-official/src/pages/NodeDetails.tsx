import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { ArrowsClockwise, Broadcast, CloudArrowUp, Cpu, Database, HardDrives, Lightning } from "@phosphor-icons/react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNodeDetailsControlPlane } from "@/hooks/useNodeDetailsControlPlane";
import { useMasterNodesControlPlane } from "@/hooks/useMasterNodesControlPlane";
import type { DeployAction } from "@/services/masterNodeService";

const DEPLOY_ACTIONS: Array<{ key: DeployAction; label: string }> = [
  { key: "deployLatest", label: "Deploy latest" },
  { key: "restartNode", label: "Restart node" },
  { key: "restartBackend", label: "Restart backend" },
  { key: "restartNginx", label: "Restart nginx" },
  { key: "clearCache", label: "Clear cache" },
  { key: "pruneDocker", label: "Prune docker" },
  { key: "rebuildFrontend", label: "Rebuild frontend" },
  { key: "rotateLogs", label: "Rotate logs" },
  { key: "syncEnv", label: "Sync env" },
  { key: "updateCompose", label: "Update compose" },
];

function stat(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}${suffix}`;
}

export default function NodeDetails() {
  const { id } = useParams<{ id: string }>();
  const { nodes } = useMasterNodesControlPlane();
  const { bundle, loading, actionLoading, timeline, refresh, runAction, moveSession } = useNodeDetailsControlPlane(id);

  const node = bundle.node;
  const safeContainers = Array.isArray(bundle.containers) ? bundle.containers : [];
  const safeSessions = Array.isArray(bundle.sessions) ? bundle.sessions : [];
  const safeTimeline = Array.isArray(timeline) ? timeline : [];
  const safeLogs = Array.isArray(bundle.logs) ? bundle.logs : [];
  const safeDiagnostics = Array.isArray(bundle.diagnostics) ? bundle.diagnostics : [];

  const metricsSeries = useMemo(
    () =>
      bundle.metricsSeries.map((point) => ({
        at: new Date(point.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        cpu: point.cpuPercent ?? 0,
        ram: point.ramPercent ?? 0,
        disk: point.diskPercent ?? 0,
        netIn: point.networkInKbps ?? 0,
        netOut: point.networkOutKbps ?? 0,
      })),
    [bundle.metricsSeries],
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header
        title={node ? `${node.name} · Node Details` : "Node Details"}
        subtitle="Overview, métricas, containers, sessões, deploys, logs e diagnóstico"
        runtimeState={node?.status === "ONLINE" ? "running" : node?.status === "DEPLOYING" || node?.status === "RESTARTING" ? "starting" : "offline"}
      />

      <div className="page-container section-stack">
        <Card className="glass-card rounded-lg">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge className="status-badge status-online">{node?.status ?? "OFFLINE"}</Badge>
              <span>Host: <span className="text-foreground">{node?.hostname ?? "—"}</span></span>
              <span>IP: <span className="text-foreground">{node?.publicIp ?? "—"}</span></span>
              <span>Versão: <span className="text-foreground">{node?.build?.version ?? "—"}</span></span>
              <span>Build: <span className="text-foreground">{node?.build?.buildHash ?? "—"}</span></span>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <ArrowsClockwise className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Recarregar
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="containers">Containers</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="deployments">Deployments</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="runtime">Runtime</TabsTrigger>
            <TabsTrigger value="websocket">Websocket</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">CPU</p><p className="text-xl font-bold">{stat(node?.metrics?.cpuPercent, "%")}</p></CardContent></Card>
              <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">RAM</p><p className="text-xl font-bold">{stat(node?.metrics?.ramPercent, "%")}</p></CardContent></Card>
              <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Disk</p><p className="text-xl font-bold">{stat(node?.metrics?.diskPercent, "%")}</p></CardContent></Card>
              <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Queue</p><p className="text-xl font-bold">{stat(node?.metrics?.queueSize)}</p></CardContent></Card>
              <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Redis MB</p><p className="text-xl font-bold">{stat(node?.metrics?.redisMemoryMb)}</p></CardContent></Card>
              <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sessões</p><p className="text-xl font-bold">{stat(node?.metrics?.activeSessions)}</p></CardContent></Card>
            </div>

            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Deploy Center</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                {DEPLOY_ACTIONS.map((action) => (
                  <Button
                    key={action.key}
                    size="sm"
                    variant={action.key === "deployLatest" ? "default" : "outline"}
                    className="h-8 justify-start"
                    disabled={Boolean(actionLoading)}
                    onClick={() => void runAction(action.key)}
                  >
                    <CloudArrowUp className="mr-1 h-3.5 w-3.5" />
                    {actionLoading === action.key ? "Executando..." : action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Deployment timeline</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {safeTimeline.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-md border border-border/70 bg-card/70 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{event.action}</span>
                      <Badge className="status-badge status-busy">{event.status}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{event.startedAt ?? "—"} → {event.finishedAt ?? "em andamento"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Healthcheck: {event.healthcheckProgress ?? 0}%</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">CPU/RAM/Disk realtime</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricsSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="at" />
                    <YAxis />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    />
                    <Line type="monotone" dataKey="cpu" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ram" stroke="hsl(var(--info))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="disk" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Network throughput</CardTitle></CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metricsSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="at" />
                    <YAxis />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="netIn" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.2)" />
                    <Area type="monotone" dataKey="netOut" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="containers">
            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Containers</CardTitle></CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Container</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>CPU</TableHead>
                      <TableHead>RAM</TableHead>
                      <TableHead>Restart</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeContainers.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell><Badge className="status-badge status-online">{item.status}</Badge></TableCell>
                        <TableCell>{item.image ?? "—"}</TableCell>
                        <TableCell>{stat(item.cpuPercent, "%")}</TableCell>
                        <TableCell>{stat(item.ramMb, " MB")}</TableCell>
                        <TableCell>{item.restartedAt ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Multi-node session routing</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {safeSessions.map((session) => (
                  <div key={session.sessionId} className="grid grid-cols-1 gap-2 rounded-md border border-border/70 bg-card/70 p-3 xl:grid-cols-[1fr,1fr,220px]">
                    <div className="text-xs">
                      <p className="font-medium text-foreground">{session.phone ?? session.sessionId}</p>
                      <p className="text-muted-foreground">Node atual: {session.nodeName}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge className="status-badge status-busy">{session.status}</Badge>
                      <span>Failover: {session.failoverEnabled ? "enabled" : "disabled"}</span>
                    </div>
                    <div>
                      <Select onValueChange={(targetNodeId) => void moveSession(session.sessionId, targetNodeId)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Mover para node" /></SelectTrigger>
                        <SelectContent>
                          {nodes.map((nodeOption) => (
                            <SelectItem key={nodeOption.id} value={nodeOption.id}>{nodeOption.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deployments">
            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Deployments</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {safeTimeline.map((event) => (
                  <div key={event.id} className="rounded-md border border-border/70 bg-card/70 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{event.action}</span>
                      <Badge className="status-badge status-busy">{event.status}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{event.startedAt ?? "—"} → {event.finishedAt ?? "em andamento"}</p>
                    <p className="mt-1 text-muted-foreground">{event.logLine ?? "Sem logs deste evento"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Logs realtime</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {safeLogs.slice(0, 30).map((log) => (
                  <div key={log.id} className="rounded-md border border-border/70 bg-card/70 px-3 py-2 text-xs">
                    <p className="text-muted-foreground">{log.timestamp} · {log.service} · {log.level}</p>
                    <p className="mt-1 text-foreground">{log.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runtime">
            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Runtime</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-md border border-border/70 bg-card/70 p-3 text-xs"><Cpu className="mb-2 h-4 w-4 text-warning" />CPU: {stat(node?.metrics?.cpuPercent, "%")}</div>
                <div className="rounded-md border border-border/70 bg-card/70 p-3 text-xs"><HardDrives className="mb-2 h-4 w-4 text-info" />Disk: {stat(node?.metrics?.diskPercent, "%")}</div>
                <div className="rounded-md border border-border/70 bg-card/70 p-3 text-xs"><Database className="mb-2 h-4 w-4 text-success" />Queue: {stat(node?.metrics?.queueSize)}</div>
                <div className="rounded-md border border-border/70 bg-card/70 p-3 text-xs"><Lightning className="mb-2 h-4 w-4 text-primary" />Reconnect loops: {stat(node?.metrics?.reconnectLoops)}</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="websocket">
            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Websocket</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="rounded-md border border-border/70 bg-card/70 p-3"><Broadcast className="mb-2 h-4 w-4 text-primary" />/ws/master</div>
                <div className="rounded-md border border-border/70 bg-card/70 p-3"><Broadcast className="mb-2 h-4 w-4 text-primary" />/ws/nodes</div>
                <div className="rounded-md border border-border/70 bg-card/70 p-3"><Broadcast className="mb-2 h-4 w-4 text-primary" />/ws/deployments</div>
                <div className="rounded-md border border-border/70 bg-card/70 p-3"><Broadcast className="mb-2 h-4 w-4 text-primary" />/ws/metrics</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostics">
            <Card className="glass-card rounded-lg">
              <CardHeader><CardTitle className="text-base">Diagnostics checks</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {safeDiagnostics.map((item) => (
                  <div key={item.key} className="rounded-md border border-border/70 bg-card/70 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{item.label}</p>
                      <Badge className={`status-badge ${item.ok ? "status-online" : "bg-destructive/15 text-destructive"}`}>{item.ok ? "ok" : "fail"}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">status {item.statusCode ?? "—"} · {item.latencyMs ?? "—"}ms · {item.details ?? "sem detalhes"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
