/**
 * ZAI Avatar Engine 2.0 — Deterministic Slot-to-GLB Mapping & Plan Resolver.
 * Guarantees strict slot isolation across Hair, Face/Morphs, SkinTone, HairColor,
 * FacialHair, UpperBody, LowerBody, Footwear, Accessory sub-slots, Uniform, Style & Animations.
 */

import type { AgentAvatarConfig, AnimationState } from "../../AvatarDefinition";
import { HAIR_PALETTES, SKIN_PALETTES, isFemaleAvatar } from "../../avatarLook";
import { resolveAvatarLook3D, type AvatarLook3D } from "../look3d";
import {
  normalizeAvatarComposition,
  type FacialHairStyle,
  type PoseId,
} from "../slotCatalog";
import { resolveAnimStateFromProps, type AvatarAnimState, type Movement3D } from "../animationStateMachine";

export type GLBAnimationClipName =
  | "Idle"
  | "Walk"
  | "Celebrating"
  | "Interact"
  | "Wave"
  | "Thinking"
  | "Typing"
  | "Pose_Executive"
  | "Pose_Consultative"
  | "Pose_Peace"
  | "Pose_Hero";

export interface GLBMorphWeights {
  expr_smile: number;
  expr_open_smile: number;
  expr_smirk: number;
  expr_focused: number;
  expr_blink: number;
  expr_wink: number;
  expr_talk_a: number;
  expr_talk_o: number;
}

export interface GLBMaterialPalette {
  skinHex: string;
  blushHex: string;
  lipHex: string;
  irisHex: string;
  hairHex: string;
  hairAccentHex: string;
  facialHairHex: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  innerHex: string;
}

export interface GLBCompositionPlan {
  gender: "female" | "male";
  skinTone: string;
  hairId: string;
  hairNode: string | null;
  headNode: "Head_Female" | "Head_Male";
  facialHairStyle: FacialHairStyle;
  facialHairNode: string | null;
  upperId: string;
  upperNode: string;
  limbsNode: "Arms_Skin_Short" | "Arms_Skin_Short_Peace" | "Hands_Skin_Only" | "Hands_Skin_Only_Peace";
  usePeaceRightHand: boolean;
  lowerId: string;
  lowerNode: string;
  bareLegsNode: "Legs_Skin_Bare" | null;
  footwearId: string;
  shoeNode: string;
  accessories: {
    eyewear: string | null;
    headwear: string | null;
    headset: string | null;
    badge: string | null;
    wrist: string | null;
    prop: string | null;
    back: string | null;
  };
  morphWeights: GLBMorphWeights;
  palette: GLBMaterialPalette;
  animState: AvatarAnimState;
  poseId: PoseId;
  clipName: GLBAnimationClipName;
  isSpeaking: boolean;
  isSleeping: boolean;
  spin360: boolean;
}

const HAIR_BUILDER_TO_GLB_FEMALE: Record<string, string> = {
  ponytail: "Hair_ponytail",
  bob: "Hair_bob",
  long: "Hair_long",
  bun: "Hair_bun",
  short: "Hair_short",
  afro: "Hair_afro",
  long_bangs: "Hair_long_bangs",
  spiky: "Hair_spiky",
  curly: "Hair_curly",
  cyber_wave: "Hair_cyber_wave",
  layered_long: "Hair_layered_long",
  glamour_waves: "Hair_glamour_waves",
  long_tucked: "Hair_long_tucked",
  tactical_crop: "Hair_tactical_crop",
  anime_spiky: "Hair_anime_spiky",
  medium_side: "Hair_medium_side",
  urban_flame: "Hair_urban_flame",
  slick_back: "Hair_slick_back",
};

const HAIR_BUILDER_TO_GLB_MALE_OVERRIDE: Record<string, string> = {
  ponytail: "Hair_short",
  bob: "Hair_medium_side",
  long: "Hair_short",
  bun: "Hair_tactical_crop",
  long_bangs: "Hair_medium_side",
  cyber_wave: "Hair_spiky",
  layered_long: "Hair_tactical_crop",
  glamour_waves: "Hair_slick_back",
  long_tucked: "Hair_tactical_crop",
};

const UPPER_BUILDER_TO_GLB: Record<string, { node: string; shortSleeve: boolean }> = {
  polo: { node: "Upper_polo", shortSleeve: true },
  shirt: { node: "Upper_shirt", shortSleeve: false },
  hoodie: { node: "Upper_hoodie", shortSleeve: false },
  jacket: { node: "Upper_blazer", shortSleeve: false },
  blazer: { node: "Upper_blazer", shortSleeve: false },
  tee: { node: "Upper_tee", shortSleeve: true },
  bomber: { node: "Upper_bomber", shortSleeve: false },
  vest: { node: "Upper_vest", shortSleeve: true },
  uniform: { node: "Upper_uniform_jacket", shortSleeve: false },
};

