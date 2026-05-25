import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ConnectionsView from "@/lovable/pages/ConnectionsPageView";
import { createConnectionsLovableViewModel } from "@/adapters/lovable/connectionsAdapter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatGridSkeleton } from "@/components/ui/loading-skeleton";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiService, type SessionInfo } from "@/services/apiService";
import { notify } from "@/services/notifyService";
import { reportFrontendIssue } from "@/runtime/services/frontendHealthService";
import { useAppStore } from "@/stores/appStore";
import { normalizeSession as backendNormalizeSession } from "@/services/normalizeSession";
import { SafeRender } from "@/components/system/SafeRender";

interface Session extends SessionInfo {
  name: string;
  status: "connected" | "connecting" | "qr" | "disconnected";
}

type SessionEventPayload = {
  sessionId?: string;
  name?: string;
  sessionName?: string;
  qr?: string;
  qrCode?: string;
  qrcode?: string;
  base64?: string;
  phone?: string;
  status?: string;
};

function normalizeBackendStatus(status?: string, connected?: boolean): Session["status"] {
  const normalizedStatus = (status || "").toLowerCase();
  if (connected || normalizedStatus === "connected" || normalizedStatus === "online" || normalizedStatus === "active" || normalizedStatus === "open") {
    return "connected";
  }
  if (normalizedStatus === "connecting") return "connecting";
  if (normalizedStatus === "qr" || normalizedStatus === "qr_ready" || normalizedStatus === "awaiting_qr") return "qr";
  return "disconnected";
}

function localNormalizeSession(item: SessionInfo): Session {
  const legacyName = (item as SessionInfo & { session_name?: string; name?: string }).session_name;
  const resolvedName = item.name || legacyName || item.id;

  return {
    id: item.id || resolvedName,
    phone: item.phone,
    connected: item.connected,
    name: resolvedName,
    status: normalizeBackendStatus(item.status, item.connected),
  };
}

function normalizeSessionName(name: string): string {
  return name.trim().replace(/\s+/g, "_").toLowerCase();
}

function extractQrPayload(payload?: SessionEventPayload): string | undefined {
  const candidate = payload?.qr ?? payload?.qrCode ?? payload?.qrcode ?? payload?.base64;
  if (!candidate) return undefined;
  return candidate.trim();
}

function resolveQrImage(qr?: string): string | null {
  if (!qr) return null;

  const cleaned = qr.trim();
  if (!cleaned) return null;

  if (cleaned.startsWith("data:image/")) return cleaned;

  return `data:image/png;base64,${cleaned.replace(/\s/g, "")}`;
}

function statusMeta(status: Session["status"]) {
  if (status === "connected") return { label: "Conectado", tone: "online" as const, lineClass: "h-1 bg-success" };
  if (status === "connecting") return { label: "Conectando", tone: "warning" as const, lineClass: "h-1 bg-warning" };
  if (status === "qr") return { label: "QR pronto", tone: "warning" as const, lineClass: "h-1 bg-warning" };
  return { label: "Desconectado", tone: "offline" as const, lineClass: "h-1 bg-muted" };
}

