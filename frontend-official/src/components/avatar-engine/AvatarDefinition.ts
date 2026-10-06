/**
 * ZAI CRM Enterprise — Modular Avatar Engine Definitions
 * Standardizes the modular, layer-based, editable avatar system.
 * Avatar = Body + Skin + Face + Hair + Eyes + Eyebrows + FacialHair + Glasses + Headset + Clothing + Shoes + Accessories + Badge + WorkObject + StoreBranding + AnimationState + PersonalityVisuals
 */

export type BodyType = "male" | "female" | "neutral" | "robot";

export type SkinTone = 
  | "fair"       // #fef08a / #fde68a
  | "peach"      // #fcd34d
  | "tan"        // #f59e0b
  | "bronze"     // #d97706
  | "dark"       // #b45309
  | "deep_dark";  // #78350f

export type HairColor =
  | "black"      // #18181b
  | "dark_brown" // #3f2e1e
  | "auburn"     // #78350f
  | "golden_blonde" // #eab308
  | "platinum"   // #e2e8f0
  | "neon_pink"  // #ec4899
  | "cyber_blue" // #3b82f6
  | "fiery_red"  // #ef4444
  | "emerald"    // #10b981
  | "lavender";  // #a855f7

export type AnimationState =
  | "IDLE"
  | "WORKING"
  | "THINKING"
  | "TYPING"
  | "TALKING"
  | "WALKING"
  | "SUCCESS"
  | "ERROR"
  | "WAITING"
  | "OFFLINE"
  | "ALERT";

export interface StoreVisualDNA {
  storeId: string;
  storeName: string;
  primaryColor: string;     // e.g. #10b981 (ZAI Emerald)
  secondaryColor: string;   // e.g. #0f172a (Obsidian Dark)
  accentColor: string;      // e.g. #00f090 (Neon Accent)
  logo: string;             // Text logo or image URL
  defaultClothing: string;  // e.g. 'polo_zai_black'
  defaultAccessories: string[]; // e.g. ['headset_zai_green', 'badge_zai_lanyard']
  defaultBadge: boolean;
  defaultShoes: string;     // e.g. 'sneakers_zai_green'
  visualStyle: "pixel_isometric" | "habbo_retro" | "rpg_social";
  updatedAt?: string;
}

export interface StoreBranding {
  storeName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logo: string;
  showLogoOnChest?: boolean;
  showLogoOnBadge?: boolean;
  showLogoOnCap?: boolean;
  showLogoOnObject?: boolean;
}

export interface PersonalityVisualConfig {
  posture: "energetic" | "executive" | "tech" | "sales" | "welcoming" | "analytical" | "relaxed" | "dynamic";
  expression: "friendly_smile" | "confident" | "focused" | "enthusiastic" | "neutral" | "wink";
  preferredObject: string;
  animationStyle: "smooth" | "snappy" | "subtle";
}

export interface ModularAvatarConfig {
  base: "female" | "male";
  face: string;
  hair: string;
  hairColor?: HairColor;
  outfit: string;
  accessories: string[];
  style: string;
}

export interface AgentAvatarConfig {
  id?: string;
  agentId: string;
  storeId?: string;
  body: BodyType;
  base?: "female" | "male";
  skin: SkinTone;
  hair: string;
  hairColor: HairColor;
  face?: string;
  eyes: string;
  eyebrows?: string;
  mouth?: string;
  facialHair?: string;
  glasses: string;
  headset: string;
  clothing: string;
  outfit?: string;
  pants: string;
  shoes: string;
  accessories: Record<string, string> | any;
  style?: string;
  workObject: string;
  badge: boolean;
  branding: StoreBranding;
  animationState: AnimationState;
  personalityVisual: PersonalityVisualConfig;
  catalogSpriteId?: string;
}

/* ==========================================================================
   OFFICIAL AVATAR STUDIO — 5 CATEGORIES (CABELO, ROSTO, ROUPA, ACESSÓRIOS, ESTILO)
   ========================================================================== */

export interface AvatarStudioItem {
  id: string;
  number: string;
  name: string;
  title: string;
  category: "hair" | "face" | "outfit" | "accessories" | "style";
  gender?: "male" | "female" | "all";
  description: string;
  spriteRef?: string;
  icon?: string;
  meta?: Record<string, any>;
  preset?: {
    outfit?: string;
    accessories?: string[];
    face?: string;
    hair?: string;
    posture?: PersonalityVisualConfig["posture"];
    color?: string;
  };
}

