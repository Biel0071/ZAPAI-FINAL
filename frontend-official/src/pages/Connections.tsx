import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  WhatsappLogo,
  QrCode,
  Plus,
  Trash,
  CheckCircle,
  XCircle,
  Spinner,
  Phone,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiService } from "@/services/apiService";
import { notify } from "@/services/notifyService";
import { reportFrontendIssue } from "@/services/frontendHealthService";
import { useAppStore, type SessionItem } from "@/stores/appStore";
import { useRuntime } from "@/providers/RuntimeProvider";

type SessionStatus = "connected" | "connecting" | "qr" | "disconnected";

function resolveStatus(status: SessionItem["status"]): SessionStatus {
  if (status === "connected") return "connected";
  if (status === "connecting") return "connecting";
  if (status === "qr") return "qr";
  return "disconnected";
}

function statusMeta(status: SessionStatus) {
  if (status === "connected") return { emoji: "🟢", label: "Connected", badgeClass: "status-online", lineClass: "h-1 bg-success" };
  if (status === "connecting") return { emoji: "🟡", label: "Connecting", badgeClass: "status-busy", lineClass: "h-1 bg-warning" };
  if (status === "qr") return { emoji: "🟠", label: "QR Ready", badgeClass: "status-busy", lineClass: "h-1 bg-warning" };
  return { emoji: "🔴", label: "Disconnected", badgeClass: "status-offline", lineClass: "h-1 bg-muted" };
}

function resolveQrImage(qr?: string): string | null {
  if (!qr) return null;
  const cleaned = qr.trim();
  if (!cleaned) return null;
  if (cleaned.startsWith("data:image/")) return cleaned;
  return `data:image/png;base64,${cleaned.replace(/\s/g, "")}`;
}

