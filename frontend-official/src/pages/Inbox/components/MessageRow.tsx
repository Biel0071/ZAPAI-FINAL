import { memo, useState, useEffect, useRef } from "react";
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
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/services/apiService";
import { apiService } from "@/services/apiService";
import { useToast } from "@/hooks/use-toast";
import type { PreviewMediaState } from "../types";
import {
  resolveMediaUrl,
  resolveCachedMediaUrl,
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
} from "../utils";

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
}: {
  message: ChatMessage;
  reaction?: string;
  onReact: (messageId: string, emoji: string) => void;
  onOpenMediaPreview: (media: PreviewMediaState) => void;
  isMenuOpen: boolean;
  isReactionPickerOpen: boolean;
  onToggleMenu: (messageId: string) => void;
  onToggleReactionPicker: (messageId: string) => void;
  onCopyMessage: (message: ChatMessage) => void;
  onReplyMessage: (message: ChatMessage) => void;
  onForwardMessage: (message: ChatMessage) => void;
  onDeleteMessage: (messageId: string, scope: "local" | "everyone") => void;
  onDownloadMedia: (message: ChatMessage) => void;
  onToggleAudio: (messageId: string, url: string) => void;
  isAudioLoading: boolean;
  isAudioPlaying: boolean;
  audioProgress: number;
  audioDuration: number;
  backendOnline: boolean;
  searchQuery?: string;
  isActiveSearchMatch?: boolean;
}) {
  const explicitMessageType = (message as any).messageType;
  
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const rawUrl = extractMessageAssetUrl(message);
    if (!rawUrl) {
      setCachedUrl(null);
      return;
    }

    const loadCached = async () => {
      const result = await resolveCachedMediaUrl(rawUrl);
      if (active) {
        setCachedUrl(result);
      }
    };

    void loadCached();

    return () => {
      active = false;
      if (cachedUrl && cachedUrl.startsWith("blob:")) {
        URL.revokeObjectURL(cachedUrl);
      }
    };
  }, [message.id]);

  const fallbackMediaUrl = resolveMediaUrl(extractMessageAssetUrl(message));
  const mediaUrl = cachedUrl || fallbackMediaUrl;
  const resolvedMediaType =
    message.mediaType ??
    explicitMessageType ??
    inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? "")) ??
    inferMediaTypeFromSource(mediaUrl ?? undefined);
  const hasRenderableMedia = Boolean(resolvedMediaType && resolvedMediaType !== "text");
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
  const showFallbackCard = hasRenderableMedia && (mediaError || !mediaUrl);
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
    if (!hasRenderableMedia || mediaUrl) return;
    if (mediaResolveLoggedRef.current) return;
    mediaResolveLoggedRef.current = true;
    logInboxDebug("media:missing-url", {
      messageId: message.id,
      conversationId: message.conversationId ?? null,
      mediaType: resolvedMediaType ?? null,
      messageUrl: message.url ?? null,
      messageMediaUrl: message.mediaUrl ?? null,
      messageMediaPath: message.mediaPath ?? null,
      content: message.content ?? null,
      caption: message.caption ?? null,
      backendOnline,
    });
  }, [hasRenderableMedia, mediaUrl, message, resolvedMediaType, backendOnline]);

  useEffect(() => {
    if (!mediaError || mediaErrorLoggedRef.current) return;
    mediaErrorLoggedRef.current = true;
    logInboxDebug("media:load-error", {
      messageId: message.id,
      conversationId: message.conversationId ?? null,
      mediaType: resolvedMediaType ?? null,
      mediaUrl,
      messageUrl: message.url ?? null,
      messageMediaUrl: message.mediaUrl ?? null,
      messageMediaPath: message.mediaPath ?? null,
      backendOnline,
    });
  }, [backendOnline, mediaError, mediaUrl, message, resolvedMediaType]);

  const safeTextContent = getMessageDisplayContent(message);
  const displayText = hasRenderableMedia && safeTextContent === getMediaTypeLabel(resolvedMediaType) ? "" : safeTextContent;

  const EMOJI_OPTIONS = ["\u{1F600}", "\u{1F602}", "\u{1F60D}", "\u{1F44D}", "\u{1F525}", "\u{1F44F}", "\u{1F64F}", "\u{2705}", "\u{1F4E6}", "\u{1F69A}"];

  const isAiMessage = Boolean(
    message.sender === 'agent' ||
    message.isAi ||
    (message as any).isAiGenerated ||
    (message as any).source === 'ai' ||
    (message as any).source === 'agent' ||
    (message as any).metadata?.source === 'ai' ||
    (message as any).agentName
  );

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "flex group/bubble scroll-mt-28 rounded-lg transition-colors",
        message.fromMe && "justify-end",
        isActiveSearchMatch && "bg-amber-400/10 ring-1 ring-amber-400/40",
      )}
    >
      <div className="relative pb-3 max-w-[80%]">
        <div
          className={cn(
            "absolute top-2 hidden md:flex items-center gap-0.5 bg-[#181d26]/90 border border-border/80 rounded-full p-1 shadow-md backdrop-blur-sm z-20 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150",
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

        <button
          type="button"
          onClick={() => onToggleMenu(message.id)}
          className={cn(
            "chat-bubble text-left transition-all duration-150",
            message.fromMe
              ? (isAiMessage
                  ? "bg-emerald-950/90 border border-emerald-500/60 text-emerald-50 shadow-md shadow-emerald-950/50"
                  : "chat-bubble-sent")
              : "chat-bubble-received"
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
                className="flex items-center gap-3 rounded-lg bg-[#202c33] border border-border/40 p-3 text-xs font-medium text-foreground hover:bg-[#202c33]/80 transition-all select-none w-64 shadow-sm text-left"
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
                <div className={cn("w-64 rounded-lg border border-border bg-[#202c33] p-3 flex flex-col gap-2", mediaLoading && "hidden")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">{getMediaFileName(message)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{getMediaFileReferenceLabel(message, "audio")}</p>
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/5"
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
                        className="flex items-center justify-center gap-1.5 rounded-full border border-blue-500/50 bg-blue-500/10 px-4 py-1 text-xs font-semibold text-blue-400 transition-all hover:bg-blue-500/20 hover:text-blue-300 disabled:opacity-50"
                      >
                        <span className="text-xs">Mic</span>
                        {isTranscribing ? "Transcrevendo..." : "Transcrever"}
                      </button>
                    </div>
                  )}

                  {/* Transcription text display */}
                  {transcription && (
                    <div className="mt-1 border-t border-white/10 pt-2 flex items-start justify-between gap-2">
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-normal font-sans text-left break-words flex-1">
                        {transcription}
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyTranscription}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors shrink-0"
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
                  className="flex items-center gap-3 rounded-lg bg-[#202c33] border border-border/40 p-3 text-xs font-medium text-foreground hover:bg-[#202c33]/80 transition-all select-none w-64 shadow-sm text-left"
                  onClick={() => onOpenMediaPreview({ url: mediaUrl, type: "file", fileName: getMediaFileName(message), messageId: message.id })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenMediaPreview({ url: mediaUrl, type: "file", fileName: getMediaFileName(message), messageId: message.id });
                    }
                  }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00a884] text-white">
                    <FileIcon className="h-5 w-5" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{getMediaFileName(message)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{getMediaFileReferenceLabel(message, resolvedMediaType)}</p>
                  </div>
                  <div className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary/60 hover:bg-secondary text-foreground transition-colors shrink-0">
                    <ArrowDown className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>
          )}

          {displayText && (
            <p className="whitespace-pre-wrap">
              <HighlightedMessageText
                text={displayText}
                query={searchQuery ?? ""}
                active={Boolean(isActiveSearchMatch)}
              />
            </p>
          )}

          <div className={cn("mt-1 flex items-center gap-1.5 text-[10px]", message.fromMe ? "justify-end text-primary-foreground/70" : "text-muted-foreground")}>
            {isAiMessage && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 shrink-0 shadow-sm"
                title={`Mensagem gerada por IA${(message as any).agentName ? ` (${(message as any).agentName})` : ''}`}
              >
                <Robot className="h-3 w-3 text-emerald-400 animate-pulse" weight="fill" />
              </span>
            )}
            {message.fromMe && !isAiMessage && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 shrink-0 shadow-sm"
                title="Mensagem enviada por um atendente humano"
              >
                <User className="h-3 w-3 text-blue-400" weight="fill" />
              </span>
            )}
            <span>{formatTime(message.createdAt)}</span>
            {message.fromMe && (
              <span className="flex items-center shrink-0 ml-0.5" aria-label={statusMeta.label} title={statusMeta.label}>
                {statusMeta.icon === "clock" ? (
                  <Clock className={cn("h-3.5 w-3.5 shrink-0", statusMeta.className)} />
                ) : statusMeta.icon === "failed" ? (
                  <Check className={cn("h-3.5 w-3.5 shrink-0 text-destructive font-bold", statusMeta.className)} weight="bold" title="1V Vermelho: Não entregue / Bloqueado" />
                ) : statusMeta.icon === "read" || statusMeta.icon === "delivered" ? (
                  <Checks className={cn("h-3.5 w-3.5 shrink-0 text-emerald-500 font-bold", statusMeta.className)} weight="bold" title="2V Verde: Entregue / Lido" />
                ) : (
                  <Check className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/70", statusMeta.className)} title="1V Cinza: Enviado ao servidor" />
                )}
              </span>
            )}
          </div>
        </button>

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

        {isMenuOpen && (
          <div className={cn("absolute z-20 mt-1 w-40 rounded-lg border border-border bg-popover p-1 shadow-lg", message.fromMe ? "right-0" : "left-0")}>
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
          </div>
        )}

        {isReactionPickerOpen && (
          <div className={cn("absolute z-20 mt-1 flex items-center gap-1 rounded-full border border-border bg-popover p-1 shadow-lg", message.fromMe ? "right-0" : "left-0")}>
            {EMOJI_OPTIONS.slice(0, 6).map((emoji) => (
              <button
                key={`${message.id}-${emoji}`}
                type="button"
                onClick={() => onReact(message.id, emoji)}
                className={cn("rounded-full px-1.5 py-0.5 text-sm transition-colors", reaction === emoji ? "bg-primary/15" : "hover:bg-muted")}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.reaction === nextProps.reaction &&
    prevProps.isMenuOpen === nextProps.isMenuOpen &&
    prevProps.isReactionPickerOpen === nextProps.isReactionPickerOpen &&
    prevProps.isAudioPlaying === nextProps.isAudioPlaying &&
    prevProps.isAudioLoading === nextProps.isAudioLoading &&
    prevProps.audioProgress === nextProps.audioProgress &&
    prevProps.isActiveSearchMatch === nextProps.isActiveSearchMatch &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.backendOnline === nextProps.backendOnline
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


