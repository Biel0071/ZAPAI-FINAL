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
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatGridSkeleton } from "@/components/ui/loading-skeleton";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
 
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [logsSessionId, setLogsSessionId] = useState<string | null>(null);
  const [sessionLogs, setSessionLogs] = useState<Array<{
    event: string;
    level: string;
    message: string;
    timestamp: string;
  }>>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
 
  const fetchLogs = useCallback(async (sessionId: string) => {
    try {
      const details = await apiService.getSessionStatusDetails(sessionId);
      if (details && Array.isArray(details.logs)) {
        setSessionLogs(details.logs);
      } else {
        setSessionLogs([]);
      }
    } catch (error) {
      console.error("Failed to fetch session logs:", error);
    }
  }, []);
 
  useEffect(() => {
    if (!isLogsDialogOpen || !logsSessionId) return;
 
    setIsLoadingLogs(true);
    void fetchLogs(logsSessionId).finally(() => setIsLoadingLogs(false));
 
    const intervalId = window.setInterval(() => {
      void fetchLogs(logsSessionId);
    }, 3000);
 
    return () => window.clearInterval(intervalId);
  }, [isLogsDialogOpen, logsSessionId, fetchLogs]);
 
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sessionLogs]);
 
  const handleOpenLogs = (sessionId: string) => {
    setLogsSessionId(normalizeSessionName(sessionId));
    setIsLogsDialogOpen(true);
  };

  useEffect(() => {
    sessionsRef.current = safeSessions;
  }, [safeSessions]);

  // Fechar a modal de pareamento automaticamente quando a sessão ativa conectar
  useEffect(() => {
    if (!activeModalSessionId || !isActivationDialogOpen) return;
    const session = safeSessions.find((s) => s.id === activeModalSessionId);
    if (session && session.status === "connected") {
      notify.success(`WhatsApp pareado com sucesso na sessão "${session.name}"!`);
      const timer = window.setTimeout(() => {
        setIsActivationDialogOpen(false);
        setShowQRModal(false);
        setActiveModalSessionId(null);
      }, 1500);
      return () => window.clearTimeout(timer);
    }
  }, [activeModalSessionId, isActivationDialogOpen, safeSessions]);

  const loadSessions = useCallback(async (options?: { silent?: boolean }) => {
    if (sessionLoadInFlightRef.current) return;
    sessionLoadInFlightRef.current = true;
    const isSilent = Boolean(options?.silent);
    if (!isSilent) setIsSessionsLoading(true);
    try {
      const sessionsData = await apiService.listSessions();
      const normalized = (sessionsData ?? []).map(backendNormalizeSession);
      useAppStore.getState().setSessions(normalized);

      // Sync QR codes for any QR-ready sessions into the store's lastQr map
      normalized.forEach((session) => {
        if (session.status === "qr") {
          const qr = extractQrPayload(session.raw);
          if (qr) {
            useAppStore.getState().setLastQr(session.id, qr);
          }
        }
      });
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
            message: sessionsResult[0].reason instanceof Error ? sessionsResult[0].reason.message : "Falha no carregamento inicial de sessões",
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
      void loadSessions({ silent: true });
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [loadSessions]);

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
    setShowQRModal(true);

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
    setIsActivationDialogOpen(true); // Abrir a modal de status/QR code automaticamente
    setShowQRModal(true);

    try {
      const response = await apiService.reconnectSession(sessionId);
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

  const openDeleteConfirm = (sessionId: string) => {
    setDeleteConfirmSessionId(normalizeSessionName(sessionId));
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async (purgeData: boolean) => {
    const sessionId = deleteConfirmSessionId;
    if (!sessionId) return;

    setDeleteConfirmOpen(false);
    setDeletingSessionId(sessionId);
    try {
      if (purgeData) {
        await apiService.purgeSession(sessionId);
        notify.success("Sessão e dados relacionados removidos.");
      } else {
        await apiService.deleteSession(sessionId);
        notify.success("Sessão removida. Contatos e conversas preservados.");
      }
      useAppStore.getState().removeSession(sessionId);
      if (activeModalSessionId === sessionId) {
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
      setDeleteConfirmSessionId(null);
    }
  };

  const currentQr = activeModalSessionId ? storeLastQr[activeModalSessionId] : null;
  const currentQrImage = resolveQrImage(currentQr ?? undefined);
  const currentQrSession = safeSessions.find((session) => session.id === activeModalSessionId);
  const isQrModalVisible = showQRModal && (currentQrSession?.status === "qr" || currentQrSession?.status === "connecting" || currentQrSession?.status === "connected");
  const showQrImage = isQrModalVisible && currentQrSession?.status === "qr" && Boolean(currentQrImage);

  const qrModalDescription = useMemo(() => {
    if (currentQrSession?.status === "connected") return "Conectado";
    if (currentQrSession?.status === "qr" && currentQrImage) return "Escaneie o QR com o WhatsApp";
    return "Aguardando geração do QR";
  }, [currentQrImage, currentQrSession?.status]);

  const activeSession = useMemo(() => {
    return safeSessions.find((s) => s.status === "connected" || s.connected);
  }, [safeSessions]);

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
              Nova Conexão
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
            activeSessionName={activeSession ? activeSession.name : "Nenhuma ativa"}
            onRefresh={() => handleOpenLogs(activeSession ? activeSession.id : (safeSessions[0]?.id ?? ''))}
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
                    <DialogDescription>
                      Crie uma nova sessão e escaneie o QR Code para conectar o número do WhatsApp.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {!activeModalSessionId ? (
                      <>
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
                      </>
                    ) : (
                      isQrModalVisible && (
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
                            <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground flex flex-col items-center justify-center min-h-[260px] gap-3">
                              <Spinner className="h-8 w-8 animate-spin text-primary" />
                              <span>
                                {currentQrSession?.status === "connected"
                                  ? "Sessão conectada com sucesso!"
                                  : "Aguardando QR code da sessão..."}
                              </span>
                            </div>
                          )}
                          <div className="space-y-2">
                            <OperationalStatusBadge 
                              label={currentQrSession ? statusMeta(currentQrSession.status).label : "Aguardando"} 
                              tone={currentQrSession ? statusMeta(currentQrSession.status).tone : "warning"} 
                              pulse={currentQrSession?.status === "connecting"} 
                            />
                            <p className="text-sm text-muted-foreground">{qrModalDescription}</p>
                            <p className="text-xs text-muted-foreground/80">Sessão: {activeModalSessionId}</p>
                          </div>
                        </div>
                      )
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
                  const preventQrRegeneration = session.status === "connected" || session.status === "connecting" || session.status === "qr" || isRestarting;
 
                  return (
                    <Card key={session.id} className="glass-card overflow-hidden rounded-2xl border-border/70 bg-card/85">
                      <div className={meta.lineClass} />
                      <CardContent className="space-y-3.5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-whatsapp/10">
                              <WhatsappLogo weight="fill" className="h-4 w-4 text-whatsapp" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate font-display text-sm font-semibold flex items-center gap-1.5">
                                {session.name}
                                <span className="text-[10px] text-muted-foreground/80 font-normal">({session.id})</span>
                              </h3>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                                <Phone weight="fill" className="h-3 w-3 shrink-0" />
                                {session.phone || "Sem número vinculado"}
                              </p>
                            </div>
                          </div>
                          <OperationalStatusBadge label={meta.label} tone={meta.tone} pulse={session.status === "connecting"} />
                        </div>
 
                        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/40 bg-background/30 p-2.5 text-[11px]">
                          <div className="space-y-0.5">
                            <p className="text-[9px] text-muted-foreground/80 font-medium uppercase tracking-wider">Sincronia</p>
                            <p className="font-semibold text-foreground truncate">
                              {session.status === "connected" ? "Ativa" : "Pendente"}
                            </p>
                          </div>
                          <div className="space-y-0.5 border-l border-border/40 pl-2">
                            <p className="text-[9px] text-muted-foreground/80 font-medium uppercase tracking-wider">Runtime</p>
                            <p className="font-semibold text-foreground truncate">Oficial V4</p>
                          </div>
                          <div className="space-y-0.5 border-l border-border/40 pl-2">
                            <p className="text-[9px] text-muted-foreground/80 font-medium uppercase tracking-wider">Websocket</p>
                            <p className="font-semibold text-foreground truncate">
                              {session.status === "connected" ? "Conectado" : "Offline"}
                            </p>
                          </div>
                        </div>
 
                        <div className="flex gap-1.5 pt-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 h-8 text-[11px] rounded-xl px-2 gap-1"
                            onClick={() => void handleGenerateQr(session)}
                            disabled={preventQrRegeneration || isDeleting}
                            title="Gerar / renovar QR Code"
                          >
                            {isRestarting ? <Spinner className="h-3 w-3 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                            <span>QR</span>
                          </Button>
                          
                          {session.status === "connected" ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 h-8 text-[11px] rounded-xl px-2 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => void handleLogoutSession(session.id)}
                              disabled={isRestarting || isDeleting}
                              title="Desconectar sessão do WhatsApp"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Desconectar</span>
                            </Button>
                          ) : session.status === "disconnected" ? (
                            <Button 
                              variant="default"
                              size="sm" 
                              className="flex-1 h-8 text-[11px] rounded-xl px-2 gap-1 shadow-glow"
                              onClick={() => void handleConnectSession(session.id)}
                              disabled={isRestarting || isDeleting}
                              title="Conectar sessão"
                            >
                              {isRestarting ? <Spinner className="h-3 w-3 animate-spin" /> : <ArrowClockwise className="h-3.5 w-3.5" />}
                              <span>Reiniciar</span>
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 h-8 text-[11px] rounded-xl px-2 gap-1"
                              onClick={() => void handleConnectSession(session.id)}
                              disabled={isRestarting || isDeleting}
                              title="Reiniciar conexão"
                            >
                              {isRestarting ? <Spinner className="h-3 w-3 animate-spin" /> : <ArrowClockwise className="h-3.5 w-3.5" />}
                              <span>Reiniciar</span>
                            </Button>
                          )}

                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0 shrink-0 text-[11px] rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => openDeleteConfirm(session.id)}
                            disabled={isDeleting}
                            title="Excluir sessão"
                          >
                            {isDeleting ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Trash className="h-3.5 w-3.5" />}
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

      {/* ============ DELETE CONFIRMATION MODAL ============ */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Trash className="h-5 w-5 text-destructive" />
              Excluir sessão{deleteConfirmSessionId ? `: ${deleteConfirmSessionId}` : ""}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Escolha como deseja excluir esta sessão:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void executeDelete(false)}
                className="w-full rounded-xl border border-border bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-card/80 group"
              >
                <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  Excluir apenas a sessão
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Remove a conexão WhatsApp. Contatos, conversas e memória IA são <strong className="text-foreground">preservados</strong>.
                </p>
              </button>

              <button
                type="button"
                onClick={() => void executeDelete(true)}
                className="w-full rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-left transition-all hover:border-destructive/60 hover:bg-destructive/10 group"
              >
                <p className="font-semibold text-sm text-destructive">
                  Excluir sessão e todos os dados
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Remove a conexão, <strong className="text-destructive/80">contatos</strong>, <strong className="text-destructive/80">conversas</strong>, <strong className="text-destructive/80">memória IA</strong> e <strong className="text-destructive/80">arquivos</strong> relacionados. Ação irreversível.
                </p>
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
 
      {/* ============ CONNECTION LOGS MODAL ============ */}
      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="max-w-2xl border-border/80 bg-card/95 backdrop-blur-xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/40">
            <div className="space-y-0.5">
              <DialogTitle className="font-display text-lg font-semibold flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Logs de Conexão WhatsApp
              </DialogTitle>
              <DialogDescription className="text-xs">Monitoramento de eventos e mensagens em tempo real</DialogDescription>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="logs-session-select" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sessão Selecionada</Label>
                <select
                  id="logs-session-select"
                  value={logsSessionId || ""}
                  onChange={(e) => setLogsSessionId(e.target.value || null)}
                  className="w-full h-9 rounded-xl border border-border/60 bg-background/50 px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {safeSessions.length === 0 && (
                    <option value="">Nenhuma sessão cadastrada</option>
                  )}
                  {safeSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id}) - {s.status === "connected" ? "Online" : "Offline"}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="mt-6 h-9 w-9 rounded-xl shrink-0 border-border/60 hover:bg-muted/50"
                onClick={() => logsSessionId && void fetchLogs(logsSessionId)}
                title="Atualizar logs manualmente"
              >
                <ArrowClockwise className="h-4 w-4" />
              </Button>
            </div>
 
            <div className="flex flex-col gap-2.5 rounded-2xl border border-border/50 bg-background/60 p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Histórico de Eventos</p>
              <div className="h-[320px] overflow-y-auto rounded-xl border border-border/30 bg-background/30 p-3 space-y-3 font-mono text-xs scrollbar-thin">
                {isLoadingLogs && sessionLogs.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2.5 text-muted-foreground">
                    <Spinner className="h-6 w-6 animate-spin text-primary" />
                    <span>Carregando histórico...</span>
                  </div>
                ) : sessionLogs.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground text-center py-10">
                    <p className="font-semibold text-sm">Nenhum evento registrado</p>
                    <p className="text-xs text-muted-foreground/70 max-w-sm">Conecte a sessão ou envie/receba mensagens pelo WhatsApp para ver as entradas e saídas aqui.</p>
                  </div>
                ) : (
                  <>
                    {sessionLogs.map((log, index) => {
                      let levelTone: "online" | "warning" | "offline" = "online";
                      if (log.level === "warn" || log.level === "warning") levelTone = "warning";
                      if (log.level === "error" || log.level === "fatal") levelTone = "offline";
 
                      return (
                        <div key={index} className="flex flex-col gap-1 border-b border-border/20 pb-2.5 last:border-0 last:pb-0 animate-fade-in">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase select-none tracking-wide",
                                levelTone === "online" && "bg-success/10 text-success border border-success/15",
                                levelTone === "warning" && "bg-warning/10 text-warning border border-warning/15",
                                levelTone === "offline" && "bg-destructive/10 text-destructive border border-destructive/15"
                              )}>
                                {log.level}
                              </span>
                              <span className="font-semibold text-foreground/90">{log.event}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 select-none">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-muted-foreground/90 leading-relaxed break-words whitespace-pre-wrap">{log.message}</p>
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl px-4"
                onClick={() => setIsLogsDialogOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
