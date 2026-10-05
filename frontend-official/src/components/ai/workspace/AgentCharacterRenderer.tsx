import React, { useState } from "react";
import { AgentIdentity } from "./AgentIdentity";
import {
  resolveCharacterPreset,
  STATE_VISUAL_MAP,
  CharacterPreset,
} from "./CharacterDefinition";
import { cn } from "@/core/lib/utils";
import {
  Activity,
  Bot,
  Brain,
  Headphones,
  Radio,
  Sparkles,
  Wifi,
  Zap,
} from "lucide-react";

interface AgentCharacterRendererProps {
  agent: AgentIdentity;
  pose: "seated" | "standing";
  isTyping?: boolean;
  className?: string;
  onClick?: () => void;
}

export const AgentCharacterRenderer: React.FC<AgentCharacterRendererProps> = ({
  agent,
  pose,
  isTyping = false,
  className,
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);
  const preset: CharacterPreset = resolveCharacterPreset(agent);

  const presenceState = agent?.presenceState || (agent?.active !== false ? "ONLINE" : "OFFLINE");
  // Normalize presence state to recognized key
  const stateKey = (
    presenceState in STATE_VISUAL_MAP
      ? presenceState
      : agent?.active !== false
      ? "WORKING"
      : "OFFLINE"
  ) as keyof typeof STATE_VISUAL_MAP;

  const stateVisual = STATE_VISUAL_MAP[stateKey] || STATE_VISUAL_MAP.IDLE;
  const isWorking = stateVisual.isOperating && pose === "seated";
  const isRobot = preset.gender === "robot";

  // Active asset URL based on pose
  const assetUrl = pose === "seated" ? preset.assets.working : preset.assets.standing;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-end select-none group transition-all duration-500",
        className
      )}
      style={{
        perspective: "1000px",
      }}
    >
      {/* 1. STATE & TELEMETRY LIVE BADGE FLOATING ABOVE CHARACTER */}
      <div className="absolute -top-7 sm:-top-8 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-md border shadow-lg transition-all duration-300 pointer-events-auto cursor-pointer group-hover:scale-105"
        style={{
          backgroundColor: "rgba(5, 10, 20, 0.85)",
          borderColor: stateVisual.statusIconColor + "66",
        }}
      >
        <span
          className={cn("w-2 h-2 rounded-full", stateVisual.pulseAnimation)}
          style={{ backgroundColor: stateVisual.statusIconColor }}
        />
        <span className={cn("text-[9px] sm:text-[10px] font-mono tracking-wider font-bold", stateVisual.badgeText)}>
          {stateVisual.label}
        </span>
        {isWorking && (
          <span className="flex items-center gap-0.5 text-[8.5px] font-mono text-emerald-400/90 pl-1 border-l border-white/10">
            <Wifi className="w-2.5 h-2.5 text-emerald-400" />
            LIVE
          </span>
        )}
      </div>

      {/* 2. VOLUMETRIC AMBIENT GLOW / STATE HALO (BEHIND CHARACTER) */}
      <div
        className={cn(
          "absolute -inset-4 sm:-inset-6 rounded-3xl opacity-40 blur-2xl pointer-events-none transition-all duration-700",
          stateVisual.ringGlow
        )}
        style={{
          background: `radial-gradient(circle at center, ${preset.themeColor}33 0%, transparent 70%)`,
        }}
      />

      {/* 3. 2.5D CHARACTER CONTAINER (ASSET-DRIVEN WITH ANATOMY & LIGHTING) */}
      <div
        className={cn(
          "relative z-10 overflow-hidden rounded-2xl border transition-all duration-500 flex items-end justify-center",
          stateVisual.ringGlow,
          pose === "seated"
            ? "w-[290px] sm:w-[360px] md:w-[410px] h-[280px] sm:h-[340px] md:h-[390px] border-emerald-500/20 bg-gradient-to-b from-[#091120] to-[#040812]"
            : "w-[240px] sm:w-[280px] md:w-[310px] h-[360px] sm:h-[430px] md:h-[490px] border-slate-700/40 bg-gradient-to-b from-[#0b1325] via-[#070d1a] to-[#02050b]"
        )}
      >
        {/* Main High-Fidelity Character Asset */}
        <img
          src={assetUrl}
          alt={`${preset.name} - ${preset.tagline}`}
          className={cn(
            "w-full h-full transition-transform duration-700 pointer-events-none",
            pose === "seated" ? "object-cover object-top" : "object-contain object-center",
            isWorking ? "scale-100 hover:scale-[1.02]" : "scale-100",
            stateKey === "OFFLINE" ? "grayscale-[20%] opacity-90" : "brightness-[1.03]"
          )}
          onError={() => setImageError(true)}
        />

        {/* Soft Depth Gradient Mask at bottom to ground character seamlessly onto desk or floor */}
        <div className="absolute inset-x-0 bottom-0 h-16 sm:h-20 bg-gradient-to-t from-[#020408] via-[#020408]/60 to-transparent pointer-events-none" />

        {/* Edge Rim Lighting Accent */}
        <div
          className="absolute inset-0 pointer-events-none border border-white/5 rounded-2xl"
          style={{
            boxShadow: `inset 0 0 20px ${preset.themeColor}15`,
          }}
        />

        {/* Micro-Animation Indicators Overlay:
            - When RESPONDING: Audio Wave pulse indicator
            - When THINKING: Quantum logic shimmer
            - When WORKING & typing: Mechanical keystroke particle
        */}
        {stateKey === "RESPONDING" && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/80 border border-emerald-400/50 backdrop-blur-xs text-[8.5px] font-mono text-emerald-300">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Enviando áudio / mensagem...</span>
          </div>
        )}

        {stateKey === "THINKING" && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-950/80 border border-cyan-400/50 backdrop-blur-xs text-[8.5px] font-mono text-cyan-300">
            <Brain className="w-3 h-3 text-cyan-400 animate-spin [animation-duration:3s]" />
            <span>Consultando base de conhecimento...</span>
          </div>
        )}

        {isWorking && isTyping && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/40 backdrop-blur-xs text-[8px] font-mono text-emerald-300 animate-bounce [animation-duration:1.2s]">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span>Digitando...</span>
          </div>
        )}

        {/* Brand Tag Pill in Bottom Right Corner */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/60 border border-white/10 backdrop-blur-xs text-[8px] font-mono text-slate-300">
          {isRobot ? <Bot className="w-2.5 h-2.5 text-emerald-400" /> : <Headphones className="w-2.5 h-2.5 text-emerald-400" />}
          <span className="font-bold text-white">{preset.name}</span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-400 text-[7px] uppercase">{preset.archetype.replace("_", " ")}</span>
        </div>
      </div>

      {/* 4. GROUND CONTACT SHADOW ON FLOOR */}
      <div
        className={cn(
          "w-4/5 h-3 rounded-full blur-md opacity-70 -mt-1 pointer-events-none transition-all duration-500",
          pose === "seated" ? "bg-black/90 w-3/4" : "bg-black/90 w-2/3"
        )}
      />
    </div>
  );
};
