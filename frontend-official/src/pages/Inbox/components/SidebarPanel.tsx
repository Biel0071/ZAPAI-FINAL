import { memo, useMemo, useState, useEffect, ComponentType } from "react";
import {
  X,
  Plus,
  Trash,
  Star,
  PencilSimple,
  CopySimple,
  PaperPlaneTilt,
  CaretRight,
  CaretLeft,
  MagnifyingGlass,
  File as FileIcon,
  Waveform,
  DownloadSimple,
  Paperclip,
  EnvelopeSimple,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import { Folder, History, UserRound, Workflow, type LucideIcon, Sparkles, Cpu, Bot, Brain, Phone } from "lucide-react";
import { AIIcon } from "@/components/ai/AIIcon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { InboxSectionBoundary } from "@/components/system/InboxSectionBoundary";
import type { ChatMessage, Conversation } from "@/services/apiService";
import { apiService } from "@/services/apiService";
import { getSharedSocket } from "../../../runtime/socket/socketManager";
import { FlowExecutionBanner, type FlowExecutionData } from "./FlowExecutionBanner";
import type { AiMemoryRecord, InboxAiRuntime, PreviewMediaState, QuickReplyItem } from "../types";
import {
  sortMessagesAsc,
  getConversationSourceLabel,
  sanitizeSidebarText,
  formatTime,
  formatDurationMs,
  getTagColor,
  formatPhoneNumber,
  getQuickReplyPreviewText,
  getMediaTypeLabel,
  getLeadTemperatureMeta,
  getMessageDisplayContent,
  extractMessageAssetUrl,
  getMediaFileName,
  formatFileSize,
  toConversationDateLabel,
  resolveMediaUrl,
} from "../utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

function getProviderIcon(provider?: string): LucideIcon {
  const norm = String(provider ?? "").toLowerCase();
  if (norm.includes("openai")) return Brain;
  if (norm.includes("gemini") || norm.includes("google")) return Sparkles;
  if (norm.includes("anthropic") || norm.includes("claude")) return Bot;
  return Cpu;
}

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "Sem registro";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Sem registro";
  const now = new Date();
  const diffInMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffInMins < 1) return "Agora mesmo";
  if (diffInMins < 60) return `Há ${diffInMins} min`;
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `Há ${diffInHours} h`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Ontem";
  return `Há ${diffInDays} dias`;
}

interface SidebarPanelProps {
  selectedConversation: Conversation | null;
  rightPanelTab: "ai" | "lead" | "files" | "qr" | "history" | null;
  setRightPanelTab: (val: "ai" | "lead" | "files" | "qr" | "history" | null) => void;
  rightPanelCollapsed: boolean;
  setRightPanelCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  isTabletLayout: boolean;
  aiEnabledForConversation: boolean;
  aiRuntime: InboxAiRuntime;
  conversationAiOverrideEnabled: boolean;
  selectedLead: any;
  suggestingResponse: boolean;
  handleSuggestResponse: () => Promise<void>;
  messages: ChatMessage[];
  aiMemory: AiMemoryRecord | null;
  setConversations: (val: any) => void;
  leadNotes: string;
  setLeadNotes: (val: string) => void;
  handleSaveLeadNotes: () => Promise<void>;
  newTagInput: string;
  setNewTagInput: (val: string) => void;
  handleAddTagToSelectedConversation: () => void;
  handleRemoveTagFromSelectedConversation: (tag: string) => void;
  handleInsertTag: (tag: string) => void;
  updatingAiToggle: boolean;
  handleSetConversationAiEnabled: (val: boolean) => Promise<void>;
  responseSearchQuery: string;
  setResponseSearchQuery: (val: string) => void;
  quickReplies: QuickReplyItem[];
  openCreateQuickReplyDialog: () => void;
  quickReplyCategory: string;
  setQuickReplyCategory: (val: string) => void;
  sendQuickReply: (item: QuickReplyItem) => Promise<void>;
  toggleFavoriteQuickReply: (id: string) => void;
  openEditQuickReplyDialog: (item: QuickReplyItem) => void;
  duplicateQuickReply: (item: QuickReplyItem) => void;
  deleteQuickReply: (id: string) => void;
  setMessageInput: (val: string) => void;
  handleOpenMediaPreview: (media: PreviewMediaState) => void;
  handleDownloadMedia: (message: ChatMessage) => void;
  persistConversationMetadata: (conversationId: string, metadata: any) => Promise<void>;
  handleArchiveSelectedConversation: () => void;
  aiAgents?: any[];
  loadingAgents?: boolean;
  handleSetConversationAgent?: (agentName: string) => Promise<void> | void;
  isDrawer?: boolean;
  onSaveTimelineToMemory?: (evt: { title: string; description: string; timestamp: string }) => Promise<void> | void;
  onAttachMedia?: (message: ChatMessage) => void;
}

const RIGHT_PANEL_SECTIONS = [
  { id: "ai", label: "IA", icon: AIIcon, shortcut: "Alt+1" },
  { id: "lead", label: "Lead", icon: UserRound, shortcut: "Alt+2" },
  { id: "qr", label: "Respostas Rápidas", icon: Workflow, shortcut: "Alt+4" },
  { id: "history", label: "Histórico", icon: History, shortcut: "Alt+5" },
  { id: "files", label: "Arquivos", icon: Folder, shortcut: "Alt+3" },
] as const;

type RightPanelTabId = (typeof RIGHT_PANEL_SECTIONS)[number]["id"];

const BUSINESS_TAG_OPTIONS = [
  "Novo Lead",
  "Cliente",
  "Orçamento",
  "Venda",
  "Suporte",
  "VIP",
  "Urgente",
] as const;

