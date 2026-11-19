/**
 * ZAI CRM Enterprise — Modular 3D Avatar Slot Catalog & Composition Normalization
 * Strict independent slot contracts: changing one slot NEVER clobbers another slot.
 */

import type {
  AgentAvatarConfig,
  BodyType,
  HairColor,
  PersonalityVisualConfig,
  SkinTone,
} from "../AvatarDefinition";

export type AvatarSlotType =
  | "hair_slot"
  | "face_slot"
  | "upper_body_slot"
  | "lower_body_slot"
  | "footwear_slot"
  | "accessory_slot"
  | "uniform_slot"
  | "style_slot";

export type AccessorySubSlot =
  | "eyewear"
  | "headwear"
  | "headset"
  | "badge"
  | "wrist"
  | "prop"
  | "back";

export type FacialHairStyle =
  | "none"
  | "stubble"
  | "short_beard"
  | "full_beard"
  | "goatee";

export type PoseId =
  | "pose_executive"
  | "pose_consultative"
  | "pose_peace"
  | "pose_hero";

export type SlotCategory =
  | "hair"
  | "face"
  | "upper_body"
  | "lower_body"
  | "footwear"
  | "accessories"
  | "uniform"
  | "style";

export interface SlotCatalogItem {
  id: string;
  name: string;
  category: SlotCategory;
  slot: AvatarSlotType;
  subSlot?: AccessorySubSlot;
  assetBuilderId: string;
  materialPreset: string;
  compatibility: {
    genders: Array<"male" | "female" | "neutral" | "robot">;
    hidesTopHair?: boolean;
    twoHandedProp?: boolean;
    handSlot?: "left" | "right" | "both" | "none";
  };
  mountPoint: string;
  compatibleAnimations: string[];
  thumbnailSpec: {
    focus: "hair" | "face" | "outfit" | "lower" | "footwear" | "accessory-head" | "accessory-body" | "full";
    accentColor: string;
    silhouette: string;
  };
  available: boolean;
  version: string;
  description?: string;
  gender?: "male" | "female" | "all";
  legacyAliases?: string[];
  spriteRef?: string;
  palette?: {
    primary: string;
    secondary?: string;
    accent?: string;
    inner?: string;
    posture?: PersonalityVisualConfig["posture"];
  };
}

const ALL_ANIMS = [
  "idle",
  "walk",
  "wave",
  "pose",
  "thinking",
  "typing",
  "attending",
  "celebrating",
  "error",
  "disconnected",
];

const NO_TWO_HAND_WAVE_ANIMS = ALL_ANIMS.filter((a) => a !== "wave");

const ALL_GENDERS: Array<"male" | "female" | "neutral" | "robot"> = ["male", "female", "neutral", "robot"];
const HUMAN_GENDERS: Array<"male" | "female" | "neutral"> = ["male", "female", "neutral"];

export const CATALOG_VERSION = "2.0.0";

/* ==========================================================================
   1. HAIR SLOT (hair_01..hair_18) — Clean geometry, NEVER forces color/hat/glasses/beard
   ========================================================================== */
export const SLOT_HAIR_ITEMS: SlotCatalogItem[] = [
  {
    id: "hair_01",
    name: "Rabo de Cavalo Executivo",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "ponytail",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "ponytail" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Penteado executivo alinhado com amarração posterior",
    spriteRef: "sprite_r2_c1",
    legacyAliases: ["female_ponytail_brunette", "female_peace_brunette", "female_pink_cap", "female_hardhat_brunette"],
  },
  {
    id: "hair_02",
    name: "Chanel Alinhado",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "bob",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "bob" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Corte chanel estruturado na altura do maxilar",
    spriteRef: "sprite_r2_c7",
    legacyAliases: ["female_short_business"],
  },
  {
    id: "hair_03",
    name: "Ondulado Longo Elegante",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "long",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "long" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Ondas longas volumosas com caimento natural",
    spriteRef: "sprite_r2_c3",
    legacyAliases: ["female_wavy_blonde", "female_long_wavy_coffee", "female_silver_waves"],
  },
  {
    id: "hair_04",
    name: "Coque Alto Profissional",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "bun",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "bun" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Coque clássico alto no topo da cabeça",
    spriteRef: "sprite_r2_c4",
    legacyAliases: ["female_curly_updo"],
  },
  {
    id: "hair_05",
    name: "Curto Fade Moderno",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "short",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "short" },
    available: true,
    version: CATALOG_VERSION,
    gender: "male",
    description: "Degradê moderno executivo com franja curta",
    spriteRef: "sprite_r1_c1",
    legacyAliases: ["male_short_fade", "male_textured_crop", "male_cap_hair"],
  },
  {
    id: "hair_06",
    name: "Black Power Texturizado",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "afro",
    materialPreset: "hair_coarse_curl",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "afro" },
    available: true,
    version: CATALOG_VERSION,
    gender: "all",
    description: "Afro volumoso texturizado com contorno esculpido",
    spriteRef: "sprite_r1_c7",
    legacyAliases: ["male_afro_curls"],
  },
  {
    id: "hair_07",
    name: "Longo Liso com Franja",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "long_bangs",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "long_bangs" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Corte longo liso com franja frontal simétrica",
    spriteRef: "sprite_r2_c2",
    legacyAliases: ["female_straight_glasses"],
  },
  {
    id: "hair_08",
    name: "Street Spiky Texturizado",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "spiky",
    materialPreset: "hair_styled_wax",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "spiky" },
    available: true,
    version: CATALOG_VERSION,
    gender: "male",
    description: "Mechas curtas espetadas com volume no topo",
    spriteRef: "sprite_r1_c3",
    legacyAliases: ["male_spiky"],
  },
  {
    id: "hair_09",
    name: "Cachos Volumosos",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "curly",
    materialPreset: "hair_coarse_curl",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "curly" },
    available: true,
    version: CATALOG_VERSION,
    gender: "all",
    description: "Cachos definidos com textura natural",
    spriteRef: "sprite_r1_c5",
    legacyAliases: ["male_curly_brown"],
  },
  {
    id: "hair_10",
    name: "Cyber Wave Longo",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "cyber_wave",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#06b6d4", silhouette: "cyber_wave" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Mechas longas assimétricas estilo moderno",
    spriteRef: "sprite_r2_c10",
    legacyAliases: ["female_blue_wavy"],
  },
  {
    id: "hair_11",
    name: "Repicado Longo Moderno",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "layered_long",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#ec4899", silhouette: "layered_long" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Camadas longas repicadas emoldurando o rosto",
    spriteRef: "sprite_r2_c6",
  },
  {
    id: "hair_12",
    name: "Glamour Ondulado Longo",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "glamour_waves",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#e2e8f0", silhouette: "glamour_waves" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Ondas amplas laterais com divisão lateral",
    spriteRef: "sprite_r2_c9",
  },
  {
    id: "hair_13",
    name: "Longo Lateral Preso",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "long_tucked",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "long_tucked" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Fios longos presos atrás das orelhas",
    spriteRef: "sprite_r3_c8",
  },
  {
    id: "hair_14",
    name: "Crop Tático Curto",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "tactical_crop",
    materialPreset: "hair_styled_wax",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "tactical_crop" },
    available: true,
    version: CATALOG_VERSION,
    gender: "male",
    description: "Corte curto texturizado rente às laterais",
    spriteRef: "sprite_r1_c4",
  },
  {
    id: "hair_15",
    name: "Repicado Tech Estruturado",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "anime_spiky",
    materialPreset: "hair_styled_wax",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#94a3b8", silhouette: "anime_spiky" },
    available: true,
    version: CATALOG_VERSION,
    gender: "male",
    description: "Mechas frontais direcionadas estilo tech",
    spriteRef: "sprite_r1_c6",
    legacyAliases: ["male_anime_silver"],
  },
  {
    id: "hair_16",
    name: "Médio Acadêmico Lateral",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "medium_side",
    materialPreset: "hair_silk_matte",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "medium_side" },
    available: true,
    version: CATALOG_VERSION,
    gender: "male",
    description: "Cabelo médio encorpado com caimento lateral",
    spriteRef: "sprite_r1_c8",
    legacyAliases: ["male_professor_beard"],
  },
  {
    id: "hair_17",
    name: "Espetado Urbano Dinâmico",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "urban_flame",
    materialPreset: "hair_styled_wax",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#ef4444", silhouette: "urban_flame" },
    available: true,
    version: CATALOG_VERSION,
    gender: "male",
    description: "Topete estilizado com textura dinâmica",
    spriteRef: "sprite_r1_c10",
    legacyAliases: ["male_red_hoodie"],
  },
  {
    id: "hair_18",
    name: "Ondulado Clássico Penteado",
    category: "hair",
    slot: "hair_slot",
    assetBuilderId: "slick_back",
    materialPreset: "hair_styled_wax",
    compatibility: { genders: HUMAN_GENDERS },
    mountPoint: "head.hair_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "hair", accentColor: "#10b981", silhouette: "slick_back" },
    available: true,
    version: CATALOG_VERSION,
    gender: "male",
    description: "Ondas clássicas penteadas para trás",
    spriteRef: "sprite_r1_c9",
    legacyAliases: ["male_dark_shades", "male_slick_exec"],
  },
];

