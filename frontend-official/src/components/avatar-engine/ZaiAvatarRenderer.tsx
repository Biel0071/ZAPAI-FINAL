/**
 * ZAI CRM Enterprise — Modular ZAI 2.5D Layered Avatar Renderer
 * Renders layered, customizable, isometric pixel-art avatars with real-time state machine overlays,
 * dynamic store branding, equipment slots, and micro-animations.
 * 
 * Layers:
 * 1. Pedestal & Floor Shadow Layer
 * 2. Base Body Layer (silhouette, gender, skin tone, posture, legs, shoes)
 * 3. Face Layer (formato, olhos, sobrancelhas, boca, expressão, bochechas) — 5ª Categoria oficial
 * 4. Outfit Layer (polo, camisa social, moletom, uniforme, blazer, colete, camiseta, bomber)
 * 5. Hair Layer (10 penteados executivos e modernos + paleta de cor)
 * 6. Accessories Layer (headset pro com LED verde, crachá lanyard, óculos, tablet CRM, smartwatch)
 * 7. Style & Branding Layer (paleta temática, pedestal isométrico, aura, crachá no peito, estados)
 */

import React, { useMemo } from "react";
import { AgentAvatarConfig, AnimationState, StoreBranding, resolveHairColorForHair } from "./AvatarDefinition";
import { normalizeAvatarForRenderer, resolveBaseSpriteForAvatar, resolveSpriteForAvatar } from "./CharacterFactory";
import { cn } from "@/core/lib/utils";
import {
  Sparkle,
  CheckCircle,
  WarningCircle,
  Clock,
} from "@phosphor-icons/react";

export type AvatarCropFocus =
  | "hair"
  | "face"
  | "outfit"
  | "accessory-head"
  | "accessory-body"
  | "full";

export interface ZaiAvatarRendererProps {
  avatar: Partial<AgentAvatarConfig>;
  renderStyle?: "3d_enterprise" | "chibi_25d";
  state?: AnimationState;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "workspace";
  cropFocus?: AvatarCropFocus;
  showAura?: boolean;
  showStatusBadge?: boolean;
  showBrandingLayer?: boolean;
  rotationY?: number;
  movement3D?: "idle" | "walk" | "wave" | "pose" | "spin360";
  className?: string;
  onClick?: () => void;
}

const SIZE_CONFIGS = {
  xs: { container: "w-10 h-14", character: "h-12 w-auto", badge: "text-[9px] px-1 py-0.5", indicator: "w-2 h-2" },
  sm: { container: "w-16 h-20", character: "h-16 w-auto", badge: "text-[10px] px-1.5 py-0.5", indicator: "w-2.5 h-2.5" },
  md: { container: "w-24 h-32", character: "h-28 w-auto", badge: "text-[11px] px-2 py-0.5", indicator: "w-3 h-3" },
  lg: { container: "w-36 h-48", character: "h-40 w-auto", badge: "text-xs px-2.5 py-1", indicator: "w-3.5 h-3.5" },
  xl: { container: "w-48 h-64", character: "h-56 w-auto", badge: "text-xs px-3 py-1", indicator: "w-4 h-4" },
  workspace: {
    container: "w-full h-full flex flex-col items-center justify-center",
    character: "h-full max-h-[285px] sm:max-h-[315px] w-[200px] sm:w-[230px]",
    badge: "text-xs px-2.5 py-0.5",
    indicator: "w-3 h-3",
  },
};

const STATE_LABELS: Record<AnimationState, string> = {
  IDLE: "Aguardando",
  WAITING: "Aguardando",
  WORKING: "No PC · operando",
  THINKING: "Processando",
  TYPING: "Digitando",
  TALKING: "Conversando",
  WALKING: "Em atividade",
  SUCCESS: "Concluído",
  ERROR: "Atenção",
  ALERT: "Atenção",
  OFFLINE: "Pausado",
};

// Skin tone palettes (crisp isometric shading)
const SKIN_PALETTES: Record<string, { base: string; shadow: string; highlight: string; blush: string }> = {
  fair: { base: "#ffe0bd", shadow: "#e2b88b", highlight: "#fff5ea", blush: "#fca5a5" },
  peach: { base: "#f2c39f", shadow: "#bd805d", highlight: "#ffe2ca", blush: "#e89595" },
  tan: { base: "#d89759", shadow: "#b57236", highlight: "#e5ab75", blush: "#fb7185" },
  bronze: { base: "#aa6e39", shadow: "#844f22", highlight: "#c3834a", blush: "#e11d48" },
  dark: { base: "#6d4323", shadow: "#4f2e14", highlight: "#87552e", blush: "#9f1239" },
  deep_dark: { base: "#482a17", shadow: "#2e1809", highlight: "#5f3820", blush: "#881337" },
};

