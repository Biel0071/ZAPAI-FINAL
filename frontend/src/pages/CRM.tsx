import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  MagnifyingGlass,
  Plus,
  FunnelSimple,
  DotsThree,
  Phone,
  EnvelopeSimple,
  WhatsappLogo,
  Tag,
  Calendar,
  User,
  Buildings,
  CaretDown,
  Star,
  Archive,
  Trash,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiService, type AIStatusResponse, type Conversation, type SessionInfo } from "@/services/apiService";
import { systemControlService } from "@/services/systemControlService";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  avatar: string;
  stage: "new" | "contacted" | "qualified" | "proposal" | "closed";
  value?: number;
  tags: string[];
  lastContact: string;
  score: number;
}

const stages = [
  { id: "new", name: "Novos Leads", color: "bg-info" },
  { id: "contacted", name: "Contatados", color: "bg-warning" },
  { id: "qualified", name: "Qualificados", color: "bg-primary" },
  { id: "proposal", name: "Proposta", color: "bg-chart-4" },
  { id: "closed", name: "Fechados", color: "bg-success" },
];

const CRM_DATA_REFRESH_MS = 30_000;
const SYSTEM_STATUS_REFRESH_MS = 45_000;
const DIAGNOSTICS_REFRESH_MS = 60_000;
const SESSION_STATUS_REFRESH_MS = 45_000;
const LEADS_PER_STAGE_PAGE = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeConversationsPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry) => isRecord(entry));
  }

  if (!isRecord(payload)) {
    return [];
  }

  const nestedCandidates = [payload.data, payload.items, payload.results, payload.conversations];
  const nestedList = nestedCandidates.find((candidate) => Array.isArray(candidate));
  if (Array.isArray(nestedList)) {
    return nestedList.filter((entry) => isRecord(entry));
  }

  return [];
}

function inferLeadStage(conversation: Partial<Conversation>): Lead["stage"] {
  const normalizedLast = (conversation.lastMessage ?? "").toLowerCase();
  if (normalizedLast.includes("fechado") || normalizedLast.includes("confirmado")) return "closed";
  if ((conversation.unread ?? 0) > 3) return "contacted";
  if (normalizedLast.includes("orçamento") || normalizedLast.includes("proposta")) return "proposal";
  if (normalizedLast.includes("interesse") || normalizedLast.includes("preço")) return "qualified";
  return "new";
}

function mapConversationsToLeads(conversations: unknown): Lead[] {
  const safeConversations = normalizeConversationsPayload(conversations);

  return safeConversations.map((conversation, index) => {
    const safeConversation = isRecord(conversation) ? (conversation as Partial<Conversation> & Record<string, unknown>) : {};
    const digits = (safeConversation.phone ?? "").replace(/\D/g, "");
    const fallbackName = safeConversation.contactName || (digits ? `Lead ${digits.slice(-4)}` : `Lead ${index + 1}`);
    const deterministicScore = Math.max(35, Math.min(100, 45 + (safeConversation.unread ?? 0) * 8));
    const lastContactRaw = new Date(safeConversation.updatedAt).toLocaleString("pt-BR");
    const lastContact = lastContactRaw === "Invalid Date" ? "Sem data" : lastContactRaw;

    return {
      id: safeConversation.id,
      name: fallbackName,
      email: "",
      phone: safeConversation.phone ?? "",
      company: undefined,
      avatar: fallbackName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "LD",
      stage: inferLeadStage(safeConversation),
      value: undefined,
      tags: safeConversation.tags && safeConversation.tags.length > 0 ? safeConversation.tags : ["WhatsApp"],
      lastContact,
      score: deterministicScore,
    };
  });
}

function resolveAIEnabled(status: AIStatusResponse | null): boolean {
  if (!status) return false;
  const rawStatus = status as AIStatusResponse & Record<string, unknown>;
  if (typeof rawStatus.ai === "boolean") return rawStatus.ai;
  if (typeof status.enabled === "boolean") return status.enabled;
  if (typeof status.active === "boolean") return status.active;
  if (typeof status.status === "string") {
    const normalized = status.status.toLowerCase();
    return normalized === "on" || normalized === "enabled" || normalized === "active";
  }
  return false;
}

