import React, { useState, useEffect } from "react";
import { AgentIdentity, AgentPresenceState, normalizeAgentToIdentity } from "./AgentIdentity";
import { getAgentStateVisual } from "./AgentStateMachine";
import { AgentCharacter } from "./AgentCharacter";
import { AgentEnvironment } from "./AgentEnvironment";
import { AgentActivity } from "./AgentActivity";
import { AgentPresence } from "./AgentPresence";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/core/lib/utils";
import { useToast } from "@/state/hooks/use-toast";
import {
  Brain,
  Activity,
  User,
  Shirt,
  Headphones,
  Store,
  Sparkles,
} from "lucide-react";

export interface AgentWorkspaceProps {
  agent?: any;
  isOnline?: boolean;
  onToggleOnline?: (online: boolean) => void;
  runtimeState?: AgentPresenceState;
  onRuntimeStateChange?: (state: AgentPresenceState) => void;
  agentMode?: "camila" | "zaibot";
  onToggleMode?: (mode: "camila" | "zaibot") => void;
  onOpenCustomizer?: (tab?: string) => void;
  className?: string;
}

export const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({
  agent,
  isOnline = true,
  onToggleOnline,
  runtimeState,
  onRuntimeStateChange,
  agentMode,
  onToggleMode,
  onOpenCustomizer,
  className,
}) => {
  const { toast } = useToast();

  // Normalize into rich AgentIdentity
  const identity: AgentIdentity = normalizeAgentToIdentity(agent);

  // Mode switcher (zaibot = platform mascot robot, camila/others = human employees)
  const isZaibot =
    agentMode === "zaibot" ||
    identity.isPlatformAssistant ||
    identity.key === "zaibot";

  // Effective State Machine
  const [internalState, setInternalState] = useState<AgentPresenceState | null>(null);

  useEffect(() => {
    setInternalState(null);
  }, [isOnline, runtimeState, agent]);

  const normalizedRuntime: AgentPresenceState | undefined = runtimeState
    ? (String(runtimeState).toUpperCase() === "ONLINE"
        ? "WORKING"
        : (String(runtimeState).toUpperCase() as AgentPresenceState))
    : undefined;

  const effectiveState: AgentPresenceState =
    internalState ??
    (normalizedRuntime ??
      (isOnline && identity.active ? (identity.presenceState || "WORKING") : "OFFLINE"));

  const visual = getAgentStateVisual(effectiveState);
  const isWorking = visual.characterPose === "seated";

  const handleStateChange = (st: AgentPresenceState) => {
    setInternalState(st);
    onRuntimeStateChange?.(st);
  };

  // Robot Mascot Visual mapping for ZAIBOT
  const getZaibotImage = () => {
    switch (effectiveState) {
      case "WORKING":
      case "RESPONDING":
        return "/assets/mascot/mascot_laptop_working.png";
      case "THINKING":
      case "LEARNING":
        return "/assets/mascot/mascot_mobile.png";
      case "SUCCESS":
        return "/assets/mascot/mascot_celebrating.png";
      case "OFFLINE":
      case "IDLE":
      case "AWAY":
      case "ERROR":
      default:
        return "/assets/mascot/mascot_standing_thumbsup.png";
    }
  };

  return (
    <article
      className={cn(
        "relative w-full h-[380px] bg-[#070c16] rounded-2xl border border-white/10 shadow-2xl overflow-hidden select-none",
        className
      )}
    >
      {/* 1. TOP CENTER: AGENT MODE TOGGLE (HUMAN EMPLOYEE vs ZAIBOT PLATFORM MASCOT) */}
      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center p-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 shadow-xl">
        <button
          type="button"
          onClick={() => onToggleMode?.("camila")}
          className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer",
            !isZaibot
              ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
              : "text-slate-300 hover:text-white"
          )}
        >
          {identity.name} (Funcionário Digital)
        </button>
        <button
          type="button"
          onClick={() => onToggleMode?.("zaibot")}
          className={cn(
            "px-3 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer",
            isZaibot
              ? "bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]"
              : "text-slate-300 hover:text-white"
          )}
        >
          ZAIBOT (Mascote 3D)
        </button>
      </div>

      {/* 2. AGENT BADGE (TOP LEFT) */}
      <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-2 bg-[#090e17]/90 backdrop-blur-md border border-white/10 px-2.5 py-1.5 rounded-xl shadow-lg max-w-[45%]">
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-500/50 shrink-0 bg-black flex items-center justify-center">
          {isZaibot ? (
            <img
              src="/assets/mascot/zaibot_avatar.png"
              alt="ZAIBOT"
              className="w-full h-full object-cover"
            />
          ) : identity.appearance.avatarUrl && !identity.appearance.avatarUrl.includes("mascot") ? (
            <img
              src={identity.appearance.avatarUrl}
              alt={identity.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[11px] font-black text-white"
              style={{ backgroundColor: identity.appearance.clothingColor }}
            >
              {identity.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-white flex items-center gap-1 leading-tight truncate">
            {isZaibot ? "ZAIBOT" : identity.name}
          </div>
          <div className="text-[9px] text-slate-400 font-medium leading-tight truncate">
            {isZaibot ? "Assistente Operacional ZAI" : identity.role}
          </div>
        </div>
      </div>

      {/* 3. PRESENCE CONTROLLER & SIMULATION CHIPS (TOP RIGHT) */}
      <AgentPresence
        agent={identity}
        state={effectiveState}
        onToggleOnline={onToggleOnline}
        onSelectState={handleStateChange}
      />

      {/* 4. SCENE RENDERING: ZAIBOT 3D ROBOT LAB OR HUMAN LIVING WORKSPACE */}
      {isZaibot ? (
        /* ========================================================
           ZAIBOT: HIGH-TECH 3D ROBOT MASCOT LIVING LAB
           ======================================================== */
        <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-[#050912] via-[#0b1424] to-[#04070d]">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b9810d_1px,transparent_1px),linear-gradient(to_bottom,#10b9810d_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Holographic rings when THINKING or LEARNING */}
          {(effectiveState === "THINKING" || effectiveState === "LEARNING") && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-72 rounded-full border border-cyan-400/30 animate-spin opacity-40 [animation-duration:8s]" />
              <div className="w-56 h-56 rounded-full border border-dashed border-emerald-400/40 animate-spin opacity-50 [animation-duration:12s]" />
            </div>
          )}

          {/* Mascot Pose Image */}
          <div
            onClick={() => {
              toast({
                title: "ZAIBOT Ativo",
                description: "Copiloto operacional do administrador pronto para auxiliar.",
              });
            }}
            className="relative z-10 flex flex-col items-center justify-center h-full max-h-[310px] pt-4 cursor-pointer group"
          >
            <img
              src={getZaibotImage()}
              alt="ZAIBOT Mascote 3D"
              className={cn(
                "h-full max-h-[270px] object-contain drop-shadow-[0_12px_30px_rgba(0,0,0,0.85)] transition-all duration-300 group-hover:scale-105",
                effectiveState === "OFFLINE"
                  ? "brightness-[0.6] saturate-[0.3]"
                  : effectiveState === "IDLE"
                  ? "animate-pulse [animation-duration:3s]"
                  : "filter-none brightness-105"
              )}
            />
          </div>

          {/* Interactive Room Hotspots */}
          <div
            title="Terminal Neural ZAIBOT"
            onClick={() =>
              toast({
                title: "Terminal Neural",
                description: "Monitoramento em tempo real de automações e filas.",
              })
            }
            className="absolute top-[35%] left-[18%] h-10 w-10 rounded-full cursor-pointer border border-cyan-400/30 bg-cyan-400/10 hover:bg-cyan-400/30 transition-all flex items-center justify-center"
          >
            <Brain className="h-4 w-4 text-cyan-400 animate-pulse" />
          </div>

          <div
            title="Telemetria & Latência"
            onClick={() =>
              toast({
                title: "Telemetria",
                description: "Latência média de 42ms. Todas as APIs conectadas.",
              })
            }
            className="absolute top-[35%] right-[18%] h-10 w-10 rounded-full cursor-pointer border border-emerald-400/30 bg-emerald-400/10 hover:bg-emerald-400/30 transition-all flex items-center justify-center"
          >
            <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          </div>

          {/* Activity Overlays */}
          <AgentActivity agent={identity} state={effectiveState} />
        </div>
      ) : (
        /* ========================================================
           HUMAN DIGITAL EMPLOYEE: LIVING WORKSPACE (FULL-BODY ANATOMY)
           ======================================================== */
        <div className="relative w-full h-full flex items-stretch bg-[#080d16] overflow-hidden">
          {/* A. LEFT VERTICAL TOOLBAR FOR CUSTOMIZATION */}
          <div className="z-20 flex flex-col justify-center gap-1.5 p-2 bg-[#060a12]/90 border-r border-white/10 shrink-0">
            {[
              { id: "visual", label: "Visual", icon: User },
              { id: "roupas", label: "Roupas", icon: Shirt },
              { id: "acessorios", label: "Acessórios", icon: Headphones },
              { id: "cenario", label: "Cenário", icon: Store },
              { id: "animacoes", label: "Animações", icon: Sparkles },
            ].map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => onOpenCustomizer?.(btn.id)}
                  className="w-13 sm:w-14 h-11 sm:h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer border bg-black/30 border-white/5 text-slate-400 hover:text-white hover:border-emerald-500/40 hover:bg-emerald-500/10"
                  title={`Personalizar ${btn.label} de ${identity.name}`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span className="text-[8px] sm:text-[9px] font-semibold">{btn.label}</span>
                </button>
              );
            })}
          </div>

          {/* B. LIVING WORKSPACE ENVIRONMENT WITH FULL-BODY CHARACTER */}
          <div className="relative flex-1 h-full overflow-hidden">
            <AgentEnvironment agent={identity} isWorking={isWorking}>
              <AgentCharacter
                agent={identity}
                pose={isWorking ? "seated" : "standing"}
                isTyping={effectiveState === "WORKING" || effectiveState === "RESPONDING"}
                onClick={() => {
                  toast({
                    title: `${identity.name} • ${identity.role}`,
                    description: `Departamento: ${identity.department.toUpperCase()} • ${identity.currentActivity}`,
                  });
                }}
              />
            </AgentEnvironment>

            {/* C. ACTIVITY OVERLAYS & TELEMETRY */}
            <AgentActivity agent={identity} state={effectiveState} />
          </div>
        </div>
      )}
    </article>
  );
};