export default function Connections() {
  const storeSessions = useAppStore((state) => state.sessions);
  const storeLastQr = useAppStore((state) => state.lastQr);

  const [showQRModal, setShowQRModal] = useState(false);
  const [isActivationDialogOpen, setIsActivationDialogOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [sessionNameError, setSessionNameError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [createStatus, setCreateStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [restartingSessionId, setRestartingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [activeModalSessionId, setActiveModalSessionId] = useState<string | null>(null);
  const sessionLoadInFlightRef = useRef(false);

  const sessions = useMemo(() => {
    return (storeSessions ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone ?? undefined,
      connected: s.status === "connected",
      status: s.status === "error" || s.status === "unknown" ? "disconnected" as const : s.status as Session["status"],
    }));
  }, [storeSessions]);

  const safeSessions = useMemo(() => (Array.isArray(sessions) ? sessions : []), [sessions]);
  const sessionsRef = useRef<Session[]>(safeSessions);
  const creatingSessionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionsRef.current = safeSessions;
  }, [safeSessions]);

  const loadSessions = useCallback(async (options?: { silent?: boolean }) => {
    if (sessionLoadInFlightRef.current) return;
    sessionLoadInFlightRef.current = true;
    const isSilent = Boolean(options?.silent);
    if (!isSilent) setIsSessionsLoading(true);
    try {
      const sessionsData = await apiService.listSessions();
      const normalized = (sessionsData ?? []).map(backendNormalizeSession);
      useAppStore.getState().setSessions(normalized);

      const qrReadySession = normalized.find((session) => session.status === "qr");
      if (qrReadySession) {
        setActiveModalSessionId(qrReadySession.id);
        setShowQRModal(true);
        setIsActivationDialogOpen(true);
      } else {
        setShowQRModal(false);
      }
    } catch (error) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.loadSessions",
        message: error instanceof Error ? error.message : "Falha ao carregar sessões",
      });
    } finally {
      sessionLoadInFlightRef.current = false;
      if (!isSilent) setIsSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const sessionsResult = await Promise.allSettled([
          loadSessions(),
        ]);

        if (sessionsResult[0].status === "rejected") {
          reportFrontendIssue({
            type: "unexpected_error",
            service: "connections.loadInitialData",
            message: sessionsResult.reason instanceof Error ? sessionsResult.reason.message : "Falha no carregamento inicial de sessões",
          });
        }
      } catch (error) {
        reportFrontendIssue({
          type: "unexpected_error",
          service: "connections.loadInitialData",
          message: error instanceof Error ? error.message : "Falha ao carregar dados iniciais",
        });
      }
    };

    void loadInitialData();
  }, [loadSessions]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (showQRModal || isActivationDialogOpen || isConnecting || restartingSessionId) return;
      const hasQrSession = sessionsRef.current.some((session) => session.status === "qr");
      if (hasQrSession) return;
      void loadSessions({ silent: true });
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [isActivationDialogOpen, isConnecting, loadSessions, restartingSessionId, showQRModal]);

  const handleCreateSession = async () => {
    const rawSessionName = newSessionName.trim();
    if (!rawSessionName || isCreating) return;

    const sessionName = normalizeSessionName(rawSessionName);

    const existingSession = sessionsRef.current.find(
      (s) => normalizeSessionName(s.id) === sessionName
    );
    if (existingSession) {
      if (existingSession.status === "connected") {
        setSessionNameError("Sessão já existe e está conectada.");
        return;
      }
      if (existingSession.status === "connecting" || existingSession.status === "qr") {
        setSessionNameError("Sessão já está em processo de conexão.");
        return;
      }
    }

    if (creatingSessionsRef.current.has(sessionName)) {
      return;
    }
    creatingSessionsRef.current.add(sessionName);

    setSessionNameError(null);
    setIsActivationDialogOpen(true);
    setIsConnecting(true);
    setIsCreating(true);
    setCreateStatus("loading");
    setActiveModalSessionId(sessionName);

    useAppStore.getState().upsertSession(
      backendNormalizeSession({ id: sessionName, status: "connecting", name: rawSessionName.trim() })
    );

    try {
      const response = await apiService.startSession(rawSessionName.trim());
      const qr = extractQrPayload(response as SessionEventPayload);

      if (qr) {
        useAppStore.getState().setLastQr(sessionName, qr);
        useAppStore.getState().upsertSession(
          backendNormalizeSession({ id: sessionName, status: "qr", name: rawSessionName.trim() })
        );
        setShowQRModal(true);
        notify.success("QR gerado com sucesso.");
      } else {
        notify.success("Sessão criada. Aguardando atualização do WhatsApp.");
      }

      setCreateStatus("success");
      await loadSessions({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ativar sessão";
      setCreateStatus("error");
      setSessionNameError(message);
      notify.error(message);
      setIsConnecting(false);
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.handleCreateSession",
        message,
      });
    } finally {
      creatingSessionsRef.current.delete(sessionName);
      setIsCreating(false);
    }
  };

  const handleConnectSession = async (sessionId: string) => {
    const normalizedId = normalizeSessionName(sessionId);
    if (restartingSessionId === normalizedId) return;

    setRestartingSessionId(normalizedId);
    setIsConnecting(true);
    setActiveModalSessionId(normalizedId);

    try {
      const response = await apiService.restartSession(sessionId);
      const qr = extractQrPayload(response as SessionEventPayload);
      if (qr) {
        useAppStore.getState().setLastQr(sessionId, qr);
        setShowQRModal(true);
      }
      useAppStore.getState().upsertSession(
        backendNormalizeSession({ id: sessionId, status: qr ? "qr" : "connecting" })
      );
      notify.success(qr ? "QR renovado com sucesso." : "Reconexão iniciada.");
      await loadSessions({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao reconectar sessão";
      notify.error(message);
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.handleConnectSession",
        message,
      });
    } finally {
      setRestartingSessionId(null);
      setIsConnecting(false);
    }
  };

  const handleGenerateQr = async (session: Session) => {
    const normalizedId = normalizeSessionName(session.id);
    if (restartingSessionId === normalizedId || deletingSessionId === normalizedId) return;
    await handleConnectSession(session.id);
  };

  const handleLogoutSession = async (sessionId: string) => {
    try {
      await apiService.logoutSession(sessionId);
      notify.success("Sessão desconectada.");
      useAppStore.getState().upsertSession(
        backendNormalizeSession({ id: sessionId, status: "disconnected" })
      );
      await loadSessions({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao desconectar sessão";
      notify.error(message);
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.handleLogoutSession",
        message,
      });
    }
  };

  const handleDelete = async (sessionId: string) => {
    const normalizedId = normalizeSessionName(sessionId);
    if (deletingSessionId === normalizedId) return;

    setDeletingSessionId(normalizedId);
    try {
      await apiService.deleteSession(sessionId);
      notify.success("Sessão removida.");
      useAppStore.getState().removeSession(normalizedId);
      if (activeModalSessionId === normalizedId) {
        setActiveModalSessionId(null);
        setShowQRModal(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao deletar sessão";
      notify.error(message);
      reportFrontendIssue({
        type: "unexpected_error",
        service: "connections.handleDelete",
        message,
      });
    } finally {
      setDeletingSessionId(null);
    }
  };

  const currentQr = activeModalSessionId ? storeLastQr[activeModalSessionId] : null;
  const currentQrImage = resolveQrImage(currentQr ?? undefined);
  const currentQrSession = safeSessions.find((session) => session.id === activeModalSessionId);
  const isQrModalVisible = showQRModal && currentQrSession?.status === "qr";
  const showQrImage = isQrModalVisible && Boolean(currentQrImage);

  const qrModalDescription = useMemo(() => {
    if (currentQrSession?.status === "connected") return "Conectado";
    if (currentQrSession?.status === "qr" && currentQrImage) return "Escaneie o QR com o WhatsApp";
    return "Aguardando geração do QR";
  }, [currentQrImage, currentQrSession?.status]);

  const lovableConnectionsViewModel = createConnectionsLovableViewModel(safeSessions);

  return (
    <div className="min-h-screen">
      <Header
        title="Conexões WhatsApp"
        subtitle="Gerencie suas sessões oficiais de WhatsApp em tempo real"
        actions={
          <>
            <Button size="sm" className="rounded-xl shadow-glow" onClick={() => setIsActivationDialogOpen(true)}>
              <Plus weight="bold" className="h-4 w-4" />
              Nova Conversa
            </Button>
          </>
        }
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <SafeRender scope="connections-view">
          <ConnectionsView
            connectedCount={lovableConnectionsViewModel.connected}
            connectingCount={lovableConnectionsViewModel.connecting}
            disconnectedCount={lovableConnectionsViewModel.disconnected}
            activeSessionName={lovableConnectionsViewModel.activeSessionName}
            onRefresh={() => void loadSessions()}
            onOpenDiagnostics={() => window.location.assign("/diagnostics")}
            activationDialog={
              <Dialog
                open={isActivationDialogOpen}
                onOpenChange={(open) => {
                  setIsActivationDialogOpen(open);
                  if (!open) {
                    setShowQRModal(false);
                    if (activeModalSessionId) {
                      useAppStore.getState().clearLastQr(activeModalSessionId);
                    }
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2 self-start rounded-xl shadow-glow md:self-auto">
                    <Plus weight="bold" className="h-4 w-4" />
                    Nova Conexão
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md border-border/80 bg-card/95 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle className="font-display">Conectar WhatsApp oficial</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                       <Label htmlFor="name">Nome da sessão</Label>
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

                    <Button className="w-full gap-2 rounded-xl" onClick={() => void handleCreateSession()} disabled={!newSessionName.trim() || isCreating}>
                      {isCreating ? <Spinner weight="bold" className="h-4 w-4 animate-spin" /> : <QrCode weight="bold" className="h-4 w-4" />}
                      {createStatus === "success" ? "Sessão criada" : createStatus === "error" ? "Falha na criação" : isCreating ? "Criando sessão..." : "Gerar QR oficial"}
                    </Button>

                    {isQrModalVisible && (
                      <div className="space-y-4 rounded-2xl border border-border/70 bg-background/50 p-4 text-center">
                        {showQrImage ? (
                          <div className="qr-container mx-auto w-fit">
                            <img
                              src={currentQrImage ?? undefined}
                              alt="QR Code da sessão WhatsApp"
                              className="mx-auto block h-[260px] w-[260px] rounded-xl border border-border"
                            />
                          </div>
                        ) : (
                          <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                            Aguardando QR code da sessão...
                          </div>
                        )}
                        <div className="space-y-2">
                          <OperationalStatusBadge label={currentQrSession ? statusMeta(currentQrSession.status).label : "Aguardando"} tone={currentQrSession ? statusMeta(currentQrSession.status).tone : "warning"} pulse />
                          <p className="text-sm text-muted-foreground">{qrModalDescription}</p>
                          <p className="text-xs text-muted-foreground/80">Sessão: {activeModalSessionId || newSessionName || "session"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            }
            isLoading={isSessionsLoading}
            hasSessions={safeSessions.length > 0}
            loadingState={<StatGridSkeleton count={3} />}
            emptyState={
              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="p-0">
                  <EmptyState
                    icon={<WhatsappLogo className="h-6 w-6 text-muted-foreground" weight="duotone" />}
                    title="Nenhuma sessão criada"
                    description="Crie a primeira sessão oficial do WhatsApp para habilitar QR, reconnect e realtime dentro do runtime consolidado."
                    action={
                      <Button className="rounded-xl shadow-glow" onClick={() => setIsActivationDialogOpen(true)}>
                        Criar primeira sessão
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            }
            sessionCards={
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {safeSessions.map((session) => {
                  const meta = statusMeta(session.status);
                  const normalizedId = normalizeSessionName(session.id);
                  const isRestarting = restartingSessionId === normalizedId;
                  const isDeleting = deletingSessionId === normalizedId;
                  const preventQrRegeneration = session.status === "connecting" || session.status === "qr" || isRestarting;

                  return (
                    <Card key={session.id} className="glass-card overflow-hidden rounded-2xl border-border/70 bg-card/85">
                      <div className={meta.lineClass} />
                      <CardContent className="space-y-5 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-whatsapp/10">
                              <WhatsappLogo weight="fill" className="h-6 w-6 text-whatsapp" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate font-display text-lg font-semibold">{session.name}</h3>
                              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone weight="fill" className="h-3 w-3" />
                                {session.phone || "Sem número vinculado"}
                              </p>
                            </div>
                          </div>
                          <OperationalStatusBadge label={meta.label} tone={meta.tone} pulse={session.status === "connecting"} />
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado operacional</p>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-foreground">{session.status === "qr" ? "Aguardando pareamento" : session.status === "connected" ? "Sessão activa e apta para realtime" : session.status === "connecting" ? "Reconectando no runtime oficial" : "Pronta para nova conexão"}</span>
                            <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {session.id}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <Button variant="outline" size="sm" className="w-full gap-2 rounded-xl" onClick={() => void handleGenerateQr(session)} disabled={preventQrRegeneration || isDeleting}>
                            {isRestarting ? <Spinner className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                            {isRestarting ? "Atualizando QR..." : "Gerar / renovar QR"}
                          </Button>
                          {session.status === "connected" ? (
                            <Button variant="outline" size="sm" className="w-full gap-2 rounded-xl" onClick={() => void handleLogoutSession(session.id)} disabled={isRestarting || isDeleting}>
                              <ArrowClockwise className="h-4 w-4" />Desconectar sessão
                            </Button>
                          ) : session.status === "disconnected" ? (
                            <Button size="sm" className="w-full gap-2 rounded-xl shadow-glow" onClick={() => void handleConnectSession(session.id)} disabled={isRestarting || isDeleting}>
                              {isRestarting ? <Spinner className="h-4 w-4 animate-spin" /> : <ArrowClockwise className="h-4 w-4" />}
                              {isRestarting ? "Reconectando..." : "Conectar sessão"}
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="w-full gap-2 rounded-xl" onClick={() => void handleConnectSession(session.id)} disabled={isRestarting || isDeleting}>
                              {isRestarting ? <Spinner className="h-4 w-4 animate-spin" /> : <ArrowClockwise className="h-4 w-4" />}
                              {isRestarting ? "Sincronizando..." : "Reiniciar conexão"}
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="w-full gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => void handleDelete(session.id)} disabled={isDeleting}>
                            {isDeleting ? <Spinner className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                            {isDeleting ? "Removendo sessão..." : "Excluir sessão"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            }
          />
        </SafeRender>
      </motion.div>
    </div>
  );
}