// 1. CABELO (Hairs)
export const AVATAR_HAIRS: AvatarStudioItem[] = [
  { id: "hair_01", number: "01", name: "Cabelo 01", title: "Rabo de Cavalo Executivo", category: "hair", gender: "female", spriteRef: "sprite_r2_c1", description: "Penteado executivo com elástico profissional" },
  { id: "hair_02", number: "02", name: "Cabelo 02", title: "Chanel Alinhado", category: "hair", gender: "female", spriteRef: "sprite_r2_c7", description: "Corte médio alinhado na altura dos ombros" },
  { id: "hair_03", number: "03", name: "Cabelo 03", title: "Ondulado Longo Elegante", category: "hair", gender: "female", spriteRef: "sprite_r2_c3", description: "Ondas soltas volumosas e sofisticadas" },
  { id: "hair_04", number: "04", name: "Cabelo 04", title: "Coque Alto Profissional", category: "hair", gender: "female", spriteRef: "sprite_r2_c4", description: "Coque clássico no topo da cabeça" },
  { id: "hair_05", number: "05", name: "Cabelo 05", title: "Curto Fade Moderno", category: "hair", gender: "male", spriteRef: "sprite_r1_c1", description: "Degradê moderno e executivo" },
  { id: "hair_06", number: "06", name: "Cabelo 06", title: "Black Power Texturizado", category: "hair", gender: "all", spriteRef: "sprite_r1_c7", description: "Afro texturizado com contorno desenhado" },
  { id: "hair_07", number: "07", name: "Cabelo 07", title: "Longo Liso com Franja", category: "hair", gender: "female", spriteRef: "sprite_r2_c2", description: "Liso impecável com franja geométrica" },
  { id: "hair_08", number: "08", name: "Cabelo 08", title: "Street Spiky Texturizado", category: "hair", gender: "male", spriteRef: "sprite_r1_c3", description: "Corte texturizado clássico espetado" },
  { id: "hair_09", number: "09", name: "Cabelo 09", title: "Cachos Volumosos", category: "hair", gender: "all", spriteRef: "sprite_r1_c5", description: "Cachos definidos com estilo despojado" },
  { id: "hair_10", number: "10", name: "Cabelo 10", title: "Cyber Wave Longo", category: "hair", gender: "female", spriteRef: "sprite_r2_c10", description: "Mechas longas volumosas estilo cyberpunk" },
];

// 2. ROSTO (Face) — 5ª Categoria oficial
export const AVATAR_FACES: AvatarStudioItem[] = [
  { id: "face_01", number: "01", name: "Rosto 01", title: "Cordial & Empático", category: "face", description: "Expressão cordial, sorriso discreto e olhar atento" },
  { id: "face_02", number: "02", name: "Rosto 02", title: "Confiante & Seguro", category: "face", description: "Leve sorriso de lado com olhar determinado" },
  { id: "face_03", number: "03", name: "Rosto 03", title: "Carismático & Alegre", category: "face", description: "Sorriso aberto, olhar vibrante e empático" },
  { id: "face_04", number: "04", name: "Rosto 04", title: "Expressivo Comercial", category: "face", description: "Olhar consultivo e receptivo voltado a vendas" },
  { id: "face_05", number: "05", name: "Rosto 05", title: "Analítico & Sereno", category: "face", description: "Foco nos detalhes com expressão equilibrada" },
  { id: "face_06", number: "06", name: "Rosto 06", title: "Foco Operacional", category: "face", description: "Postura atenta e olhar concentrado em agilidade" },
];

