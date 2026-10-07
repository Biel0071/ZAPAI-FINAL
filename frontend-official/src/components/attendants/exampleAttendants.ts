import { AgentAvatarConfig } from "@/components/avatar-engine/AvatarDefinition";

export interface AttendantDisplayModel {
  id: string;
  key: string;
  name: string;
  role: string;
  isExample: boolean;
  status?: "online" | "paused" | "offline";
  avatarConfig: Partial<AgentAvatarConfig>;
  personality?: string;
  whatsappName?: string;
  phone?: string;
  modelBadge?: string;
}

/**
 * Exemplos visuais demonstrativos de funcionários digitais (Modelos)
 * NUNCA persistir no banco de dados, NUNCA enviar para a API.
 * Servem unicamente para demonstração visual da plataforma e inspiração para criação.
 */
export const EXAMPLE_ATTENDANTS: AttendantDisplayModel[] = [
  {
    id: "example-joao",
    key: "example-joao",
    name: "João",
    role: "Suporte Técnico",
    isExample: true,
    modelBadge: "Suporte",
    avatarConfig: {
      agentId: "example-joao",
      body: "male",
      base: "male",
      skin: "fair",
      hair: "male_short_fade",
      hairColor: "black",
      face: "face_glasses_round",
      eyes: "eyes_focused_tech",
      glasses: "glasses_round_black",
      outfit: "polo_zai_black",
      clothing: "polo_zai_black",
      accessories: ["headset_zai_green"],
      style: "tech",
      catalogSpriteId: "sprite_r1_c2",
    },
    personality: "Prestativo, analítico e ágil para resolver dúvidas de produtos e suporte.",
  },
  {
    id: "example-ana",
    key: "example-ana",
    name: "Ana",
    role: "Atendimento & SAC",
    isExample: true,
    modelBadge: "Atendimento",
    avatarConfig: {
      agentId: "example-ana",
      body: "female",
      base: "female",
      skin: "peach",
      hair: "female_ponytail_brunette",
      hairColor: "dark_brown",
      face: "face_friendly_smile",
      eyes: "eyes_friendly_hazel",
      glasses: "none",
      outfit: "blazer_emerald_trim",
      clothing: "blazer_emerald_trim",
      accessories: ["headset_callcenter", "badge_zai_lanyard"],
      style: "corporate",
      catalogSpriteId: "sprite_r2_c1",
    },
    personality: "Cordial, empática e focada em acolher clientes e esclarecer dúvidas com clareza.",
  },
  {
    id: "example-pedro",
    key: "example-pedro",
    name: "Pedro",
    role: "Pós-Venda & Garantia",
    isExample: true,
    modelBadge: "Pós-Venda",
    avatarConfig: {
      agentId: "example-pedro",
      body: "male",
      base: "male",
      skin: "tan",
      hair: "male_slick_exec",
      hairColor: "dark_brown",
      face: "face_calm_support",
      eyes: "eyes_confident_blue",
      glasses: "glasses_square_exec",
      outfit: "shirt_business_white",
      clothing: "shirt_business_white",
      accessories: ["badge_clip_chest"],
      style: "operational",
      catalogSpriteId: "sprite_r1_c8",
    },
    personality: "Atencioso e resolutivo em processos de garantia, troca e acompanhamento de entrega.",
  },
  {
    id: "example-mariana",
    key: "example-mariana",
    name: "Mariana",
    role: "Vendas & Campanhas",
    isExample: true,
    modelBadge: "Vendas",
    avatarConfig: {
      agentId: "example-mariana",
      body: "female",
      base: "female",
      skin: "fair",
      hair: "female_wavy_blonde",
      hairColor: "golden_blonde",
      face: "face_wink_cheerful",
      eyes: "eyes_amber_sparkle",
      glasses: "none",
      outfit: "jacket_exec_dark",
      clothing: "jacket_exec_dark",
      accessories: ["smartwatch_neon"],
      style: "sales",
      catalogSpriteId: "sprite_r2_c3",
    },
    personality: "Proativa, persuasiva e especialista em ofertas, recuperação de leads e fechamento comercial.",
  },
];
