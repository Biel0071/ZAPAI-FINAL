/**
 * ZAI CRM Enterprise — Modular Avatar Engine Definitions
 * Standardizes the modular, layer-based, editable avatar system.
 * Avatar = Body + Skin + Face + Hair + Eyes + Eyebrows + FacialHair + Glasses + Headset + Clothing + Shoes + Accessories + Badge + WorkObject + StoreBranding + AnimationState + PersonalityVisuals
 */

export type BodyType = "male" | "female" | "neutral" | "robot";

export type SkinTone =
  | "fair"       // Tom claro marfim
  | "peach"      // Tom pêssego quente
  | "tan"        // Tom bronzeado
  | "bronze"     // Tom bronze
  | "dark"       // Tom escuro
  | "deep_dark";  // Tom retinto

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
  rotationY?: number;
  movement3D?: "idle" | "walk" | "wave" | "pose" | "spin360";
  renderStyle?: "3d_enterprise" | "chibi_25d";
}

/**
 * Resolves a catalog item's sprite reference so it matches the character's selected gender (male = r1, female = r2),
 * while preserving operational row 3 sprites (sprite_r3_*).
 */
export function resolveItemSpriteForGender(
  item: { id?: string; spriteRef?: string; gender?: "male" | "female" | "all"; category?: string } | undefined | null,
  gender?: string
): string {
  const isMale = gender === "male";
  const itemId = item?.id || "";

  // Explicit item-to-sprite mapping for perfect gender & role fidelity
  const FEMALE_EXPLICIT_MAP: Record<string, string> = {
    // Face
    face_01: "sprite_r2_c1",
    face_02: "sprite_r2_c4",
    face_03: "sprite_r2_c8",
    face_04: "sprite_r2_c3",
    face_05: "sprite_r2_c2",
    face_06: "sprite_r2_c7",
    face_07: "sprite_r2_c2",
    face_08: "sprite_r2_c6",
    // Outfit
    outfit_01: "sprite_r2_c1",
    outfit_02: "sprite_r2_c2",
    outfit_03: "sprite_r2_c6",
    outfit_04: "sprite_r3_c3",
    outfit_05: "sprite_r2_c8",
    outfit_06: "sprite_r3_c2",
    outfit_07: "sprite_r2_c7",
    outfit_08: "sprite_r2_c10",
    outfit_09: "sprite_r3_c11",
    outfit_10: "sprite_r3_c1",
    // Accessories
    acc_01: "sprite_r2_c7",
    acc_02: "sprite_r2_c1",
    acc_03: "sprite_r2_c4",
    acc_04: "sprite_r2_c2",
    acc_05: "sprite_r2_c8",
    acc_06: "sprite_r2_c7",
    acc_07: "sprite_r2_c6",
    acc_08: "sprite_r2_c5",
    acc_09: "sprite_r3_c1",
    acc_10: "sprite_r3_c5",
    acc_11: "sprite_r2_c6",
    acc_12: "sprite_r3_c8",
    // Styles
    style_vendas: "sprite_r2_c8",
    style_corporativo: "sprite_r2_c8",
    style_atendimento: "sprite_r2_c1",
    style_operacional: "sprite_r3_c2",
    style_tech: "sprite_r2_c6",
    style_casual: "sprite_r2_c7",
    style_premium: "sprite_r2_c9",
    // Hair
    hair_01: "sprite_r2_c1",
    hair_02: "sprite_r2_c7",
    hair_03: "sprite_r2_c3",
    hair_04: "sprite_r2_c4",
    hair_05: "sprite_r2_c5",
    hair_06: "sprite_r2_c6",
    hair_07: "sprite_r2_c2",
    hair_08: "sprite_r2_c9",
    hair_09: "sprite_r2_c8",
    hair_10: "sprite_r2_c10",
    hair_11: "sprite_r2_c6",
    hair_12: "sprite_r2_c9",
    hair_13: "sprite_r3_c8",
    hair_14: "sprite_r2_c6",
    hair_15: "sprite_r2_c9",
    hair_16: "sprite_r2_c7",
    hair_17: "sprite_r2_c6",
    hair_18: "sprite_r2_c2",
  };

  const MALE_EXPLICIT_MAP: Record<string, string> = {
    // Face
    face_01: "sprite_r1_c1",
    face_02: "sprite_r1_c2",
    face_03: "sprite_r1_c3",
    face_04: "sprite_r1_c6",
    face_05: "sprite_r1_c7",
    face_06: "sprite_r1_c4",
    face_07: "sprite_r1_c8",
    face_08: "sprite_r1_c9",
    // Outfit
    outfit_01: "sprite_r1_c1",
    outfit_02: "sprite_r1_c8",
    outfit_03: "sprite_r1_c4",
    outfit_04: "sprite_r3_c3",
    outfit_05: "sprite_r1_c6",
    outfit_06: "sprite_r3_c2",
    outfit_07: "sprite_r1_c7",
    outfit_08: "sprite_r1_c11",
    outfit_09: "sprite_r3_c11",
    outfit_10: "sprite_r3_c1",
    // Accessories
    acc_01: "sprite_r1_c1",
    acc_02: "sprite_r1_c1",
    acc_03: "sprite_r1_c5",
    acc_04: "sprite_r1_c8",
    acc_05: "sprite_r1_c2",
    acc_06: "sprite_r1_c7",
    acc_07: "sprite_r1_c9",
    acc_08: "sprite_r1_c5",
    acc_09: "sprite_r3_c1",
    acc_10: "sprite_r3_c5",
    acc_11: "sprite_r1_c4",
    acc_12: "sprite_r3_c8",
    // Styles
    style_vendas: "sprite_r1_c6",
    style_corporativo: "sprite_r1_c8",
    style_atendimento: "sprite_r1_c1",
    style_operacional: "sprite_r3_c2",
    style_tech: "sprite_r1_c4",
    style_casual: "sprite_r1_c7",
    style_premium: "sprite_r1_c6",
    // Hair
    hair_01: "sprite_r1_c1",
    hair_02: "sprite_r1_c8",
    hair_03: "sprite_r1_c3",
    hair_04: "sprite_r1_c4",
    hair_05: "sprite_r1_c1",
    hair_06: "sprite_r1_c7",
    hair_07: "sprite_r1_c2",
    hair_08: "sprite_r1_c3",
    hair_09: "sprite_r1_c5",
    hair_10: "sprite_r1_c10",
    hair_11: "sprite_r1_c4",
    hair_12: "sprite_r1_c6",
    hair_13: "sprite_r3_c7",
    hair_14: "sprite_r1_c4",
    hair_15: "sprite_r1_c6",
    hair_16: "sprite_r1_c8",
    hair_17: "sprite_r1_c10",
    hair_18: "sprite_r1_c9",
  };

  if (!isMale && FEMALE_EXPLICIT_MAP[itemId]) {
    return FEMALE_EXPLICIT_MAP[itemId];
  }
  if (isMale && MALE_EXPLICIT_MAP[itemId]) {
    return MALE_EXPLICIT_MAP[itemId];
  }

  const rawSprite = item?.spriteRef || (isMale ? "sprite_r1_c1" : "sprite_r2_c1");
  if (isMale && rawSprite.startsWith("sprite_r2_")) {
    return rawSprite.replace(/^sprite_r2_/, "sprite_r1_");
  }
  if (!isMale && rawSprite.startsWith("sprite_r1_")) {
    return rawSprite.replace(/^sprite_r1_/, "sprite_r2_");
  }
  return rawSprite;
}

