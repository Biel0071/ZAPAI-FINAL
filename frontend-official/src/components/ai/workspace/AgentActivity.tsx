import React from "react";
import { AgentIdentity, AgentPresenceState } from "./AgentIdentity";
import { getAgentStateVisual } from "./AgentStateMachine";
import { cn } from "@/core/lib/utils";
import { Sparkles, Brain, MessageSquare, AlertCircle, CheckCircle } from "lucide-react";

interface AgentActivityProps {
  agent: AgentIdentity;
  state: AgentPresenceState;
  className?: string;
}

export const AgentActivity: React.FC<AgentActivityProps> = ({
  agent,
  state,
  className,
}) => {
  const visual = getAgentStateVisual(state);

  return (
    <>
      {/* 1. FLOATING THOUGHT BUBBLE (THINKING STATE) */}
      {state === "THINKING" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-bounce [animation-duration:2s] pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-400/50 text-cyan-200 text-[10px] font-bold shadow-xl backdrop-blur-md">
            <Brain className="w-3.5 h-3.5 text-cyan-400 animate-spin [animation-duration:6s]" />
            <span>Processando resposta...</span>
          </div>
        </div>
      )}

      {/* 2. FLOATING SPEECH BUBBLE (RESPONDING STATE) */}
      {state === "RESPONDING" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-bounce [animation-duration:1.5s] pointer-events-none">
          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black shadow-xl">
            <MessageSquare className="w-3.5 h-3.5 fill-current" />
            <span>{agent.name} respondendo à conversa...</span>
          </div>
        </div>
      )}

      {/* 3. LEARNING HOLOGRAM RING (LEARNING STATE) */}
      {state === "LEARNING" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/90 border border-purple-400/50 text-purple-200 text-[10px] font-bold shadow-xl backdrop-blur-md animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Atualizando conhecimento...</span>
          </div>
        </div>
      )}

      {/* 4. SUCCESS CELEBRATION (SUCCESS STATE) */}
      {state === "SUCCESS" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-in zoom-in duration-300 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black shadow-xl">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Operação concluída</span>
          </div>
        </div>
      )}

      {/* 5. ERROR ALERT (ERROR STATE) */}
      {state === "ERROR" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-pulse pointer-events-none">
          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-xl">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Verifique o registro da operação</span>
          </div>
        </div>
      )}

      {/* 6. BOTTOM-LEFT LIVE STATUS BEACON */}
      <div
        className={cn(
          "absolute bottom-3 left-3 z-30 flex items-center gap-2 bg-[#080d16]/95 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl shadow-lg",
          className
        )}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            visual.color,
            visual.pulse && "animate-pulse"
          )}
        />
        <div className="flex items-center gap-1 text-[11px] text-slate-200">
          <span className="font-medium text-slate-300">
            {visual.label}
          </span>
        </div>
      </div>
    </>
  );
};
