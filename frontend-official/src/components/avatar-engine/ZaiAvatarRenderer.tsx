/**
 * ZAI CRM Enterprise — Modular ZAI Avatar Renderer
 * Renders layered, customizable, isometric pixel-art avatars with real-time state machine overlays,
 * dynamic store branding, equipment slots, and micro-animations.
 */

import React, { useMemo } from "react";
import { AgentAvatarConfig, AnimationState, StoreBranding } from "./AvatarDefinition";
import { resolveSpriteForAvatar } from "./CharacterFactory";
import { cn } from "@/core/lib/utils";
import {
  Sparkle,
  ChatCircleDots,
  CheckCircle,
  WarningCircle,
  Clock,
} from "@phosphor-icons/react";

export interface ZaiAvatarRendererProps {
  avatar: Partial<AgentAvatarConfig>;
  state?: AnimationState;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "workspace";
  showAura?: boolean;
  showStatusBadge?: boolean;
  showBrandingLayer?: boolean;
  className?: string;
  onClick?: () => void;
}

const SIZE_CONFIGS = {
  xs: { container: "w-10 h-14", sprite: "max-h-14", badge: "text-[9px] px-1 py-0.5", indicator: "w-2 h-2" },
  sm: { container: "w-16 h-20", sprite: "max-h-20", badge: "text-[10px] px-1.5 py-0.5", indicator: "w-2.5 h-2.5" },
  md: { container: "w-24 h-32", sprite: "max-h-32", badge: "text-[11px] px-2 py-0.5", indicator: "w-3 h-3" },
  lg: { container: "w-36 h-48", sprite: "max-h-48", badge: "text-xs px-2.5 py-1", indicator: "w-3.5 h-3.5" },
  xl: { container: "w-48 h-64", sprite: "max-h-64", badge: "text-xs px-3 py-1", indicator: "w-4 h-4" },
  workspace: { container: "w-full h-full max-h-[380px]", sprite: "h-full max-h-[360px]", badge: "text-xs px-3 py-1", indicator: "w-4 h-4" },
};

const STATE_LABELS: Record<AnimationState, string> = {
  IDLE: "Aguardando",
  WAITING: "Aguardando",
  WORKING: "No PC · operando",
  THINKING: "Processando",
  TYPING: "Digitando",
  TALKING: "Conversando",
  WALKING: "Em atividade",
  SUCCESS: "Concluído",
  ERROR: "Atenção",
  ALERT: "Atenção",
  OFFLINE: "Pausado",
};