const HAIR_ID_TO_COLOR: Record<string, HairColor> = {
  hair_01: "auburn",
  hair_02: "black",
  hair_03: "golden_blonde",
  hair_04: "dark_brown",
  hair_05: "auburn",
  hair_06: "black",
  hair_07: "black",
  hair_08: "golden_blonde",
  hair_09: "dark_brown",
  hair_10: "cyber_blue",
  hair_11: "neon_pink",
  hair_12: "platinum",
  hair_13: "auburn",
  hair_14: "black",
  hair_15: "platinum",
  hair_16: "dark_brown",
  hair_17: "fiery_red",
  hair_18: "black",
  female_ponytail_brunette: "auburn",
  female_straight_glasses: "black",
  female_wavy_blonde: "golden_blonde",
  female_curly_updo: "dark_brown",
  female_long_wavy_coffee: "dark_brown",
  female_pink_cap: "neon_pink",
  female_short_business: "black",
  female_peace_brunette: "auburn",
  female_silver_waves: "platinum",
  female_blue_wavy: "cyber_blue",
  female_hardhat_brunette: "auburn",
  male_short_fade: "auburn",
  male_spiky: "golden_blonde",
  male_textured_crop: "black",
  male_cap_hair: "dark_brown",
  male_curly_brown: "dark_brown",
  male_anime_silver: "platinum",
  male_afro_curls: "black",
  male_professor_beard: "dark_brown",
  male_dark_shades: "black",
  male_red_hoodie: "fiery_red",
};

