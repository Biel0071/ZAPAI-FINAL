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
import { apiService, type SessionInfo } from "@/services/apiService";
import { notify } from "@/services/notifyService";

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

function normalizeSession(item: SessionInfo): Session {
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

function resolveSessionId(payload?: SessionEventPayload): string | null {
  if (!payload) return null;
  return payload.sessionId || payload.name || payload.sessionName || null;
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
  if (status === "connected") return { emoji: "🟢", label: "Connected", badgeClass: "status-online", lineClass: "h-1 bg-success" };
  if (status === "connecting") return { emoji: "🟡", label: "Connecting", badgeClass: "status-busy", lineClass: "h-1 bg-warning" };
  if (status === "qr") return { emoji: "🟠", label: "QR Ready", badgeClass: "status-busy", lineClass: "h-1 bg-warning" };
  return { emoji: "🔴", label: "Disconnected", badgeClass: "status-offline", lineClass: "h-1 bg-muted" };
}

function resolveSessionName(payload?: SessionEventPayload): string | undefined {
  if (!payload) return undefined;
  return payload.sessionName || payload.name;
}

export default function Connections() {
  const [sessions, setSessions] = useState<Session[]>([]);
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
  const [publicApiUrl, setPublicApiUrl] = useState<string | null>(null);
  const [lastQr, setLastQr] = useState<{ sessionId?: string; qr?: string } | null>(null);

  const safeSessions = useMemo(() => (Array.isArray(sessions) ? sessions : []), [sessions]);
  const sessionsRef = useRef<Session[]>(safeSessions);
  const creatingSessionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionsRef.current = safeSessions;
  }, [safeSessions]);

  const upsertSession = useCallback((sessionId: string, updates: Partial<Session>) => {
    setSessions((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const normalizedId = normalizeSessionName(sessionId);
      const existing = safePrev.find((session) => normalizeSessionName(session.id) === normalizedId);
      if (existing) {
        return safePrev.map((session) =>
          normalizeSessionName(session.id) === normalizedId ? { ...session, ...updates, id: existing.id } : session,
        );
      }

      return [
        {
          id: sessionId,
          name: updates.name || sessionId,
          phone: updates.phone,
          status: updates.status ?? "connecting",
          connected: updates.status === "connected",
        },
        ...safePrev,
      ];
    });
  }, []);

  const loadSessions = useCallback(async () => {
    setIsSessionsLoading(true);
    try {
      const sessionsData = await apiService.listSessions();
      const deduped = new Map<string, Session>();

      (Array.isArray(sessionsData) ? sessionsData : []).forEach((item) => {
        const normalized = normalizeSession(item);
        deduped.set(normalizeSessionName(normalized.id), normalized);
      });

      const normalized = [...deduped.values()];
      setSessions(normalized);

      const qrReadySession = normalized.find((session) => session.status === "qr");
      if (qrReadySession) {
        setLastQr((prev) => ({ sessionId: qrReadySession.id, qr: prev?.qr }));
        setShowQRModal(true);
        setIsActivationDialogOpen(true);
      } else {
        setShowQRModal(false);
      }
    } catch (error) {
      console.error("Erro ao carregar sessões:", error);
    } finally {
      setIsSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [publicUrlResult, sessionsResult] = await Promise.allSettled([
          apiService.getPublicUrl(),
          loadSessions(),
        ]);

        if (publicUrlResult.status === "fulfilled") {
          setPublicApiUrl(publicUrlResult.value.publicUrl?.trim() || null);
        }

        if (sessionsResult.status === "rejected") {
          console.error("Erro ao carregar sessões:", sessionsResult.reason);
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
      }
    };

    void loadInitialData();
  }, [loadSessions]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadSessions();
    }, 5_000);

    return () => window.clearInterval(intervalId);
  }, [loadSessions]);

  const handleCreateSession = async () => {
    const rawSessionName = newSessionName.trim();
    if (!rawSessionName || isCreating) return;

    const sessionName = normalizeSessionName(rawSessionName);

    // Anti-duplication: check if session already exists
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

    // Anti-duplication: guard concurrent creation
    if (creatingSessionsRef.current.has(sessionName)) {
      console.log("Sessão já em criação:", sessionName);
      return;
    }
    creatingSessionsRef.current.add(sessionName);

    setSessionNameError(null);
    setIsActivationDialogOpen(true);
    setIsConnecting(true);
    setIsCreating(true);
    setCreateStatus("loading");

    upsertSession(sessionName, { status: "connecting", name: rawSessionName.trim() });

    try {
      const startResponse = await apiService.startSession(sessionName);

      if (startResponse?.sessionId || startResponse?.qr) {
        const resolvedSessionId = normalizeSessionName(startResponse.sessionId || sessionName);
        setLastQr({ sessionId: resolvedSessionId, qr: startResponse.qr });
        setShowQRModal(Boolean(startResponse.qr));
        setIsActivationDialogOpen(true);
        upsertSession(resolvedSessionId, {
          status: startResponse.qr ? "qr" : "connecting",
        });
      }

      setCreateStatus("success");
      notify.success("WhatsApp session created successfully");
      await loadSessions();
    } catch (error) {
      console.error("Erro ao criar sessão:", error);
      setCreateStatus("error");
      notify.error("Failed to create WhatsApp session");
      upsertSession(sessionName, { status: "disconnected", connected: false });
      setIsConnecting(false);
    } finally {
      creatingSessionsRef.current.delete(sessionName);
      setIsCreating(false);
      // Don't reset isConnecting here — let socket events handle it when QR/connect completes
      window.setTimeout(() => setCreateStatus("idle"), 1500);
    }
  };

  const handleGenerateQr = async (session: Session) => {
    const normalizedId = normalizeSessionName(session.id);
    if (restartingSessionId === normalizedId || session.status === "qr" || session.status === "connecting") return;

    setRestartingSessionId(normalizedId);
    setIsActivationDialogOpen(true);
    setIsConnecting(true);
    upsertSession(normalizedId, { status: "connecting", connected: false });

    try {
      const response = await apiService.restartSession(normalizedId);
      if (response?.qr) {
        const responseSessionId = normalizeSessionName(response.sessionId || normalizedId);
        setLastQr({ sessionId: responseSessionId, qr: response.qr });
        setShowQRModal(true);
        setIsActivationDialogOpen(true);
        upsertSession(responseSessionId, { status: "qr", connected: false });
      }
      notify.success("WhatsApp session restart requested");
      await loadSessions();
      setRestartingSessionId(null);
      setIsConnecting(false);
    } catch (error) {
      console.error("Erro ao gerar QR da sessão:", error);
      upsertSession(normalizedId, { status: "disconnected", connected: false });
      notify.error("Failed to restart session");
      setIsConnecting(false);
      setRestartingSessionId(null);
    }
  };

  const handleConnectSession = async (sessionId: string) => {
    const normalizedId = normalizeSessionName(sessionId);
    if (restartingSessionId === normalizedId) return;

    setRestartingSessionId(normalizedId);
    setIsActivationDialogOpen(true);
    setIsConnecting(true);
    upsertSession(normalizedId, { status: "connecting", connected: false });

    try {
      const response = await apiService.startSession(normalizedId);
      if (response?.qr) {
        const responseSessionId = normalizeSessionName(response.sessionId || normalizedId);
        setLastQr({ sessionId: responseSessionId, qr: response.qr });
        setShowQRModal(true);
        setIsActivationDialogOpen(true);
        upsertSession(responseSessionId, { status: "qr", connected: false });
      }
      notify.success("Session connect requested");
      await loadSessions();
      setRestartingSessionId(null);
      setIsConnecting(false);
    } catch (error) {
      console.error("Erro ao conectar sessão:", error);
      upsertSession(normalizedId, { status: "disconnected", connected: false });
      notify.error("Failed to connect session");
      setIsConnecting(false);
      setRestartingSessionId(null);
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    const normalizedId = normalizeSessionName(sessionId);

    try {
      await apiService.logoutSession(normalizedId);
      upsertSession(normalizedId, { status: "disconnected", connected: false });
      notify.warning("WhatsApp session disconnected");
      setShowQRModal(false);
      setIsActivationDialogOpen(false);
      setIsConnecting(false);
      await loadSessions();
    } catch (error) {
      console.error("Erro ao desconectar sessão:", error);
      notify.error("Failed to disconnect session");
    }
  };

  const handleDelete = async (id: string) => {
    const normalizedId = normalizeSessionName(id);
    if (deletingSessionId === normalizedId) return;

    setDeletingSessionId(normalizedId);
    try {
      await apiService.deleteSession(normalizedId);
      setSessions((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.filter((session) => normalizeSessionName(session.id) !== normalizedId);
      });

      notify.warning("WhatsApp session deleted");
      if (lastQr?.sessionId === id || lastQr?.sessionId === normalizedId) {
        setLastQr(null);
        setShowQRModal(false);
      }
    } catch (error) {
      console.error("Erro ao remover sessão:", error);
      notify.error("Failed to delete session");
    } finally {
      setDeletingSessionId(null);
    }
  };

  const connectedCount = safeSessions.filter((session) => session.status === "connected").length;
  const connectingCount = safeSessions.filter((session) => session.status === "connecting" || session.status === "qr").length;
  const disconnectedCount = safeSessions.filter((session) => session.status === "disconnected").length;
  const activeSessionName = safeSessions.find((session) => session.status === "connected")?.name ?? null;
  const currentQrImage = resolveQrImage(lastQr?.qr);
  const currentQrSession = safeSessions.find((session) => session.id === lastQr?.sessionId);
  const isQrModalVisible = showQRModal && currentQrSession?.status === "qr";
  const showQrImage = isQrModalVisible && Boolean(currentQrImage);

  const qrModalDescription = useMemo(() => {
    if (currentQrSession?.status === "connected") return "Connected";
    if (currentQrSession?.status === "qr" && currentQrImage) return "Scan QR";
    return "Waiting for QR";
  }, [currentQrImage, currentQrSession?.status]);

  return (
    <div className="min-h-screen">
      <Header title="Conexões WhatsApp" subtitle="Gerencie suas sessões de WhatsApp" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle weight="fill" className="w-6 h-6 text-success" /></div><div><p className="text-sm text-muted-foreground">Conectadas</p><h3 className="text-2xl font-bold font-display">{connectedCount}</h3></div></div></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center"><Spinner weight="bold" className="w-6 h-6 text-warning animate-spin" /></div><div><p className="text-sm text-muted-foreground">Conectando</p><h3 className="text-2xl font-bold font-display">{connectingCount}</h3></div></div></CardContent></Card>
          <Card className="metric-card"><CardContent className="p-5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><XCircle weight="fill" className="w-6 h-6 text-muted-foreground" /></div><div><p className="text-sm text-muted-foreground">Desconectadas</p><h3 className="text-2xl font-bold font-display">{disconnectedCount}</h3></div></div></CardContent></Card>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">Sessão ativa</p>
          <Badge variant={activeSessionName ? "default" : "secondary"}>{activeSessionName ?? "Nenhuma"}</Badge>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Suas Sessões</h2>
          <Dialog
            open={isActivationDialogOpen}
            onOpenChange={(open) => {
              setIsActivationDialogOpen(open);
              if (!open) setShowQRModal(false);
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus weight="bold" className="w-4 h-4" />Activate WhatsApp</Button>
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

                <Button className="w-full gap-2" onClick={() => void handleCreateSession()} disabled={!newSessionName.trim() || isCreating}>
                  {isCreating ? <Spinner weight="bold" className="w-4 h-4 animate-spin" /> : <QrCode weight="bold" className="w-4 h-4" />}
                  {createStatus === "success" ? "Success" : createStatus === "error" ? "Error" : isCreating ? "Creating..." : "Activate WhatsApp"}
                </Button>

                {isQrModalVisible && (
                  <div className="space-y-3 text-center">
                    {showQrImage ? (
                      <img
                        src={currentQrImage ?? undefined}
                        alt="QR Code da sessão WhatsApp"
                        className="mx-auto block h-[280px] w-[280px] rounded-lg border border-border"
                      />
                    ) : (
                      <div className="p-3 rounded-lg bg-muted text-xs font-mono break-all">Waiting for QR code</div>
                    )}
                    <p className="text-sm text-muted-foreground">{qrModalDescription} ({lastQr?.sessionId || newSessionName || "session"})</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isSessionsLoading
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
            : safeSessions.map((session) => {
                const meta = statusMeta(session.status);
                const normalizedId = normalizeSessionName(session.id);
                const isRestarting = restartingSessionId === normalizedId;
                const isDeleting = deletingSessionId === normalizedId;
                const preventQrRegeneration = session.status === "connecting" || session.status === "qr" || isRestarting;

                return (
                  <Card key={session.id} className="glass-card overflow-hidden">
                    <div className={meta.lineClass} />
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-whatsapp/10 flex items-center justify-center"><WhatsappLogo weight="fill" className="w-6 h-6 text-whatsapp" /></div>
                          <div>
                            <h3 className="font-semibold">{session.name}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone weight="fill" className="w-3 h-3" />{session.phone || "-"}</p>
                          </div>
                        </div>
                        <Badge className={meta.badgeClass}>{meta.emoji} {meta.label}</Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => void handleGenerateQr(session)} disabled={preventQrRegeneration || isDeleting}>
                          {isRestarting ? <Spinner className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                          {isRestarting ? "Loading" : "Generate QR"}
                        </Button>
                        {session.status === "connected" ? (
                          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => void handleLogoutSession(session.id)} disabled={isRestarting || isDeleting}>
                            <ArrowClockwise className="w-4 h-4" />Logout
                          </Button>
                        ) : session.status === "disconnected" ? (
                          <Button size="sm" className="w-full gap-2" onClick={() => void handleConnectSession(session.id)} disabled={isRestarting || isDeleting}>
                            {isRestarting ? <Spinner className="w-4 h-4 animate-spin" /> : <ArrowClockwise className="w-4 h-4" />}
                            {isRestarting ? "Loading" : "Connect"}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => void handleConnectSession(session.id)} disabled={isRestarting || isDeleting}>
                            {isRestarting ? <Spinner className="w-4 h-4 animate-spin" /> : <ArrowClockwise className="w-4 h-4" />}
                            {isRestarting ? "Loading" : "Restart"}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => void handleDelete(session.id)} disabled={isDeleting}>
                          {isDeleting ? <Spinner className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                          {isDeleting ? "Loading" : "Delete"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </motion.div>
    </div>
  );
}