const LOWER_BUILDER_TO_GLB: Record<string, { node: string; bareLegs: boolean }> = {
  chinos: { node: "Lower_chinos", bareLegs: false },
  slacks: { node: "Lower_slacks", bareLegs: false },
  cargo: { node: "Lower_cargo", bareLegs: false },
  skirt_exec: { node: "Lower_skirt_exec", bareLegs: true },
  jogger: { node: "Lower_jogger", bareLegs: false },
};

const SHOE_BUILDER_TO_GLB: Record<string, string> = {
  sneaker: "Shoe_sneaker",
  oxford: "Shoe_oxford",
  boot: "Shoe_boot",
  safety: "Shoe_safety",
  minimal: "Shoe_minimal",
};

const FACE_TO_MORPHS: Record<string, Partial<GLBMorphWeights>> = {
  face_01: { expr_smile: 0.72 },
  face_02: { expr_smirk: 0.85 },
  face_03: { expr_wink: 0.92, expr_smile: 0.45 },
  face_04: { expr_open_smile: 0.82 },
  face_05: { expr_smile: 0.25 },
  face_06: { expr_focused: 0.82 },
  face_07: { expr_smile: 0.40, expr_smirk: 0.30 },
  face_08: { expr_smirk: 0.68, expr_smile: 0.32 },
};

export function resolveClipForState(animState: AvatarAnimState, poseId: PoseId): GLBAnimationClipName {
  switch (animState) {
    case "walk":
      return "Walk";
    case "wave":
      return "Wave";
    case "thinking":
      return "Thinking";
    case "typing":
      return "Typing";
    case "celebrating":
      return "Celebrating";
    case "pose":
      if (poseId === "pose_consultative") return "Pose_Consultative";
      if (poseId === "pose_peace") return "Pose_Peace";
      if (poseId === "pose_hero") return "Pose_Hero";
      return "Pose_Executive";
    case "attending":
    case "error":
    case "disconnected":
    case "idle":
    default:
      return "Idle";
  }
}

