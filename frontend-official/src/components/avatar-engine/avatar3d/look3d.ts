import type { AgentAvatarConfig, BodyType } from "../AvatarDefinition";
import {
  HAIR_PALETTES,
  SKIN_PALETTES,
  resolveAccessoryFlags,
  type AccessoryFlags,
} from "../avatarLook";
import {
  findCatalogItem,
  normalizeAvatarComposition,
  type FacialHairStyle,
  type NormalizedAccessorySubSlots,
  type PoseId,
} from "./slotCatalog";

export type HairStyle3D =
  | "none"
  | "ponytail"
  | "bob"
  | "long"
  | "long_bangs"
  | "bun"
  | "short"
  | "afro"
  | "spiky"
  | "curly"
  | "slick_back"
  | "medium_side"
  | "cyber_wave"
  | "layered_long"
  | "glamour_waves"
  | "long_tucked"
  | "tactical_crop"
  | "anime_spiky"
  | "urban_flame";

export type Headwear3D = "none" | "cap" | "hardhat";

export type Expression3D =
  | "smile"
  | "confident"
  | "wink"
  | "open_smile"
  | "calm"
  | "focused"
  | "executive"
  | "charismatic";

export type OutfitKind3D =
  | "polo"
  | "shirt"
  | "hoodie"
  | "uniform"
  | "jacket"
  | "vest"
  | "tee"
  | "bomber";

export type LowerBodyKind3D =
  | "chinos"
  | "slacks"
  | "cargo"
  | "skirt_exec"
  | "jogger";

export type FootwearKind3D =
  | "sneaker"
  | "oxford"
  | "boot"
  | "safety"
  | "minimal";

export type Outfit3D = {
  id: string;
  kind: OutfitKind3D;
  body: string;
  trim: string;
  inner?: string;
  longSleeves: boolean;
};

export type LowerBody3D = {
  id: string;
  kind: LowerBodyKind3D;
  color: string;
  accent: string;
};

export type Footwear3D = {
  id: string;
  kind: FootwearKind3D;
  upper: string;
  sole: string;
  accent: string;
};

export type AvatarLook3D = {
  gender: BodyType;
  female: boolean;
  skinKey: string;
  skin: string;
  skinShadow: string;
  blush: string;
  hairId: string;
  hairStyle: HairStyle3D;
  hairColorKey: string;
  hairColor: string;
  hairHighlight: string;
  facialHair: FacialHairStyle;
  beard: boolean;
  faceId: string;
  expression: Expression3D;
  iris: string;
  headwear: Headwear3D;
  outfit: Outfit3D;
  lowerBody: LowerBody3D;
  footwear: Footwear3D;
  accessories: AccessoryFlags;
  accessorySubSlots: NormalizedAccessorySubSlots;
  uniformId: string;
  styleId: string;
  poseId: PoseId;
  brand: string;
  accent: string;
  logo: string;
};

const FACE_PRESETS: Record<string, { expression: Expression3D; iris: string }> = {
  face_01: { expression: "smile", iris: "#4a2512" },
  face_02: { expression: "confident", iris: "#2563eb" },
  face_03: { expression: "wink", iris: "#522914" },
  face_04: { expression: "open_smile", iris: "#059669" },
  face_05: { expression: "calm", iris: "#475569" },
  face_06: { expression: "focused", iris: "#b45309" },
  face_07: { expression: "executive", iris: "#334155" },
  face_08: { expression: "charismatic", iris: "#6d28d9" },
};

const HAIR_3D_COLORS: Record<string, { base: string; highlight: string }> = {
  black: { base: "#1b202c", highlight: "#475569" },
  dark_brown: { base: "#432818", highlight: "#7f5539" },
  auburn: { base: "#6e3418", highlight: "#b86b35" },
};