export const ZaiAvatarRenderer: React.FC<ZaiAvatarRendererProps> = ({
  avatar,
  state: stateProp,
  size = "md",
  showAura = true,
  showStatusBadge = false,
  showBrandingLayer = true,
  className,
  onClick,
}) => {
  const currentState = stateProp || avatar.animationState || "WAITING";
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  // Resolve matching sprite file
  const spriteId = useMemo(() => resolveSpriteForAvatar(avatar), [avatar]);
  const spriteSrc = `/assets/avatar_factory/catalog/${spriteId}_clean.png`;

  // Branding attributes with robust fallbacks
  const rawBranding = avatar?.branding || (avatar as any)?.storeBranding || {};
  const branding: StoreBranding = {
    storeName: rawBranding.storeName || "ZAI CRM",
    primaryColor: rawBranding.primaryColor || rawBranding.primaryBrandColor || "#10b981",
    secondaryColor: rawBranding.secondaryColor || rawBranding.secondaryBrandColor || "#0f172a",
    accentColor: rawBranding.accentColor || "#00f090",
    logo: rawBranding.logo || rawBranding.logoUrl || "ZAI",
    showLogoOnChest: rawBranding.showLogoOnChest ?? true,
    showLogoOnBadge: rawBranding.showLogoOnBadge ?? true,
  };

  // State visuals & auras
  const isOperating = currentState !== "OFFLINE";
  const isTalking = currentState === "TALKING";
  const isThinking = currentState === "THINKING";
  const isWorking = currentState === "WORKING" || currentState === "TYPING";
  const showWorkstation = (isWorking || isThinking || isTalking) && (size === "workspace" || size === "xl");
  const isSuccess = currentState === "SUCCESS";
  const isAlert = currentState === "ALERT" || currentState === "ERROR";
  const isOffline = currentState === "OFFLINE";
  // Lower catalog rows include a small remnant of the preceding row.
  const spriteTopInset = /^sprite_r[23]_/.test(spriteId) ? "8%" : "0";
  const spriteLeftInset = spriteId === "sprite_r3_c5" ? "28%" : "0";

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-end select-none transition-all group",
        sizeConfig.container,
        onClick && "cursor-pointer hover:scale-105",
        className
      )}
      style={{
        imageRendering: "pixelated",
      }}
    >
      {/* 1. Floor Shadow Layer */}
      <div
        className={cn(
          "absolute bottom-1 w-3/4 h-4 rounded-full transition-all duration-500",
          isOffline
            ? "bg-black/30 blur-sm"
            : "bg-black/50 blur-[3px]"
        )}
        style={{
          boxShadow: showAura && isOperating
            ? `0 0 24px ${branding.primaryColor}55`
            : undefined,
        }}
      />

      {/* 2. Ambient Aura Glow based on State & Store Color */}
      {showAura && isOperating && (
        <div
          className={cn(
            "absolute inset-0 pointer-events-none rounded-full blur-2xl opacity-30 transition-all duration-700",
            isTalking && "animate-pulse opacity-50",
            isThinking && "opacity-40 animate-pulse",
            isSuccess && "opacity-60 scale-110",
            isAlert && "opacity-40 bg-amber-500/40"
          )}
          style={{
            backgroundColor: isAlert ? "#f59e0b" : branding.primaryColor,
          }}
        />
      )}

      {/* 3. Base Character Sprite (High-Fidelity Isometric Pixel Art) */}
      <div className="relative z-10 flex items-center justify-center w-fit max-w-full h-full">
        <img
          src={spriteSrc}
          alt={avatar.agentId || "Agent Avatar"}
          className={cn(
            "object-contain w-auto transition-transform duration-300 pointer-events-none drop-shadow-md",
            sizeConfig.sprite,
            isOffline && "grayscale contrast-75 opacity-70",
            isTalking && "animate-bounce-subtle",
            currentState === "WALKING" && "animate-walk-step"
          )}
          style={{
            imageRendering: "pixelated",
            clipPath: `inset(${spriteTopInset} 0 ${showWorkstation ? "22%" : "0"} ${spriteLeftInset})`,
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.onerror = null;
            if (!target.src.includes("sprite_r2_c1_clean.png")) {
              target.src = "/assets/avatar_factory/catalog/sprite_r2_c1_clean.png";
            }
          }}
        />

        {showWorkstation && (
          <div aria-hidden="true" className="absolute bottom-[12%] z-20 h-[36%] w-[85%] max-w-[260px] pointer-events-none">
            <div className="absolute right-0 top-0 h-[55%] w-[44%] rounded-md border-2 border-slate-600 bg-[#07131b] p-2 shadow-lg">
              <div className="space-y-1.5">
                <div className="h-1 w-3/4 rounded-full" style={{ backgroundColor: branding.primaryColor }} />
                <div className="h-1 w-full rounded-full bg-slate-700" />
                <div className="h-1 w-2/3 rounded-full bg-slate-700" />
              </div>
            </div>
            <div className="absolute right-[20%] top-[55%] h-[10%] w-2 bg-slate-600" />
            <div className="absolute bottom-[34%] inset-x-0 h-3 rounded-sm border border-slate-500 bg-slate-700 shadow-lg" />
            <div className="absolute left-[8%] bottom-0 h-[34%] w-2 bg-slate-600" />
            <div className="absolute right-[8%] bottom-0 h-[34%] w-2 bg-slate-600" />
          </div>
        )}

        {/* 4. Dynamic Store Branding Layer (Logo on Chest / Cap / Badge) */}
        {showBrandingLayer && isOperating && (
          <>
            {/* Chest Logo Badge */}
            {branding.showLogoOnChest !== false && (
              <div
                className="absolute top-[48%] left-[50%] -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
                title={`Uniforme Oficial: ${branding.storeName}`}
              >
                {(() => {
                  const isUrl = branding.logo && (branding.logo.startsWith("http") || branding.logo.startsWith("/"));
                  const displayText = isUrl
                    ? (branding.storeName ? branding.storeName.split(" ")[0].toUpperCase().slice(0, 8) : "ZAI")
                    : (branding.logo || "ZAI").slice(0, 10);

                  return (
                    <div
                      className="px-1 py-[1px] rounded-[3px] text-[7px] font-black uppercase tracking-wider shadow-sm flex items-center gap-0.5 border max-w-[50px] overflow-hidden"
                      style={{
                        backgroundColor: branding.secondaryColor || "#0f172a",
                        borderColor: `${branding.primaryColor}88`,
                        color: branding.accentColor || "#00f090",
                      }}
                    >
                      {isUrl ? (
                        <img src={branding.logo} alt="Logo" className="w-2 h-2 rounded-[1px] object-cover shrink-0" />
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      )}
                      <span className="truncate">{displayText}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Lanyard ID Badge Indicator */}
            {avatar.badge !== false && (
              <div
                className="absolute top-[58%] left-[52%] -translate-x-1/2 pointer-events-none"
                title={`Crachá Oficial ${branding.storeName}`}
              >
                <div
                  className="w-1.5 h-2 rounded-[1px] shadow-sm border-[0.5px] border-white/40"
                  style={{
                    backgroundColor: branding.primaryColor || "#10b981",
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* 5. Headset LED & Voice Pulse Animation (when TALKING / RESPONDING) */}
        {avatar.headset !== "none" && isOperating && (
          <div
            className="absolute top-[28%] left-[28%] pointer-events-none"
            title="Headset ZAI Ativo"
          >
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_#00f090]",
                isTalking ? "bg-emerald-300 animate-ping" : "bg-emerald-400"
              )}
            />
          </div>
        )}

        {/* 6. Speech / Audio Waves Layer (when TALKING) */}
        {isTalking && (
          <div className="absolute top-[22%] right-[10%] pointer-events-none flex items-center gap-0.5 bg-background/85 backdrop-blur-sm border border-emerald-500/40 px-2 py-0.5 rounded-full shadow-lg animate-bounce">
            <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
            <span className="w-1 h-4 bg-emerald-300 rounded-full animate-pulse delay-75" />
            <span className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse delay-150" />
            <span className="text-[9px] font-bold text-emerald-400 ml-1">FALANDO</span>
          </div>
        )}

        {/* 7. Thinking / AI Processing Sparkles (when THINKING) */}
        {isThinking && (
          <div className="absolute top-[16%] left-[50%] -translate-x-1/2 pointer-events-none flex items-center gap-1 bg-cyan-950/80 border border-cyan-400/50 px-2 py-0.5 rounded-full shadow-lg animate-pulse">
            <Sparkle className="w-3 h-3 text-cyan-300 animate-spin" weight="fill" />
            <span className="text-[9px] font-bold text-cyan-300 tracking-wider">PENSANDO</span>
          </div>
        )}

        {/* 8. Success Conversion Stars (when SUCCESS) */}
        {isSuccess && (
          <div className="absolute -top-3 left-[50%] -translate-x-1/2 pointer-events-none flex items-center gap-1 bg-emerald-950/90 border border-emerald-400 px-2.5 py-0.5 rounded-full shadow-xl animate-bounce">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" weight="fill" />
            <span className="text-[10px] font-extrabold text-emerald-300">CONCLUÍDO</span>
          </div>
        )}

        {/* 9. Alert Indicator (when ALERT or ERROR) */}
        {isAlert && (
          <div className="absolute -top-3 left-[50%] -translate-x-1/2 pointer-events-none flex items-center gap-1 bg-amber-950/90 border border-amber-400 px-2.5 py-0.5 rounded-full shadow-xl animate-pulse">
            <WarningCircle className="w-3.5 h-3.5 text-amber-400" weight="fill" />
            <span className="text-[10px] font-bold text-amber-300">ATENÇÃO</span>
          </div>
        )}

        {/* 10. Offline Sleeping / Paused Pill */}
        {isOffline && (
          <div className="absolute -top-2 left-[50%] -translate-x-1/2 pointer-events-none flex items-center gap-1 bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded-full shadow-md">
            <Clock className="w-3 h-3 text-slate-400" weight="bold" />
            <span className="text-[9px] font-medium text-slate-400">PAUSADO</span>
          </div>
        )}
      </div>

      {/* Optional Status Badge Below Avatar */}
      {showStatusBadge && (
        <div className="mt-1 relative z-20">
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider border shadow-sm",
              sizeConfig.badge,
              isAlert
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                : isOperating
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "bg-slate-800/60 border-slate-700 text-slate-400"
            )}
          >
            <span
              className={cn(
                "rounded-full",
                sizeConfig.indicator,
                isAlert ? "bg-amber-400 animate-pulse" : isOperating ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              )}
            />
            <span>{STATE_LABELS[currentState]}</span>
          </div>
        </div>
      )}
    </div>
  );
};