/* ==========================================================================
   2. FACE SLOT (face_01..face_08) — ONLY 3D eyes/brows/mouth/expression
   ========================================================================== */
export const SLOT_FACE_ITEMS: SlotCatalogItem[] = [
  {
    id: "face_01",
    name: "Cordial & Empático",
    category: "face",
    slot: "face_slot",
    assetBuilderId: "smile",
    materialPreset: "face_natural",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.face_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "face", accentColor: "#10b981", silhouette: "smile" },
    available: true,
    version: CATALOG_VERSION,
    description: "Sorriso cordial com olhar atento e acolhedor",
    spriteRef: "sprite_r2_c1",
    legacyAliases: ["face_friendly_smile", "face_calm_support"],
  },
  {
    id: "face_02",
    name: "Confiante & Seguro",
    category: "face",
    slot: "face_slot",
    assetBuilderId: "confident",
    materialPreset: "face_natural",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.face_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "face", accentColor: "#38bdf8", silhouette: "confident" },
    available: true,
    version: CATALOG_VERSION,
    description: "Meio sorriso seguro com sobrancelha levemente erguida",
    spriteRef: "sprite_r1_c1",
    legacyAliases: ["face_confident_smirk"],
  },
  {
    id: "face_03",
    name: "Carismático & Alegre",
    category: "face",
    slot: "face_slot",
    assetBuilderId: "wink",
    materialPreset: "face_natural",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.face_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "face", accentColor: "#10b981", silhouette: "wink" },
    available: true,
    version: CATALOG_VERSION,
    description: "Piscadela amigável com sorriso vibrante",
    spriteRef: "sprite_r2_c8",
    legacyAliases: ["face_wink_cheerful"],
  },
  {
    id: "face_04",
    name: "Expressivo Comercial",
    category: "face",
    slot: "face_slot",
    assetBuilderId: "open_smile",
    materialPreset: "face_natural",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.face_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "face", accentColor: "#10b981", silhouette: "open_smile" },
    available: true,
    version: CATALOG_VERSION,
    description: "Sorriso aberto receptivo para atendimento e vendas",
    spriteRef: "sprite_r2_c3",
  },
  {
    id: "face_05",
    name: "Analítico & Sereno",
    category: "face",
    slot: "face_slot",
    assetBuilderId: "calm",
    materialPreset: "face_natural",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.face_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "face", accentColor: "#64748b", silhouette: "calm" },
    available: true,
    version: CATALOG_VERSION,
    description: "Expressão equilibrada e olhar analítico",
    spriteRef: "sprite_r2_c2",
    legacyAliases: ["face_focused_analyst", "face_stubble_clean", "face_beard_mustache"],
  },
  {
    id: "face_06",
    name: "Foco Operacional",
    category: "face",
    slot: "face_slot",
    assetBuilderId: "focused",
    materialPreset: "face_natural",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.face_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "face", accentColor: "#f59e0b", silhouette: "focused" },
    available: true,
    version: CATALOG_VERSION,
    description: "Olhar concentrado e sobrancelhas firmes",
    spriteRef: "sprite_r3_c5",
  },
  {
    id: "face_07",
    name: "Executivo Refinado",
    category: "face",
    slot: "face_slot",
    assetBuilderId: "executive",
    materialPreset: "face_natural",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.face_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "face", accentColor: "#0ea5e9", silhouette: "executive" },
    available: true,
    version: CATALOG_VERSION,
    description: "Traços executivos serenos e postura diplomática",
    spriteRef: "sprite_r1_c8",
    legacyAliases: ["face_glasses_round", "face_glasses_square"],
  },
  {
    id: "face_08",
    name: "Marcante & Moderno",
    category: "face",
    slot: "face_slot",
    assetBuilderId: "charismatic",
    materialPreset: "face_natural",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.face_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "face", accentColor: "#8b5cf6", silhouette: "charismatic" },
    available: true,
    version: CATALOG_VERSION,
    description: "Sorriso confiante com olhar determinado",
    spriteRef: "sprite_r1_c9",
    legacyAliases: ["face_dark_sunglasses"],
  },
];

/* ==========================================================================
   3. UPPER BODY SLOT (upper_polo..upper_uniform_jacket + outfit_01..10)
   ========================================================================== */