const HAIR_STYLE_BY_ID: Record<string, HairStyle3D> = {
  none: "none",
  hair_01: "ponytail",
  hair_02: "bob",
  hair_03: "long",
  hair_04: "bun",
  hair_05: "short",
  hair_06: "afro",
  hair_07: "long_bangs",
  hair_08: "spiky",
  hair_09: "curly",
  hair_10: "cyber_wave",
  hair_11: "layered_long",
  hair_12: "glamour_waves",
  hair_13: "long_tucked",
  hair_14: "tactical_crop",
  hair_15: "anime_spiky",
  hair_16: "medium_side",
  hair_17: "urban_flame",
  hair_18: "slick_back",
};

const ZAI_GREEN = "#10b981";

const OUTFIT_PRESETS: Record<string, Omit<Outfit3D, "id">> = {
  upper_polo: { kind: "polo", body: "#1d2432", trim: ZAI_GREEN, longSleeves: false },
  upper_shirt: { kind: "shirt", body: "#f8fafc", trim: "#1e293b", longSleeves: true },
  upper_hoodie: { kind: "hoodie", body: "#18202c", trim: ZAI_GREEN, longSleeves: true },
  upper_uniform_jacket: { kind: "uniform", body: "#1e3a5f", trim: "#94a3b8", longSleeves: true },
  upper_blazer: { kind: "jacket", body: "#161b26", trim: ZAI_GREEN, inner: "#1e293b", longSleeves: true },
  upper_vest: { kind: "vest", body: "#facc15", trim: "#e2e8f0", inner: "#1f2937", longSleeves: false },
  upper_tee: { kind: "tee", body: "#1b2230", trim: ZAI_GREEN, longSleeves: false },
  upper_bomber: { kind: "bomber", body: "#131b2c", trim: ZAI_GREEN, longSleeves: true },
  // Legacy color variants preserved accurately
  outfit_01: { kind: "polo", body: "#1d2432", trim: ZAI_GREEN, longSleeves: false },
  outfit_02: { kind: "shirt", body: "#f8fafc", trim: "#1e293b", longSleeves: true },
  outfit_03: { kind: "hoodie", body: "#18202c", trim: ZAI_GREEN, longSleeves: true },
  outfit_04: { kind: "uniform", body: "#1e3a5f", trim: "#94a3b8", longSleeves: true },
  outfit_05: { kind: "jacket", body: "#161b26", trim: ZAI_GREEN, inner: "#1e293b", longSleeves: true },
  outfit_06: { kind: "vest", body: "#facc15", trim: "#e2e8f0", inner: "#1f2937", longSleeves: false },
  outfit_07: { kind: "tee", body: "#1b2230", trim: ZAI_GREEN, longSleeves: false },
  outfit_08: { kind: "bomber", body: "#131b2c", trim: ZAI_GREEN, longSleeves: true },
  outfit_09: { kind: "polo", body: "#059669", trim: "#064e3b", longSleeves: false },
  outfit_10: { kind: "uniform", body: "#475569", trim: "#f97316", longSleeves: true },
};

const LOWER_PRESETS: Record<string, Omit<LowerBody3D, "id">> = {
  lower_chinos: { kind: "chinos", color: "#1e293b", accent: "#0f172a" },
  lower_slacks: { kind: "slacks", color: "#111827", accent: "#334155" },
  lower_cargo: { kind: "cargo", color: "#1a2230", accent: "#0f172a" },
  lower_skirt_exec: { kind: "skirt_exec", color: "#18181b", accent: "#334155" },
  lower_jogger: { kind: "jogger", color: "#161e2e", accent: "#0f172a" },
};