function areLeadsEqual(current: Lead[], next: Lead[]): boolean {
  if (current.length !== next.length) return false;

  return current.every((lead, index) => {
    const candidate = next[index];
    if (!candidate) return false;

    return (
      lead.id === candidate.id &&
      lead.name === candidate.name &&
      lead.phone === candidate.phone &&
      lead.stage === candidate.stage &&
      lead.score === candidate.score &&
      lead.lastContact === candidate.lastContact
    );
  });
}

type WhatsAppConnectionStatus = "offline" | "connecting" | "online";
type SystemControlStatus = "active" | "inactive";
type SystemWidgetStatus = "active" | "connecting" | "offline";

type SystemWidgetKey = "whatsapp" | "database" | "aiEngine" | "runtime" | "inboxSocket";

type SystemWidgetState = Record<SystemWidgetKey, SystemWidgetStatus>;

function resolveWhatsappStatus(sessions: SessionInfo[]): WhatsAppConnectionStatus {
  if (!Array.isArray(sessions) || sessions.length === 0) return "offline";

  const hasConnectedSession = sessions.some((session) => {
    const status = (session.status ?? "").toLowerCase();
    return Boolean(session.connected || status === "connected" || status === "online" || status === "active" || status === "open");
  });
  if (hasConnectedSession) return "online";

  const hasConnectingSession = sessions.some((session) => {
    const status = (session.status ?? "").toLowerCase();
    return status === "connecting" || status === "qr_ready" || status === "qr" || status === "awaiting_qr";
  });
  if (hasConnectingSession) return "connecting";

  return "offline";
}

function normalizeSystemWidgetStatus(value: unknown): SystemWidgetStatus {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["active", "online", "connected", "ok", "healthy", "running", "up", "ready", "true"].includes(normalized)) return "active";
  if (["connecting", "pending", "starting", "loading", "degraded", "warning"].includes(normalized)) return "connecting";
  return "offline";
}

function extractSystemWidgetStatus(raw: Record<string, unknown>, keys: string[]): SystemWidgetStatus {
  for (const key of keys) {
    const value = raw[key];

    if (Array.isArray(value)) {
      const normalizedItems = value.map((item) => {
        if (item && typeof item === "object") {
          const nested = item as Record<string, unknown>;
          return normalizeSystemWidgetStatus(nested.status ?? nested.state ?? nested.connected ?? nested.active);
        }
        return normalizeSystemWidgetStatus(item);
      });

      if (normalizedItems.includes("active")) return "active";
      if (normalizedItems.includes("connecting")) return "connecting";
      if (normalizedItems.length > 0) return "offline";
      continue;
    }

    if (typeof value === "boolean") return value ? "active" : "offline";
    if (typeof value === "number") return value > 0 ? "active" : "offline";
    if (typeof value === "string") return normalizeSystemWidgetStatus(value);
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      const nestedCandidate = nested.status ?? nested.state ?? nested.connected ?? nested.active;
      if (nestedCandidate !== undefined) return normalizeSystemWidgetStatus(nestedCandidate);
    }
  }
  return "offline";
}

function buildSystemWidgetState(raw: Record<string, unknown>): SystemWidgetState {
  return {
    whatsapp: extractSystemWidgetStatus(raw, ["whatsapp", "whatsappStatus", "whatsapp_status", "sessions", "sessionStatus"]),
    database: extractSystemWidgetStatus(raw, ["database", "databaseStatus", "db", "postgres", "postgresql"]),
    aiEngine: extractSystemWidgetStatus(raw, ["aiEngine", "aiEngineStatus", "ai", "ai_status", "llm", "engine"]),
    runtime: extractSystemWidgetStatus(raw, ["runtime", "runtimeActive", "system", "systemStatus", "service", "status"]),
    inboxSocket: extractSystemWidgetStatus(raw, ["socket", "socketConnections", "socketIo", "socket_io", "inboxSocket", "realtime"]),
  };
}

function widgetStatusMeta(status: SystemWidgetStatus) {
  if (status === "active") return { label: "active", badgeClass: "bg-success/15 text-success" };
  if (status === "connecting") return { label: "connecting", badgeClass: "bg-warning/15 text-warning" };
  return { label: "offline", badgeClass: "bg-destructive/15 text-destructive" };
}