// 3. ROUPA (Outfit)
export const AVATAR_OUTFITS: AvatarStudioItem[] = [
  { id: "outfit_01", number: "01", name: "Roupa 01", title: "Polo ZAI Corporativa", category: "outfit", spriteRef: "sprite_r1_c1", description: "Polo clássica preta com gola e detalhe verde ZAI" },
  { id: "outfit_02", number: "02", name: "Roupa 02", title: "Camisa Social Branca", category: "outfit", spriteRef: "sprite_r1_c8", description: "Camisa social de botão com crachá executivo" },
  { id: "outfit_03", number: "03", name: "Roupa 03", title: "Moletom Tech Zip", category: "outfit", spriteRef: "sprite_r1_c4", description: "Moletom preto premium com zíper verde neon" },
  { id: "outfit_04", number: "04", name: "Roupa 04", title: "Uniforme Técnico", category: "outfit", spriteRef: "sprite_r3_c3", description: "Camisa azul-marinho com bolsos utilitários" },
  { id: "outfit_05", number: "05", name: "Roupa 05", title: "Blazer Alfaiataria Comercial", category: "outfit", spriteRef: "sprite_r2_c8", description: "Blazer alfaiataria com lapela esmeralda e crachá" },
  { id: "outfit_06", number: "06", name: "Roupa 06", title: "Colete Refletivo Logística", category: "outfit", spriteRef: "sprite_r3_c2", description: "Colete de segurança amarelo fluorescente de expedição" },
  { id: "outfit_07", number: "07", name: "Roupa 07", title: "Camiseta Básica ZAI", category: "outfit", spriteRef: "sprite_r1_c7", description: "Camiseta casual de algodão com escudo no peito" },
  { id: "outfit_08", number: "08", name: "Roupa 08", title: "Jaqueta Bomber ZAI", category: "outfit", spriteRef: "sprite_r1_c6", description: "Jaqueta esportiva preta com bordados verdes" },
];

// 4. ACESSÓRIOS (Accessories)
export const AVATAR_ACCESSORIES: AvatarStudioItem[] = [
  { id: "acc_01", number: "01", name: "Acessório 01", title: "Nenhum (Básico)", category: "accessories", description: "Visual limpo sem acessórios adicionais" },
  { id: "acc_02", number: "02", name: "Acessório 02", title: "Headset Pro Wireless", category: "accessories", spriteRef: "sprite_r1_c1", description: "Headset de atendimento com LED verde integrado" },
  { id: "acc_03", number: "03", name: "Acessório 03", title: "Crachá Lanyard ZAI", category: "accessories", spriteRef: "sprite_r1_c5", description: "Crachá oficial com cordão verde esmeralda" },
  { id: "acc_04", number: "04", name: "Acessório 04", title: "Óculos Executivos", category: "accessories", spriteRef: "sprite_r1_c2", description: "Armação fina de titânio moderna e discreta" },
  { id: "acc_05", number: "05", name: "Acessório 05", title: "Tablet de Vendas", category: "accessories", spriteRef: "sprite_r1_c2", description: "Tablet executivo com CRM e catálogo aberto" },
  { id: "acc_06", number: "06", name: "Acessório 06", title: "Smartwatch ZAI Sync", category: "accessories", spriteRef: "sprite_r1_c7", description: "Relógio inteligente com tela neon de notificações" },
];

// 5. ESTILO (Styles — Presets completos de identidade)
export const AVATAR_STYLES: AvatarStudioItem[] = [
  {
    id: "style_vendas",
    number: "01",
    name: "Vendas",
    title: "Estilo Vendas",
    category: "style",
    description: "Foco comercial, abordagem ativa, metas e fechamento",
    preset: {
      outfit: "outfit_05",
      accessories: ["acc_02"],
      face: "face_04",
      posture: "sales",
      color: "#10b981",
    },
  },
  {
    id: "style_corporativo",
    number: "02",
    name: "Corporativo",
    title: "Estilo Corporativo",
    category: "style",
    description: "Formalidade executiva, alinhamento institucional",
    preset: {
      outfit: "outfit_02",
      accessories: ["acc_03"],
      face: "face_02",
      posture: "executive",
      color: "#0ea5e9",
    },
  },
  {
    id: "style_atendimento",
    number: "03",
    name: "Atendimento",
    title: "Estilo Atendimento",
    category: "style",
    description: "Acolhimento cordial, empatia e suporte consultivo",
    preset: {
      outfit: "outfit_01",
      accessories: ["acc_02"],
      face: "face_01",
      posture: "welcoming",
      color: "#06b6d4",
    },
  },
  {
    id: "style_operacional",
    number: "04",
    name: "Operacional",
    title: "Estilo Operacional",
    category: "style",
    description: "Agilidade, foco em estoque, logística e entregas",
    preset: {
      outfit: "outfit_06",
      accessories: ["acc_05"],
      face: "face_06",
      posture: "dynamic",
      color: "#f59e0b",
    },
  },
  {
    id: "style_tech",
    number: "05",
    name: "Tech",
    title: "Estilo Tech",
    category: "style",
    description: "Especialista em produtos, suporte técnico digital",
    preset: {
      outfit: "outfit_03",
      accessories: ["acc_04"],
      face: "face_05",
      posture: "tech",
      color: "#8b5cf6",
    },
  },
  {
    id: "style_casual",
    number: "06",
    name: "Casual",
    title: "Estilo Casual",
    category: "style",
    description: "Comunicação fluida, atitude jovem e descontraída",
    preset: {
      outfit: "outfit_07",
      accessories: ["acc_06"],
      face: "face_03",
      posture: "relaxed",
      color: "#14b8a6",
    },
  },
  {
    id: "style_premium",
    number: "07",
    name: "Premium",
    title: "Estilo Premium",
    category: "style",
    description: "Negociações exclusivas, alto padrão e sofisticação",
    preset: {
      outfit: "outfit_05",
      accessories: ["acc_04"],
      face: "face_02",
      posture: "executive",
      color: "#eab308",
    },
  },
];

