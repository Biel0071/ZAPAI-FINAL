export type AgentDepartment =
  | "vendas"
  | "suporte"
  | "pos_venda"
  | "financeiro"
  | "marketing"
  | "operacional"
  | "recepcao"
  | "gerencia";

export type AgentGender = "female" | "male" | "non-binary";

export type AgentHairStyle =
  | "ponytail"
  | "wavy_long"
  | "short_fade"
  | "afro_puff"
  | "buzz_cut"
  | "undercut"
  | "straight_mid"
  | "curly_bob";

export type AgentClothingStyle =
  | "uniforme_loja"
  | "social_executivo"
  | "polo_comercial"
  | "casual_tech"
  | "avental_balcao";

export type AgentAccessory =
  | "headset"
  | "cracha"
  | "oculos"
  | "relogio"
  | "prancheta";

export type AgentRoomTheme =
  | "escritorio_zai"
  | "balcao_loja"
  | "deposito_logistica"
  | "corporate_suite"
  | "suporte_sac";

export type AgentPresenceState =
  | "WORKING"
  | "IDLE"
  | "THINKING"
  | "RESPONDING"
  | "LEARNING"
  | "SUCCESS"
  | "ERROR"
  | "OFFLINE"
  | "AWAY";

export interface AgentAppearance {
  gender: AgentGender;
  skinTone: string;
  hairStyle: AgentHairStyle;
  hairColor: string;
  clothingStyle: AgentClothingStyle;
  clothingColor: string;
  accessories: AgentAccessory[];
  avatarUrl?: string;
}

export interface AgentWorkspaceConfig {
  roomTheme: AgentRoomTheme;
  primaryColor: string;
  monitorsCount: 1 | 2;
  deskItems: string[];
  ambientLight: "emerald" | "blue" | "warm" | "cyber" | "slate";
}

export interface AgentPersonalityConfig {
  tone: string;
  communicationStyle: "curto" | "consultivo" | "direto" | "amigavel";
  empathy: number; // 0 - 100
  proactivity: number; // 0 - 100
  persuasion: number; // 0 - 100
  patience: number; // 0 - 100
  formality: number; // 0 - 100
}

export interface AgentIdentity {
  id: string;
  key: string;
  companyId?: string;
  name: string;
  role: string;
  department: AgentDepartment;
  objective: string;
  personality: AgentPersonalityConfig;
  appearance: AgentAppearance;
  workspace: AgentWorkspaceConfig;
  presenceState: AgentPresenceState;
  currentActivity: string;
  isPlatformAssistant?: boolean;
  active: boolean;
  stats?: {
    chatsToday: number;
    slaPercent: number;
    satisfactionCsat: number;
    avgResponseTime: string;
    totalConversions?: number;
  };
}

export const DEPARTMENT_METADATA: Record<
  AgentDepartment,
  { label: string; iconName: string; defaultRole: string; defaultColor: string; theme: AgentRoomTheme }
> = {
  vendas: {
    label: "Vendas & Comercial",
    iconName: "Target",
    defaultRole: "Especialista em Vendas & Fechamento",
    defaultColor: "#10b981",
    theme: "escritorio_zai",
  },
  suporte: {
    label: "Suporte Técnico & SAC",
    iconName: "LifeBuoy",
    defaultRole: "Atendente SAC & Suporte Humanizado",
    defaultColor: "#06b6d4",
    theme: "suporte_sac",
  },
  pos_venda: {
    label: "Pós-Venda & CS",
    iconName: "HeartHandshake",
    defaultRole: "Consultor de Pós-Venda & Fidelização",
    defaultColor: "#8b5cf6",
    theme: "escritorio_zai",
  },
  financeiro: {
    label: "Financeiro & Boletos",
    iconName: "CreditCard",
    defaultRole: "Agente de Cobrança & 2ª Via",
    defaultColor: "#f59e0b",
    theme: "corporate_suite",
  },
  marketing: {
    label: "Marketing & Campanhas",
    iconName: "Megaphone",
    defaultRole: "Estrategista de Engajamento",
    defaultColor: "#ec4899",
    theme: "escritorio_zai",
  },
  operacional: {
    label: "Operacional & Balcão",
    iconName: "Package",
    defaultRole: "Consultor de Materiais & Frete",
    defaultColor: "#64748b",
    theme: "balcao_loja",
  },
  recepcao: {
    label: "Recepção & Triagem",
    iconName: "Users",
    defaultRole: "Recepcionista & Agendamentos",
    defaultColor: "#14b8a6",
    theme: "escritorio_zai",
  },
  gerencia: {
    label: "Supervisão & Gerência",
    iconName: "ShieldCheck",
    defaultRole: "Supervisor de Atendimento ZAI",
    defaultColor: "#3b82f6",
    theme: "corporate_suite",
  },
};

