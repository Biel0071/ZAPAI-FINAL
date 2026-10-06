/**
 * ZAI Enterprise — Character Definition & Asset Architecture
 * Defines character presets, high-fidelity asset paths, 2.5D visual layers,
 * lighting profiles and state machine mapping for living digital attendants.
 */

import { AgentPresenceState, AgentIdentity } from "./AgentIdentity";

export interface CharacterAssetLayer {
  working: string;
  standing: string;
  avatar: string;
}

export interface CharacterPreset {
  id: string;
  name: string;
  gender: "female" | "male" | "robot";
  archetype: "enterprise_sales" | "tech_support" | "specialist" | "platform_mascot";
  assets: CharacterAssetLayer;
  themeColor: string;
  accentColor: string;
  tagline: string;
}

export const CHARACTER_PRESETS: Record<string, CharacterPreset> = {
  camila: {
    id: "camila",
    name: "Camila",
    gender: "female",
    archetype: "enterprise_sales",
    assets: {
      working: "/assets/characters/camila/working.jpg",
      standing: "/assets/characters/camila/standing.jpg",
      avatar: "/assets/evolution/camila_avatar.png",
    },
    themeColor: "#10b981", // Emerald
    accentColor: "#34d399",
    tagline: "Especialista em Vendas & Conversão WhatsApp",
  },
  rafael: {
    id: "rafael",
    name: "Rafael",
    gender: "male",
    archetype: "tech_support",
    assets: {
      working: "/assets/characters/rafael/working.jpg",
      standing: "/assets/characters/rafael/standing.jpg",
      avatar: "/assets/evolution/carlos_avatar.png",
    },
    themeColor: "#0ea5e9", // Sky Blue
    accentColor: "#38bdf8",
    tagline: "Especialista em Suporte Técnico & Pós-Venda",
  },
  julia: {
    id: "julia",
    name: "Julia",
    gender: "female",
    archetype: "specialist",
    assets: {
      working: "/assets/characters/julia/working.jpg",
      standing: "/assets/characters/julia/standing.jpg",
      avatar: "/assets/evolution/marina_avatar.png",
    },
    themeColor: "#8b5cf6", // Purple/Violet
    accentColor: "#a78bfa",
    tagline: "Especialista em Atendimento Consultivo",
  },
  zaibot: {
    id: "zaibot",
    name: "ZAIBOT",
    gender: "robot",
    archetype: "platform_mascot",
    assets: {
      working: "/assets/characters/zaibot/working.jpg",
      standing: "/assets/characters/zaibot/standing.jpg",
      avatar: "/assets/mascot/zaibot_avatar.png",
    },
    themeColor: "#00f090", // Cyber Neon Green
    accentColor: "#00ffcc",
    tagline: "Inteligência Operacional Central do ZAI CRM",
  },
};

/**
 * Resolves the character preset for any agent instance
 */
export function resolveCharacterPreset(agent?: Partial<AgentIdentity> | null): CharacterPreset {
  if (!agent) return CHARACTER_PRESETS.camila;

  const key = String(agent.key || agent.id || "").toLowerCase();
  const name = String(agent.name || "").toLowerCase();

  if (key.includes("zaibot") || name.includes("zaibot") || agent.isPlatformAssistant) {
    return CHARACTER_PRESETS.zaibot;
  }
  if (key.includes("rafael") || name.includes("rafael") || key.includes("carlos") || name.includes("carlos")) {
    return CHARACTER_PRESETS.rafael;
  }
  if (key.includes("julia") || name.includes("julia") || key.includes("marina") || name.includes("marina")) {
    return CHARACTER_PRESETS.julia;
  }
  if (key.includes("camila") || name.includes("camila") || key.includes("ana") || name.includes("ana")) {
    return CHARACTER_PRESETS.camila;
  }

  // Fallback based on gender
  if (agent.appearance?.gender === "male" || (agent as any)?.character?.gender === "male") {
    return CHARACTER_PRESETS.rafael;
  }

  return CHARACTER_PRESETS.camila;
}

/**
 * State visual configurations for the 2.5D renderer
 */