export const AVATAR_ASSETS = {
  hairs: AVATAR_HAIRS,
  faces: AVATAR_FACES,
  outfits: AVATAR_OUTFITS,
  accessories: AVATAR_ACCESSORIES,
  styles: AVATAR_STYLES,
};

/* ==========================================================================
   LEGACY CATALOG ITEMS (COMPATIBILITY)
   ========================================================================== */

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  gender?: "male" | "female" | "all";
  color?: string;
  icon?: string;
  description: string;
  spriteRef?: string;
}

export const SKIN_TONES: Array<{ id: SkinTone; name: string; hex: string; shadow: string }> = [
  { id: "fair", name: "Muito Clara", hex: "#fde68a", shadow: "#f59e0b" },
  { id: "peach", name: "Clara / Pêssego", hex: "#fcd34d", shadow: "#d97706" },
  { id: "tan", name: "Morena Clara", hex: "#f59e0b", shadow: "#b45309" },
  { id: "bronze", name: "Bronze / Média", hex: "#d97706", shadow: "#92400e" },
  { id: "dark", name: "Negra / Ébano", hex: "#b45309", shadow: "#78350f" },
  { id: "deep_dark", name: "Negra Profunda", hex: "#78350f", shadow: "#451a03" },
];

export const HAIR_COLORS: Array<{ id: HairColor; name: string; hex: string }> = [
  { id: "black", name: "Preto Ébano", hex: "#18181b" },
  { id: "dark_brown", name: "Castanho Escuro", hex: "#3f2e1e" },
  { id: "auburn", name: "Castanho Acobreado", hex: "#78350f" },
  { id: "golden_blonde", name: "Loiro Dourado", hex: "#eab308" },
  { id: "platinum", name: "Platinado / Branco", hex: "#e2e8f0" },
  { id: "neon_pink", name: "Rosa Cyber", hex: "#ec4899" },
  { id: "cyber_blue", name: "Azul Elétrico", hex: "#3b82f6" },
  { id: "fiery_red", name: "Vermelho Fogo", hex: "#ef4444" },
  { id: "emerald", name: "Verde ZAI", hex: "#10b981" },
  { id: "lavender", name: "Lavanda Anime", hex: "#a855f7" },
];

// 10+ Male Hairstyles
export const HAIRSTYLES_MALE: CatalogItem[] = [
  { id: "male_short_fade", name: "Fade Curto Moderno", category: "hair", gender: "male", description: "Corte degradê moderno e executivo", spriteRef: "sprite_r1_c1" },
  { id: "male_spiky", name: "Espetado Frontal", category: "hair", gender: "male", description: "Corte espetado texturizado clássico", spriteRef: "sprite_r1_c3" },
  { id: "male_textured_crop", name: "Texturizado Casual", category: "hair", gender: "male", description: "Cabelo médio com volume natural", spriteRef: "sprite_r1_c2" },
  { id: "male_cap_hair", name: "Abaixo do Boné", category: "hair", gender: "male", description: "Cabelo adaptado para boné esportivo", spriteRef: "sprite_r1_c4" },
  { id: "male_curly_brown", name: "Cachos Volumosos", category: "hair", gender: "male", description: "Cachos definidos com estilo despojado", spriteRef: "sprite_r1_c5" },
  { id: "male_anime_silver", name: "Repicado Anime", category: "hair", gender: "male", description: "Corte com mechas pontiagudas futuristas", spriteRef: "sprite_r1_c6" },
  { id: "male_afro_curls", name: "Afro Texturizado", category: "hair", gender: "male", description: "Black power com contorno bem desenhado", spriteRef: "sprite_r1_c7" },
  { id: "male_professor_beard", name: "Médio Acadêmico", category: "hair", gender: "male", description: "Cabelo encorpado com caimento lateral", spriteRef: "sprite_r1_c8" },
  { id: "male_dark_shades", name: "Ondulado Clássico", category: "hair", gender: "male", description: "Ondas clássicas penteadas para trás", spriteRef: "sprite_r1_c9" },
  { id: "male_red_hoodie", name: "Street Spiky", category: "hair", gender: "male", description: "Mechas urbanas com atitude jovem", spriteRef: "sprite_r1_c10" },
];