export function normalizeAgentToIdentity(agent: any, fallbackThemeColor = "#10b981"): AgentIdentity {
  if (!agent) {
    return {
      id: "agent-default",
      key: "camila",
      name: "Camila",
      role: "Especialista em Vendas",
      department: "vendas",
      objective: "Atender leads e conduzir para orçamento com agilidade",
      presenceState: "OFFLINE",
      currentActivity: "Aguardando configuração do atendente",
      active: false,
      personality: {
        tone: "friendly",
        communicationStyle: "consultivo",
        empathy: 85,
        proactivity: 80,
        persuasion: 75,
        patience: 90,
        formality: 40,
      },
      appearance: {
        gender: "female",
        skinTone: "#e2b07e",
        hairStyle: "ponytail",
        hairColor: "#4a2c11",
        clothingStyle: "uniforme_loja",
        clothingColor: fallbackThemeColor,
        accessories: ["headset", "cracha"],
      },
      workspace: {
        roomTheme: "escritorio_zai",
        primaryColor: fallbackThemeColor,
        monitorsCount: 1,
        deskItems: ["pc_monitor", "keyboard", "coffee_mug", "plant"],
        ambientLight: "emerald",
      },
    };
  }

  const rawKey = String(agent.key || agent.id || "camila").toLowerCase();
  const name = String(agent.name || (rawKey === "zaibot" ? "ZAIBOT" : "Camila"));
  const role = String(agent.role || agent.sector || (rawKey === "zaibot" ? "Assistente Operacional ZAI" : "Especialista em Vendas"));

  // Detect Department
  let department: AgentDepartment = "vendas";
  const lowerRole = (role + " " + (agent.sector || "") + " " + name).toLowerCase();
  if (lowerRole.includes("suporte") || lowerRole.includes("sac") || lowerRole.includes("técnico")) {
    department = "suporte";
  } else if (lowerRole.includes("pós") || lowerRole.includes("pos") || lowerRole.includes("cs")) {
    department = "pos_venda";
  } else if (lowerRole.includes("financeiro") || lowerRole.includes("cobrança") || lowerRole.includes("boleto")) {
    department = "financeiro";
  } else if (lowerRole.includes("marketing") || lowerRole.includes("campanha")) {
    department = "marketing";
  } else if (lowerRole.includes("balcão") || lowerRole.includes("depósito") || lowerRole.includes("estoque")) {
    department = "operacional";
  } else if (lowerRole.includes("recepção") || lowerRole.includes("agendamento")) {
    department = "recepcao";
  } else if (lowerRole.includes("gerente") || lowerRole.includes("supervisor")) {
    department = "gerencia";
  }

  // Detect Gender
  let gender: AgentGender = "female";
  if (agent.character?.gender) {
    gender = agent.character.gender;
  } else if (agent.gender) {
    gender = agent.gender;
  } else {
    const isMale =
      name.toLowerCase().includes("joao") ||
      name.toLowerCase().includes("joão") ||
      name.toLowerCase().includes("carlos") ||
      name.toLowerCase().includes("marcos") ||
      name.toLowerCase().includes("gabriel") ||
      name.toLowerCase().includes("lucas") ||
      name.toLowerCase().includes("rafael") ||
      name.toLowerCase().includes("felipe");
    gender = isMale ? "male" : "female";
  }

  // Presence State derivation
  const status = String(agent.presenceState || agent.status || "").toUpperCase();
  let presenceState: AgentPresenceState = "IDLE";
  if (agent.active === false || status === "OFFLINE" || status === "PAUSED") {
    presenceState = "OFFLINE";
  } else if (status === "WORKING" || status === "TYPING") {
    presenceState = "WORKING";
  } else if (status === "THINKING" || status === "PROCESSING") {
    presenceState = "THINKING";
  } else if (status === "RESPONDING" || status === "TALKING") {
    presenceState = "RESPONDING";
  } else if (status === "LEARNING") {
    presenceState = "LEARNING";
  } else if (status === "SUCCESS") {
    presenceState = "SUCCESS";
  } else if (status === "ERROR") {
    presenceState = "ERROR";
  } else if (status === "AWAY") {
    presenceState = "AWAY";
  }

  const deptMeta = DEPARTMENT_METADATA[department];
  const charCfg = agent.character || agent.config || {};

  return {
    id: String(agent.id || agent.key || rawKey),
    key: rawKey,
    companyId: agent.companyId,
    name,
    role,
    department,
    objective: agent.objective || "Atendimento rápido, resolutivo e consultivo no WhatsApp.",
    active: presenceState !== "OFFLINE",
    isPlatformAssistant: Boolean(agent.isPlatformAssistant || rawKey === "zaibot"),
    presenceState,
    currentActivity:
      agent.currentActivity ||
      (presenceState === "OFFLINE"
        ? `${name} está fora de expediente (Em pé aguardando ativação)`
        : presenceState === "WORKING"
        ? `${name} operando o atendimento`
        : presenceState === "THINKING"
        ? "Processando resposta"
        : `${name} pronto para novos atendimentos`),
    personality: {
      tone: agent.tone || "friendly",
      communicationStyle: agent.communicationStyle || "consultivo",
      empathy: agent.empathyScore || 85,
      proactivity: agent.proactivityScore || 80,
      persuasion: agent.persuasionScore || 75,
      patience: agent.patienceScore || 90,
      formality: agent.formalityScore || 45,
    },
    appearance: {
      gender,
      skinTone: charCfg.skinTone || (gender === "male" ? "#b97a48" : "#e2b07e"),
      hairStyle: charCfg.hairStyle || (gender === "male" ? "short_fade" : "ponytail"),
      hairColor: charCfg.hairColor || "#4a2c11",
      clothingStyle: charCfg.clothingStyle || "uniforme_loja",
      clothingColor: charCfg.clothingColor || deptMeta.defaultColor || fallbackThemeColor,
      accessories: charCfg.accessories || ["headset", "cracha"],
      avatarUrl: agent.avatar || charCfg.avatarUrl,
    },
    workspace: {
      roomTheme: charCfg.scene || deptMeta.theme || "escritorio_zai",
      primaryColor: charCfg.clothingColor || deptMeta.defaultColor || fallbackThemeColor,
      monitorsCount: department === "suporte" || department === "gerencia" ? 2 : 1,
      deskItems: ["pc_monitor", "keyboard", "mouse", "coffee_mug", "plant"],
      ambientLight: department === "financeiro" ? "warm" : department === "suporte" ? "blue" : "emerald",
    },
    stats: agent.stats,
  };
}