/**
 * Resolves the canonical hair color baked into a catalog hairstyle so 2D sprites and 3D puppets stay in sync.
 */
export function resolveHairColorForHair(
  hairId?: string,
  fallback?: HairColor,
  isFemale: boolean = true
): HairColor {
  if (hairId && HAIR_ID_TO_COLOR[hairId]) {
    return HAIR_ID_TO_COLOR[hairId];
  }
  return fallback || (isFemale ? "auburn" : "black");
}

const MALE_HAIR_DISPLAY_OVERRIDES: Record<string, { title: string; description: string }> = {
  hair_01: {
    title: "Executivo Clássico",
    description: "Corte masculino alinhado com acabamento lateral",
  },
  hair_02: {
    title: "Texturizado Urbano",
    description: "Corte médio estruturado com volume natural",
  },
  hair_03: {
    title: "Loiro Texturizado",
    description: "Mechas loiras curtas com corte dinâmico",
  },
  hair_04: {
    title: "Esportivo com Boné ZAI",
    description: "Visual tático masculino com boné oficial",
  },
  hair_07: {
    title: "Social com Franja Lateral",
    description: "Corte liso executivo com caimento frontal",
  },
  hair_10: {
    title: "Cyber Spiky Urbano",
    description: "Corte masculino moderno estilo tech",
  },
  hair_11: {
    title: "Boné Street Urbano",
    description: "Boné esportivo com visual casual dinâmico",
  },
  hair_14: {
    title: "Boné Tático Preto",
    description: "Visual tático com boné oficial ZAI",
  },
  hair_15: {
    title: "Repicado Anime Prateado",
    description: "Corte repicado estilo tech futurista",
  },
  hair_16: {
    title: "Médio Acadêmico com Barba",
    description: "Cabelo encorpado com caimento lateral",
  },
  hair_17: {
    title: "Espetado Urbano Fogo",
    description: "Mechas urbanas com atitude jovem",
  },
  hair_18: {
    title: "Ondulado Clássico",
    description: "Ondas clássicas com óculos executivos",
  },
};

/**
 * Returns gender-appropriate display title and description for catalog items (e.g., masculine hair cuts when male is selected).
 */
