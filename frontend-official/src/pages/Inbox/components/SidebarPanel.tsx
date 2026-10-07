import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  DollarSign,
  Download,
  Eye,
  FileText,
  Filter,
  Flame,
  Folder,
  Handshake,
  HelpCircle,
  History,
  Image,
  Layers,
  Lightbulb,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Package,
  Paperclip,
  Pencil,
  Phone,
  Pin,
  Plus,
  Rocket,
  Search,
  Send,
  Shield,
  ShoppingBag,
  Star,
  Store,
  Tag,
  Target,
  Trash2,
  UserRound,
  Video,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowClockwise } from "@phosphor-icons/react";
import { useResolvedAvatar } from "@/hooks/useResolvedAvatar";
import { TagIconBadge } from "@/components/inbox/TagIconBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InboxSectionBoundary } from "@/components/system/InboxSectionBoundary";
import { useProtectedMediaUrl } from "@/core/runtime/hooks/useProtectedMediaUrl";
import type { ChatMessage, Conversation } from "@/core/services/apiService";
import type { AiMemoryRecord, InboxAiRuntime, PreviewMediaState, QuickReplyCategoryAppearance, QuickReplyItem } from "../types";
import {
  extractMessageAssetUrl,
  formatPhoneNumber,
  getConversationSourceLabel,
  getInitials,
  getMediaFileName,
  getMediaTypeLabel,
  getMessageStatusMeta,
  getQuickReplyPreviewText,
  getTagColor,
  inferMediaTypeFromSource,
  sanitizeSidebarText,
  sortMessagesAsc,
} from "../utils";
import { cn } from "@/core/lib/utils";
import { QuickResponseModal } from "./QuickResponseModal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  suggestingResponse: boolean;
  handleSuggestResponse: () => Promise<void>;
  messages: ChatMessage[];
  aiMemory: AiMemoryRecord | null;
  leadNotes: string;
  setLeadNotes: (val: string) => void;
  handleSaveLeadNotes: () => Promise<void>;
  newTagInput: string;
  setNewTagInput: (val: string) => void;
  handleAddTagToSelectedConversation: () => void;
  handleRemoveTagFromSelectedConversation: (tag: string) => void;
  updatingAiToggle: boolean;
  handleSetConversationAiEnabled: (val: boolean) => Promise<void>;
  responseSearchQuery: string;
  setResponseSearchQuery: (val: string) => void;
  quickReplies: QuickReplyItem[];
  quickReplyCategoryAppearance?: QuickReplyCategoryAppearance;
  quickReplyCategoryAppearanceError?: boolean;
  onRetryQuickReplyCategoryAppearance?: () => Promise<void>;
  saveQuickReplyCategoryAppearance?: (category: string, appearance: { emoji: string; color: string }) => Promise<void>;
  quickRepliesLoading?: boolean;
  quickRepliesError?: boolean;
  sending: boolean;
  openCreateQuickReplyDialog: () => void;
  quickReplyCategory: string;
  setQuickReplyCategory: (val: string) => void;
  sendQuickReply: (item: QuickReplyItem, delayMs?: number) => Promise<void>;
  toggleFavoriteQuickReply: (id: string) => void;
  openEditQuickReplyDialog: (item: QuickReplyItem) => void;
  duplicateQuickReply: (item: QuickReplyItem) => void;
  deleteQuickReply: (id: string) => void;
  setMessageInput: (val: string) => void;
  handleOpenMediaPreview: (media: PreviewMediaState) => void;
  handleDownloadMedia: (message: ChatMessage) => void;
  aiAgents?: Array<{ id?: string; name: string; active?: boolean }>;
  loadingAgents?: boolean;
  handleSetConversationAgent?: (agentName: string) => Promise<void> | void;
  isDrawer?: boolean;
  onClose?: () => void;
  onAttachMedia?: (message: ChatMessage) => void;
  isWhatsappConnected?: boolean;
}

const SECTIONS = [
  { id: "ai", label: "Atendimento", fullLabel: "Atendimento", icon: MessageSquare },
  { id: "qr", label: "Respostas", fullLabel: "Respostas Rápidas", icon: Zap },
  { id: "files", label: "Arquivos", fullLabel: "Arquivos", icon: Folder },
  { id: "history", label: "Histórico", fullLabel: "Histórico", icon: History },
] as const;

const PRESET_CATEGORY_EMOJIS = ["📁", "⚡", "💬", "🏷️", "🎯", "🚀", "💰", "📦", "⭐", "📌", "💡", "🛡️", "🔔", "📞", "🤝", "🔥"];

const PRESET_CATEGORY_ICONS = [
  { key: "📁", name: "Pasta", icon: Folder },
  { key: "⚡", name: "Raio", icon: Zap },
  { key: "💬", name: "Mensagem", icon: MessageSquare },
  { key: "🏷️", name: "Etiqueta", icon: Tag },
  { key: "🎯", name: "Alvo", icon: Target },
  { key: "🚀", name: "Foguete", icon: Rocket },
  { key: "💰", name: "Vendas", icon: DollarSign },
  { key: "📦", name: "Produto", icon: Package },
  { key: "⭐", name: "Destaque", icon: Star },
  { key: "📌", name: "Fixado", icon: Pin },
  { key: "💡", name: "Dica", icon: Lightbulb },
  { key: "🛡️", name: "Garantia", icon: Shield },
  { key: "🔔", name: "Aviso", icon: Bell },
  { key: "📞", name: "Contato", icon: Phone },
  { key: "🤝", name: "Acordo", icon: Handshake },
  { key: "🔥", name: "Urgente", icon: Flame },
  { key: "🛍️", name: "Loja", icon: ShoppingBag },
  { key: "📑", name: "Documento", icon: Layers },
];