export const SLOT_UPPER_BODY_ITEMS: SlotCatalogItem[] = [
  {
    id: "upper_polo",
    name: "Polo ZAI Corporativa",
    category: "upper_body",
    slot: "upper_body_slot",
    assetBuilderId: "polo",
    materialPreset: "fabric_pique_matte",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.upper_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "outfit", accentColor: "#10b981", silhouette: "polo" },
    available: true,
    version: CATALOG_VERSION,
    description: "Camisa polo corporativa com gola estruturada e vista frontal",
    spriteRef: "sprite_r1_c1",
    legacyAliases: ["outfit_01", "outfit_09", "polo_zai_black", "polo_zai_white"],
    palette: { primary: "#1d2432", accent: "#10b981" },
  },
  {
    id: "upper_shirt",
    name: "Camisa Social Executiva",
    category: "upper_body",
    slot: "upper_body_slot",
    assetBuilderId: "shirt",
    materialPreset: "fabric_poplin",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.upper_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "outfit", accentColor: "#0ea5e9", silhouette: "shirt" },
    available: true,
    version: CATALOG_VERSION,
    description: "Camisa social de manga longa com colarinho e gravata",
    spriteRef: "sprite_r1_c8",
    legacyAliases: ["outfit_02", "shirt_formal_blue", "shirt_business_white"],
    palette: { primary: "#f8fafc", accent: "#1e293b" },
  },
  {
    id: "upper_hoodie",
    name: "Moletom Tech Zip",
    category: "upper_body",
    slot: "upper_body_slot",
    assetBuilderId: "hoodie",
    materialPreset: "fabric_fleece",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.upper_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "outfit", accentColor: "#10b981", silhouette: "hoodie" },
    available: true,
    version: CATALOG_VERSION,
    description: "Moletom tech com capuz, zíper contrastante e bolso canguru",
    spriteRef: "sprite_r1_c4",
    legacyAliases: ["outfit_03", "hoodie_zai_black", "tshirt_casual_dark"],
    palette: { primary: "#18202c", accent: "#10b981" },
  },
  {
    id: "upper_blazer",
    name: "Blazer Executivo ZAI",
    category: "upper_body",
    slot: "upper_body_slot",
    assetBuilderId: "jacket",
    materialPreset: "fabric_wool_tailored",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.upper_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "outfit", accentColor: "#10b981", silhouette: "blazer" },
    available: true,
    version: CATALOG_VERSION,
    description: "Blazer estruturado com lapela e camisa interna",
    spriteRef: "sprite_r2_c8",
    legacyAliases: ["outfit_05", "blazer_executive_dark", "blazer_emerald_trim"],
    palette: { primary: "#161b26", accent: "#10b981", inner: "#1e293b" },
  },
  {
    id: "upper_tee",
    name: "Camiseta Básica ZAI",
    category: "upper_body",
    slot: "upper_body_slot",
    assetBuilderId: "tee",
    materialPreset: "fabric_cotton_soft",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.upper_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "outfit", accentColor: "#10b981", silhouette: "tee" },
    available: true,
    version: CATALOG_VERSION,
    description: "Camiseta casual confortável de gola careca",
    spriteRef: "sprite_r1_c7",
    legacyAliases: ["outfit_07", "casual_tee_charcoal"],
    palette: { primary: "#1b2230", accent: "#10b981" },
  },
  {
    id: "upper_bomber",
    name: "Jaqueta Bomber ZAI",
    category: "upper_body",
    slot: "upper_body_slot",
    assetBuilderId: "bomber",
    materialPreset: "fabric_nylon_satin",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.upper_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "outfit", accentColor: "#10b981", silhouette: "bomber" },
    available: true,
    version: CATALOG_VERSION,
    description: "Jaqueta bomber com punhos canelados e zíper metálico",
    spriteRef: "sprite_r1_c6",
    legacyAliases: ["outfit_08", "jacket_exec_dark", "bomber_jacket_tech"],
    palette: { primary: "#131b2c", accent: "#10b981" },
  },
  {
    id: "upper_vest",
    name: "Colete Refletivo Logística",
    category: "upper_body",
    slot: "upper_body_slot",
    assetBuilderId: "vest",
    materialPreset: "fabric_hivis",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.upper_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "outfit", accentColor: "#facc15", silhouette: "vest" },
    available: true,
    version: CATALOG_VERSION,
    description: "Colete de alta visibilidade com faixas refletivas",
    spriteRef: "sprite_r3_c2",
    legacyAliases: ["outfit_06", "vest_hivis_safety", "vest_operations"],
    palette: { primary: "#facc15", accent: "#e2e8f0", inner: "#1f2937" },
  },
  {
    id: "upper_uniform_jacket",
    name: "Uniforme Técnico Operacional",
    category: "upper_body",
    slot: "upper_body_slot",
    assetBuilderId: "uniform",
    materialPreset: "fabric_twill",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.upper_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "outfit", accentColor: "#38bdf8", silhouette: "uniform" },
    available: true,
    version: CATALOG_VERSION,
    description: "Gandola técnica com bolsos utilitários no peito",
    spriteRef: "sprite_r3_c3",
    legacyAliases: ["outfit_04", "outfit_10", "uniform_tech_navy", "delivery_cargo_set"],
    palette: { primary: "#1e3a5f", accent: "#94a3b8" },
  },
];

/* ==========================================================================
   4. LOWER BODY SLOT (lower_chinos..lower_jogger)
   ========================================================================== */
export const SLOT_LOWER_BODY_ITEMS: SlotCatalogItem[] = [
  {
    id: "lower_chinos",
    name: "Calça Chino Corporativa",
    category: "lower_body",
    slot: "lower_body_slot",
    assetBuilderId: "chinos",
    materialPreset: "fabric_twill",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "pelvis.lower_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "lower", accentColor: "#334155", silhouette: "chinos" },
    available: true,
    version: CATALOG_VERSION,
    description: "Corte reto versátil para uso corporativo diário",
    palette: { primary: "#1e293b", accent: "#0f172a" },
  },
  {
    id: "lower_slacks",
    name: "Calça Social Alfaiataria",
    category: "lower_body",
    slot: "lower_body_slot",
    assetBuilderId: "slacks",
    materialPreset: "fabric_wool_tailored",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "pelvis.lower_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "lower", accentColor: "#0f172a", silhouette: "slacks" },
    available: true,
    version: CATALOG_VERSION,
    description: "Calça social alinhada com vinco executivo",
    legacyAliases: ["social_black"],
    palette: { primary: "#111827", accent: "#334155" },
  },
  {
    id: "lower_cargo",
    name: "Calça Cargo Operacional",
    category: "lower_body",
    slot: "lower_body_slot",
    assetBuilderId: "cargo",
    materialPreset: "fabric_twill",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "pelvis.lower_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "lower", accentColor: "#475569", silhouette: "cargo" },
    available: true,
    version: CATALOG_VERSION,
    description: "Calça reforçada com bolsos laterais funcionais",
    legacyAliases: ["cargo_black"],
    palette: { primary: "#1a2230", accent: "#0f172a" },
  },
  {
    id: "lower_skirt_exec",
    name: "Saia Executiva Lápis",
    category: "lower_body",
    slot: "lower_body_slot",
    assetBuilderId: "skirt_exec",
    materialPreset: "fabric_wool_tailored",
    compatibility: { genders: ["female", "neutral"] },
    mountPoint: "pelvis.lower_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "lower", accentColor: "#1e293b", silhouette: "skirt_exec" },
    available: true,
    version: CATALOG_VERSION,
    gender: "female",
    description: "Saia lápis executiva acima do joelho",
    palette: { primary: "#18181b", accent: "#10b981" },
  },
  {
    id: "lower_jogger",
    name: "Calça Jogger Tech",
    category: "lower_body",
    slot: "lower_body_slot",
    assetBuilderId: "jogger",
    materialPreset: "fabric_fleece",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "pelvis.lower_body_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "lower", accentColor: "#10b981", silhouette: "jogger" },
    available: true,
    version: CATALOG_VERSION,
    description: "Calça esportiva com punho ajustado no tornozelo",
    palette: { primary: "#161e2e", accent: "#10b981" },
  },
];

/* ==========================================================================
   5. FOOTWEAR SLOT (shoe_sneaker..shoe_minimal)
   ========================================================================== */
export const SLOT_FOOTWEAR_ITEMS: SlotCatalogItem[] = [
  {
    id: "shoe_sneaker",
    name: "Tênis Urbano ZAI",
    category: "footwear",
    slot: "footwear_slot",
    assetBuilderId: "sneaker",
    materialPreset: "footwear_sport",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "foot.footwear_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "footwear", accentColor: "#10b981", silhouette: "sneaker" },
    available: true,
    version: CATALOG_VERSION,
    description: "Tênis confortável com solado branco e detalhe da marca",
    legacyAliases: ["sneakers_zai_green"],
    palette: { primary: "#1e293b", secondary: "#f8fafc", accent: "#10b981" },
  },
  {
    id: "shoe_oxford",
    name: "Sapato Social Oxford",
    category: "footwear",
    slot: "footwear_slot",
    assetBuilderId: "oxford",
    materialPreset: "footwear_leather",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "foot.footwear_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "footwear", accentColor: "#334155", silhouette: "oxford" },
    available: true,
    version: CATALOG_VERSION,
    description: "Sapato social clássico em couro escuro acetinado",
    legacyAliases: ["shoes_executive"],
    palette: { primary: "#18181b", secondary: "#09090b", accent: "#52525b" },
  },
  {
    id: "shoe_boot",
    name: "Bota Tática Operacional",
    category: "footwear",
    slot: "footwear_slot",
    assetBuilderId: "boot",
    materialPreset: "footwear_rugged",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "foot.footwear_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "footwear", accentColor: "#78350f", silhouette: "boot" },
    available: true,
    version: CATALOG_VERSION,
    description: "Bota de cano médio com solado tratorado",
    palette: { primary: "#292524", secondary: "#0c0a09", accent: "#78350f" },
  },
  {
    id: "shoe_safety",
    name: "Botina de Segurança EPI",
    category: "footwear",
    slot: "footwear_slot",
    assetBuilderId: "safety",
    materialPreset: "footwear_rugged",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "foot.footwear_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "footwear", accentColor: "#f59e0b", silhouette: "safety" },
    available: true,
    version: CATALOG_VERSION,
    description: "Botina reforçada com biqueira protetora para logística",
    palette: { primary: "#1c1917", secondary: "#09090b", accent: "#f59e0b" },
  },
  {
    id: "shoe_minimal",
    name: "Slip-on Minimalista",
    category: "footwear",
    slot: "footwear_slot",
    assetBuilderId: "minimal",
    materialPreset: "footwear_sport",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "foot.footwear_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "footwear", accentColor: "#94a3b8", silhouette: "minimal" },
    available: true,
    version: CATALOG_VERSION,
    description: "Calçado casual leve sem cadarços",
    palette: { primary: "#334155", secondary: "#e2e8f0", accent: "#cbd5e1" },
  },
];

