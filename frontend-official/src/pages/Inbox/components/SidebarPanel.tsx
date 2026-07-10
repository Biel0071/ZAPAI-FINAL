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
} from "@phosphor-icons/react";
import { Folder, History, UserRound, Workflow, type LucideIcon, Sparkles, Cpu, Bot, Brain } from "lucide-react";
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
}: {
  message: ChatMessage;
  onOpenMediaPreview: (media: PreviewMediaState) => void;
  onDownloadMedia: (message: ChatMessage) => void;
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
    <div className="group rounded-xl border border-border/30 bg-card/20 p-2.5 transition-all duration-300 hover:border-primary/30 hover:bg-card/40 hover:shadow-sm">
      <div className="relative aspect-square w-full flex items-center justify-center overflow-hidden rounded-lg border border-border/20 bg-muted/30">
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
      </div>
      <div className="mt-2.5 space-y-0.5">
        <p className="truncate text-[11px] font-semibold text-foreground/90" title={fileName}>{fileName}</p>
        <p className="truncate text-[10px] text-muted-foreground/80">
          {getMediaTypeLabel(mediaType)} • {assetSize ? formatFileSize(assetSize) : "Tamanho n/d"}
        </p>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 flex-1 text-[10px] rounded-lg bg-background/50 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
          className="h-7 flex-1 text-[10px] rounded-lg bg-background/50 hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
}: {
  active: boolean;
  icon: ComponentType<any>;
  label: string;
  onSelect: () => void;
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-[46px] w-full shrink-0 items-center justify-between px-4 text-left text-xs font-semibold tracking-wide transition-all duration-200 border-b",
        active
          ? "bg-primary/[0.04] text-primary border-b-border/50 border-l-[3px] border-l-primary"
          : "bg-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground border-b-border/30 border-l-[3px] border-l-transparent",
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-muted-foreground")} strokeWidth={2} aria-hidden />
        {label}
      </span>
      <CaretRight
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200 ease-in-out",
          active && "rotate-90 text-primary"
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
}: SidebarPanelProps) {
  const { toast } = useToast();
  const [fileFilter, setFileFilter] = useState<"all" | "image" | "video" | "file">("all");
  const [expandedTimeline, setExpandedTimeline] = useState<Set<string>>(new Set());

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
            : "Sem objeções identificadas",
      objective: conversationMetrics.objective,
      summary: conversationMetrics.summary,
      tags: conversationMetrics.tags,
      metrics: conversationMetrics.metrics,
      totalMessages: conversationMetrics.messagesExchanged,
      lastUpdated: conversationMetrics.lastAiUpdate,
      isFromDb: Boolean(aiMemory?.summary || aiMemory?.metrics || aiMemory?.last_updated),
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
      className="group rounded-xl border border-border/40 bg-card/20 p-3 transition-all duration-200 hover:border-primary/40 hover:bg-card/40 hover:shadow-sm cursor-pointer active:scale-[0.99] select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-xs text-foreground/90 truncate flex-grow flex items-center gap-1.5">
          {item.isFlow && (
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] px-1 py-0.2 h-[15px] leading-none font-bold shrink-0">
              Fluxo
            </Badge>
          )}
          <span className="truncate">{item.title || getQuickReplyPreviewText(item, conversationVariableContext).split("\n")[0]}</span>
        </h4>
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-0.5 max-w-[45%] overflow-hidden shrink-0">
            {item.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[8px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 scale-90"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground mt-1">
        {getQuickReplyPreviewText(item, conversationVariableContext)}
      </p>
      {item.items && item.items.some((entry) => entry.type !== "text") && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.items
            .filter((entry) => entry.type !== "text")
            .map((entry, index) => {
              const type = entry.type === "pdf" ? "document" : entry.type;
              const badgeStyle = 
                type === "image" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" :
                type === "video" ? "bg-rose-500/10 text-rose-400 border border-rose-500/25" :
                type === "audio" ? "bg-amber-500/10 text-amber-400 border border-amber-500/25" :
                type === "document" || type === "file" ? "bg-sky-500/10 text-sky-400 border border-sky-500/25" :
                "bg-slate-500/10 text-slate-400 border border-slate-500/25";
              const label = 
                type === "image" ? "IMAGEM" :
                type === "video" ? "VÍDEO" :
                type === "audio" ? "ÁUDIO" :
                type === "document" || type === "file" ? "DOCUMENTO" : "MÍDIA";
              return (
                <span
                  key={`${item.id}-${entry.type}-${index}`}
                  className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider ${badgeStyle}`}
                >
                  {label}
                </span>
              );
            })}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <Button
          size="sm"
          className={cn(
            "h-7 flex-grow text-[10.5px] font-semibold rounded-lg shadow-sm transition-all",
            item.isFlow ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          onClick={(e) => {
            e.stopPropagation();
            void sendQuickReply(item);
          }}
        >
          {item.isFlow ? (
            <>
              <PaperPlaneTilt className="mr-1 h-3.5 w-3.5" weight="fill" /> Disparar
            </>
          ) : (
            <>
              <PaperPlaneTilt className="mr-1 h-3.5 w-3.5" weight="fill" /> Enviar
            </>
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavoriteQuickReply(item.id);
          }}
          title="Favoritar"
        >
          <Star
            className={cn("h-3.5 w-3.5", item.favorite ? "text-warning" : "text-muted-foreground")}
            weight={item.favorite ? "fill" : "regular"}
          />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            openEditQuickReplyDialog(item);
          }}
          title="Editar"
        >
          <PencilSimple className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            duplicateQuickReply(item);
          }}
          title="Duplicar"
        >
          <CopySimple className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            deleteQuickReply(item.id);
          }}
          title="Excluir"
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  const leadPanelContent = selectedConversation ? (
    <div className="flex h-full w-full flex-col overflow-hidden">
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
          onSelect={() => setRightPanelTab(rightPanelTab === "ai" ? null : "ai")}
        />
        <TabsContent
          value="ai"
          className="mt-0 max-h-[calc(100vh-270px)] shrink-0 space-y-3 overflow-y-auto p-2 scrollbar-thin animate-fade-in data-[state=inactive]:hidden"
        >
          <InboxSectionBoundary fallbackLabel="Insights IA">
            <Accordion type="multiple" defaultValue={["ai-status", "ai-action", "ai-analysis"]} className="space-y-2">
              <AccordionItem
                value="ai-status"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-2.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Status e modelo
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3">
                  <div className="space-y-2.5 text-[11px]">
                    <div className="flex items-center justify-between py-1.5 border-b border-border/10">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", aiEnabledForConversation ? "bg-emerald-500" : "bg-neutral-500")} />
                        <span className="font-semibold text-foreground/90">
                          {aiEnabledForConversation ? "IA Ativa nesta conversa" : "IA Pausada nesta conversa"}
                        </span>
                      </div>
                      <Badge variant="outline" className="h-4.5 rounded-full px-2 text-[8px] uppercase tracking-wider font-semibold border-border/60">
                        {!aiRuntime.globalEnabled
                          ? "Global off"
                          : !conversationAiOverrideEnabled
                            ? "Conversa off"
                            : "Global"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <div className="rounded-lg border border-border/30 bg-background/40 p-2 text-center transition-all hover:bg-background/80">
                        <span className="block text-muted-foreground text-[8px] uppercase tracking-wider font-semibold">Modelo</span>
                        <span className="font-semibold text-foreground text-[10px] truncate block mt-0.5" title={aiRuntime.model}>
                          {aiRuntime.loading ? "..." : aiRuntime.model}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border/30 bg-background/40 p-2 text-center transition-all hover:bg-background/80 flex flex-col justify-center items-center">
                        {(() => {
                          const IconComp = getProviderIcon(aiRuntime.provider);
                          return <IconComp className="h-3 w-3 text-muted-foreground/80 mb-0.5 shrink-0" />;
                        })()}
                        <span className="block text-muted-foreground text-[8px] uppercase tracking-wider font-semibold">Provedor</span>
                        <span className="font-semibold text-foreground text-[10px] truncate block mt-0.5" title={aiRuntime.provider}>
                          {aiRuntime.loading ? "..." : aiRuntime.provider}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border/30 bg-background/40 p-2 text-center transition-all hover:bg-background/80">
                        <span className="block text-muted-foreground text-[8px] uppercase tracking-wider font-semibold">Última Resp.</span>
                        <span className="font-semibold text-foreground text-[10px] truncate block mt-0.5">
                          {aiRuntime.lastResponseAt ? formatTime(aiRuntime.lastResponseAt) : "Sem registro"}
                        </span>
                      </div>
                    </div>

                    {/* Collapsible details for secondary metrics */}
                    <details className="mt-2 text-xs group">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-[10px] select-none list-none flex items-center gap-1 font-semibold py-1">
                        <CaretRight className="h-3 w-3 transition-transform duration-200 group-open:rotate-90 text-muted-foreground" />
                        Mais Métricas
                      </summary>
                      <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-border/10">
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/40 border border-border/20">
                          <span className="text-[10px] text-muted-foreground">Memória</span>
                          <span className="font-semibold text-foreground text-[10px]">{aiRuntime.memoryEnabled ? "Ativa" : "Off"}</span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/40 border border-border/20">
                          <span className="text-[10px] text-muted-foreground">Latência</span>
                          <span className="font-semibold text-foreground text-[10px]">
                            {formatDurationMs(aiRuntime.lastResponseTimeMs)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/40 border border-border/20">
                          <span className="text-[10px] text-muted-foreground">Prompt Tkn</span>
                          <span className="font-semibold tabular-nums text-foreground text-[10px]">
                            {aiRuntime.promptTokens}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/40 border border-border/20">
                          <span className="text-[10px] text-muted-foreground">Output Tkn</span>
                          <span className="font-semibold tabular-nums text-foreground text-[10px]">
                            {aiRuntime.completionTokens}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-background/40 border border-border/20 col-span-2">
                          <span className="text-[10px] text-muted-foreground">Total Tokens</span>
                          <span className="font-semibold tabular-nums text-foreground text-[10px]">
                            {aiRuntime.promptTokens + aiRuntime.completionTokens}
                          </span>
                        </div>
                      </div>
                    </details>

                    <div className="mt-3.5 space-y-1.5 border-t border-border/10 pt-3">
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">Atendente Designado</span>
                      <select
                        value={selectedConversation?.assignedAgentName ?? ""}
                        onChange={(e) => handleSetConversationAgent?.(e.target.value)}
                        className="flex h-8.5 w-full rounded-lg border border-border bg-background/50 px-2.5 py-1 text-xs transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-foreground"
                      >
                        {loadingAgents ? (
                          <option>Carregando atendentes...</option>
                        ) : (
                          <>
                            <option value="">Não atribuído</option>
                            {selectedConversation?.assignedAgentName && !aiAgents.some((a: any) => a.name === selectedConversation.assignedAgentName) && (
                              <option value={selectedConversation.assignedAgentName}>
                                {selectedConversation.assignedAgentName}
                              </option>
                            )}
                            {aiAgents.map((agent: any) => (
                              <option key={agent.key || agent.name} value={agent.name}>
                                {agent.name}{agent.active === false ? " (Inativo)" : ""}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="ai-action"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-2.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Ação recomendada
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 space-y-2.5 text-xs">
                  <p className="leading-relaxed text-muted-foreground/95">
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
                    className="h-8 w-full text-xs font-semibold gap-1.5 rounded-lg shadow-sm bg-gradient-to-r from-primary to-primary-hover hover:opacity-95 text-primary-foreground"
                    onClick={() => void handleSuggestResponse()}
                    disabled={!aiEnabledForConversation || suggestingResponse}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {suggestingResponse ? "Gerando..." : "Gerar resposta sugerida"}
                  </Button>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="ai-analysis"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-2.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Análise do Lead
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Intenção:</span>
                    <span className="font-semibold text-foreground">{aiLiveInsights.objective}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Produtos:</span>
                    <span className="font-semibold text-foreground">{aiLiveInsights.products}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Objeções:</span>
                    <span className="font-semibold text-foreground">{aiLiveInsights.objections}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Funil:</span>
                    <span className="font-semibold text-foreground">{selectedConversationFunnelStage}</span>
                  </div>
                  {aiLiveInsights.summary && (
                    <div className="mt-2.5 rounded-lg bg-primary/[0.02] border border-primary/15 p-2.5 leading-relaxed text-foreground/90 text-[11px] italic relative">
                      <Brain className="absolute right-2 top-2 h-3.5 w-3.5 text-primary/20 shrink-0" />
                      {aiLiveInsights.summary}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
            <Accordion type="multiple" defaultValue={["lead-contact", "lead-tags", "lead-funnel", "lead-notes"]} className="space-y-2">
              <AccordionItem
                value="lead-contact"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-2.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Dados do contato
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 space-y-2.5 text-[11px]">
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Nome</span>
                    <span className="font-semibold text-foreground">{selectedConversation.contactName}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Telefone</span>
                    <span className="break-all font-mono font-semibold text-foreground/90">
                      {formatPhoneNumber(selectedConversation.phone)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Origem</span>
                    <span className="font-semibold text-foreground">{conversationMetrics.leadSource}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Última interação</span>
                    <span className="font-semibold text-foreground">
                      {conversationMetrics.lastInteraction
                        ? new Date(conversationMetrics.lastInteraction).toLocaleString("pt-BR")
                        : "Sem registro"}
                    </span>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="lead-tags"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-2.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Etiquetas
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedConversation.tags ?? []).map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={cn("gap-1 text-[10px] rounded-lg px-2 py-0.5 transition-colors hover:bg-destructive/10 hover:text-destructive", getTagColor(tag))}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTagFromSelectedConversation(tag)}
                          aria-label={`Remover ${tag}`}
                          className="hover:scale-105 shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {(selectedConversation.tags ?? []).length === 0 && (
                      <span className="text-[11px] text-muted-foreground/80">Sem etiquetas atribuídas</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Input
                      value={newTagInput}
                      onChange={(event) => setNewTagInput(event.target.value)}
                      placeholder="Nova etiqueta..."
                      className="h-8.5 text-xs bg-background/50 rounded-lg border-border focus:border-primary/50"
                      onKeyDown={(event) => event.key === "Enter" && handleAddTagToSelectedConversation()}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8.5 w-8.5 px-0 rounded-lg shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
                      onClick={handleAddTagToSelectedConversation}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="lead-funnel"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-2.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Estágio no Funil
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3">
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
                    className="h-8.5 w-full rounded-lg border border-border bg-background/50 px-2.5 text-xs text-foreground/90 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  >
                    {BUSINESS_TAG_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="lead-notes"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-2.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Observações
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 space-y-2.5">
                  <textarea
                    value={leadNotes}
                    onChange={(event) => setLeadNotes(event.target.value)}
                    placeholder="Registre contexto importante deste atendimento..."
                    className="min-h-24 w-full resize-y rounded-lg border border-border bg-background/50 p-2.5 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    onClick={() => void handleSaveLeadNotes()}
                  >
                    Salvar observações
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
              <div className="rounded-xl border border-border/40 bg-card/25 p-3 shadow-sm space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                  <Star className="h-3.5 w-3.5 text-warning" weight="fill" /> Favoritas
                </p>
                <div className="space-y-2">{favoriteQuickReplies.map(renderQuickReplyRow)}</div>
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
                    className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
                  >
                    <AccordionTrigger className="py-2.5 px-3.5 text-xs font-bold capitalize hover:no-underline text-foreground">
                      <span className="flex items-center gap-2">
                        {cat}
                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-muted/60 font-semibold text-muted-foreground">
                          {items.length}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 px-3.5 pb-3">
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
            <div className="rounded-xl border border-border/40 bg-card/25 p-3.5 shadow-sm">
              <p className="mb-3.5 text-xs font-semibold text-foreground/90">Linha do tempo</p>
              <div className="relative pl-4 border-l border-border ml-2 space-y-4 text-xs">
                {conversationTimeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground/75 py-2">
                    Ainda não há eventos cadastrados neste histórico.
                  </p>
                ) : (
                  conversationTimeline.map((evt) => (
                    <div key={evt.id} className="relative group">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary/70 ring-4 ring-background transition-transform group-hover:scale-125 duration-150" />
                      <div className="flex items-center justify-between gap-2">
                        <div
                          onClick={() => toggleTimelineItem(evt.id)}
                          className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors flex-grow min-w-0"
                        >
                          <CaretRight
                            className={cn(
                              "h-3 w-3 text-muted-foreground transition-transform duration-200 shrink-0",
                              expandedTimeline.has(evt.id) ? "rotate-90 text-primary" : "rotate-0"
                            )}
                          />
                          <span className="font-semibold text-foreground/90 truncate">{evt.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            {formatTime(evt.timestamp)}
                          </span>
                          {onSaveTimelineToMemory && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onSaveTimelineToMemory(evt);
                              }}
                              title="Salvar na Memória"
                            >
                              <Star className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className={cn("text-muted-foreground/80 mt-1 transition-all duration-200 pl-4 text-[11px] leading-relaxed", expandedTimeline.has(evt.id) ? "" : "line-clamp-1")}>
                        {evt.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
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
            <div className="rounded-xl border border-border/40 bg-card/25 p-3.5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-foreground/90 font-display">Mídias Compartilhadas</p>
              
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { value: "all", label: "Todos" },
                    { value: "image", label: "Imagens" },
                    { value: "video", label: "Vídeos" },
                    { value: "document", label: "Docs" },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={fileFilter === option.value ? "default" : "outline"}
                    className="h-6 rounded-full px-2.5 text-[10px]"
                    onClick={() => setFileFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
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
                    <p className="text-xs text-muted-foreground/70 text-center py-6">
                      Nenhuma mídia encontrada com este filtro.
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredMedia.map((msg) => (
                      <SharedMediaCard
                        key={msg.id}
                        message={msg}
                        onOpenMediaPreview={handleOpenMediaPreview}
                        onDownloadMedia={handleDownloadMedia}
                      />
                    ))}
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
