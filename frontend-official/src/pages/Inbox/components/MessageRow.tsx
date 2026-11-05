import { memo, useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowBendUpRight,
  CopySimple,
  Trash,
  Smiley,
  Checks,
  Clock,
  PlayCircle,
  File as FileIcon,
  ImageSquare,
  Paperclip,
  ArrowDown,
  VideoCamera,
  Check,
  Warning,
  Robot,
  User,
  Storefront,
  DotsThreeVertical,
  WhatsappLogo,
  ArrowSquareOut,
  Truck,
  Megaphone,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/core/lib/utils";
import type { ChatMessage } from "@/core/services/apiService";
import { apiService } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { AIMessageFeedback } from "@/components/inbox/AIMessageFeedback";
import { useProtectedMedia } from "@/core/runtime/hooks/useProtectedMediaUrl";
import { bubbleClassFor, isWhatsappDeviceMessage } from "../messageOrigin";
import { getCatalogImageUrl } from "./CatalogSelectorPopover";
import type { PreviewMediaState } from "../types";
import {
  getMessageStatusMeta,
  getMediaTypeLabel,
  getMessageDisplayContent,
  getMediaFileName,
  getMediaFileReferenceLabel,
  downloadMediaFile,
  extractMessageAssetUrl,
  HighlightedMessageText,
  logInboxDebug,
  formatPlaybackTime,
  formatTime,
  formatPhoneNumber,
} from "../utils";

interface ParsedCatalogItem {
  title: string;
  code?: string;
  price?: string;
  shipping?: string;
  condition?: string;
  stock?: string;
  description?: string;
  catalogUrl?: string;
  image?: string;
  images?: string[];
}

function parseCatalogCard(text: string, message?: ChatMessage, mediaUrl?: string | null): ParsedCatalogItem | null {
  const isExplicitProduct =
    message?.type === "product" ||
    (message as any)?.mediaType === "product" ||
    (message as any)?.media_type === "product" ||
    Boolean((message as any)?.product) ||
    Boolean(text && (
      text.includes("[CATÁLOGO WHATSAPP]") ||
      text.includes("[CATÁLOGO DE PRODUTOS]") ||
      text.includes("[PRODUTO WHATSAPP]") ||
      text.includes("[PRODUTO]") ||
      /^\*[A-Z0-9\s\-³]+(?:\s*-\s*[A-Z0-9]+)?\*\s*(?:\n|\r\n|\s+)\s*R\$\s*[\d\.,]+/i.test(text.trim())
    ));

  if (!isExplicitProduct) {
    return null;
  }

  let title = "";
  let code: string | undefined;
  let price: string | undefined;
  let shipping: string | undefined;
  let condition: string | undefined;
  let stock: string | undefined;
  let description: string | undefined;
  let catalogUrl = "https://wa.me/c/553193672075";

  const cleanText = (text || "").trim();

  // 1. Format: [PRODUTO WHATSAPP] NAME - BRL PRICE - Description
  const prodMatch = cleanText.match(/\[PRODUTO(?:\s+WHATSAPP)?\]\s*(.+?)\s*-\s*(?:BRL|R\$)\s*([\d\.,]+)(?:\s*-\s*([\s\S]+))?/i);
  if (prodMatch) {
    title = prodMatch[1].trim();
    price = `R$ ${prodMatch[2].trim()}`;
    description = prodMatch[3]?.trim();
  } else {
    // 2. Format: *NAME* R$ PRICE (single-line or multi-line)
    const boldMatch = cleanText.match(/\*([^*]+)\*\s*(?:\n|\r\n|\s)*(?:R\$|BRL)?\s*([\d\.,]+)?/i);
    if (boldMatch && !boldMatch[1].includes("[CATÁLOGO") && !boldMatch[1].includes("[PRODUTO")) {
      title = boldMatch[1].trim();
      if (boldMatch[2]) price = `R$ ${boldMatch[2].trim()}`;
    }

    if (!title || title.includes("[CATÁLOGO") || title.includes("[PRODUTO")) {
      const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.includes("[CATÁLOGO") || line.includes("[PRODUTO") || line.includes("━━━━")) continue;
        if (line.startsWith("*") && line.endsWith("*") && !line.includes(":")) {
          title = line.replace(/^\*+|\*+$/g, "").trim();
          break;
        }
      }
      if ((!title || title.includes("[CATÁLOGO")) && lines.length > 0) {
        const candidate = lines.find((l) => !l.includes("[CATÁLOGO") && !l.includes("[PRODUTO") && !l.includes("━━━━"));
        if (candidate) {
          title = candidate.replace(/^[*\[\]]+|[*\[\]]+$/g, "").trim();
        }
      }
    }

    const codeMatch = cleanText.match(/(?:Código|Codigo):\*?\s*([^\n]+)/i);
    const priceMatch = cleanText.match(/(?:Valor|R\$|BRL):\*?\s*([^\n]+)/i) || cleanText.match(/R\$\s*([\d\.,]+)/i);
    const shippingMatch = cleanText.match(/Entrega:\*?\s*([^\n]+)/i);
    const promoMatch = cleanText.match(/(?:Condição|Condicao):\*?\s*([^\n]+)/i);
    const stockMatch = cleanText.match(/Disponibilidade:\*?\s*([^\n]+)/i);
    const descMatch = cleanText.match(/(?:Descrição|Descricao):\*?\s*([\s\S]*?)(?=(?:🔗|━━━━━━━━|💬|$))/i);
    const urlMatch = cleanText.match(/https?:\/\/[^\s*]+/i);

    if (codeMatch) code = codeMatch[1].replace(/\*+/g, "").trim();
    if (priceMatch) {
      const rawPrice = priceMatch[1].replace(/\*+/g, "").trim();
      price = rawPrice.startsWith("R$") ? rawPrice : `R$ ${rawPrice}`;
    }
    if (shippingMatch) shipping = shippingMatch[1].replace(/\*+/g, "").trim();
    if (promoMatch) condition = promoMatch[1].replace(/\*+/g, "").trim();
    if (stockMatch) stock = stockMatch[1].replace(/\*+/g, "").trim();
    if (descMatch) description = descMatch[1].replace(/\*+/g, "").trim();
    if (urlMatch) catalogUrl = urlMatch[0].trim();
  }

  // Fallback title from message product object if empty
  if (!title) {
    title = (message as any)?.product?.name || (message as any)?.product?.title || "Produto do Catálogo";
  }

  const lowerTitle = (title || "").toLowerCase();

  // Resolve authentic product image
  let image = mediaUrl || (message as any)?.mediaPath || (message as any)?.media_path || (message as any)?.product?.image || (message as any)?.product?.images?.[0];

  if (!image || image === "null" || image === "undefined" || !image.includes("/")) {
    if (lowerTitle.includes("caminhao de areia") || lowerTitle.includes("caminhão de areia") || (lowerTitle.includes("areia") && lowerTitle.includes("9m"))) {
      image = "/assets/catalog/caminhao_areia.png";
    } else if (lowerTitle.includes("areia")) {
      image = "/assets/catalog/areia_m3.png";
    } else if (lowerTitle.includes("brita") || lowerTitle.includes("8m")) {
      image = "/assets/catalog/caminhao_brita.png";
    } else if (lowerTitle.includes("bloco")) {
      image = "/assets/catalog/bloco_10_100un.png";
    } else if (lowerTitle.includes("ac3") || lowerTitle.includes("ac-3") || lowerTitle.includes("ac 3")) {
      image = "/assets/catalog/argamassa_ac3.png";
    } else if (lowerTitle.includes("ac2") || lowerTitle.includes("ac-2") || lowerTitle.includes("ac 2")) {
      image = "/assets/catalog/argamassa_ac2.png";
    } else if (lowerTitle.includes("ac1") || lowerTitle.includes("ac-1") || lowerTitle.includes("ac 1")) {
      image = "/assets/catalog/argamassa_ac1.png";
    } else if (lowerTitle.includes("10.000") || lowerTitle.includes("10000")) {
      image = "/assets/catalog/caixa_10000l.png";
    } else if (lowerTitle.includes("5000") || lowerTitle.includes("5.000")) {
      image = "/assets/catalog/caixa_5000l.png";
    } else if (lowerTitle.includes("2000") || lowerTitle.includes("2.000")) {
      image = "/assets/catalog/caixa_2000l.png";
    } else if (lowerTitle.includes("1000") || lowerTitle.includes("1.000")) {
      image = "/assets/catalog/caixa_1000l.png";
    } else if (lowerTitle.includes("12 furos") || lowerTitle.includes("12f")) {
      image = "/assets/catalog/tijolo_12_furos.png";
    } else if (lowerTitle.includes("9 furos") || lowerTitle.includes("9f")) {
      image = "/assets/catalog/tijolo_9_furos.png";
    } else if (lowerTitle.includes("8 furos") || lowerTitle.includes("8f")) {
      image = "/assets/catalog/tijolo_8_furos.png";
    } else if (lowerTitle.includes("maciço") || lowerTitle.includes("macico")) {
      image = "/assets/catalog/tijolo_macico.jpg";
    } else if (lowerTitle.includes("liz") || lowerTitle.includes("cp4") || lowerTitle.includes("cp iv")) {
      image = "/assets/catalog/cimento_liz.png";
    } else if (lowerTitle.includes("cimento") || lowerTitle.includes("argamassa")) {
      image = "/assets/catalog/cimento_cp2.png";
    } else if (lowerTitle.includes("churrasqueira") && (lowerTitle.includes("75") || lowerTitle.includes("prem"))) {
      image = "/assets/catalog/churras_75.jpg";
    } else if (lowerTitle.includes("churrasqueira")) {
      image = "/assets/catalog/churrasqueira_premoldada.png";
    } else if (lowerTitle.includes("telha") && (lowerTitle.includes("ceram") || lowerTitle.includes("cerâm"))) {
      image = "/assets/catalog/telhas_ceramica.png";
    } else if (lowerTitle.includes("telha")) {
      image = "/assets/catalog/telha_fibro.jpg";
    } else if (lowerTitle.includes("betoneira")) {
      image = "/assets/catalog/betoneira_csm_400l.png";
    } else if (lowerTitle.includes("tinta")) {
      image = "/assets/catalog/tinta.png";
    } else if (lowerTitle.includes("bloco")) {
      image = "/assets/catalog/bloco_10_100un.png";
    } else {
      image = "/assets/catalog/bloco_10_100un.png";
    }
  }

  let galleryImages: string[] = [];
  if (Array.isArray((message as any)?.product?.images) && (message as any).product.images.length > 0) {
    galleryImages = (message as any).product.images;
  } else if (lowerTitle.includes("bloco")) {
    galleryImages = [
      "/assets/catalog/bloco_10_100un.png",
      "/assets/catalog/bloco_10_100un_2.png",
      "/assets/catalog/bloco_10_100un_3.png"
    ];
  } else if (image) {
    galleryImages = [image];
  }

  return {
    title: title || "Produto do Catálogo",
    code,
    price,
    shipping,
    condition,
    stock,
    description,
    catalogUrl,
    image,
    images: galleryImages,
  };
}