/* ==========================================================================
   6. ACCESSORY SLOT — 7 Independent Sub-Slots
   ========================================================================== */
export const SLOT_ACCESSORY_ITEMS: SlotCatalogItem[] = [
  // Eyewear
  {
    id: "eyewear_executive",
    name: "Óculos Executivos",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "eyewear",
    assetBuilderId: "eyewear_executive",
    materialPreset: "metal_titanium",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.accessory_slot.eyewear",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-head", accentColor: "#38bdf8", silhouette: "eyewear_executive" },
    available: true,
    version: CATALOG_VERSION,
    description: "Armação executiva fina com lentes transparentes",
    spriteRef: "sprite_r1_c2",
    legacyAliases: ["glasses_square_exec", "glasses_round_black", "acc_04"],
  },
  {
    id: "eyewear_wayfarer",
    name: "Óculos de Sol Wayfarer",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "eyewear",
    assetBuilderId: "eyewear_wayfarer",
    materialPreset: "acetate_dark",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.accessory_slot.eyewear",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-head", accentColor: "#0f172a", silhouette: "eyewear_wayfarer" },
    available: true,
    version: CATALOG_VERSION,
    description: "Armação moderna com lentes solares fumê",
    spriteRef: "sprite_r1_c9",
    legacyAliases: ["sunglasses_wayfarer", "acc_07"],
  },
  // Headwear
  {
    id: "headwear_cap",
    name: "Boné ZAI Oficial",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "headwear",
    assetBuilderId: "headwear_cap",
    materialPreset: "fabric_twill",
    compatibility: { genders: ALL_GENDERS, hidesTopHair: true },
    mountPoint: "head.accessory_slot.headwear",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-head", accentColor: "#10b981", silhouette: "headwear_cap" },
    available: true,
    version: CATALOG_VERSION,
    description: "Boné esportivo com aba curva e emblema da loja",
    spriteRef: "sprite_r1_c4",
    legacyAliases: ["cap_zai_black"],
  },
  {
    id: "headwear_hardhat",
    name: "Capacete de Engenharia ZAI",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "headwear",
    assetBuilderId: "headwear_hardhat",
    materialPreset: "abs_gloss",
    compatibility: { genders: ALL_GENDERS, hidesTopHair: true },
    mountPoint: "head.accessory_slot.headwear",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-head", accentColor: "#f8fafc", silhouette: "headwear_hardhat" },
    available: true,
    version: CATALOG_VERSION,
    description: "Capacete de segurança branco com crista na cor da loja",
    spriteRef: "sprite_r3_c8",
    legacyAliases: ["hardhat_zai_white", "acc_12"],
  },
  // Headset
  {
    id: "headset_pro",
    name: "Headset Pro Wireless",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "headset",
    assetBuilderId: "headset_pro",
    materialPreset: "polymer_matte",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.accessory_slot.headset",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-head", accentColor: "#10b981", silhouette: "headset_pro" },
    available: true,
    version: CATALOG_VERSION,
    description: "Headset over-ear com haste articulada e anel LED",
    spriteRef: "sprite_r1_c1",
    legacyAliases: ["headset_zai_green", "headset_callcenter", "acc_02"],
  },
  {
    id: "headset_earbud",
    name: "Fone Bluetooth Minimalista",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "headset",
    assetBuilderId: "headset_earbud",
    materialPreset: "polymer_matte",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "head.accessory_slot.headset",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-head", accentColor: "#38bdf8", silhouette: "headset_earbud" },
    available: true,
    version: CATALOG_VERSION,
    description: "Auricular discreto intra-auricular sem arco superior",
    spriteRef: "sprite_r2_c7",
    legacyAliases: ["earbud_minimal"],
  },
  // Badge
  {
    id: "badge_lanyard",
    name: "Crachá Lanyard ZAI",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "badge",
    assetBuilderId: "badge_lanyard",
    materialPreset: "fabric_lanyard",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.accessory_slot.badge",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#10b981", silhouette: "badge_lanyard" },
    available: true,
    version: CATALOG_VERSION,
    description: "Crachá oficial com cordão no pescoço na cor da loja",
    spriteRef: "sprite_r1_c5",
    legacyAliases: ["badge_zai_lanyard", "acc_03"],
  },
  {
    id: "badge_clip",
    name: "Crachá Magnético de Lapela",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "badge",
    assetBuilderId: "badge_clip",
    materialPreset: "metal_brushed",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.accessory_slot.badge",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#94a3b8", silhouette: "badge_clip" },
    available: true,
    version: CATALOG_VERSION,
    description: "Plaqueta executiva fixada no peito",
    spriteRef: "sprite_r1_c8",
    legacyAliases: ["badge_clip_chest"],
  },
  // Wrist
  {
    id: "wrist_smartwatch",
    name: "Smartwatch ZAI Sync",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "wrist",
    assetBuilderId: "wrist_smartwatch",
    materialPreset: "polymer_matte",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "leftForearm.accessory_slot.wrist",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#10b981", silhouette: "wrist_smartwatch" },
    available: true,
    version: CATALOG_VERSION,
    description: "Relógio inteligente no pulso esquerdo com visor LED",
    spriteRef: "sprite_r1_c7",
    legacyAliases: ["watch_zai_smart", "smartwatch_neon", "acc_06"],
  },
  // Props
  {
    id: "prop_tablet",
    name: "Tablet de Vendas ZAI",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "prop",
    assetBuilderId: "prop_tablet",
    materialPreset: "metal_glass",
    compatibility: { genders: ALL_GENDERS, handSlot: "left" },
    mountPoint: "leftHand.accessory_slot.prop",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#10b981", silhouette: "prop_tablet" },
    available: true,
    version: CATALOG_VERSION,
    description: "Tablet corporativo com catálogo aberto na mão esquerda",
    spriteRef: "sprite_r1_c2",
    legacyAliases: ["tablet_zai", "acc_05"],
  },
  {
    id: "prop_laptop",
    name: "Notebook Portátil ZAI",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "prop",
    assetBuilderId: "prop_laptop",
    materialPreset: "metal_brushed",
    compatibility: { genders: ALL_GENDERS, handSlot: "left" },
    mountPoint: "leftForearm.accessory_slot.prop",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#94a3b8", silhouette: "prop_laptop" },
    available: true,
    version: CATALOG_VERSION,
    description: "Notebook corporativo carregado junto ao antebraço",
    spriteRef: "sprite_r3_c5",
    legacyAliases: ["laptop_zai", "acc_10"],
  },
  {
    id: "prop_coffee",
    name: "Copo Térmico ZAI Café",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "prop",
    assetBuilderId: "prop_coffee",
    materialPreset: "ceramic_matte",
    compatibility: { genders: ALL_GENDERS, handSlot: "right" },
    mountPoint: "rightHand.accessory_slot.prop",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#10b981", silhouette: "prop_coffee" },
    available: true,
    version: CATALOG_VERSION,
    description: "Copo térmico na mão direita (recolhido ao acenar)",
    spriteRef: "sprite_r2_c5",
    legacyAliases: ["coffee_cup", "acc_08"],
  },
  {
    id: "prop_clipboard",
    name: "Prancheta de Pedidos",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "prop",
    assetBuilderId: "prop_clipboard",
    materialPreset: "wood_paper",
    compatibility: { genders: ALL_GENDERS, handSlot: "left" },
    mountPoint: "leftHand.accessory_slot.prop",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#d97706", silhouette: "prop_clipboard" },
    available: true,
    version: CATALOG_VERSION,
    description: "Prancheta com folha de pedidos e clipe metálico",
    spriteRef: "sprite_r3_c4",
    legacyAliases: ["clipboard_sales"],
  },
  {
    id: "prop_smartphone",
    name: "Smartphone WhatsApp",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "prop",
    assetBuilderId: "prop_smartphone",
    materialPreset: "metal_glass",
    compatibility: { genders: ALL_GENDERS, handSlot: "right" },
    mountPoint: "rightHand.accessory_slot.prop",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#22c55e", silhouette: "prop_smartphone" },
    available: true,
    version: CATALOG_VERSION,
    description: "Smartphone com tela ativa de atendimento",
    spriteRef: "sprite_r3_c9",
    legacyAliases: ["smartphone_chat"],
  },
  {
    id: "prop_boxes",
    name: "Caixas de Entrega ZAI",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "prop",
    assetBuilderId: "prop_boxes",
    materialPreset: "cardboard_matte",
    compatibility: { genders: ALL_GENDERS, twoHandedProp: true, handSlot: "both" },
    mountPoint: "chest.accessory_slot.prop",
    compatibleAnimations: NO_TWO_HAND_WAVE_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#c08a4d", silhouette: "prop_boxes" },
    available: true,
    version: CATALOG_VERSION,
    description: "Volumes lacrados carregados com ambas as mãos",
    spriteRef: "sprite_r3_c1",
    legacyAliases: ["boxes_delivery", "acc_09"],
  },
  // Back
  {
    id: "back_backpack",
    name: "Mochila Tática ZAI",
    category: "accessories",
    slot: "accessory_slot",
    subSlot: "back",
    assetBuilderId: "back_backpack",
    materialPreset: "fabric_nylon_matte",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.accessory_slot.back",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "accessory-body", accentColor: "#10b981", silhouette: "back_backpack" },
    available: true,
    version: CATALOG_VERSION,
    description: "Mochila executiva acoplada às costas com faixa refletiva",
    spriteRef: "sprite_r1_c4",
    legacyAliases: ["backpack_tactical_black", "acc_11"],
  },
];

