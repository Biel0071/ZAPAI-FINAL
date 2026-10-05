import React from "react";
import { AgentIdentity } from "./AgentIdentity";
import { cn } from "@/core/lib/utils";
import { useToast } from "@/state/hooks/use-toast";
import {
  Activity,
  Bot,
  Brain,
  Coffee,
  Cpu,
  Monitor,
  Sparkles,
  Wifi,
  Zap,
} from "lucide-react";

interface AgentEnvironmentProps {
  agent: AgentIdentity;
  children?: React.ReactNode;
  isWorking: boolean;
  className?: string;
}

export const AgentEnvironment: React.FC<AgentEnvironmentProps> = ({
  agent,
  children,
  isWorking,
  className,
}) => {
  const { toast } = useToast();
  const { appearance, workspace, department, name } = agent;
  const primaryColor = appearance.clothingColor || workspace.primaryColor || "#10b981";

  const handleMonitorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: `Terminal ZAI • ${name}`,
      description: `Canal WhatsApp Oficial ativo • Latência 38ms • GPT-4o Mini v2.4 • Departamento: ${department.toUpperCase()}`,
    });
  };

  const handleCoffeeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "Café do Atendente",
      description: `${name} operando com energia máxima e cadência humanizada.`,
    });
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({
      title: "ZAI CRM Enterprise",
      description: "Plataforma Multi-Agentes de Alta Conversão.",
    });
  };

  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden flex items-center justify-center select-none bg-[#05080f]",
        className
      )}
    >
      {/* 1. LUXURY OFFICE WALL: ACOUSTIC SLATS & CEILING DOWNLIGHT CONE */}
      {/* Slatted acoustic wall texture (subtle luxury vertical dark oak / charcoal slats) */}
      <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(90deg,#0a101d_0px,#0a101d_24px,#050810_24px,#050810_30px)] pointer-events-none" />

      {/* Ceiling spot / downlight cone focused on the executive workstation */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[580px] h-[360px] bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.14)_0%,_rgba(14,165,233,0.06)_40%,_transparent_75%)] pointer-events-none blur-2xl" />

      {/* Ambient bias glow based on agent branding / theme */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-72 rounded-full blur-3xl opacity-15 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: primaryColor }}
      />

      {/* 2. BACK WALL FIXTURES: MINIMALIST ACCENT LED STRIP & BRAND BADGE */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none" />

      {/* Ambient Wall Accent & Brand Plaque (Placed safely below top-bar header) */}
      <div className="absolute top-16 left-6 hidden sm:flex items-center gap-3 p-1.5 px-2.5 rounded-xl border border-white/5 bg-black/40 backdrop-blur-xs pointer-events-auto">
        <button
          type="button"
          onClick={handleLogoClick}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-all text-[9px] font-mono tracking-wider cursor-pointer"
          title="Ver informações da plataforma ZAI"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold">ZAI WORKSPACE</span>
        </button>
        <div className="w-[1px] h-3 bg-white/10" />
        <div className="flex items-center gap-1">
          <div className="w-2 h-4 rounded-xs bg-slate-800 border border-slate-700/60" />
          <div className="w-1.5 h-5 rounded-xs bg-emerald-900/60 border border-emerald-700/40" />
        </div>
      </div>

      {/* 3. PERSPECTIVE FLOOR: EXECUTIVE MATTE CHARCOAL TILE FLOOR */}
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-[#020408] via-[#070c16] to-transparent pointer-events-none border-t border-white/[0.04]">
        {/* Subtle floor perspective guide lines */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_bottom,_rgba(255,255,255,0.1)_1px,_transparent_1px)] bg-[size:32px_16px]" />
      </div>

      {/* 4. OFFICE FURNITURE: ERGONOMIC MESH CHAIR & WORKSTATION DESK */}
      {/* (Always present in the office scene for depth and realism) */}
      <div
        className={cn(
          "absolute transition-all duration-500 pointer-events-auto",
          isWorking
            ? "bottom-0 inset-x-0 z-20 flex flex-col items-center"
            : "bottom-14 left-1/2 -translate-x-[160px] z-0 opacity-60 scale-90 blur-[0.4px] pointer-events-none"
        )}
      >
        <div className="relative w-full max-w-xl px-4 flex flex-col items-center">
          {/* HARDWARE ON DESK */}
          <div className="relative flex items-end justify-center gap-4 mb-0.5">
            {/* Curved Ultrawide Monitor */}
            <div
              onClick={handleMonitorClick}
              className={cn(
                "relative rounded-t-xl bg-[#080d17] border-2 shadow-2xl flex flex-col overflow-hidden transition-all duration-300",
                isWorking
                  ? "w-48 sm:w-60 h-28 sm:h-32 border-slate-700/90 shadow-[0_0_35px_rgba(16,185,129,0.22)] cursor-pointer group hover:border-emerald-500/80"
                  : "w-36 h-22 border-slate-800 shadow-lg cursor-default"
              )}
              title={isWorking ? "Clique para inspecionar telemetria do terminal" : "Terminal em standby"}
            >
              {/* Monitor Screen Top Bezel */}
              <div className="h-4 bg-[#05080e] border-b border-slate-800 px-2 flex items-center justify-between text-[7.5px] text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
                  <span className="ml-1 font-mono text-emerald-400 font-bold">TERMINAL ZAI</span>
                </div>
                <span className="flex items-center gap-1 text-[7px] text-emerald-400">
                  <Wifi className="w-2.5 h-2.5" /> {isWorking ? "100%" : "STANDBY"}
                </span>
              </div>

              {/* Monitor Screen Content */}
              {isWorking ? (
                <div className="flex-1 p-2 bg-[#060b13] flex flex-col justify-between font-mono text-[8px]">
                  <div className="space-y-1 text-slate-300">
                    <div className="flex items-center justify-between text-emerald-400 font-bold">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        WhatsApp Live
                      </span>
                      <span className="text-[7px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/30">ATIVO</span>
                    </div>
                    <div className="text-[7.5px] text-slate-400 truncate">
                      Atendente: <strong className="text-white">{name}</strong>
                    </div>
                    <div className="text-[7.5px] text-emerald-300 truncate">
                      &gt; Respondendo leads com cadência humanizada...
                    </div>
                  </div>

                  <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[7px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Zap className="w-2 h-2 text-amber-400" /> 38ms
                    </span>
                    <span className="text-emerald-400 font-bold">GPT-4o Mini</span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-2 bg-[#04070d] flex flex-col items-center justify-center font-mono text-[8px] text-slate-500 space-y-1">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-[9px]">
                    Z
                  </div>
                  <span className="text-[7px] text-slate-400 font-semibold tracking-wider">EXPEDIENTE EM PAUSA</span>
                </div>
              )}

              {/* Screen Glass Reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent pointer-events-none" />
            </div>

            {/* Monitor Stand */}
            <div className="absolute -bottom-2 w-12 h-3 bg-slate-800 rounded-sm border-t border-slate-700" />

            {/* Ceramic Coffee Mug */}
            <button
              type="button"
              onClick={handleCoffeeClick}
              className="relative -mb-1 p-1 cursor-pointer transition-transform hover:scale-110"
              title="Café do atendente"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
                <span className="w-0.5 h-2 rounded-full bg-white/40 animate-pulse [animation-duration:1.5s]" />
                <span className="w-0.5 h-3 rounded-full bg-white/30 animate-pulse [animation-duration:2s] [animation-delay:0.3s]" />
              </div>
              <div className="w-4.5 sm:w-5 h-5 sm:h-6 rounded-b-lg bg-emerald-600 border border-emerald-400 shadow-md flex items-center justify-center">
                <span className="text-[7px] font-black text-black">Z</span>
              </div>
            </button>

            {/* Desk Succulent Pot */}
            <div className="hidden sm:flex flex-col items-center -mb-1 opacity-90" title="Planta de mesa">
              <div className="flex gap-0.5 -mb-0.5">
                <span className="w-1.5 h-3 rounded-t-full bg-emerald-500" />
                <span className="w-2 h-4 rounded-t-full bg-emerald-400" />
                <span className="w-1.5 h-3 rounded-t-full bg-emerald-500" />
              </div>
              <div className="w-5 h-3.5 rounded-b-md bg-stone-700 border border-stone-600" />
            </div>
          </div>

          {/* MECHANICAL KEYBOARD & MOUSE PAD */}
          <div className="w-full max-w-sm h-4 sm:h-5 rounded-t-xl bg-[#101725] border-t border-slate-700/80 shadow-inner flex items-center justify-center gap-5 px-3">
            <div className="flex items-center gap-0.5 px-2.5 py-0.5 rounded bg-[#090d16] border border-slate-700/60 shadow-xs">
              {[...Array(10)].map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-[1px] bg-slate-800 border border-slate-700/50"
                />
              ))}
              <span className="w-5 h-1.5 rounded-[1px] bg-slate-800 border border-slate-700/50" />
            </div>

            <div className="w-3 h-4 rounded-full bg-[#090d16] border border-slate-700/80 flex items-center justify-center shadow-xs">
              <span
                className="w-0.5 h-1 rounded-full animate-pulse"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </div>

          {/* MAIN DESK SLAB (Solid Oak / Walnut / Dark Carbon Top) */}
          <div className="w-full h-6 sm:h-7 bg-gradient-to-b from-[#182233] via-[#0d1524] to-[#060a12] border-t border-emerald-500/30 shadow-[0_-6px_25px_rgba(0,0,0,0.85)]" />
        </div>
      </div>

      {/* 5. CENTER STAGE: CHARACTER (FULL-BODY 2.5D HUMAN) */}
      <div
        className={cn(
          "relative z-10 flex flex-col items-center justify-end w-full h-full transition-all duration-300 pointer-events-none",
          isWorking ? "max-h-[450px] pb-2" : "max-h-[490px] pb-5"
        )}
      >
        <div className="w-full h-full flex flex-col items-center justify-end pointer-events-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
