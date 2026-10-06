import { AgentPresenceState } from "./AgentIdentity";

export interface AgentVisualStateConfig {
  state: AgentPresenceState;
  badge: string;
  label: string;
  description: string;
  color: string;
  textColor: string;
  borderColor: string;
  pulse: boolean;
  characterPose: "seated" | "standing";
  activityDescription: string;
}

export const AGENT_STATE_CONFIGS: Record<AgentPresenceState, AgentVisualStateConfig> = {
  WORKING: {
    state: "WORKING",
    badge: "WORKING",
    label: "Operando",
    description: "Operação de atendimento em andamento",
    color: "bg-emerald-500",
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500/50",
    pulse: true,
    characterPose: "seated",
    activityDescription: "Operando o atendimento",
  },
  IDLE: {
    state: "IDLE",
    badge: "IDLE",
    label: "Aguardando",
    description: "Pronto para atender assim que nova mensagem chegar",
    color: "bg-emerald-400",
    textColor: "text-emerald-300",
    borderColor: "border-emerald-400/40",
    pulse: false,
    characterPose: "standing",
    activityDescription: "Em pé na sala com postura relaxada aguardando chamada",
  },
  THINKING: {
    state: "THINKING",
    badge: "THINKING",
    label: "Processando",
    description: "Preparando resposta",
    color: "bg-cyan-400",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/50",
    pulse: true,
    characterPose: "seated",
    activityDescription: "Processando resposta",
  },
  RESPONDING: {
    state: "RESPONDING",
    badge: "RESPONDING",
    label: "Conversando",
    description: "Respondendo à conversa",
    color: "bg-emerald-400",
    textColor: "text-emerald-300",
    borderColor: "border-emerald-400/60",
    pulse: true,
    characterPose: "seated",
    activityDescription: "Respondendo à conversa",
  },
  LEARNING: {
    state: "LEARNING",
    badge: "LEARNING",
    label: "Aprendendo",
    description: "Atualização de conhecimento em andamento",
    color: "bg-purple-400",
    textColor: "text-purple-300",
    borderColor: "border-purple-500/50",
    pulse: true,
    characterPose: "seated",
    activityDescription: "Atualizando conhecimento",
  },
  SUCCESS: {
    state: "SUCCESS",
    badge: "SUCCESS",
    label: "Concluído",
    description: "Operação concluída",
    color: "bg-emerald-400",
    textColor: "text-emerald-300",
    borderColor: "border-emerald-500/60",
    pulse: false,
    characterPose: "seated",
    activityDescription: "Operação concluída",
  },
  ERROR: {
    state: "ERROR",
    badge: "ERROR",
    label: "Atenção",
    description: "Falha no atendimento; consulte o registro da operação",
    color: "bg-rose-500",
    textColor: "text-rose-400",
    borderColor: "border-rose-500/50",
    pulse: true,
    characterPose: "standing",
    activityDescription: "Aguardando verificação da operação",
  },
  OFFLINE: {
    state: "OFFLINE",
    badge: "OFFLINE",
    label: "Pausado",
    description: "Atendimento indisponível ou desativado",
    color: "bg-slate-500",
    textColor: "text-slate-400",
    borderColor: "border-slate-500/40",
    pulse: false,
    characterPose: "standing",
    activityDescription: "Pausada em pé sem fazer nada no escritório",
  },
  AWAY: {
    state: "AWAY",
    badge: "AWAY",
    label: "Ausente",
    description: "Atendimento temporariamente indisponível",
    color: "bg-amber-400",
    textColor: "text-amber-400",
    borderColor: "border-amber-400/50",
    pulse: false,
    characterPose: "standing",
    activityDescription: "Fora da mesa aguardando retorno de escala",
  },
};

export function getAgentStateVisual(state: AgentPresenceState): AgentVisualStateConfig {
  return AGENT_STATE_CONFIGS[state] || AGENT_STATE_CONFIGS.IDLE;
}
