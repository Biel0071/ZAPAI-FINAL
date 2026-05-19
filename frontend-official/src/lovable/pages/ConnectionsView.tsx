import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Spinner, ArrowClockwise } from "@phosphor-icons/react";

export interface ConnectionsViewProps {
  connectedCount: number;
  connectingCount: number;
  disconnectedCount: number;
  activeSessionName: string | null;
  activationDialog: ReactNode;
  sessionCards: ReactNode;
  loadingState: ReactNode;
  emptyState: ReactNode;
  hasSessions: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenDiagnostics: () => void;
}

export function ConnectionsView({
  connectedCount,
  connectingCount,
  disconnectedCount,
  activeSessionName,
  activationDialog,
  sessionCards,
  loadingState,
  emptyState,
  hasSessions,
  isLoading,
  onRefresh,
  onOpenDiagnostics,
}: ConnectionsViewProps) {
  return (
    <div className="page-container section-stack">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-3">
        <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10">
                <CheckCircle weight="fill" className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Conectadas</p>
                <h3 className="mt-1 font-display text-2xl font-bold">{connectedCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10">
                <Spinner weight="bold" className="h-6 w-6 animate-spin text-warning" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Conectando</p>
                <h3 className="mt-1 font-display text-2xl font-bold">{connectingCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <XCircle weight="fill" className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Desconectadas</p>
                <h3 className="mt-1 font-display text-2xl font-bold">{disconnectedCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background/60">
            <ArrowClockwise className="h-4 w-4" />
          </div>
          <div>
            <p>Sessão ativa: <span className="font-semibold text-foreground">{activeSessionName ?? "Nenhuma ativa"}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onRefresh}>
            Ver Logs
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onOpenDiagnostics}>
            Diagnósticos
          </Button>
        </div>
        {activationDialog}
      </div>

      {isLoading ? loadingState : hasSessions ? sessionCards : emptyState}
    </div>
  );
}
