import { API_BASE_URL } from "@/core/lib/backendConfig";
import { buildApiHeaders } from "@/core/lib/apiGuard";

export interface ZaiAssistantPersonality {
  tone: "executivo_direto" | "analitico_dados" | "consultivo_amigavel" | "operacional_tecnico";
  objectivity: number;
  proactivity: number;
  formality: number;
  greetingMessage: string;
}

export interface ZaiAssistantConfig {
  enabled: boolean;
  role: "system_assistant_only";
  name: string;
  mascotModel: string;
  mascotAvatarUrl: string;
  personality: ZaiAssistantPersonality;
  updatedAt?: string;
}

export interface ZaiMascotModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  avatarUrl: string;
}

export interface ZaiPersonalityToneOption {
  id: ZaiAssistantPersonality["tone"];
  label: string;
  description: string;
}

export const ZAI_MASCOT_MODELS: ZaiMascotModelOption[] = [
  {
    id: "zaibot_avatar",
    name: "Robô ZAI 3D Oficial",
    badge: "Padrão ZAI",
    description: "Mascote robótico oficial com visor digital neon e headset corporativo.",
    avatarUrl: "/assets/mascot/zaibot_avatar.png",
  },
  {
    id: "mascot_standing_thumbsup",
    name: "ZAI Executivo Receptivo",
    badge: "Boas-Vindas",
    description: "Postura em pé receptiva para assistência administrativa e gestão.",
    avatarUrl: "/assets/mascot/mascot_standing_thumbsup.png",
  },
  {
    id: "mascot_laptop_working",
    name: "ZAI Analista de Operação",
    badge: "Operação & BI",
    description: "Mascote operando terminal de métricas, filas e diagnóstico em tempo real.",
    avatarUrl: "/assets/mascot/mascot_laptop_working.png",
  },
  {
    id: "mascot_mobile",
    name: "ZAI Especialista Canais",
    badge: "Conectividade",
    description: "Focado no monitoramento de sessões WhatsApp, QR Code e saúde de rede.",
    avatarUrl: "/assets/mascot/mascot_mobile.png",
  },
  {
    id: "mascot_celebrating",
    name: "ZAI Alta Performance",
    badge: "Metas & Escala",
    description: "Visual dinâmico voltado para acompanhamento de metas e campanhas.",
    avatarUrl: "/assets/mascot/mascot_celebrating.png",
  },
];

export const ZAI_PERSONALITY_TONES: ZaiPersonalityToneOption[] = [
  {
    id: "executivo_direto",
    label: "Executivo & Direto",
    description: "Respostas enxutas focadas em indicadores rápidos, status e tomada de decisão.",
  },
  {
    id: "analitico_dados",
    label: "Analítico & Orientado a Dados",
    description: "Detalha métricas de conversão, volume de mensagens, filas e performance.",
  },
  {
    id: "consultivo_amigavel",
    label: "Consultivo & Amigável",
    description: "Guia passo a passo os operadores e administradores na configuração do sistema.",
  },
  {
    id: "operacional_tecnico",
    label: "Operacional & Diagnóstico",
    description: "Prioriza status técnico de conexões WhatsApp, filas, workers e logs.",
  },
];

const STORAGE_KEY = "zai_system_assistant_config_v1";
export const ZAI_CONFIG_EVENT = "zai-assistant-config-updated";

export const DEFAULT_ZAI_ASSISTANT_CONFIG: ZaiAssistantConfig = {
  enabled: false, // Desativado no momento por padrão (ativável em Configurações)
  role: "system_assistant_only",
  name: "Assistente ZAI (ZAIBOT)",
  mascotModel: "zaibot_avatar",
  mascotAvatarUrl: "/assets/mascot/zaibot_avatar.png",
  personality: {
    tone: "executivo_direto",
    objectivity: 85,
    proactivity: 70,
    formality: 65,
    greetingMessage:
      "Olá! Sou o ZAIBOT, seu assistente interno do sistema ZAI.\nPosso consultar atendentes, conexões, lojas, fila e uso de IA. Como posso ajudar agora?",
  },
};

export function getZaiAssistantConfig(): ZaiAssistantConfig {
  if (typeof window === "undefined") return DEFAULT_ZAI_ASSISTANT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ZAI_ASSISTANT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_ZAI_ASSISTANT_CONFIG,
      ...parsed,
      role: "system_assistant_only",
      personality: {
        ...DEFAULT_ZAI_ASSISTANT_CONFIG.personality,
        ...(parsed?.personality || {}),
      },
    };
  } catch {
    return DEFAULT_ZAI_ASSISTANT_CONFIG;
  }
}

export function setLocalZaiAssistantConfig(next: Partial<ZaiAssistantConfig>): ZaiAssistantConfig {
  const current = getZaiAssistantConfig();
  const modelObj =
    ZAI_MASCOT_MODELS.find((m) => m.id === (next.mascotModel || current.mascotModel)) ||
    ZAI_MASCOT_MODELS[0];

  const merged: ZaiAssistantConfig = {
    ...current,
    ...next,
    role: "system_assistant_only",
    mascotModel: modelObj.id,
    mascotAvatarUrl: next.mascotAvatarUrl || modelObj.avatarUrl,
    personality: {
      ...current.personality,
      ...(next.personality || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent(ZAI_CONFIG_EVENT, { detail: merged }));
    } catch {
      // ignore storage errors
    }
  }

  return merged;
}

export async function fetchZaiAssistantConfigFromApi(): Promise<ZaiAssistantConfig> {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/evolution/zai-assistant-config`, {
      method: "GET",
      headers: buildApiHeaders(),
    });
    if (response.ok) {
      const json = (await response.json()) as { success?: boolean; data?: Partial<ZaiAssistantConfig> };
      if (json?.data && typeof json.data === "object") {
        return setLocalZaiAssistantConfig(json.data);
      }
    }
  } catch {
    // fallback to local config
  }
  return getZaiAssistantConfig();
}

export async function saveZaiAssistantConfigToApi(
  next: Partial<ZaiAssistantConfig>
): Promise<ZaiAssistantConfig> {
  const merged = setLocalZaiAssistantConfig(next);
  try {
    await fetch(`${API_BASE_URL}/ai/evolution/zai-assistant-config`, {
      method: "PUT",
      headers: {
        ...buildApiHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(merged),
    });
  } catch {
    // persisted locally even if offline
  }
  return merged;
}
