import { useMemo } from "react";
import { CloudArrowUp, ClockClockwise } from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMasterNodesControlPlane } from "@/hooks/useMasterNodesControlPlane";
import { useMasterNodeStore } from "@/stores/masterNodeStore";

function fallback(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

export default function MasterDeployments() {
  const { nodes, deployments, refresh, loading } = useMasterNodesControlPlane();
  const nodeMap = useMemo(() => new Map(nodes.map((item) => [item.id, item.name])), [nodes]);
  const realtimeDeploys = useMasterNodeStore((state) => state.deployments);
  const rows = (Array.isArray(realtimeDeploys) && realtimeDeploys.length > 0 ? realtimeDeploys : deployments) ?? [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const normalizeStatus = (value: unknown) => String(value ?? "unknown").toLowerCase();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header title="Deploy Center" subtitle="Deploy remoto multi-node com progresso e histórico" runtimeState="running" />
      <div className="page-container section-stack">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Nodes em deploy</p><p className="text-2xl font-bold font-display">{safeRows.filter((row) => normalizeStatus(row.status).includes("progress") || normalizeStatus(row.status).includes("deploy")).length}</p></CardContent></Card>
          <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Falhas</p><p className="text-2xl font-bold font-display">{safeRows.filter((row) => normalizeStatus(row.status).includes("fail") || normalizeStatus(row.status).includes("error")).length}</p></CardContent></Card>
          <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Concluídos</p><p className="text-2xl font-bold font-display">{safeRows.filter((row) => normalizeStatus(row.status).includes("done") || normalizeStatus(row.status).includes("success")).length}</p></CardContent></Card>
          <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Histórico total</p><p className="text-2xl font-bold font-display">{safeRows.length}</p></CardContent></Card>
        </div>

        <Card className="glass-card rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Build progress & healthcheck</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <ClockClockwise className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {safeRows.slice(0, 8).map((event) => (
              <div key={event.id} className="rounded-md border border-border/70 bg-card/70 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{event.action}</p>
                  <Badge className="status-badge status-busy">{event.status}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{nodeMap.get(event.nodeId) ?? event.nodeId} · {fallback(event.buildVersion)} · {fallback(event.buildHash)}</p>
                <p className="mt-1 text-muted-foreground">Healthcheck progress: {event.healthcheckProgress ?? 0}%</p>
                <p className="mt-1 text-muted-foreground">{event.logLine ?? "Aguardando logs realtime"}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-lg">
          <CardHeader><CardTitle className="font-display">Deploy history</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Build hash</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem deployments disponíveis.</TableCell></TableRow>
                ) : (
                  safeRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{nodeMap.get(row.nodeId) ?? row.nodeId}</TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell><Badge className="status-badge status-busy">{row.status}</Badge></TableCell>
                      <TableCell>{fallback(row.buildVersion)}</TableCell>
                      <TableCell>{fallback(row.buildHash)}</TableCell>
                      <TableCell>{fallback(row.startedAt)}</TableCell>
                      <TableCell>{fallback(row.finishedAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-lg">
          <CardHeader><CardTitle className="font-display">Ações remotas disponíveis</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3 xl:grid-cols-5">
            {[
              "deploy latest",
              "restart node",
              "restart backend",
              "restart nginx",
              "clear cache",
              "prune docker",
              "rebuild frontend",
              "rotate logs",
              "sync env",
              "update compose",
            ].map((item) => (
              <div key={item} className="rounded-md border border-border/70 bg-card/70 px-3 py-2">
                <CloudArrowUp className="mb-1 h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
