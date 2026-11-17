import type { AgentAvatarConfig } from "../AvatarDefinition";
import {
  isFemaleAvatar,
  resolveAccessoryFlags,
  resolveHairId,
  resolveHairPalette,
  resolveOutfitId,
  resolveSkinPalette,
  type AccessoryFlags,
} from "../avatarLook";

export type HairStyle3D =
  | "ponytail" | "bob" | "long" | "long_bangs" | "bun" | "short" | "afro"
  | "spiky" | "curly" | "slick_back" | "medium_side";

export type Headwear3D = "none" | "cap" | "hardhat";

export type Expression3D = "smile" | "confident" | "wink" | "open_smile" | "calm" | "focused";

const FACE_EXPRESSIONS: Record<string, Expression3D> = {
  face_01: "smile",
  face_02: "confident",
  face_03: "wink",
  face_04: "open_smile",
  face_05: "calm",
  face_06: "focused",
  face_07: "smile",
  face_08: "smile",
};

export type OutfitKind3D =
  | "polo" | "shirt" | "hoodie" | "uniform" | "jacket" | "vest" | "tee" | "bomber";

export type Outfit3D = {
  kind: OutfitKind3D;
  body: string;
  trim: string;
  inner?: string;
  longSleeves: boolean;
};

export type AvatarLook3D = {
  female: boolean;
  skin: string;
  blush: string;
  hairStyle: HairStyle3D;
  hairColor: string;
  hairHighlight: string;
  beard: boolean;
  expression: Expression3D;
  iris: string;
  headwear: Headwear3D;
  outfit: Outfit3D;
  accessories: AccessoryFlags;
  brand: string;
};

const HAIR_STYLES: Record<string, { style: HairStyle3D; headwear?: Headwear3D; beard?: boolean; glasses?: boolean }> = {
  hair_01: { style: "ponytail" },
  hair_02: { style: "bob" },
  hair_03: { style: "long" },
  hair_04: { style: "bun" },
  hair_05: { style: "short" },
  hair_06: { style: "afro" },
  hair_07: { style: "long_bangs" },
  hair_08: { style: "spiky" },
  hair_09: { style: "curly" },
  hair_10: { style: "long" },
  hair_11: { style: "long", headwear: "cap" },
  hair_12: { style: "long" },
  hair_13: { style: "long", headwear: "hardhat" },
  hair_14: { style: "short", headwear: "cap" },
  hair_15: { style: "spiky" },
  hair_16: { style: "medium_side", beard: true },
  hair_17: { style: "spiky" },
  hair_18: { style: "slick_back", glasses: true },
};

const ZAI_GREEN = "#10b981";

const OUTFITS: Record<string, Outfit3D> = {
  outfit_01: { kind: "polo", body: "#18181b", trim: ZAI_GREEN, longSleeves: false },
  outfit_02: { kind: "shirt", body: "#f8fafc", trim: "#1e293b", longSleeves: true },
  outfit_03: { kind: "hoodie", body: "#111827", trim: ZAI_GREEN, longSleeves: true },
  outfit_04: { kind: "uniform", body: "#1e3a5f", trim: "#94a3b8", longSleeves: true },
  outfit_05: { kind: "jacket", body: "#111827", trim: ZAI_GREEN, inner: "#f8fafc", longSleeves: true },
  outfit_06: { kind: "vest", body: "#facc15", trim: "#e2e8f0", inner: "#1f2937", longSleeves: false },
  outfit_07: { kind: "tee", body: "#111827", trim: ZAI_GREEN, longSleeves: false },
  outfit_08: { kind: "bomber", body: "#0f172a", trim: ZAI_GREEN, longSleeves: true },
  outfit_09: { kind: "polo", body: "#059669", trim: "#064e3b", longSleeves: false },
  outfit_10: { kind: "uniform", body: "#475569", trim: "#f97316", longSleeves: true },
};

export function resolveAvatarLook3D(avatar: Partial<AgentAvatarConfig>, brandColor?: string): AvatarLook3D {
  const female = isFemaleAvatar(avatar);
  const skin = resolveSkinPalette(avatar);
  const hairId = resolveHairId(avatar);
  const hair = HAIR_STYLES[hairId] || HAIR_STYLES[female ? "hair_01" : "hair_05"];
  const { palette } = resolveHairPalette(avatar);
  const accessories = resolveAccessoryFlags(avatar);
  if (hair.glasses) accessories.glasses = true;
  if (avatar.face === "face_07") accessories.glasses = true;
  if (avatar.face === "face_08") accessories.sunglasses = true;
  if (accessories.sunglasses) accessories.glasses = false;
  const headwear: Headwear3D = accessories.hardhat ? "hardhat" : hair.headwear || "none";
  return {
    female,
    skin: skin.base,
    blush: skin.blush,
    hairStyle: hair.style,
    hairColor: palette.base,
    hairHighlight: palette.highlight,
    beard: Boolean(hair.beard || avatar.facialHair && avatar.facialHair !== "none" || avatar.face === "face_07"),
    expression: FACE_EXPRESSIONS[avatar.face || ""] || "smile",
    iris: female ? "#5b3420" : "#3b2416",
    headwear,
    outfit: OUTFITS[resolveOutfitId(avatar)] || OUTFITS.outfit_01,
    accessories: { ...accessories, hardhat: headwear === "hardhat" },
    brand: brandColor || avatar.branding?.primaryColor || ZAI_GREEN,
  };
}