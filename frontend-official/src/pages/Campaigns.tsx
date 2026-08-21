import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Megaphone,
  PaperPlaneTilt,
  Eye,
  CheckCircle,
  Plus,
  ArrowClockwise,
  Play,
  Pause,
  Trash,
  Copy,
  PencilSimple,
  Users,
  Clock,
  Sparkle,
  X,
  Paperclip,
  ImageSquare,
  VideoCamera,
  MusicNotes,
  FileText,
  ArrowsOutSimple,
  CalendarBlank,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import { CampaignsView, type CampaignsTab } from "@/lovable/pages/CampaignsView";
import { ConversionHeatmap } from "@/components/campaigns/ConversionHeatmap";
import { Stepper } from "@/components/campaigns/Stepper";
import { LeadKnowledgeGraph } from "@/components/contacts/LeadKnowledgeGraph";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { AICampaignModal } from "@/components/campaigns/AICampaignModal";
import { createCampaignsLovableViewModel } from "@/adapters/lovable/campaignsAdapter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { StatGridSkeleton } from "@/components/ui/loading-skeleton";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  apiService,
  type CampaignContact,
  type CampaignRecord,
  type Conversation,
  type Contact,
} from "@/services/apiService";
import { notify } from "@/services/notifyService";
import { cn } from "@/lib/utils";
import type { QuickReplyItem } from "./Inbox/types";

type ComposerMode = "create" | "edit" | "duplicate";
type CreationMode = "select" | "ai" | "manual";
type CampaignAction = "save" | "launch" | "start" | "pause" | "resume" | "delete" | "refresh" | null;
type CampaignDraftMediaType = "text" | "image" | "video" | "audio" | "document" | "file" | "sticker";
type CampaignDraftMessage = {
  id?: string;
  type: CampaignDraftMediaType;
  content: string;
  mediaUrl?: string | null;
  mediaPath?: string | null;
  fileName?: string | null;
  mimetype?: string | null;
  ptt?: boolean;
  localUrl?: string;
  uploadStatus?: "local" | "uploading" | "done" | "failed";
};

const STEP_LABELS = [
  "Público",
  "Mensagem",
  "Delays",
  "Revisão",
  "Lançar",
] as const;

const DEFAULT_MESSAGES = [
  "Olá! Tenho uma condição especial para te apresentar hoje.",
  "Oi! Posso te mostrar uma oportunidade alinhada ao seu perfil?",
];
const CAMPAIGN_MEDIA_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/json",
  "application/octet-stream",
].join(",");

function createDefaultDraftMessages(): CampaignDraftMessage[] {
  return DEFAULT_MESSAGES.map((content) => ({ type: "text", content }));
}

function createEmptyDraftMessage(): CampaignDraftMessage {
  return { type: "text", content: "" };
}

function inferCampaignMediaType(file: File): CampaignDraftMediaType {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith("image/") || name.endsWith(".webp")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("sticker")) return "sticker";
  return "document";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function getCampaignSessionId() {
  try {
    const selectedSession = window.localStorage.getItem("selectedSessionId")
      || window.localStorage.getItem("currentSessionId")
      || window.localStorage.getItem("activeSessionId")
      || window.localStorage.getItem("whatsappSessionId");
    return selectedSession || undefined;
  } catch {
    return undefined;
  }
}

function getDraftMediaIcon(type: CampaignDraftMediaType) {
  if (type === "image" || type === "sticker") return <ImageSquare className="h-4 w-4" />;
  if (type === "video") return <VideoCamera className="h-4 w-4" />;
  if (type === "audio") return <MusicNotes className="h-4 w-4" />;
  if (type === "document" || type === "file") return <FileText className="h-4 w-4" />;
  return <Paperclip className="h-4 w-4" />;
}

function normalizeCampaignStatus(campaign: CampaignRecord): CampaignRecord["status"] {
  if (campaign.queue?.paused) return "paused";
  const st = campaign.status || "draft";
  // Keep scheduled as-is so filter works
  return st;
}

function statusMeta(campaign: CampaignRecord) {
  const status = normalizeCampaignStatus(campaign).toLowerCase();

  if (["completed", "sent"].includes(status)) {
    return { label: "Concluída", tone: "online" as const, cardLine: "bg-success" };
  }
  if (["running", "active", "processing"].includes(status)) {
    return { label: "Em execução", tone: "syncing" as const, cardLine: "bg-info" };
  }
  if (["paused"].includes(status)) {
    return { label: "Pausada", tone: "warning" as const, cardLine: "bg-warning" };
  }
  if (["scheduled", "ready"].includes(status)) {
    return { label: "Agendada", tone: "syncing" as const, cardLine: "bg-info" };
  }
  if (["cancelled", "canceled"].includes(status)) {
    return { label: "Cancelada", tone: "offline" as const, cardLine: "bg-muted" };
  }
  return { label: "Rascunho", tone: "offline" as const, cardLine: "bg-muted" };
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não agendada";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Não agendada";
  return parsed.toLocaleString("pt-BR");
}

function formatElapsedTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  const totalSeconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 1) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
function formatDurationMs(ms?: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
function formatInputDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const timezoneOffsetMs = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function normalizePhone(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("@g.us")) return normalized;
  return normalized.replace(/\D/g, "");
}

