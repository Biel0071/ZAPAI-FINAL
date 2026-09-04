import React from "react";
import { cn } from "@/lib/utils";
import { Checks, FileText, Image, VideoCamera, MusicNotes, Sticker } from "@phosphor-icons/react";

interface WhatsAppMessagePreviewProps {
  messageText: string;
  mediaType?: "text" | "image" | "video" | "audio" | "document" | "file" | "sticker" | null;
  mediaName?: string | null;
  time?: string;
  senderName?: string;
  className?: string;
}

export function WhatsAppMessagePreview({
  messageText,
  mediaType = "text",
  mediaName,
  time = "12:00",
  senderName = "Você",
  className
}: WhatsAppMessagePreviewProps) {
  
  const renderMedia = () => {
    if (!mediaType || mediaType === "text") return null;

    const mediaStyles = "mb-2 flex flex-col items-center justify-center rounded-lg bg-black/10 py-4";
    
    switch (mediaType) {
      case "image":
        return (
          <div className={cn(mediaStyles, "h-32 bg-black/20")}>
            <Image className="h-8 w-8 text-white/70" weight="fill" />
            {mediaName && <span className="mt-2 text-[10px] text-white/70 px-2 truncate max-w-full">{mediaName}</span>}
          </div>
        );
      case "video":
        return (
          <div className={cn(mediaStyles, "h-32 bg-black/20")}>
            <VideoCamera className="h-8 w-8 text-white/70" weight="fill" />
            {mediaName && <span className="mt-2 text-[10px] text-white/70 px-2 truncate max-w-full">{mediaName}</span>}
          </div>
        );
      case "audio":
        return (
          <div className="mb-2 flex items-center gap-3 rounded-full bg-black/10 px-4 py-2">
            <MusicNotes className="h-5 w-5 text-whatsapp-dark" weight="fill" />
            <div className="h-1 flex-1 rounded-full bg-black/10">
              <div className="h-full w-1/3 rounded-full bg-whatsapp-dark"></div>
            </div>
          </div>
        );
      case "sticker":
        return (
          <div className="mb-2 flex items-center justify-center py-2">
            <Sticker className="h-16 w-16 text-black/30" weight="fill" />
          </div>
        );
      default:
        return (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-black/10 p-3">
            <FileText className="h-6 w-6 text-black/50" weight="fill" />
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-medium text-black/70">{mediaName || "Documento"}</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn(
      "relative flex w-full max-w-[320px] flex-col rounded-xl rounded-tr-none bg-[#E7FFDB] p-2 text-sm shadow-sm dark:bg-[#005C4B] dark:text-white",
      className
    )}>
      {senderName && (
        <span className="mb-1 text-xs font-bold text-whatsapp-dark dark:text-emerald-300">
          {senderName}
        </span>
      )}
      
      {renderMedia()}

      <div className="whitespace-pre-wrap break-words leading-relaxed text-[#111B21] dark:text-[#E9EDEF]">
        {messageText}
      </div>

      <div className="mt-1 flex items-center justify-end gap-1">
        <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">{time}</span>
        <Checks className="h-[14px] w-[14px] text-[#53BDEB]" weight="regular" />
      </div>

      {/* Balao de fala pointer */}
      <div className="absolute right-[-8px] top-0 h-4 w-4 overflow-hidden">
        <div className="absolute -left-2 -top-2 h-4 w-4 rotate-45 rounded-sm bg-[#E7FFDB] dark:bg-[#005C4B]"></div>
      </div>
    </div>
  );
}
