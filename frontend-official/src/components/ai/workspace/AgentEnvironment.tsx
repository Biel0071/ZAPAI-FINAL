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
  const appearance = agent?.appearance || {
    clothingColor: agent?.character?.theme === "emerald" ? "#10b981" : "#0ea5e9",
    avatarUrl: agent?.avatar,
    style: "executive",
    hairColor: "#332211",
    skinTone: "#f5d0b0",
    clothingStyle: "smart_casual",
    accessories: [],
  };
  const workspace = agent?.workspace || {
    primaryColor: appearance.clothingColor || "#10b981",
    decorations: ["plant", "coffee"],
  };
  const department = agent?.department || agent?.sector || agent?.role || "Vendas";
  const name = agent?.name || "Atendente";
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

      {/* 4. EXECUTIVE WORKSTATION & HARDWARE */}
      {isWorking ? (
        /* ========================================================
           SEATED WORKING MODE: BALANCED 3-PART EXECUTIVE DESK
           LEFT: Ceramic Mug & Succulent Plant
           CENTER: Mechanical Keyboard & Mouse where Character types
           RIGHT: Ultrawide Curved Terminal angled toward Attendant
           BOTTOM: Beveled Solid Dark Executive Desk Surface
           ======================================================== */
        <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-auto flex flex-col items-center">
          <div className="relative w-full max-w-2xl px-4 flex items-end justify-between mb-0.5">
            {/* LEFT DESK ACCESSORIES: COFFEE MUG & SUCCULENT */}
            <div className="flex items-end gap-2.5 pb-1">
              {/* Ceramic Coffee Mug */}
              <button
                type="button"
                onClick={handleCoffeeClick}
                className="relative p-1 cursor-pointer transition-transform hover:scale-110"
                title="Café do atendente (ZAI Espresso)"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
                  <span className="w-0.5 h-2 rounded-full bg-white/40 animate-pulse [animation-duration:1.5s]" />
                  <span className="w-0.5 h-3 rounded-full bg-white/30 animate-pulse [animation-duration:2s] [animation-delay:0.3s]" />
                </div>
                <div className="w-5 h-6 rounded-b-lg bg-emerald-600 border border-emerald-400 shadow-md flex items-center justify-center">
                  <span className="text-[7.5px] font-black text-black">Z</span>
                </div>
              </button>

              {/* Desk Succulent Pot */}
              <div className="hidden sm:flex flex-col items-center opacity-90" title="Planta de mesa">
                <div className="flex gap-0.5 -mb-0.5">
                  <span className="w-1.5 h-3.5 rounded-t-full bg-emerald-500" />
                  <span className="w-2 h-4.5 rounded-t-full bg-emerald-400" />
                  <span className="w-1.5 h-3.5 rounded-t-full bg-emerald-500" />
                </div>
                <div className="w-5 h-4 rounded-b-md bg-stone-700 border border-stone-600 shadow-xs" />
              </div>
            </div>

            {/* CENTER: LOW MECHANICAL KEYBOARD & MOUSE PAD */}
            <div className="flex items-center gap-3 px-3 py-1 rounded-t-lg bg-[#0e1624] border-t border-slate-700/80 shadow-md">
              <div className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-[#070b13] border border-slate-800">
                {[...Array(8)].map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-[1px] bg-slate-700/80" />
                ))}
                <span className="w-4 h-1.5 rounded-[1px] bg-slate-700/80 ml-0.5" />
              </div>
              <div className="w-3 h-4 rounded-full bg-[#070b13] border border-slate-700 flex items-center justify-center">
                <span className="w-0.5 h-1 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* RIGHT: CURVED ULTRAWIDE MONITOR ANGLED TOWARDS ATTENDANT */}
            <div
              onClick={handleMonitorClick}
              className="relative w-36 sm:w-56 h-22 sm:h-30 rounded-t-xl bg-[#080d17] border-2 border-slate-700/90 shadow-[0_0_35px_rgba(16,185,129,0.22)] flex flex-col overflow-hidden cursor-pointer group hover:border-emerald-500/80 transition-all duration-300 -mr-2 sm:mr-0"
              title="Clique para inspecionar telemetria do terminal"
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
                  <Wifi className="w-2.5 h-2.5" /> 100%
                </span>
              </div>

              {/* Live WhatsApp Content */}
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
                    &gt; Atendimento humanizado ativo
                  </div>
                </div>

                <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[7px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Zap className="w-2 h-2 text-amber-400" /> 38ms
                  </span>
                  <span className="text-emerald-400 font-bold">GPT-4o Mini</span>
                </div>
              </div>

              {/* Glass Reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Solid Executive Beveled Desk Edge */}
          <div className="w-full h-5 sm:h-6 bg-gradient-to-b from-[#182233] via-[#0d1524] to-[#060a12] border-t border-emerald-500/30 shadow-[0_-6px_25px_rgba(0,0,0,0.85)]" />
        </div>
      ) : (
        /* ========================================================
           STANDING MODE: WORKSTATION IN THE BACKGROUND ON THE LEFT
           Firmly grounded on the floor, zero overlap with character in center
           ======================================================== */
        <div className="hidden sm:flex absolute bottom-8 left-6 sm:left-14 z-0 pointer-events-none opacity-60 scale-85 sm:scale-90 flex-col items-center origin-bottom-left transition-all duration-500">
          {/* Standby Monitor & Desk */}
          <div className="w-36 h-22 rounded-t-lg bg-[#080d17] border border-slate-800 shadow-xl flex flex-col overflow-hidden">
            <div className="h-3.5 bg-[#05080e] border-b border-slate-800 px-1.5 flex items-center justify-between text-[6.5px] text-slate-400">
              <span className="font-mono text-emerald-400 font-bold">ZAI TERMINAL</span>
              <span className="text-[6.5px] text-slate-400">STANDBY</span>
            </div>
            <div className="flex-1 p-1.5 bg-[#04070d] flex flex-col items-center justify-center font-mono text-[7px] text-slate-500">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-[8px] mb-1">
                Z
              </div>
              <span className="text-[6.5px] text-slate-400 font-semibold tracking-wider">EXPEDIENTE EM PAUSA</span>
            </div>
          </div>
          {/* Desk Stand & Top */}
          <div className="w-10 h-2 bg-slate-800 rounded-sm" />
          <div className="w-48 h-3.5 rounded-t-md bg-gradient-to-b from-[#182233] to-[#0a101d] border-t border-slate-700/60 shadow-md" />
        </div>
      )}

      {/* 5. CENTER STAGE: CHARACTER (FULL-BODY 2.5D HUMAN) */}
      <div
        className={cn(
          "relative z-10 flex flex-col items-center justify-end w-full h-full transition-all duration-300 pointer-events-none",
          isWorking ? "max-h-[440px] pb-3" : "max-h-[490px] pb-5"
        )}
      >
        <div className="w-full h-full flex flex-col items-center justify-end pointer-events-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