interface ParsedDisparoItem {
  title: string;
  flowName: string;
  cadence?: string;
  contactName?: string;
  phone?: string;
  sessionId?: string;
  totalSteps?: number;
  currentStep?: number;
  status?: string;
  previewText?: string;
  dispatchedAt?: string;
}

function parseDisparoCard(text: string, message: ChatMessage): ParsedDisparoItem | null {
  const meta = (message as any).analysis_json || (message as any).metadata || {};
  const isExplicitDisparo =
    message.type === "disparo" ||
    message.type === "campaign" ||
    (message as any).sender === "campaign" ||
    (message as any).message_origin === "campaign" ||
    (message as any).origin === "campaign" ||
    meta.isDisparo === true ||
    Boolean(meta.campaignId) ||
    Boolean(meta.flowRunId) ||
    meta.source === "quick_reply" ||
    meta.source === "campaign_flow" ||
    (text && (
      text.includes("[DISPARO REALIZADO]") ||
      text.includes("[DISPARO DE CAMPANHA]") ||
      text.includes("[FLUXO DE DISPARO]") ||
      text.startsWith("[DISPARO]") ||
      text.startsWith("📢 [DISPARO]")
    ));

  if (!isExplicitDisparo) {
    return null;
  }

  let flowName = meta.flowName || meta.flowId || "";
  let cadence = meta.cadence || (meta.stepDelayMs ? `${Math.round(meta.stepDelayMs / 1000)}s delay` : "");
  let contactName = meta.contactName || "";
  let phone = meta.phone || message.phone || "";
  let totalSteps = meta.totalSteps || 1;
  let currentStep = meta.currentStep || 1;
  let previewText = meta.previewText || "";

  if (text) {
    const flowMatch = text.match(/(?:Fluxo|Campanha|Script):\s*([^\n]+)/i);
    if (flowMatch && !flowName) flowName = flowMatch[1].replace(/\*+/g, "").trim();

    const cadenceMatch = text.match(/(?:Modo|Cadência|Cadencia|Proteção|Protecao):\s*([^\n]+)/i);
    if (cadenceMatch && !cadence) cadence = cadenceMatch[1].replace(/\*+/g, "").trim();

    const contactMatch = text.match(/(?:Destinatário|Destinatario|Destino|Contato):\s*([^\n]+)/i);
    if (contactMatch && !contactName) contactName = contactMatch[1].replace(/\*+/g, "").trim();

    const stepsMatch = text.match(/(?:Etapas|Passos):\s*([^\n]+)/i);
    if (stepsMatch) {
      const matchNum = stepsMatch[1].match(/(\d+)/);
      if (matchNum && !meta.totalSteps) totalSteps = parseInt(matchNum[1], 10);
    }

    if (!previewText) {
      if (text.includes("━━━━")) {
        const parts = text.split(/━+/);
        if (parts.length > 1) {
          previewText = parts.slice(1).join("").trim();
        }
      } else if (text.includes("[DISPARO")) {
        previewText = text.replace(/\[DISPARO[^\]]*\]/gi, "").trim();
      } else {
        previewText = text;
      }
    }
  }

  if (!previewText) {
    previewText = message.content || message.text || "";
  }

  return {
    title: "Disparo Realizado",
    flowName: flowName || "Disparo Comercial WhatsApp",
    cadence: cadence || "Anti-Ban Humanizado",
    contactName: contactName,
    phone: phone,
    sessionId: message.sessionId || meta.sessionId || "main",
    totalSteps: Number(totalSteps) || 1,
    currentStep: Number(currentStep) || 1,
    status: "Enviado no WhatsApp",
    previewText: previewText.replace(/\[DISPARO[^\]]*\]/gi, "").trim(),
    dispatchedAt: String(message.timestamp || message.createdAt || ""),
  };
}