function formatWhatsAppPhone(phone: string): string {
  const normalized = phone.trim();
  if (!normalized) return "";
  if (normalized.includes("@")) return normalized;
  const digits = normalized.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
}

function normalizeSessionName(sessionName: string): string {
  return sessionName.trim().replace(/\s+/g, "_").toLowerCase();
}

function resolveQrImage(qr?: string): string | null {
  if (!qr) return null;
  if (qr.startsWith("data:image")) return qr;
  if (/^[A-Za-z0-9+/=]+$/.test(qr)) return `data:image/png;base64,${qr}`;
  return null;
}

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [isAIStatusLoading, setIsAIStatusLoading] = useState(true);
  const [isAIToggling, setIsAIToggling] = useState(false);
  const [publicApiUrl, setPublicApiUrl] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WhatsAppConnectionStatus>("offline");
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [isActivatingWhatsApp, setIsActivatingWhatsApp] = useState(false);
  const [chatPhone, setChatPhone] = useState("5511999999999@s.whatsapp.net");
  const [chatText, setChatText] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [lastRealtimeMessage, setLastRealtimeMessage] = useState<string>("");
  const [systemStatus, setSystemStatus] = useState<SystemControlStatus>("inactive");
  const [isSystemLoading, setIsSystemLoading] = useState(true);
  const [isSystemActionLoading, setIsSystemActionLoading] = useState(false);
  const [crmLoadError, setCrmLoadError] = useState<string | null>(null);
  const [isCrmDataLoading, setIsCrmDataLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<Lead["stage"] | "all">("all");
  const [stagePages, setStagePages] = useState<Record<Lead["stage"], number>>({
    new: 1,
    contacted: 1,
    qualified: 1,
    proposal: 1,
    closed: 1,
  });
  const [systemWidgetState, setSystemWidgetState] = useState<SystemWidgetState>({
    whatsapp: "offline",
    database: "offline",
    aiEngine: "offline",
    runtime: "offline",
    inboxSocket: "offline",
  });
  const isRefreshingPersistentDataRef = useRef(false);
  const isLoadingSystemStatusRef = useRef(false);
  const isLoadingDiagnosticsRef = useRef(false);
  const isLoadingSessionStatusRef = useRef(false);

  const safeLeads = useMemo(() => (Array.isArray(leads) ? leads : []), [leads]);
  const safeSearchQuery = searchQuery.trim().toLowerCase();

  const filteredLeads = useMemo(() => {
    return safeLeads.filter((lead) => {
      if (stageFilter !== "all" && lead.stage !== stageFilter) return false;
      if (!safeSearchQuery) return true;

      const leadName = String(lead.name ?? "").toLowerCase();
      const leadPhone = String(lead.phone ?? "").toLowerCase();
      const leadCompany = String(lead.company ?? "").toLowerCase();
      const leadTags = (Array.isArray(lead.tags) ? lead.tags : []).join(" ").toLowerCase();

      return (
        leadName.includes(safeSearchQuery) ||
        leadPhone.includes(safeSearchQuery) ||
        leadCompany.includes(safeSearchQuery) ||
        leadTags.includes(safeSearchQuery)
      );
    });
  }, [safeLeads, safeSearchQuery, stageFilter]);

  const leadsByStage = useMemo(() => {
    return stages.reduce<Record<Lead["stage"], Lead[]>>(
      (accumulator, stage) => {
        const stageId = stage.id as Lead["stage"];
        accumulator[stageId] = filteredLeads.filter((lead) => lead.stage === stageId);
        return accumulator;
      },
      {
        new: [],
        contacted: [],
        qualified: [],
        proposal: [],
        closed: [],
      },
    );
  }, [filteredLeads]);

  useEffect(() => {
    setStagePages({
      new: 1,
      contacted: 1,
      qualified: 1,
      proposal: 1,
      closed: 1,
    });
  }, [safeSearchQuery, stageFilter]);

  useEffect(() => {
    let isMounted = true;

    const loadInitial = async () => {
      try {
        const [status, publicUrlData] = await Promise.all([
          apiService.getAIStatus(),
          apiService.getPublicUrl(),
        ]);

        if (!isMounted) return;
        setIsAIEnabled(resolveAIEnabled(status));
        setPublicApiUrl(typeof publicUrlData.publicUrl === "string" ? publicUrlData.publicUrl.trim() || null : null);
        setCrmLoadError(null);
      } catch (error) {
        if (import.meta.env.MODE !== 'production') console.error("Erro ao carregar configuração do CRM:", error);
        if (isMounted) {
          setCrmLoadError("Falha ao carregar dados do CRM. Verifique a conexão com o backend.");
        }
      } finally {
        if (isMounted) setIsAIStatusLoading(false);
      }
    };

    const loadPersistentData = async (forceRefresh: boolean) => {
      if (isRefreshingPersistentDataRef.current) {
        return;
      }

      isRefreshingPersistentDataRef.current = true;
      if (isMounted) {
        setIsCrmDataLoading((prev) => (forceRefresh ? prev : true));
      }

      try {
        const [sessions, conversations] = await Promise.all([
          apiService.listSessions(),
          apiService.getConversations(forceRefresh, { limit: 200 }),
        ]);

        if (!isMounted) return;

        const safeSessions = Array.isArray(sessions) ? sessions : [];
        const safeConversations = normalizeConversationsPayload(conversations);
        const currentSession =
          safeSessions.find((session) => session.connected || ["connected", "online", "active", "open"].includes((session.status ?? "").toLowerCase())) ??
          safeSessions[0] ??
          null;

        const nextActiveSession = currentSession?.id ?? null;
        const nextLeads = mapConversationsToLeads(safeConversations);

        setSessions(safeSessions);
        setActiveSession((prev) => (prev === nextActiveSession ? prev : nextActiveSession));
        setConnectionStatus(resolveWhatsappStatus(safeSessions));
        setLeads((prev) => (areLeadsEqual(prev, nextLeads) ? prev : nextLeads));
        setCrmLoadError(null);
      } catch (error) {
        if (import.meta.env.MODE !== 'production') console.error("Erro ao carregar dados persistidos do CRM:", error);
        if (isMounted) {
          setCrmLoadError("Não foi possível atualizar o CRM agora. Tentando novamente automaticamente.");
        }
      } finally {
        if (isMounted) {
          setIsCrmDataLoading(false);
        }
        isRefreshingPersistentDataRef.current = false;
      }
    };

    void loadInitial();
    void loadPersistentData(false);

    const intervalId = window.setInterval(() => {
      void loadPersistentData(true);
    }, CRM_DATA_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSystemStatus = async () => {
      if (isLoadingSystemStatusRef.current) {
        return;
      }

      isLoadingSystemStatusRef.current = true;
      try {
        const status = await systemControlService.getStatus(publicApiUrl ?? undefined);
        if (!isMounted) return;
        const nextSystemStatus: SystemControlStatus = status.active ? "active" : "inactive";
        setSystemStatus((prev) => (prev === nextSystemStatus ? prev : nextSystemStatus));
        setCrmLoadError(null);
      } catch (error) {
        if (import.meta.env.MODE !== 'production') console.error("Erro ao carregar status do sistema:", error);
        if (isMounted) {
          setCrmLoadError("Falha ao consultar status do sistema em tempo real.");
        }
      } finally {
        isLoadingSystemStatusRef.current = false;
        if (isMounted) setIsSystemLoading(false);
      }
    };

    void loadSystemStatus();

    const intervalId = window.setInterval(() => {
      void loadSystemStatus();
    }, SYSTEM_STATUS_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [publicApiUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadDiagnostics = async () => {
      if (isLoadingDiagnosticsRef.current) {
        return;
      }

      if (!publicApiUrl) {
        return;
      }

      isLoadingDiagnosticsRef.current = true;

      try {
        const diagnostics = await systemControlService.getDiagnostics(publicApiUrl);
        if (cancelled) return;
        const payload = diagnostics && typeof diagnostics === "object" ? (diagnostics as Record<string, unknown>) : {};
        const raw = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : payload;
        const nextWidgetState = buildSystemWidgetState(raw);
        setSystemWidgetState((prev) =>
          prev.whatsapp === nextWidgetState.whatsapp &&
          prev.database === nextWidgetState.database &&
          prev.aiEngine === nextWidgetState.aiEngine &&
          prev.runtime === nextWidgetState.runtime &&
          prev.inboxSocket === nextWidgetState.inboxSocket
            ? prev
            : nextWidgetState,
        );
        setCrmLoadError(null);
      } catch {
        if (!cancelled) {
          setSystemWidgetState({
            whatsapp: "offline",
            database: "offline",
            aiEngine: "offline",
            runtime: "offline",
            inboxSocket: "offline",
          });
          setCrmLoadError("Diagnóstico indisponível no momento. Exibindo último estado seguro.");
        }
      } finally {
        isLoadingDiagnosticsRef.current = false;
      }
    };

    void loadDiagnostics();
    const intervalId = window.setInterval(() => {
      void loadDiagnostics();
    }, DIAGNOSTICS_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [publicApiUrl]);

  useEffect(() => {
    let isMounted = true;

    const loadSessionStatus = async () => {
      if (isLoadingSessionStatusRef.current) {
        return;
      }

      if (connectionStatus === "online") {
        return;
      }

      isLoadingSessionStatusRef.current = true;
      try {
        const session = await apiService.getSessionStatus();
        if (!isMounted) return;

        const nextStatus: WhatsAppConnectionStatus = session.connected ? "online" : "offline";
        setConnectionStatus((prev) => (prev === nextStatus ? prev : nextStatus));
        if (!session.connected) setIsActivatingWhatsApp(false);
        if (!session.connected) setShowQrModal(false);
      } catch (error) {
        console.error("Erro ao carregar status da sessão:", error);
        if (!isMounted) return;
        setConnectionStatus("offline");
      } finally {
        isLoadingSessionStatusRef.current = false;
      }
    };

    void loadSessionStatus();
    const intervalId = window.setInterval(() => {
      void loadSessionStatus();
    }, SESSION_STATUS_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [connectionStatus]);

  const handleAIToggle = async () => {
    if (isAIToggling || isAIStatusLoading) return;

    setIsAIToggling(true);
    try {
      if (isAIEnabled) {
        await apiService.disableAI();
        setIsAIEnabled(false);
      } else {
        await apiService.enableAI();
        setIsAIEnabled(true);
      }
    } catch (error) {
      console.error("Erro ao alternar IA:", error);
    } finally {
      setIsAIToggling(false);
    }
  };

  const handleActivateSystem = async () => {
    if (isSystemActionLoading) return;

    setIsSystemActionLoading(true);
    try {
      await systemControlService.activate(publicApiUrl ?? undefined);
      setSystemStatus("active");
    } catch (error) {
      console.error("Erro ao ativar sistema:", error);
    } finally {
      setIsSystemActionLoading(false);
    }
  };

  const handleStopSystem = async () => {
    if (isSystemActionLoading) return;

    setIsSystemActionLoading(true);
    try {
      await systemControlService.stop(publicApiUrl ?? undefined);
      setSystemStatus("inactive");
    } catch (error) {
      console.error("Erro ao parar sistema:", error);
    } finally {
      setIsSystemActionLoading(false);
    }
  };

  const handleActivateWhatsApp = async () => {
    if (isActivatingWhatsApp) return;

    const sessionName = normalizeSessionName(activeSession || "main");

    setIsActivatingWhatsApp(true);
    setConnectionStatus("connecting");
    setQrCode(null);
    setShowQrModal(false);

    try {
      const response = await apiService.startSession(sessionName);
      if (response?.sessionId) setActiveSession(response.sessionId);
      if (response?.qr) setQrCode(response.qr);
    } catch (error) {
      console.error("Erro ao ativar WhatsApp:", error);
      setConnectionStatus("offline");
      setIsActivatingWhatsApp(false);
    }
  };

  const handleSendWhatsappMessage = async () => {
    if (connectionStatus !== "online" || !activeSession || isSendingChat) return;

    const normalizedPhone = formatWhatsAppPhone(chatPhone);
    const normalizedText = chatText.trim();
    if (!normalizedPhone || !normalizedText) return;

    setIsSendingChat(true);
    try {
      await apiService.sendMessage({
        phone: normalizedPhone,
        text: normalizedText,
        sessionId: activeSession,
      });
      setChatText("");
    } catch (error) {
      console.error("Erro ao enviar mensagem no CRM:", error);
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="CRM" subtitle="Gerencie seus leads e oportunidades" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 space-y-6"
      >
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Leads</p>
                  <h3 className="text-2xl font-bold font-display">{filteredLeads.length}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User weight="duotone" className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <h3 className="text-2xl font-bold font-display">
                    R$ {filteredLeads.reduce((sum, l) => sum + (l.value || 0), 0).toLocaleString()}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <span className="text-success font-bold">R$</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <h3 className="text-2xl font-bold font-display">23.5%</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                  <span className="text-info font-bold">%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="metric-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <h3 className="text-2xl font-bold font-display">
                    R$ {Math.round(filteredLeads.reduce((sum, l) => sum + (l.value || 0), 0) / Math.max(filteredLeads.length, 1)).toLocaleString()}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Buildings weight="duotone" className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {crmLoadError && (
          <Card className="border-warning/40 bg-warning/10">
            <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-foreground">{crmLoadError}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Recarregar página
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">System Control</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Show system status and control runtime</p>
              <Badge variant="secondary" className="w-fit">
                {isSystemLoading ? "Checking status..." : systemStatus === "active" ? "🟢 Active" : "🔴 Inactive"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => void handleActivateSystem()}
                disabled={isSystemActionLoading || systemStatus === "active"}
              >
                Activate System
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleStopSystem()}
                disabled={isSystemActionLoading || systemStatus === "inactive"}
              >
                Stop System
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {([
                ["whatsapp", "WhatsApp"],
                ["database", "Database"],
                ["aiEngine", "AI Engine"],
                ["runtime", "Runtime"],
                ["inboxSocket", "Inbox Socket"],
              ] as const).map(([key, label]) => {
                const meta = widgetStatusMeta(systemWidgetState[key]);
                return (
                  <div key={key} className="rounded-lg border border-border bg-card/60 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <Badge variant="secondary" className={cn("mt-2 capitalize", meta.badgeClass)}>
                      {meta.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Atualiza automaticamente a cada 20 segundos via GET /diagnostics.</p>
          </CardContent>
        </Card>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                className="w-64 pl-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FunnelSimple className="w-4 h-4" />
                  {stageFilter === "all" ? "Todos os estágios" : stages.find((stage) => stage.id === stageFilter)?.name ?? "Filtro"}
                  <CaretDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setStageFilter("all")}>Todos os estágios</DropdownMenuItem>
                {stages.map((stage) => (
                  <DropdownMenuItem key={`filter-${stage.id}`} onClick={() => setStageFilter(stage.id as Lead["stage"])}>
                    {stage.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {connectionStatus === "online" ? "🟢 Online" : connectionStatus === "connecting" ? "🟡 Connecting" : "🔴 Offline"}
            </Badge>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleAIToggle}
              disabled={isAIToggling || isAIStatusLoading}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  isAIEnabled ? "bg-success" : "bg-muted-foreground/50",
                )}
              />
              IA Ativa
            </Button>
            <Button
              variant={connectionStatus === "online" ? "secondary" : "default"}
              className="gap-2"
              onClick={() => void handleActivateWhatsApp()}
              disabled={isActivatingWhatsApp}
            >
              <WhatsappLogo weight="fill" className="w-4 h-4" />
              Ativar WhatsApp
            </Button>
            <Button className="gap-2">
              <Plus weight="bold" className="w-4 h-4" />
              Novo Lead
            </Button>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Chat WhatsApp (CRM)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,280px)_1fr_auto]">
              <Input
                value={chatPhone}
                onChange={(event) => setChatPhone(event.target.value)}
                placeholder="5511999999999@s.whatsapp.net"
                disabled={connectionStatus !== "online" || !activeSession || isSendingChat}
              />
              <Input
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                placeholder={connectionStatus === "online" && activeSession ? "Digite sua mensagem..." : "Conecte o WhatsApp para enviar"}
                disabled={connectionStatus !== "online" || !activeSession || isSendingChat}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendWhatsappMessage();
                  }
                }}
              />
              <Button
                onClick={() => void handleSendWhatsappMessage()}
                disabled={connectionStatus !== "online" || !activeSession || isSendingChat || !chatText.trim()}
              >
                Enviar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Endpoint de envio: <span className="font-mono">POST /send-message</span>
            </p>
            {lastRealtimeMessage && (
              <p className="text-xs text-muted-foreground">
                Última mensagem em tempo real: {lastRealtimeMessage}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Kanban board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageId = stage.id as Lead["stage"];
            const stageLeads = leadsByStage[stageId] ?? [];
            const currentPage = stagePages[stageId] ?? 1;
            const visibleLeads = stageLeads.slice(0, currentPage * LEADS_PER_STAGE_PAGE);
            const hasMoreLeads = stageLeads.length > visibleLeads.length;

            return (
            <div key={stage.id} className="crm-stage min-w-[300px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full", stage.color)} />
                  <h3 className="font-semibold">{stage.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {stageLeads.length}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  R$ {stageLeads.reduce((sum, lead) => sum + (lead.value || 0), 0).toLocaleString()}
                </span>
              </div>

              <div className="space-y-3">
                {isCrmDataLoading && visibleLeads.length === 0 ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="border-dashed">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Skeleton className="w-8 h-8 rounded-full" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/4" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : visibleLeads.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">Nenhum lead neste estágio.</CardContent>
                  </Card>
                ) : (
                  visibleLeads.map((lead, index) => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    draggable
                    onDragStart={() => setDraggedLead(lead)}
                    onDragEnd={() => setDraggedLead(null)}
                    className="lead-card"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {lead.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium text-sm">{lead.name}</h4>
                          {lead.company && (
                            <p className="text-xs text-muted-foreground">
                              {lead.company}
                            </p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <DotsThree weight="bold" className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <WhatsappLogo className="w-4 h-4 mr-2" />
                            Enviar mensagem
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Star className="w-4 h-4 mr-2" />
                            Favoritar
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Archive className="w-4 h-4 mr-2" />
                            Arquivar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {lead.value && (
                      <p className="text-lg font-bold font-display text-primary mb-2">
                        R$ {lead.value.toLocaleString()}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mb-3">
                      {(Array.isArray(lead.tags) ? lead.tags : []).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <button className="hover:text-foreground transition-colors">
                          <Phone weight="fill" className="w-3.5 h-3.5" />
                        </button>
                        <button className="hover:text-foreground transition-colors">
                          <EnvelopeSimple weight="fill" className="w-3.5 h-3.5" />
                        </button>
                        <button className="hover:text-whatsapp transition-colors">
                          <WhatsappLogo weight="fill" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span>{lead.lastContact}</span>
                    </div>

                    {/* Score indicator */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Lead Score</span>
                        <span className="font-medium">{lead.score}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            lead.score >= 80 ? "bg-success" : lead.score >= 50 ? "bg-warning" : "bg-destructive"
                          )}
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))
                )}

                {hasMoreLeads && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      setStagePages((prev) => ({
                        ...prev,
                        [stageId]: (prev[stageId] ?? 1) + 1,
                      }))
                    }
                  >
                    Mostrar mais ({stageLeads.length - visibleLeads.length})
                  </Button>
                )}
              </div>
            </div>
          );
          })}
        </div>

        <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Ativar WhatsApp</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-center">
              {resolveQrImage(qrCode ?? undefined) ? (
                <img
                  src={resolveQrImage(qrCode ?? undefined) ?? ""}
                  alt="QR Code do WhatsApp"
                  className="mx-auto h-56 w-56 rounded-lg border border-border"
                />
              ) : (
                <div className="rounded-lg border border-border bg-muted p-3 text-xs font-mono break-all">
                  {qrCode || "Aguardando QR Code..."}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {connectionStatus === "online"
                  ? "WhatsApp Connected"
                  : resolveQrImage(qrCode ?? undefined)
                    ? "Scan QR code"
                    : "Waiting for QR code"}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