// 10+ Female Hairstyles
export const HAIRSTYLES_FEMALE: CatalogItem[] = [
  { id: "female_ponytail_brunette", name: "Rabo de Cavalo Alto", category: "hair", gender: "female", description: "Penteado executivo profissional com elástico", spriteRef: "sprite_r2_c1" },
  { id: "female_straight_glasses", name: "Longo com Franja", category: "hair", gender: "female", description: "Liso impecável com franja geométrica", spriteRef: "sprite_r2_c2" },
  { id: "female_wavy_blonde", name: "Ondulado Longo Solto", category: "hair", gender: "female", description: "Ondas volumosas caindo pelos ombros", spriteRef: "sprite_r2_c3" },
  { id: "female_curly_updo", name: "Coque Alto Cacheado", category: "hair", gender: "female", description: "Coque no topo da cabeça com cachos soltos", spriteRef: "sprite_r2_c4" },
  { id: "female_long_wavy_coffee", name: "Castanho Ondulado", category: "hair", gender: "female", description: "Longo natural com mechas iluminadas", spriteRef: "sprite_r2_c5" },
  { id: "female_pink_cap", name: "Longo com Boné ZAI", category: "hair", gender: "female", description: "Mechas longas sob boné esportivo ZAI", spriteRef: "sprite_r2_c6" },
  { id: "female_short_business", name: "Chanel Executivo", category: "hair", gender: "female", description: "Corte médio profissional na altura dos ombros", spriteRef: "sprite_r2_c7" },
  { id: "female_peace_brunette", name: "Ponytail Despojado", category: "hair", gender: "female", description: "Amarração alta com mechas frontais soltas", spriteRef: "sprite_r2_c8" },
  { id: "female_silver_waves", name: "Platinado Glamour", category: "hair", gender: "female", description: "Ondas platinadas longas e sofisticadas", spriteRef: "sprite_r2_c9" },
  { id: "female_blue_wavy", name: "Cyber Wave Longo", category: "hair", gender: "female", description: "Visual cyberpunk com mechas volumosas", spriteRef: "sprite_r2_c10" },
  { id: "female_hardhat_brunette", name: "Longo com Capacete", category: "hair", gender: "female", description: "Cabelo protegido por capacete de obra ZAI", spriteRef: "sprite_r3_c8" },
];

// 10+ Face Expressions & Types
export const FACE_TYPES: CatalogItem[] = [
  { id: "face_friendly_smile", name: "Sorriso Comercial", category: "face", description: "Expressão cordial, dentes à mostra e olhos atentos" },
  { id: "face_confident_smirk", name: "Confiante & Seguro", category: "face", description: "Leve sorriso de lado com olhar determinado" },
  { id: "face_glasses_round", name: "Óculos Redondos Intelectuais", category: "face", description: "Armação preta redonda clássica com brilho" },
  { id: "face_glasses_square", name: "Óculos Executivos Finos", category: "face", description: "Armação retangular moderna e discreta" },
  { id: "face_dark_sunglasses", name: "Óculos Escuros Wayfarer", category: "face", description: "Lentes escuras protegidas com armação preta" },
  { id: "face_beard_mustache", name: "Barba & Bigode Alinhados", category: "face", description: "Barba cheia aparada e bigode desenhado" },
  { id: "face_stubble_clean", name: "Barba por Fazer", category: "face", description: "Sombra facial sutil e traços maduros" },
  { id: "face_wink_cheerful", name: "Piscadela Carismática", category: "face", description: "Olho piscando em sinal de empatia e vitória" },
  { id: "face_focused_analyst", name: "Foco Analítico", category: "face", description: "Olhar concentrado na tela do computador" },
  { id: "face_calm_support", name: "Calmo & Empático", category: "face", description: "Expressão serena para atendimento consultivo" },
];