function uniqueContacts(contacts: Contact[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = normalizePhone(contact.phone) || String(contact.id || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleCaseCampaign(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractCampaignProduct(prompt: string) {
  const cleanPrompt = prompt.replace(/\s+/g, " ").trim();
  const match = cleanPrompt.match(/(?:venda|vender|oferta|campanha|produto|servi[cç]o)\s+(?:de|do|da|para)?\s*([^.,;\n]+)/i);
  const product = (match?.[1] || cleanPrompt).replace(/\b(para|com|lead|leads|cliente|clientes|contato|contatos)\b.*$/i, "").trim();
  return titleCaseCampaign(product || "Produto");
}

function buildHumanizedFollowUpMessages(product: string, prompt: string, leadProfile: string): CampaignDraftMessage[] {
  const context = prompt.trim();
  const profileHint = leadProfile === "hot" ? "vi que pode fazer sentido para voce agora" : leadProfile === "cold" ? "sem pressa, so quero te apresentar de forma simples" : "acredito que pode encaixar bem no seu momento";
  return [
    {
      type: "text" as const,
      content: "Oi, tudo bem? Estou falando sobre " + product + ". " + profileHint + ". Posso te mandar uma ideia rapida?",
    },
    {
      type: "text" as const,
      content: "Vou ser direto: " + product + " ajuda quem quer resolver isso com mais praticidade e menos tentativa no escuro. Pelo seu perfil, pode valer uma olhada.",
    },
    {
      type: "text" as const,
      content: "Se fizer sentido, eu te mostro as condicoes e tiro suas duvidas por aqui mesmo. Quer que eu te envie os detalhes?",
    },
    {
      type: "text" as const,
      content: "Passando para fazer um follow-up rapido sobre " + product + ". Ainda faz sentido para voce ou prefere que eu te chame outro dia?",
    },
    {
      type: "text" as const,
      content: "Ultimo toque para nao te incomodar: consigo deixar uma condicao especial de " + product + " e te explicar em poucos minutos. Quer aproveitar?",
    },
  ].map((message, index) => ({
    ...message,
    content: context && index === 1 ? message.content + "\n\nContexto usado: " + context : message.content,
  }));
}

type CampaignDispatchStatus = {
  status?: string;
  pending?: number;
  metrics?: {
    total?: number;
    sent?: number;
    failed?: number;
    processed?: number;
    startedAt?: string | null;
    avgDeliveryMs?: number;
  };
};

type AICampaignDraft = {
  name?: string;
  messages?: string[];
  followUps?: string[];
  tags?: string[];
  delayProfile?: {
    typingSeconds?: number;
    intervalSeconds?: number;
    pauseEvery?: number;
    pauseSeconds?: number;
    dailyLimit?: number;
    hourlyLimit?: number;
  };
};

function parseAICampaignMessages(response?: string | null): AICampaignDraft | null {
  const raw = String(response || "").trim();
  if (!raw) return null;
  const fenced = raw.match(/`{3}(?:json)?\s*([\s\S]*?)`{3}/i)?.[1];
  const candidate = fenced || raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  try {
    const parsed = JSON.parse(candidate) as AICampaignDraft;
    const messages = [...(Array.isArray(parsed.messages) ? parsed.messages : []), ...(Array.isArray(parsed.followUps) ? parsed.followUps : [])]
      .map((message) => String(message || "").trim())
      .filter(Boolean);
    if (messages.length === 0) return null;
    return { ...parsed, messages };
  } catch {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((line) => line.length > 10)
      .slice(0, 6);
    return lines.length > 0 ? { messages: lines } : null;
  }
}

export default function Campaigns() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagInputVal, setTagInputVal] = useState("");
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaignStep, setCampaignStep] = useState(1);
  const [composerMode, setComposerMode] = useState<ComposerMode>("create");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [messageVariants, setMessageVariants] = useState<CampaignDraftMessage[]>(() => createDefaultDraftMessages());
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [typingDelay, setTypingDelay] = useState<number[]>([3]);
  const [intervalSeconds, setIntervalSeconds] = useState<number[]>([10]);
  const [pauseEvery, setPauseEvery] = useState("10");
  const [pauseSeconds, setPauseSeconds] = useState("60");
  const [warmupMessages, setWarmupMessages] = useState("5");
  const [warmupDelayMultiplier, setWarmupDelayMultiplier] = useState("3");
  const [dailyLimit, setDailyLimit] = useState("");
  const [hourlyLimit, setHourlyLimit] = useState("");
  const [startAt, setStartAt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [actionCampaignId, setActionCampaignId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<CampaignAction>(null);
  const [selectedCampaignPreview, setSelectedCampaignPreview] = useState<CampaignRecord | null>(null);
  const [dispatchStatuses, setDispatchStatuses] = useState<Record<string, CampaignDispatchStatus>>({});
  const [trackedDispatchIds, setTrackedDispatchIds] = useState<string[]>([]);
  const [aiCampaignPrompt, setAiCampaignPrompt] = useState("");
  const [aiLeadProfile, setAiLeadProfile] = useState("all");
  const [aiFollowUpDays, setAiFollowUpDays] = useState("3");
  const [aiAgents, setAiAgents] = useState<any[]>([]);
  const [selectedAiAgentKey, setSelectedAiAgentKey] = useState("");
  const [isAiCampaignGenerating, setIsAiCampaignGenerating] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Análise de IA do disparo (modal) + grafo do lead
  const [campaignAnalysis, setCampaignAnalysis] = useState<any | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [graphLead, setGraphLead] = useState<{ id: string; name: string } | null>(null);

  // Abas (Novo Disparo | Histórico | Análise IA) + paginação/filtros do histórico
  const [campaignsTab, setCampaignsTab] = useState<CampaignsTab>("compose");
  const [creationMode, setCreationMode] = useState<CreationMode>("ai");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(12);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all");
  const [historySearch, setHistorySearch] = useState("");

  const handleApplyGeneratedCampaign = useCallback((generatedData: any) => {
    if (!generatedData) return;
    if (generatedData.name) setCampaignName(generatedData.name);
    if (Array.isArray(generatedData.messages) && generatedData.messages.length > 0) {
      setMessageVariants(generatedData.messages.map((m: string) => ({ type: "text", content: m })));
    }
    setCampaignStep(1);
    setComposerMode("create");
    setCreationMode("manual");
  }, []);

  const loadPageData = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const [campaignList, contactList, conversationsData, quickRepliesData, agentsData] = await Promise.all([
        apiService.getCampaigns(),
        apiService.getContacts(true),
        apiService.getConversations(true, { limit: 500 }).catch(() => []),
        apiService.getQuickReplies().catch(() => []),
        apiService.getAIAgents().catch(() => ({ success: false, agents: [] })),
      ]);
      setCampaigns(Array.isArray(campaignList) ? campaignList : []);
      setQuickReplies(Array.isArray(quickRepliesData) ? quickRepliesData : []);
      const loadedAgents = Array.isArray(agentsData?.agents) ? agentsData.agents : [];
      setAiAgents(loadedAgents);
      setSelectedAiAgentKey((current) => current || String(loadedAgents.find((agent) => agent.active !== false)?.key || loadedAgents[0]?.key || ""));

      const conversationsByPhone = new Map<string, Conversation>();
      (Array.isArray(conversationsData) ? conversationsData : []).forEach((conversation) => {
        const key = normalizePhone(conversation.phone) || String(conversation.id || "").trim();
        if (!key) return;
        const existing = conversationsByPhone.get(key);
        if (!existing || new Date(conversation.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          conversationsByPhone.set(key, conversation);
        }
      });

      const normalizedContacts = (Array.isArray(contactList) ? contactList : []).map((contact) => {
        const conversation = conversationsByPhone.get(normalizePhone(contact.phone) || String(contact.id || "").trim());
        return {
          id: contact.id,
          name: contact.name || conversation?.contactName || contact.phone || "Contato",
          phone: contact.phone || conversation?.phone || "",
          status: conversation?.status,
          updatedAt: conversation?.updatedAt || new Date().toISOString(),
        };
      });

      const orphanConversations = (Array.isArray(conversationsData) ? conversationsData : [])
        .filter((conversation) => {
          const conversationPhone = normalizePhone(conversation.phone) || String(conversation.id || "").trim();
          return !normalizedContacts.some((contact) => (normalizePhone(contact.phone) || String(contact.id || "").trim()) === conversationPhone);
        })
        .map((conv) => ({
          id: conv.id,
          name: conv.contactName || conv.phone || "Contato",
          phone: conv.phone || "",
          status: conv.status,
          updatedAt: conv.updatedAt || new Date().toISOString(),
        }));

      const byPhone = new Map<string, Contact>();
      [...normalizedContacts, ...orphanConversations].forEach((contact) => {
        const key = normalizePhone(contact.phone) || String(contact.id || "").trim();
        const existing = byPhone.get(key);
        if (!existing || new Date(contact.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          byPhone.set(key, contact);
        }
      });

      const mergedContacts = [...byPhone.values()];
      setContacts(uniqueContacts(mergedContacts));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Falha ao carregar campanhas");
      if (!options?.silent) {
        setCampaigns([]);
        setContacts([]);
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  const refreshCampaignDispatchStatus = useCallback(async (campaignId: string) => {
    try {
      const statusResult = await apiService.getCampaignDispatchStatus(campaignId);
      const rawStatus = ((statusResult as { data?: unknown }).data ?? statusResult) as CampaignDispatchStatus | null;
      if (rawStatus && typeof rawStatus === "object") {
        setDispatchStatuses((current) => ({ ...current, [campaignId]: rawStatus }));
        return rawStatus;
      }
      return null;
    } catch {
      setTrackedDispatchIds((current) => current.filter((id) => id !== campaignId));
      return null;
    }
  }, []);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const resetComposer = useCallback(() => {
    setCampaignsTab("compose");
    setComposerMode("create");
    setEditingCampaignId(null);
    setCampaignName("");
    setSelectedContactIds([]);
    setMessageVariants(createDefaultDraftMessages());
    setShuffleEnabled(true);
    setTypingDelay([3]);
    setIntervalSeconds([10]);
    setPauseEvery("10");
    setPauseSeconds("60");
    setWarmupMessages("5");
    setWarmupDelayMultiplier("3");
    setDailyLimit("");
    setHourlyLimit("");
    setStartAt("");
    setTagsInput("");
    setCampaignStep(1);
    setSearchQuery("");
    setSelectedFlowId(null);
    setAiCampaignPrompt("");
    setAiLeadProfile("all");
    setAiFollowUpDays("3");
    setIsAiCampaignGenerating(false);
  }, []);

  const hydrateComposer = useCallback((campaign: CampaignRecord, mode: ComposerMode) => {
    setCampaignsTab("compose");
    setComposerMode(mode);
    setEditingCampaignId(mode === "edit" ? campaign.id : null);
    setCampaignName(mode === "duplicate" ? `${campaign.name} (cópia)` : campaign.name);
    setSelectedContactIds(
      (campaign.selectedContacts ?? [])
        .map((contact) => String(contact.phone || contact.id || "").trim())
        .filter(Boolean),
    );
    setMessageVariants(
      campaign.messages && campaign.messages.length > 0
        ? campaign.messages.map((message) => ({
            id: message.id,
            type: (message.type === "file" ? "document" : message.type || "text") as CampaignDraftMediaType,
            content: String(message.content || "").trim(),
            mediaUrl: message.mediaUrl || message.mediaPath || null,
            mediaPath: message.mediaPath || message.mediaUrl || null,
            fileName: message.fileName || null,
            mimetype: message.mimetype || null,
            ptt: message.ptt === true,
          }))
        : createDefaultDraftMessages(),
    );
    setShuffleEnabled((campaign.messages ?? []).length > 1);
    setTypingDelay([campaign.settings?.typingDelaySeconds ?? 3]);
    setIntervalSeconds([campaign.settings?.intervalSeconds ?? 10]);
    setPauseEvery(String(campaign.settings?.pauseEvery ?? 10));
    setPauseSeconds(String(campaign.settings?.pauseSeconds ?? 60));
    setWarmupMessages(String(campaign.settings?.warmupMessages ?? 5));
    setWarmupDelayMultiplier(String(campaign.settings?.warmupDelayMultiplier ?? 3));
    setDailyLimit(campaign.settings?.dailyLimit ? String(campaign.settings.dailyLimit) : "");
    setHourlyLimit(campaign.settings?.hourlyLimit ? String(campaign.settings.hourlyLimit) : "");
    setStartAt(formatInputDateTime(campaign.settings?.startAt || (campaign.settings as any)?.scheduledAt));
    setTagsInput(Array.isArray(campaign.tags) ? campaign.tags.join(", ") : "");
    setCampaignStep(1);
    setSelectedFlowId(campaign.settings?.flowId || null);
    setSelectedCampaignPreview(null);
  }, []);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const needle = searchQuery.toLowerCase();
    return contacts.filter((contact) => {
      const name = String(contact.name || "").toLowerCase();
      const phone = String(contact.phone || "").toLowerCase();
      return name.includes(needle) || phone.includes(needle);
    });
  }, [contacts, searchQuery]);

  const selectedContacts = useMemo<CampaignContact[]>(() => {
    return selectedContactIds.map((contactId, index) => {
      const existing = contacts.find((contact) => String(contact.phone || contact.id) === contactId);
      return {
        id: existing?.id ?? contactId,
        name: existing?.name ?? `Contato ${index + 1}`,
        phone: existing?.phone ?? contactId,
        status: existing?.status,
      };
    });
  }, [contacts, selectedContactIds]);

  const selectedContactCount = selectedContacts.length;

  const contactSegments = useMemo(() => {
    const normalized = contacts.map((contact) => ({
      key: String(contact.phone || contact.id),
      status: String(contact.status || "").toLowerCase(),
      haystack: [contact.name, contact.phone, contact.status].filter(Boolean).join(" ").toLowerCase(),
    }));
    const byWords = (words: string[]) => normalized.filter((entry) => words.some((word) => entry.haystack.includes(word) || entry.status.includes(word)));
    const groups = {
      all: normalized,
      normal: normalized.filter((entry) => !entry.key.includes("@g.us")),
      hot: byWords(["quente", "hot", "interessado", "andamento", "lead_quente"]),
      warm: byWords(["morno", "warm", "duvida", "considerando", "lead_morno"]),
      cold: byWords(["frio", "cold", "lead_frio"]),
      inactive: byWords(["inativo", "risco", "sumido", "parado", "sem resposta", "recuperar"]),
    };
    return {
      all: groups.all.map((entry) => entry.key),
      normal: groups.normal.map((entry) => entry.key),
      hot: groups.hot.map((entry) => entry.key),
      warm: groups.warm.map((entry) => entry.key),
      cold: groups.cold.map((entry) => entry.key),
      inactive: groups.inactive.map((entry) => entry.key),
      counts: { all: groups.all.length, normal: groups.normal.length, hot: groups.hot.length, warm: groups.warm.length, cold: groups.cold.length, inactive: groups.inactive.length },
    };
  }, [contacts]);

  const campaignMetrics = useMemo(() => {
    const active = campaigns.filter((campaign) => ["running", "active", "processing", "scheduled", "ready"].includes(normalizeCampaignStatus(campaign))).length;
    const drafts = campaigns.filter((campaign) => normalizeCampaignStatus(campaign) === "draft").length;
    const failed = campaigns.reduce((total, campaign) => total + Number(campaign.queue?.failed ?? 0), 0);
    const totalQueue = campaigns.reduce((total, campaign) => total + Number(campaign.queue?.total ?? campaign.selectedContacts?.length ?? 0), 0);
    const sent = campaigns.reduce((total, campaign) => total + Number(campaign.queue?.sent ?? 0), 0);
    return { active, drafts, failed, totalQueue, sent };
  }, [campaigns]);

  // Histórico: filtro por status + busca, depois paginação
  const filteredHistoryCampaigns = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (historyStatusFilter !== "all") {
        const status = normalizeCampaignStatus(campaign);
        if (historyStatusFilter === "scheduled" && status !== "scheduled") return false;
        if (historyStatusFilter !== "scheduled" && status !== historyStatusFilter) return false;
      }
      if (!term) return true;
      const haystack = [campaign.name, ...(campaign.tags ?? []), ...(campaign.messages ?? []).map((m) => m.content)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [campaigns, historyStatusFilter, historySearch]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryCampaigns.length / historyPageSize));
  const historyClampedPage = Math.min(historyPage, historyTotalPages);

  const paginatedHistoryCampaigns = useMemo(() => {
    const start = (historyClampedPage - 1) * historyPageSize;
    return filteredHistoryCampaigns.slice(start, start + historyPageSize);
  }, [filteredHistoryCampaigns, historyClampedPage, historyPageSize]);

  // Reset para a página 1 quando o filtro/busca/tamanho muda
  useEffect(() => {
    setHistoryPage(1);
  }, [historyStatusFilter, historySearch, historyPageSize]);

  // Carrega análise real de IA ao abrir o modal de detalhes do disparo
  useEffect(() => {
    if (!selectedCampaignPreview) {
      setCampaignAnalysis(null);
      return;
    }
    let cancelled = false;
    setAnalysisLoading(true);
    setCampaignAnalysis(null);
    apiService
      .getCampaignAnalysis(selectedCampaignPreview.id)
      .then((res: any) => {
        if (cancelled) return;
        setCampaignAnalysis(res?.data ?? res ?? null);
      })
      .catch(() => {
        if (!cancelled) setCampaignAnalysis(null);
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignPreview]);

  // Dados reais das campanhas para o heatmap de conversão (aba Análise IA)
  const conversionHeatmapCampaigns = useMemo(
    () =>
      campaigns.map((campaign) => {
        const sent = Number(campaign.queue?.sent ?? 0);
        const total = Number(campaign.queue?.total ?? campaign.selectedContacts?.length ?? 0);
        const failed = Number(campaign.queue?.failed ?? 0);
        const delivered = Math.max(0, sent - failed);
        return {
          id: campaign.id,
          name: campaign.name,
          sent,
          converted: delivered,
          revenue: 0,
          roi: total > 0 ? Math.round((delivered / total) * 100) : 0,
        };
      }),
    [campaigns],
  );
  const cleanMessages = useMemo(
    () =>
      messageVariants
        .map((message) => ({
          ...message,
          content: message.content.trim(),
          mediaUrl: message.mediaUrl || message.mediaPath || null,
          mediaPath: message.mediaPath || message.mediaUrl || null,
        }))
        .filter((message) => Boolean(message.content || message.mediaUrl || message.mediaPath)),
    [messageVariants],
  );

  const activeMessageCount = useMemo(() => {
    if (!selectedFlowId) return cleanMessages.length;
    const flow = quickReplies.find((reply) => reply.id === selectedFlowId);
    return Math.max(1, Number(flow?.steps?.length || 0));
  }, [cleanMessages.length, quickReplies, selectedFlowId]);

  const attachMediaToMessage = useCallback(async (index: number, file: File) => {
    try {
      const mediaUrl = await fileToDataUrl(file);
      const mediaType = inferCampaignMediaType(file);
      setMessageVariants((current) =>
        current.map((entry, itemIndex) =>
          itemIndex === index
            ? {
                ...entry,
                type: mediaType,
                mediaUrl,
                mediaPath: mediaUrl,
                fileName: file.name,
                mimetype: file.type || "application/octet-stream",
              }
            : entry,
        ),
      );
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Falha ao carregar midia");
    }
  }, []);

  const clearMediaFromMessage = useCallback((index: number) => {
    setMessageVariants((current) =>
      current.map((entry, itemIndex) =>
        itemIndex === index
          ? { ...entry, type: "text", mediaUrl: null, mediaPath: null, fileName: null, mimetype: null, ptt: false }
          : entry,
      ),
    );
  }, []);

  const quickReplyMessageTemplates = useMemo(() => quickReplies.filter((reply) => !reply.isFlow), [quickReplies]);
  const quickReplyFlowTemplates = useMemo(() => quickReplies.filter((reply) => reply.isFlow), [quickReplies]);

  const normalizeQuickReplyDraftType = useCallback((type?: string): CampaignDraftMediaType => {
    const normalized = String(type || "text").toLowerCase();
    if (normalized === "image" || normalized === "video" || normalized === "audio" || normalized === "sticker") return normalized;
    if (normalized === "file" || normalized === "pdf" || normalized === "document") return "document";
    return "text";
  }, []);

  const quickReplyToDraftMessages = useCallback((reply: QuickReplyItem): CampaignDraftMessage[] => {
    const items = Array.isArray(reply.items) && reply.items.length > 0 ? reply.items : [{ type: "text", value: reply.text || "", caption: undefined, filename: undefined }];
    return items.map((item) => {
      const type = normalizeQuickReplyDraftType(item.type);
      const content = type === "text" ? String(item.value || reply.text || "") : String(item.caption || reply.text || "");
      const mediaValue = type === "text" ? null : String(item.value || "");
      return { type, content, mediaUrl: mediaValue, mediaPath: mediaValue, fileName: item.filename || null, mimetype: null, ptt: type === "audio" && item.type === "audio" } satisfies CampaignDraftMessage;
    }).filter((message) => Boolean(message.content || message.mediaUrl || message.mediaPath));
  }, [normalizeQuickReplyDraftType]);

  const getQuickReplyTemplatePreview = useCallback((reply: QuickReplyItem) => {
    if (reply.isFlow) return `${reply.steps?.length || 0} passos sequenciais`;
    if (Array.isArray(reply.items) && reply.items.length > 0) return reply.items.map((item) => item.caption || item.value || item.filename || item.type).filter(Boolean).slice(0, 2).join(" | ");
    return reply.text || "Modelo sem texto";
  }, []);

  const applyQuickReplyTemplate = useCallback((reply: QuickReplyItem) => {
    const draftMessages = quickReplyToDraftMessages(reply);
    if (draftMessages.length === 0) { notify.error("Esta resposta rapida nao tem conteudo para campanha."); return; }
    setSelectedFlowId(null);
    setMessageVariants(draftMessages);
    if (!campaignName.trim()) setCampaignName(reply.title || "Campanha com resposta rapida");
    notify.success(`Modelo "${reply.title}" aplicado na campanha.`);
  }, [campaignName, quickReplyToDraftMessages]);

  const applyQuickReplyFlow = useCallback((reply: QuickReplyItem) => {
    if (!reply.isFlow) return;
    setSelectedFlowId(reply.id);
    if (!campaignName.trim()) setCampaignName(reply.title || "Campanha com fluxo");
    notify.success(`Fluxo "${reply.title}" selecionado.`);
  }, [campaignName]);

  const editingCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === editingCampaignId) ?? null,
    [campaigns, editingCampaignId],
  );

  const totals = useMemo(() => {
    return campaigns.reduce(
      (accumulator, campaign) => {
        accumulator.sent += Number(campaign.queue?.sent ?? 0);
        accumulator.total += Number(campaign.queue?.total ?? 0);
        accumulator.processed += Number(campaign.queue?.processed ?? 0);
        accumulator.failed += Number(campaign.queue?.failed ?? 0);
        return accumulator;
      },
      { sent: 0, total: 0, processed: 0, failed: 0 },
    );
  }, [campaigns]);

  const launchReadiness = useMemo(() => {
    const missing: string[] = [];
    if (!campaignName.trim()) missing.push("Defina um nome");
    if (selectedContactCount === 0) missing.push("Selecione contatos");
    if (!selectedFlowId && cleanMessages.length === 0) missing.push("Crie ao menos uma mensagem ou selecione um fluxo");
    return missing;
  }, [campaignName, cleanMessages.length, selectedContactCount, selectedFlowId]);

  const isSaving = actionType === "save" || actionType === "launch";

  const buildPayload = useCallback(
    (nextStatus: string) => {
      const queueBase = editingCampaign?.queue ?? { total: 0, processed: 0, sent: 0, failed: 0, paused: false };
      return {
        id: editingCampaignId ?? undefined,
        name: campaignName.trim(),
        status: nextStatus,
        selectedContacts,
        messages: selectedFlowId
          ? []
          : cleanMessages.map((message, index) => ({
              id: editingCampaign?.messages?.[index]?.id || message.id,
              type: message.type === "file" ? ("document" as const) : message.type,
              content: message.content,
              mediaUrl: message.mediaUrl || message.mediaPath || null,
              mediaPath: message.mediaPath || message.mediaUrl || null,
              fileName: message.fileName || null,
              mimetype: message.mimetype || null,
              ptt: message.ptt === true,
              delaySeconds: intervalSeconds[0],
            })),
        settings: {
          flowId: selectedFlowId || undefined,
          sessionId: getCampaignSessionId(),
          intervalSeconds: intervalSeconds[0],
          randomDelayMin: intervalSeconds[0] * 1000,
          randomDelayMax: intervalSeconds[0] * 1000,
          pauseEvery: Math.max(1, Number(pauseEvery) || 1),
          pauseSeconds: Math.max(0, Number(pauseSeconds) || 0),
          typingDelaySeconds: typingDelay[0],
          startAt: startAt ? new Date(startAt).toISOString() : null,
          shuffleEnabled: selectedFlowId ? false : shuffleEnabled,
          warmupMessages: Number(warmupMessages) || 0,
          warmupDelayMultiplier: Number(warmupDelayMultiplier) || 1,
          dailyLimit: dailyLimit ? Number(dailyLimit) : null,
          hourlyLimit: hourlyLimit ? Number(hourlyLimit) : null,
        },
        queue: {
          total: selectedContacts.length,
          processed: Math.min(Number(queueBase.processed ?? 0), selectedContacts.length),
          sent: Math.min(Number(queueBase.sent ?? 0), selectedContacts.length),
          failed: Number(queueBase.failed ?? 0),
          paused: nextStatus === "paused",
        },
        tags: tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
    },
    [campaignName, cleanMessages, editingCampaign, editingCampaignId, intervalSeconds, pauseEvery, pauseSeconds, selectedContacts, selectedFlowId, shuffleEnabled, startAt, tagsInput, typingDelay, warmupMessages, warmupDelayMultiplier, dailyLimit, hourlyLimit],
  );

  const handleDeleteQuickReply = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir esta resposta rápida?")) {
      try {
        await apiService.deleteQuickReply(id);
        notify.success("Resposta rápida excluída com sucesso.");
        setQuickReplies(prev => prev.filter(q => q.id !== id));
        if (selectedFlowId === id) setSelectedFlowId(null);
        if (editingQuickReplyId === id) setEditingQuickReplyId(null);
      } catch (error: any) {
        notify.error("Erro ao excluir resposta: " + (error.message || "Erro desconhecido"));
      }
    }
  }, [selectedFlowId, editingQuickReplyId]);

  const saveCurrentMessagesAsQuickReply = useCallback(async (asFlow = false) => {
    if (!campaignName.trim()) { notify.error("Informe o nome da campanha antes de salvar como padrao."); setCampaignStep(1); return; }
    if (cleanMessages.length === 0) { notify.error("Crie ao menos uma mensagem para salvar como padrao."); setCampaignStep(2); return; }
    const title = campaignName.trim();
    const text = cleanMessages.map((message) => message.content || message.fileName || message.type).filter(Boolean).join("\n");
    const payload = asFlow ? {
      title, category: "campanhas", text, isFlow: true,
      steps: cleanMessages.map((message, index) => ({
        id: `campaign-step-${Date.now()}-${index}`,
        type: message.type === "document" || message.type === "file" || message.type === "sticker" ? "file" : message.type,
        value: message.type === "text" ? message.content : message.mediaUrl || message.mediaPath || message.content,
        filename: message.fileName || undefined,
        caption: message.type === "text" ? undefined : message.content,
        delayMs: intervalSeconds[0] * 1000,
        typingMs: typingDelay[0] * 1000,
      })),
    } : {
      title, category: "campanhas", text, isFlow: false,
      items: cleanMessages.map((message) => ({
        type: message.type === "document" ? "file" : message.type,
        value: message.type === "text" ? message.content : message.mediaUrl || message.mediaPath || message.content,
        filename: message.fileName || undefined,
        caption: message.type === "text" ? undefined : message.content,
      })),
    };
    try {
      if (editingQuickReplyId) {
        await apiService.updateQuickReply(editingQuickReplyId, payload);
        notify.success(asFlow ? "Fluxo atualizado com sucesso!" : "Modelo atualizado com sucesso!");
        setEditingQuickReplyId(null);
      } else {
        const created = await apiService.createQuickReply(payload);
        setQuickReplies((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        notify.success(asFlow ? "Fluxo salvo com sucesso!" : "Modelo salvo com sucesso!");
      }
      loadQuickReplies();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Falha ao salvar padrao de campanha");
    }
  }, [campaignName, cleanMessages, intervalSeconds, typingDelay]);

  const duplicateSelectedFlowTemplate = useCallback(async () => {
    const flow = quickReplies.find((item) => item.id === selectedFlowId);
    if (!flow) { notify.error("Selecione um fluxo para duplicar."); return; }
    try {
      const created = await apiService.createQuickReply({ ...flow, id: undefined, title: `${flow.title} (copia campanha)`, category: "campanhas" });
      setQuickReplies((current) => [created, ...current]);
      notify.success("Fluxo duplicado como padrao de campanha.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Falha ao duplicar fluxo");
    }
  }, [quickReplies, selectedFlowId]);

  const goToNextCampaignStep = useCallback(() => {
    if (campaignStep >= 3 && !campaignName.trim()) {
      notify.error("Informe o nome da campanha no topo antes de revisar ou lancar.");
      setCampaignStep(1);
      return;
    }
    setCampaignStep((current) => Math.min(STEP_LABELS.length, current + 1));
  }, [campaignName, campaignStep]);

  const generateCampaignFromPrompt = useCallback(async () => {
    const prompt = aiCampaignPrompt.trim();
    if (!prompt) {
      notify.error("Digite o que voce quer vender, para quem e o objetivo da campanha.");
      return;
    }

    setIsAiCampaignGenerating(true);
    const product = extractCampaignProduct(prompt);
    const now = new Date();
    const activeAgent = aiAgents.find((agent) => String(agent.key || agent.name || "") === selectedAiAgentKey) || aiAgents.find((agent) => agent.active !== false) || aiAgents[0];
    let generatedName = "IA - " + product + " - " + now.toLocaleDateString("pt-BR");
    const followUpDays = Math.max(1, Number(aiFollowUpDays) || 3);
    let generatedMessages = buildHumanizedFollowUpMessages(product, prompt, aiLeadProfile);
    let generatedTags = ["ia", "campanha", "follow-up", product.toLowerCase().replace(/\s+/g, "-")];
    let aiSource = "fallback-local";
    let aiDelayProfile: AICampaignDraft["delayProfile"] | undefined;

    try {
      if (activeAgent) {
        const aiInstruction = [
          "Voce e o atendente comercial configurado neste sistema. Use sua personalidade, tom, empresa, produtos e forma de atendimento para criar uma campanha de WhatsApp pronta para aprovacao.",
          "Pedido do usuario: " + prompt,
          "Produto/tema detectado: " + product,
          "Tipo de lead: " + aiLeadProfile,
          "Follow-up apos dias: " + followUpDays,
          "Crie mensagens naturais, curtas, humanas, sem prometer o que nao sabe, com CTA claro e follow-up de recuperacao.",
          "Retorne APENAS JSON valido neste formato:",
          "{\"name\":\"nome da campanha\",\"messages\":[\"mensagem 1\",\"mensagem 2\",\"mensagem 3\",\"follow-up 1\",\"follow-up 2\"],\"tags\":[\"ia\",\"campanha\"],\"delayProfile\":{\"typingSeconds\":6,\"intervalSeconds\":60,\"pauseEvery\":8,\"pauseSeconds\":180,\"dailyLimit\":80,\"hourlyLimit\":12}}"
        ].join("\n");
        const aiResult = await apiService.testAIMessage({
          message: aiInstruction,
          agentKey: activeAgent.key,
          agentName: activeAgent.name,
          responseStyle: "elaborate",
          temperature: 0.7,
        });
        const parsed = parseAICampaignMessages(aiResult?.result?.response);
        if (parsed?.messages?.length) {
          generatedName = parsed.name?.trim() || generatedName;
          generatedMessages = parsed.messages.slice(0, 8).map((content) => ({ type: "text" as const, content }));
          generatedTags = Array.from(new Set([...(Array.isArray(parsed.tags) ? parsed.tags : []), "ia", "atendente", product.toLowerCase().replace(/\s+/g, "-")])).filter(Boolean);
          aiDelayProfile = parsed.delayProfile;
          aiSource = activeAgent.name || activeAgent.key || "atendente IA";
        }
      }
    } catch (error) {
      console.warn("[Campaigns] AI attendant campaign generation fallback:", error);
      notify.error("Atendente IA nao respondeu em JSON valido. Usei o gerador local como fallback.");
    }

    const promptWords = prompt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\W+/)
      .filter((word) => word.length >= 4 && !["para", "com", "campanha", "venda", "vender", "produto", "servico", "lead", "leads", "cliente", "clientes"].includes(word));

    const profileWords: Record<string, string[]> = {
      all: [],
      hot: ["quente", "hot", "interessado", "ativo", "andamento", "lead_quente"],
      warm: ["morno", "warm", "nutrir", "duvida", "considerando", "lead_morno"],
      cold: ["frio", "cold", "inativo", "recuperar", "reativar", "lead_frio"],
      inactive: ["inativo", "risco", "sumido", "parado", "sem resposta", "recuperar"],
    };

    const normalizedContacts = contacts.map((contact) => ({
      contact,
      key: String(contact.phone || contact.id),
      haystack: [contact.name, contact.phone, contact.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    }));

    const selectedByProfile = normalizedContacts.filter(({ haystack }) => {
      if (aiLeadProfile === "all") return true;
      const words = profileWords[aiLeadProfile] || [];
      return words.some((word) => haystack.includes(word));
    });

    const selectedByPrompt = selectedByProfile.filter(({ haystack }) => promptWords.some((word) => haystack.includes(word)));
    const finalSelection = (selectedByPrompt.length > 0 ? selectedByPrompt : selectedByProfile).map((entry) => entry.key);
    const typingSeconds = Math.max(1, Math.min(120, Number(aiDelayProfile?.typingSeconds) || (aiLeadProfile === "hot" ? 4 : aiLeadProfile === "cold" || aiLeadProfile === "inactive" ? 9 : 6)));
    const intervalValue = Math.max(2, Math.min(600, Number(aiDelayProfile?.intervalSeconds) || (aiLeadProfile === "hot" ? 35 : aiLeadProfile === "cold" || aiLeadProfile === "inactive" ? 120 : 60)));
    const baseDelayMs = intervalValue * 1000;
    const followUpDelayMs = followUpDays * 24 * 60 * 60 * 1000;

    setCampaignName(generatedName);
    setMessageVariants(generatedMessages);
    setSelectedContactIds(Array.from(new Set(finalSelection)));
    setTypingDelay([typingSeconds]);
    setIntervalSeconds([intervalValue]);
    setPauseEvery(String(Math.max(1, Number(aiDelayProfile?.pauseEvery) || 8)));
    setPauseSeconds(String(Math.max(30, Number(aiDelayProfile?.pauseSeconds) || (aiLeadProfile === "hot" ? 90 : 180))));
    setWarmupMessages("8");
    setWarmupDelayMultiplier("3");
    setDailyLimit(String(Math.max(1, Number(aiDelayProfile?.dailyLimit) || 80)));
    setHourlyLimit(String(Math.max(1, Number(aiDelayProfile?.hourlyLimit) || 12)));
    setTagsInput(generatedTags.join(", "));

    try {
      const createdFlow = await apiService.createQuickReply({
        title: generatedName + " - follow-up IA",
        category: "campanhas",
        text: generatedMessages.map((message) => message.content).join("\n---\n"),
        isFlow: true,
        steps: generatedMessages.map((message, index) => ({
          id: "ai-campaign-step-" + Date.now() + "-" + index,
          type: "text",
          value: message.content,
          delayMs: index === 0 ? 0 : index >= Math.max(3, generatedMessages.length - 2) ? followUpDelayMs : baseDelayMs,
          typingMs: typingSeconds * 1000,
        })),
      });
      setQuickReplies((current) => [createdFlow, ...current.filter((item) => item.id !== createdFlow.id)]);
      setSelectedFlowId(createdFlow.id);
      notify.success("Campanha criada pelo " + aiSource + " com " + finalSelection.length + " contato(s). Revise antes de enviar.");
    } catch (error) {
      setSelectedFlowId(null);
      notify.error(error instanceof Error ? error.message : "Campanha gerada, mas nao foi possivel salvar o fluxo automatico.");
    } finally {
      setCampaignStep(4);
      setIsAiCampaignGenerating(false);
    }
  }, [aiAgents, aiCampaignPrompt, aiFollowUpDays, aiLeadProfile, contacts, selectedAiAgentKey]);

  useEffect(() => {
    const liveIds = Array.from(new Set([
      ...trackedDispatchIds,
      ...campaigns
        .filter((campaign) => ["running", "active", "processing", "scheduled", "paused"].includes(normalizeCampaignStatus(campaign)))
        .map((campaign) => campaign.id),
    ]));

    if (liveIds.length === 0) return;

    liveIds.forEach((campaignId) => {
      void refreshCampaignDispatchStatus(campaignId);
    });

    const timer = window.setInterval(() => {
      liveIds.forEach((campaignId) => {
        void refreshCampaignDispatchStatus(campaignId);
      });
      void loadPageData({ silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [campaigns, loadPageData, refreshCampaignDispatchStatus, trackedDispatchIds]);

  const persistCampaign = useCallback(
    async (mode: "save" | "launch") => {
      if (launchReadiness.length > 0) {
        notify.error(launchReadiness[0]);
        return;
      }

      setActionType(mode);
      setActionCampaignId(editingCampaignId ?? "draft");
      try {
        const initialStatus = mode === "launch" ? "scheduled" : editingCampaign?.status ?? "draft";
        const payload = buildPayload(initialStatus);
        const savedCampaign = editingCampaignId
          ? await apiService.updateCampaign(editingCampaignId, payload)
          : await apiService.createCampaign(payload);

        if (mode === "launch") {
          const isFuture = payload.settings?.startAt && new Date(payload.settings.startAt).getTime() > Date.now();
          if (!isFuture) {
            try {
              await apiService.startCampaignDispatch(savedCampaign.id);
            } catch (error) {
              if (!(error instanceof Error) || !error.message.toLowerCase().includes("already running")) throw error;
            }
            setTrackedDispatchIds((current) => Array.from(new Set([...current, savedCampaign.id])));
            await refreshCampaignDispatchStatus(savedCampaign.id);
            notify.success("Campanha criada e lancada. Progresso em atualizacao...");
          } else {
            notify.success("Campanha salva e agendada para disparo futuro.");
          }
          resetComposer();
        } else {
          notify.success(editingCampaignId ? "Campanha atualizada" : "Campanha salva como rascunho");
          hydrateComposer(savedCampaign, "edit");
        }

        await loadPageData({ silent: true });
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Falha ao salvar campanha");
      } finally {
        setActionType(null);
        setActionCampaignId(null);
      }
    },
    [buildPayload, editingCampaign?.status, editingCampaignId, hydrateComposer, launchReadiness, loadPageData, refreshCampaignDispatchStatus, resetComposer],
  );

  const runCampaignAction = useCallback(
    async (campaignId: string, action: Exclude<CampaignAction, "save" | "launch" | "refresh" | null>) => {
      const targetCampaign = campaigns.find((campaign) => campaign.id === campaignId);
      if (!targetCampaign) return;

      setActionCampaignId(campaignId);
      setActionType(action);
      try {
        if (action === "start") {
          try {
            await apiService.startCampaignDispatch(campaignId);
          } catch (error) {
            if (!(error instanceof Error) || !error.message.toLowerCase().includes("already running")) throw error;
          }
          setTrackedDispatchIds((current) => Array.from(new Set([...current, campaignId])));
          await refreshCampaignDispatchStatus(campaignId);
          notify.success("Campanha iniciada. Progresso em atualizacao...");
        }

        if (action === "pause") {
          try {
            await apiService.pauseCampaignDispatch(campaignId);
          } catch {
            await apiService.updateCampaign(campaignId, {
              ...targetCampaign,
              status: "paused",
              queue: {
                ...targetCampaign.queue,
                paused: true,
              },
            });
          }
          setTrackedDispatchIds((current) => Array.from(new Set([...current, campaignId])));
          await refreshCampaignDispatchStatus(campaignId);
          notify.success("Campanha pausada");
        }

        if (action === "resume") {
          await apiService.updateCampaign(campaignId, {
            ...targetCampaign,
            status: "scheduled",
            queue: {
              ...targetCampaign.queue,
              paused: false,
            },
          });
          try {
            await apiService.resumeCampaignDispatch(campaignId);
          } catch {
            try {
              await apiService.startCampaignDispatch(campaignId);
            } catch (error) {
              if (!(error instanceof Error) || !error.message.toLowerCase().includes("already running")) throw error;
            }
          }
          setTrackedDispatchIds((current) => Array.from(new Set([...current, campaignId])));
          await refreshCampaignDispatchStatus(campaignId);
          notify.success("Campanha retomada. Progresso em atualizacao...");
        }

        if (action === "delete") {
          await apiService.deleteCampaign(campaignId);
          setTrackedDispatchIds((current) => current.filter((id) => id !== campaignId));
          setDispatchStatuses((current) => {
            const next = { ...current };
            delete next[campaignId];
            return next;
          });
          if (editingCampaignId === campaignId) resetComposer();
          notify.success("Campanha removida");
        }

        await loadPageData({ silent: true });
      } catch (error) {
        notify.error(error instanceof Error ? error.message : "Falha na ação da campanha");
      } finally {
        setActionCampaignId(null);
        setActionType(null);
      }
    },
    [campaigns, editingCampaignId, loadPageData, refreshCampaignDispatchStatus, resetComposer],
  );

  const toggleContact = useCallback((contactKey: string) => {
    setSelectedContactIds((current) =>
      current.includes(contactKey)
        ? current.filter((entry) => entry !== contactKey)
        : [...current, contactKey],
    );
  }, []);

  const toggleSelectAllVisibleContacts = useCallback(() => {
    const visibleKeys = filteredContacts.map((contact) => String(contact.phone || contact.id));
    const everySelected = visibleKeys.every((key) => selectedContactIds.includes(key));

    if (everySelected) {
      setSelectedContactIds((current) => current.filter((key) => !visibleKeys.includes(key)));
      return;
    }

    setSelectedContactIds((current) => Array.from(new Set([...current, ...visibleKeys])));
  }, [filteredContacts, selectedContactIds]);

  const applyContactSegment = useCallback((segment: keyof typeof contactSegments.counts) => {
    const keys = contactSegments[segment] || [];
    if (keys.length === 0) { notify.error("Nenhum contato encontrado para este tipo de lead."); return; }
    setSelectedContactIds(Array.from(new Set(keys)));
    notify.success(String(keys.length) + " contato(s) selecionado(s).");
  }, [contactSegments]);

  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        notify.error("Arquivo CSV vazio.");
        return;
      }

      const separator = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase());

      const nameIdx = headers.findIndex((h) => h.includes("nome") || h.includes("name"));
      const phoneIdx = headers.findIndex((h) => h.includes("fone") || h.includes("phone") || h.includes("tel"));

      const importedContacts: Contact[] = [];
      const newSelectedIds: string[] = [];

      let importedCount = 0;
      let ignoredCount = 0;
      let duplicateCount = 0;

      const seenInCsv = new Set<string>();
      const existingPhones = new Set(contacts.map((c) => normalizePhone(c.phone)));

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(separator).map((p) => p.trim());
        const phoneRaw = phoneIdx !== -1 ? parts[phoneIdx] : parts[0];
        const nameRaw = nameIdx !== -1 ? parts[nameIdx] : parts[1];

        const cleanPhone = phoneRaw?.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 8) {
          ignoredCount++;
          continue;
        }

        const phoneKey = cleanPhone;

        if (seenInCsv.has(phoneKey) || existingPhones.has(phoneKey)) {
          duplicateCount++;
          if (existingPhones.has(phoneKey) && !selectedContactIds.includes(phoneKey)) {
            newSelectedIds.push(phoneKey);
          }
          continue;
        }

        seenInCsv.add(phoneKey);

        const newContact: Contact = {
          id: `csv-${phoneKey}`,
          name: nameRaw || `Importado ${phoneKey}`,
          phone: phoneKey,
          status: "Importado",
          updatedAt: new Date().toISOString(),
        };

        importedContacts.push(newContact);
        newSelectedIds.push(phoneKey);
        importedCount++;
      }

      if (importedContacts.length > 0) {
        setContacts((prev) => [...prev, ...importedContacts]);
      }

      if (newSelectedIds.length > 0) {
        setSelectedContactIds((current) => Array.from(new Set([...current, ...newSelectedIds])));
      }

      notify.success(
        `Importação concluída. Importados: ${importedCount} | Ignorados: ${ignoredCount} | Duplicados: ${duplicateCount}`,
      );

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleApplyTagSelection = async () => {
    const tag = tagInputVal.trim();
    if (!tag) return;

    const normalizedTag = tag.toLowerCase();
    try {
      const conversations = await apiService.getConversations(false);
      const matchingPhones = conversations
        .filter((conv) => conv.tags?.some((t) => t.toLowerCase() === normalizedTag))
        .map((conv) => normalizePhone(conv.phone))
        .filter(Boolean);

      const matchedContactKeys = contacts
        .filter((c) => matchingPhones.includes(normalizePhone(c.phone)))
        .map((c) => String(c.phone || c.id));

      if (matchedContactKeys.length === 0) {
        notify.error(`Nenhum contato encontrado com a tag "${tag}" na lista atual.`);
      } else {
        setSelectedContactIds((current) => Array.from(new Set([...current, ...matchedContactKeys])));
        notify.success(`${matchedContactKeys.length} contatos com a tag "${tag}" selecionados.`);
        setIsTagModalOpen(false);
        setTagInputVal("");
      }
    } catch (err) {
      console.error(err);
      notify.error("Erro ao filtrar contatos por etiquetas.");
    }
  };

  const stepProgress = (campaignStep / STEP_LABELS.length) * 100;
  const lovableCampaignsViewModel = createCampaignsLovableViewModel(campaigns);

  return (
    <div className="min-h-screen">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleCsvImport}
        accept=".csv"
        className="hidden"
      />
      {campaignsTab !== "compose" && (
        <Header
          title="Campanhas"
          subtitle="Disparos em massa e campanhas programadas"
          actions={
            <>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void persistCampaign("save")}>
                Salvar Rascunho
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                Importar Contatos
              </Button>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl border-primary/40 hover:bg-primary/10" onClick={() => setIsAiModalOpen(true)}>
                <Sparkle className="h-4 w-4 text-primary animate-pulse" weight="fill" />
                Criar Campanha por IA
              </Button>
              <Button size="sm" className="rounded-xl shadow-glow" onClick={resetComposer}>
                <Plus className="h-4 w-4" />
                Disparo Manual
              </Button>
            </>
          }
        />
      )}

      <div className={campaignsTab === "compose" ? "pb-4" : ""}>
        {loading ? (
          <div className="page-container section-stack">
            <StatGridSkeleton count={4} />
          </div>
        ) : (
          <CampaignsView
            summaryCards={
              campaignsTab !== "compose" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                    <CardContent className="space-y-2 p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                          <Megaphone weight="duotone" className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Campanhas</p>
                          <h3 className="font-display text-lg font-bold">{lovableCampaignsViewModel.totalCampaigns}</h3>
                          <p className="text-xs text-muted-foreground">{campaignMetrics.active} ativas / {campaignMetrics.drafts} rascunhos</p>
                        </div>
                      </div>
                      <OperationalStatusBadge label="Base persistida" tone="syncing" />
                    </CardContent>
                  </Card>

                  <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                    <CardContent className="space-y-2 p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-info/10">
                          <PaperPlaneTilt weight="fill" className="h-6 w-6 text-info" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Envios concluídos</p>
                          <h3 className="font-display text-lg font-bold">{campaignMetrics.sent.toLocaleString("pt-BR")}</h3>
                          <p className="text-xs text-muted-foreground">{campaignMetrics.failed} falha(s)</p>
                        </div>
                      </div>
                      <OperationalStatusBadge label="Pipeline ativo" tone="online" />
                    </CardContent>
                  </Card>

                  <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                    <CardContent className="space-y-2 p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10">
                          <Eye weight="duotone" className="h-6 w-6 text-success" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Base / fila</p>
                          <h3 className="font-display text-lg font-bold">{contacts.length.toLocaleString("pt-BR")}</h3>
                          <p className="text-xs text-muted-foreground">{campaignMetrics.totalQueue.toLocaleString("pt-BR")} em campanhas</p>
                        </div>
                      </div>
                      <OperationalStatusBadge label="Segmentação pronta" tone="online" />
                    </CardContent>
                  </Card>

                  <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
                    <CardContent className="space-y-2 p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10">
                          <CheckCircle weight="fill" className="h-6 w-6 text-warning" />
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selecionados</p>
                          <h3 className="font-display text-lg font-bold">{selectedContactCount}</h3>
                          <p className="text-xs text-muted-foreground">Etapa {campaignStep}/{STEP_LABELS.length}</p>
                        </div>
                      </div>
                      <OperationalStatusBadge label={composerMode === "edit" ? "Modo edição" : composerMode === "duplicate" ? "Duplicando" : "Novo rascunho"} tone="warning" />
                    </CardContent>
                  </Card>
                </div>
              ) : null
            }
            composer={
              <div className="flex flex-col gap-4">
                <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="space-y-5 p-5">
                  <div className="flex flex-col gap-6 border-b border-border/50 pb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2 className="font-display text-3xl font-bold">Nova Campanha</h2>
                        <p className="text-muted-foreground mt-1">Escolha o modo de criação e configure seu disparo.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                          Importar CSV
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => void persistCampaign("save")}>
                          Salvar Rascunho
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Card 
                        className={cn("flex-1 cursor-pointer transition-all border", creationMode === "ai" ? "border-info bg-info/5 ring-1 ring-info/50" : "border-border/50 bg-background/50 hover:border-info/30")}
                        onClick={() => setCreationMode("ai")}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", creationMode === "ai" ? "bg-info/20 text-info" : "bg-muted text-muted-foreground")}>
                            <Sparkle className="w-5 h-5" weight={creationMode === "ai" ? "fill" : "regular"} />
                          </div>
                          <div>
                            <h3 className={cn("font-bold text-sm", creationMode === "ai" ? "text-info" : "text-foreground")}>✨ Gerar com IA</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">A IA monta público, mensagens e delays para você.</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card 
                        className={cn("flex-1 cursor-pointer transition-all border", creationMode === "manual" ? "border-primary bg-primary/5 ring-1 ring-primary/50" : "border-border/50 bg-background/50 hover:border-primary/30")}
                        onClick={() => setCreationMode("manual")}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", creationMode === "manual" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                            <Plus className="w-5 h-5" weight={creationMode === "manual" ? "bold" : "regular"} />
                          </div>
                          <div>
                            <h3 className={cn("font-bold text-sm", creationMode === "manual" ? "text-primary" : "text-foreground")}>⚙️ Criar Manualmente</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Configure cada passo da sua campanha manualmente.</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <Label htmlFor="campaign-name" className="text-sm font-semibold text-foreground whitespace-nowrap">Nome da campanha:</Label>
                        <Input id="campaign-name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Ex: Campanha orcamento quente Julho" className="h-9 rounded-lg border-primary/25 bg-background/70 text-sm font-medium flex-1 max-w-md" />
                        <p className="text-[10px] text-muted-foreground hidden lg:block">Aparece na lista e rascunhos.</p>
                      </div>
                      {!campaignName.trim() && <OperationalStatusBadge label="Nome obrigatorio para lancar" tone="warning" />}
                    </div>
                  </div>
                  {creationMode === "ai" && (
                    <div className="rounded-2xl border border-info/20 bg-info/5 p-5">
                    <div className="grid gap-6 lg:grid-cols-3">
                      <div className="space-y-4 lg:col-span-2">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-info/25 bg-info/10 text-info">
                            <Sparkle className="h-5 w-5" />
                          </span>
                          <div>
                            <h3 className="font-semibold text-info">Descreva sua Campanha</h3>
                            <p className="text-sm text-muted-foreground">O sistema montará o público, mensagens, follow-ups e delays humanizados para você aprovar.</p>
                          </div>
                        </div>
                        <Textarea
                          value={aiCampaignPrompt}
                          onChange={(event) => setAiCampaignPrompt(event.target.value)}
                          placeholder="Ex: criar campanha para venda de seguro empresarial para leads quentes..."
                          className="min-h-[180px] rounded-2xl border-info/30 bg-background/60 p-4 text-sm leading-relaxed"
                        />
                      </div>
                      <div className="space-y-4 lg:col-span-1 rounded-2xl border border-info/10 bg-info/[0.02] p-4">
                        <div className="space-y-3">
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atendente IA criador</Label>
                          <select
                            value={selectedAiAgentKey}
                            onChange={(event) => setSelectedAiAgentKey(event.target.value)}
                            className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                          >
                            {aiAgents.map((agent) => (
                              <option key={agent.key || agent.name} value={agent.key || agent.name}>
                                {agent.name || agent.key} {agent.active === false ? "(inativo)" : ""}
                              </option>
                            ))}
                            {aiAgents.length === 0 && <option value="">Atendente padrao</option>}
                          </select>
                          <p className="mt-1 text-[11px] text-muted-foreground">Usa a personalidade e inteligencia do atendente para escrever a campanha.</p>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tipo de lead</Label>
                          <select
                            value={aiLeadProfile}
                            onChange={(event) => setAiLeadProfile(event.target.value)}
                            className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                          >
                            <option value="all">Todos / detectar pela base</option>
                            <option value="hot">Leads quentes</option>
                            <option value="warm">Leads mornos</option>
                            <option value="cold">Leads frios</option>
                            <option value="inactive">Recuperar inativos</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-up apos dias</Label>
                          <Input value={aiFollowUpDays} onChange={(event) => setAiFollowUpDays(event.target.value)} inputMode="numeric" className="mt-2 h-11 rounded-xl" />
                        </div>
                        <Button type="button" className="w-full rounded-xl shadow-glow" onClick={() => void generateCampaignFromPrompt()} disabled={isAiCampaignGenerating}>
                          {isAiCampaignGenerating ? <Clock className="h-4 w-4 animate-spin" /> : <Sparkle className="h-4 w-4" />}
                          {isAiCampaignGenerating ? "Atendente criando..." : "Gerar campanha pronta"}
                        </Button>
                      </div>
                    </div>
                  </div>
                  </div>
                  )}

                  {creationMode === "manual" && (
                    <>
                      <div className="grid grid-cols-5 gap-2 border-b border-border/40 pb-4">
                    {STEP_LABELS.map((label, index) => {
                      const step = index + 1;
                      const active = campaignStep === step;
                      const complete = campaignStep > step;
                      return (
                        <button
                          key={label}
                          type="button"
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl border border-transparent px-2 py-2 text-center transition-all",
                            active && "border-primary/30 bg-primary/10 shadow-glow",
                            complete && !active && "text-success",
                          )}
                          onClick={() => setCampaignStep(step)}
                        >
                          <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs", active ? "border-primary/40 text-primary" : "border-border/70 text-muted-foreground")}>{step}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 mt-6 items-start relative">
                    <div className="flex-1 min-w-0 pb-10">

                  {campaignStep === 1 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">Definir Público-Alvo</h3>
                          <p className="mt-1 text-sm text-muted-foreground">Escolha os contatos que receberão esta campanha.</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                          {selectedContactCount} Leads Selecionados
                        </Badge>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          { key: "all", title: "Todos os contatos", desc: "Toda a base disponivel", count: contactSegments.counts.all },
                          { key: "normal", title: "Contatos individuais", desc: "Sem grupos, envio normal", count: contactSegments.counts.normal },
                          { key: "hot", title: "Leads quentes", desc: "Interessados ou em andamento", count: contactSegments.counts.hot },
                          { key: "warm", title: "Leads mornos", desc: "Nutrir e tirar duvidas", count: contactSegments.counts.warm },
                          { key: "cold", title: "Leads frios", desc: "Abordagem mais leve", count: contactSegments.counts.cold },
                          { key: "inactive", title: "Recuperar inativos", desc: "Chamar depois de dias", count: contactSegments.counts.inactive },
                        ].map((segment) => (
                          <button key={segment.key} type="button" onClick={() => applyContactSegment(segment.key as keyof typeof contactSegments.counts)} className="rounded-xl border border-border/70 bg-background/30 p-3 text-left transition hover:border-primary/40 hover:bg-card/70">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10"><Users className="h-4 w-4 text-success" /></span>
                                <p className="text-sm font-semibold">{segment.title}</p>
                              </div>
                              <Badge variant="secondary" className="rounded-full text-[10px]">{segment.count}</Badge>
                            </div>
                            <p className="mt-1.5 text-[10px] text-muted-foreground">{segment.desc}</p>
                          </button>
                        ))}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-border/70 bg-background/30 p-4 text-left transition-colors hover:bg-card/60">
                          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/60"><ArrowClockwise className="h-5 w-5 text-muted-foreground" /></span><div><p className="font-semibold">Importar Lista</p><p className="text-xs text-muted-foreground">Planilha .csv com telefone e nome</p></div></div>
                        </button>
                        <button type="button" onClick={() => setIsTagModalOpen(true)} className="rounded-2xl border border-border/70 bg-background/30 p-4 text-left transition-colors hover:bg-card/60">
                          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/60"><Badge variant="secondary" className="rounded-lg px-2">#</Badge></span><div><p className="font-semibold">Por Etiquetas</p><p className="text-xs text-muted-foreground">Segmentar por tags do CRM</p></div></div>
                        </button>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-background/30">
                        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
                          <div><p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contatos individuais</p><p className="text-xs text-muted-foreground">Clique em qualquer contato para incluir ou remover.</p></div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              value={searchQuery}
                              onChange={(event) => setSearchQuery(event.target.value)}
                              placeholder="Buscar nome ou telefone..."
                              className="h-10 w-full rounded-xl sm:w-72"
                            />
                            <Button type="button" variant="outline" className="rounded-xl" onClick={toggleSelectAllVisibleContacts}>Selecionar visiveis</Button>
                            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setSelectedContactIds([])}>Limpar</Button>
                          </div>
                        </div>
                        <div className="scrollbar-thin grid max-h-[460px] gap-2 overflow-y-auto p-4 md:grid-cols-2 xl:grid-cols-3">
                          {filteredContacts.length === 0 ? (
                            <EmptyState
                              icon={<Users className="h-8 w-8 text-muted-foreground/50" />}
                              title="Nenhum contato disponível"
                              description="Sincronize contatos reais para alimentar a campanha oficial."
                            />
                          ) : (
                            filteredContacts.map((contact) => {
                              const key = String(contact.phone || contact.id);
                              const checked = selectedContactIds.includes(key);
                              return (
                                <div
                                  key={key}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggleContact(key)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      toggleContact(key);
                                    }
                                  }}
                                  className={cn(
                                    "flex min-h-[82px] w-full cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                    checked
                                      ? "border-primary/40 bg-primary/10"
                                      : "border-border/70 bg-card/60 hover:border-border hover:bg-card/80",
                                  )}
                                >
                                  <Checkbox checked={checked} className="mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{contact.name || "Contato"}</p>
                                    <p className="truncate text-xs text-muted-foreground">{contact.phone || "Sem telefone"}</p>
                                  </div>
                                  {contact.status ? <Badge variant="secondary">{contact.status}</Badge> : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {campaignStep === 2 && (
                    <div className="space-y-4">
                      {/* Selection between Normal Messages or Flow */}
                      <div className="flex items-center gap-4 bg-background/40 border border-border/70 p-3 rounded-2xl">
                        <div className="flex-1">
                          <Label className="text-sm font-medium">Tipo de Conteúdo</Label>
                          <p className="text-xs text-muted-foreground">Escolha se quer enviar mensagens avulsas ou disparar um fluxo sequencial de respostas rápidas.</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            type="button"
                            variant={!selectedFlowId ? "default" : "outline"}
                            size="sm"
                            className="rounded-xl h-8"
                            onClick={() => setSelectedFlowId(null)}
                          >
                            Mensagens Avulsas
                          </Button>
                          <Button
                            type="button"
                            variant={selectedFlowId ? "default" : "outline"}
                            size="sm"
                            className="rounded-xl h-8 text-foreground"
                            onClick={() => {
                              const flows = quickReplies.filter(q => q.isFlow);
                              if (flows.length > 0) {
                                if (!selectedFlowId) {
                                  setSelectedFlowId(flows[0].id);
                                }
                              } else {
                                notify.error("Nenhum fluxo de resposta rápida cadastrado.");
                              }
                            }}
                          >
                            Fluxo Sequencial
                          </Button>
                        </div>
                      </div>


                      <div className="grid gap-3 lg:grid-cols-2">
                        <Card className="rounded-2xl border-border/70 bg-background/30">
                          <CardContent className="space-y-2 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div><p className="text-sm font-semibold">Usar respostas rapidas salvas</p><p className="text-xs text-muted-foreground">Clique para montar a campanha com modelos ja criados.</p></div>
                              <Badge variant="secondary">{quickReplyMessageTemplates.length}</Badge>
                            </div>
                            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                              {quickReplyMessageTemplates.length === 0 ? <p className="rounded-xl border border-border/70 bg-card/60 p-3 text-xs text-muted-foreground">Nenhuma resposta rapida avulsa salva ainda.</p> : quickReplyMessageTemplates.map((reply) => (
                                <div key={reply.id} className="group relative w-full rounded-xl border border-border/70 bg-card/60 transition hover:border-primary/40 hover:bg-card">
                                  <button type="button" className="w-full p-3 text-left" onClick={() => applyQuickReplyTemplate(reply)}>
                                    <p className="truncate text-sm font-semibold text-foreground pr-16">{reply.title}</p>
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{getQuickReplyTemplatePreview(reply)}</p>
                                  </button>
                                  <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(e) => { e.stopPropagation(); setEditingQuickReplyId(reply.id); setCampaignName(reply.title || ""); setCampaignStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); applyQuickReplyTemplate(reply); }}>
                                      <PencilSimple className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={(e) => handleDeleteQuickReply(reply.id, e)}>
                                      <Trash className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-border/70 bg-background/30">
                          <CardContent className="space-y-2 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div><p className="text-sm font-semibold">Usar fluxos salvos</p><p className="text-xs text-muted-foreground">Selecione um fluxo sequencial pronto para disparo.</p></div>
                              <Badge variant="secondary">{quickReplyFlowTemplates.length}</Badge>
                            </div>
                            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                              {quickReplyFlowTemplates.length === 0 ? <p className="rounded-xl border border-border/70 bg-card/60 p-3 text-xs text-muted-foreground">Nenhum fluxo salvo ainda. Monte mensagens abaixo e salve como fluxo.</p> : quickReplyFlowTemplates.map((reply) => (
                                <div key={reply.id} className={cn("group relative w-full rounded-xl border transition hover:border-primary/40 hover:bg-card", selectedFlowId === reply.id ? "border-primary/40 bg-primary/10" : "border-border/70 bg-card/60")}>
                                  <button type="button" className="w-full p-3 text-left" onClick={() => applyQuickReplyFlow(reply)}>
                                    <p className="truncate text-sm font-semibold text-foreground pr-16">{reply.title}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{getQuickReplyTemplatePreview(reply)}</p>
                                  </button>
                                  <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(e) => { e.stopPropagation(); setEditingQuickReplyId(reply.id); setSelectedFlowId(null); setCampaignName(reply.title || ""); setCampaignStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); const items = (reply.steps || []).map((step: any) => ({ type: step.type === 'text' ? 'text' : (step.type === 'image' ? 'image' : (step.type === 'video' ? 'video' : (step.type === 'audio' ? 'audio' : 'document'))), content: step.type === 'text' ? step.value : step.caption, mediaUrl: step.type !== 'text' ? step.value : undefined, fileName: step.filename, id: Math.random().toString(36).substring(2, 15) })); setMessageVariants(items.length ? items : [createEmptyDraftMessage()]); }}>
                                      <PencilSimple className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={(e) => handleDeleteQuickReply(reply.id, e)}>
                                      <Trash className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      {!selectedFlowId ? (
                        <>
                          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/40 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium">Variantes da mensagem</p>
                              <p className="text-xs text-muted-foreground">Crie textos, audios, imagens, videos ou documentos para personalizar os envios.</p>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button variant="outline" className="rounded-xl" onClick={() => void saveCurrentMessagesAsQuickReply(false)}><CheckCircle className="h-4 w-4" />Salvar modelo</Button>
                              <Button variant="outline" className="rounded-xl" onClick={() => void saveCurrentMessagesAsQuickReply(true)}><ArrowClockwise className="h-4 w-4" />Salvar fluxo</Button>
                              <Button variant="outline" className="rounded-xl" onClick={() => setMessageVariants((current) => [...current, createEmptyDraftMessage()])}><Plus className="h-4 w-4" />Adicionar variante</Button>
                            </div>
                          </div>

                          <div className="grid lg:grid-cols-[minmax(0,1fr)_350px] gap-6">
                            <div className="space-y-4">
                              {messageVariants.map((variant, index) => (
                                <Card key={`variant-${index}`} className="rounded-2xl border-border/70 bg-background/30">
                                  <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 bg-card/40">
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm font-semibold text-foreground">Mensagem {index + 1}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => document.getElementById(`campaign-media-${index}`)?.click()}>
                                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setMessageVariants((current) => [...current, { ...variant, id: Math.random().toString(36).substring(2, 15) }])}>
                                        <Copy className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                      {messageVariants.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setMessageVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                                          <Trash className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <CardContent className="p-0">
                                    <div className="p-4">
                                      <Textarea
                                        value={variant.content}
                                        onChange={(event) =>
                                          setMessageVariants((current) =>
                                            current.map((entry, itemIndex) =>
                                              itemIndex === index ? { ...entry, content: event.target.value } : entry,
                                            ),
                                          )
                                        }
                                        placeholder="Escreva a mensagem ou legenda da mídia"
                                        className="min-h-[120px] resize-y border-0 focus-visible:ring-0 p-0 text-sm bg-transparent"
                                      />
                                    </div>

                                    <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border/40">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="outline" size="sm" className="rounded-full h-7 px-3 text-xs bg-background/60">
                                            <Plus className="mr-1 h-3 w-3" /> Personalizar
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-48 rounded-xl">
                                          <DropdownMenuItem onClick={() => {
                                            const v = variant.content;
                                            setMessageVariants(cur => cur.map((entry, i) => i === index ? { ...entry, content: v + "{{nome}}" } : entry));
                                          }}>{"{{nome}}"}</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => {
                                            const v = variant.content;
                                            setMessageVariants(cur => cur.map((entry, i) => i === index ? { ...entry, content: v + "{{telefone}}" } : entry));
                                          }}>{"{{telefone}}"}</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>

                                      <div className="text-xs text-muted-foreground">
                                        {variant.content.length} caracteres
                                      </div>
                                    </div>

                                    {(variant.localUrl || variant.mediaUrl || variant.fileName) && (
                                      <div className="border-t border-border/40 p-4 bg-background/40">
                                        <div className="flex min-w-0 items-center gap-3">
                                          <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border/50">
                                            {variant.localUrl && variant.type === "image" ? (
                                              <img src={variant.localUrl} alt="Preview" className="h-full w-full object-cover" />
                                            ) : (
                                              <span className="text-muted-foreground">{getDraftMediaIcon(variant.type)}</span>
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <p className="truncate font-medium text-foreground text-sm">{variant.fileName || "Mídia anexa"}</p>
                                              {variant.uploadStatus === "uploading" && <Badge variant="secondary" className="text-[10px] bg-warning/20 text-warning border-warning/30">Enviando...</Badge>}
                                              {variant.uploadStatus === "done" && <Badge variant="secondary" className="text-[10px] bg-success/20 text-success border-success/30">Pronto</Badge>}
                                              {variant.uploadStatus === "failed" && <Badge variant="destructive" className="text-[10px]">Falha</Badge>}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{variant.mimetype || variant.type}</p>
                                          </div>
                                          <div className="flex gap-1 shrink-0">
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => document.getElementById(`campaign-media-${index}`)?.click()}>
                                              <ArrowClockwise className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => clearMediaFromMessage(index)}>
                                              <X className="h-4 w-4 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    <input
                                      id={`campaign-media-${index}`}
                                      type="file"
                                      accept={CAMPAIGN_MEDIA_ACCEPT}
                                      className="hidden"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          const localUrl = URL.createObjectURL(file);
                                          setMessageVariants((current) =>
                                            current.map((entry, itemIndex) =>
                                              itemIndex === index ? { ...entry, localUrl, fileName: file.name, uploadStatus: "uploading", type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "document" } : entry
                                            )
                                          );
                                          // Keep original logic to upload
                                          void attachMediaToMessage(index, file).then(() => {
                                            setMessageVariants((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, uploadStatus: "done" } : entry));
                                          }).catch(() => {
                                            setMessageVariants((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, uploadStatus: "failed" } : entry));
                                          });
                                        }
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                  </CardContent>
                                </Card>
                              ))}
                            </div>

                            {/* Preview WhatsApp Panel */}
                            <div className="sticky top-4">
                              <Card className="rounded-2xl border-border/70 overflow-hidden flex flex-col h-[500px] shadow-lg">
                                <div className="bg-[#202c33] px-4 py-2.5 flex items-center gap-3 border-b border-border/20 shrink-0">
                                  <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex shrink-0 items-center justify-center">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-semibold text-white">Preview Cliente</p>
                                    <p className="text-[11px] text-white/70">Online</p>
                                  </div>
                                </div>
                                <div className="flex-1 overflow-y-auto bg-[#0b141a] p-4 bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')] bg-repeat bg-opacity-5">
                                  <div className="space-y-4">
                                    {(selectedFlowId ? (quickReplies.find(q => q.id === selectedFlowId)?.steps || []) : messageVariants).map((variant: any, i: number) => (
                                      <div key={i} className="flex justify-end">
                                        <div className="max-w-[85%] rounded-lg bg-[#005c4b] text-[#e9edef] p-2 shadow-sm text-[14px] leading-relaxed relative">
                                          {(variant.localUrl || variant.mediaUrl) && variant.type === 'image' && (
                                            <div className="mb-2 rounded-md overflow-hidden relative group">
                                              <img src={variant.localUrl || variant.mediaUrl || ""} className="w-full h-auto max-h-48 object-cover" alt="Midia preview" />
                                              {variant.uploadStatus === 'uploading' && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Clock className="h-6 w-6 text-white animate-spin" /></div>
                                              )}
                                            </div>
                                          )}
                                          {(variant.fileName && variant.type !== 'image') && (
                                            <div className="mb-2 rounded-md bg-black/20 p-2 flex items-center gap-2">
                                              {getDraftMediaIcon(variant.type)} <span className="truncate text-xs">{variant.fileName}</span>
                                            </div>
                                          )}
                                          <p className="whitespace-pre-wrap break-words pr-8">
                                            {variant.content.replace(/{{nome}}/g, "João").replace(/{{telefone}}/g, "551199999999") || <span className="opacity-50 italic">Sem texto...</span>}
                                          </p>
                                          <span className="text-[10px] text-white/50 absolute bottom-1 right-1.5 flex items-center gap-1">
                                            12:00 <CheckCircle className="h-3 w-3 text-[#53bdeb] drop-shadow-sm" weight="fill" />
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </Card>
                            </div>
                          </div>
                        </>
                      ) : (
                        <Card className="rounded-2xl border border-border/70 bg-background/30 p-4 space-y-4">
                          <div>
                            <Label className="text-sm font-medium text-foreground">Selecionar Fluxo de Resposta Rápida</Label>
                            <p className="text-xs text-muted-foreground mb-3">Escolha qual fluxo sequencial de resposta rápida será disparado para cada contato.</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5">
                            <Button variant="outline" className="rounded-xl" onClick={() => void duplicateSelectedFlowTemplate()} disabled={!selectedFlowId}>
                              <Copy className="h-4 w-4" />
                              Duplicar fluxo como padrao
                            </Button>
                          </div>

                          <select
                            value={selectedFlowId}
                            onChange={(e) => setSelectedFlowId(e.target.value)}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                          >
                            {quickReplies.filter(q => q.isFlow).map((flow) => (
                              <option key={flow.id} value={flow.id}>
                                {flow.title} ({flow.steps?.length || 0} passos)
                              </option>
                            ))}
                          </select>

                          {(() => {
                            const flowObj = quickReplies.find(q => q.id === selectedFlowId);
                            if (!flowObj) return null;
                            return (
                              <div className="mt-4 border-t border-border/45 pt-3 space-y-2">
                                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Passos do Fluxo:</p>
                                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                  {flowObj.steps?.map((step, idx) => (
                                    <div key={step.id || idx} className="text-xs flex items-center justify-between bg-card/60 border border-border/45 p-2 rounded-lg gap-2">
                                      <div className="flex items-center gap-2 truncate min-w-0">
                                        <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0">#{idx+1}</span>
                                        <span className="capitalize font-semibold text-primary shrink-0">[{step.type}]:</span>
                                        <span className="truncate text-foreground font-medium">{step.value}</span>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground shrink-0 bg-background/40 px-1.5 py-0.5 rounded border border-border/30">
                                        {Math.round((step.delayMs || 0) / 1000)}s
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </Card>
                      )}
                    </div>
                  )}

                  {campaignStep === 3 && (
                    <div className="grid items-start gap-6 md:grid-cols-2">
                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Randomização</p>
                              <p className="text-xs text-muted-foreground">Alterna as variantes para distribuir melhor os envios.</p>
                            </div>
                            <Switch checked={shuffleEnabled} onCheckedChange={setShuffleEnabled} />
                          </div>
                          <OperationalStatusBadge label={shuffleEnabled ? "Shuffle ativo" : "Shuffle desligado"} tone={shuffleEnabled ? "online" : "offline"} />
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="grid gap-3 p-4 md:grid-cols-2">
                          <Stepper
                            label="Typing delay"
                            value={typingDelay[0]}
                            onChange={(next) => setTypingDelay([next])}
                            min={0}
                            max={120}
                            step={0.5}
                            suffix="s"
                            hint="Até 120s para simular digitação humana."
                          />
                          <Stepper
                            label="Intervalo entre contatos"
                            value={intervalSeconds[0]}
                            onChange={(next) => setIntervalSeconds([next])}
                            min={2}
                            max={600}
                            step={5}
                            suffix="s"
                            hint="Até 10 minutos entre contatos."
                          />
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4 text-xs">
                          <div className="grid gap-3 md:grid-cols-2">
                            <Stepper
                              label="Pausar a cada X envios"
                              value={Number(pauseEvery) || 0}
                              onChange={(next) => setPauseEvery(String(next))}
                              min={1}
                              max={999}
                            />
                            <Stepper
                              label="Tempo da pausa (s)"
                              value={Number(pauseSeconds) || 0}
                              onChange={(next) => setPauseSeconds(String(next))}
                              min={0}
                              max={3600}
                              step={5}
                              suffix="s"
                            />
                            <Stepper
                              label="Mensagens de Aquecimento (Warmup)"
                              value={Number(warmupMessages) || 0}
                              onChange={(next) => setWarmupMessages(String(next))}
                              min={0}
                              max={999}
                            />
                            <Stepper
                              label="Multiplicador do Delay de Aquecimento"
                              value={Number(warmupDelayMultiplier) || 0}
                              onChange={(next) => setWarmupDelayMultiplier(String(next))}
                              min={1}
                              max={20}
                              suffix="x"
                            />
                            <Stepper
                              label="Limite Diário de Envios"
                              value={Number(dailyLimit) || 0}
                              onChange={(next) => setDailyLimit(next === 0 ? "" : String(next))}
                              min={0}
                              max={100000}
                              step={10}
                              hint="0 = sem limite"
                            />
                            <Stepper
                              label="Limite por Hora de Envios"
                              value={Number(hourlyLimit) || 0}
                              onChange={(next) => setHourlyLimit(next === 0 ? "" : String(next))}
                              min={0}
                              max={10000}
                              step={5}
                              hint="0 = sem limite"
                            />
                            <div className="md:col-span-2">
                              <label className="mb-2 block text-sm font-medium">Agendamento opcional</label>
                              <div className="relative">
                                <Button 
                                  variant="outline" 
                                  className="w-full justify-start text-left font-normal h-11"
                                  onClick={(e) => {
                                    const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                    if (input && typeof input.showPicker === 'function') {
                                      try { input.showPicker(); } catch(err) { input.focus(); }
                                    } else if (input) {
                                      input.focus();
                                    }
                                  }}
                                >
                                  <CalendarBlank className="mr-2 h-4 w-4" />
                                  {startAt ? formatDateTime(new Date(startAt).toISOString()) : <span>Agendar disparo futuro (opcional)</span>}
                                </Button>
                                <Input 
                                  type="datetime-local" 
                                  value={startAt} 
                                  onChange={(event) => setStartAt(event.target.value)} 
                                  className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
                                  style={{ zIndex: -1 }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-info/20 bg-info/5 p-3 text-muted-foreground text-xs leading-relaxed space-y-1 mt-2">
                            <p className="font-bold text-info flex items-center gap-1.5">Dica Anti-Ban e Aquecimento</p>
                            <p>O aquecimento de número (warmup) envia as primeiras X mensagens com um atraso maior (multiplicado pelo fator escolhido) para simular atividade humana gradual e evitar bloqueios. Definir limites diários/por hora previne picos de envio que violam as políticas do WhatsApp.</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {campaignStep === 4 && (
                    <div className="grid gap-6 md:grid-cols-2">
                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <div>
                            <p className="text-sm font-medium">Prévia da campanha</p>
                            <p className="text-xs text-muted-foreground">Confira a estrutura final antes de salvar ou lançar.</p>
                          </div>
                          <div className="space-y-2 rounded-2xl border border-border/70 bg-card/80 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Nome</p>
                            <p className="text-lg font-semibold">{campaignName || "Campanha sem nome"}</p>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Contatos selecionados</p>
                              <p className="mt-1 font-display text-lg font-bold">{selectedContactCount}</p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Mensagens ativas</p>
                              <p className="mt-1 font-display text-lg font-bold">
                                {selectedFlowId ? "Fluxo Sequencial" : `${cleanMessages.length} variantes`}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {selectedFlowId ? (
                              (() => {
                                const flowObj = quickReplies.find(q => q.id === selectedFlowId);
                                return (
                                  <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm">
                                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Fluxo Sequencial Ativo</p>
                                    <p className="font-semibold text-foreground">{flowObj?.title || "Fluxo selecionado"}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {flowObj?.steps?.length || 0} passos de mensagem serão disparados sequencialmente com seus respectivos delays.
                                    </p>
                                  </div>
                                );
                              })()
                            ) : (
                              cleanMessages.map((message, index) => (
                                <div key={`preview-${index}`} className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
                                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Variante {index + 1}</p>
                                  <p className="text-foreground">{message.content || "Midia sem legenda"}</p>
                                  {message.fileName && (
                                    <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                                      {getDraftMediaIcon(message.type)} {message.fileName}
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <p className="text-sm font-medium">Checklist operacional</p>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <p>⬢ Tipo de Envio: <span className="font-medium text-foreground">{selectedFlowId ? "Fluxo de Resposta Rápida" : "Mensagens Avulsas"}</span></p>
                            {!selectedFlowId && <p>⬢ Typing delay: <span className="font-medium text-foreground">{typingDelay[0].toFixed(1)}s</span></p>}
                            <p>⬢ Intervalo por contato: <span className="font-medium text-foreground">{intervalSeconds[0]}s</span></p>
                            <p>⬢ Pausa a cada: <span className="font-medium text-foreground">{pauseEvery} envios</span></p>
                            <p>⬢ Tempo da pausa: <span className="font-medium text-foreground">{pauseSeconds}s</span></p>
                            <p>⬢ Agendamento: <span className="font-medium text-foreground">{startAt ? formatDateTime(new Date(startAt).toISOString()) : "Imediato"}</span></p>
                            {!selectedFlowId && <p>⬢ Shuffle: <span className="font-medium text-foreground">{shuffleEnabled ? "Ativo" : "Desligado"}</span></p>}
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tags</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {tagsInput
                                .split(",")
                                .map((tag) => tag.trim())
                                .filter(Boolean)
                                .map((tag) => (
                                  <Badge key={tag} variant="secondary" className="rounded-full border border-border/70 bg-background/60">
                                    {tag}
                                  </Badge>
                                ))}
                              {!tagsInput.trim() && <span className="text-sm text-muted-foreground">Sem tags definidas</span>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {campaignStep === 5 && (
                    <div className="grid gap-6 md:grid-cols-2">
                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <div>
                            <p className="text-sm font-medium">Pronto para persistir e lançar</p>
                            <p className="text-xs text-muted-foreground">O rascunho é salvo em `/api/campaigns` e o lançamento usa o runtime oficial de campanhas.</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado esperado</p>
                            <p className="mt-2 text-sm text-foreground">A campanha será persistida com contatos, mensagens, tags, fila e configuração de envio. Em seguida, poderá ser executada no backend oficial.</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <OperationalStatusBadge label={`${selectedContactCount} contatos`} tone={selectedContactCount > 0 ? "online" : "offline"} />
                            <OperationalStatusBadge label={`${activeMessageCount} mensagens`} tone={activeMessageCount > 0 ? "online" : "offline"} />
                            <OperationalStatusBadge label={startAt ? "Com agendamento" : "Execução imediata"} tone="syncing" />
                          </div>
                          <div className="grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-2">
                            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void persistCampaign("save")} disabled={isSaving}>
                              {isSaving && actionType === "save" ? <Clock className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                              Salvar rascunho
                            </Button>
                            <Button type="button" className="rounded-xl shadow-glow" onClick={() => void persistCampaign("launch")} disabled={isSaving || launchReadiness.length > 0}>
                              {isSaving && actionType === "launch" ? <Clock className="h-4 w-4 animate-spin" /> : <PaperPlaneTilt className="h-4 w-4" />}
                              Salvar e enviar agora
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-2xl border-border/70 bg-background/30">
                        <CardContent className="space-y-4 p-4">
                          <p className="text-sm font-medium">Readiness</p>
                          {launchReadiness.length === 0 ? (
                            <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-success">
                              Campanha consistente para salvar ou lançar.
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                              {launchReadiness.map((item) => (
                                <p key={item}>⬢ {item}</p>
                              ))}
                            </div>
                          )}
                          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">Modo atual</p>
                            <p className="mt-1">{composerMode === "edit" ? "Editando uma campanha existente" : composerMode === "duplicate" ? "Gerando uma cópia pronta para ajustes" : "Criando um novo rascunho"}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                    </div> {/* End Left Column */}

                    {/* Right Column: Side Summary */}
                    <div className="w-full">
                      <div className="sticky top-4 space-y-4">
                        <Card className="rounded-2xl border-border/70 bg-card/60 shadow-xl overflow-hidden">
                          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5">
                            <h3 className="font-display text-sm font-semibold text-primary">Resumo da Campanha</h3>
                          </div>
                          <CardContent className="p-4 space-y-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome da Campanha</p>
                              <p className="mt-0.5 text-sm font-medium text-foreground">{campaignName || "Pendente..."}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contatos</p>
                                <p className="mt-0.5 font-display text-xl font-bold">{selectedContactCount}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mensagens</p>
                                <p className="mt-0.5 font-display text-xl font-bold">{activeMessageCount}</p>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Agendamento</p>
                              <p className="mt-0.5 text-sm font-medium text-foreground">{startAt ? formatDateTime(new Date(startAt).toISOString()) : "Execução imediata"}</p>
                            </div>

                            <div className="rounded-xl border border-border/50 bg-background/50 p-2.5">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Cadência de Envio</p>
                              <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                                <div className="flex justify-between"><span>Delay digitação:</span> <span className="font-medium text-foreground">{typingDelay[0]?.toFixed(1) || 0}s{typingDelay.length > 1 ? ` a ${typingDelay[1]?.toFixed(1) || 0}s` : ''}</span></div>
                                <div className="flex justify-between"><span>Intervalo entre envios:</span> <span className="font-medium text-foreground">{intervalSeconds[0] || 0}s{intervalSeconds.length > 1 ? ` a ${intervalSeconds[1] || 0}s` : ''}</span></div>
                                <div className="flex justify-between"><span>Pausa de segurança:</span> <span className="font-medium text-foreground">{pauseSeconds || 0}s a cada {pauseEvery || 0} msg</span></div>
                              </div>
                            </div>
                            
                            {launchReadiness.length > 0 && (
                              <div className="rounded-xl border border-warning/30 bg-warning/10 p-2.5">
                                <p className="text-[10px] font-semibold text-warning mb-1">Atenção</p>
                                <ul className="text-[10px] text-warning/90 space-y-0.5">
                                  {launchReadiness.slice(0, 2).map((item, i) => (
                                    <li key={i}>• {item}</li>
                                  ))}
                                  {launchReadiness.length > 2 && <li>• E mais {launchReadiness.length - 2} avisos...</li>}
                                </ul>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div> {/* End Right Column */}
                  </div> {/* End Two-Column Layout */}

                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={resetComposer}>
                      Cancelar
                    </Button>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" size="sm" className="rounded-xl" disabled={campaignStep === 1} onClick={() => setCampaignStep((current) => Math.max(1, current - 1))}>
                        Voltar
                      </Button>
                      {campaignStep < STEP_LABELS.length ? (
                        <Button size="sm" className="rounded-xl shadow-glow" onClick={goToNextCampaignStep}>
                          Próximo Passo
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void persistCampaign("save")} disabled={isSaving}>Salvar rascunho</Button>
                          <Button size="sm" className="rounded-xl shadow-glow" onClick={() => void persistCampaign("launch")} disabled={isSaving || launchReadiness.length > 0}>
                            {isSaving && actionType === "launch" ? <Clock className="h-4 w-4 animate-spin" /> : <PaperPlaneTilt className="h-4 w-4" />}
                            Enviar campanha
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  </>
                  )}
                </CardContent>
              </Card>
            </div>
            }
            listSection={
              <>
                {/* ─── Painel de Agendamentos ─── */}
                {campaigns.some((c) => c.status === "scheduled") && (
                  <div className="mb-4 rounded-2xl border border-info/30 bg-info/5 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-info" />
                      <h3 className="font-display text-sm font-semibold text-info">Campanhas Agendadas</h3>
                      <span className="rounded-full bg-info/20 px-2 py-0.5 text-[10px] font-bold text-info">
                        {campaigns.filter((c) => c.status === "scheduled").length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {campaigns.filter((c) => c.status === "scheduled").map((scheduledCampaign) => (
                        <div key={scheduledCampaign.id} className="flex flex-col gap-2 rounded-xl border border-info/20 bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-sm">{scheduledCampaign.name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {(scheduledCampaign.messages ?? []).map((m) => m.content).filter(Boolean).join(" • ").slice(0, 80) || "Sem mensagem"}
                            </p>
                            <p className="mt-1 text-xs font-medium text-info">
                              ⏳ Agendado: {formatDateTime((scheduledCampaign.settings as any)?.startAt || (scheduledCampaign.settings as any)?.scheduledAt)}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-warning flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5" />
                              Fila de Espera: {dispatchStatuses[scheduledCampaign.id]?.pending ?? scheduledCampaign.queue?.total ?? scheduledCampaign.selectedContacts?.length ?? 0} mensagens aguardando
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {scheduledCampaign.selectedContacts?.length ?? 0} contatos • {scheduledCampaign.tags?.join(", ") || "Sem tags"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <Button
                              variant="outline"
                              className="h-8 rounded-lg px-3 text-xs"
                              onClick={() => hydrateComposer(scheduledCampaign, "edit")}
                            >
                              <PencilSimple className="mr-1 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 rounded-lg px-3 text-xs"
                              onClick={() => hydrateComposer(scheduledCampaign, "duplicate")}
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" />
                              Duplicar
                            </Button>
                            <Button
                              className="h-8 rounded-lg px-3 text-xs bg-info text-white hover:bg-info/80"
                              onClick={() => void runCampaignAction(scheduledCampaign.id, "start")}
                              disabled={actionCampaignId === scheduledCampaign.id}
                            >
                              <Play className="mr-1 h-3.5 w-3.5" />
                              Ativar Agora
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 rounded-lg border-destructive/30 px-3 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => void runCampaignAction(scheduledCampaign.id, "delete")}
                              disabled={actionCampaignId === scheduledCampaign.id}
                            >
                              <Trash className="mr-1 h-3.5 w-3.5" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* ─── Fim Painel de Agendamentos ─── */}

                <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">Campanhas persistidas</p>
                <h2 className="mt-1 font-display text-lg font-semibold">Histórico de campanhas</h2>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => void loadPageData()} disabled={actionType === "refresh"}>
                <ArrowClockwise className="h-4 w-4" />
                Atualizar lista
              </Button>
            </div>

            {campaigns.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Buscar por nome, tag ou mensagem…"
                    className="h-9 max-w-xs rounded-xl"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "all", label: "Todas" },
                      { id: "running", label: "Ativas" },
                      { id: "draft", label: "Rascunhos" },
                      { id: "scheduled", label: "Agendadas" },
                      { id: "completed", label: "Concluídas" },
                      { id: "paused", label: "Pausadas" },
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setHistoryStatusFilter(filter.id)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                          historyStatusFilter === filter.id
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Por página:</span>
                  {[12, 24, 48].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setHistoryPageSize(size)}
                      className={cn(
                        "rounded-lg px-2 py-1 font-medium transition-colors",
                        historyPageSize === size
                          ? "bg-primary/15 text-primary"
                          : "hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      {size}
                    </button>
                  ))}
                  <span className="ml-1 hidden lg:inline">
                    {filteredHistoryCampaigns.length} resultado(s)
                  </span>
                </div>
              </div>
            )}

            {campaigns.length === 0 ? (
              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="p-0">
                  <EmptyState
                    icon={<Megaphone className="h-8 w-8 text-muted-foreground/50" />}
                    title="Nenhuma campanha disponível"
                    description="Crie a primeira campanha oficial para persistir audiência, mensagens e configurações diretamente no backend consolidado."
                    action={
                      <Button className="rounded-xl shadow-glow" onClick={resetComposer}>
                        Criar campanha
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1920px]:grid-cols-6">
                {paginatedHistoryCampaigns.map((campaign) => {
                  const liveStatus = dispatchStatuses[campaign.id];
                  const liveMetrics = liveStatus?.metrics ?? {};
                  const displayCampaign = { ...campaign, status: liveStatus?.status ?? campaign.status };
                  const meta = statusMeta(displayCampaign);
                  const recipients = Number(liveMetrics.total ?? campaign.queue?.total ?? campaign.selectedContacts?.length ?? 0);
                  const sent = Number(liveMetrics.sent ?? campaign.queue?.sent ?? 0);
                  const failed = Number(liveMetrics.failed ?? campaign.queue?.failed ?? 0);
                  const processed = Number(liveMetrics.processed ?? (campaign.queue as { processed?: number } | undefined)?.processed ?? sent + failed);
                  const pending = Number(liveStatus?.pending ?? Math.max(0, recipients - processed));
                  const elapsed = formatElapsedTime(liveMetrics.startedAt ?? (campaign as { startedAt?: string | null }).startedAt ?? null);
                  const mediaCount = (campaign.messages ?? []).filter((message) => Boolean(message.mediaUrl || message.mediaPath)).length;
                  const progress = recipients > 0 ? Math.min(100, Math.round((processed / recipients) * 100)) : 0;
                  const busy = actionCampaignId === campaign.id;

                  return (
                    <Card key={campaign.id} role="button" tabIndex={0} onClick={() => setSelectedCampaignPreview(campaign)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedCampaignPreview(campaign); }} className="glass-card cursor-pointer overflow-hidden rounded-2xl border-border/70 bg-card/85 transition hover:-translate-y-0.5 hover:border-primary/40">
                      <div className={cn("h-1", meta.cardLine)} />
                      <CardContent className="space-y-3 p-4 flex flex-col">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 max-w-full">
                            <h3 className="truncate font-display text-base font-semibold">{campaign.name}</h3>
                            <OperationalStatusBadge label={meta.label} tone={meta.tone} pulse={meta.tone === "syncing"} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap flex items-center">
                            <CalendarBlank className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                            {campaign.settings?.startAt || (campaign.settings as any)?.scheduledAt ? formatDateTime(campaign.settings?.startAt || (campaign.settings as any)?.scheduledAt) : formatDateTime(campaign.createdAt)}
                          </span>
                        </div>

                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {(campaign.messages ?? []).map((message) => message.content).filter(Boolean).join(" ⬢ ") || "Sem mensagem cadastrada"}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-full border border-border/70 bg-background/60 text-xs flex items-center">
                              <Users className="mr-1.5 h-3 w-3 opacity-70" />
                              {recipients} contatos
                          </Badge>
                          {(campaign.tags ?? []).map((tag) => (
                            <Badge key={tag} variant="secondary" className="rounded-full border border-border/70 bg-background/60 text-xs font-normal">
                              {tag}
                            </Badge>
                          ))}
                          {mediaCount > 0 && <Badge variant="secondary" className="rounded-full border border-info/30 bg-info/10 text-info font-normal">{mediaCount} midia(s)</Badge>}
                          {(campaign.tags ?? []).length === 0 && <Badge variant="secondary" className="font-normal text-muted-foreground border-dashed">Sem tags</Badge>}
                        </div>

                        <div className="rounded-lg bg-muted/30 p-3 mt-1">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-medium">Progresso</span>
                            <span className="font-bold text-foreground">{progress}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
                            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="mt-2 flex flex-wrap justify-between gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            <span>{processed} de {recipients} processados</span>
                            <span>{pending} pendentes</span>
                            <span className="flex items-center">
                              <Clock className="mr-1 h-3 w-3 opacity-70" />
                              {elapsed}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          <Button variant="ghost" className="h-8 rounded-lg px-2 text-xs" onClick={(event) => { event.stopPropagation(); setSelectedCampaignPreview(campaign); }}>
                            <ArrowsOutSimple className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                          <Button variant="ghost" className="h-8 rounded-lg px-2 text-xs" onClick={(event) => { event.stopPropagation(); hydrateComposer(campaign, "edit"); }}>
                            <ArrowClockwise className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          {normalizeCampaignStatus(campaign) === "scheduled" ? (
                            <Button className="h-8 rounded-lg px-3 text-xs shadow-glow bg-info hover:bg-info/90 text-white" onClick={(event) => { event.stopPropagation(); void runCampaignAction(campaign.id, "start"); }} disabled={busy}>
                              {busy && actionType === "start" ? <Clock className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                              Disparar Agora
                            </Button>
                          ) : normalizeCampaignStatus(campaign) === "paused" ? (
                            <Button className="h-8 rounded-lg px-3 text-xs shadow-glow" onClick={(event) => { event.stopPropagation(); void runCampaignAction(campaign.id, "resume"); }} disabled={busy}>
                              {busy && actionType === "resume" ? <Clock className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                              Retomar
                            </Button>
                          ) : normalizeCampaignStatus(campaign) !== "completed" ? (
                            <Button variant="outline" className="h-8 rounded-lg px-3 text-xs" onClick={(event) => { event.stopPropagation(); void runCampaignAction(campaign.id, "pause"); }} disabled={busy}>
                              {busy && actionType === "pause" ? <Clock className="h-4 w-4 mr-1 animate-spin" /> : <Pause className="h-4 w-4 mr-1" />}
                              Pausar
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            className="h-8 rounded-lg px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={(event) => { event.stopPropagation(); void runCampaignAction(campaign.id, "delete"); }}
                            disabled={busy}
                          >
                            {busy && actionType === "delete" ? <Clock className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {campaigns.length > 0 && paginatedHistoryCampaigns.length === 0 && (
              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma campanha corresponde ao filtro atual.
                </CardContent>
              </Card>
            )}

            {filteredHistoryCampaigns.length > historyPageSize && (
              <Pagination className="mt-2">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setHistoryPage((page) => Math.max(1, page - 1));
                      }}
                      className={historyClampedPage <= 1 ? "pointer-events-none opacity-40" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: historyTotalPages }, (_, index) => index + 1)
                    .filter((page) => Math.abs(page - historyClampedPage) <= 2 || page === 1 || page === historyTotalPages)
                    .map((page, idx, arr) => (
                      <PaginationItem key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 ? (
                          <span className="px-2 text-muted-foreground">…</span>
                        ) : null}
                        <PaginationLink
                          href="#"
                          isActive={page === historyClampedPage}
                          onClick={(event) => {
                            event.preventDefault();
                            setHistoryPage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setHistoryPage((page) => Math.min(historyTotalPages, page + 1));
                      }}
                      className={historyClampedPage >= historyTotalPages ? "pointer-events-none opacity-40" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
            }
            analysisSection={
              <div className="space-y-4">
                <ConversionHeatmap campaigns={conversionHeatmapCampaigns} />
              </div>
            }
            activeTab={campaignsTab}
            onTabChange={setCampaignsTab}
            historyCount={campaigns.length}
          />
        )}
      </div>

      <Dialog open={Boolean(selectedCampaignPreview)} onOpenChange={(open) => !open && setSelectedCampaignPreview(null)}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto rounded-2xl border-border/70 bg-card/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold">
              <ArrowsOutSimple className="h-5 w-5 text-primary" />
              {selectedCampaignPreview?.name || "Campanha"}
            </DialogTitle>
          </DialogHeader>
          {selectedCampaignPreview && (
            <div className="space-y-5 py-2">
              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-lg border border-border/70 bg-background/35 p-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="mt-2"><OperationalStatusBadge label={statusMeta(selectedCampaignPreview).label} tone={statusMeta(selectedCampaignPreview).tone} /></div>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/35 p-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Contatos</p>
                  <p className="mt-1 font-display text-lg font-bold">{selectedCampaignPreview.queue?.total ?? selectedCampaignPreview.selectedContacts?.length ?? 0}</p>
                </div>
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-2">
                  <p className="text-xs uppercase tracking-wide text-warning/80">Fila (Espera)</p>
                  <p className="mt-1 font-display text-lg font-bold text-warning">{dispatchStatuses[selectedCampaignPreview.id]?.pending ?? Math.max(0, (selectedCampaignPreview.queue?.total ?? selectedCampaignPreview.selectedContacts?.length ?? 0) - ((selectedCampaignPreview.queue?.sent ?? 0) + (selectedCampaignPreview.queue?.failed ?? 0)))}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/35 p-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Enviadas</p>
                  <p className="mt-1 font-display text-lg font-bold">{selectedCampaignPreview.queue?.sent ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/35 p-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Falhas</p>
                  <p className="mt-1 font-display text-lg font-bold">{selectedCampaignPreview.queue?.failed ?? 0}</p>
                </div>
              </div>

              {/* Análise de IA do disparo — métricas reais */}
              <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkle weight="fill" className="h-4 w-4 text-primary" />
                    Análise de IA do disparo
                  </p>
                  {analysisLoading && <span className="text-xs text-muted-foreground">Analisando conversas…</span>}
                </div>
                {analysisLoading ? (
                  <div className="grid gap-3 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
                    ))}
                  </div>
                ) : campaignAnalysis?.metrics ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">% de respostas</p>
                        <p className="mt-1 font-display text-2xl font-bold text-primary">{campaignAnalysis.metrics.responseRate ?? 0}%</p>
                        <p className="text-[10px] text-muted-foreground">{campaignAnalysis.metrics.replied ?? 0}/{campaignAnalysis.metrics.contacted ?? 0} responderam</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Qualidade</p>
                        <p className="mt-1 font-display text-2xl font-bold text-foreground">{campaignAnalysis.metrics.qualityScore != null ? `${campaignAnalysis.metrics.qualityScore}%` : "—"}</p>
                        <p className="text-[10px] text-muted-foreground">baseada no sentimento</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tempo de resposta</p>
                        <p className="mt-1 font-display text-2xl font-bold text-foreground">{formatDurationMs(campaignAnalysis.metrics.avgResponseMs)}</p>
                        <p className="text-[10px] text-muted-foreground">média até 1ª resposta</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tempo gasto</p>
                        <p className="mt-1 font-display text-2xl font-bold text-foreground">{formatDurationMs(campaignAnalysis.metrics.elapsedMs)}</p>
                        <p className="text-[10px] text-muted-foreground">duração do disparo</p>
                      </div>
                    </div>
                    {campaignAnalysis.metrics.sentiment && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary" className="rounded-full border border-success/30 bg-success/10 text-success">Positivas: {campaignAnalysis.metrics.sentiment.positive ?? 0}</Badge>
                        <Badge variant="secondary" className="rounded-full border border-border/70">Neutras: {campaignAnalysis.metrics.sentiment.neutral ?? 0}</Badge>
                        <Badge variant="secondary" className="rounded-full border border-destructive/30 bg-destructive/10 text-destructive">Negativas: {campaignAnalysis.metrics.sentiment.negative ?? 0}</Badge>
                      </div>
                    )}
                    {Array.isArray(campaignAnalysis.leads) && campaignAnalysis.leads.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Leads do disparo — clique para ver o grafo de conversas</p>
                        <div className="scrollbar-thin max-h-56 space-y-1.5 overflow-y-auto pr-1">
                          {campaignAnalysis.leads.map((leadItem: any, idx: number) => (
                            <button
                              key={`${leadItem.phone}-${idx}`}
                              type="button"
                              onClick={() => setGraphLead({ id: String(leadItem.phone), name: leadItem.phone })}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-card/70"
                            >
                              <span className="flex items-center gap-2 truncate">
                                <Users className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <span className="truncate">{leadItem.phone}</span>
                              </span>
                              <span className="flex flex-shrink-0 items-center gap-2">
                                {leadItem.sentiment && (
                                  <span className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                    leadItem.sentiment === "positive" ? "bg-success/15 text-success" :
                                    leadItem.sentiment === "negative" ? "bg-destructive/15 text-destructive" :
                                    "bg-muted/40 text-muted-foreground",
                                  )}>{leadItem.sentiment}</span>
                                )}
                                <span className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  leadItem.status === "responded" ? "bg-primary/15 text-primary" :
                                  leadItem.status === "sent" ? "bg-info/15 text-info" :
                                  "bg-muted/40 text-muted-foreground",
                                )}>
                                  {leadItem.status === "responded" ? "Respondeu" : leadItem.status === "sent" ? "Enviado" : "Pendente"}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem dados de análise para este disparo ainda. As métricas aparecem após o envio e respostas dos leads.</p>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-background/30 p-4">
                    <p className="text-sm font-semibold">Mensagens e mídias do disparo</p>
                    {(selectedCampaignPreview.messages ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma mensagem cadastrada.</p>
                    ) : (
                      (selectedCampaignPreview.messages ?? []).map((message, index) => (
                        <div key={`${selectedCampaignPreview.id}-message-${index}`} className="rounded-2xl border border-border/70 bg-card/70 p-4 text-sm">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="font-medium text-foreground">Mensagem {index + 1}</p>
                            <Badge variant="secondary" className="rounded-full">{message.type || "text"}</Badge>
                          </div>
                          <p className="whitespace-pre-wrap text-muted-foreground">{message.content || "Sem legenda"}</p>
                          {(message.mediaUrl || message.mediaPath) && (
                            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                              {getDraftMediaIcon((message.type === "file" ? "document" : message.type || "document") as CampaignDraftMediaType)}
                              <span className="truncate">{message.fileName || message.mimetype || "Mídia anexada"}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Recipient Audience & Dispatch History Log */}
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-background/30 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Histórico de Disparos por Contato</p>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {(selectedCampaignPreview.selectedContacts || selectedCampaignPreview.queue?.items || []).length} contatos
                      </Badge>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {(selectedCampaignPreview.selectedContacts || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Nenhum registro de contato disponível para este disparo.</p>
                      ) : (
                        (selectedCampaignPreview.selectedContacts || []).map((contact, idx) => {
                          const sentCount = Number(selectedCampaignPreview.queue?.sent ?? 0);
                          const isSent = idx < sentCount;
                          return (
                            <div key={`${contact.id}-${idx}`} className="flex items-center justify-between p-2.5 rounded-xl border border-border/50 bg-card/60 text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground truncate">{contact.name || "Contato"}</p>
                                <p className="text-[11px] text-muted-foreground font-mono">{contact.phone || "Sem telefone"}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {isSent ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                                    <CheckCircle className="mr-1 h-3 w-3" /> Enviado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                    <Clock className="mr-1 h-3 w-3" /> Na Fila
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/70 bg-background/30 p-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">Cadência e Operação</p>
                  <p>Typing: <span className="font-medium text-foreground">{selectedCampaignPreview.settings?.typingDelaySeconds ?? 3}s</span></p>
                  <p>Intervalo: <span className="font-medium text-foreground">{selectedCampaignPreview.settings?.intervalSeconds ?? 10}s</span></p>
                  <p>Pausa: <span className="font-medium text-foreground">{selectedCampaignPreview.settings?.pauseEvery ?? 10} / {selectedCampaignPreview.settings?.pauseSeconds ?? 60}s</span></p>
                  <p>Sessão: <span className="font-medium text-foreground">{selectedCampaignPreview.settings?.sessionId || "automática"}</span></p>
                  <p>Agendamento: <span className="font-medium text-foreground">{formatDateTime(selectedCampaignPreview.settings?.startAt || (selectedCampaignPreview.settings as any)?.scheduledAt)}</span></p>
                  <div className="pt-3 flex flex-wrap gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => hydrateComposer(selectedCampaignPreview, "edit")}>
                      <PencilSimple className="h-4 w-4" /> Editar
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => hydrateComposer(selectedCampaignPreview, "duplicate")}>
                      <Copy className="h-4 w-4" /> Duplicar
                    </Button>
                    <Button className="rounded-xl shadow-glow" onClick={() => void runCampaignAction(selectedCampaignPreview.id, "start")}>
                      <Play className="h-4 w-4" /> Iniciar Disparo
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isTagModalOpen} onOpenChange={setIsTagModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border/70 bg-card/95">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold">Selecionar por Etiqueta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="tag-input" className="text-sm font-medium">Nome da etiqueta (tag)</Label>
              <Input
                id="tag-input"
                placeholder="Ex: cliente, pendente, etc"
                value={tagInputVal}
                onChange={(e) => setTagInputVal(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setIsTagModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="rounded-xl shadow-glow" onClick={handleApplyTagSelection}>
                Aplicar Filtro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grafo de conversas do lead (análise de IA) */}
      <Dialog open={Boolean(graphLead)} onOpenChange={(open) => !open && setGraphLead(null)}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto rounded-2xl border-border/70 bg-card/95">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg font-bold">
              <Sparkle weight="fill" className="h-5 w-5 text-primary" />
              Grafo de conversas — {graphLead?.name}
            </DialogTitle>
          </DialogHeader>
          {graphLead && <LeadKnowledgeGraph leadId={graphLead.id} leadName={graphLead.name} />}
        </DialogContent>
      </Dialog>

      {/* AI Campaign Modal */}
      <AICampaignModal
        open={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyGeneratedCampaign={handleApplyGeneratedCampaign}
      />
    </div>
  );
}

