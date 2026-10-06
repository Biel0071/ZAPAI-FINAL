import React from "react";
import { AgentIdentity, AgentPresenceState, normalizeAgentToIdentity } from "./AgentIdentity";
import { AGENT_STATE_CONFIGS, getAgentStateVisual } from "./AgentStateMachine";
import { AgentCharacter } from "./AgentCharacter";
import { AgentEnvironment } from "./AgentEnvironment";
import { AgentActivity } from "./AgentActivity";
import { AgentPresence } from "./AgentPresence";
import { cn } from "@/core/lib/utils";
import { useToast } from "@/state/hooks/use-toast";
import {
  Bot,
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

  const runtimeKey = String(runtimeState || "").toUpperCase();
  const normalizedRuntime: AgentPresenceState | undefined = runtimeKey === "ONLINE"
    ? "IDLE"
    : Object.prototype.hasOwnProperty.call(AGENT_STATE_CONFIGS, runtimeKey)
      ? runtimeKey as AgentPresenceState
      : undefined;
  const effectiveState: AgentPresenceState = !isOnline || !identity.active
    ? "OFFLINE"
    : normalizedRuntime || identity.presenceState;
  const storeName = agent?.storeName || agent?.store?.name || agent?.avatarConfig?.branding?.storeName;

  const visual = getAgentStateVisual(effectiveState);
  const runtimeIdentity = { ...identity, presenceState: effectiveState, currentActivity: visual.description };
  const isWorking = visual.characterPose === "seated";

  // Robot Mascot Visual mapping for ZAIBOT
  const getZaibotImage = () => {
    switch (effectiveState) {
      case "WORKING":
      case "RESPONDING":
        return "/assets/characters/zaibot/working.jpg";
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
        return "/assets/characters/zaibot/standing.jpg";
    }
  };

  return (
    <article
      className={cn(
        "relative w-full min-h-[520px] h-[520px] sm:h-[540px] bg-[#060a12] rounded-2xl border border-white/10 shadow-2xl overflow-hidden select-none",
        className
      )}
    >
      {/* Agent identity and operational state */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-2.5 sm:p-3 pointer-events-none gap-2">
        {/* AGENT IDENTITY BADGE (LEFT) */}
        <div className="flex items-center gap-2 bg-[#090e17]/95 backdrop-blur-md border border-white/10 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl shadow-lg pointer-events-auto shrink-0 max-w-[130px] sm:max-w-none">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-emerald-500/50 shrink-0 bg-black flex items-center justify-center">
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
            <div className="text-[10px] sm:text-[11px] font-bold text-white flex items-center gap-1 leading-tight truncate">
              {isZaibot ? "ZAIBOT" : identity.name}
            </div>
            <div className="text-[9px] text-slate-400 font-medium leading-tight truncate hidden sm:block">
              {storeName || (isZaibot ? "Assistente Operacional ZAI" : identity.role)}
            </div>
          </div>
        </div>

        {/* AGENT MODE TOGGLE (CENTER - DESKTOP & TABLET) */}
        <div className="hidden md:flex items-center p-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 shadow-xl pointer-events-auto">
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
            {identity.name}
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
            ZAIBOT
          </button>
        </div>

        {/* Presence controller */}
        <div className="pointer-events-auto shrink-0 flex items-center gap-1.5 sm:gap-2">
          {/* Mobile mode switch icon button */}
          <div className="md:hidden flex items-center p-0.5 rounded-lg bg-black/70 border border-white/10">
            <button
              type="button"
              onClick={() => onToggleMode?.(isZaibot ? "camila" : "zaibot")}
              className="px-1.5 py-1 text-[8.5px] font-bold rounded text-slate-200 hover:text-white bg-white/10 flex items-center gap-1 cursor-pointer"
              title="Alternar entre Funcionário e Mascote"
            >
              <Bot className="w-3 h-3 text-emerald-400" />
              <span>{isZaibot ? "Camila" : "Mascote"}</span>
            </button>
          </div>

          <AgentPresence
            agent={runtimeIdentity}
            state={effectiveState}
            onToggleOnline={onToggleOnline}
          />
        </div>
      </div>

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
            className="relative z-10 flex flex-col items-center justify-center h-full max-h-[440px] pt-8 cursor-pointer group"
          >
            <img
              src={getZaibotImage()}
              alt="ZAIBOT Mascote 3D"
              className={cn(
                "h-full max-h-[380px] rounded-2xl border border-emerald-500/30 object-cover shadow-[0_16px_45px_rgba(0,240,144,0.30)] transition-all duration-300 group-hover:scale-[1.02]",
                effectiveState === "OFFLINE"
                  ? "brightness-[0.6] saturate-[0.3] border-slate-700/50"
                  : effectiveState === "IDLE"
                  ? "animate-pulse [animation-duration:4s]"
                  : "filter-none brightness-105"
              )}
            />
          </div>

          {/* Activity Overlays */}
          <AgentActivity agent={runtimeIdentity} state={effectiveState} />
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
            <AgentEnvironment agent={runtimeIdentity} isWorking={isWorking}>
              <AgentCharacter
                agent={runtimeIdentity}
                pose={isWorking ? "seated" : "standing"}
                isTyping={effectiveState === "WORKING" || effectiveState === "RESPONDING"}
                onClick={() => {
                  toast({
                    title: `${identity.name} • ${identity.role}`,
                    description: `Departamento: ${identity.department.toUpperCase()} • ${runtimeIdentity.currentActivity}`,
                  });
                }}
              />
            </AgentEnvironment>

            {/* C. ACTIVITY OVERLAYS & TELEMETRY */}
            <AgentActivity agent={runtimeIdentity} state={effectiveState} />
          </div>
        </div>
      )}
    </article>
  );
};
