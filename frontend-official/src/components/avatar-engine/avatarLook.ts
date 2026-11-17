import type { AgentAvatarConfig } from "./AvatarDefinition";
import { resolveHairColorForHair } from "./AvatarDefinition";

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
  shirt_formal_blue: "outfit_02",
  tshirt_casual_dark: "outfit_03",
  hoodie_zai_black: "outfit_04",
  blazer_executive_dark: "outfit_05",
  vest_operations: "outfit_06",
  bomber_jacket_tech: "outfit_08",
};

export function resolveOutfitId(avatar: Partial<AgentAvatarConfig>): string {
  const raw = avatar.outfit || avatar.clothing || "outfit_01";
  return LEGACY_OUTFIT_MAP[raw] || raw || "outfit_01";
}

export function isFemaleAvatar(avatar: Partial<AgentAvatarConfig>): boolean {
  return !(avatar.body === "male" || avatar.base === "male");
}

function accessoryList(avatar: Partial<AgentAvatarConfig>): string[] {
  return Array.isArray(avatar.accessories) ? avatar.accessories : [];
}

function accessoryValue(avatar: Partial<AgentAvatarConfig>, key: string): string | undefined {
  const acc = avatar.accessories;
  return acc && typeof acc === "object" && !Array.isArray(acc) ? (acc as Record<string, string>)[key] : undefined;
}

export type AccessoryFlags = {
  headset: boolean;
  badge: boolean;
  glasses: boolean;
  sunglasses: boolean;
  tablet: boolean;
  watch: boolean;
  coffee: boolean;
  boxes: boolean;
  laptop: boolean;
  backpack: boolean;
  hardhat: boolean;
};

export function resolveAccessoryFlags(avatar: Partial<AgentAvatarConfig>): AccessoryFlags {
  const list = accessoryList(avatar);
  const has = (id: string) => list.includes(id);
  return {
    headset: avatar.headset === "headset_zai_green" || accessoryValue(avatar, "headset") === "headset_zai_green" || has("acc_02"),
    badge: avatar.badge !== false && (accessoryValue(avatar, "badge") === "badge_zai_lanyard" || has("acc_03")),
    glasses: avatar.glasses === "glasses_square_exec" || Boolean(avatar.glasses?.includes("glasses")) || accessoryValue(avatar, "glasses") === "glasses_square_exec" || has("acc_04"),
    sunglasses: avatar.glasses === "sunglasses_wayfarer" || accessoryValue(avatar, "glasses") === "sunglasses_wayfarer" || has("acc_07"),
    tablet: avatar.workObject === "tablet_zai" || has("acc_05"),
    watch: accessoryValue(avatar, "watch") === "watch_zai_smart" || has("acc_06"),
    coffee: avatar.workObject === "coffee_cup" || has("acc_08"),
    boxes: avatar.workObject === "boxes_delivery" || has("acc_09"),
    laptop: avatar.workObject === "laptop_zai" || has("acc_10"),
    backpack: has("acc_11"),
    hardhat: accessoryValue(avatar, "headwear") === "hardhat_zai_white" || has("acc_12"),
  };
}

export function resolveSkinPalette(avatar: Partial<AgentAvatarConfig>): SkinPalette {
  const key = avatar.skin || (avatar.face === "face_04" ? "tan" : avatar.face === "face_06" ? "bronze" : "peach");
  return SKIN_PALETTES[key] || SKIN_PALETTES.peach;
}

export function resolveHairId(avatar: Partial<AgentAvatarConfig>): string {
  return avatar.hair || (isFemaleAvatar(avatar) ? "hair_01" : "hair_05");
}

export function resolveHairPalette(avatar: Partial<AgentAvatarConfig>): { key: string; palette: HairPalette } {
  const key = resolveHairColorForHair(resolveHairId(avatar), avatar.hairColor, isFemaleAvatar(avatar));
  return { key, palette: HAIR_PALETTES[key] || HAIR_PALETTES.dark_brown };
}