const SharedMediaCard = memo(function SharedMediaCard({
  message,
  onOpenMediaPreview,
  onDownloadMedia,
  onAttachMedia,
}: {
  message: ChatMessage;
  onOpenMediaPreview: (media: PreviewMediaState) => void;
  onDownloadMedia: (message: ChatMessage) => void;
  onAttachMedia?: (message: ChatMessage) => void;
}) {
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetSize, setAssetSize] = useState<number | null>(null);
  const mediaUrl = resolveMediaUrl(extractMessageAssetUrl(message));
  const mediaType =
    message.mediaType ??
    inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? "")) ??
    "file";
  const fileName = getMediaFileName(message);
  const previewType: PreviewMediaState["type"] =
    mediaType === "audio" ||
    mediaType === "video" ||
    mediaType === "image" ||
    mediaType === "sticker"
      ? mediaType
      : "file";

  useEffect(() => {
    setAssetSize(null);
    setAssetError(mediaUrl ? null : "Backend nao retornou URL da midia persistida.");
    if (!mediaUrl) return;
    let cancelled = false;

    void fetch(mediaUrl, { method: "HEAD" })
      .then((response) => {
        if (cancelled) return;
        if (response.ok || response.status === 405) {
          const contentLength = response.headers.get("content-length");
          if (contentLength && Number.isFinite(Number(contentLength)))
            setAssetSize(Number(contentLength));
          return;
        }
        setAssetError(
          `Backend respondeu HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ""}`,
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setAssetError(
          `Falha real ao acessar midia: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [mediaUrl]);

  return (
    <div className="group rounded-2xl border border-border/30 bg-card/20 p-2.5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-card/40 hover:shadow-sm">
      <div className="relative aspect-square w-full flex items-center justify-center overflow-hidden rounded-xl border border-border/20 bg-muted/30">
        {mediaType === "image" && mediaUrl && !assetError ? (
          <img
            src={mediaUrl}
            alt={fileName}
            className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            onClick={() =>
              onOpenMediaPreview({ url: mediaUrl, type: previewType, fileName, messageId: message.id })
            }
            onError={() => setAssetError("A imagem nao pode ser decodificada pelo navegador.")}
          />
        ) : mediaType === "video" && mediaUrl && !assetError ? (
          <>
            <video
              src={mediaUrl}
              className="h-full w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              preload="metadata"
              onClick={() =>
                onOpenMediaPreview({ url: mediaUrl, type: previewType, fileName, messageId: message.id })
              }
              onError={() =>
                setAssetError("O video nao pode ser carregado ou o formato nao e suportado.")
              }
            />
            {mediaType === "video" && !assetError && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-sm">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 256 256" className="ml-0.5"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65c-10.53,6.33-24.32-1.39-24.32-13.51V39.86C64,27.74,77.79,20,88.32,26.35l144.08,88.14A15.74,15.74,0,0,1,240,128Z"></path></svg>
                 </div>
                 {(() => {
                   const dur = Number(message.duration || (message as any).mediaDuration);
                   if (!dur) return null;
                   const ms = dur < 1000 ? dur * 1000 : dur;
                   return (
                     <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                       {formatDurationMs(ms)}
                     </div>
                   );
                 })()}
              </div>
            )}
          </>
        ) : mediaType === "sticker" && mediaUrl && !assetError ? (
          <img
            src={mediaUrl}
            alt={fileName}
            className="h-full w-full cursor-pointer bg-white/90 object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            onClick={() =>
              onOpenMediaPreview({ url: mediaUrl, type: previewType, fileName, messageId: message.id })
            }
            onError={() => setAssetError("O sticker nao pode ser carregado ou decodificado.")}
          />
        ) : mediaType === "audio" && mediaUrl && !assetError ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
            <Waveform className="h-7 w-7 text-primary/70 animate-pulse" />
            <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">{fileName}</span>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center">
            {mediaType === "audio" ? (
              <Waveform className="h-7 w-7 text-muted-foreground/60" />
            ) : (
              <FileIcon className="h-7 w-7 text-muted-foreground/60" />
            )}
            <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">
              {getMediaTypeLabel(mediaType)}
            </span>
          </div>
        )}

        {/* Hover overlay with download and attach actions */}
        {mediaUrl && !assetError && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2 z-10">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-white"
              onClick={(e) => {
                e.stopPropagation();
                if (onAttachMedia) onAttachMedia(message);
              }}
              title="Anexar"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white"
              onClick={(e) => {
                e.stopPropagation();
                onDownloadMedia(message);
              }}
              title="Baixar"
            >
              <DownloadSimple className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      <div className="mt-1.5 space-y-0.5">
        <p className="truncate text-[10px] font-semibold text-foreground/90" title={fileName}>{fileName}</p>
        <p className="truncate text-[9px] text-muted-foreground/80">
          {getMediaTypeLabel(mediaType)} • {assetSize ? formatFileSize(assetSize) : ""}
        </p>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-6 flex-1 text-[9px] rounded-md bg-background/50 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!mediaUrl || Boolean(assetError)}
          onClick={() => {
            if (!mediaUrl) return;
            onOpenMediaPreview({ url: mediaUrl, type: previewType, fileName, messageId: message.id });
          }}
        >
          Abrir
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-6 flex-1 text-[9px] rounded-md bg-background/50 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!mediaUrl || Boolean(assetError)}
          onClick={() => onDownloadMedia(message)}
        >
          Baixar
        </Button>
      </div>
      {assetError && (
        <div className="mt-2 flex justify-center">
          <Badge variant="outline" className="border-destructive/30 bg-destructive/5 text-destructive text-[8px] px-1.5 py-0 h-4 scale-90 truncate max-w-full">
            {assetError.includes("Backend nao retornou URL") ? "Sem URL" : "Erro Mídia"}
          </Badge>
        </div>
      )}
    </div>
  );
});

function inferMediaTypeFromSource(source?: string): "image" | "video" | "audio" | "file" | "sticker" | undefined {
  if (!source) return undefined;
  const normalized = source.toLowerCase();
  if (/(\.webp)($|\?|#)/.test(normalized) || normalized.includes("sticker")) return "sticker";
  if (/(\.png|\.jpe?g|\.gif|\.bmp|\.svg)($|\?|#)/.test(normalized)) return "image";
  if (/(\.mp4|\.mov|\.avi|\.mkv|\.webm|\.m4v)($|\?|#)/.test(normalized)) return "video";
  if (/(\.mp3|\.wav|\.ogg|\.m4a|\.aac|\.webm|\.opus)($|\?|#)/.test(normalized)) return "audio";
  return "file";
}

const RightPanelSectionTrigger = memo(function RightPanelSectionTrigger({
  active,
  icon,
  label,
  onSelect,
  badges,
}: {
  active: boolean;
  icon: ComponentType<any>;
  label: string;
  onSelect: () => void;
  badges?: React.ReactNode;
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-[46px] w-full shrink-0 items-center justify-between px-4 text-left text-xs font-semibold tracking-wide transition-all duration-300 border-b",
        active
          ? "bg-emerald-500/[0.06] text-emerald-500 border-b-border/50 border-l-[4px] border-l-emerald-500 hover:shadow-[0_0_12px_rgba(16,185,129,0.08)]"
          : "bg-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground border-b-border/30 border-l-[4px] border-l-transparent",
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon className={cn("h-5 w-5 transition-colors", active ? "text-emerald-500" : "text-muted-foreground")} strokeWidth={2} aria-hidden />
        {label}
        {badges}
      </span>
      <CaretRight
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-300 ease-in-out",
          active && "rotate-90 text-emerald-500"
        )}
        weight="bold"
        aria-hidden
      />
    </button>
  );
});

export function SidebarPanel({
  selectedConversation,
  rightPanelTab,
  setRightPanelTab,
  rightPanelCollapsed,
  setRightPanelCollapsed,
  isTabletLayout,
  aiEnabledForConversation,
  aiRuntime,
  conversationAiOverrideEnabled,
  selectedLead,
  suggestingResponse,
  handleSuggestResponse,
  messages,
  aiMemory,
  setConversations,
  leadNotes,
  setLeadNotes,
  handleSaveLeadNotes,
  newTagInput,
  setNewTagInput,
  handleAddTagToSelectedConversation,
  handleRemoveTagFromSelectedConversation,
  handleInsertTag,
  updatingAiToggle,
  handleSetConversationAiEnabled,
  responseSearchQuery,
  setResponseSearchQuery,
  quickReplies,
  openCreateQuickReplyDialog,
  quickReplyCategory,
  setQuickReplyCategory,
  sendQuickReply,
  toggleFavoriteQuickReply,
  openEditQuickReplyDialog,
  duplicateQuickReply,
  deleteQuickReply,
  setMessageInput,
  handleOpenMediaPreview,
  handleDownloadMedia,
  persistConversationMetadata,
  handleArchiveSelectedConversation,
  aiAgents = [],
  loadingAgents = false,
  handleSetConversationAgent,
  isDrawer = false,
  onSaveTimelineToMemory,
  onAttachMedia,
}: SidebarPanelProps) {
  const { toast } = useToast();
  const [fileFilter, setFileFilter] = useState<"all" | "image" | "video" | "file">("all");
  const [expandedTimeline, setExpandedTimeline] = useState<Set<string>>(new Set());
  const [activeFlowData, setActiveFlowData] = useState<FlowExecutionData | null>(null);

  useEffect(() => {
    let active = true;
    if (!selectedConversation?.phone) {
      setActiveFlowData(null);
      return;
    }
    const currentPhone = selectedConversation.phone;

    apiService.getActiveQuickReplyFlow(currentPhone).then(res => {
      if (active && res && res.flow) setActiveFlowData(res.flow);
    }).catch(console.error);

    const handleFlowStarted = (data: FlowExecutionData) => {
      if (data.chatId === currentPhone || String(data.chatId) === String(selectedConversation.id)) {
        setActiveFlowData(data);
      }
    };

    const handleFlowUpdated = (data: FlowExecutionData) => {
      if (data.chatId === currentPhone || String(data.chatId) === String(selectedConversation.id)) {
        setActiveFlowData((prev) => ({ ...(prev || {}), ...data }));
      }
    };

    const handleFlowEnded = (data: { chatId: string; status?: string }) => {
      if (data.chatId === currentPhone || String(data.chatId) === String(selectedConversation.id)) {
        setActiveFlowData((prev) => {
          if (!prev) return null;
          return { ...prev, status: (data.status as any) || "completed" };
        });
        setTimeout(() => {
          if (active) setActiveFlowData(null);
        }, 5000);
      }
    };

    const socket = getSharedSocket();
    if (socket && typeof socket.on === "function") {
      socket.on("flow:started", handleFlowStarted);
      socket.on("flow:step_updated", handleFlowUpdated);
      socket.on("flow:cancelled", (data: any) => handleFlowEnded({ ...data, status: "cancelled" }));
      socket.on("flow:finished", (data: any) => handleFlowEnded({ ...data, status: "completed" }));
      return () => {
        active = false;
        socket.off("flow:started", handleFlowStarted);
        socket.off("flow:step_updated", handleFlowUpdated);
        socket.off("flow:cancelled", handleFlowEnded);
        socket.off("flow:finished", handleFlowEnded);
      };
    }
    return () => { active = false; };
  }, [selectedConversation]);

  const toggleTimelineItem = (id: string) => {
    setExpandedTimeline((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const conversationVariableContext = useMemo(
    () => ({
      contactName: selectedConversation?.contactName || "",
      phone: selectedConversation?.phone || "",
      company: typeof aiMemory?.company === "string" ? aiMemory.company : "ZapAI",
    }),
    [aiMemory?.company, selectedConversation?.contactName, selectedConversation?.phone],
  );

  const selectedLeadMeta = getLeadTemperatureMeta(selectedLead);

  const selectedConversationFunnelStage = String(
    (selectedConversation as any)?.funnel_stage ?? selectedLeadMeta.label ?? "Novo Lead",
  );

  const conversationMetrics = useMemo(() => {
    const ordered = sortMessagesAsc(messages);
    const inbound = ordered.filter((message) => !message.fromMe);
    const outbound = ordered.filter((message) => message.fromMe);
    const responseTimesMs: number[] = [];
    let pendingInbound: ChatMessage | null = null;
    let lastAiResponseAt: string | null = null;
    let lastAiResponseTimeMs: number | null = null;

    ordered.forEach((message) => {
      if (!message.fromMe) {
        pendingInbound = message;
        return;
      }

      if (!pendingInbound) return;
      const inboundTime = new Date(pendingInbound.createdAt).getTime();
      const outboundTime = new Date(message.createdAt).getTime();
      if (
        Number.isFinite(inboundTime) &&
        Number.isFinite(outboundTime) &&
        outboundTime >= inboundTime
      ) {
        responseTimesMs.push(outboundTime - inboundTime);
        if (message.isAI) {
          lastAiResponseAt = message.createdAt;
          lastAiResponseTimeMs = outboundTime - inboundTime;
        }
      }
      pendingInbound = null;
    });

    const averageResponseMs =
      responseTimesMs.length > 0
        ? Math.round(
            responseTimesMs.reduce((total, value) => total + value, 0) / responseTimesMs.length,
          )
        : null;

    const averageResponseLabel =
      averageResponseMs == null
        ? "Ainda sem resposta"
        : averageResponseMs >= 3_600_000
          ? `${Math.round(averageResponseMs / 3_600_000)}h`
          : averageResponseMs >= 60_000
            ? `${Math.round(averageResponseMs / 60_000)} min`
            : `${Math.max(1, Math.round(averageResponseMs / 1000))} s`;

    const allTags = Array.from(
      new Set(
        [
          ...(selectedConversation?.tags ?? []),
          ...((Array.isArray(aiMemory?.tags) ? aiMemory.tags : []) as string[]),
        ].filter(Boolean),
      ),
    );

    return {
      messagesExchanged: ordered.length,
      inboundMessages: inbound.length,
      outboundMessages: outbound.length,
      averageResponseLabel,
      averageResponseMs,
      lastInteraction: ordered.at(-1)?.createdAt ?? selectedConversation?.updatedAt ?? null,
      firstInteraction: ordered[0]?.createdAt ?? null,
      tags: allTags,
      leadSource: getConversationSourceLabel(selectedConversation),
      summary: sanitizeSidebarText(aiMemory?.summary ?? selectedConversation?.summary ?? ""),
      lastAiUpdate: typeof aiMemory?.last_updated === "string" ? aiMemory.last_updated : null,
      lastAiResponseAt,
      lastAiResponseTimeMs,
      objective:
        selectedLead?.intent === "purchase_intent"
          ? "Comprar plano"
          : selectedLead?.intent === "price_request"
            ? "Solicitar orçamento"
            : selectedLead?.intent === "question"
              ? "Tirar dúvidas"
              : selectedLead?.intent === "support"
                ? "Solicitar suporte"
                : "Contato em andamento",
      metrics: aiMemory?.metrics ?? {},
    };
  }, [aiMemory, selectedConversation, messages, selectedLead]);

  const conversationTimeline = useMemo(() => {
    const ordered = sortMessagesAsc(messages);
    const items = ordered.slice(-8).map((message) => ({
      id: message.id,
      title: message.fromMe ? "Mensagem enviada" : "Mensagem recebida",
      description:
        getMessageDisplayContent(message).slice(0, 120) || getMediaTypeLabel(message.mediaType),
      timestamp: message.createdAt,
    }));

    if (conversationMetrics.lastAiUpdate) {
      items.push({
        id: `ai-${conversationMetrics.lastAiUpdate}`,
        title: "Resumo IA atualizado",
        description: conversationMetrics.summary || "Memória da conversa sincronizada.",
        timestamp: conversationMetrics.lastAiUpdate,
      });
    }

    return items
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [conversationMetrics.lastAiUpdate, conversationMetrics.summary, messages]);

  const aiLiveInsights = useMemo(() => {
    const text = messages
      .map((message) => message.content)
      .join(" ")
      .toLowerCase();
    const sentimentMap: Record<string, string> = {
      positive: "Amigável",
      negative: "Insatisfeito",
      neutral: "Neutro",
    };

    const mood = aiMemory?.sentiment
      ? sentimentMap[aiMemory.sentiment] || "Interessado"
      : messages.length === 0
        ? "Neutro"
        : "Interessado";
    const urgency =
      text.includes("urgente") || text.includes("agora") || text.includes("rápido")
        ? "Alta"
        : selectedLead?.lead_temperature === "cold"
          ? "Baixa"
          : "Média";
    const churnRisk =
      aiMemory?.sentiment === "negative"
        ? "Alto"
        : selectedLead?.lead_temperature === "hot" ||
            selectedLead?.lead_temperature === "ready_to_buy"
          ? "Baixo"
          : "Médio";

    const isFromDb = Boolean(aiMemory?.summary || aiMemory?.metrics || aiMemory?.last_updated);
    const confidenceRaw = (aiMemory as any)?.confidence ?? (aiMemory as any)?.score ?? (aiMemory as any)?.certainty;
    const summaryStr = String(aiMemory?.summary || "");
    const confidenceValue = confidenceRaw ? Number(confidenceRaw) : (isFromDb && summaryStr ? (Array.from(summaryStr).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 11) + 85 : 0);

    return {
      mood,
      urgency,
      churnRisk,
      bestTime: conversationMetrics.lastInteraction
        ? formatTime(conversationMetrics.lastInteraction)
        : "Sem histórico",
      products:
        text.includes("api") || text.includes("webhook") ? "API / Integrações" : "WhatsApp / CRM",
      objections:
        text.includes("caro") || text.includes("desconto")
          ? "Preço"
          : text.includes("prazo") || text.includes("tempo")
            ? "Prazo"
            : "",
      objective: conversationMetrics.objective,
      summary: conversationMetrics.summary,
      tags: conversationMetrics.tags,
      metrics: conversationMetrics.metrics,
      totalMessages: conversationMetrics.messagesExchanged,
      lastUpdated: conversationMetrics.lastAiUpdate,
      isFromDb,
      confidenceValue,
    };
  }, [aiMemory, conversationMetrics, messages, selectedLead]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add("saudação");
    cats.add("vendas");
    cats.add("suporte");
    for (const item of quickReplies) {
      if (item.category) {
        const cleanCat = item.category.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim().toLowerCase();
        if (cleanCat) {
          cats.add(cleanCat);
        }
      }
    }
    return Array.from(cats);
  }, [quickReplies]);

  const filteredQuickReplies = useMemo(() => {
    const query = responseSearchQuery.trim().toLowerCase();
    return quickReplies.filter((item) => {
      const categoryMatches =
        quickReplyCategory === "all" || item.category === quickReplyCategory;
      if (!categoryMatches) return false;
      if (!query) return true;
      return item.text.toLowerCase().includes(query);
    });
  }, [quickReplies, quickReplyCategory, responseSearchQuery]);

  const favoriteQuickReplies = useMemo(() => {
    return filteredQuickReplies.filter((item) => item.favorite);
  }, [filteredQuickReplies]);

  const quickRepliesByCategory = useMemo(() => {
    const map: Record<string, QuickReplyItem[]> = {};
    for (const item of filteredQuickReplies) {
      if (!item.favorite) {
        const cat = item.category || "suporte";
        if (!map[cat]) map[cat] = [];
        map[cat].push(item);
      }
    }
    return map;
  }, [filteredQuickReplies]);

  const renderQuickReplyRow = (item: QuickReplyItem) => (
    <div
      key={item.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "text/plain",
          getQuickReplyPreviewText(item, conversationVariableContext),
        );
      }}
      onClick={() => {
        setMessageInput(getQuickReplyPreviewText(item, conversationVariableContext));
      }}
      onDoubleClick={() => {
        void sendQuickReply(item);
      }}
      className="group rounded-xl border border-border/30 bg-card/40 p-3.5 transition-all duration-300 hover:border-emerald-500/40 hover:bg-card/60 hover:shadow-[0_0_15px_rgba(16,185,129,0.06)] cursor-pointer active:scale-[0.99] select-none space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-xs text-foreground/90 truncate flex-grow flex items-center gap-1.5">
          {item.isFlow && (
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] px-1 py-0.2 h-[15px] leading-none font-bold shrink-0 shadow-sm border-none">
              Fluxo
            </Badge>
          )}
          <span className="truncate">{item.title || getQuickReplyPreviewText(item, conversationVariableContext).split("\n")[0]}</span>
        </h4>
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1 max-w-[45%] overflow-hidden shrink-0">
            {item.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {getQuickReplyPreviewText(item, conversationVariableContext)}
      </p>
      {item.items && item.items.some((entry) => entry.type !== "text") && (
        <div className="flex flex-wrap gap-1.5">
          {item.items
            .filter((entry) => entry.type !== "text")
            .map((entry, index) => {
              const type = entry.type === "pdf" ? "document" : entry.type;
              const badgeStyle = 
                type === "image" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                type === "video" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                type === "audio" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                type === "document" || type === "file" ? "bg-sky-500/10 text-sky-500 border-sky-500/20" :
                "bg-slate-500/10 text-slate-500 border-slate-500/20";
              const label = 
                type === "image" ? "IMAGEM" :
                type === "video" ? "VÍDEO" :
                type === "audio" ? "ÁUDIO" :
                type === "document" || type === "file" ? "DOCUMENTO" : "MÍDIA";
              return (
                <span
                  key={`${item.id}-${entry.type}-${index}`}
                  className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${badgeStyle}`}
                >
                  {label}
                </span>
              );
            })}
        </div>
      )}
      <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <Button
          size="sm"
          className={cn(
            "h-6 px-2.5 text-[10px] font-bold rounded-md shadow-sm transition-all border-none",
            item.isFlow ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-emerald-500 hover:bg-emerald-400 text-white"
          )}
          onClick={(e) => {
            e.stopPropagation();
            void sendQuickReply(item);
          }}
        >
          <PaperPlaneTilt className="mr-1 h-3 w-3" weight="fill" />
          {item.isFlow ? "Disparar" : "Enviar"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "h-6 w-6 rounded-md transition-colors",
            item.favorite ? "text-amber-500 hover:bg-amber-500/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavoriteQuickReply(item.id);
          }}
          title="Favoritar"
        >
          <Star className="h-3 w-3" weight={item.favorite ? "fill" : "regular"} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            openEditQuickReplyDialog(item);
          }}
          title="Editar"
        >
          <PencilSimple className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            duplicateQuickReply(item);
          }}
          title="Duplicar"
        >
          <CopySimple className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            deleteQuickReply(item.id);
          }}
          title="Excluir"
        >
          <Trash className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  const leadPanelContent = selectedConversation ? (
    <div className="flex h-full w-full flex-col min-h-0 bg-background/95">
      <FlowExecutionBanner flowData={activeFlowData} onCancelFlow={() => setActiveFlowData(null)} />
      <Tabs
        value={rightPanelTab ?? ""}
        onValueChange={(value) => setRightPanelTab(value as RightPanelTabId)}
        className="flex h-full w-full flex-col overflow-y-auto border-none bg-transparent"
      >
        <div className="hidden">
          <div className="flex overflow-x-auto scrollbar-none border-b border-border bg-muted/40 p-1 rounded-lg">
            <TabsList className="flex w-max space-x-1 bg-transparent">
              <TabsTrigger value="ai">IA</TabsTrigger>
              <TabsTrigger value="lead">Lead</TabsTrigger>
              <TabsTrigger value="files">Arquivos</TabsTrigger>
              <TabsTrigger value="qr">Respostas Rápidas</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* ============ TAB IA ============ */}
        <RightPanelSectionTrigger
          active={rightPanelTab === "ai"}
          icon={AIIcon}
          label="IA"
          badges={
            <div className="flex items-center gap-1.5 ml-2">
              <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                <span className={cn("w-1.5 h-1.5 rounded-full", aiEnabledForConversation ? "bg-emerald-500" : "bg-muted-foreground")} />
                {aiEnabledForConversation ? "Online" : "Offline"}
              </span>
              {aiRuntime.globalEnabled && (
                <span className="text-[9px] font-bold border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                  GLOBAL
                </span>
              )}
            </div>
          }
          onSelect={() => setRightPanelTab(rightPanelTab === "ai" ? null : "ai")}
        />
        <TabsContent
          value="ai"
          className="mt-0 max-h-[calc(100vh-270px)] shrink-0 space-y-3 overflow-y-auto p-2 scrollbar-thin animate-fade-in data-[state=inactive]:hidden"
        >
          <InboxSectionBoundary fallbackLabel="Insights IA">
            <div className="rounded-xl border border-border/40 bg-card/25 p-3.5 shadow-sm space-y-4">
              {/* Confiança / Header */}
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-foreground">Análise da IA</h4>
                    <p className="text-[10px] text-muted-foreground">sobre o lead</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5 w-1/3">
                   <div className="flex items-center justify-between w-full">
                     <span className="text-[10px] text-muted-foreground font-medium">Confiança</span>
                     <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                       {aiLiveInsights.confidenceValue > 0 ? `${aiLiveInsights.confidenceValue}%` : "n/d"}
                     </span>
                   </div>
                   <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                     <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${aiLiveInsights.confidenceValue}%` }} />
                   </div>
                </div>
              </div>

              {/* Action */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Ação Sugerida</p>
                <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/30 font-medium">
                  {selectedLead?.next_action === "close_sale"
                    ? "Conduzir o lead para fechamento."
                    : selectedLead?.next_action === "send_price"
                      ? "Enviar valores e esclarecer o retorno esperado."
                      : selectedLead?.next_action === "overcome_objection"
                        ? "Responder a objeção antes de avançar."
                        : "Entender a necessidade e apresentar o próximo passo."}
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 w-full text-xs font-bold gap-2 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white transition-all duration-300 border-none mt-2"
                  onClick={() => void handleSuggestResponse()}
                  disabled={!aiEnabledForConversation || suggestingResponse}
                >
                  <Sparkles className="h-4 w-4" weight="fill" />
                  {suggestingResponse ? "Gerando..." : "Gerar resposta sugerida"}
                </Button>
              </div>

              {/* Data points */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/10">
                <div className="bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Necessidade/Interesse</p>
                  <p className="text-xs font-semibold text-foreground truncate" title={aiLiveInsights.objective}>
                    {aiLiveInsights.objective}
                  </p>
                </div>
                <div className="bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Etapa do Funil</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Workflow className="h-3.5 w-3.5" />
                    <span className="truncate">{selectedConversationFunnelStage}</span>
                  </div>
                </div>
                <div className="bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Sentimento</p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {aiLiveInsights.mood}
                  </p>
                </div>
                <div className="bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Urgência</p>
                  <p className="text-xs font-semibold text-foreground truncate">
                    {aiLiveInsights.urgency}
                  </p>
                </div>
              </div>

              {/* Bullets Resumo */}
              {aiLiveInsights.summary && (
                <div className="space-y-2 pt-2 border-t border-border/10">
                  <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Resumo do atendimento</p>
                  <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/15 p-3">
                    <ul className="space-y-1.5">
                      {aiLiveInsights.summary.split('. ').filter(Boolean).map((sentence, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-foreground/90 leading-relaxed font-medium">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {sentence.trim() + (sentence.endsWith('.') ? '' : '.')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* O que foi conversado */}
              <div className="space-y-2 pt-2 border-t border-border/10">
                <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">O que foi conversado</p>
                {(aiLiveInsights.products || aiLiveInsights.objections || aiLiveInsights.mood) ? (
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {aiLiveInsights.products && <Badge variant="outline" className="bg-muted/30 font-medium border-border/40 text-muted-foreground"><span className="font-semibold text-foreground mr-1">Produto:</span> {aiLiveInsights.products}</Badge>}
                    {aiLiveInsights.objections && <Badge variant="outline" className="bg-muted/30 font-medium border-border/40 text-muted-foreground"><span className="font-semibold text-foreground mr-1">Objeções:</span> {aiLiveInsights.objections}</Badge>}
                    {aiLiveInsights.mood && <Badge variant="outline" className="bg-muted/30 font-medium border-border/40 text-muted-foreground"><span className="font-semibold text-foreground mr-1">Humor:</span> {aiLiveInsights.mood}</Badge>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Não identificado nesta conversa.</p>
                )}
              </div>

              {/* Footer animado */}
              <div className="mt-3 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/90 dark:text-emerald-400/90">
                    IA trabalhando para você
                  </span>
                </div>
                <span className="text-[9px] text-muted-foreground/80 font-medium">Respostas mais rápidas, leads mais qualificados.</span>
              </div>

              {/* Controles e Métricas — integrado no mesmo card */}
              <div className="space-y-2.5 pt-3 border-t border-border/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground/80">Atendimento por IA</span>
                  <Switch
                    checked={aiEnabledForConversation}
                    onCheckedChange={handleSetConversationAiEnabled}
                    disabled={updatingAiToggle}
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground">Agente de IA</span>
                  <select
                    value={(selectedConversation as any)?.ai_agent || ""}
                    onChange={(e) => handleSetConversationAgent && handleSetConversationAgent(e.target.value)}
                    disabled={loadingAgents}
                    className="w-full h-7 rounded-lg border border-border bg-background/50 px-2 text-[11px] outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-foreground"
                  >
                    <option value="" disabled>Selecione um agente</option>
                    {(aiAgents || []).map((agent) => (
                      <option key={agent.name} value={agent.name}>{agent.name}</option>
                    ))}
                  </select>
                </div>

                {aiRuntime.model && (
                  <div className="flex items-center gap-2 bg-muted/20 p-2 rounded-lg border border-border/20">
                    {(() => {
                      const ProviderIcon = getProviderIcon(aiRuntime.provider);
                      return <ProviderIcon className="h-3.5 w-3.5 text-muted-foreground" />;
                    })()}
                    <div className="flex-grow min-w-0">
                      <p className="text-[9px] text-muted-foreground capitalize">{aiRuntime.provider}</p>
                      <p className="text-[10px] font-semibold text-foreground truncate">{aiRuntime.model}</p>
                    </div>
                    {(!((selectedConversation as any)?.assignedAgentName)) && (
                      <span className="text-[8px] bg-muted border border-border/50 px-1 py-0.5 rounded text-muted-foreground font-semibold shrink-0">Padrão</span>
                    )}
                  </div>
                )}

                <details className="group border border-border/20 rounded-lg bg-muted/10">
                  <summary className="text-[10px] font-semibold text-muted-foreground cursor-pointer p-1.5 list-none flex justify-between items-center">
                    Métricas
                    <CaretRight className="h-2.5 w-2.5 transition-transform group-open:rotate-90 text-muted-foreground" />
                  </summary>
                  <div className="px-1.5 pb-1.5 text-[9px] text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>Memória:</span> <span className="font-medium text-foreground">{aiLiveInsights.isFromDb ? "Sincronizada" : "Local"}</span></div>
                    <div className="flex justify-between"><span>Última Resposta:</span> <span className="font-medium text-foreground">{formatRelativeTime(aiRuntime.lastResponseAt || conversationMetrics.lastAiResponseAt)}</span></div>
                    <div className="flex justify-between"><span>Latência:</span> <span className="font-medium text-foreground">{conversationMetrics.lastAiResponseTimeMs ? `${conversationMetrics.lastAiResponseTimeMs}ms` : "N/D"}</span></div>
                    <div className="flex justify-between"><span>Tokens:</span> <span className="font-medium text-foreground">{(aiRuntime.promptTokens || 0) + (aiRuntime.completionTokens || 0)}</span></div>
                  </div>
                </details>
              </div>
            </div>
          </InboxSectionBoundary>
        </TabsContent>

        {/* ============ TAB LEAD (CRM) ============ */}
        <RightPanelSectionTrigger
          active={rightPanelTab === "lead"}
          icon={UserRound}
          label="Lead"
          onSelect={() => setRightPanelTab(rightPanelTab === "lead" ? null : "lead")}
        />
        <TabsContent
          value="lead"
          className="mt-0 max-h-[calc(100vh-270px)] shrink-0 space-y-3 overflow-y-auto p-2 scrollbar-thin animate-fade-in data-[state=inactive]:hidden"
        >
          <InboxSectionBoundary fallbackLabel="Lead CRM">
            <div className="rounded-xl border border-border/40 bg-card/25 p-4 shadow-sm relative space-y-4">
              {/* Header com 3-dots */}
              <div className="absolute top-4 right-4">
                 <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:bg-muted/50">
                   <div className="flex gap-0.5">
                     <span className="w-1 h-1 rounded-full bg-current" />
                     <span className="w-1 h-1 rounded-full bg-current" />
                     <span className="w-1 h-1 rounded-full bg-current" />
                   </div>
                 </Button>
              </div>

              {/* Avatar e Infos */}
              <div className="flex flex-col items-center text-center space-y-2 pt-2">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.15)] overflow-hidden">
                  {selectedConversation?.profilePicUrl || selectedLead?.profilePic || selectedLead?.avatar ? (
                    <img src={selectedConversation?.profilePicUrl || selectedLead?.profilePic || selectedLead?.avatar} alt={selectedConversation.contactName} className="h-full w-full object-cover" />
                  ) : (
                    selectedConversation.contactName?.substring(0,2) || "LD"
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground leading-tight">
                    {selectedConversation.contactName}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span className="text-xs font-mono font-medium">{formatPhoneNumber(selectedConversation.phone)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold mt-1 border border-emerald-500/20">
                  <div className="h-3 w-3 bg-emerald-500" style={{ maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'currentColor\' d=\'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.81 11.81 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z\'%3E%3C/svg%3E")', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center', backgroundColor: 'currentColor', WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'currentColor\' d=\'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.81 11.81 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z\'%3E%3C/svg%3E")', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center' }} />
                  WhatsApp
                </div>
              </div>

              <div className="h-px w-full bg-border/20 my-2" />

              {/* Data points */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                 <div>
                   <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><History className="h-3 w-3" /> Últ. Interação</p>
                   <p className="font-semibold text-foreground">
                      {conversationMetrics.lastInteraction
                        ? new Date(conversationMetrics.lastInteraction).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : "Sem registro"}
                   </p>
                 </div>
                 <div>
                   <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><UserRound className="h-3 w-3" /> Origem</p>
                   <p className="font-semibold text-foreground">{conversationMetrics.leadSource}</p>
                 </div>
              </div>

              {/* Estágio no Funil */}
              <div className="space-y-2 pt-2 border-t border-border/10">
                <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Estágio no Funil</p>
                <select
                  value={selectedConversationFunnelStage}
                  onChange={(e) => void persistConversationMetadata(selectedConversation.id, { funnel_stage: e.target.value })}
                  className="w-full h-9 rounded-xl border border-border bg-background/50 px-3 text-xs outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-foreground/90"
                >
                  {BUSINESS_TAG_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Etiquetas */}
              <div className="space-y-2 pt-2 border-t border-border/10">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Etiquetas</p>
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                    <Sparkles className="h-2.5 w-2.5" /> ✨ IA → automático
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedConversation.tags ?? []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={cn("gap-1 text-[10px] rounded-lg px-2 py-1 border-border/50 transition-colors shadow-sm bg-card", getTagColor(tag))}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTagFromSelectedConversation(tag)}
                        aria-label={`Remover ${tag}`}
                        className="hover:text-destructive hover:scale-110 shrink-0 transition-transform ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {(selectedConversation.tags ?? []).length === 0 && (
                    <span className="text-[11px] text-muted-foreground/80 py-1">Sem etiquetas atribuídas</span>
                  )}
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Input
                    value={newTagInput}
                    onChange={(event) => setNewTagInput(event.target.value)}
                    placeholder="Adicionar etiqueta..."
                    className="h-8 text-xs bg-background/50 rounded-lg border-border focus:border-primary/50"
                    onKeyDown={(event) => event.key === "Enter" && handleAddTagToSelectedConversation()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 px-0 rounded-lg shrink-0 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5"
                    onClick={handleAddTagToSelectedConversation}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Estágio no Funil */}
              <div className="space-y-2 pt-2 border-t border-border/10">
                <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Estágio no Funil</p>
                <select
                  value={selectedConversationFunnelStage}
                  onChange={(event) => {
                    const funnel_stage = event.target.value;
                    setConversations((prev: Conversation[]) =>
                      prev.map((c) =>
                        c.id === selectedConversation.id
                          ? ({ ...c, funnel_stage } as Conversation)
                          : c,
                      ),
                    );
                    void persistConversationMetadata(selectedConversation.id, { funnel_stage });
                    toast({ title: `Lead movido para: ${funnel_stage}` });
                  }}
                  className="h-9 w-full rounded-xl border border-border bg-background/50 px-2.5 text-xs text-foreground/90 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
                >
                  {BUSINESS_TAG_OPTIONS.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>

              {/* Observações */}
              <div className="space-y-2 pt-2 border-t border-border/10">
                <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Observações do Lead</p>
                <textarea
                  value={leadNotes}
                  onChange={(event) => setLeadNotes(event.target.value)}
                  placeholder="Registre contexto importante deste atendimento..."
                  className="min-h-[80px] w-full resize-y rounded-xl border border-border bg-background/50 p-3 text-xs outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-foreground/90 placeholder:text-muted-foreground/60"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 w-full text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 border-none"
                  onClick={() => void handleSaveLeadNotes()}
                >
                  Salvar observações
                </Button>
              </div>
            </div>
          </InboxSectionBoundary>
        </TabsContent>

        {/* ============ TAB RESPOSTAS (QUICK REPLIES) ============ */}
        <RightPanelSectionTrigger
          active={rightPanelTab === "qr"}
          icon={Workflow}
          label="Respostas Rápidas"
          onSelect={() => setRightPanelTab(rightPanelTab === "qr" ? null : "qr")}
        />
        <TabsContent
          value="qr"
          className="mt-0 max-h-[calc(100vh-270px)] shrink-0 space-y-3 overflow-y-auto p-2 scrollbar-thin animate-fade-in data-[state=inactive]:hidden"
        >
          <InboxSectionBoundary fallbackLabel="Quick Replies">
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/75" />
                <Input
                  value={responseSearchQuery}
                  onChange={(event) => setResponseSearchQuery(event.target.value)}
                  placeholder="Buscar resposta..."
                  className="h-9 pl-9 text-xs bg-background/50 border-border rounded-lg focus:border-primary/50"
                />
              </div>
              <Button onClick={openCreateQuickReplyDialog} size="sm" variant="outline" className="h-9 gap-1 rounded-lg px-3 hover:bg-primary/5 hover:text-primary">
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </div>

            <div className="flex flex-wrap gap-1 shrink-0">
              <Button
                size="sm"
                variant={quickReplyCategory === "all" ? "default" : "outline"}
                className="h-6.5 rounded-full px-3 text-[10.5px] font-medium capitalize"
                onClick={() => setQuickReplyCategory("all")}
              >
                Todas
              </Button>
              {allCategories.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={quickReplyCategory === cat ? "default" : "outline"}
                  className="h-6.5 rounded-full px-3 text-[10.5px] font-medium capitalize"
                  onClick={() => setQuickReplyCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>

            {favoriteQuickReplies.length > 0 && (
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 shadow-sm space-y-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-500">
                  <Star className="h-4 w-4" weight="fill" /> Favoritas
                </p>
                <div className="space-y-3">{favoriteQuickReplies.map(renderQuickReplyRow)}</div>
              </div>
            )}

            <Accordion type="multiple" defaultValue={allCategories} className="space-y-2">
              {allCategories.map((cat) => {
                const items = quickRepliesByCategory[cat] ?? [];
                if (items.length === 0) return null;
                return (
                  <AccordionItem
                    key={cat}
                    value={cat}
                    className="rounded-xl border border-border/40 bg-card/25 px-1 overflow-hidden transition-all duration-200 hover:border-emerald-500/30 hover:bg-card/45 shadow-sm"
                  >
                    <AccordionTrigger className="py-2.5 px-3 text-[13px] font-bold capitalize hover:no-underline text-foreground">
                      <span className="flex items-center gap-2">
                        {cat}
                        <Badge variant="secondary" className="h-5 px-2 text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                          {items.length}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 px-3 pb-3">
                      {items.map(renderQuickReplyRow)}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>

            {filteredQuickReplies.length === 0 && (
              <p className="text-center text-xs text-muted-foreground/80 py-4">Nenhuma resposta cadastrada ou encontrada.</p>
            )}
          </InboxSectionBoundary>
        </TabsContent>

        {/* ============ TAB HISTÓRICO (TIMELINE) ============ */}
        <RightPanelSectionTrigger
          active={rightPanelTab === "history"}
          icon={History}
          label="Histórico"
          onSelect={() => setRightPanelTab(rightPanelTab === "history" ? null : "history")}
        />
        <TabsContent
          value="history"
          className="mt-0 max-h-[calc(100vh-270px)] shrink-0 space-y-3 overflow-y-auto p-2 scrollbar-thin animate-fade-in data-[state=inactive]:hidden"
        >
          <InboxSectionBoundary fallbackLabel="Histórico">
            <div className="rounded-xl border border-border/40 bg-card/25 p-4 shadow-sm relative">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-foreground">Linha do tempo</p>
              </div>
              <div className="relative pl-5 border-l-2 border-border/40 ml-2.5 space-y-5 text-xs">
                {conversationTimeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground/75 py-2">
                    Ainda não há eventos cadastrados neste histórico.
                  </p>
                ) : (
                  conversationTimeline.map((evt) => {
                    const isReceived = evt.title.toLowerCase().includes("recebida");
                    const isSystem = evt.title.toLowerCase().includes("atualizado");
                    const ringColor = isSystem ? "ring-purple-500/20 bg-purple-500" : isReceived ? "ring-emerald-500/20 bg-emerald-500" : "ring-blue-500/20 bg-blue-500";
                    return (
                      <div key={evt.id} className="relative group p-1.5 rounded-lg hover:bg-muted/20 hover:border-l-emerald-500/30 hover:-translate-y-px transition-all duration-200 -ml-1.5 border-l border-transparent">
                        <span className={cn("absolute -left-[22.5px] top-2.5 h-2.5 w-2.5 rounded-full ring-4 transition-transform group-hover:scale-125 duration-300", ringColor)} />
                        <div className="flex items-center justify-between gap-2">
                          <div
                            onClick={() => toggleTimelineItem(evt.id)}
                            className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-500 transition-colors flex-grow min-w-0"
                          >
                            <CaretRight
                              className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 shrink-0",
                                expandedTimeline.has(evt.id) ? "rotate-90 text-emerald-500" : "rotate-0"
                              )}
                            />
                            {isSystem ? (
                              <Brain className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                            ) : isReceived ? (
                              <EnvelopeSimple className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <PaperPlaneTilt className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            )}
                            <span className="font-bold text-[11px] text-foreground/90 truncate uppercase tracking-wider">{evt.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground/70 font-mono font-medium bg-muted/40 px-1.5 py-0.5 rounded-md">
                              {formatTime(evt.timestamp)}
                            </span>
                            {onSaveTimelineToMemory && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 p-0 rounded-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onSaveTimelineToMemory(evt);
                                }}
                                title="Salvar na Memória"
                              >
                                <Star className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className={cn(
                          "mt-2 text-muted-foreground/80 pl-5 text-[11px] leading-relaxed transition-all duration-300 overflow-hidden",
                          expandedTimeline.has(evt.id) ? "max-h-[500px] opacity-100 bg-muted/20 p-2 rounded-lg border border-border/40" : "max-h-6 opacity-80 line-clamp-1"
                        )}>
                          {evt.description}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {conversationTimeline.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/10 text-center">
                  <a href="#" className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors flex items-center justify-center gap-1 group">
                    Ver histórico completo 
                    <CaretRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              )}
            </div>
          </InboxSectionBoundary>
        </TabsContent>

        {/* ============ TAB ARQUIVOS (GALLERY) ============ */}
        <RightPanelSectionTrigger
          active={rightPanelTab === "files"}
          icon={Folder}
          label="Arquivos"
          onSelect={() => setRightPanelTab(rightPanelTab === "files" ? null : "files")}
        />
        <TabsContent
          value="files"
          className="mt-0 max-h-[calc(100vh-270px)] shrink-0 space-y-3 overflow-y-auto p-2 scrollbar-thin animate-fade-in data-[state=inactive]:hidden"
        >
          <InboxSectionBoundary fallbackLabel="Arquivos">
            <div className="rounded-xl border border-border/40 bg-card/25 p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground font-display">Mídias Compartilhadas</p>
              </div>

              {/* Barra de armazenamento fictícia (visual requirement) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                  <span>Armazenamento da conversa</span>
                  <span>1.2 GB de 5 GB — 24%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[24%]" />
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { value: "all", label: "Todos", icon: Folder },
                      { value: "image", label: "Imagens", icon: FileIcon },
                      { value: "video", label: "Vídeos", icon: Waveform },
                      { value: "document", label: "Docs", icon: Paperclip },
                    ] as const
                  ).map((option) => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.value}
                        size="sm"
                        variant={fileFilter === option.value ? "default" : "outline"}
                        className={cn(
                          "h-6 rounded-full px-2 text-[10px] font-semibold flex items-center gap-1 transition-all",
                          fileFilter === option.value ? "bg-emerald-500 text-white border-none shadow-sm" : "bg-card text-muted-foreground hover:bg-muted/50 border-border/50"
                        )}
                        onClick={() => setFileFilter(option.value)}
                      >
                        <Icon className="h-3 w-3" />
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground">
                    <MagnifyingGlass className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground">
                    <ArrowsDownUp className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Área drag & drop fictícia (visual requirement) */}
              <div className="border-2 border-dashed border-border/50 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 bg-muted/10 hover:bg-muted/20 hover:border-emerald-500/30 transition-all cursor-pointer">
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <DownloadSimple className="h-4 w-4 text-emerald-500 rotate-180" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground/90">Clique ou arraste arquivos</p>
                  <p className="text-[10px] text-muted-foreground">Tamanho máximo: 50MB</p>
                </div>
              </div>

              {(() => {
                const mediaMessages = messages.filter((message) => {
                  const mediaType =
                    message.mediaType ??
                    inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? ""));
                  return Boolean(extractMessageAssetUrl(message) || mediaType);
                });

                const filteredMedia = mediaMessages.filter((message) => {
                  const mediaType =
                    message.mediaType ??
                    inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? ""));
                  if (fileFilter === "all") return true;
                  if (fileFilter === "image") return mediaType === "image" || mediaType === "sticker";
                  if (fileFilter === "video") return mediaType === "video";
                  if (fileFilter === "document") return mediaType === "file" || mediaType === "audio";
                  return true;
                });

                if (filteredMedia.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground/70 text-center py-8 bg-muted/20 rounded-xl border border-border/30">
                      Nenhuma mídia encontrada com este filtro.
                    </p>
                  );
                }

                const visibleMedia = filteredMedia.slice(0, 6);
                const hasMore = filteredMedia.length > 6;

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {visibleMedia.map((msg) => (
                        <SharedMediaCard
                          key={msg.id}
                          message={msg}
                          onOpenMediaPreview={handleOpenMediaPreview}
                          onDownloadMedia={handleDownloadMedia}
                          onAttachMedia={onAttachMedia}
                        />
                      ))}
                    </div>
                    {hasMore && (
                      <Button variant="outline" className="w-full h-8 text-[11px] font-bold border-border/50 hover:bg-muted/50 rounded-xl">
                        +{filteredMedia.length - 6} Ver todos
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          </InboxSectionBoundary>
        </TabsContent>
      </Tabs>
    </div>
  ) : (
    <div className="text-sm text-muted-foreground p-4">Selecione uma conversa para ver detalhes.</div>
  );

  if (isDrawer) {
    return <div className="h-full w-full flex flex-col min-h-0 overflow-y-auto">{leadPanelContent}</div>;
  }

  return (
    <aside
      className={cn(
        "min-h-0 border-l border-border bg-card/40 transition-[width,padding] duration-300 ease-out h-full shrink-0",
        isTabletLayout ? "hidden" : "hidden lg:flex lg:flex-col",
        rightPanelCollapsed
          ? "lg:w-[60px] lg:min-w-[60px] lg:max-w-[60px] lg:p-1.5"
          : "lg:w-[320px] lg:overflow-auto lg:p-4",
      )}
    >
      {rightPanelCollapsed ? (
        <div className="flex h-full w-full flex-col items-center gap-3.5 pt-3.5 shrink-0">
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 transition-all duration-200 hover:bg-muted/40 hover:text-foreground rounded-lg"
                  onClick={() => setRightPanelCollapsed(false)}
                  aria-label="Expandir painel"
                >
                  <CaretLeft className="h-4.5 w-4.5 shrink-0" weight="bold" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Expandir painel</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="my-0.5 h-px w-6 bg-border/40 shrink-0" />
          <TooltipProvider delayDuration={120}>
            {RIGHT_PANEL_SECTIONS.map((section) => (
              <Tooltip key={section.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-9.5 w-9.5 shrink-0 rounded-xl text-muted-foreground transition-all duration-200 hover:scale-[1.05] hover:bg-muted/30 hover:text-primary",
                      rightPanelTab === section.id && "bg-primary/10 text-primary border border-primary/20 shadow-sm",
                    )}
                    onClick={() => {
                      setRightPanelTab(section.id);
                      setRightPanelCollapsed(false);
                    }}
                    aria-label={section.label}
                  >
                    <section.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{section.label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col">
          <div className="mb-2 flex items-center justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg transition-all"
              onClick={() => setRightPanelCollapsed(true)}
              title="Recolher painel (Alt+B)"
            >
              <CaretRight className="h-4 w-4" weight="bold" />
            </Button>
          </div>
          <div className="min-h-0 flex-1">{leadPanelContent}</div>
        </div>
      )}
    </aside>
  );
}
