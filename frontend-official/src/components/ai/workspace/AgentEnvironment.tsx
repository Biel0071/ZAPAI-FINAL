import React from "react";
import { AgentIdentity } from "./AgentIdentity";
import { cn } from "@/core/lib/utils";
import { useToast } from "@/state/hooks/use-toast";
import {
  Coffee,
  Monitor,
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
      <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(90deg,#0a101d_0px,#0a101d_24px,#050810_24px,#050810_30px)] pointer-events-none" />

      {/* Ceiling spot / downlight cone focused on the executive workstation */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[620px] h-[380px] bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.18)_0%,_rgba(14,165,233,0.08)_40%,_transparent_75%)] pointer-events-none blur-2xl" />

      {/* Ambient bias glow based on agent branding / theme */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-80 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: primaryColor }}
      />

      {/* 2. BACK WALL FIXTURES: ACCENT LED STRIP & BRAND BADGE */}
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

      {/* Interactive Micro-Widgets in Office Space (Coffee & Telemetry shortcuts) */}
      <div className="absolute top-16 right-6 hidden sm:flex items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={handleCoffeeClick}
          className="p-1.5 rounded-lg border border-white/5 bg-black/40 backdrop-blur-xs text-slate-400 hover:text-emerald-400 transition-all cursor-pointer flex items-center gap-1 text-[9px] font-mono"
          title="Café do Atendente (ZAI Espresso)"
        >
          <Coffee className="w-3 h-3 text-emerald-400" />
          <span>ESPRESSO</span>
        </button>
        <button
          type="button"
          onClick={handleMonitorClick}
          className="p-1.5 rounded-lg border border-white/5 bg-black/40 backdrop-blur-xs text-slate-400 hover:text-emerald-400 transition-all cursor-pointer flex items-center gap-1 text-[9px] font-mono"
          title="Telemetria do Terminal"
        >
          <Monitor className="w-3 h-3 text-emerald-400" />
          <span>TERMINAL</span>
        </button>
      </div>

      {/* 3. PERSPECTIVE FLOOR: EXECUTIVE MATTE CHARCOAL TILE FLOOR */}
      <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-[#020408] via-[#070c16] to-transparent pointer-events-none border-t border-white/[0.04]">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_bottom,_rgba(255,255,255,0.1)_1px,_transparent_1px)] bg-[size:32px_16px]" />
      </div>

      {/* 4. GROUNDING WORKSTATION FOOTING */}
      <div className="absolute bottom-0 inset-x-0 h-4 sm:h-5 bg-gradient-to-b from-[#121b2b] via-[#09101c] to-[#03060c] border-t border-emerald-500/25 pointer-events-none z-20" />

      {/* 5. CENTER STAGE: CHARACTER (FULL 2.5D ASSET-DRIVEN HERO) */}
      <div
        className={cn(
          "relative z-10 flex flex-col items-center justify-end w-full h-full transition-all duration-300 pointer-events-none pb-4 sm:pb-5",
          isWorking ? "max-h-[460px]" : "max-h-[500px]"
        )}
      >
        <div className="w-full h-full flex flex-col items-center justify-end pointer-events-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