// 10+ Outfits & Clothing
export const CLOTHING_STYLES: CatalogItem[] = [
  { id: "polo_zai_black", name: "Camisa Polo ZAI Preta", category: "clothing", description: "Polo clássica preta com gola e detalhe verde ZAI", spriteRef: "sprite_r1_c1" },
  { id: "polo_zai_white", name: "Camisa Polo ZAI Branca", category: "clothing", description: "Polo executiva branca com escudo da empresa", spriteRef: "sprite_r1_c3" },
  { id: "hoodie_zai_black", name: "Moletom ZAI Tech Zip", category: "clothing", description: "Moletom preto premium com zíper verde neon", spriteRef: "sprite_r1_c4" },
  { id: "vest_hivis_safety", name: "Colete Refletivo Logística", category: "clothing", description: "Colete de segurança amarelo e verde fluorescente", spriteRef: "sprite_r3_c2" },
  { id: "shirt_business_white", name: "Camisa Social Executiva", category: "clothing", description: "Camisa branca de botão com crachá oficial", spriteRef: "sprite_r1_c8" },
  { id: "jacket_exec_dark", name: "Jaqueta Bomber ZAI", category: "clothing", description: "Jaqueta esportiva preta com bordados verdes", spriteRef: "sprite_r1_c6" },
  { id: "casual_tee_charcoal", name: "Camiseta Básica Carvão", category: "clothing", description: "Camiseta casual de algodão com logo no peito", spriteRef: "sprite_r1_c7" },
  { id: "uniform_tech_navy", name: "Uniforme Técnico Operacional", category: "clothing", description: "Camisa azul-marinho com bolsos utilitários", spriteRef: "sprite_r3_c3" },
  { id: "delivery_cargo_set", name: "Conjunto Expedição & Estoque", category: "clothing", description: "Roupa reforçada com calça cargo e cinto de ferramentas", spriteRef: "sprite_r3_c1" },
  { id: "blazer_emerald_trim", name: "Blazer Corporativo ZAI", category: "clothing", description: "Blazer alfaiataria com lapela em verde esmeralda", spriteRef: "sprite_r2_c8" },
];

// 10+ Accessories (Headset, Eyewear, Headwear, Badge, Bags)
export const ACCESSORIES: CatalogItem[] = [
  { id: "headset_zai_green", name: "Headset ZAI Wireless Pro", category: "headset", description: "Headset gamer/atendimento com LEDs verdes ZAI", spriteRef: "sprite_r1_c1" },
  { id: "headset_callcenter", name: "Headset Call Center Leve", category: "headset", description: "Fone monoauricular com microfone articulado", spriteRef: "sprite_r3_c3" },
  { id: "earbud_minimal", name: "Fone Bluetooth Minimalista", category: "headset", description: "Auricular discreto sem haste visível" },
  { id: "cap_zai_black", name: "Boné ZAI Preto com Logo", category: "headwear", description: "Boné com aba curva e escudo ZAI bordado em verde", spriteRef: "sprite_r1_c4" },
  { id: "hardhat_zai_white", name: "Capacete de Engenharia ZAI", category: "headwear", description: "Capacete de segurança branco com logo da empresa", spriteRef: "sprite_r3_c8" },
  { id: "badge_zai_lanyard", name: "Crachá com Cordão ZAI", category: "badge", description: "Crachá identificador com cordão verde esmeralda", spriteRef: "sprite_r1_c5" },
  { id: "badge_clip_chest", name: "Crachá Magnético de Lapela", category: "badge", description: "Plaqueta de identificação metálica no peito", spriteRef: "sprite_r1_c8" },
  { id: "glasses_round_black", name: "Óculos Redondos Pretos", category: "glasses", description: "Armação de acetato preto estilo vintage", spriteRef: "sprite_r1_c2" },
  { id: "glasses_square_exec", name: "Óculos Quadrados Finos", category: "glasses", description: "Armação de titânio leve e refinada", spriteRef: "sprite_r1_c5" },
  { id: "sunglasses_wayfarer", name: "Óculos de Sol Wayfarer", category: "glasses", description: "Lentes escuras protegidas contra UV", spriteRef: "sprite_r1_c9" },
  { id: "backpack_tactical_black", name: "Mochila Tática ZAI", category: "accessories", description: "Mochila preta com alças ergonômicas acolchoadas", spriteRef: "sprite_r1_c4" },
  { id: "smartwatch_neon", name: "Smartwatch ZAI Sync", category: "accessories", description: "Relógio inteligente com tela OLED verde", spriteRef: "sprite_r1_c7" },
];