export function resolveItemDisplayForGender(
  item: { id?: string; title?: string; name?: string; description?: string } | undefined | null,
  gender?: string
): { title: string; description: string } {
  const defaultTitle = item?.title || item?.name || "";
  const defaultDescription = item?.description || "";
  if (gender === "male" && item?.id && MALE_HAIR_DISPLAY_OVERRIDES[item.id]) {
    return MALE_HAIR_DISPLAY_OVERRIDES[item.id];
  }
  return { title: defaultTitle, description: defaultDescription };
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
  { id: "hair_01", number: "01", name: "Rabo de Cavalo Executivo", title: "Rabo de Cavalo Executivo", category: "hair", gender: "female", spriteRef: "sprite_r2_c1", description: "Penteado executivo com elástico profissional" },
  { id: "hair_02", number: "02", name: "Chanel Alinhado", title: "Chanel Alinhado", category: "hair", gender: "female", spriteRef: "sprite_r2_c7", description: "Corte médio alinhado na altura dos ombros" },
  { id: "hair_03", number: "03", name: "Ondulado Longo Elegante", title: "Ondulado Longo Elegante", category: "hair", gender: "female", spriteRef: "sprite_r2_c3", description: "Ondas soltas volumosas e sofisticadas" },
  { id: "hair_04", number: "04", name: "Coque Alto Profissional", title: "Coque Alto Profissional", category: "hair", gender: "female", spriteRef: "sprite_r2_c4", description: "Coque clássico no topo da cabeça" },
  { id: "hair_05", number: "05", name: "Curto Fade Moderno", title: "Curto Fade Moderno", category: "hair", gender: "male", spriteRef: "sprite_r1_c1", description: "Degradê moderno e executivo" },
  { id: "hair_06", number: "06", name: "Black Power Texturizado", title: "Black Power Texturizado", category: "hair", gender: "all", spriteRef: "sprite_r1_c7", description: "Afro texturizado com contorno desenhado" },
  { id: "hair_07", number: "07", name: "Longo Liso com Franja", title: "Longo Liso com Franja", category: "hair", gender: "female", spriteRef: "sprite_r2_c2", description: "Liso impecável com franja geométrica" },
  { id: "hair_08", number: "08", name: "Street Spiky Texturizado", title: "Street Spiky Texturizado", category: "hair", gender: "male", spriteRef: "sprite_r1_c3", description: "Corte texturizado clássico espetado" },
  { id: "hair_09", number: "09", name: "Cachos Volumosos", title: "Cachos Volumosos", category: "hair", gender: "all", spriteRef: "sprite_r1_c5", description: "Cachos definidos com estilo despojado" },
  { id: "hair_10", number: "10", name: "Cyber Wave Longo", title: "Cyber Wave Longo", category: "hair", gender: "female", spriteRef: "sprite_r2_c10", description: "Mechas longas volumosas estilo cyberpunk" },
  { id: "hair_11", number: "11", name: "Boné ZAI com Mechas Pink", title: "Boné ZAI com Mechas Pink", category: "hair", gender: "female", spriteRef: "sprite_r2_c6", description: "Mechas longas sob boné esportivo ZAI" },
  { id: "hair_12", number: "12", name: "Platinado Glamour", title: "Platinado Glamour", category: "hair", gender: "female", spriteRef: "sprite_r2_c9", description: "Ondas platinadas longas e sofisticadas" },
  { id: "hair_13", number: "13", name: "Capacete Obra com Longo", title: "Capacete Obra com Longo", category: "hair", gender: "female", spriteRef: "sprite_r3_c8", description: "Cabelo protegido por capacete de obra ZAI" },
  { id: "hair_14", number: "14", name: "Boné Tático Preto", title: "Boné Tático Preto", category: "hair", gender: "male", spriteRef: "sprite_r1_c4", description: "Corte adaptado sob boné tático ZAI" },
  { id: "hair_15", number: "15", name: "Repicado Anime Prateado", title: "Repicado Anime Prateado", category: "hair", gender: "male", spriteRef: "sprite_r1_c6", description: "Corte repicado com mechas prateadas estilo anime" },
  { id: "hair_16", number: "16", name: "Médio Acadêmico com Barba", title: "Médio Acadêmico com Barba", category: "hair", gender: "male", spriteRef: "sprite_r1_c8", description: "Cabelo encorpado com caimento lateral e barba" },
  { id: "hair_17", number: "17", name: "Espetado Urbano Fogo", title: "Espetado Urbano Fogo", category: "hair", gender: "male", spriteRef: "sprite_r1_c10", description: "Mechas urbanas com atitude jovem e cor viva" },
  { id: "hair_18", number: "18", name: "Ondulado Clássico com Óculos", title: "Ondulado Clássico com Óculos", category: "hair", gender: "male", spriteRef: "sprite_r1_c9", description: "Ondas clássicas executivas penteadas para trás" },
];