interface ParsedOrderItem {
  orderId: string;
  orderTitle: string;
  items: Array<{ name: string; quantity: number; price?: string }>;
  itemCount: number;
  total: string;
  notes?: string;
  status: string;
  fromMe: boolean;
}

function parseOrderCard(text: string, message: ChatMessage): ParsedOrderItem | null {
  const isOrder =
    message.mediaType === "order" ||
    (message as any).type === "order" ||
    (text && (
      text.includes("[PEDIDO WHATSAPP]") ||
      text.includes("PEDIDO RECEBIDO") ||
      text.includes("PEDIDO GERADO") ||
      text.includes("🛒 *NOVO PEDIDO") ||
      text.includes("🛒 *PEDIDO GERADO")
    ));

  if (!isOrder) return null;

  // Extract orderId
  const idMatch = text.match(/#(ORD_[A-Za-z0-9_-]+|\d+|order_[A-Za-z0-9_-]+)/i);
  const orderId = idMatch ? idMatch[1] : (message.whatsappMessageId || "PEDIDO");

  // Extract total
  const totalMatch = text.match(/(?:TOTAL(?: DO PEDIDO)?|Total):\s*(?:R\$\s*|BRL\s*)?([\d.,]+)/i);
  const total = totalMatch ? `R$ ${totalMatch[1].trim()}` : "Consulte";

  // Extract items
  const items: Array<{ name: string; quantity: number; price?: string }> = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const itemMatch = line.match(/[•\-\*]\s*([^\(]+?)(?:\s*\((\d+)x?\))?(?:\s*[-—]\s*(?:R\$\s*)?([\d.,]+))?$/i);
    if (itemMatch && !line.includes("Subtotal") && !line.includes("Total") && !line.includes("Frete") && !line.includes("Desconto")) {
      items.push({
        name: itemMatch[1].replace(/\*+/g, "").trim(),
        quantity: itemMatch[2] ? parseInt(itemMatch[2], 10) : 1,
        price: itemMatch[3] ? `R$ ${itemMatch[3].trim()}` : undefined,
      });
    }
  }

  // Extract notes
  const notesMatch = text.match(/(?:Obs(?:ervação|ervacao)?|Mensagem):\s*([^\n]+)/i);

  return {
    orderId,
    orderTitle: `Pedido #${orderId}`,
    items,
    itemCount: items.length || 1,
    total,
    notes: notesMatch ? notesMatch[1].trim() : undefined,
    status: message.fromMe ? "Enviado pelo Atendente" : "Recebido do Cliente",
    fromMe: Boolean(message.fromMe),
  };
}

export const MessageRow = memo(function MessageRow({
  message,
  reaction,
  onReact,
  onOpenMediaPreview,
  isMenuOpen,
  isReactionPickerOpen,
  onToggleMenu,
  onToggleReactionPicker,
  onCopyMessage,
  onReplyMessage,
  onForwardMessage,
  onDeleteMessage,
  onDownloadMedia,
  onToggleAudio,
  isAudioLoading,
  isAudioPlaying,
  audioProgress,
  audioDuration,
  backendOnline,
  searchQuery,
  isActiveSearchMatch,
  onOpenProductDetails,
  onOpenOrdersDrawer,
}: {
  message: ChatMessage;
  reaction?: string;
  onReact: (messageId: string, emoji: string) => void;
  onOpenMediaPreview: (media: PreviewMediaState) => void;
  onOpenProductDetails?: (product: any) => void;
  onOpenOrdersDrawer?: () => void;
  isMenuOpen: boolean;
  isReactionPickerOpen: boolean;
  onToggleMenu: (messageId: string) => void;
  onToggleReactionPicker: (messageId: string) => void;
  onCopyMessage: (message: ChatMessage) => void;
  onReplyMessage: (message: ChatMessage) => void;
  onForwardMessage: (message: ChatMessage) => void;
  onDeleteMessage: (messageId: string, scope: "local" | "everyone") => void;
  onDownloadMedia: (message: ChatMessage) => void;
  onToggleAudio?: (messageId: string, url: string) => void;
  isAudioLoading?: boolean;
  isAudioPlaying?: boolean;
  audioProgress?: number;
  audioDuration?: number;
  backendOnline: boolean;
  searchQuery?: string;
  isActiveSearchMatch?: boolean;
}) {
  const explicitMessageType = (message as any).messageType;
  const isExplicitProduct =
    message.type === "product" ||
    (message as any).mediaType === "product" ||
    (message as any).media_type === "product" ||
    explicitMessageType === "product" ||
    Boolean((message as any)?.product) ||
    (typeof message.content === "string" && (
      message.content.includes("[PRODUTO WHATSAPP]") ||
      message.content.includes("[CATÁLOGO WHATSAPP]") ||
      message.content.includes("BLOCO 10 - 100 UN")
    ));

  const rawAsset = extractMessageAssetUrl(message);
  const isPublicCatalogAsset = typeof rawAsset === "string" && (rawAsset.startsWith("/assets/catalog") || rawAsset.includes("/assets/catalog/"));
  const mediaAccess = useProtectedMedia(isExplicitProduct || isPublicCatalogAsset ? null : rawAsset);
  const mediaUrl = isPublicCatalogAsset ? rawAsset : (isExplicitProduct ? (rawAsset || (message as any)?.url) : mediaAccess.url);

  const resolvedMediaType = isExplicitProduct
    ? "product"
    : (message.mediaType ??
      explicitMessageType ??
      inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? "")) ??
      inferMediaTypeFromSource(mediaUrl ?? undefined));

  const hasRenderableMedia = Boolean(
    !isExplicitProduct &&
    resolvedMediaType &&
    resolvedMediaType !== "text" &&
    resolvedMediaType !== "order" &&
    resolvedMediaType !== "product" &&
    resolvedMediaType !== "catalog"
  );
  const shouldTrackMediaLoading = resolvedMediaType === "image" || resolvedMediaType === "video";
  const [mediaLoading, setMediaLoading] = useState(Boolean(mediaUrl && shouldTrackMediaLoading));
  const [mediaError, setMediaError] = useState(false);

  const { toast } = useToast();
  const cacheKey = `transcription_${message.id}`;
  const [transcription, setTranscription] = useState<string | null>(() => {
    return localStorage.getItem(cacheKey) || null;
  });
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleTranscribe = async () => {
    if (!mediaUrl || isTranscribing) return;
    setIsTranscribing(true);
    try {
      const res = await apiService.transcribeAudio(mediaUrl);
      if (res && res.text) {
        setTranscription(res.text);
        localStorage.setItem(cacheKey, res.text);
        toast({ title: "Áudio transcrito com sucesso!" });
      } else {
        toast({ title: "Falha na transcrição.", description: "Nenhum texto retornado.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Erro ao transcrever áudio:", err);
      toast({
        title: "Erro na transcrição",
        description: err.message || "Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscription = () => {
    if (transcription) {
      void navigator.clipboard.writeText(transcription);
      toast({ title: "Transcrição copiada!" });
    }
  };
  const statusMeta = getMessageStatusMeta(message.status);
  const messageTime = message.timestamp ?? message.createdAt;
  const timeDescription = messageTime
    ? `Horário no WhatsApp: ${messageTime}${message.createdAt && message.createdAt !== messageTime ? ` · Recebida no sistema: ${message.createdAt}` : ""}`
    : "Horário não informado";
  const showFallbackCard = !isExplicitProduct && hasRenderableMedia && (mediaError || (!mediaUrl && !mediaAccess.loading));
  const mediaResolveLoggedRef = useRef(false);
  const mediaErrorLoggedRef = useRef(false);

  useEffect(() => {
    setMediaLoading(Boolean(mediaUrl && shouldTrackMediaLoading));
    setMediaError(false);
    mediaResolveLoggedRef.current = false;
    mediaErrorLoggedRef.current = false;
  }, [mediaUrl, message.id, shouldTrackMediaLoading]);

  useEffect(() => {
    if (!mediaUrl || !shouldTrackMediaLoading) return;
    const timeoutId = window.setTimeout(() => setMediaLoading(false), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [mediaUrl, message.id, shouldTrackMediaLoading]);

  useEffect(() => {
    if (!hasRenderableMedia || mediaUrl || mediaAccess.loading) return;
    if (mediaResolveLoggedRef.current) return;
    mediaResolveLoggedRef.current = true;
    logInboxDebug("media:missing-url", {
      messageId: message.id,
      conversationId: message.conversationId ?? null,
      mediaType: resolvedMediaType ?? null,
      hasMessageUrl: Boolean(message.url),
      hasMessageMediaUrl: Boolean(message.mediaUrl),
      messageMediaPath: message.mediaPath ?? null,
      content: message.content ?? null,
      caption: message.caption ?? null,
      backendOnline,
    });
  }, [hasRenderableMedia, mediaUrl, mediaAccess.loading, message, resolvedMediaType, backendOnline]);

  useEffect(() => {
    if (!mediaError || mediaErrorLoggedRef.current) return;
    mediaErrorLoggedRef.current = true;
    logInboxDebug("media:load-error", {
      messageId: message.id,
      conversationId: message.conversationId ?? null,
      mediaType: resolvedMediaType ?? null,
      hasAuthorizedMediaUrl: Boolean(mediaUrl),
      hasMessageUrl: Boolean(message.url),
      hasMessageMediaUrl: Boolean(message.mediaUrl),
      messageMediaPath: message.mediaPath ?? null,
      backendOnline,
    });
  }, [backendOnline, mediaError, mediaUrl, message, resolvedMediaType]);

  const safeTextContent = getMessageDisplayContent(message);
  const displayText = hasRenderableMedia && safeTextContent === getMediaTypeLabel(resolvedMediaType) ? "" : safeTextContent;
  const parsedOrder = useMemo(() => parseOrderCard(displayText, message), [displayText, message]);
  const parsedCatalog = useMemo(() => parseCatalogCard(displayText, message, mediaUrl), [displayText, message, mediaUrl]);
  const parsedDisparo = useMemo(() => parseDisparoCard(displayText, message), [displayText, message]);

  const EMOJI_OPTIONS = ["\u{1F600}", "\u{1F602}", "\u{1F60D}", "\u{1F44D}", "\u{1F525}", "\u{1F44F}", "\u{1F64F}", "\u{2705}", "\u{1F4E6}", "\u{1F69A}"];

  const isDeviceMessage = isWhatsappDeviceMessage(message as any);

  const isAiMessage = Boolean(
    message.isAI ||
    (message as any).is_ai ||
    (message as any).isAiGenerated ||
    (message as any).source === 'ai' ||
    (message as any).metadata?.source === 'ai' ||
    (message as any).sender === 'ai' ||
    (message as any).sender === 'bot' ||
    (message as any).sender === 'campaign' ||
    (message as any).origin === 'ai' ||
    (message as any).origin === 'campaign' ||
    (message as any).message_origin === 'ai' ||
    (message as any).message_origin === 'campaign' ||
    (message as any).campaignId ||
    (message as any).campaign_id ||
    (message as any).metadata?.campaignId ||
    (message as any).metadata?.campaign_id ||
    (message as any).agentName
  );

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "flex gap-2 group/bubble scroll-mt-28 rounded-lg transition-colors",
        message.fromMe && "justify-end",
        isActiveSearchMatch && "bg-amber-400/10 ring-1 ring-amber-400/40",
      )}
    >

      <div className="relative pb-3 max-w-[80%]">
        <div
          className={cn(
            "absolute top-2 hidden md:flex items-center gap-0.5 bg-card/90 border border-border/80 rounded-full p-1 shadow-md backdrop-blur-sm z-20 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150",
            message.fromMe ? "-left-32" : "-right-32"
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onReplyMessage(message)}
            title="Responder"
          >
            <ArrowBendUpRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onCopyMessage(message)}
            title="Copiar"
          >
            <CopySimple className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => onToggleReactionPicker(message.id)}
            title="Reagir"
          >
            <Smiley className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onToggleMenu(message.id)}
            title="Opcoes de exclusao"
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div
          onContextMenu={(event) => { event.preventDefault(); onToggleMenu(message.id); }}
          className={cn(
            "chat-bubble text-left transition-all duration-150",
            bubbleClassFor({ fromMe: message.fromMe, isDevice: isDeviceMessage, isAi: isAiMessage })
          )}
        >
          {!backendOnline && hasRenderableMedia && (
            <div className="mb-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Servidor reconectando...
            </div>
          )}

          {showFallbackCard && backendOnline && (
            <div className="mb-2" onClick={(event) => event.stopPropagation()}>
              <div
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 rounded-lg bg-card/90 dark:bg-[#202c33] border border-border/40 p-3 text-xs font-medium text-foreground hover:bg-card/80 dark:hover:bg-[#202c33]/80 transition-all select-none w-64 shadow-sm text-left"
                onClick={() => onDownloadMedia(message)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onDownloadMedia(message);
                  }
                }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  {resolvedMediaType === "video" ? (
                    <VideoCamera className="h-5 w-5" weight="fill" />
                  ) : resolvedMediaType === "image" || resolvedMediaType === "sticker" ? (
                    <ImageSquare className="h-5 w-5" weight="fill" />
                  ) : (
                    <FileIcon className="h-5 w-5" weight="fill" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{getMediaFileName(message)}</p>
                  <p className="text-[10px] text-muted-foreground uppercase mt-0.5">
                    {getMediaFileReferenceLabel(message, resolvedMediaType)} (Indisponível)
                  </p>
                </div>
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary/60 hover:bg-secondary text-foreground transition-colors shrink-0">
                  <ArrowDown className="h-4 w-4" />
                </div>
              </div>
            </div>
          )}

          {mediaUrl && backendOnline && !mediaError && (
            <div className="mb-2" onClick={(event) => event.stopPropagation()}>
              {mediaLoading && (
                <div className="mb-2">
                  <Skeleton className={cn("rounded-lg", resolvedMediaType === "audio" ? "h-10 w-64" : "h-40 w-64")} />
                </div>
              )}

              {resolvedMediaType === "image" && (
                <img
                  src={mediaUrl}
                  alt={message.caption?.trim() || "Imagem enviada"}
                  className="max-w-64 cursor-pointer rounded-lg border border-border"
                  loading="lazy"
                  decoding="async"
                  onClick={() => onOpenMediaPreview({ url: mediaUrl, type: "image", fileName: getMediaFileName(message), messageId: message.id })}
                  onDoubleClick={() => onDownloadMedia(message)}
                  onLoad={() => {
                    setMediaLoading(false);
                  }}
                  onError={() => {
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              )}

              {resolvedMediaType === "video" && (
                <video
                  src={mediaUrl}
                  controls
                  className="max-w-64 cursor-pointer rounded-lg border border-border"
                  preload="metadata"
                  onClick={() => onOpenMediaPreview({ url: mediaUrl, type: "video", fileName: getMediaFileName(message), messageId: message.id })}
                  onLoadedData={() => setMediaLoading(false)}
                  onError={() => {
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              )}

              {resolvedMediaType === "sticker" && (
                <img
                  src={mediaUrl}
                  alt={message.caption?.trim() || "Sticker enviado"}
                  className="max-w-40 cursor-pointer rounded-lg border border-border bg-white/90 p-1"
                  loading="lazy"
                  decoding="async"
                  onClick={() => onOpenMediaPreview({ url: mediaUrl, type: "sticker", fileName: getMediaFileName(message), messageId: message.id })}
                  onDoubleClick={() => onDownloadMedia(message)}
                  onLoad={() => {
                    setMediaLoading(false);
                  }}
                  onError={() => {
                    setMediaLoading(false);
                    setMediaError(true);
                  }}
                />
              )}

              {resolvedMediaType === "audio" && (
                <div className={cn("w-64 rounded-lg border border-border bg-card/90 dark:bg-[#202c33] p-3 flex flex-col gap-2", mediaLoading && "hidden")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{getMediaFileName(message)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{getMediaFileReferenceLabel(message, "audio")}</p>
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-muted dark:hover:bg-white/5 transition-colors"
                      onClick={() => onToggleAudio(message.id, mediaUrl)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onToggleAudio(message.id, mediaUrl);
                        }
                      }}
                    >
                      <PlayCircle className="h-5 w-5" weight="fill" />
                    </div>
                  </div>
                  {isAudioPlaying && (
                    <div className="flex items-center gap-2 mt-1">
                      <Skeleton className="h-1.5 flex-1 bg-muted" style={{ width: `${audioProgress * 100}%` }} />
                      <span className="text-[9px] font-mono text-muted-foreground">{formatPlaybackTime(audioDuration)}</span>
                    </div>
                  )}

                  {/* Transcribe trigger button */}
                  {!transcription && (
                    <div className="flex justify-center mt-1">
                      <button
                        type="button"
                        disabled={isTranscribing}
                        onClick={handleTranscribe}
                        className="flex items-center justify-center gap-1.5 rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 transition-all hover:bg-blue-500/20 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50"
                      >
                        <span className="text-xs">Mic</span>
                        {isTranscribing ? "Transcrevendo..." : "Transcrever"}
                      </button>
                    </div>
                  )}

                  {/* Transcription text display */}
                  {transcription && (
                    <div className="mt-1 border-t border-border/60 dark:border-white/10 pt-2 flex items-start justify-between gap-2">
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-normal font-sans text-left break-words flex-1">
                        {transcription}
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyTranscription}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/5 rounded transition-colors shrink-0"
                        title="Copiar Transcrição"
                      >
                        <CopySimple className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(resolvedMediaType === "file" || resolvedMediaType === "document" || !resolvedMediaType) && (
                <div
                  role="button"
                  tabIndex={0}
                  className="flex items-center gap-3 rounded-lg bg-card/90 dark:bg-[#202c33] border border-border/40 p-3 text-xs font-medium text-foreground hover:bg-card/80 dark:hover:bg-[#202c33]/80 transition-all select-none w-64 shadow-sm text-left"
                  onClick={() => onOpenMediaPreview({ url: mediaUrl, type: "file", fileName: getMediaFileName(message), messageId: message.id })}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00a884] text-white">
                    <FileIcon className="h-5 w-5" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground leading-tight mb-0.5">{getMediaFileName(message)}</p>
                    <p className="truncate text-xs text-muted-foreground opacity-80 uppercase tracking-wide">{getMediaFileReferenceLabel(message)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {parsedOrder ? (
            <div
              className="rounded-2xl overflow-hidden bg-gradient-to-b from-card/95 via-card/90 to-emerald-950/20 dark:from-[#1a252c] dark:via-[#152026] dark:to-emerald-950/30 border border-emerald-500/50 w-[310px] max-w-full shadow-xl my-1 select-none text-left"
              data-testid="whatsapp-order-card"
            >
              {/* Header com badge oficial do WhatsApp */}
              <div className="bg-[#005c4b] p-3 border-b border-emerald-500/30 flex items-center justify-between gap-2 text-white">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block truncate">Pedido WhatsApp</span>
                    <span className="text-[10px] text-white/80 font-mono truncate block">#{parsedOrder.orderId}</span>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[10px] font-semibold shrink-0">
                  {parsedOrder.status}
                </div>
              </div>

              {/* Itens do Pedido */}
              <div className="p-3 space-y-2">
                {parsedOrder.items.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {parsedOrder.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-foreground/90 bg-muted/30 dark:bg-black/20 rounded-lg px-2.5 py-1.5 border border-border/30">
                        <span className="font-medium truncate mr-2">{it.quantity}x {it.name}</span>
                        {it.price && <span className="font-semibold text-emerald-500 dark:text-emerald-400 shrink-0">{it.price}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {displayText}
                  </div>
                )}

                {/* Total */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Total do Pedido:</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{parsedOrder.total}</span>
                </div>

                {parsedOrder.notes && (
                  <p className="text-[11px] text-muted-foreground bg-muted/20 p-1.5 rounded-md italic">
                    Obs: {parsedOrder.notes}
                  </p>
                )}

                {/* Botão Ver Pedido no CRM */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenOrdersDrawer) {
                        onOpenOrdersDrawer();
                      }
                    }}
                    className="w-full py-2 text-center text-xs font-bold text-emerald-300 hover:text-white bg-[#005c4b] hover:bg-[#007a65] rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Ver Detalhes do Pedido
                  </button>
                </div>
              </div>
            </div>
          ) : parsedCatalog ? (
            <div
              className={cn(
                "rounded-2xl overflow-hidden border shadow-lg my-1 select-none text-left w-[290px] max-w-full",
                message.fromMe
                  ? "bg-[#005c4b] border-emerald-500/40 text-white"
                  : "bg-[#202c33] border-slate-700 text-white"
              )}
              data-testid="whatsapp-product-card"
            >
              {/* Product Photo */}
              <div
                className="relative w-full aspect-square max-h-[260px] bg-black/20 overflow-hidden cursor-pointer group"
                onClick={() => onOpenProductDetails ? onOpenProductDetails({
                  id: parsedCatalog.code || "prod",
                  name: parsedCatalog.title,
                  price: parsedCatalog.price,
                  description: parsedCatalog.description,
                  images: parsedCatalog.images && parsedCatalog.images.length > 0 ? parsedCatalog.images : [mediaUrl || parsedCatalog.image],
                  shipping: parsedCatalog.shipping,
                  code: parsedCatalog.code,
                }) : onOpenMediaPreview({ url: mediaUrl || parsedCatalog.image, type: "image", fileName: parsedCatalog.title, messageId: message.id })}
              >
                <img
                  src={getCatalogImageUrl(mediaUrl || parsedCatalog.image)}
                  alt={parsedCatalog.title}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (parsedCatalog.title?.toLowerCase().includes("bloco")) {
                      img.src = '/assets/catalog/bloco_10_100un.png';
                    } else if (parsedCatalog.image && !img.src.includes(parsedCatalog.image)) {
                      img.src = parsedCatalog.image;
                    }
                  }}
                />
              </div>

              {/* Product Meta */}
              <div className="p-3 bg-[#005c4b] text-white">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-white leading-tight">
                    {parsedCatalog.title}
                  </h4>
                </div>

                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="text-sm font-semibold text-white/90">
                    {parsedCatalog.price || "Consulte"}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-white/70">
                    <span>{formatTime(message.timestamp || message.createdAt)}</span>
                    <Check className="h-3.5 w-3.5 text-white/70" />
                  </div>
                </div>

                {/* WhatsApp Official 'Ver' Action Button */}
                <div className="mt-2.5 pt-2 border-t border-white/15">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenProductDetails) {
                        onOpenProductDetails({
                          id: parsedCatalog.code || "prod",
                          name: parsedCatalog.title,
                          price: parsedCatalog.price,
                          description: parsedCatalog.description,
                          images: parsedCatalog.title?.toLowerCase().includes("bloco")
                            ? ["/assets/catalog/bloco_10_100un.png", "/assets/catalog/bloco_10_100un_2.png", "/assets/catalog/bloco_10_100un_3.png"]
                            : (parsedCatalog.images && parsedCatalog.images.length > 0 ? parsedCatalog.images : [mediaUrl || parsedCatalog.image]),
                          shipping: parsedCatalog.shipping,
                          code: parsedCatalog.code,
                        });
                      }
                    }}
                    className="w-full py-1 text-center text-sm font-bold text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer"
                  >
                    Ver
                  </button>
                </div>
              </div>
            </div>
          ) : (resolvedMediaType === "product" || resolvedMediaType === "catalog") ? (
            (() => {
              const rawTxt = displayText || "";
              let cleanCardTitle = rawTxt;
              let cleanCardPrice = "";
              const matchProd = rawTxt.match(/\[PRODUTO(?:\s+WHATSAPP)?\]\s*(.+?)\s*-\s*(?:BRL|R\$)\s*([\d\.,]+)/i);
              if (matchProd) {
                cleanCardTitle = matchProd[1].trim();
                cleanCardPrice = `R$ ${matchProd[2].trim()}`;
              } else {
                const matchBold = rawTxt.match(/\*([^*]+)\*\s*(?:R\$|BRL)?\s*([\d\.,]+)?/i);
                if (matchBold) {
                  cleanCardTitle = matchBold[1].trim();
                  if (matchBold[2]) cleanCardPrice = `R$ ${matchBold[2].trim()}`;
                }
              }
              cleanCardTitle = cleanCardTitle.replace(/^\*+|\*+$/g, "").trim();

              const lower = cleanCardTitle.toLowerCase();
              let fallbackImg = "/assets/catalog/areia_m3.png";
              if (lower.includes("bloco")) fallbackImg = "/assets/catalog/bloco_10_100un.png";
              else if (lower.includes("ac3") || lower.includes("ac-3")) fallbackImg = "/assets/catalog/argamassa_ac3.png";
              else if (lower.includes("ac2") || lower.includes("ac-2")) fallbackImg = "/assets/catalog/argamassa_ac2.png";
              else if (lower.includes("ac1") || lower.includes("ac-1")) fallbackImg = "/assets/catalog/argamassa_ac1.png";
              else if (lower.includes("caminhao de areia") || lower.includes("caminhão de areia")) fallbackImg = "/assets/catalog/caminhao_areia.png";
              else if (lower.includes("areia")) fallbackImg = "/assets/catalog/areia_m3.png";
              else if (lower.includes("brita")) fallbackImg = "/assets/catalog/caminhao_brita.png";
              else if (lower.includes("5000") || lower.includes("5.000")) fallbackImg = "/assets/catalog/caixa_5000l.png";

              const cardImg = mediaUrl || (message as any)?.product?.images?.[0] || (message as any)?.product?.image || fallbackImg;

              return (
                <div
                  className={cn(
                    "rounded-2xl overflow-hidden border shadow-lg my-1 select-none text-left w-[290px] max-w-full",
                    message.fromMe
                      ? "bg-[#005c4b] border-emerald-500/40 text-white"
                      : "bg-[#202c33] border-slate-700 text-white"
                  )}
                  data-testid="whatsapp-product-card"
                >
                  {cardImg && (
                    <div
                      className="relative w-full aspect-square max-h-[260px] bg-black/20 overflow-hidden cursor-pointer group"
                      onClick={() => onOpenProductDetails ? onOpenProductDetails({
                        id: "prod",
                        name: cleanCardTitle || "Produto do Catálogo",
                        price: cleanCardPrice || undefined,
                        images: cleanCardTitle?.toLowerCase().includes("bloco")
                          ? ["/assets/catalog/bloco_10_100un.png", "/assets/catalog/bloco_10_100un_2.png", "/assets/catalog/bloco_10_100un_3.png"]
                          : [cardImg],
                      }) : onOpenMediaPreview({ url: cardImg, type: "image", fileName: cleanCardTitle || "Produto", messageId: message.id })}
                    >
                      <img
                        src={getCatalogImageUrl(cardImg)}
                        alt={cleanCardTitle || "Produto"}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          if (cleanCardTitle?.toLowerCase().includes("bloco")) {
                            img.src = '/assets/catalog/bloco_10_100un.png';
                          } else if (!img.src.includes(fallbackImg)) {
                            img.src = fallbackImg;
                          }
                        }}
                      />
                    </div>
                  )}
                  <div className="p-3 bg-[#005c4b] text-white">
                    <h4 className="font-bold text-sm text-white leading-tight">
                      {cleanCardTitle || "Produto do Catálogo"}
                    </h4>
                    {cleanCardPrice && (
                      <span className="text-sm font-semibold text-white/90 mt-1 block">
                        {cleanCardPrice}
                      </span>
                    )}
                    <div className="flex items-center justify-end gap-1 text-[11px] text-white/70 mt-1">
                      <span>{formatTime(message.timestamp || message.createdAt)}</span>
                      <Check className="h-3.5 w-3.5 text-white/70" />
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/15">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenProductDetails) {
                            onOpenProductDetails({
                              id: "prod",
                              name: cleanCardTitle || "Produto do Catálogo",
                              price: cleanCardPrice || undefined,
                              images: cleanCardTitle?.toLowerCase().includes("bloco")
                                ? ["/assets/catalog/bloco_10_100un.png", "/assets/catalog/bloco_10_100un_2.png", "/assets/catalog/bloco_10_100un_3.png"]
                                : (cardImg ? [cardImg] : []),
                            });
                          }
                        }}
                        className="w-full py-1 text-center text-sm font-bold text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer"
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : parsedDisparo ? (
            <div
              className="rounded-2xl overflow-hidden bg-gradient-to-b from-card/95 via-card/90 to-emerald-950/20 dark:from-[#1a252c] dark:via-[#152026] dark:to-emerald-950/30 border border-emerald-500/50 max-w-[360px] shadow-xl my-1 select-none text-left"
              data-testid="disparo-data-card"
            >
              {/* Header com gradiente e badge oficial */}
              <div className="bg-gradient-to-r from-emerald-600/30 via-teal-600/20 to-transparent p-3 border-b border-emerald-500/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-xs">
                    <Megaphone className="h-4 w-4" weight="fill" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground truncate">Disparo Realizado</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-semibold truncate block">
                      {parsedDisparo.flowName}
                    </span>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-medium shrink-0">
                  {parsedDisparo.cadence || "Anti-Ban"}
                </div>
              </div>

              {/* Corpo com Grid de Dados do Disparo */}
              <div className="p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-muted/40 dark:bg-black/20 rounded-xl p-2.5 border border-border/40">
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase tracking-wider">Destinatário</span>
                    <span className="font-semibold text-foreground truncate block">
                      {parsedDisparo.contactName || formatPhoneNumber(parsedDisparo.phone || message.phone || "")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase tracking-wider">Conexão WhatsApp</span>
                    <span className="font-semibold text-foreground truncate block font-mono">
                      {parsedDisparo.sessionId || message.sessionId || "main"}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1.5 border-t border-border/30 flex items-center justify-between">
                    <span className="text-muted-foreground text-[10px]">
                      {parsedDisparo.totalSteps > 1 ? `Etapa ${parsedDisparo.currentStep} de ${parsedDisparo.totalSteps}` : "Disparo individual"}
                    </span>
                    <span className="text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                      <Checks className="h-3.5 w-3.5 text-emerald-400" weight="bold" />
                      {parsedDisparo.status || "Enviado no WhatsApp"}
                    </span>
                  </div>
                </div>

                {/* Conteúdo / Mensagem enviada no disparo */}
                {parsedDisparo.previewText && (
                  <div className="bg-card/80 dark:bg-[#111b21] rounded-xl p-2.5 border border-border/50 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {parsedDisparo.previewText}
                  </div>
                )}
              </div>
            </div>
          ) : displayText ? (
            <p className="whitespace-pre-wrap">
              <HighlightedMessageText
                text={displayText}
                query={searchQuery ?? ""}
                active={Boolean(isActiveSearchMatch)}
              />
            </p>
          ) : null}

          {isAiMessage && message.fromMe && (
            <AIMessageFeedback
              conversationId={message.conversationId}
              messageId={message.id}
              aiResponseText={displayText}
            />
          )}

          <div className={cn("mt-1 flex flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap text-[10px]", message.fromMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {message.fromMe && (
              <span
                className="inline-flex items-center justify-center leading-none select-none shrink-0"
                title={isAiMessage ? "Atendente IA" : "Atendente Humano"}
                aria-label={isAiMessage ? "Atendente IA" : "Atendente Humano"}
              >
                {isAiMessage ? (
                  <Robot className="h-3 w-3 text-emerald-200/90 dark:text-emerald-300/90" weight="bold" />
                ) : (
                  <User className="h-3.5 w-3.5 text-blue-400 drop-shadow-sm" weight="fill" />
                )}
              </span>
            )}
            <time dateTime={typeof messageTime === "string" ? messageTime || undefined : undefined} title={timeDescription}>{formatTime(messageTime)}</time>
            {message.fromMe && (
              <span className="flex items-center shrink-0 ml-0.5" aria-label={statusMeta.label} title={statusMeta.label}>
                {statusMeta.icon === "clock" ? (
                  <Clock className={cn("h-3.5 w-3.5 shrink-0", statusMeta.className)} />
                ) : statusMeta.icon === "failed" ? (
                  <Check className={cn("h-3.5 w-3.5 shrink-0 text-destructive font-bold", statusMeta.className)} weight="bold" aria-label="1V Vermelho: Não entregue / Bloqueado" />
                ) : statusMeta.icon === "read" || statusMeta.icon === "delivered" ? (
                  <Checks className={cn("h-3.5 w-3.5 shrink-0 text-emerald-500 font-bold", statusMeta.className)} weight="bold" aria-label="2V Verde: Entregue / Lido" />
                ) : (
                  <Check className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/70", statusMeta.className)} aria-label="1V Cinza: Enviado ao servidor" />
                )}
              </span>
            )}
            <button
              type="button"
              aria-label="Opções da mensagem"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              title="Opções da mensagem"
              onClick={() => onToggleMenu(message.id)}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-current hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <DotsThreeVertical className="h-3.5 w-3.5" weight="bold" />
            </button>
          </div>
        </div>

        {reaction && (
          <button
            type="button"
            onClick={() => onToggleReactionPicker(message.id)}
            className={cn(
              "absolute -bottom-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs shadow-sm",
              message.fromMe ? "right-2" : "left-2",
            )}
          >
            {reaction}
          </button>
        )}

        <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            className={cn("absolute z-20 mt-1 w-40 rounded-xl border border-transparent bg-origin-border [background-image:linear-gradient(to_bottom,var(--border)_0%,transparent_100%)] bg-popover/95 backdrop-blur-md p-1 shadow-xl shadow-black/20", message.fromMe ? "right-0" : "left-0")}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-white/10 rounded-t-xl pointer-events-none" />
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={() => onToggleReactionPicker(message.id)}
            >
              <Smiley className="h-3.5 w-3.5" />
              Reagir
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onReplyMessage(message)}>
              <ArrowBendUpRight className="h-3.5 w-3.5" />
              Responder
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onCopyMessage(message)}>
              <CopySimple className="h-3.5 w-3.5" />
              Copiar
            </button>
            <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onForwardMessage(message)}>
              <PaperPlaneTiltIcon className="h-3.5 w-3.5" />
              Encaminhar
            </button>
            {mediaUrl && (
              <>
                <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onOpenMediaPreview({ url: mediaUrl, type: resolvedMediaType === "sticker" ? "sticker" : resolvedMediaType === "audio" ? "audio" : resolvedMediaType === "video" ? "video" : resolvedMediaType === "image" ? "image" : "file", fileName: getMediaFileName(message), messageId: message.id })}>
                  <ImageSquare className="h-3.5 w-3.5" />
                  Abrir mídia
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted" onClick={() => onDownloadMedia(message)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                  Baixar mídia
                </button>
              </>
            )}
            <div className="my-1 h-px bg-border/70" />
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteMessage(message.id, "local")}
            >
              <Trash className="h-3.5 w-3.5" />
              Excluir para mim
            </button>
            {message.fromMe && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                onClick={() => onDeleteMessage(message.id, "everyone")}
              >
                <Trash className="h-3.5 w-3.5" />
                Excluir para todos
              </button>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        <AnimatePresence>
        {isReactionPickerOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.5 }}
            className={cn("absolute z-20 mt-1 flex items-center gap-1.5 rounded-full border border-border/60 bg-popover/95 backdrop-blur-md p-1 shadow-xl shadow-black/20", message.fromMe ? "right-0" : "left-0")}
          >
            {EMOJI_OPTIONS.slice(0, 6).map((emoji) => (
              <motion.button
                whileTap={{ scale: 0.8 }}
                whileHover={{ scale: 1.2 }}
                key={`${message.id}-${emoji}`}
                type="button"
                onClick={() => onReact(message.id, emoji)}
                className={cn("rounded-full px-1.5 py-0.5 text-sm transition-colors", reaction === emoji ? "bg-primary/15" : "hover:bg-muted")}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
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

function PaperPlaneTiltIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 256 256">
      <path fill="currentColor" d="m227.32 28.68a16 16 0 0 0 -15.66-4.08l-180 48a16 16 0 0 0 -3.6 29.32l83.68 41.84l41.84 83.68a16 16 0 0 0 14.31 8.84a16.1 16.1 0 0 0 1.6 0a16 16 0 0 0 13.39-12.72l48-180a16 16 0 0 0 -4.08-14.88m-112 112L49.07 107.5L208 65.23ZM148.5 206.93l-32.27-64.55L208 65.23Z"/>
    </svg>
  );
}