export function resolveGLBCompositionPlan(
  avatar: Partial<AgentAvatarConfig> | null | undefined,
  options?: {
    brandColor?: string;
    movement3D?: Movement3D;
    operationalState?: AnimationState | string;
    poseId?: PoseId;
    spinContinuous?: boolean;
  },
): GLBCompositionPlan {
  const safeAvatar = avatar || {};
  const comp = normalizeAvatarComposition(safeAvatar);
  const look: AvatarLook3D = resolveAvatarLook3D(comp, options?.brandColor);
  const female = isFemaleAvatar(comp) && comp.body !== "male";
  const gender: "female" | "male" = female ? "female" : "male";

  const headNode: "Head_Female" | "Head_Male" = gender === "female" ? "Head_Female" : "Head_Male";

  // Hair resolution (respects gender override while preserving exact slot ID & hidesTopHair under headwear)
  let hairNode: string | null = null;
  if (comp.hair !== "none" && comp.body !== "robot") {
    if (look.headwear !== "none") {
      hairNode = "Hair_under_cap";
    } else {
      const builder = look.hairStyle || "ponytail";
      if (gender === "male" && HAIR_BUILDER_TO_GLB_MALE_OVERRIDE[builder]) {
        hairNode = HAIR_BUILDER_TO_GLB_MALE_OVERRIDE[builder];
      } else {
        hairNode = HAIR_BUILDER_TO_GLB_FEMALE[builder] || (gender === "female" ? "Hair_bob" : "Hair_short");
      }
    }
  }

  // Facial hair
  const fhStyle: FacialHairStyle = comp.facialHair || "none";
  const facialHairNode = fhStyle !== "none" ? `FacialHair_${fhStyle}` : null;

  // Wardrobe slots
  const upperSpec = UPPER_BUILDER_TO_GLB[look.outfit.kind] || UPPER_BUILDER_TO_GLB.polo;
  const lowerSpec = LOWER_BUILDER_TO_GLB[look.lowerBody.kind] || LOWER_BUILDER_TO_GLB.chinos;
  const shoeNode = SHOE_BUILDER_TO_GLB[look.footwear.kind] || "Shoe_sneaker";

  // Pose & Animation state
  const movement = options?.movement3D ?? safeAvatar.movement3D ?? "idle";
  const opState = options?.operationalState ?? safeAvatar.animationState;
  const poseId: PoseId = options?.poseId || comp.poseId || "pose_executive";
  const animState = resolveAnimStateFromProps(movement, opState);
  const clipName = resolveClipForState(animState, poseId);

  const isPeacePose = animState === "pose" && poseId === "pose_peace";
  const limbsNode: GLBCompositionPlan["limbsNode"] = upperSpec.shortSleeve
    ? (isPeacePose ? "Arms_Skin_Short_Peace" : "Arms_Skin_Short")
    : (isPeacePose ? "Hands_Skin_Only_Peace" : "Hands_Skin_Only");
  const stowsRightHandProp =
    animState === "wave" || animState === "thinking" || isPeacePose;

  // Sub-slot accessories
  const sub = comp.accessorySubSlots;
  let propNode: string | null = null;
  if (sub.prop && sub.prop !== "none") {
    const isRightHandProp = sub.prop === "prop_coffee" || sub.prop === "prop_smartphone";
    if (!stowsRightHandProp || !isRightHandProp) {
      propNode = `Acc_${sub.prop}`;
    }
  }

  const accessories = {
    eyewear: sub.eyewear !== "none" ? `Acc_${sub.eyewear}` : null,
    headwear: sub.headwear !== "none" ? `Acc_${sub.headwear}` : null,
    headset: sub.headset !== "none" ? `Acc_${sub.headset}` : null,
    badge: sub.badge !== "none" ? `Acc_${sub.badge}` : null,
    wrist: sub.wrist !== "none" ? `Acc_${sub.wrist}` : null,
    prop: propNode,
    back: sub.back !== "none" ? `Acc_${sub.back}` : null,
  };

  // Skin, Hair & Garment material palette
  const skinKey = comp.skin || (gender === "female" ? "peach" : "tan");
  const skinPal = SKIN_PALETTES[skinKey] || SKIN_PALETTES.peach;
  const hairKey = comp.hairColor || (gender === "female" ? "dark_brown" : "black");
  const hairPal = HAIR_PALETTES[hairKey] || HAIR_PALETTES.dark_brown;

  const baseMorph = FACE_TO_MORPHS[comp.face] || FACE_TO_MORPHS.face_01;
  const isSpeaking = animState === "attending";
  const isSleeping = animState === "disconnected";
  const morphWeights: GLBMorphWeights = {
    expr_smile: animState === "celebrating" ? 0.35 : (baseMorph.expr_smile ?? 0),
    expr_open_smile: animState === "celebrating" ? 0.90 : (baseMorph.expr_open_smile ?? 0),
    expr_smirk: baseMorph.expr_smirk ?? 0,
    expr_focused: animState === "thinking" || animState === "typing" ? 0.72 : (baseMorph.expr_focused ?? 0),
    expr_blink: isSleeping ? 0.95 : 0,
    expr_wink: animState === "celebrating" || isSleeping ? 0 : (baseMorph.expr_wink ?? 0),
    expr_talk_a: 0,
    expr_talk_o: 0,
  };

  return {
    gender,
    skinTone: skinKey,
    hairId: comp.hair,
    hairNode,
    headNode,
    facialHairStyle: fhStyle,
    facialHairNode,
    upperId: comp.upperBody,
    upperNode: upperSpec.node,
    limbsNode,
    usePeaceRightHand: isPeacePose,
    lowerId: comp.lowerBody,
    lowerNode: lowerSpec.node,
    bareLegsNode: lowerSpec.bareLegs ? "Legs_Skin_Bare" : null,
    footwearId: comp.footwear,
    shoeNode,
    accessories,
    morphWeights,
    palette: {
      skinHex: skinPal.base,
      blushHex: gender === "female" ? skinPal.blush : skinPal.highlight,
      lipHex: gender === "female" ? "#d67772" : "#aa6457",
      irisHex: look.iris || (gender === "female" ? "#5a321d" : "#2f1b10"),
      hairHex: hairPal.base,
      hairAccentHex: look.brand || hairPal.highlight,
      facialHairHex: hairPal.base,
      primaryHex: look.outfit.body,
      secondaryHex: look.lowerBody.color || "#0f172a",
      accentHex: look.outfit.trim || look.brand,
      innerHex: look.outfit.inner || "#f1f5f9",
    },
    animState,
    poseId,
    clipName,
    isSpeaking,
    isSleeping,
    spin360: Boolean(options?.spinContinuous || movement === "spin360"),
  };
}
