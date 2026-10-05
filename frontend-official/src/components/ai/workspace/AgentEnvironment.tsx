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
        "relative w-full h-full overflow-hidden flex items-center justify-center select-none bg-gradient-to-b from-[#060a12] via-[#09111c] to-[#04070e]",
        className
      )}
    >
      {/* 1. BACKGROUND GRID & AMBIENT GLOW */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500"
        style={{ backgroundColor: primaryColor }}
      />

      {/* 2. BACK WALL ELEMENTS: ACOUSTIC SLATS & ZAI BRANDING */}
      <div className="absolute top-3 right-5 flex items-center gap-2 z-10 pointer-events-auto">
        <button
          type="button"
          onClick={handleLogoClick}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 hover:border-emerald-500/40 text-muted-foreground hover:text-white transition-all text-[10px] font-mono shadow-sm"
          title="Ver informações da plataforma"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-slate-200">ZAI WORKSPACE</span>
        </button>
      </div>

      {/* Subtle Wall Window / Shelves */}
      <div className="absolute top-6 left-8 w-24 h-16 rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent pointer-events-none hidden sm:block">
        <div className="p-2 space-y-1">
          <div className="w-12 h-1 rounded-full bg-emerald-500/30" />
          <div className="w-8 h-1 rounded-full bg-white/10" />
          <div className="w-16 h-1 rounded-full bg-white/10" />
        </div>
      </div>

      {/* 3. CENTER STAGE: CHARACTER (SITTING OR STANDING) */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full max-h-[350px]">
        {children}
      </div>

      {/* 4. FOREGROUND: DESK & MONITORS (ONLY VISIBLE WHEN SITTING / WORKING) */}
      {isWorking && (
        <div className="absolute bottom-0 inset-x-0 z-20 flex flex-col items-center pointer-events-auto">
          {/* DESK SURFACE & COMPUTER HARDWARE */}
          <div className="relative w-full max-w-2xl px-4 flex flex-col items-center">
            {/* ACTIVE COMPUTER MONITOR & TELEMETRY */}
            <div className="relative flex items-end justify-center gap-3 mb-1">
              {/* Main Glowing Monitor */}
              <div
                onClick={handleMonitorClick}
                className="relative w-44 sm:w-56 h-28 sm:h-32 rounded-t-xl bg-[#090e17] border-2 border-slate-700 shadow-[0_0_30px_rgba(16,185,129,0.2)] flex flex-col overflow-hidden cursor-pointer group transition-all hover:border-emerald-500/80"
                title="Clique para inspecionar telemetria do terminal"
              >
                {/* Screen Header Bar */}
                <div className="h-4 bg-[#05080e] border-b border-slate-800 px-2 flex items-center justify-between text-[8px] text-slate-400">
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

                {/* Screen Content: Live Terminal / Telemetry Feed */}
                <div className="flex-1 p-2 bg-[#060b13] flex flex-col justify-between font-mono text-[8px]">
                  <div className="space-y-1 text-slate-300">
                    <div className="flex items-center justify-between text-emerald-400 font-bold">
                      <span>• WhatsApp Engine</span>
                      <span className="animate-pulse text-[7px] bg-emerald-500/20 px-1 rounded">ATIVO</span>
                    </div>
                    <div className="text-[7.5px] text-slate-400 truncate">
                      Atendente: <strong className="text-white">{name}</strong>
                    </div>
                    <div className="text-[7.5px] text-emerald-300 truncate">
                      &gt; Respondendo leads com cadência humanizada...
                    </div>
                  </div>

                  {/* Latency & Processing Pulse Bar */}
                  <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[7px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Zap className="w-2 h-2 text-amber-400" /> 38ms
                    </span>
                    <span className="text-emerald-400 font-bold">GPT-4o Mini</span>
                  </div>
                </div>

                {/* Monitor Screen Glare Reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
              </div>

              {/* Monitor Stand */}
              <div className="absolute -bottom-2 w-12 h-3 bg-slate-700 rounded-sm" />

              {/* Desk Accessory 1: Steaming Coffee Mug */}
              <button
                type="button"
                onClick={handleCoffeeClick}
                className="relative -mb-1 p-1 cursor-pointer transition-transform hover:scale-110"
                title="Caneca de café do atendente"
              >
                {/* Animated Steam */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
                  <span className="w-0.5 h-2 rounded-full bg-white/40 animate-pulse [animation-duration:1.5s]" />
                  <span className="w-0.5 h-3 rounded-full bg-white/30 animate-pulse [animation-duration:2s] [animation-delay:0.3s]" />
                </div>
                <div className="w-5 h-6 rounded-b-lg bg-emerald-600 border border-emerald-400 shadow flex items-center justify-center">
                  <span className="text-[7px] font-black text-black">Z</span>
                </div>
              </button>

              {/* Desk Accessory 2: Desk Plant (Succulent Pot) */}
              <div className="hidden sm:flex flex-col items-center -mb-1 opacity-90" title="Planta de mesa">
                <div className="flex gap-0.5 -mb-0.5">
                  <span className="w-2 h-3 rounded-t-full bg-emerald-500" />
                  <span className="w-2.5 h-4 rounded-t-full bg-emerald-400" />
                  <span className="w-2 h-3 rounded-t-full bg-emerald-500" />
                </div>
                <div className="w-6 h-4 rounded-b-md bg-stone-700 border border-stone-600" />
              </div>
            </div>

            {/* MECHANICAL KEYBOARD & MOUSE ON DESK */}
            <div className="w-full max-w-md h-5 rounded-t-xl bg-[#111927] border-t border-slate-700/80 shadow-inner flex items-center justify-center gap-6 px-4">
              {/* Keyboard with illuminated keys */}
              <div className="flex items-center gap-0.5 px-3 py-0.5 rounded bg-[#0a0f18] border border-slate-700/60 shadow">
                {[...Array(12)].map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-[1px] bg-slate-800 border border-slate-700/50"
                  />
                ))}
                <span className="w-6 h-1.5 rounded-[1px] bg-slate-800 border border-slate-700/50" />
              </div>

              {/* Optical Mouse with Glowing Scroll Wheel */}
              <div className="w-3.5 h-4.5 rounded-full bg-[#0a0f18] border border-slate-700/80 flex items-center justify-center shadow">
                <span
                  className="w-1 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
            </div>

            {/* MAIN DESK SOLID SLAB */}
            <div className="w-full h-7 bg-gradient-to-b from-[#1a2333] via-[#0f172a] to-[#070b13] border-t border-emerald-500/30 shadow-[0_-4px_20px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
      )}
    </div>
  );
};