// 10+ Work Objects
export const WORK_OBJECTS: CatalogItem[] = [
  { id: "tablet_zai", name: "Tablet de Vendas ZAI", category: "workObject", description: "Tablet executivo com CRM e catálogo aberto", spriteRef: "sprite_r1_c2" },
  { id: "laptop_zai", name: "Notebook Portátil ZAI", category: "workObject", description: "Notebook aberto sobre o colo em operação de dados", spriteRef: "sprite_r3_c5" },
  { id: "clipboard_sales", name: "Prancheta de Pedidos", category: "workObject", description: "Prancheta com folhas de orçamento e caneta", spriteRef: "sprite_r3_c4" },
  { id: "boxes_delivery", name: "Caixas de Entrega ZAI", category: "workObject", description: "Duas caixas de papelão lacradas com fita ZAI", spriteRef: "sprite_r3_c1" },
  { id: "coffee_cup", name: "Copo Térmico ZAI Café", category: "workObject", description: "Copo térmico de café para longas jornadas de vendas", spriteRef: "sprite_r2_c5" },
  { id: "smartphone_chat", name: "Smartphone WhatsApp", category: "workObject", description: "Celular com o app de atendimento aberto na mão", spriteRef: "sprite_r3_c9" },
  { id: "thumbs_up", name: "Gesto Positivo (Joinha)", category: "workObject", description: "Mão fazendo sinal de aprovação e sucesso comercial", spriteRef: "sprite_r1_c7" },
  { id: "peace_sign", name: "Gesto Paz & Vitória", category: "workObject", description: "Mão com dois dedos em V celebrando conversão", spriteRef: "sprite_r2_c8" },
  { id: "folded_arms", name: "Braços Cruzados Confiante", category: "workObject", description: "Postura ereta de segurança e prontidão", spriteRef: "sprite_r3_c6" },
  { id: "hands_in_pockets", name: "Mãos nos Bolsos Relaxado", category: "workObject", description: "Postura natural e descontraída de atendimento", spriteRef: "sprite_r1_c1" },
];

// 10+ Postures
export const POSTURES: Array<{ id: PersonalityVisualConfig["posture"]; name: string; description: string }> = [
  { id: "energetic", name: "Energética & Vendedora", description: "Postura ativa pronta para fechar negócios com agilidade" },
  { id: "sales", name: "Comercial & Foco em Metas", description: "Orientada a soluções, apresentação de produtos e orçamentos" },
  { id: "welcoming", name: "Acolhedora & Receptiva", description: "Postura calorosa para recepção e primeiro contato com clientes" },
  { id: "analytical", name: "Analítica & Cuidadosa", description: "Foco nos detalhes, especificações técnicas e precisão" },
  { id: "executive", name: "Executiva & Alinhada", description: "Formalidade equilibrada para negociações corporativas" },
  { id: "tech", name: "Técnica & Especialista", description: "Orientada a suporte, dúvidas de montagem e especificações" },
  { id: "relaxed", name: "Descontraída & Confiante", description: "Comunicação fluida sem rigidez corporativa" },
  { id: "dynamic", name: "Dinâmica & Multifunção", description: "Capacidade de alternar entre vendas, logística e pós-venda" },
];

/* ==========================================================================
   OFFICIAL CHARACTER PRESETS
   ========================================================================== */