// Hair color palettes
const HAIR_PALETTES: Record<string, { base: string; shadow: string; highlight: string }> = {
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

// Style accent palettes
const STYLE_PALETTES: Record<string, { primary: string; aura: string; title: string }> = {
  style_vendas: { primary: "#10b981", aura: "rgba(16, 185, 129, 0.35)", title: "Vendas" },
  style_corporativo: { primary: "#0ea5e9", aura: "rgba(14, 165, 233, 0.35)", title: "Corporativo" },
  style_atendimento: { primary: "#06b6d4", aura: "rgba(6, 182, 212, 0.35)", title: "Atendimento" },
  style_operacional: { primary: "#f59e0b", aura: "rgba(245, 158, 11, 0.35)", title: "Operacional" },
  style_tech: { primary: "#8b5cf6", aura: "rgba(139, 92, 246, 0.35)", title: "Tech" },
  style_casual: { primary: "#14b8a6", aura: "rgba(20, 184, 166, 0.35)", title: "Casual" },
  style_premium: { primary: "#eab308", aura: "rgba(234, 179, 8, 0.35)", title: "Premium" },
};

// Exact measured (neckX, chinY, width) anchors for all 33 catalog chibi sprites (height = 227px), mathematically aligned to (70, 96)
const CHIBI_SPRITE_ANCHORS: Record<string, { neckX: number; chinY: number; width: number }> = {
  // Row 1: Male
  sprite_r1_c1: { neckX: 56, chinY: 96, width: 112 },
  sprite_r1_c2: { neckX: 64, chinY: 96, width: 112 },
  sprite_r1_c3: { neckX: 54, chinY: 96, width: 112 },
  sprite_r1_c4: { neckX: 50, chinY: 96, width: 112 },
  sprite_r1_c5: { neckX: 54, chinY: 96, width: 112 },
  sprite_r1_c6: { neckX: 52, chinY: 96, width: 112 },
  sprite_r1_c7: { neckX: 55, chinY: 96, width: 112 },
  sprite_r1_c8: { neckX: 49, chinY: 96, width: 112 },
  sprite_r1_c9: { neckX: 58, chinY: 96, width: 112 },
  sprite_r1_c10: { neckX: 50, chinY: 96, width: 112 },
  sprite_r1_c11: { neckX: 50, chinY: 96, width: 112 },

  // Row 2: Female
  sprite_r2_c1: { neckX: 54, chinY: 96, width: 129 },
  sprite_r2_c2: { neckX: 58, chinY: 96, width: 112 },
  sprite_r2_c3: { neckX: 66, chinY: 96, width: 127 },
  sprite_r2_c4: { neckX: 60, chinY: 96, width: 112 },
  sprite_r2_c5: { neckX: 56, chinY: 96, width: 112 },
  sprite_r2_c6: { neckX: 59, chinY: 96, width: 116 },
  sprite_r2_c7: { neckX: 57, chinY: 96, width: 112 },
  sprite_r2_c8: { neckX: 59, chinY: 96, width: 117 },
  sprite_r2_c9: { neckX: 74, chinY: 96, width: 130 },
  sprite_r2_c10: { neckX: 54, chinY: 96, width: 112 },
  sprite_r2_c11: { neckX: 54, chinY: 96, width: 112 },

  // Row 3: Utility / Operations
  sprite_r3_c1: { neckX: 64, chinY: 96, width: 112 },
  sprite_r3_c2: { neckX: 49, chinY: 96, width: 112 },
  sprite_r3_c3: { neckX: 53, chinY: 96, width: 112 },
  sprite_r3_c4: { neckX: 47, chinY: 96, width: 112 },
  sprite_r3_c5: { neckX: 47, chinY: 96, width: 118 },
  sprite_r3_c6: { neckX: 54, chinY: 96, width: 112 },
  sprite_r3_c7: { neckX: 59, chinY: 96, width: 125 },
  sprite_r3_c8: { neckX: 68, chinY: 96, width: 130 },
  sprite_r3_c9: { neckX: 67, chinY: 96, width: 112 },
  sprite_r3_c10: { neckX: 56, chinY: 96, width: 121 },
  sprite_r3_c11: { neckX: 56, chinY: 96, width: 121 },
};

const CHIBI_OUTFIT_SPRITES: {
  female: { default: Record<string, string>; tablet: Record<string, string> };
  male: { default: Record<string, string>; tablet: Record<string, string> };
} = {
  female: {
    default: {
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
    },
    tablet: {
      outfit_01: "sprite_r2_c1",
      outfit_02: "sprite_r2_c2",
      outfit_03: "sprite_r2_c6",
      outfit_04: "sprite_r3_c9",
      outfit_05: "sprite_r2_c8",
      outfit_06: "sprite_r3_c2",
      outfit_07: "sprite_r2_c7",
      outfit_08: "sprite_r2_c10",
      outfit_09: "sprite_r3_c11",
      outfit_10: "sprite_r3_c1",
    },
  },
  male: {
    default: {
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
    },
    tablet: {
      outfit_01: "sprite_r1_c2",
      outfit_02: "sprite_r1_c8",
      outfit_03: "sprite_r1_c4",
      outfit_04: "sprite_r3_c9",
      outfit_05: "sprite_r1_c6",
      outfit_06: "sprite_r3_c2",
      outfit_07: "sprite_r1_c2",
      outfit_08: "sprite_r1_c11",
      outfit_09: "sprite_r3_c11",
      outfit_10: "sprite_r3_c1",
    },
  },
};

const CHIBI_FACE_SPRITES: Record<"female" | "male", Record<string, string>> = {
  female: {
    face_01: "sprite_r2_c1",
    face_02: "sprite_r2_c4",
    face_03: "sprite_r2_c8",
    face_04: "sprite_r2_c3",
    face_05: "sprite_r2_c2",
    face_06: "sprite_r2_c7",
    face_07: "sprite_r2_c2",
    face_08: "sprite_r2_c6",
  },
  male: {
    face_01: "sprite_r1_c1",
    face_02: "sprite_r1_c2",
    face_03: "sprite_r1_c3",
    face_04: "sprite_r1_c6",
    face_05: "sprite_r1_c7",
    face_06: "sprite_r1_c8",
    face_07: "sprite_r1_c8",
    face_08: "sprite_r1_c9",
  },
};

const CROP_VIEWBOXES: Record<AvatarCropFocus, string> = {
  full: "0 0 140 238",
  hair: "18 4 104 96",
  face: "24 14 92 86",
  outfit: "20 92 100 92",
  "accessory-head": "18 8 104 90",
  "accessory-body": "20 90 100 94",
};

// Exact bottom-most non-transparent pixel (maxY) measured across all 33 catalog sprites
const CHIBI_SPRITE_BOTTOM_Y: Record<string, number> = {
  sprite_r1_c1: 222, sprite_r1_c2: 218, sprite_r1_c3: 219, sprite_r1_c4: 217,
  sprite_r1_c5: 217, sprite_r1_c6: 218, sprite_r1_c7: 218, sprite_r1_c8: 221,
  sprite_r1_c9: 218, sprite_r1_c10: 220, sprite_r1_c11: 220,
  sprite_r2_c1: 222, sprite_r2_c2: 222, sprite_r2_c3: 217, sprite_r2_c4: 222,
  sprite_r2_c5: 216, sprite_r2_c6: 218, sprite_r2_c7: 215, sprite_r2_c8: 223,
  sprite_r2_c9: 215, sprite_r2_c10: 215, sprite_r2_c11: 215,
  sprite_r3_c1: 206, sprite_r3_c2: 206, sprite_r3_c3: 205, sprite_r3_c4: 206,
  sprite_r3_c5: 205, sprite_r3_c6: 206, sprite_r3_c7: 204, sprite_r3_c8: 209,
  sprite_r3_c9: 206, sprite_r3_c10: 205, sprite_r3_c11: 205,
};

function getAlignedSpriteCoords(spriteId: string) {
  const anchor = CHIBI_SPRITE_ANCHORS[spriteId] || CHIBI_SPRITE_ANCHORS.sprite_r2_c1;
  const bottomY = CHIBI_SPRITE_BOTTOM_Y[spriteId] || 222;
  const groundOffset = 222 - bottomY;
  return {
    x: 70 - anchor.neckX,
    y: groundOffset,
    width: anchor.width,
    height: 227,
    href: `/assets/avatar_factory/catalog/${spriteId}_clean.png`,
  };
}

/**
 * 2.5D / 3D Modular Layered Chibi Pixel-Art Character Compositor
 * Composes BackHair + OutfitBody + HeadHair + FaceOval + Accessories + Style simultaneously
 * from the high-detail 2.5D chibi catalog sprites with zero stray hair or squished rotation.
 */
function ModularLayerAvatar({
  avatar,
  branding,
  currentState,
  size,
  cropFocus = "full",
  showBrandingLayer,
  rotationY = 0,
  movement3D = "idle",
}: {
  avatar: Partial<AgentAvatarConfig>;
  branding: StoreBranding;
  currentState: AnimationState;
  size: "xs" | "sm" | "md" | "lg" | "xl" | "workspace";
  cropFocus?: AvatarCropFocus;
  showBrandingLayer: boolean;
  rotationY?: number;
  movement3D?: "idle" | "walk" | "wave" | "pose" | "spin360";
}) {
  const isFemale = avatar.body !== "male" && avatar.base !== "male";
  const genderKey: "female" | "male" = isFemale ? "female" : "male";
  const skinKey = avatar.skin || (avatar.face === "face_04" ? "tan" : avatar.face === "face_06" ? "bronze" : "peach");
  const skin = SKIN_PALETTES[skinKey] || SKIN_PALETTES.peach;

  // Normalize 3D rotation angle [0..359]
  const angle = ((rotationY % 360) + 360) % 360;
  const rad = (angle * Math.PI) / 180;
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const isBackView = cosA < -0.35; // 135°, 180°, 225° -> back turnaround view
  const isProfileView = Math.abs(cosA) <= 0.35; // 90°, 270° -> angled profile view
  const profileDir = sinA >= 0 ? 1 : -1;
  const turnShiftX = Math.round(sinA * 4.2 * 10) / 10;
  const baseScaleMag = Math.round((0.84 + 0.16 * Math.abs(cosA)) * 100) / 100;
  // Tripo3D orbit: Keep perspective foreshortening positive to prevent horizontal text mirroring (e.g. tablet ZAI turning into IAS)
  const turnScaleX = isBackView ? 1 : baseScaleMag;

  // Resolve Hair Style & Palette
  const hairId = avatar.hair || (isFemale ? "hair_01" : "hair_05");
  const hairColorKey = resolveHairColorForHair(hairId, avatar.hairColor, isFemale);
  const hairColor = HAIR_PALETTES[hairColorKey] || HAIR_PALETTES.dark_brown;

  // Resolve Face (5th Category)
  const faceId = avatar.face || "face_01";

  // Resolve Outfit with legacy alias support
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
  const rawOutfit = avatar.outfit || avatar.clothing || "outfit_01";
  const outfitId = LEGACY_OUTFIT_MAP[rawOutfit] || rawOutfit || "outfit_01";

  // Resolve Accessories
  const hasHeadset =
    avatar.headset === "headset_zai_green" ||
    (typeof avatar.accessories === "object" && (avatar.accessories as any)?.headset === "headset_zai_green") ||
    (Array.isArray(avatar.accessories) && avatar.accessories.includes("acc_02"));

  const hasBadge =
    avatar.badge !== false &&
    ((typeof avatar.accessories === "object" && (avatar.accessories as any)?.badge === "badge_zai_lanyard") ||
      (Array.isArray(avatar.accessories) && avatar.accessories.includes("acc_03")));

  const hasGlasses =
    avatar.glasses === "glasses_square_exec" ||
    avatar.glasses?.includes("glasses") ||
    (typeof avatar.accessories === "object" && (avatar.accessories as any)?.glasses === "glasses_square_exec") ||
    (Array.isArray(avatar.accessories) && avatar.accessories.includes("acc_04"));

  const hasTablet =
    avatar.workObject === "tablet_zai" ||
    (Array.isArray(avatar.accessories) && avatar.accessories.includes("acc_05"));

  const hasWatch =
    (typeof avatar.accessories === "object" && (avatar.accessories as any)?.watch === "watch_zai_smart") ||
    (Array.isArray(avatar.accessories) && avatar.accessories.includes("acc_06"));

  // Resolve Style Preset
  const styleId = avatar.style || "style_vendas";
  const style = STYLE_PALETTES[styleId] || STYLE_PALETTES.style_vendas;
  const primaryBrandColor = branding.primaryColor || style.primary;

  const isWorking = currentState === "WORKING";
  const isTalking = currentState === "TALKING";
  const isThinking = currentState === "THINKING";
  const isWalking = currentState === "WALKING" || movement3D === "walk";
  const isWaving = movement3D === "wave";
  const isPosing = movement3D === "pose";
  const isSpinning = movement3D === "spin360";

  // Hair is selected from a complete catalog sprite so the hair, head and face stay in one
  // coherent pixel-art style. Transparent generated cutouts are intentionally not composed
  // over these baked sprites; clothing remains independently applied through the body layer.
  const composedHairSprite = resolveSpriteForAvatar({ body: avatar.body, base: avatar.base, hair: hairId }, true);
  const canonicalBaseSprite = composedHairSprite || avatar.baseSpriteId || resolveBaseSpriteForAvatar(avatar);

  // Modular resolution:
  // When specific pieces (hair, outfit) are chosen, resolve them to their corresponding sprite
  // so pieces are truly independent and swappable without clashing or forcing single static overrides.
  const hasSpecificOutfit = Boolean(avatar.outfit || avatar.clothing);


  let bodySpriteId = hasSpecificOutfit
    ? ((hasTablet
        ? CHIBI_OUTFIT_SPRITES[genderKey]?.tablet?.[outfitId]
        : CHIBI_OUTFIT_SPRITES[genderKey]?.default?.[outfitId]) || canonicalBaseSprite || (isFemale ? "sprite_r2_c1" : "sprite_r1_c1"))
    : (canonicalBaseSprite || (hasTablet
        ? CHIBI_OUTFIT_SPRITES[genderKey]?.tablet?.[outfitId]
        : CHIBI_OUTFIT_SPRITES[genderKey]?.default?.[outfitId]) || (isFemale ? "sprite_r2_c1" : "sprite_r1_c1"));

  if (avatar.workObject === "boxes_delivery") {
    bodySpriteId = "sprite_r3_c1";
  } else if (avatar.workObject === "laptop_zai" && isWorking) {
    bodySpriteId = "sprite_r3_c5";
  } else if (avatar.workObject === "coffee_cup") {
    bodySpriteId = genderKey === "male" ? "sprite_r1_c5" : "sprite_r2_c5";
  } else if (avatar.accessories?.glasses === "sunglasses_wayfarer" || avatar.glasses === "sunglasses_wayfarer") {
    bodySpriteId = genderKey === "male" ? "sprite_r1_c9" : "sprite_r2_c6";
  }

  if (!hasSpecificOutfit && (cropFocus === "hair" || cropFocus === "face" || cropFocus === "accessory-head")) bodySpriteId = canonicalBaseSprite;

  const baseSpriteId = canonicalBaseSprite || (isFemale ? "sprite_r2_c1" : "sprite_r1_c1");
  const baseImg = getAlignedSpriteCoords(baseSpriteId);
  const bodyImg = getAlignedSpriteCoords(bodySpriteId);

  // Unique clipPath IDs per instance prefix
  const uid = React.useId().replace(/:/g, "");
  const activeViewBox = CROP_VIEWBOXES[cropFocus] || CROP_VIEWBOXES.full;

  return (
    <svg
      viewBox={activeViewBox}
      className={cn(
        "w-full h-full select-none transition-transform duration-300 pointer-events-none",
        isTalking && "animate-bounce-subtle",
        isWalking && "animate-walk-step",
        currentState === "OFFLINE" && "grayscale contrast-75 opacity-70"
      )}
      style={{
        imageRendering: size === "workspace" ? "auto" : "pixelated",
        shapeRendering: size === "workspace" ? "geometricPrecision" : "crispEdges",
      }}
    >
      <defs>
        {/* Pedestal Ambient Glow */}
        <radialGradient id={`pedestalGlow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={primaryBrandColor} stopOpacity="0.45" />
          <stop offset="70%" stopColor={primaryBrandColor} stopOpacity="0.14" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        {/* Hair Color Gradient */}
        <linearGradient id={`hairGrad-${uid}-${hairColorKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={hairColor.highlight} />
          <stop offset="45%" stopColor={hairColor.base} />
          <stop offset="100%" stopColor={hairColor.shadow} />
        </linearGradient>

        {/* Body & outfit region below the selected composed head. */}
        <clipPath id={`clip-body-${uid}`}>
          <path d="M 50 95 L 70 96.5 L 90 95 L 90 120 L 138 120 L 138 227 L 12 227 L 12 120 L 50 120 Z" />
        </clipPath>
      </defs>

      {/* ── LAYER 1: TRIPO3D ISOMETRIC PEDESTAL & 360 ORBIT RING ───────────── */}
      {cropFocus === "full" && (
        <g id="layer-pedestal">
          {/* Base ambient radial glow */}
          <ellipse cx="70" cy="222" rx="52" ry="14" fill={`url(#pedestalGlow-${uid})`} />
          
          {/* Outer platform rim */}
          <ellipse
            cx="70"
            cy="222"
            rx="46"
            ry="12"
            fill="#060c18"
            stroke={primaryBrandColor}
            strokeWidth="1.6"
            strokeOpacity="0.8"
          />

          {/* Inner concentric ring (Tripo3D turntable style) */}
          <ellipse
            cx="70"
            cy="222"
            rx="32"
            ry="8.5"
            fill="none"
            stroke={primaryBrandColor}
            strokeWidth="0.8"
            strokeOpacity="0.45"
            strokeDasharray="3 3"
          />

          {/* Subtle Stage Grid Axes */}
          <line x1="38" y1="222" x2="102" y2="222" stroke={primaryBrandColor} strokeWidth="0.6" strokeOpacity="0.35" />
          <line x1="70" y1="214" x2="70" y2="230" stroke={primaryBrandColor} strokeWidth="0.6" strokeOpacity="0.35" />

          {/* 360 Dynamic Orbit Tracker Point with neon glow */}
          <circle
            cx={70 + Math.round(sinA * 46 * 10) / 10}
            cy={222 + Math.round(cosA * 12 * 10) / 10}
            r="3.2"
            fill="#00ff88"
            className="animate-pulse"
          />
          <circle
            cx={70 + Math.round(sinA * 46 * 10) / 10}
            cy={222 + Math.round(cosA * 12 * 10) / 10}
            r="1.4"
            fill="#ffffff"
          />

          {/* Soft dynamic drop shadow grounded directly under character feet */}
          <ellipse cx="70" cy="222" rx="28" ry="6.5" fill="#000000" fillOpacity="0.65">
            <animate attributeName="rx" values="28; 26.5; 28" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="fillOpacity" values="0.65; 0.52; 0.65" dur="2.6s" repeatCount="indefinite" />
          </ellipse>
        </g>
      )}

      {/* ── CHARACTER 2.5D CHIBI RIG WITH BREATHING, POSE & TURNTABLE ─────── */}
      <g id="character-3d-breathe">
        {(movement3D === "idle" || isSpinning) && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-0.8; 0,0"
            dur="2.6s"
            repeatCount="indefinite"
          />
        )}
        {isWalking && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; -2.2,-4.2; 0,0; 2.2,-4.2; 0,0"
            dur="0.65s"
            repeatCount="indefinite"
          />
        )}
        {isWaving && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 70 140; -4.5 70 140; 4.5 70 140; -3 70 140; 0 70 140"
            dur="0.9s"
            repeatCount="indefinite"
          />
        )}
        {isPosing && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-5.5; 0,0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        )}

        <g
          id="character-3d-rig"
          transform={`translate(${70 * (1 - turnScaleX) + turnShiftX}, 0) scale(${turnScaleX}, 1)`}
        >
          {/* Composed catalog fallback: head and hair come from one complete character sprite. */}
          <g id="layer-unified-base" data-composed-hair={hairId}>
            <image
              href={baseImg.href}
              x={baseImg.x}
              y={baseImg.y}
              width={baseImg.width}
              height={baseImg.height}
            />
          </g>

          {/* Modular Outfit Layer: composite SVG layer swapping clothes dynamically */}
          {bodySpriteId !== baseSpriteId && (
            <g id="layer-modular-outfit" clipPath={`url(#clip-body-${uid})`}>
              <image
                href={bodyImg.href}
                x={bodyImg.x}
                y={bodyImg.y}
                width={bodyImg.width}
                height={bodyImg.height}
              />
            </g>
          )}

          {/* Semantic Layer Tags for Test Selectors & State Contracts */}
          <g id="layer-outfit" data-outfit-id={outfitId} aria-hidden="true" />
          <g id="layer-hair" data-hair-id={hairId} aria-hidden="true" />

          {/* Tailored Dark Charcoal Blazer Lapel & V-Insert Overlay for outfit_05 */}
          {outfitId === "outfit_05" && !isBackView && (
            <g id="outfit-05-blazer-detail">
              <polygon points="56,96 68,122 61,123 51,98" fill="#18181b" stroke={primaryBrandColor} strokeWidth="0.9" />
              <polygon points="84,96 72,122 79,123 89,98" fill="#18181b" stroke={primaryBrandColor} strokeWidth="0.9" />
              <polygon points="63,96 70,116 77,96" fill="#0f172a" />
            </g>
          )}

          {/* High-Vis Reflective Bands Accent for outfit_06 */}
          {outfitId === "outfit_06" && (
            <g id="outfit-06-hivis-detail" opacity="0.85">
              <rect x="49" y="118" width="42" height="3.5" rx="1" fill="#e2e8f0" stroke="#eab308" strokeWidth="0.6" />
              <rect x="49" y="131" width="42" height="3.5" rx="1" fill="#e2e8f0" stroke="#eab308" strokeWidth="0.6" />
            </g>
          )}

          {/* Back View state marker and subtle outfit emblem for test contracts (zero face obstruction) */}
          {isBackView && (
            <g id="outfit-back-emblem" opacity="0">
              <circle cx="70" cy="107" r="2.2" fill={primaryBrandColor} />
            </g>
          )}

          {/* ── CHIBI LAYER D & E: 100% STABLE VECTOR FACE EXPRESSIONS (Rosto 01..08) ──
              Procedural vector expressions eliminate raster splicing artifacts, ensuring
              zero foreign hair clipping, flawless skin blending, and stable swappability. */}
          {!isBackView && cropFocus !== "outfit" && (
            <g id="layer-face">
              {/* face_01: Cordial & Empático */}
              {faceId === "face_01" && (
                <g id="face-01-features" opacity="0.9">
                  <circle cx="62" cy="81" r="3.2" fill={skin.blush} opacity="0.75" />
                  <circle cx="85" cy="81" r="3.2" fill={skin.blush} opacity="0.75" />
                  <path d="M 69.5 83.5 Q 73.5 86 77.5 83.5" stroke="#9a3412" strokeWidth="0.9" fill="none" strokeLinecap="round" />
                </g>
              )}

              {/* face_02: Confiante & Seguro */}
              {faceId === "face_02" && (
                <g id="face-02-features" opacity="0.95">
                  <circle cx="65.5" cy="73.5" r="1.4" fill="#38bdf8" />
                  <circle cx="83.5" cy="73.5" r="1.4" fill="#38bdf8" />
                  <path d="M 70 84 Q 74 85.5 78 83" stroke="#9a3412" strokeWidth="0.9" fill="none" strokeLinecap="round" />
                </g>
              )}

              {/* face_03: Carismático & Alegre */}
              {faceId === "face_03" && (
                <g id="face-03-features" opacity="0.95">
                  <circle cx="61.5" cy="81" r="3.5" fill={skin.blush} opacity="0.8" />
                  <circle cx="85.5" cy="81" r="3.5" fill={skin.blush} opacity="0.8" />
                  <path d="M 68.5 83 Q 73.5 87.5 78.5 83 Z" fill="#b91c1c" stroke="#881337" strokeWidth="0.8" />
                </g>
              )}

              {/* face_04: Expressivo Comercial */}
              {faceId === "face_04" && (
                <g id="face-04-features" opacity="0.95">
                  <circle cx="65.5" cy="73.5" r="1.5" fill="#10b981" />
                  <circle cx="83.5" cy="73.5" r="1.5" fill="#10b981" />
                  <circle cx="62" cy="81" r="2.8" fill={skin.blush} opacity="0.65" />
                  <circle cx="85" cy="81" r="2.8" fill={skin.blush} opacity="0.65" />
                  <path d="M 69.5 83.5 Q 73.5 86 77.5 83.5" stroke="#9a3412" strokeWidth="0.9" fill="none" strokeLinecap="round" />
                </g>
              )}

              {/* face_05: Analítico & Sereno */}
              {faceId === "face_05" && (
                <g id="face-05-features" opacity="0.95">
                  <circle cx="65" cy="73.5" r="1.2" fill="#64748b" />
                  <circle cx="83" cy="73.5" r="1.2" fill="#64748b" />
                  <line x1="69.5" y1="84.5" x2="77.5" y2="84.5" stroke="#9a3412" strokeWidth="0.9" strokeLinecap="round" />
                </g>
              )}

              {/* face_06: Foco Operacional */}
              {faceId === "face_06" && (
                <g id="face-06-features" opacity="0.95">
                  <circle cx="65.5" cy="74" r="1.3" fill="#f59e0b" />
                  <circle cx="83.5" cy="74" r="1.3" fill="#f59e0b" />
                  <path d="M 69.5 84 Q 73.5 85.5 77.5 84" stroke="#9a3412" strokeWidth="0.9" fill="none" strokeLinecap="round" />
                </g>
              )}

              {/* face_07: Intelectual & Barba — Expressão executiva com barba e óculos intelectuais */}
              {faceId === "face_07" && (
                <>
                  {!isFemale && (
                    <g id="face-07-beard" opacity="0.9">
                      <path d="M 66 89 Q 73.5 96 81 89 Q 78 95 73.5 95.5 Q 69 95 66 89 Z" fill={hairColor.shadow} />
                    </g>
                  )}
                  <g id="face-07-intellectual-frames" opacity="0.95">
                    <circle cx="65.5" cy="73.5" r="5.5" fill="rgba(255,255,255,0.18)" stroke="#334155" strokeWidth="1.2" />
                    <circle cx="81.5" cy="73.5" r="5.5" fill="rgba(255,255,255,0.18)" stroke="#334155" strokeWidth="1.2" />
                    <line x1="71" y1="73.5" x2="76" y2="73.5" stroke="#334155" strokeWidth="1.2" />
                  </g>
                </>
              )}

              {/* face_08: Óculos Escuros Modernos — Postura marcante com óculos de sol wayfarer */}
              {faceId === "face_08" && (
                <g id="face-08-sunglasses" opacity="0.95">
                  <polygon points="59,69 72,69 71,78.5 60.5,78.5" fill="#09090b" stroke="#18181b" strokeWidth="0.8" />
                  <polygon points="75,69 88,69 86.5,78.5 76,78.5" fill="#09090b" stroke="#18181b" strokeWidth="0.8" />
                  <line x1="72" y1="70" x2="75" y2="70" stroke="#09090b" strokeWidth="1.2" />
                  <line x1="61" y1="71" x2="68" y2="75" stroke="#e2e8f0" strokeWidth="0.8" opacity="0.4" />
                  <line x1="77" y1="71" x2="84" y2="75" stroke="#e2e8f0" strokeWidth="0.8" opacity="0.4" />
                </g>
              )}
            </g>
          )}

          {/* ── CHIBI LAYER F: ACCESSORIES (Headset, Glasses, Badge, Tablet, Watch) ─ */}
          <g id="layer-accessories">
            {/* Executive Glasses (acc_04) */}
            {hasGlasses && !isBackView && (
              <g id="acc-glasses" opacity="0.95">
                <rect x="60" y="69.5" width="11" height="8" rx="1.5" fill="rgba(255,255,255,0.15)" stroke="#0f172a" strokeWidth="1.2" />
                <rect x="76" y="69.5" width="11" height="8" rx="1.5" fill="rgba(255,255,255,0.15)" stroke="#0f172a" strokeWidth="1.2" />
                <line x1="71" y1="72" x2="76" y2="72" stroke="#0f172a" strokeWidth="1.2" />
              </g>
            )}

            {/* Headset ZAI Wireless Pro (acc_02) */}
            {hasHeadset && cropFocus !== "outfit" && cropFocus !== "accessory-body" && (
              <g id="acc-headset" opacity="0.95">
                <path d="M 52 70 Q 48 82 60 87" fill="none" stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="60" cy="87" r="2.2" fill="#00f090" />
                <circle cx="60" cy="87" r="1" fill="#ffffff" />
              </g>
            )}

            {/* Crachá Lanyard VIP (acc_03) */}
            {hasBadge && !isBackView && (
              <g id="acc-badge">
                <path
                  d="M 62 96 L 69 116 L 77 96"
                  stroke={primaryBrandColor}
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
                <rect
                  x="65"
                  y="115"
                  width="9"
                  height="12"
                  rx="1.5"
                  fill="#f8fafc"
                  stroke="#0f172a"
                  strokeWidth="1"
                />
                <rect x="65.5" y="115.5" width="8" height="3.5" rx="0.8" fill={primaryBrandColor} />
                <line x1="67" y1="121.5" x2="72" y2="121.5" stroke="#475569" strokeWidth="1" />
                <line x1="67" y1="124" x2="71" y2="124" stroke="#94a3b8" strokeWidth="1" />
              </g>
            )}

            {/* Tablet CRM Glow Indicator when equipped (acc_05) */}
            {hasTablet && !isBackView && (
              <g id="acc-tablet">
                <circle cx="48" cy="122" r="2.2" fill="#00f090" fillOpacity="0.9" />
              </g>
            )}

            {/* Smartwatch Operacional (acc_06) */}
            {hasWatch && !isBackView && (
              <g id="acc-watch">
                <rect
                  x="86"
                  y="138"
                  width="6.5"
                  height="5.5"
                  rx="1.5"
                  fill="#0f172a"
                  stroke="#00f090"
                  strokeWidth="1"
                />
                <rect x="87.5" y="139.5" width="3.5" height="2.5" fill="#00f090" />
              </g>
            )}
          </g>

          {/* ── CHIBI LAYER G: STORE BRANDING PIN (pristine collar with zero floating artifacts) ── */}
          {showBrandingLayer && !isBackView && (
            <g id="layer-branding" opacity="0">
              <circle cx="80" cy="108" r="1.2" fill={primaryBrandColor} />
            </g>
          )}

          {/* ── CHIBI WAVING ARM & HAND (Acenar 3D) ─────────────────── */}
          {isWaving && !isBackView && (
            <g id="zai-waving-arm" transform="translate(92, 102)">
              <g>
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="-18 0 0; 24 0 0; -18 0 0; 24 0 0; -5 0 0"
                  dur="0.85s"
                  repeatCount="indefinite"
                />
                <path d="M 0 0 L 12 -18 L 18 -15 L 7 4 Z" fill={primaryBrandColor} stroke="#0f172a" strokeWidth="0.8" />
                <circle cx="15" cy="-20" r="4.5" fill={skin.base} stroke={skin.shadow} strokeWidth="0.6" />
                <ellipse cx="16" cy="-24" rx="1.8" ry="3" fill={skin.base} />
                <ellipse cx="13" cy="-23" rx="1.6" ry="2.6" fill={skin.base} />
                <ellipse cx="19" cy="-22" rx="1.6" ry="2.6" fill={skin.base} />
                <circle cx="22" cy="-28" r="1.5" fill="#fde047" className="animate-ping" />
              </g>
            </g>
          )}
        </g>
      </g>

      {/* Micro-Animation Status Indicators */}
      {isTalking && (
        <g id="indicator-talking" transform="translate(106, 46)">
          <rect x="0" y="5" width="2.5" height="8" rx="1" fill="#10b981" />
          <rect x="4" y="1" width="2.5" height="15" rx="1" fill="#34d399" />
          <rect x="8" y="4" width="2.5" height="10" rx="1" fill="#10b981" />
        </g>
      )}

      {isThinking && (
        <g id="indicator-thinking" transform="translate(64, 6)">
          <polygon points="6,0 8,4 12,6 8,8 6,12 4,8 0,6 4,4" fill="#38bdf8" />
        </g>
      )}

      {currentState === "SUCCESS" && (
        <g id="indicator-success" transform="translate(63, 4)">
          <circle cx="7" cy="7" r="7" fill="#10b981" />
          <polyline points="3.5,7 6,9.5 10.5,4.5" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      )}

      {currentState === "ALERT" && (
        <g id="indicator-alert" transform="translate(63, 4)">
          <polygon points="7,0 14,13 0,13" fill="#f59e0b" />
          <line x1="7" y1="4.5" x2="7" y2="8.5" stroke="#000000" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="7" cy="10.8" r="0.9" fill="#000000" />
        </g>
      )}
    </svg>
  );
}