// 2. ROSTO (Face) — 5ª Categoria oficial
export const AVATAR_FACES: AvatarStudioItem[] = [
  { id: "face_01", number: "01", name: "Cordial & Empático", title: "Cordial & Empático", category: "face", spriteRef: "sprite_r2_c1", description: "Expressão cordial, sorriso discreto e olhar atento" },
  { id: "face_02", number: "02", name: "Confiante & Seguro", title: "Confiante & Seguro", category: "face", spriteRef: "sprite_r1_c1", description: "Leve sorriso de lado com olhar determinado" },
  { id: "face_03", number: "03", name: "Carismático & Alegre", title: "Carismático & Alegre", category: "face", spriteRef: "sprite_r2_c8", description: "Sorriso aberto, olhar vibrante e empático" },
  { id: "face_04", number: "04", name: "Expressivo Comercial", title: "Expressivo Comercial", category: "face", spriteRef: "sprite_r2_c3", description: "Olhar consultivo e receptivo voltado a vendas" },
  { id: "face_05", number: "05", name: "Analítico & Sereno", title: "Analítico & Sereno", category: "face", spriteRef: "sprite_r2_c2", description: "Foco nos detalhes com expressão equilibrada" },
  { id: "face_06", number: "06", name: "Foco Operacional", title: "Foco Operacional", category: "face", spriteRef: "sprite_r3_c5", description: "Postura atenta e olhar concentrado em agilidade" },
  { id: "face_07", number: "07", name: "Intelectual & Barba", title: "Intelectual & Barba", category: "face", spriteRef: "sprite_r1_c8", description: "Expressão executiva com barba e óculos intelectuais" },
  { id: "face_08", number: "08", name: "Óculos Escuros Modernos", title: "Óculos Escuros Modernos", category: "face", spriteRef: "sprite_r1_c9", description: "Postura marcante com óculos de sol wayfarer" },
];

// 3. ROUPA (Outfit)
export const AVATAR_OUTFITS: AvatarStudioItem[] = [
  { id: "outfit_01", number: "01", name: "Polo ZAI Corporativa", title: "Polo ZAI Corporativa", category: "outfit", spriteRef: "sprite_r1_c1", description: "Polo clássica preta com gola e detalhe verde ZAI" },
  { id: "outfit_02", number: "02", name: "Camisa Social Branca", title: "Camisa Social Branca", category: "outfit", spriteRef: "sprite_r1_c8", description: "Camisa social de botão com crachá executivo" },
  { id: "outfit_03", number: "03", name: "Moletom Tech Zip", title: "Moletom Tech Zip", category: "outfit", spriteRef: "sprite_r1_c4", description: "Moletom preto premium com zíper verde neon" },
  { id: "outfit_04", number: "04", name: "Uniforme Técnico", title: "Uniforme Técnico", category: "outfit", spriteRef: "sprite_r3_c3", description: "Camisa azul-marinho com bolsos utilitários" },
  { id: "outfit_05", number: "05", name: "Blazer Alfaiataria Comercial", title: "Blazer Alfaiataria Comercial", category: "outfit", spriteRef: "sprite_r2_c8", description: "Blazer alfaiataria com lapela esmeralda e crachá" },
  { id: "outfit_06", number: "06", name: "Colete Refletivo Logística", title: "Colete Refletivo Logística", category: "outfit", spriteRef: "sprite_r3_c2", description: "Colete de segurança amarelo fluorescente de expedição" },
  { id: "outfit_07", number: "07", name: "Camiseta Básica ZAI", title: "Camiseta Básica ZAI", category: "outfit", spriteRef: "sprite_r1_c7", description: "Camiseta casual de algodão com escudo no peito" },
  { id: "outfit_08", number: "08", name: "Jaqueta Bomber ZAI", title: "Jaqueta Bomber ZAI", category: "outfit", spriteRef: "sprite_r1_c6", description: "Jaqueta esportiva preta com bordados verdes" },
  { id: "outfit_09", number: "09", name: "Polo Verde Esmeralda ZAI", title: "Polo Verde Esmeralda ZAI", category: "outfit", spriteRef: "sprite_r3_c11", description: "Polo oficial de operações e inteligência comercial" },
  { id: "outfit_10", number: "10", name: "Uniforme Expedição & Estoque", title: "Uniforme Expedição & Estoque", category: "outfit", spriteRef: "sprite_r3_c1", description: "Traje reforçado de logística, caixas e carregamento" },
];