/* ==========================================================================
   7. UNIFORM SLOT & STYLE SLOT — Updates ONLY palette/trim/emblem
   ========================================================================== */
export const SLOT_UNIFORM_ITEMS: SlotCatalogItem[] = [
  {
    id: "uniform_zai_emerald",
    name: "Paleta ZAI Esmeralda",
    category: "uniform",
    slot: "uniform_slot",
    assetBuilderId: "emerald",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#10b981", silhouette: "uniform_emerald" },
    available: true,
    version: CATALOG_VERSION,
    description: "Acabamento oficial verde esmeralda ZAI",
    palette: { primary: "#10b981", secondary: "#0f172a", accent: "#00f090" },
  },
  {
    id: "uniform_corporate_sky",
    name: "Paleta Corporativa Azul",
    category: "uniform",
    slot: "uniform_slot",
    assetBuilderId: "sky",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#0ea5e9", silhouette: "uniform_sky" },
    available: true,
    version: CATALOG_VERSION,
    description: "Acabamento executivo azul corporativo",
    palette: { primary: "#0ea5e9", secondary: "#0f172a", accent: "#38bdf8" },
  },
  {
    id: "uniform_tech_violet",
    name: "Paleta Tech Violeta",
    category: "uniform",
    slot: "uniform_slot",
    assetBuilderId: "violet",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#8b5cf6", silhouette: "uniform_violet" },
    available: true,
    version: CATALOG_VERSION,
    description: "Detalhes em violeta digital",
    palette: { primary: "#8b5cf6", secondary: "#0f172a", accent: "#a78bfa" },
  },
  {
    id: "uniform_logistics_amber",
    name: "Paleta Operacional Âmbar",
    category: "uniform",
    slot: "uniform_slot",
    assetBuilderId: "amber",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#f59e0b", silhouette: "uniform_amber" },
    available: true,
    version: CATALOG_VERSION,
    description: "Faixas e emblema em âmbar operacional",
    palette: { primary: "#f59e0b", secondary: "#1c1917", accent: "#fbbf24" },
  },
  {
    id: "uniform_obsidian_gold",
    name: "Paleta Premium Ouro",
    category: "uniform",
    slot: "uniform_slot",
    assetBuilderId: "gold",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#eab308", silhouette: "uniform_gold" },
    available: true,
    version: CATALOG_VERSION,
    description: "Acabamento premium com emblema dourado",
    palette: { primary: "#eab308", secondary: "#09090b", accent: "#fde047" },
  },
];

export const SLOT_STYLE_ITEMS: SlotCatalogItem[] = [
  {
    id: "style_vendas",
    name: "Estilo Vendas",
    category: "style",
    slot: "style_slot",
    assetBuilderId: "sales",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#10b981", silhouette: "style_vendas" },
    available: true,
    version: CATALOG_VERSION,
    description: "Paleta comercial verde esmeralda e postura consultiva",
    spriteRef: "sprite_r2_c8",
    legacyAliases: ["sales"],
    palette: { primary: "#10b981", accent: "#34d399", posture: "sales" },
  },
  {
    id: "style_corporativo",
    name: "Estilo Corporativo",
    category: "style",
    slot: "style_slot",
    assetBuilderId: "corporate",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#0ea5e9", silhouette: "style_corporativo" },
    available: true,
    version: CATALOG_VERSION,
    description: "Paleta institucional azul e postura executiva",
    spriteRef: "sprite_r1_c8",
    legacyAliases: ["corporate", "style_executivo"],
    palette: { primary: "#0ea5e9", accent: "#38bdf8", posture: "executive" },
  },
  {
    id: "style_atendimento",
    name: "Estilo Atendimento",
    category: "style",
    slot: "style_slot",
    assetBuilderId: "atendimento",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#06b6d4", silhouette: "style_atendimento" },
    available: true,
    version: CATALOG_VERSION,
    description: "Paleta ciano acolhedora e postura receptiva",
    spriteRef: "sprite_r2_c1",
    legacyAliases: ["atendimento"],
    palette: { primary: "#06b6d4", accent: "#22d3ee", posture: "welcoming" },
  },
  {
    id: "style_operacional",
    name: "Estilo Operacional",
    category: "style",
    slot: "style_slot",
    assetBuilderId: "operational",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#f59e0b", silhouette: "style_operacional" },
    available: true,
    version: CATALOG_VERSION,
    description: "Paleta âmbar dinâmica para logística e operação",
    spriteRef: "sprite_r3_c2",
    legacyAliases: ["operational"],
    palette: { primary: "#f59e0b", accent: "#fbbf24", posture: "dynamic" },
  },
  {
    id: "style_tech",
    name: "Estilo Tech",
    category: "style",
    slot: "style_slot",
    assetBuilderId: "tech",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#8b5cf6", silhouette: "style_tech" },
    available: true,
    version: CATALOG_VERSION,
    description: "Paleta violeta especialista para suporte técnico",
    spriteRef: "sprite_r1_c4",
    legacyAliases: ["tech"],
    palette: { primary: "#8b5cf6", accent: "#a78bfa", posture: "tech" },
  },
  {
    id: "style_casual",
    name: "Estilo Casual",
    category: "style",
    slot: "style_slot",
    assetBuilderId: "casual",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#14b8a6", silhouette: "style_casual" },
    available: true,
    version: CATALOG_VERSION,
    description: "Paleta teal leve com postura descontraída",
    spriteRef: "sprite_r1_c7",
    legacyAliases: ["casual"],
    palette: { primary: "#14b8a6", accent: "#2dd4bf", posture: "relaxed" },
  },
  {
    id: "style_premium",
    name: "Estilo Premium",
    category: "style",
    slot: "style_slot",
    assetBuilderId: "premium",
    materialPreset: "brand_accent",
    compatibility: { genders: ALL_GENDERS },
    mountPoint: "chest.uniform_slot",
    compatibleAnimations: ALL_ANIMS,
    thumbnailSpec: { focus: "full", accentColor: "#eab308", silhouette: "style_premium" },
    available: true,
    version: CATALOG_VERSION,
    description: "Paleta ouro sofisticada para atendimento VIP",
    spriteRef: "sprite_r2_c9",
    legacyAliases: ["premium"],
    palette: { primary: "#eab308", accent: "#fde047", posture: "executive" },
  },
];