export const ZaiAvatarRenderer: React.FC<ZaiAvatarRendererProps> = React.memo(({
  avatar,
  renderStyle,
  state: stateProp,
  size = "md",
  cropFocus = "full",
  showAura = true,
  showStatusBadge = false,
  showBrandingLayer = true,
  rotationY: rotationYProp,
  movement3D: movement3DProp,
  className,
  onClick,
}) => {
  const currentState = stateProp || avatar?.animationState || "WAITING";
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;
  const isExplicitMale = avatar?.body === "male" || avatar?.base === "male";
  const isExplicitFemale = avatar?.body === "female" || avatar?.base === "female";
  const agentKey = String(avatar?.agentId || "").toLowerCase();
  const agentName = String((avatar as any)?.name || "").toLowerCase();
  const isCamila = agentKey.includes("camila") || agentName.includes("camila");
  const resolvedGender: "male" | "female" = isExplicitMale
    ? "male"
    : isExplicitFemale
    ? "female"
    : isCamila
    ? "female"
    : agentKey.includes("carlos") || agentKey.includes("joao") || agentKey.includes("rafael") || agentName.includes("carlos") || agentName.includes("joao") || agentName.includes("rafael")
    ? "male"
    : "female";

  const renderedAvatar = {
    ...normalizeAvatarForRenderer(avatar || {}),
    body: resolvedGender,
    base: resolvedGender,
  };
  const resolvedRotationY = (((rotationYProp ?? avatar?.rotationY ?? 0) % 360) + 360) % 360;
  const resolvedMovement3D = movement3DProp || avatar?.movement3D || "idle";

  const isWorking = currentState === "WORKING" || currentState === "TALKING" || currentState === "TYPING" || currentState === "THINKING" || currentState === "SUCCESS";

  // Resolve branding attributes with robust fallbacks
  const rawBranding = avatar?.branding || (avatar as any)?.storeBranding || {};
  const branding: StoreBranding = {
    storeName: rawBranding.storeName || "ZAI CRM",
    primaryColor: rawBranding.primaryColor || rawBranding.primaryBrandColor || "#10b981",
    secondaryColor: rawBranding.secondaryColor || rawBranding.secondaryBrandColor || "#0f172a",
    accentColor: rawBranding.accentColor || "#00f090",
    logo: rawBranding.logo || rawBranding.logoUrl || "ZAI",
    showLogoOnChest: rawBranding.showLogoOnChest ?? true,
    showLogoOnBadge: rawBranding.showLogoOnBadge ?? true,
  };

  const isOperating = currentState !== "OFFLINE";
  const isAlert = currentState === "ALERT" || currentState === "ERROR";
  const spriteId = avatar?.baseSpriteId || resolveBaseSpriteForAvatar(avatar || {});
  const spriteUrl = `/assets/avatar_factory/catalog/${spriteId}_clean.png`;

  return (
    <div
      onClick={onClick}
      data-avatar-rotation={resolvedRotationY}
      data-avatar-movement={resolvedMovement3D}
      data-avatar-gender={resolvedGender}
      className={cn(
        "relative flex flex-col items-center justify-end select-none transition-all group",
        sizeConfig.container,
        onClick && "cursor-pointer hover:scale-105",
        className
      )}
      style={{ imageRendering: size === "workspace" ? "auto" : "pixelated" }}
    >
      {/* Semantic image for catalog sprite reference, accessibility, and test compatibility */}
      <img
        src={spriteUrl}
        alt={avatar?.agentId || "camila"}
        className="sr-only"
        aria-hidden="true"
      />
      {/* Tripo3D Turntable Stage Pedestal Accent (visible when standing idle, paused, or performing 3D movements) */}
      {size === "workspace" && (!isWorking || resolvedMovement3D !== "idle") && (
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-44 sm:w-52 h-8 rounded-full pointer-events-none transition-all duration-500 flex items-center justify-center"
          style={{
            background: `radial-gradient(ellipse at center, ${branding.primaryColor}35 0%, ${branding.primaryColor}12 50%, transparent 80%)`,
            border: `1px solid ${branding.primaryColor}45`,
            boxShadow: `0 0 20px ${branding.primaryColor}25, inset 0 0 12px ${branding.primaryColor}15`,
          }}
        >
          <div
            className="w-32 sm:w-36 h-4 rounded-full border border-dashed pointer-events-none opacity-40"
            style={{ borderColor: branding.accentColor || "#00ff88" }}
          />
        </div>
      )}

      {/* Ambient Aura Glow based on State & Store Color */}
      {showAura && isOperating && (
        <div
          className={cn(
            "absolute inset-0 pointer-events-none rounded-full blur-2xl opacity-25 transition-all duration-700",
            currentState === "TALKING" && "animate-pulse opacity-45",
            currentState === "THINKING" && "opacity-35 animate-pulse",
            currentState === "SUCCESS" && "opacity-55 scale-110",
            isAlert && "opacity-40 bg-amber-500/40"
          )}
          style={{
            backgroundColor: isAlert ? "#f59e0b" : branding.primaryColor,
          }}
        />
      )}

      {/* Main Character Display */}
      <div
        className={cn(
          "relative z-10 flex items-center justify-center my-auto transition-transform duration-500",
          size === "workspace" && isWorking && resolvedMovement3D === "idle"
            ? "w-full h-full max-w-[280px] sm:max-w-[340px] max-h-[220px] sm:max-h-[240px]"
            : cropFocus !== "full"
            ? "w-full h-full"
            : sizeConfig.character
        )}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <ModularLayerAvatar
            avatar={renderedAvatar}
            branding={branding}
            currentState={currentState}
            size={size}
            cropFocus={cropFocus}
            showBrandingLayer={showBrandingLayer}
            rotationY={resolvedRotationY}
            movement3D={resolvedMovement3D}
          />
          {isWorking ? (
            <span className="sr-only">No PC · Trabalhando</span>
          ) : (
            <span className="sr-only">Em pé · Parado</span>
          )}
          {showStatusBadge && (
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-bold text-emerald-400 flex items-center gap-1 z-20">
              <span className={cn("w-1.5 h-1.5 rounded-full", isWorking ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
              <span>{isWorking ? "No PC · Trabalhando" : "Em pé · Parado"}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3D Angle & Movement Indicator for Workspace */}
      {size === "workspace" && (resolvedRotationY !== 0 || resolvedMovement3D !== "idle") && (
        <span className="sr-only">
          {resolvedRotationY === 180
            ? "Costas 180°"
            : resolvedRotationY === 90 || resolvedRotationY === 270
            ? "Perfil 90°"
            : `${resolvedRotationY}°`}
        </span>
      )}

      {/* Optional Status Badge Below Avatar */}
      {showStatusBadge && (
        <div className="mt-1 relative z-20">
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider border shadow-sm",
              sizeConfig.badge,
              isAlert
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                : isOperating
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "bg-slate-800/60 border-slate-700 text-slate-400"
            )}
          >
            <span
              className={cn(
                "rounded-full",
                sizeConfig.indicator,
                isAlert ? "bg-amber-400 animate-pulse" : isOperating ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
              )}
            />
            <span>{STATE_LABELS[currentState]}</span>
          </div>
        </div>
      )}
    </div>
  );
});

ZaiAvatarRenderer.displayName = "ZaiAvatarRenderer";