const MONOCHROME_CATEGORY_ICONS_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "📁": Folder,
  folder: Folder,
  "⚡": Zap,
  zap: Zap,
  "💬": MessageSquare,
  chat: MessageSquare,
  "🏷️": Tag,
  tag: Tag,
  "🎯": Target,
  target: Target,
  "🚀": Rocket,
  rocket: Rocket,
  "💰": DollarSign,
  dollar: DollarSign,
  "📦": Package,
  package: Package,
  "⭐": Star,
  star: Star,
  "📌": Pin,
  pin: Pin,
  "💡": Lightbulb,
  bulb: Lightbulb,
  "🛡️": Shield,
  shield: Shield,
  "🔔": Bell,
  bell: Bell,
  "📞": Phone,
  phone: Phone,
  "🤝": Handshake,
  handshake: Handshake,
  "🔥": Flame,
  fire: Flame,
  "🛍️": ShoppingBag,
  shop: ShoppingBag,
  "🏪": Store,
  store: Store,
  "📑": Layers,
  layers: Layers,
  "❓": HelpCircle,
  help: HelpCircle,
  "✅": CheckCircle2,
  check: CheckCircle2,
};

function CategoryMonochromeIcon({
  iconOrEmoji,
  className = "h-4 w-4 shrink-0",
  style,
}: {
  iconOrEmoji?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const clean = String(iconOrEmoji || "📁").trim();
  const IconComponent =
    MONOCHROME_CATEGORY_ICONS_MAP[clean] ||
    MONOCHROME_CATEGORY_ICONS_MAP[clean.toLowerCase()] ||
    Folder;
  return <IconComponent className={className} style={style} />;
}
const PRESET_CATEGORY_COLORS = [
  { name: "Esmeralda", hex: "#10b981" },
  { name: "Verde", hex: "#16a34a" },
  { name: "Azul", hex: "#3b82f6" },
  { name: "Índigo", hex: "#6366f1" },
  { name: "Roxo", hex: "#a855f7" },
  { name: "Rosa", hex: "#ec4899" },
  { name: "Âmbar", hex: "#f59e0b" },
  { name: "Laranja", hex: "#f97316" },
  { name: "Vermelho", hex: "#ef4444" },
  { name: "Ardósia", hex: "#64748b" },
];

function SharedMediaCard({
  message,
  onOpen,
  onDownload,
  onAttach,
}: {
  message: ChatMessage;
  onOpen: (media: PreviewMediaState) => void;
  onDownload: (message: ChatMessage) => void;
  onAttach?: (message: ChatMessage) => void;
}) {
  const rawUrl = extractMessageAssetUrl(message);
  const mediaUrl = useProtectedMediaUrl(rawUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [mediaUrl]);
  const type = message.mediaType ?? inferMediaTypeFromSource(rawUrl) ?? "file";
  const previewType = ["image", "sticker", "audio", "video"].includes(type)
    ? (type as PreviewMediaState["type"])
    : "file";
  const fileName = getMediaFileName(message);
  const open = () => {
    if (mediaUrl && !failed) {
      onOpen({ url: mediaUrl, type: previewType, fileName, messageId: message.id });
    }
  };
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card/40 p-2.5">
      <button
        type="button"
        onClick={open}
        disabled={!mediaUrl || failed}
        aria-label={`Abrir ${fileName}`}
        className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {mediaUrl && !failed && (type === "image" || type === "sticker") ? (
          <img
            src={mediaUrl}
            alt={fileName}
            className="h-full w-full object-contain"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : type === "video" && mediaUrl && !failed ? (
          <video src={mediaUrl} className="h-full w-full object-cover" preload="metadata" onError={() => setFailed(true)} />
        ) : (
          <FileText className="h-8 w-8 text-muted-foreground" />
        )}
      </button>
      <p className="mt-2 truncate text-xs font-medium" title={fileName}>
        {fileName}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {failed ? "Não foi possível abrir este arquivo" : getMediaTypeLabel(type)}
      </p>
      <div className="mt-2 flex items-center gap-1">
        <Button size="sm" variant="ghost" className="h-8 flex-1 px-1 text-xs" disabled={!mediaUrl || failed} onClick={open}>
          Abrir
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={!mediaUrl || failed}
          onClick={() => onDownload(message)}
          aria-label={`Baixar ${fileName}`}
        >
          <Download className="h-4 w-4" />
        </Button>
        {onAttach && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            disabled={!mediaUrl || failed}
            onClick={() => onAttach(message)}
            aria-label={`Anexar ${fileName} ao rascunho`}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

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
  suggestingResponse,
  handleSuggestResponse,
  messages,
  aiMemory,
  leadNotes,
  setLeadNotes,
  handleSaveLeadNotes,
  newTagInput,
  setNewTagInput,
  handleAddTagToSelectedConversation,
  handleRemoveTagFromSelectedConversation,
  updatingAiToggle,
  handleSetConversationAiEnabled,
  responseSearchQuery,
  setResponseSearchQuery,
  quickReplies,
  quickReplyCategoryAppearance = {},
  quickReplyCategoryAppearanceError = false,
  onRetryQuickReplyCategoryAppearance,
  saveQuickReplyCategoryAppearance,
  quickRepliesLoading = false,
  quickRepliesError = false,
  sending,
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
  aiAgents = [],
  loadingAgents = false,
  handleSetConversationAgent,
  isDrawer = false,
  onClose,
  onAttachMedia,
  isWhatsappConnected = false,
}: SidebarPanelProps) {
  const [fileFilter, setFileFilter] = useState("all");
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [previewReply, setPreviewReply] = useState<QuickReplyItem | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [qrTypeFilter, setQrTypeFilter] = useState<"all" | "text" | "audio" | "video" | "image" | "flow">("all");
  const [qrPillFilter, setQrPillFilter] = useState<"all" | "favorites" | "uncategorized">("all");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryEmoji, setCategoryEmoji] = useState("📁");
  const [categoryColor, setCategoryColor] = useState("#16a34a");
  const [categorySaveError, setCategorySaveError] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  const { avatar: leadAvatar, refetch: refetchAvatar } = useResolvedAvatar(
    selectedConversation?.id,
    selectedConversation?.avatar || (selectedConversation as any)?.profilePictureUrl,
  );
  const [refreshingAvatar, setRefreshingAvatar] = useState(false);

  const handleRefreshAvatar = async () => {
    if (!selectedConversation?.id || refreshingAvatar) return;
    setRefreshingAvatar(true);
    try {
      await refetchAvatar({ force: true });
    } finally {
      setRefreshingAvatar(false);
    }
  };

  useEffect(() => {
    setPreviewReply(null);
    setShowAllFiles(false);
    setFileFilter("all");
  }, [selectedConversation?.id]);

  const activeTab = useMemo(() => {
    if (rightPanelTab === "qr") return "qr";
    if (rightPanelTab === "files") return "files";
    if (rightPanelTab === "history") return "history";
    return "ai"; // "ai" or "lead" both open the combined Atendimento & Cliente tab
  }, [rightPanelTab]);

  const categories = useMemo(
    () => Array.from(new Set(quickReplies.map((reply) => reply.category).filter(Boolean))),
    [quickReplies]
  );

  const variableContext = {
    contactName: selectedConversation?.contactName,
    phone: selectedConversation?.phone,
    company: aiMemory?.company,
  };

  const filteredReplies = useMemo(() => {
    return quickReplies.filter((reply) => {
      // Search query
      const matchesSearch = `${reply.title} ${reply.text}`
        .toLocaleLowerCase()
        .includes(responseSearchQuery.trim().toLocaleLowerCase());
      if (!matchesSearch) return false;

      // Category filter dropdown
      if (quickReplyCategory !== "all" && reply.category !== quickReplyCategory) return false;

      // Pill filter
      if (qrPillFilter === "favorites" && !reply.favorite) return false;
      if (qrPillFilter === "uncategorized" && reply.category) return false;

      // Type filter
      if (qrTypeFilter !== "all") {
        if (qrTypeFilter === "flow") {
          if (!reply.isFlow) return false;
        } else {
          const firstItem = reply.items?.[0] || reply.steps?.[0];
          const itemType = firstItem?.type || "text";
          if (itemType !== qrTypeFilter) return false;
        }
      }

      return true;
    });
  }, [quickReplies, responseSearchQuery, quickReplyCategory, qrPillFilter, qrTypeFilter]);

  // Group quick replies by category for intermediate-level view
  const groupedReplies = useMemo(() => {
    const groups: Record<string, QuickReplyItem[]> = {};
    for (const reply of filteredReplies) {
      const cat = (reply.category || "Geral").toUpperCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(reply);
    }
    return groups;
  }, [filteredReplies]);

  const orderedMessages = useMemo(() => sortMessagesAsc(messages), [messages]);
  const mediaMessages = orderedMessages.filter((message) => Boolean(extractMessageAssetUrl(message))).reverse();
  const filteredMedia = mediaMessages.filter((message) => {
    const type = message.mediaType ?? inferMediaTypeFromSource(extractMessageAssetUrl(message));
    if (fileFilter === "all") return true;
    if (fileFilter === "image") return type === "image" || type === "sticker";
    if (fileFilter === "file") return type === "file" || type === "document";
    return type === fileFilter;
  });

  const summary = sanitizeSidebarText(aiMemory?.summary ?? selectedConversation?.summary ?? "");
  const agentName =
    selectedConversation?.agent_name ||
    selectedConversation?.assigned_to ||
    selectedConversation?.assignedAgentName ||
    "";
  const hasCustomerMessage = messages.some((message) => !message.fromMe && Boolean(message.content?.trim()));
  const aiStatus = aiRuntime.loading
    ? "Verificando IA"
    : aiEnabledForConversation
    ? "Respondendo automaticamente"
    : !aiRuntime.globalEnabled
    ? "IA global pausada"
    : !aiRuntime.aiOn
    ? "Provedor indisponível"
    : "Atendimento humano";

  const chooseReply = (reply: QuickReplyItem) => {
    const entries = reply.isFlow ? reply.steps ?? [] : reply.items ?? [];
    if (reply.isFlow || entries.some((entry) => entry.type !== "text")) {
      setPreviewReply(reply);
    } else {
      setMessageInput(getQuickReplyPreviewText(reply, variableContext));
    }
  };

  const copyPhoneNumber = () => {
    if (!selectedConversation?.phone) return;
    navigator.clipboard.writeText(selectedConversation.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const openCategoryEditor = (name: string) => {
    const metadata = quickReplyCategoryAppearance[name.toLocaleLowerCase()];
    setEditingCategory(name);
    setCategoryEmoji(metadata?.emoji || "📁");
    setCategoryColor(metadata?.color || "#16a34a");
    setCategorySaveError("");
  };

  const saveCategoryEditor = async () => {
    if (!editingCategory || !saveQuickReplyCategoryAppearance || categorySaving) return;
    const key = editingCategory.toLocaleLowerCase();
    setCategorySaveError("");
    setCategorySaving(true);
    try {
      await saveQuickReplyCategoryAppearance(key, { emoji: categoryEmoji.trim() || "📁", color: categoryColor });
      setEditingCategory(null);
    } catch {
      setCategorySaveError("Não foi possível salvar a aparência da categoria. Tente novamente.");
    } finally {
      setCategorySaving(false);
    }
  };

  // Helper to render type icon for quick reply
  const renderReplyTypeIcon = (reply: QuickReplyItem) => {
    if (reply.isFlow) return <Workflow className="h-4 w-4 shrink-0 text-amber-400" />;
    const firstType = reply.items?.[0]?.type || "text";
    if (firstType === "audio") return <Mic className="h-4 w-4 shrink-0 text-blue-400" />;
    if (firstType === "video") return <Video className="h-4 w-4 shrink-0 text-purple-400" />;
    if (firstType === "image" || firstType === "sticker") return <Image className="h-4 w-4 shrink-0 text-cyan-400" />;
    return <FileText className="h-4 w-4 shrink-0 text-emerald-400" />;
  };

  // Clean contact name without @lid
  const cleanName = useMemo(() => {
    let name = (selectedConversation?.contactName || "").trim();
    if (name.includes("@lid")) name = name.replace(/@lid.*/, "").trim();
    if (name.includes("@s.whatsapp.net")) name = name.replace(/@s\.whatsapp\.net.*/, "").trim();
    return name || "Contato";
  }, [selectedConversation?.contactName]);

  const panelContent = selectedConversation ? (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setRightPanelTab(value as "ai" | "lead" | "files" | "qr" | "history")}
      className="flex h-full min-h-0 w-full flex-col"
    >
      <div className="shrink-0 border-b border-border/60 px-3 sm:px-4 pb-3 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Detalhes da conversa</p>
            <p className="truncate text-xs text-muted-foreground">{cleanName}</p>
          </div>
          {isDrawer ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label="Fechar painel de detalhes"
              title="Fechar painel"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
              onClick={() => setRightPanelCollapsed(true)}
              aria-label="Recolher painel de detalhes"
              title="Recolher painel"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <TabsList className="grid h-8.5 w-full grid-cols-4 gap-1 bg-muted/50 p-1 rounded-xl border border-border/60">
          {SECTIONS.map((section) => {
            return (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className={cn(
                  "flex items-center justify-center py-1 px-1 rounded-lg h-6.5 transition-all duration-150",
                  "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent",
                  "data-[state=active]:bg-background data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:font-semibold data-[state=active]:border-border/60 data-[state=active]:shadow-xs"
                )}
                title={section.fullLabel}
              >
                <span className="truncate text-[10.5px] font-medium tracking-tight select-none">
                  {section.label}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-3.5 text-sm scrollbar-thin">
        {/* TAB 1: UNIFIED ATENDIMENTO & CLIENTE */}
        <TabsContent value="ai" className="m-0 space-y-3">
          <InboxSectionBoundary fallbackLabel="Atendimento">
            {/* Box 1: ATENDIMENTO IA (Compact Operational Block) */}
            <section className="space-y-2.5 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
              {/* Header: Title + Status Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-emerald-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Atendimento IA
                  </span>
                </div>
                <div>
                  {aiEnabledForConversation ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ATIVA
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                      PAUSADA
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Row: IA nesta conversa + Real Switch */}
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="conversation-ai-toggle" className="min-w-0 cursor-pointer">
                  <span className="block text-xs font-semibold text-foreground">IA nesta conversa</span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{aiStatus}</span>
                </label>
                <Switch
                  id="conversation-ai-toggle"
                  checked={conversationAiOverrideEnabled}
                  onCheckedChange={handleSetConversationAiEnabled}
                  disabled={updatingAiToggle || aiRuntime.loading}
                  aria-label="Ativar ou pausar IA nesta conversa"
                />
              </div>

              {/* Row: Atendente responsável */}
              <div className="space-y-1">
                <label htmlFor="conversation-agent" className="block text-xs font-medium text-muted-foreground">
                  Atendente responsável
                </label>
                <select
                  id="conversation-agent"
                  value={agentName}
                  onChange={(event) => void handleSetConversationAgent?.(event.target.value)}
                  disabled={loadingAgents || !handleSetConversationAgent || aiAgents.length === 0}
                  className="h-8.5 w-full rounded-lg border border-border/80 bg-background/80 px-2.5 text-xs font-medium text-foreground hover:border-border focus:outline-none focus:ring-1 focus:ring-primary backdrop-blur-sm transition-colors"
                >
                  <option value="" className="bg-background text-foreground">Agente padrão da conexão</option>
                  {agentName && !aiAgents.some((agent) => agent.name === agentName) && (
                    <option value={agentName} className="bg-background text-foreground">{agentName}</option>
                  )}
                  {aiAgents.map((agent) => (
                    <option key={agent.id || agent.name} value={agent.name} className="bg-background text-foreground">
                      {agent.name}
                      {agent.active === false ? " (pausado)" : ""}
                    </option>
                  ))}
                </select>
                {!loadingAgents && aiAgents.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">Cadastre um agente em IA & Automação.</p>
                )}
              </div>

              {/* Compact Sugerir Resposta Button */}
              <div className="pt-0.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full gap-1.5 rounded-lg border-border/80 text-xs font-medium hover:bg-muted/50 transition-colors"
                  disabled={aiRuntime.loading || !aiRuntime.providerReady || suggestingResponse || !hasCustomerMessage}
                  onClick={() => void handleSuggestResponse()}
                >
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  {suggestingResponse ? "Preparando sugestão…" : "Sugerir resposta"}
                </Button>
                {!hasCustomerMessage ? (
                  <p className="mt-1 text-[10px] text-muted-foreground/80">
                    Aguarde uma mensagem do cliente para gerar sugestão.
                  </p>
                ) : null}
              </div>
            </section>

            {/* Box 2: DADOS DO CLIENTE (Directly Below, Zero Waste) */}
            <section className="space-y-2.5 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Dados do Cliente
                </span>
                {selectedConversation.phone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={copyPhoneNumber}
                  >
                    <Copy className="h-3 w-3" />
                    {copiedPhone ? "Copiado!" : "Copiar"}
                  </Button>
                )}
              </div>

              <div className="border-t border-border/50" />

              {/* Contact Avatar + Name + WhatsApp status */}
              <div className="flex items-center gap-2.5">
                <div className="relative group/avatar shrink-0">
                  <Avatar className="h-10 w-10 border border-border/60 shadow-xs">
                    {leadAvatar ? (
                      <AvatarImage
                        src={leadAvatar}
                        alt={cleanName}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 font-bold text-xs text-primary">
                      {getInitials(cleanName)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => void handleRefreshAvatar()}
                    disabled={refreshingAvatar}
                    className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background border border-border shadow-xs flex items-center justify-center text-muted-foreground hover:text-primary transition-all opacity-80 group-hover/avatar:opacity-100"
                    title="Atualizar foto do WhatsApp"
                    aria-label="Atualizar foto do WhatsApp"
                  >
                    <ArrowClockwise className={cn("h-2.5 w-2.5", refreshingAvatar && "animate-spin text-primary")} />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground" title={cleanName}>
                    {cleanName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {selectedConversation.phone ? formatPhoneNumber(selectedConversation.phone) : "WhatsApp"}
                    {" • "}
                    <span className="font-medium text-foreground/80">{selectedConversation.funnel_stage || "Lead Quente"}</span>
                  </p>
                </div>
              </div>

              {/* 2-column compact grid for Origem & Etapa */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 border border-border/40">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Origem</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
                    {getConversationSourceLabel(selectedConversation)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-2.5 py-1.5 border border-border/40">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Etapa</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
                    {selectedConversation.funnel_stage || "Lead Quente"}
                  </p>
                </div>
              </div>

              {/* Compact Chips for Etiquetas */}
              <div className="border-t border-border/40 pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Etiquetas</p>
                  <span className="text-[9.5px] text-muted-foreground/70">Clique para editar</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(selectedConversation.tags ?? []).map((tag) => (
                    <TagIconBadge
                      key={tag}
                      tag={tag}
                      colorClass={getTagColor(tag)}
                      interactive={true}
                      onRemove={() => handleRemoveTagFromSelectedConversation(tag)}
                    />
                  ))}
                  {!selectedConversation.tags?.length && (
                    <span className="text-[11px] text-muted-foreground">Nenhuma etiqueta</span>
                  )}
                </div>
                <div className="mt-2 flex gap-1">
                  <Input
                    aria-label="Nova etiqueta"
                    value={newTagInput}
                    onChange={(event) => setNewTagInput(event.target.value)}
                    placeholder="Adicionar etiqueta..."
                    className="h-7 text-xs"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddTagToSelectedConversation();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 shrink-0"
                    aria-label="Adicionar etiqueta"
                    disabled={!newTagInput.trim()}
                    onClick={handleAddTagToSelectedConversation}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Notas do Atendimento */}
              <div className="border-t border-border/40 pt-2">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="client-notes" className="text-[11px] font-medium text-muted-foreground">
                    Notas do Atendimento
                  </label>
                  {savingNotes && <span className="text-[10px] text-primary">Salvando…</span>}
                </div>
                <textarea
                  id="client-notes"
                  value={leadNotes}
                  onChange={(event) => setLeadNotes(event.target.value)}
                  placeholder="Registre contexto ou preferências deste cliente..."
                  className="min-h-16 w-full resize-y rounded-lg border border-border/70 bg-background/60 p-2 text-xs leading-relaxed outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1.5 h-7 text-xs"
                  disabled={savingNotes}
                  onClick={async () => {
                    setSavingNotes(true);
                    try {
                      await handleSaveLeadNotes();
                    } finally {
                      setSavingNotes(false);
                    }
                  }}
                >
                  {savingNotes ? "Salvando…" : "Salvar notas"}
                </Button>
              </div>

              {/* AI Memory / Summary */}
              {summary ? (
                <details className="rounded-lg border border-border/40 bg-muted/20">
                  <summary className="cursor-pointer p-2 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    Resumo salvo da conversa
                  </summary>
                  <p className="px-2.5 pb-2 text-xs leading-relaxed text-muted-foreground">
                    {summary}
                  </p>
                  {aiMemory?.last_updated && (
                    <p className="px-2.5 pb-2 text-[9.5px] text-muted-foreground/70">
                      Atualizado em {new Date(aiMemory.last_updated).toLocaleString("pt-BR")}
                    </p>
                  )}
                </details>
              ) : null}
            </section>
          </InboxSectionBoundary>
        </TabsContent>

        {/* TAB 2: INTERMEDIATE-LEVEL RESPOSTAS RÁPIDAS (MATCHING USER REFERENCE) */}
        <TabsContent value="qr" className="m-0 space-y-4">
          <InboxSectionBoundary fallbackLabel="Respostas Rápidas">
            {quickReplyCategoryAppearanceError && (
              <div role="alert" className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-600">
                <span>Não foi possível carregar emoji e cor das categorias. O padrão está sendo exibido.</span>
                {onRetryQuickReplyCategoryAppearance && <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-[11px]" onClick={() => void onRetryQuickReplyCategoryAppearance().catch(() => undefined)}>Tentar novamente</Button>}
              </div>
            )}
            {/* Top Filter Pills */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setQrPillFilter("all");
                    setQrTypeFilter("all");
                    setQuickReplyCategory("all");
                  }}
                  className={cn(
                    "rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium transition-colors",
                    qrPillFilter === "all" && qrTypeFilter === "all" && quickReplyCategory === "all"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Tudo
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium transition-colors",
                        qrTypeFilter !== "all"
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Por Tipo <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setQrTypeFilter("all")}>Todos os tipos</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQrTypeFilter("text")}>Texto</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQrTypeFilter("audio")}>Áudio</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQrTypeFilter("image")}>Imagem</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQrTypeFilter("video")}>Vídeo</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQrTypeFilter("flow")}>Fluxo Sequencial</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  onClick={() => setQrPillFilter(qrPillFilter === "uncategorized" ? "all" : "uncategorized")}
                  className={cn(
                    "rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium transition-colors",
                    qrPillFilter === "uncategorized"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Sem Categoria
                </button>

                {categories.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium transition-colors",
                          quickReplyCategory !== "all"
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        Por Categoria <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => setQuickReplyCategory("all")}>
                        Todas as categorias
                      </DropdownMenuItem>
                      {categories.map((cat) => {
                        const app = quickReplyCategoryAppearance[cat.toLocaleLowerCase()] || { emoji: "📁", color: "#16a34a" };
                        return (
                          <DropdownMenuItem key={cat} onClick={() => setQuickReplyCategory(cat)} className="flex items-center gap-2">
                            <CategoryMonochromeIcon iconOrEmoji={app.emoji} className="h-3.5 w-3.5" style={{ color: app.color }} />
                            <span>{cat}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <button
                  type="button"
                  onClick={() => setQrPillFilter(qrPillFilter === "favorites" ? "all" : "favorites")}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-medium transition-colors",
                    qrPillFilter === "favorites"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Star className="h-3 w-3" />
                  Mais Usadas
                </button>
              </div>

              {/* Search bar + New button */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label="Buscar respostas rápidas"
                    value={responseSearchQuery}
                    onChange={(event) => setResponseSearchQuery(event.target.value)}
                    placeholder="Buscar resposta rápida..."
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-9 shrink-0 gap-1 px-2.5 sm:px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  onClick={openCreateQuickReplyDialog}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nova
                </Button>
              </div>
            </div>

            {/* Replies List */}
            {quickRepliesLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Carregando respostas…</p>
            ) : quickRepliesError ? (
              <p
                role="alert"
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500"
              >
                Não foi possível carregar as respostas rápidas. Reabra o Inbox para tentar novamente.
              </p>
            ) : filteredReplies.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                {quickReplies.length
                  ? "Nenhuma resposta rápida encontrada para os filtros selecionados."
                  : "Crie sua primeira resposta rápida para agilizar seu atendimento."}
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedReplies).map(([categoryName, items]) => {
                  const isCollapsed = Boolean(collapsedCategories[categoryName]);
                  const appearance = quickReplyCategoryAppearance[categoryName.toLocaleLowerCase()] || { emoji: "📁", color: "#16a34a" };
                  return (
                    <div key={categoryName} className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
                      {/* Category Header */}
                      <div className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground">
                        <button type="button" onClick={() => toggleCategoryCollapse(categoryName)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-primary transition-colors">
                          <span
                            aria-hidden="true"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                            style={{ color: appearance.color }}
                          >
                            <CategoryMonochromeIcon iconOrEmoji={appearance.emoji} className="h-4 w-4" style={{ color: appearance.color }} />
                          </span>
                          <span className="truncate">{categoryName}</span>
                          <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] text-muted-foreground font-normal">{items.length}</span>
                          {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-background/70 hover:text-foreground" onClick={() => openCategoryEditor(categoryName)}>Editar</button>
                      </div>

                      {/* Items List */}
                      {!isCollapsed && (
                        <div className="divide-y divide-border/30">
                          {items.map((reply) => (
                            <div
                              key={reply.id}
                              className="group flex items-center justify-between gap-1 p-2 hover:bg-muted/30 transition-colors"
                            >
                              {/* Main Click Button (Inserts into composer or previews) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (e.shiftKey) {
                                    setMessageInput(getQuickReplyPreviewText(reply, variableContext));
                                  } else {
                                    chooseReply(reply);
                                  }
                                }}
                                onDoubleClick={() => setMessageInput(getQuickReplyPreviewText(reply, variableContext))}
                                disabled={sending}
                                className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                              >
                                {renderReplyTypeIcon(reply)}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-foreground/95">
                                    {reply.title || reply.text}
                                  </p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {reply.isFlow ? "Fluxo sequencial" : getQuickReplyPreviewText(reply, variableContext)}
                                  </p>
                                </div>
                              </button>

                              {/* Action Buttons on Right */}
                              <div className="flex items-center gap-0.5 shrink-0">
                                {/* Context Menu (...) */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                      aria-label={`Opções de ${reply.title}`}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => duplicateQuickReply(reply)}>
                                      <Copy className="mr-2 h-3.5 w-3.5" />
                                      Duplicar Resposta rápida
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openEditQuickReplyDialog(reply)}>
                                      <Pencil className="mr-2 h-3.5 w-3.5" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => chooseReply(reply)}>
                                      <Eye className="mr-2 h-3.5 w-3.5" />
                                      Editar e enviar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => deleteQuickReply(reply.id)}
                                    >
                                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                                      Deletar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Eye Button (Preview / Insert) */}
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                        aria-label={`Ver prévia de ${reply.title}`}
                                        onClick={() => chooseReply(reply)}
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Prévia / Rascunho</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                {/* Send Button (Paper Plane - Direct Send) */}
                                <TooltipProvider delayDuration={150}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-primary hover:bg-primary/10 hover:text-primary"
                                        disabled={sending || !isWhatsappConnected}
                                        aria-label={`Enviar ${reply.title} agora`}
                                        onClick={() => void sendQuickReply(reply, 0)}
                                      >
                                        <Send className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Enviar diretamente</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground text-center pt-2">
              Clique para rascunho · Ícone <Send className="inline h-3 w-3 text-primary mx-0.5" /> envia direto ao cliente
            </p>
          </InboxSectionBoundary>
        </TabsContent>

        {/* TAB 3: SHARED MEDIA / FILES */}
        <TabsContent value="files" className="m-0 space-y-4">
          <InboxSectionBoundary fallbackLabel="Arquivos">
            <div>
              <h3 className="font-semibold">Arquivos compartilhados</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Arquivos do histórico carregado desta conversa. Carregue mensagens anteriores para consultar arquivos mais
                antigos.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                { value: "all", label: "Todos", icon: Folder },
                { value: "image", label: "Imagens", icon: Image },
                { value: "video", label: "Vídeos", icon: Video },
                { value: "audio", label: "Áudios", icon: Mic },
                { value: "file", label: "Docs", icon: FileText },
              ].map((filter) => (
                <Button
                  key={filter.value}
                  size="sm"
                  variant={fileFilter === filter.value ? "secondary" : "ghost"}
                  className="h-8 gap-1.5 px-2 text-xs"
                  onClick={() => {
                    setFileFilter(filter.value);
                    setShowAllFiles(false);
                  }}
                >
                  <filter.icon className="h-3.5 w-3.5" />
                  {filter.label}
                </Button>
              ))}
            </div>
            {filteredMedia.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum arquivo encontrado neste histórico.
              </p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {filteredMedia.slice(0, showAllFiles ? undefined : 6).map((message) => (
                    <SharedMediaCard
                      key={message.id}
                      message={message}
                      onOpen={handleOpenMediaPreview}
                      onDownload={handleDownloadMedia}
                      onAttach={onAttachMedia}
                    />
                  ))}
                </div>
                {filteredMedia.length > 6 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-9 w-full text-xs"
                    onClick={() => setShowAllFiles((value) => !value)}
                  >
                    {showAllFiles ? "Mostrar menos" : `Ver mais ${filteredMedia.length - 6} arquivos`}
                  </Button>
                )}
              </>
            )}
          </InboxSectionBoundary>
        </TabsContent>

        {/* TAB 4: AUDIT LOGS & CHAT TIMELINE */}
        <TabsContent value="history" className="m-0 space-y-4">
          <InboxSectionBoundary fallbackLabel="Histórico">
            <div>
              <h3 className="font-semibold">Linha do Tempo & Histórico do Chat</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Registro de eventos de atendimento, IA, recebimento de mídia e status das mensagens.
              </p>
            </div>

            <div className="relative border-l-2 border-border/60 ml-3 mt-4 space-y-5 pl-4">
              {/* Event: AI / Attendant Mode */}
              <div className="relative">
                <div className="absolute -left-[23px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 border border-primary/40 text-primary">
                  {aiEnabledForConversation ? <Bot className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-foreground">
                    Modo Atual: {aiEnabledForConversation ? "IA Autônoma Ativa" : "Atendimento Humano"}
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {aiEnabledForConversation
                      ? `Provedor: ${aiRuntime.provider || "Padrão"} · Modelo: ${aiRuntime.model || "Configurado"}`
                      : "Operador humano no controle da conversa"}
                  </p>
                </div>
              </div>

              {/* Message Events Timeline */}
              {orderedMessages.slice(-15).reverse().map((msg) => {
                const isClient = !msg.fromMe;
                const mediaType = msg.mediaType || inferMediaTypeFromSource(extractMessageAssetUrl(msg));
                const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
                
                return (
                  <div key={msg.id} className="relative">
                    <div
                      className={cn(
                        "absolute -left-[23px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[10px]",
                        isClient
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                          : msg.isAI
                          ? "bg-purple-500/10 border-purple-500/30 text-purple-500"
                          : "bg-blue-500/10 border-blue-500/30 text-blue-500"
                      )}
                    >
                      {isClient ? (
                        <UserRound className="h-3 w-3" />
                      ) : msg.isAI ? (
                        <Bot className="h-3 w-3" />
                      ) : (
                        <Send className="h-2.5 w-2.5" />
                      )}
                    </div>
                    <div className="text-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-foreground">
                          {isClient
                            ? "Cliente Enviou"
                            : msg.isAI
                            ? "IA Respondeu"
                            : "Atendente Enviou"}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 font-mono">{timeStr}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {mediaType ? (
                          <span className="flex items-center gap-1 font-medium text-foreground/80">
                            [{getMediaTypeLabel(mediaType)}] {msg.content || ""}
                          </span>
                        ) : (
                          msg.content || "Mensagem de texto"
                        )}
                      </p>
                      {msg.status && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                          <span>Status:</span>
                          <span className={cn("font-medium", getMessageStatusMeta(msg.status).className)}>
                            {getMessageStatusMeta(msg.status).label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Earliest message available in the loaded history */}
              {orderedMessages[0]?.createdAt && (
                <div className="relative">
                  <div className="absolute -left-[23px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground">
                    <Clock className="h-3 w-3" />
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">Primeira mensagem carregada</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(orderedMessages[0].createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </InboxSectionBoundary>
        </TabsContent>
      </div>

      <Dialog open={editingCategory !== null} onOpenChange={(open) => { if (!open) setEditingCategory(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Editar categoria</span>
              <span className="font-mono text-xs text-muted-foreground">({editingCategory})</span>
            </DialogTitle>
            <DialogDescription>Personalize o ícone monocromático e a cor desta categoria do Inbox.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Live Preview */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2.5">
              <span className="text-xs text-muted-foreground font-medium">Prévia no Inbox:</span>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border shadow-xs transition-colors"
                  style={{
                    backgroundColor: `${categoryColor}18`,
                    borderColor: `${categoryColor}50`,
                    color: categoryColor,
                  }}
                >
                  <CategoryMonochromeIcon iconOrEmoji={categoryEmoji} className="h-3.5 w-3.5 shrink-0" style={{ color: categoryColor }} />
                  <span>{editingCategory}</span>
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition-colors"
                  style={{ backgroundColor: categoryColor || "#10b981" }}
                >
                  <CategoryMonochromeIcon iconOrEmoji={categoryEmoji} className="h-3.5 w-3.5 shrink-0 text-white" />
                  <span>{editingCategory}</span>
                </span>
              </div>
            </div>

            {/* Monochromatic Icon Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-foreground/90">
                <label htmlFor="category-emoji-input" className="cursor-pointer">
                  Ícone monocromático da categoria
                </label>
                <span className="text-[11px] text-muted-foreground font-normal">Uma cor apenas (assume a cor selecionada)</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center border shrink-0 transition-colors"
                  style={{
                    borderColor: `${categoryColor}60`,
                    backgroundColor: `${categoryColor}15`,
                    color: categoryColor,
                  }}
                  title="Prévia do ícone monocromático"
                >
                  <CategoryMonochromeIcon iconOrEmoji={categoryEmoji} className="h-5 w-5" style={{ color: categoryColor }} />
                </div>
                <Input
                  id="category-emoji-input"
                  value={categoryEmoji}
                  maxLength={8}
                  onChange={(event) => setCategoryEmoji(event.target.value)}
                  aria-label="Emoji da categoria"
                  className="w-16 text-center text-sm font-mono shrink-0"
                />
                <div className="flex flex-wrap items-center gap-1 flex-1 p-1 bg-muted/20 border border-border/50 rounded-lg">
                  {PRESET_CATEGORY_ICONS.map(({ key, name, icon: IconComp }) => {
                    const isSelected = (categoryEmoji || "").trim() === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCategoryEmoji(key)}
                        className={cn(
                          "h-7 w-7 rounded flex items-center justify-center transition-all hover:scale-110",
                          isSelected
                            ? "ring-2 ring-offset-1 ring-offset-background font-bold shadow-xs"
                            : "bg-muted/30 hover:bg-muted/60"
                        )}
                        style={{
                          color: categoryColor,
                          ...(isSelected
                            ? {
                                backgroundColor: `${categoryColor}25`,
                                ringColor: categoryColor,
                              }
                            : {}),
                        }}
                        title={name}
                      >
                        <IconComp className="h-3.5 w-3.5" style={{ color: categoryColor }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Color Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium text-foreground/90">
                <span>Cor da categoria</span>
                <span className="font-mono text-[11px] text-muted-foreground">{categoryColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={categoryColor}
                  onChange={(event) => setCategoryColor(event.target.value)}
                  className="h-8 w-14 p-0.5 cursor-pointer rounded border border-border/60 shrink-0"
                  aria-label="Cor da categoria"
                />
                <div className="flex flex-wrap items-center gap-1.5 flex-1 p-1.5 bg-muted/20 border border-border/50 rounded-md">
                  {PRESET_CATEGORY_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setCategoryColor(c.hex)}
                      className={cn(
                        "h-5 w-5 rounded-full transition-transform hover:scale-125",
                        categoryColor.toLowerCase() === c.hex.toLowerCase() && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                      )}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {categorySaveError && <p role="alert" className="text-xs text-destructive">{categorySaveError}</p>}
            <Button className="w-full" disabled={categorySaving} onClick={() => void saveCategoryEditor()}>{categorySaving ? "Salvando…" : "Salvar categoria"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <QuickResponseModal
        isOpen={Boolean(previewReply)}
        onClose={() => setPreviewReply(null)}
        quickReply={previewReply}
        recipientName={selectedConversation.contactName}
        onDispatch={sendQuickReply}
        disabled={sending || !isWhatsappConnected}
      />
    </Tabs>
  ) : (
    <div className="p-5 text-sm text-muted-foreground">Selecione uma conversa para ver os detalhes.</div>
  );

  if (isDrawer) return <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">{panelContent}</div>;

  return (
    <aside
      className={cn(
        "h-full min-h-0 w-full border-l border-border/60 bg-background",
        isTabletLayout ? "hidden" : "hidden lg:flex lg:flex-col"
      )}
      aria-label="Painel da conversa"
    >
      {rightPanelCollapsed ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10"
                  aria-label="Expandir painel de detalhes"
                  onClick={() => setRightPanelCollapsed(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Expandir painel</TooltipContent>
            </Tooltip>
            {SECTIONS.map((section) => (
              <Tooltip key={section.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn("h-10 w-10", activeTab === section.id && "bg-primary/10 text-primary")}
                    aria-label={section.label}
                    onClick={() => {
                      setRightPanelTab(section.id as any);
                      setRightPanelCollapsed(false);
                    }}
                  >
                    <section.icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{section.label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      ) : (
        panelContent
      )}
    </aside>
  );
}