export const DEFAULT_AVATAR_PRESETS: Record<string, Partial<AgentAvatarConfig>> = {
  camila: {
    agentId: "camila",
    body: "female",
    skin: "peach",
    hair: "female_ponytail_brunette",
    hairColor: "auburn",
    eyes: "face_friendly_smile",
    glasses: "none",
    headset: "headset_zai_green",
    clothing: "polo_zai_black",
    pants: "cargo_black",
    shoes: "sneakers_zai_green",
    accessories: {
      headset: "headset_zai_green",
      badge: "badge_zai_lanyard",
    },
    workObject: "tablet_zai",
    badge: true,
    catalogSpriteId: "sprite_r2_c1",
    animationState: "WORKING",
    branding: {
      storeName: "ZAI CRM",
      primaryColor: "#10b981",
      secondaryColor: "#0f172a",
      accentColor: "#00f090",
      logo: "ZAI",
      showLogoOnChest: true,
      showLogoOnBadge: true,
    },
    personalityVisual: {
      posture: "sales",
      expression: "friendly_smile",
      preferredObject: "tablet_zai",
      animationStyle: "smooth",
    },
  },
  rafael: {
    agentId: "rafael",
    body: "male",
    skin: "tan",
    hair: "male_short_fade",
    hairColor: "black",
    eyes: "face_glasses_round",
    glasses: "glasses_round_black",
    headset: "headset_zai_green",
    clothing: "polo_zai_black",
    pants: "cargo_black",
    shoes: "sneakers_zai_green",
    accessories: {
      headset: "headset_zai_green",
      glasses: "glasses_round_black",
    },
    workObject: "tablet_zai",
    badge: true,
    catalogSpriteId: "sprite_r1_c2",
    animationState: "WORKING",
    branding: {
      storeName: "ZAI CRM",
      primaryColor: "#0ea5e9",
      secondaryColor: "#0f172a",
      accentColor: "#38bdf8",
      logo: "ZAI",
      showLogoOnChest: true,
      showLogoOnBadge: true,
    },
    personalityVisual: {
      posture: "tech",
      expression: "focused",
      preferredObject: "tablet_zai",
      animationStyle: "smooth",
    },
  },
  julia: {
    agentId: "julia",
    body: "female",
    skin: "fair",
    hair: "female_wavy_blonde",
    hairColor: "golden_blonde",
    eyes: "face_friendly_smile",
    glasses: "none",
    headset: "headset_zai_green",
    clothing: "hoodie_zai_black",
    pants: "cargo_black",
    shoes: "sneakers_zai_green",
    accessories: {
      headset: "headset_zai_green",
      badge: "badge_zai_lanyard",
    },
    workObject: "tablet_zai",
    badge: true,
    catalogSpriteId: "sprite_r2_c3",
    animationState: "WORKING",
    branding: {
      storeName: "ZAI CRM",
      primaryColor: "#8b5cf6",
      secondaryColor: "#0f172a",
      accentColor: "#a78bfa",
      logo: "ZAI",
      showLogoOnChest: true,
      showLogoOnBadge: true,
    },
    personalityVisual: {
      posture: "welcoming",
      expression: "friendly_smile",
      preferredObject: "tablet_zai",
      animationStyle: "smooth",
    },
  },
  joao: {
    agentId: "joao",
    body: "male",
    skin: "fair",
    hair: "male_professor_beard",
    hairColor: "dark_brown",
    eyes: "face_glasses_square",
    glasses: "glasses_square_exec",
    headset: "none",
    clothing: "shirt_business_white",
    pants: "social_black",
    shoes: "shoes_executive",
    accessories: {
      glasses: "glasses_square_exec",
      badge: "badge_clip_chest",
    },
    workObject: "clipboard_sales",
    badge: true,
    catalogSpriteId: "sprite_r1_c8",
    animationState: "IDLE",
    branding: {
      storeName: "ZAI CRM",
      primaryColor: "#10b981",
      secondaryColor: "#0f172a",
      accentColor: "#00f090",
      logo: "ZAI",
      showLogoOnChest: true,
      showLogoOnBadge: true,
    },
    personalityVisual: {
      posture: "analytical",
      expression: "confident",
      preferredObject: "clipboard_sales",
      animationStyle: "smooth",
    },
  },
  zaibot: {
    agentId: "zaibot",
    body: "robot",
    skin: "fair",
    hair: "none",
    hairColor: "emerald",
    eyes: "face_focused_analyst",
    glasses: "none",
    headset: "none",
    clothing: "uniform_tech_navy",
    pants: "cargo_black",
    shoes: "sneakers_zai_green",
    accessories: {},
    workObject: "laptop_zai",
    badge: false,
    catalogSpriteId: "sprite_r3_c5",
    animationState: "WORKING",
    branding: {
      storeName: "ZAI CRM",
      primaryColor: "#00f090",
      secondaryColor: "#05070a",
      accentColor: "#00ffcc",
      logo: "ZAI",
    },
    personalityVisual: {
      posture: "executive",
      expression: "focused",
      preferredObject: "laptop_zai",
      animationStyle: "snappy",
    },
  },
};