export default function Connections() {
  const { status, hydrated, forceRefresh } = useRuntime();
  const sessions = useAppStore((state) => state.sessions);
  const lastQr = useAppStore((state) => state.lastQr);
  const setLastQr = useAppStore((state) => state.setLastQr);

  const socketConnected = status === "online";
  const reconnecting = status === "reconnecting";

  // UI Local states
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingQrSessionId, setPendingQrSessionId] = useState<string | null>(null);
  const [qrModalSessionId, setQrModalSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [sessionNameError, setSessionNameError] = useState<string | null>(null);
  const [restartingSessionId, setRestartingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Initial loading indicator
  useEffect(() => {
    if (hydrated) {
      setIsInitialLoading(false);
    }
  }, [hydrated]);

  // Listener to open the QR modal when the QR code arrives for a pending session
  useEffect(() => {
    if (!pendingQrSessionId) return;

    const qr = lastQr[pendingQrSessionId];
    if (!qr) return;

    setQrModalSessionId(pendingQrSessionId);
    setPendingQrSessionId(null);
  }, [pendingQrSessionId, lastQr]);

  // Fallback to fetch active QR from the backend when the modal opens but store doesn't have it
  useEffect(() => {
    if (!qrModalSessionId) return;

    let active = true;

    const fetchQrFallback = async () => {
      try {
        const response = await apiService.getSessionQr(qrModalSessionId);
        if (active && response?.qr) {
          setLastQr(qrModalSessionId, response.qr);
        }
      } catch (error) {
        console.warn("Failed to fetch session QR fallback:", error);
      }
    };

    // Initial fetch if missing
    if (!lastQr[qrModalSessionId]) {
      void fetchQrFallback();
    }

    // Keep polling every 3 seconds to fetch new QR updates if the session is still in 'qr' or 'connecting'
    const intervalId = setInterval(() => {
      const currentSession = sessions.find((s) => s.id === qrModalSessionId);
      if (currentSession && (currentSession.status === "qr" || currentSession.status === "connecting")) {
        void fetchQrFallback();
      } else {
        clearInterval(intervalId);
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [qrModalSessionId, lastQr, setLastQr, sessions]);

  // Automatically close QR modal when session connects
  useEffect(() => {
    if (!qrModalSessionId) return;
    const session = sessions.find((s) => s.id === qrModalSessionId);
    if (session && session.status === "connected") {
      const timeoutId = setTimeout(() => {
        setQrModalSessionId(null);
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [qrModalSessionId, sessions]);

  const sessionsWithStatus = useMemo(
    () =>
      sessions.map((s) => ({
        ...s,
        resolvedStatus: resolveStatus(s.status),
        displayName: s.name ?? s.id,
      })),
    [sessions],
  );

  const connectedCount = sessionsWithStatus.filter((s) => s.resolvedStatus === "connected").length;
  const connectingCount = sessionsWithStatus.filter((s) => s.resolvedStatus === "connecting" || s.resolvedStatus === "qr").length;
  const disconnectedCount = sessionsWithStatus.filter((s) => s.resolvedStatus === "disconnected").length;
  const activeSessionName = sessionsWithStatus.find((s) => s.resolvedStatus === "connected")?.displayName ?? null;

  const currentSessionForQr = qrModalSessionId ? sessionsWithStatus.find((s) => s.id === qrModalSessionId) : null;
  const qrImageSource = qrModalSessionId ? resolveQrImage(lastQr[qrModalSessionId] ?? "") : null;

  const stopCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCreateSession = async () => {
    const rawSessionName = newSessionName.trim();
    if (!rawSessionName || creating) return;

    const sessionName = rawSessionName.toLowerCase().replace(/\s+/g, "_");

    // Check duplication
    const existing = sessions.find((s) => s.id === sessionName);
    if (existing) {
      if (existing.status === "connected") {
        setSessionNameError("Sessão já existe e está conectada.");
        return;
      }
      if (existing.status === "connecting" || existing.status === "qr") {
        setSessionNameError("Sessão já está em processo de conexão.");
        return;
      }
    }

    try {
      setCreating(true);
      setSessionNameError(null);

      const created = await apiService.startSession({ name: rawSessionName });
      await forceRefresh();

      const sessionId =
        created?.sessionId ??
        created?.id ??
        sessionName;

      setPendingQrSessionId(String(sessionId));
      setCreateOpen(false);
      setNewSessionName("");
      notify.success("WhatsApp session created successfully");
    } catch (error: any) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.createSession",
        message: error instanceof Error ? error.message : "Falha ao criar sessão",
      });
      notify.error("Failed to create WhatsApp session");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateQr = async (sessionId: string) => {
    if (restartingSessionId || deletingSessionId) return;
    setRestartingSessionId(sessionId);

    try {
      const response = await apiService.restartSession(sessionId);
      await forceRefresh();

      const targetSessionId = response?.sessionId ?? sessionId;
      setPendingQrSessionId(targetSessionId);
      notify.success("WhatsApp session restart requested");
    } catch (error) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.generateQr",
        message: error instanceof Error ? error.message : "Falha ao gerar QR",
      });
      notify.error("Failed to restart session");
    } finally {
      setRestartingSessionId(null);
    }
  };

  const handleConnectSession = async (sessionId: string) => {
    if (restartingSessionId || deletingSessionId) return;
    setRestartingSessionId(sessionId);

    try {
      const response = await apiService.startSession(sessionId);
      await forceRefresh();

      const targetSessionId = response?.sessionId ?? sessionId;
      setPendingQrSessionId(targetSessionId);
      notify.success("Session connect requested");
    } catch (error) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.connectSession",
        message: error instanceof Error ? error.message : "Falha ao conectar sessão",
      });
      notify.error("Failed to connect session");
    } finally {
      setRestartingSessionId(null);
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    try {
      await apiService.logoutSession(sessionId);
      await forceRefresh();
      notify.warning("WhatsApp session disconnected");
    } catch (error) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.logoutSession",
        message: error instanceof Error ? error.message : "Falha ao desconectar sessão",
      });
      notify.error("Failed to disconnect session");
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (deletingSessionId) return;
    setDeletingSessionId(sessionId);

    try {
      await apiService.deleteSession(sessionId);
      await forceRefresh();
      notify.warning("WhatsApp session deleted");
    } catch (error) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.deleteSession",
        message: error instanceof Error ? error.message : "Falha ao remover sessão",
      });
      notify.error("Failed to delete session");
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header title="Conexões WhatsApp" subtitle="Gerencie suas sessões de WhatsApp" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle weight="fill" className="w-6 h-6 text-success" /></div><div><p className="text-sm text-muted-foreground">Conectadas</p><h3 className="text-2xl font-bold font-display">{connectedCount}</h3></div></div></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center"><Spinner weight="bold" className="w-6 h-6 text-warning animate-spin" /></div><div><p className="text-sm text-muted-foreground">Conectando</p><h3 className="text-2xl font-bold font-display">{connectingCount}</h3></div></div></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><XCircle weight="fill" className="w-6 h-6 text-muted-foreground" /></div><div><p className="text-sm text-muted-foreground">Desconectadas</p><h3 className="text-2xl font-bold font-display">{disconnectedCount}</h3></div></div></CardContent></Card>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Status do Realtime: <strong className="text-foreground">{reconnecting ? "Reconectando..." : socketConnected ? "Online" : "Offline"}</strong></p>
            <span className="text-muted-foreground">|</span>
            <p className="text-sm text-muted-foreground">Sessão ativa: <strong className="text-foreground">{activeSessionName ?? "Nenhuma"}</strong></p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.open("/logs", "_self")}>
              Ver Logs
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.open("/diagnostics", "_self")}>
              Diagnósticos
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Suas Sessões</h2>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus weight="bold" className="w-4 h-4" />Nova Conexão</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle className="font-display">Conectar WhatsApp</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Sessão</Label>
                  <Input
                    id="name"
                    placeholder="Ex: vendas_1"
                    value={newSessionName}
                    onChange={(e) => {
                      setNewSessionName(e.target.value);
                      if (sessionNameError) setSessionNameError(null);
                    }}
                  />
                  {sessionNameError && <p className="text-xs text-destructive">{sessionNameError}</p>}
                </div>

                <Button className="w-full gap-2" onClick={() => void handleCreateSession()} disabled={!newSessionName.trim() || creating}>
                  {creating ? <Spinner weight="bold" className="w-4 h-4 animate-spin" /> : <QrCode weight="bold" className="w-4 h-4" />}
                  {creating ? "Creating..." : "Activate WhatsApp"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={qrModalSessionId !== null}
            onOpenChange={(open) => {
              if (!open) {
                setQrModalSessionId(null);
              }
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Scan QR Code</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4 text-center">
                {qrImageSource ? (
                  <img
                    src={qrImageSource}
                    alt="WhatsApp QR Code"
                    className="mx-auto block h-[280px] w-[280px] rounded-lg border border-border"
                  />
                ) : (
                  <div className="p-3 rounded-lg bg-muted text-xs font-mono break-all flex items-center justify-center h-[280px]">
                    <div className="flex flex-col items-center gap-2">
                      <Spinner className="w-8 h-8 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Waiting for QR Code...</span>
                    </div>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {currentSessionForQr?.resolvedStatus === "connected"
                    ? "Conectado com sucesso!"
                    : `Sessão: ${qrModalSessionId || ""}. Escaneie pelo WhatsApp do seu celular.`}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isInitialLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <Card key={`session-skeleton-${index}`} className="glass-card overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </CardContent>
                </Card>
              ))
            : sessionsWithStatus.map((session) => {
                const meta = statusMeta(session.resolvedStatus);
                const normalizedId = session.id;
                const isRestarting = restartingSessionId === normalizedId;
                const isDeleting = deletingSessionId === normalizedId;
                const preventQrRegeneration = session.resolvedStatus === "connecting" || session.resolvedStatus === "qr" || isRestarting;

                return (
                  <Card
                    key={session.id}
                    className={`glass-card overflow-hidden cursor-pointer transition-all ${selectedSessionId === session.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <div className={meta.lineClass} />
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-whatsapp/10 flex items-center justify-center"><WhatsappLogo weight="fill" className="w-6 h-6 text-whatsapp" /></div>
                          <div>
                            <h3 className="font-semibold">{session.displayName}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone weight="fill" className="w-3 h-3" />{session.phone || "-"}</p>
                          </div>
                        </div>
                        <Badge className={meta.badgeClass}>{meta.emoji} {meta.label}</Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {(session.resolvedStatus === "qr" || session.resolvedStatus === "connecting") && (
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                            onClick={(e) => {
                              stopCardClick(e);
                              setQrModalSessionId(session.id);
                            }}
                            disabled={isDeleting}
                          >
                            <QrCode className="w-4 h-4" />
                            Scan QR Code
                          </Button>
                        )}
                        {session.resolvedStatus !== "connected" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={(e) => {
                              stopCardClick(e);
                              void handleGenerateQr(session.id);
                            }}
                            disabled={preventQrRegeneration || isDeleting}
                          >
                            {isRestarting ? <Spinner className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                            {isRestarting ? "Loading" : "Generate QR"}
                          </Button>
                        )}
                        {session.resolvedStatus === "connected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={(e) => {
                              stopCardClick(e);
                              void handleLogoutSession(session.id);
                            }}
                            disabled={isRestarting || isDeleting}
                          >
                            <ArrowClockwise className="w-4 h-4" />Logout
                          </Button>
                        ) : session.resolvedStatus === "disconnected" ? (
                          <Button
                            size="sm"
                            className="w-full gap-2"
                            onClick={(e) => {
                              stopCardClick(e);
                              void handleConnectSession(session.id);
                            }}
                            disabled={isRestarting || isDeleting}
                          >
                            {isRestarting ? <Spinner className="w-4 h-4 animate-spin" /> : <ArrowClockwise className="w-4 h-4" />}
                            {isRestarting ? "Loading" : "Connect"}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={(e) => {
                              stopCardClick(e);
                              void handleConnectSession(session.id);
                            }}
                            disabled={isRestarting || isDeleting}
                          >
                            {isRestarting ? <Spinner className="w-4 h-4 animate-spin" /> : <ArrowClockwise className="w-4 h-4" />}
                            {isRestarting ? "Loading" : "Restart"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={(e) => {
                            stopCardClick(e);
                            void handleDelete(session.id);
                          }}
                          disabled={isDeleting}
                        >
                          {isDeleting ? <Spinner className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                          {isDeleting ? "Loading" : "Delete"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        {!isInitialLoading && sessionsWithStatus.length === 0 && (
          <div className="mt-8 space-y-6">
            <Card className="glass-card p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                <WhatsappLogo weight="fill" className="w-8 h-8 text-warning" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">Comece testando sua conexão</h3>
              <p className="text-sm text-muted-foreground mb-1">Clique em "Activate WhatsApp" para criar sua primeira sessão.</p>
              <p className="text-xs text-muted-foreground">✓ Tenha o celular em mãos</p>
            </Card>

            <Card className="glass-card p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle weight="fill" className="w-8 h-8 text-success" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">Sorria, sua sessão WhatsApp está</h3>
              <p className="text-sm text-muted-foreground mb-4">prestes a ser configurada. Conecte agora<br />e teste seu primeiro contato.</p>
              <Button
                className="gap-2"
                onClick={() => {
                  setNewSessionName("");
                  setCreateOpen(true);
                }}
              >
                <Plus weight="bold" className="w-4 h-4" /> Nova Conexão
              </Button>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}