/* ==========================================================================
   MORPH & POSE OPTIONS
   ========================================================================== */
export const FACIAL_HAIR_OPTIONS: Array<{ id: FacialHairStyle; name: string; description: string }> = [
  { id: "none", name: "Sem Barba", description: "Rosto limpo e barbeado" },
  { id: "stubble", name: "Barba por Fazer", description: "Contorno sutil de barba rala" },
  { id: "short_beard", name: "Barba Curta Alinhada", description: "Barba aparada com bigode desenhado" },
  { id: "full_beard", name: "Barba Cheia Executiva", description: "Barba encorpada estruturada no maxilar" },
  { id: "goatee", name: "Cavanhaque Moderno", description: "Bigode e cavanhaque alinhados" },
];

export const POSE_OPTIONS: Array<{ id: PoseId; name: string; description: string }> = [
  { id: "pose_executive", name: "Executiva", description: "Postura firme de liderança e confiança" },
  { id: "pose_consultative", name: "Consultiva", description: "Gestos abertos de acolhimento ao cliente" },
  { id: "pose_peace", name: "Vitória (Paz)", description: "Mão direita em V celebrando resultado" },
  { id: "pose_hero", name: "Pronto para Ação", description: "Postura energética de alto desempenho" },
];

export const ALL_SLOT_CATALOG_ITEMS: SlotCatalogItem[] = [
  ...SLOT_HAIR_ITEMS,
  ...SLOT_FACE_ITEMS,
  ...SLOT_UPPER_BODY_ITEMS,
  ...SLOT_LOWER_BODY_ITEMS,
  ...SLOT_FOOTWEAR_ITEMS,
  ...SLOT_ACCESSORY_ITEMS,
  ...SLOT_UNIFORM_ITEMS,
  ...SLOT_STYLE_ITEMS,
];

export const SLOT_CATALOG_BY_ID: Record<string, SlotCatalogItem> = ALL_SLOT_CATALOG_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    item.legacyAliases?.forEach((alias) => {
      if (!acc[alias]) acc[alias] = item;
    });
    return acc;
  },
  {} as Record<string, SlotCatalogItem>,
);

export function findCatalogItem(id?: string): SlotCatalogItem | undefined {
  if (!id) return undefined;
  return SLOT_CATALOG_BY_ID[id];
}

export function getCatalogItemsForSlot(
  slot: AvatarSlotType,
  gender?: BodyType,
): SlotCatalogItem[] {
  const list = ALL_SLOT_CATALOG_ITEMS.filter((item) => item.slot === slot);
  if (!gender || gender === "neutral" || gender === "robot") {
    return list;
  }
  return list.filter((item) => !item.gender || item.gender === "all" || item.gender === gender);
}

/* ==========================================================================
   CANONICAL NORMALIZATION & IMMUTABLE SLOT UPDATES
   ========================================================================== */

export interface NormalizedAccessorySubSlots {
  eyewear: string;
  headwear: string;
  headset: string;
  badge: string;
  wrist: string;
  prop: string;
  back: string;
}

export interface NormalizedAvatarComposition extends AgentAvatarConfig {
  body: BodyType;
  base: "female" | "male";
  skin: SkinTone;
  hair: string;
  hairColor: HairColor;
  face: string;
  facialHair: FacialHairStyle;
  upperBody: string;
  lowerBody: string;
  footwear: string;
  uniform: string;
  style: string;
  poseId: PoseId;
  accessorySubSlots: NormalizedAccessorySubSlots;
  compositionVersion: number;
}

const VALID_SKIN_TONES = new Set<SkinTone>(["fair", "peach", "tan", "bronze", "dark", "deep_dark"]);
const VALID_HAIR_COLORS = new Set<HairColor>([
  "black",
  "dark_brown",
  "auburn",
  "golden_blonde",
  "platinum",
  "neon_pink",
  "cyber_blue",
  "fiery_red",
  "emerald",
  "lavender",
]);