const FOOTWEAR_PRESETS: Record<string, Omit<Footwear3D, "id">> = {
  shoe_sneaker: { kind: "sneaker", upper: "#1e293b", sole: "#f8fafc", accent: ZAI_GREEN },
  shoe_oxford: { kind: "oxford", upper: "#18181b", sole: "#09090b", accent: "#52525b" },
  shoe_boot: { kind: "boot", upper: "#292524", sole: "#0c0a09", accent: "#78350f" },
  shoe_safety: { kind: "safety", upper: "#1c1917", sole: "#09090b", accent: "#f59e0b" },
  shoe_minimal: { kind: "minimal", upper: "#334155", sole: "#e2e8f0", accent: "#cbd5e1" },
};

export function resolveAvatarLook3D(
  avatar: Partial<AgentAvatarConfig>,
  brandColor?: string,
): AvatarLook3D {
  const norm = normalizeAvatarComposition(avatar);
  const female = norm.body !== "male";

  const skinPalette = SKIN_PALETTES[norm.skin] || SKIN_PALETTES.peach;
  const hairStyle: HairStyle3D = HAIR_STYLE_BY_ID[norm.hair] || (female ? "ponytail" : "short");

  const rawHairPalette = HAIR_PALETTES[norm.hairColor] || HAIR_PALETTES.dark_brown;
  const hairColors = HAIR_3D_COLORS[norm.hairColor] || {
    base: rawHairPalette.base,
    highlight: rawHairPalette.highlight,
  };

  const accessories = resolveAccessoryFlags(norm);
  const headwear: Headwear3D = accessories.hardhat
    ? "hardhat"
    : accessories.cap
    ? "cap"
    : "none";

  const facePreset = FACE_PRESETS[norm.face] || FACE_PRESETS.face_01;

  const brand = brandColor || norm.branding.primaryColor || ZAI_GREEN;
  const accent = norm.branding.accentColor || brand;

  const rawOutfitKey = norm.outfit && OUTFIT_PRESETS[norm.outfit] ? norm.outfit : norm.upperBody;
  const outfitBase = OUTFIT_PRESETS[rawOutfitKey] || OUTFIT_PRESETS.upper_polo;
  const outfit: Outfit3D = {
    id: norm.upperBody,
    ...outfitBase,
    trim: outfitBase.kind === "polo" || outfitBase.kind === "hoodie" || outfitBase.kind === "jacket" || outfitBase.kind === "tee" || outfitBase.kind === "bomber"
      ? (rawOutfitKey === "outfit_09" ? outfitBase.trim : brand)
      : outfitBase.trim,
  };

  const lowerBase = LOWER_PRESETS[norm.lowerBody] || LOWER_PRESETS.lower_chinos;
  const lowerBody: LowerBody3D = {
    id: norm.lowerBody,
    ...lowerBase,
    accent: norm.lowerBody === "lower_jogger" || norm.lowerBody === "lower_skirt_exec" ? brand : lowerBase.accent,
  };

  const shoeBase = FOOTWEAR_PRESETS[norm.footwear] || FOOTWEAR_PRESETS.shoe_sneaker;
  const footwear: Footwear3D = {
    id: norm.footwear,
    ...shoeBase,
    accent: norm.footwear === "shoe_sneaker" ? brand : shoeBase.accent,
  };

  const styleItem = findCatalogItem(norm.style);

  return {
    gender: norm.body,
    female,
    skinKey: norm.skin,
    skin: skinPalette.base,
    skinShadow: skinPalette.shadow,
    blush: skinPalette.blush,
    hairId: norm.hair,
    hairStyle,
    hairColorKey: norm.hairColor,
    hairColor: hairColors.base,
    hairHighlight: hairColors.highlight,
    facialHair: norm.facialHair,
    beard: norm.facialHair !== "none",
    faceId: norm.face,
    expression: facePreset.expression,
    iris: facePreset.iris,
    headwear,
    outfit,
    lowerBody,
    footwear,
    accessories,
    accessorySubSlots: norm.accessorySubSlots,
    uniformId: norm.uniform,
    styleId: styleItem?.id || norm.style,
    poseId: norm.poseId,
    brand,
    accent,
    logo: norm.branding.logo || "ZAI",
  };
}