export interface StateVisualConfig {
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  ringGlow: string;
  statusIconColor: string;
  pulseAnimation: string;
  isOperating: boolean;
}

export const STATE_VISUAL_MAP: Record<AgentPresenceState, StateVisualConfig> = {
  WORKING: {
    label: "EM ATENDIMENTO",
    badgeBg: "bg-emerald-500/15",
    badgeBorder: "border-emerald-500/40",
    badgeText: "text-emerald-400",
    ringGlow: "shadow-[0_0_40px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/40",
    statusIconColor: "#10b981",
    pulseAnimation: "animate-pulse",
    isOperating: true,
  },
  IDLE: {
    label: "AGUARDANDO LEADS",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/20",
    badgeText: "text-emerald-300",
    ringGlow: "shadow-[0_0_25px_rgba(16,185,129,0.20)] ring-1 ring-emerald-500/20",
    statusIconColor: "#34d399",
    pulseAnimation: "",
    isOperating: true,
  },
  THINKING: {
    label: "PROCESSANDO RESPOSTA",
    badgeBg: "bg-cyan-500/15",
    badgeBorder: "border-cyan-500/40",
    badgeText: "text-cyan-400",
    ringGlow: "shadow-[0_0_35px_rgba(6,182,212,0.35)] ring-1 ring-cyan-500/40",
    statusIconColor: "#06b6d4",
    pulseAnimation: "animate-pulse",
    isOperating: true,
  },
  RESPONDING: {
    label: "ENVIANDO NO WHATSAPP",
    badgeBg: "bg-emerald-500/20",
    badgeBorder: "border-emerald-400/60",
    badgeText: "text-emerald-300 font-bold",
    ringGlow: "shadow-[0_0_45px_rgba(16,185,129,0.50)] ring-2 ring-emerald-400/60",
    statusIconColor: "#00f090",
    pulseAnimation: "animate-ping",
    isOperating: true,
  },
  LEARNING: {
    label: "ATUALIZANDO CONHECIMENTO",
    badgeBg: "bg-purple-500/15",
    badgeBorder: "border-purple-500/40",
    badgeText: "text-purple-400",
    ringGlow: "shadow-[0_0_35px_rgba(168,85,247,0.35)] ring-1 ring-purple-500/40",
    statusIconColor: "#a855f7",
    pulseAnimation: "animate-pulse",
    isOperating: true,
  },
  SUCCESS: {
    label: "OPERAÇÃO CONCLUÍDA",
    badgeBg: "bg-emerald-600/20",
    badgeBorder: "border-emerald-400/50",
    badgeText: "text-emerald-300",
    ringGlow: "shadow-[0_0_40px_rgba(16,185,129,0.40)] ring-1 ring-emerald-400/50",
    statusIconColor: "#10b981",
    pulseAnimation: "",
    isOperating: true,
  },
  ERROR: {
    label: "ATENÇÃO NECESSÁRIA",
    badgeBg: "bg-amber-500/15",
    badgeBorder: "border-amber-500/40",
    badgeText: "text-amber-400",
    ringGlow: "shadow-[0_0_30px_rgba(245,158,11,0.30)] ring-1 ring-amber-500/30",
    statusIconColor: "#f59e0b",
    pulseAnimation: "animate-pulse",
    isOperating: false,
  },
  OFFLINE: {
    label: "EXPEDIENTE EM PAUSA",
    badgeBg: "bg-slate-800/40",
    badgeBorder: "border-slate-700/50",
    badgeText: "text-slate-400",
    ringGlow: "shadow-[0_0_15px_rgba(0,0,0,0.5)] ring-1 ring-white/5",
    statusIconColor: "#64748b",
    pulseAnimation: "",
    isOperating: false,
  },
  AWAY: {
    label: "INDISPONÍVEL",
    badgeBg: "bg-blue-500/10",
    badgeBorder: "border-blue-500/30",
    badgeText: "text-blue-400",
    ringGlow: "shadow-[0_0_20px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/25",
    statusIconColor: "#3b82f6",
    pulseAnimation: "",
    isOperating: false,
  },
};
