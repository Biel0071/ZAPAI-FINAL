import React from "react";
import { AgentIdentity, AgentPresenceState } from "./AgentIdentity";
import { getAgentStateVisual } from "./AgentStateMachine";
import { Badge } from "@/components/ui/badge";
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
            <span>Processando intenção & tabelas de preços...</span>
          </div>
        </div>
      )}

      {/* 2. FLOATING SPEECH BUBBLE (RESPONDING STATE) */}
      {state === "RESPONDING" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-bounce [animation-duration:1.5s] pointer-events-none">
          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black shadow-xl">
            <MessageSquare className="w-3.5 h-3.5 fill-current" />
            <span>💬 {agent.name} respondendo lead no WhatsApp...</span>
          </div>
        </div>
      )}

      {/* 3. LEARNING HOLOGRAM RING (LEARNING STATE) */}
      {state === "LEARNING" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/90 border border-purple-400/50 text-purple-200 text-[10px] font-bold shadow-xl backdrop-blur-md animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Absorvendo novo conhecimento & regras de frete...</span>
          </div>
        </div>
      )}

      {/* 4. SUCCESS CELEBRATION (SUCCESS STATE) */}
      {state === "SUCCESS" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-in zoom-in duration-300 pointer-events-none">
          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500 text-black text-[10px] font-black shadow-xl">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>🎉 Atendimento concluído & cotação enviada!</span>
          </div>
        </div>
      )}

      {/* 5. ERROR ALERT (ERROR STATE) */}
      {state === "ERROR" && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 animate-pulse pointer-events-none">
          <div className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-xl">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Atenção: oscilação na sessão do WhatsApp</span>
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
            state === "OFFLINE" ? "bg-slate-500" : "bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"
          )}
        />
        <div className="flex items-center gap-1 text-[11px] text-slate-200">
          <strong className="text-white font-bold">{agent.name}</strong>
          <span className="text-slate-500">·</span>
          <span className="font-medium text-slate-300">
            {state === "WORKING"
              ? "Atendimento Ativo"
              : state === "RESPONDING"
              ? "Respondendo Lead"
              : state === "THINKING"
              ? "Processando"
              : state === "LEARNING"
              ? "Aprendendo"
              : state === "SUCCESS"
              ? "Concluído"
              : state === "IDLE"
              ? "Em Espera"
              : "Aguardando ativação"}
          </span>
        </div>
        <Badge
          className={cn(
            "text-[8px] font-mono uppercase px-1.5 py-0 h-4 border shrink-0 bg-black/50 ml-0.5",
            visual.borderColor,
            visual.textColor
          )}
        >
          {visual.badge}
        </Badge>
      </div>
    </>
  );
};
