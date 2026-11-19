import type { AgentAvatarConfig } from "./AvatarDefinition";
import {
  inferGenderFromConfig,
  normalizeAccessorySubSlots,
  normalizeAvatarComposition,
  type FacialHairStyle,
  type NormalizedAccessorySubSlots,
} from "./avatar3d/slotCatalog";

export type SkinPalette = { base: string; shadow: string; highlight: string; blush: string };
export type HairPalette = { base: string; shadow: string; highlight: string };

export const SKIN_PALETTES: Record<string, SkinPalette> = {
  fair: { base: "#ffe0bd", shadow: "#e2b88b", highlight: "#fff5ea", blush: "#fca5a5" },
  peach: { base: "#f2c39f", shadow: "#bd805d", highlight: "#ffe2ca", blush: "#e89595" },
  tan: { base: "#d89759", shadow: "#b57236", highlight: "#e5ab75", blush: "#fb7185" },
  bronze: { base: "#aa6e39", shadow: "#844f22", highlight: "#c3834a", blush: "#e11d48" },
  dark: { base: "#6d4323", shadow: "#4f2e14", highlight: "#87552e", blush: "#9f1239" },
  deep_dark: { base: "#482a17", shadow: "#2e1809", highlight: "#5f3820", blush: "#881337" },
};

export const HAIR_PALETTES: Record<string, HairPalette> = {
  black: { base: "#18181b", shadow: "#09090b", highlight: "#3f3f46" },
  dark_brown: { base: "#452d1a", shadow: "#2e1c0e", highlight: "#614128" },
  auburn: { base: "#78350f", shadow: "#451a03", highlight: "#92400e" },
  golden_blonde: { base: "#eab308", shadow: "#ca8a04", highlight: "#fde047" },
  platinum: { base: "#cbd5e1", shadow: "#94a3b8", highlight: "#f1f5f9" },
  neon_pink: { base: "#ec4899", shadow: "#be185d", highlight: "#f472b6" },
  cyber_blue: { base: "#0284c7", shadow: "#0369a1", highlight: "#38bdf8" },
  fiery_red: { base: "#dc2626", shadow: "#991b1b", highlight: "#ef4444" },
  emerald: { base: "#059669", shadow: "#047857", highlight: "#10b981" },
  lavender: { base: "#9333ea", shadow: "#7e22ce", highlight: "#c084fc" },
};

const LEGACY_OUTFIT_MAP: Record<string, string> = {
  polo_zai_black: "outfit_01",
  polo_zai_white: "outfit_07",
  upper_polo: "outfit_01",
  shirt_formal_blue: "outfit_02",
  shirt_business_white: "outfit_02",
  upper_shirt: "outfit_02",
  tshirt_casual_dark: "outfit_03",
  hoodie_zai_black: "outfit_03",
  upper_hoodie: "outfit_03",
  uniform_tech_navy: "outfit_04",
  delivery_cargo_set: "outfit_10",
  upper_uniform_jacket: "outfit_04",
  blazer_executive_dark: "outfit_05",
  blazer_emerald_trim: "outfit_05",
  upper_blazer: "outfit_05",
  vest_operations: "outfit_06",
  vest_hivis_safety: "outfit_06",
  upper_vest: "outfit_06",
  casual_tee_charcoal: "outfit_07",
  upper_tee: "outfit_07",
  bomber_jacket_tech: "outfit_08",
  jacket_exec_dark: "outfit_08",
  upper_bomber: "outfit_08",
};

export function resolveOutfitId(avatar: Partial<AgentAvatarConfig>): string {
  const raw = avatar.outfit || avatar.clothing || avatar.upperBody || "outfit_01";
  return LEGACY_OUTFIT_MAP[raw] || raw || "outfit_01";
}

export function resolveLowerBodyId(avatar: Partial<AgentAvatarConfig>): string {
  return normalizeAvatarComposition(avatar).lowerBody;
}

export function resolveFootwearId(avatar: Partial<AgentAvatarConfig>): string {
  return normalizeAvatarComposition(avatar).footwear;
}

export function resolveFacialHair(avatar: Partial<AgentAvatarConfig>): FacialHairStyle {
  return normalizeAvatarComposition(avatar).facialHair;
}

export function resolveAccessorySubSlots(avatar: Partial<AgentAvatarConfig>): NormalizedAccessorySubSlots {
  return normalizeAccessorySubSlots(avatar);
}

export function isFemaleAvatar(avatar: Partial<AgentAvatarConfig>): boolean {
  return inferGenderFromConfig(avatar) !== "male";
}

export type AccessoryFlags = {
  headset: boolean;
  earbud: boolean;
  badge: boolean;
  badgeClip: boolean;
  glasses: boolean;
  sunglasses: boolean;
  tablet: boolean;
  clipboard: boolean;
  smartphone: boolean;
  watch: boolean;
  coffee: boolean;
  boxes: boolean;
  laptop: boolean;
  backpack: boolean;
  cap: boolean;
  hardhat: boolean;
};

export function resolveAccessoryFlags(avatar: Partial<AgentAvatarConfig>): AccessoryFlags {
  const sub = normalizeAccessorySubSlots(avatar);
  return {
    headset: sub.headset === "headset_pro",
    earbud: sub.headset === "headset_earbud",
    badge: sub.badge === "badge_lanyard",
    badgeClip: sub.badge === "badge_clip",
    glasses: sub.eyewear === "eyewear_executive",
    sunglasses: sub.eyewear === "eyewear_wayfarer",
    tablet: sub.prop === "prop_tablet",
    clipboard: sub.prop === "prop_clipboard",
    smartphone: sub.prop === "prop_smartphone",
    watch: sub.wrist === "wrist_smartwatch",
    coffee: sub.prop === "prop_coffee",
    boxes: sub.prop === "prop_boxes",
    laptop: sub.prop === "prop_laptop",
    backpack: sub.back === "back_backpack",
    cap: sub.headwear === "headwear_cap",
    hardhat: sub.headwear === "headwear_hardhat",
  };
}

export function resolveSkinPalette(avatar: Partial<AgentAvatarConfig>): SkinPalette {
  const key = avatar.skin && SKIN_PALETTES[avatar.skin]
    ? avatar.skin
    : isFemaleAvatar(avatar)
    ? "peach"
    : "tan";
  return SKIN_PALETTES[key] || SKIN_PALETTES.peach;
}

export function resolveHairId(avatar: Partial<AgentAvatarConfig>): string {
  return normalizeAvatarComposition(avatar).hair;
}

export function resolveHairPalette(avatar: Partial<AgentAvatarConfig>): { key: string; palette: HairPalette } {
  const key = avatar.hairColor && HAIR_PALETTES[avatar.hairColor]
    ? avatar.hairColor
    : isFemaleAvatar(avatar)
    ? "dark_brown"
    : "black";
  return { key, palette: HAIR_PALETTES[key] || HAIR_PALETTES.dark_brown };
}
