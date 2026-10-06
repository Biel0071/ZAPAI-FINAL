import React from "react";
import { AgentIdentity, AgentPresenceState } from "./AgentIdentity";
import { getAgentStateVisual } from "./AgentStateMachine";
import { cn } from "@/core/lib/utils";

interface AgentPresenceProps {
  agent: AgentIdentity;
  state: AgentPresenceState;
  onToggleOnline?: (online: boolean) => void;
  onSelectState?: (state: AgentPresenceState) => void;
  className?: string;
}

export const AgentPresence: React.FC<AgentPresenceProps> = ({
  state,
  onToggleOnline,
  className,
}) => {
  const isOnline = state !== "OFFLINE";
  const visual = getAgentStateVisual(state);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* MASTER ONLINE / OFFLINE TOGGLE */}
      <button
        type="button"
        onClick={() => onToggleOnline?.(!isOnline)}
        disabled={!onToggleOnline}
        className={cn(
          "h-7 px-3 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 text-[9px] font-bold border backdrop-blur-md shadow-md",
          isOnline
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
            : "bg-black/70 text-slate-300 border-white/20 hover:bg-black/90"
        )}
        title={isOnline ? "Agente ativo: clique para pausar expediente" : "Agente pausado: clique para ativar"}
        aria-label={isOnline ? "Pausar agente" : "Ativar agente"}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            visual.color,
            visual.pulse && "animate-pulse"
          )}
        />
        <span>{visual.label}</span>
      </button>
    </div>
  );
};
