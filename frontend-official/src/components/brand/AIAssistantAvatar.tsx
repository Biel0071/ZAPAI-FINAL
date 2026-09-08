import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkle, Brain, Check } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";

export interface AIAssistantAvatarProps {
  className?: string;
  avatarUrl?: string;
  name?: string;
  role?: string;
  description?: string;
  status?: "online" | "busy" | "offline";
  selected?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  layout?: "avatar-only" | "compact" | "horizontal" | "vertical";
  onClick?: () => void;
}

export function AIAssistantAvatar({
  className,
  avatarUrl,
  name = "Camila — Especialista ZAI",
  role = "Atendente Comercial IA",
  description,
  status = "online",
  selected = false,
  size = "md",
  layout = "horizontal",
  onClick,
}: AIAssistantAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const sizeMap = {
    xs: { box: "h-7 w-7", icon: "h-3.5 w-3.5", ring: "h-2 w-2 -bottom-0.5 -right-0.5" },
    sm: { box: "h-9 w-9", icon: "h-4 w-4", ring: "h-2.5 w-2.5 -bottom-0.5 -right-0.5" },
    md: { box: "h-11 w-11", icon: "h-5 w-5", ring: "h-3 w-3 -bottom-0.5 -right-0.5" },
    lg: { box: "h-14 w-14", icon: "h-7 w-7", ring: "h-3.5 w-3.5 -bottom-1 -right-1" },
    xl: { box: "h-16 w-16", icon: "h-8 w-8", ring: "h-4 w-4 -bottom-1 -right-1" },
  };

  const statusColor = {
    online: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]",
    busy: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]",
    offline: "bg-slate-500",
  }[status];

  const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
  const resolvedUrl = avatarUrl || defaultAvatar;

  const avatarBox = (
    <div className="relative shrink-0 select-none">
      <div
        className={cn(
          "flex items-center justify-center rounded-xl overflow-hidden border transition-all duration-200",
          selected
            ? "border-primary ring-2 ring-primary/40 shadow-[0_0_16px_rgba(16,185,129,0.3)]"
            : "border-border/60 bg-gradient-to-br from-emerald-950/40 via-card to-background",
          sizeMap[size].box
        )}
      >
        {!imageFailed ? (
          <img
            src={resolvedUrl}
            alt={name}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white">
            <Brain weight="fill" className={sizeMap[size].icon} />
          </div>
        )}
      </div>

      {/* Online indicator */}
      {status !== "offline" ? (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full border-2 border-background",
            statusColor,
            sizeMap[size].ring
          )}
        >
          {status === "online" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
        </span>
      ) : (
        <span
          className={cn(
            "absolute rounded-full border-2 border-background bg-muted-foreground",
            sizeMap[size].ring
          )}
        />
      )}

      {selected && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="h-2.5 w-2.5 stroke-[3]" />
        </span>
      )}
    </div>
  );

  if (layout === "avatar-only") {
    return (
      <div
        className={cn("inline-flex", onClick && "cursor-pointer", className)}
        onClick={onClick}
        title={`${name} (${role})`}
      >
        {avatarBox}
      </div>
    );
  }

  if (layout === "vertical") {
    return (
      <div
        className={cn(
          "flex flex-col items-center text-center p-3 rounded-xl border transition-all",
          selected
            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
            : "border-border/60 bg-card/60 hover:border-border",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        {avatarBox}
        <h4 className="font-display text-sm font-bold text-foreground mt-2 truncate max-w-full">
          {name}
        </h4>
        <span className="text-[11px] font-medium text-muted-foreground truncate max-w-full">
          {role}
        </span>
        {description && (
          <p className="mt-1 text-[10.5px] text-muted-foreground/90 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 transition-all",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {avatarBox}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-xs sm:text-sm font-bold text-foreground truncate">
            {name}
          </span>
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-1.5 py-0 h-4 uppercase tracking-wider shrink-0"
          >
            IA
          </Badge>
        </div>
        <span className="text-[11px] text-muted-foreground truncate">
          {role}
        </span>
        {description && layout !== "compact" && (
          <p className="text-[10.5px] text-muted-foreground/80 line-clamp-1 mt-0.5">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