// 4. ACESSÓRIOS (Accessories)
export const AVATAR_ACCESSORIES: AvatarStudioItem[] = [
  { id: "acc_01", number: "01", name: "Nenhum (Básico)", title: "Nenhum (Básico)", category: "accessories", spriteRef: "sprite_r2_c7", description: "Visual limpo sem acessórios adicionais" },
  { id: "acc_02", number: "02", name: "Headset Pro Wireless", title: "Headset Pro Wireless", category: "accessories", spriteRef: "sprite_r1_c1", description: "Headset de atendimento com LED verde integrado" },
  { id: "acc_03", number: "03", name: "Crachá Lanyard ZAI", title: "Crachá Lanyard ZAI", category: "accessories", spriteRef: "sprite_r1_c5", description: "Crachá oficial com cordão verde esmeralda" },
  { id: "acc_04", number: "04", name: "Óculos Executivos", title: "Óculos Executivos", category: "accessories", spriteRef: "sprite_r1_c2", description: "Armação fina de titânio moderna e discreta" },
  { id: "acc_05", number: "05", name: "Tablet de Vendas", title: "Tablet de Vendas", category: "accessories", spriteRef: "sprite_r1_c2", description: "Tablet executivo com CRM e catálogo aberto" },
  { id: "acc_06", number: "06", name: "Smartwatch ZAI Sync", title: "Smartwatch ZAI Sync", category: "accessories", spriteRef: "sprite_r1_c7", description: "Relógio inteligente com tela neon de notificações" },
  { id: "acc_07", number: "07", name: "Óculos de Sol Wayfarer", title: "Óculos de Sol Wayfarer", category: "accessories", spriteRef: "sprite_r1_c9", description: "Lentes escuras modernas e proteção visual" },
  { id: "acc_08", number: "08", name: "Copo Térmico ZAI Café", title: "Copo Térmico ZAI Café", category: "accessories", spriteRef: "sprite_r2_c5", description: "Copo térmico de café para longas jornadas de atendimento" },
  { id: "acc_09", number: "09", name: "Caixas de Entrega ZAI", title: "Caixas de Entrega ZAI", category: "accessories", spriteRef: "sprite_r3_c1", description: "Volumes e caixas de entrega na expedição" },
  { id: "acc_10", number: "10", name: "Notebook Portátil ZAI", title: "Notebook Portátil ZAI", category: "accessories", spriteRef: "sprite_r3_c5", description: "Notebook sobre o colo em operação de dados" },
  { id: "acc_11", number: "11", name: "Mochila Tática ZAI", title: "Mochila Tática ZAI", category: "accessories", spriteRef: "sprite_r1_c4", description: "Mochila executiva preta com alças ergonômicas" },
  { id: "acc_12", number: "12", name: "Capacete de Engenharia ZAI", title: "Capacete de Engenharia ZAI", category: "accessories", spriteRef: "sprite_r3_c8", description: "Capacete de segurança branco com logo da empresa" },
];

// 5. ESTILO (Styles — Presets completos de identidade)
export const AVATAR_STYLES: AvatarStudioItem[] = [
  {
    id: "style_vendas",
    number: "01",
    name: "Vendas",
    title: "Estilo Vendas",
    category: "style",
    spriteRef: "sprite_r2_c8",
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
    spriteRef: "sprite_r1_c8",
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
    spriteRef: "sprite_r2_c1",
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
    spriteRef: "sprite_r3_c2",
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
    spriteRef: "sprite_r1_c4",
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
    spriteRef: "sprite_r1_c7",
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
    spriteRef: "sprite_r2_c9",
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
  { id: "earbud_minimal", name: "Fone Bluetooth Minimalista", category: "headset", description: "Auricular discreto sem haste visível", spriteRef: "sprite_r2_c7" },
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
