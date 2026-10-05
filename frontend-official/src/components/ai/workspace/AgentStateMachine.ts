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
    label: "Atendendo no Computador",
    description: "Operando terminal e respondendo clientes no WhatsApp",
    color: "bg-emerald-500",
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500/50",
    pulse: true,
    characterPose: "seated",
    activityDescription: "Digitando no teclado e consultando estoque",
  },
  IDLE: {
    state: "IDLE",
    badge: "IDLE",
    label: "Parado / Em Espera",
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
    label: "Raciocínio Neural",
    description: "Consultando base de conhecimento e calculando proposta",
    color: "bg-cyan-400",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/50",
    pulse: true,
    characterPose: "seated",
    activityDescription: "Analisando histórico da conversa e tabelas de preço",
  },
  RESPONDING: {
    state: "RESPONDING",
    badge: "RESPONDING",
    label: "Enviando no WhatsApp",
    description: "Transmitindo resposta humanizada com cadência programada",
    color: "bg-emerald-400",
    textColor: "text-emerald-300",
    borderColor: "border-emerald-400/60",
    pulse: true,
    characterPose: "seated",
    activityDescription: "Disparando mensagem com cadência e digitação",
  },
  LEARNING: {
    state: "LEARNING",
    badge: "LEARNING",
    label: "Aprendendo Padrão",
    description: "Incorporando correção de operador e novas regras",
    color: "bg-purple-400",
    textColor: "text-purple-300",
    borderColor: "border-purple-500/50",
    pulse: true,
    characterPose: "seated",
    activityDescription: "Indexando novo produto e ajustando diretrizes",
  },
  SUCCESS: {
    state: "SUCCESS",
    badge: "SUCCESS",
    label: "Atendimento Concluído",
    description: "Lead qualificado ou orçamento fechado com sucesso",
    color: "bg-emerald-400",
    textColor: "text-emerald-300",
    borderColor: "border-emerald-500/60",
    pulse: false,
    characterPose: "seated",
    activityDescription: "Comemorando conclusão de atendimento de alta conversão",
  },
  ERROR: {
    state: "ERROR",
    badge: "ERROR",
    label: "Atenção Operacional",
    description: "Oscilação de conexão WhatsApp ou cota de IA atingida",
    color: "bg-rose-500",
    textColor: "text-rose-400",
    borderColor: "border-rose-500/50",
    pulse: true,
    characterPose: "standing",
    activityDescription: "Aguardando reautenticação da conexão",
  },
  OFFLINE: {
    state: "OFFLINE",
    badge: "OFFLINE",
    label: "Pausada / Fora de Expediente",
    description: "Atendimento automatizado desativado pelo administrador",
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
    label: "Ausente / Intervalo",
    description: "Pausa programada de expediente ou almoço",
    color: "bg-amber-400",
    textColor: "text-amber-400",
    borderColor: "border-amber-400/50",
    pulse: false,
    characterPose: "standing",
    activityDescription: "Fora da mesa aguardando retorno de escala",
  },
};

export function getAgentStateVisual(state: AgentPresenceState): AgentVisualStateConfig {
  return AGENT_STATE_CONFIGS[state] || AGENT_STATE_CONFIGS.WORKING;
}