const MALE_NAME_HINTS = [
  "joao",
  "carlos",
  "rafael",
  "pedro",
  "lucas",
  "marcos",
  "bruno",
  "gabriel",
  "thiago",
  "matheus",
  "rodrigo",
  "felipe",
  "gustavo",
  "leonardo",
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function inferGenderFromConfig(raw?: Partial<AgentAvatarConfig> | null): BodyType {
  if (!raw) return "female";
  if (raw.body === "robot") return "robot";
  if (raw.body === "male" || raw.base === "male") return "male";
  if (raw.body === "female" || raw.base === "female") return "female";
  if (raw.body === "neutral") return "neutral";

  const nameHint = (raw as { name?: string }).name || "";
  const idHint = stripAccents(`${raw.agentId || ""} ${nameHint}`);
  if (idHint.includes("zaibot") || idHint.includes("bot")) return "robot";
  if (idHint.includes("camila") || idHint.includes("julia") || idHint.includes("ana") || idHint.includes("mariana")) {
    return "female";
  }
  if (MALE_NAME_HINTS.some((hint) => idHint.includes(hint))) {
    return "male";
  }
  if (raw.hair && (raw.hair.startsWith("male_") || ["hair_05", "hair_08", "hair_14", "hair_15", "hair_16", "hair_17", "hair_18"].includes(raw.hair))) {
    return "male";
  }
  if (raw.facialHair && raw.facialHair !== "none") {
    return "male";
  }
  return "female";
}

function defaultLowerForUpper(upperId: string): string {
  if (upperId === "upper_shirt" || upperId === "upper_blazer") return "lower_slacks";
  if (upperId === "upper_uniform_jacket" || upperId === "upper_vest") return "lower_cargo";
  if (upperId === "upper_hoodie" || upperId === "upper_bomber") return "lower_jogger";
  return "lower_chinos";
}

function defaultFootwearForUpper(upperId: string): string {
  if (upperId === "upper_shirt" || upperId === "upper_blazer") return "shoe_oxford";
  if (upperId === "upper_vest") return "shoe_safety";
  if (upperId === "upper_uniform_jacket") return "shoe_boot";
  return "shoe_sneaker";
}

function normalizeLegacyOutfitString(rawOutfit?: string): string {
  if (!rawOutfit) return "upper_polo";
  const found = findCatalogItem(rawOutfit);
  if (found && found.slot === "upper_body_slot") return found.id;
  if (rawOutfit.startsWith("upper_")) return rawOutfit;
  return "upper_polo";
}

function normalizeLegacyLower(rawLower?: string, upperId: string = "upper_polo"): string {
  if (!rawLower) return defaultLowerForUpper(upperId);
  const found = findCatalogItem(rawLower);
  if (found && found.slot === "lower_body_slot") return found.id;
  if (rawLower.startsWith("lower_")) return rawLower;
  if (rawLower.includes("social") || rawLower.includes("slack")) return "lower_slacks";
  if (rawLower.includes("cargo")) return "lower_cargo";
  if (rawLower.includes("skirt") || rawLower.includes("saia")) return "lower_skirt_exec";
  if (rawLower.includes("jogger")) return "lower_jogger";
  return "lower_chinos";
}

function normalizeLegacyFootwear(rawFootwear?: string, upperId: string = "upper_polo"): string {
  if (!rawFootwear) return defaultFootwearForUpper(upperId);
  const found = findCatalogItem(rawFootwear);
  if (found && found.slot === "footwear_slot") return found.id;
  if (rawFootwear.startsWith("shoe_")) return rawFootwear;
  if (rawFootwear.includes("oxford") || rawFootwear.includes("exec")) return "shoe_oxford";
  if (rawFootwear.includes("boot")) return "shoe_boot";
  if (rawFootwear.includes("safety")) return "shoe_safety";
  if (rawFootwear.includes("minimal")) return "shoe_minimal";
  return "shoe_sneaker";
}

function normalizeAccessoryIdForSubSlot(value: string | undefined): { subSlot: AccessorySubSlot; id: string } | null {
  if (!value || value === "none" || value === "hands_in_pockets") return null;
  const item = findCatalogItem(value);
  if (item && item.slot === "accessory_slot" && item.subSlot) {
    return { subSlot: item.subSlot, id: item.id };
  }
  return null;
}

export function normalizeAccessorySubSlots(raw?: Partial<AgentAvatarConfig> | null): NormalizedAccessorySubSlots {
  const result: NormalizedAccessorySubSlots = {
    eyewear: "none",
    headwear: "none",
    headset: "none",
    badge: "none",
    wrist: "none",
    prop: "none",
    back: "none",
  };
  if (!raw) return result;

  const applyToken = (token?: string) => {
    const resolved = normalizeAccessoryIdForSubSlot(token);
    if (resolved) {
      result[resolved.subSlot] = resolved.id;
    }
  };

  if (Array.isArray(raw.accessories)) {
    raw.accessories.forEach((entry) => {
      if (typeof entry === "string") applyToken(entry);
    });
  } else if (raw.accessories && typeof raw.accessories === "object") {
    const obj = raw.accessories as Record<string, string>;
    Object.values(obj).forEach((val) => {
      if (typeof val === "string") applyToken(val);
    });
  }

  // Flat legacy fields: apply only if sub-slot wasn't explicitly set to another item or if explicitly set
  if (raw.glasses && raw.glasses !== "none") applyToken(raw.glasses);
  if (raw.headset && raw.headset !== "none") applyToken(raw.headset);
  if (raw.workObject && raw.workObject !== "none" && raw.workObject !== "hands_in_pockets") {
    applyToken(raw.workObject);
  }
  if (raw.badge === true && result.badge === "none") {
    // Only synthesize badge if explicit badge boolean is true AND accessories object doesn't explicitly say "none"
    const rawAccObj = !Array.isArray(raw.accessories) && raw.accessories && typeof raw.accessories === "object"
      ? (raw.accessories as Record<string, string>)
      : null;
    if (!rawAccObj || (rawAccObj.badge !== "none" && rawAccObj.badge !== undefined)) {
      if (rawAccObj?.badge) applyToken(rawAccObj.badge);
    }
  }
  if (raw.badge === false) {
    result.badge = "none";
  }

  return result;
}

export function normalizeAvatarComposition(
  raw?: Partial<AgentAvatarConfig> | null,
): NormalizedAvatarComposition {
  const input = raw || {};
  const gender = inferGenderFromConfig(input);
  const isMale = gender === "male";
  const baseGender: "male" | "female" = isMale ? "male" : "female";

  const skin: SkinTone = input.skin && VALID_SKIN_TONES.has(input.skin)
    ? input.skin
    : isMale
    ? "tan"
    : "peach";

  const rawHair = input.hair || (gender === "robot" ? "none" : isMale ? "hair_05" : "hair_01");
  const hairCatalog = findCatalogItem(rawHair);
  const hair = rawHair === "none" || gender === "robot"
    ? "none"
    : hairCatalog && hairCatalog.slot === "hair_slot"
    ? hairCatalog.id
    : /^hair_(0[1-9]|1[0-8])$/.test(rawHair)
    ? rawHair
    : isMale
    ? "hair_05"
    : "hair_01";

  const hairColor: HairColor = input.hairColor && VALID_HAIR_COLORS.has(input.hairColor)
    ? input.hairColor
    : isMale
    ? "black"
    : "dark_brown";

  const rawFace = input.face || input.eyes || "face_01";
  const faceCatalog = findCatalogItem(rawFace);
  const face = faceCatalog && faceCatalog.slot === "face_slot"
    ? faceCatalog.id
    : /^face_0[1-8]$/.test(rawFace)
    ? rawFace
    : "face_01";

  const validFacialHair = new Set<FacialHairStyle>(["none", "stubble", "short_beard", "full_beard", "goatee"]);
  const facialHair: FacialHairStyle = input.facialHair && validFacialHair.has(input.facialHair as FacialHairStyle)
    ? (input.facialHair as FacialHairStyle)
    : "none";

  const rawOutfit = input.upperBody || input.outfit || input.clothing || "outfit_01";
  const upperBody = normalizeLegacyOutfitString(rawOutfit);
  const lowerBody = normalizeLegacyLower(input.lowerBody || input.pants, upperBody);
  const footwear = normalizeLegacyFootwear(input.footwear || input.shoes, upperBody);

  const accessorySubSlots = normalizeAccessorySubSlots(input);
  const styleCatalog = findCatalogItem(input.style || "style_vendas");
  const style = styleCatalog && styleCatalog.slot === "style_slot" ? styleCatalog.id : "style_vendas";

  const uniformCatalog = findCatalogItem(input.uniform || "uniform_zai_emerald");
  const uniform = uniformCatalog && uniformCatalog.slot === "uniform_slot" ? uniformCatalog.id : "uniform_zai_emerald";

  const validPoses = new Set<PoseId>(["pose_executive", "pose_consultative", "pose_peace", "pose_hero"]);
  const poseId: PoseId = input.poseId && validPoses.has(input.poseId as PoseId)
    ? (input.poseId as PoseId)
    : "pose_executive";

  const branding = {
    storeName: input.branding?.storeName || "ZAI CRM",
    primaryColor: input.branding?.primaryColor || styleCatalog?.palette?.primary || "#10b981",
    secondaryColor: input.branding?.secondaryColor || "#0f172a",
    accentColor: input.branding?.accentColor || styleCatalog?.palette?.accent || "#00f090",
    logo: input.branding?.logo || "ZAI",
    showLogoOnChest: input.branding?.showLogoOnChest ?? true,
    showLogoOnBadge: input.branding?.showLogoOnBadge ?? true,
    showLogoOnCap: input.branding?.showLogoOnCap ?? true,
    showLogoOnObject: input.branding?.showLogoOnObject ?? true,
  };

  return {
    ...input,
    agentId: input.agentId || "camila",
    body: gender,
    base: baseGender,
    skin,
    hair,
    hairColor,
    face,
    eyes: input.eyes || face,
    facialHair,
    glasses: accessorySubSlots.eyewear,
    headset: accessorySubSlots.headset,
    clothing: input.clothing || input.outfit || upperBody,
    outfit: input.outfit || input.clothing || upperBody,
    upperBody,
    lowerBody,
    pants: lowerBody,
    footwear,
    shoes: footwear,
    uniform,
    style,
    poseId,
    badge: accessorySubSlots.badge !== "none",
    workObject: accessorySubSlots.prop !== "none" ? accessorySubSlots.prop : (input.workObject === "hands_in_pockets" || input.workObject === "folded_arms" || input.workObject === "thumbs_up" || input.workObject === "peace_sign" ? input.workObject : "none"),
    accessories: {
      ...(typeof input.accessories === "object" && !Array.isArray(input.accessories) ? input.accessories : {}),
      eyewear: accessorySubSlots.eyewear,
      glasses: accessorySubSlots.eyewear,
      headwear: accessorySubSlots.headwear,
      headset: accessorySubSlots.headset,
      badge: accessorySubSlots.badge,
      wrist: accessorySubSlots.wrist,
      watch: accessorySubSlots.wrist,
      prop: accessorySubSlots.prop,
      back: accessorySubSlots.back,
      backpack: accessorySubSlots.back,
    },
    accessorySubSlots,
    branding,
    animationState: input.animationState || "WORKING",
    personalityVisual: {
      posture: input.personalityVisual?.posture || "sales",
      expression: input.personalityVisual?.expression || "friendly_smile",
      preferredObject: input.personalityVisual?.preferredObject || accessorySubSlots.prop || "none",
      animationStyle: input.personalityVisual?.animationStyle || "smooth",
    },
    slots: {
      hair,
      face,
      upperBody,
      lowerBody,
      footwear,
      uniform,
      style,
      accessories: { ...accessorySubSlots },
    },
    compositionVersion: input.compositionVersion ?? 2,
  };
}

export type SlotUpdateTarget =
  | AvatarSlotType
  | AccessorySubSlot
  | "skinTone"
  | "hairColor"
  | "facialHair"
  | "gender";

/**
 * Pure immutable slot update helper.
 * Updating any slot guarantees all unrelated slots, morphs, and accessory sub-slots stay intact.
 */
export function buildSlotUpdate(
  prev: Partial<AgentAvatarConfig> | null | undefined,
  target: SlotUpdateTarget,
  itemId: string,
): NormalizedAvatarComposition {
  const current = normalizeAvatarComposition(prev);

  switch (target) {
    case "hair_slot": {
      const item = findCatalogItem(itemId);
      const nextHair = item?.slot === "hair_slot" ? item.id : itemId;
      return normalizeAvatarComposition({
        ...current,
        hair: nextHair,
        compositionVersion: 2,
      });
    }

    case "face_slot": {
      const item = findCatalogItem(itemId);
      const nextFace = item?.slot === "face_slot" ? item.id : itemId;
      return normalizeAvatarComposition({
        ...current,
        face: nextFace,
        eyes: nextFace,
        compositionVersion: 2,
      });
    }

    case "upper_body_slot": {
      const item = findCatalogItem(itemId);
      const nextUpper = item?.slot === "upper_body_slot" ? item.id : normalizeLegacyOutfitString(itemId);
      // Keep original legacy outfit id if outfit_01..10 was clicked so color variants (outfit_09 / outfit_10) & UI active states remain intact
      const outfitField = itemId.startsWith("outfit_") || itemId.startsWith("upper_") ? itemId : nextUpper;
      return normalizeAvatarComposition({
        ...current,
        upperBody: nextUpper,
        outfit: outfitField,
        clothing: outfitField,
        compositionVersion: 2,
      });
    }

    case "lower_body_slot": {
      const item = findCatalogItem(itemId);
      const nextLower = item?.slot === "lower_body_slot" ? item.id : normalizeLegacyLower(itemId, current.upperBody);
      return normalizeAvatarComposition({
        ...current,
        lowerBody: nextLower,
        pants: nextLower,
        compositionVersion: 2,
      });
    }

    case "footwear_slot": {
      const item = findCatalogItem(itemId);
      const nextShoe = item?.slot === "footwear_slot" ? item.id : normalizeLegacyFootwear(itemId, current.upperBody);
      return normalizeAvatarComposition({
        ...current,
        footwear: nextShoe,
        shoes: nextShoe,
        compositionVersion: 2,
      });
    }

    case "uniform_slot": {
      const item = findCatalogItem(itemId);
      const nextUniform = item?.slot === "uniform_slot" ? item.id : itemId;
      return normalizeAvatarComposition({
        ...current,
        uniform: nextUniform,
        branding: {
          ...current.branding,
          primaryColor: item?.palette?.primary || current.branding.primaryColor,
          secondaryColor: item?.palette?.secondary || current.branding.secondaryColor,
          accentColor: item?.palette?.accent || current.branding.accentColor,
        },
        compositionVersion: 2,
      });
    }

    case "style_slot": {
      const item = findCatalogItem(itemId);
      const nextStyle = item?.slot === "style_slot" ? item.id : itemId;
      return normalizeAvatarComposition({
        ...current,
        style: nextStyle,
        branding: {
          ...current.branding,
          primaryColor: item?.palette?.primary || current.branding.primaryColor,
          accentColor: item?.palette?.accent || current.branding.accentColor,
        },
        personalityVisual: {
          ...current.personalityVisual,
          posture: item?.palette?.posture || current.personalityVisual.posture,
        },
        compositionVersion: 2,
      });
    }

    case "skinTone": {
      const nextSkin = VALID_SKIN_TONES.has(itemId as SkinTone) ? (itemId as SkinTone) : current.skin;
      return normalizeAvatarComposition({
        ...current,
        skin: nextSkin,
        compositionVersion: 2,
      });
    }

    case "hairColor": {
      const nextColor = VALID_HAIR_COLORS.has(itemId as HairColor) ? (itemId as HairColor) : current.hairColor;
      return normalizeAvatarComposition({
        ...current,
        hairColor: nextColor,
        compositionVersion: 2,
      });
    }

    case "facialHair": {
      return normalizeAvatarComposition({
        ...current,
        facialHair: (itemId || "none") as FacialHairStyle,
        compositionVersion: 2,
      });
    }

    case "gender": {
      const nextGender: BodyType =
        itemId === "male" || itemId === "female" || itemId === "neutral" || itemId === "robot"
          ? itemId
          : current.body;
      const nextBase: "male" | "female" = nextGender === "male" ? "male" : "female";
      return normalizeAvatarComposition({
        ...current,
        body: nextGender,
        base: nextBase,
        compositionVersion: 2,
      });
    }

    case "accessory_slot":
    case "eyewear":
    case "headwear":
    case "headset":
    case "badge":
    case "wrist":
    case "prop":
    case "back": {
      if (itemId === "acc_01" || itemId === "none_all") {
        return normalizeAvatarComposition({
          ...current,
          glasses: "none",
          headset: "none",
          badge: false,
          workObject: "none",
          accessories: {
            eyewear: "none",
            glasses: "none",
            headwear: "none",
            headset: "none",
            badge: "none",
            wrist: "none",
            watch: "none",
            prop: "none",
            back: "none",
            backpack: "none",
          },
          compositionVersion: 2,
        });
      }

      const item = findCatalogItem(itemId);
      const subSlot: AccessorySubSlot | undefined = target === "accessory_slot" ? item?.subSlot : target;
      if (!subSlot) return current;

      const nextValue = itemId === "none" ? "none" : (item?.id || itemId);
      const nextSubSlots: NormalizedAccessorySubSlots = {
        ...current.accessorySubSlots,
        [subSlot]: nextValue,
      };

      return normalizeAvatarComposition({
        ...current,
        glasses: nextSubSlots.eyewear,
        headset: nextSubSlots.headset,
        badge: nextSubSlots.badge !== "none",
        workObject: nextSubSlots.prop,
        accessories: {
          ...current.accessories,
          eyewear: nextSubSlots.eyewear,
          glasses: nextSubSlots.eyewear,
          headwear: nextSubSlots.headwear,
          headset: nextSubSlots.headset,
          badge: nextSubSlots.badge,
          wrist: nextSubSlots.wrist,
          watch: nextSubSlots.wrist,
          prop: nextSubSlots.prop,
          back: nextSubSlots.back,
          backpack: nextSubSlots.back,
        },
        compositionVersion: 2,
      });
    }
  }
}
