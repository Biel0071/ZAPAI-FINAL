import React from "react";
import { cn } from "@/lib/utils";
import { Checks, FileText, Image, VideoCamera, MusicNotes, Sticker, Sparkle } from "@phosphor-icons/react";
import { AIAssistantAvatar } from "@/components/brand/AIAssistantAvatar";

interface WhatsAppMessagePreviewProps {
  messageText: string;
  mediaType?: "text" | "image" | "video" | "audio" | "document" | "file" | "sticker" | null;
  mediaName?: string | null;
  time?: string;
  senderName?: string;
  senderAvatarUrl?: string;
  showAvatar?: boolean;
  className?: string;
}

/**
 * Highlights WhatsApp personalization variables like {nome}, {cidade}, {produto}
 */
function renderMessageWithVariables(text: string) {
  if (!text) return null;
  const parts = text.split(/(\{[a-zA-Z0-9_-]+\})/g);

  return parts.map((part, index) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      return (
        <span
          key={index}
          className="inline-block px-1 py-0.2 mx-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px] border border-emerald-500/30"
          title={`Variável dinâmica: ${part}`}
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function WhatsAppMessagePreview({
  messageText,
  mediaType = "text",
  mediaName,
  time = "10:42",
  senderName = "Camila • ZAI AI",
  senderAvatarUrl,
  showAvatar = true,
  className,
}: WhatsAppMessagePreviewProps) {
  const renderMedia = () => {
    if (!mediaType || mediaType === "text") return null;

    const mediaStyles = "mb-2 flex flex-col items-center justify-center rounded-lg bg-black/10 py-3";

    switch (mediaType) {
      case "image":
        return (
          <div className={cn(mediaStyles, "h-28 bg-black/20")}>
            <Image className="h-7 w-7 text-white/70" weight="fill" />
            {mediaName && (
              <span className="mt-1.5 text-[10px] text-white/80 px-2 truncate max-w-full font-medium">
                {mediaName}
              </span>
            )}
          </div>
        );
      case "video":
        return (
          <div className={cn(mediaStyles, "h-28 bg-black/20")}>
            <VideoCamera className="h-7 w-7 text-white/70" weight="fill" />
            {mediaName && (
              <span className="mt-1.5 text-[10px] text-white/80 px-2 truncate max-w-full font-medium">
                {mediaName}
              </span>
            )}
          </div>
        );
      case "audio":
        return (
          <div className="mb-2 flex items-center gap-2.5 rounded-full bg-black/10 px-3.5 py-1.5">
            <MusicNotes className="h-4 w-4 text-whatsapp-dark dark:text-emerald-400" weight="fill" />
            <div className="h-1 flex-1 rounded-full bg-black/15">
              <div className="h-full w-2/5 rounded-full bg-whatsapp-dark dark:bg-emerald-400"></div>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground">0:18</span>
          </div>
        );
      case "sticker":
        return (
          <div className="mb-2 flex items-center justify-center py-2">
            <Sticker className="h-14 w-14 text-black/30" weight="fill" />
          </div>
        );
      default:
        return (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-black/10 p-2.5">
            <FileText className="h-5 w-5 text-black/60 dark:text-white/60" weight="fill" />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-semibold text-foreground/90">
                {mediaName || "Documento Anexo"}
              </span>
              <span className="text-[9px] text-muted-foreground">Arquivo para WhatsApp</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn("flex items-start gap-2 max-w-[360px]", className)}>
      {showAvatar && (
        <AIAssistantAvatar
          size="xs"
          name={senderName}
          avatarUrl={senderAvatarUrl}
          layout="avatar-only"
          className="mt-0.5"
        />
      )}

      <div
        className={cn(
          "relative flex flex-1 flex-col rounded-2xl rounded-tl-none p-3 text-xs shadow-md",
          "bg-[#E7FFDB] text-[#111B21] border border-[#d2f3c0]",
          "dark:bg-[#005C4B] dark:text-[#E9EDEF] dark:border-emerald-700/40"
        )}
      >
        {senderName && (
          <div className="mb-1 flex items-center justify-between gap-2 border-b border-black/5 pb-1 dark:border-white/10">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate">
              {senderName}
            </span>
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <Sparkle className="h-2.5 w-2.5" weight="fill" /> Atendente IA
            </span>
          </div>
        )}

        {renderMedia()}

        <div className="whitespace-pre-wrap break-words leading-relaxed text-[11.5px] font-sans">
          {renderMessageWithVariables(messageText)}
        </div>

        <div className="mt-1.5 flex items-center justify-end gap-1 select-none">
          <span className="text-[9.5px] text-[#667781] dark:text-[#8696A0] font-mono">
            {time}
          </span>
          <Checks className="h-3.5 w-3.5 text-[#53BDEB]" weight="regular" />
        </div>

        {/* WhatsApp bubble pointer (left-top) */}
        <div className="absolute -left-1.5 top-0 h-3 w-3 overflow-hidden">
          <div className="absolute left-1 top-0 h-3 w-3 rotate-45 rounded-sm bg-[#E7FFDB] dark:bg-[#005C4B]"></div>
        </div>
      </div>
    </div>
  );
}
