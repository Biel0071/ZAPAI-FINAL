import React from "react";
import { AgentIdentity, AgentPresenceState } from "./AgentIdentity";
import { getAgentStateVisual } from "./AgentStateMachine";
import { cn } from "@/core/lib/utils";
import { Power, Radio } from "lucide-react";

interface AgentPresenceProps {
  agent: AgentIdentity;
  state: AgentPresenceState;
  onToggleOnline?: (online: boolean) => void;
  onSelectState?: (state: AgentPresenceState) => void;
  className?: string;
}

export const AgentPresence: React.FC<AgentPresenceProps> = ({
  agent,
  state,
  onToggleOnline,
  onSelectState,
  className,
}) => {
  const isOnline = state !== "OFFLINE";
  const visual = getAgentStateVisual(state);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* QUICK PREVIEW STATE SELECTOR (SIMULATION CHIPS) */}
      <div className="hidden lg:flex items-center gap-1 p-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-lg">
        {(["WORKING", "IDLE", "THINKING", "RESPONDING", "OFFLINE"] as AgentPresenceState[]).map(
          (st) => {
            const stVisual = getAgentStateVisual(st);
            const isSelected = state === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => onSelectState?.(st)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[8.5px] font-mono transition-all cursor-pointer",
                  isSelected
                    ? "bg-white/20 text-white font-bold shadow-xs border border-white/20"
                    : "text-slate-400 hover:text-slate-200"
                )}
                title={`Simular estado: ${stVisual.label}`}
              >
                {st}
              </button>
            );
          }
        )}
      </div>

      {/* MASTER ONLINE / OFFLINE TOGGLE */}
      <button
        type="button"
        onClick={() => onToggleOnline?.(!isOnline)}
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
            isOnline ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981]" : "bg-slate-400"
          )}
        />
        <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
      </button>
    </div>
  );
};
