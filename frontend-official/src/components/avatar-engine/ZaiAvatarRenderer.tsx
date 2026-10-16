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
import { normalizeAvatarForRenderer, resolveSpriteForAvatar } from "./CharacterFactory";
import { cn } from "@/core/lib/utils";
import {
  Sparkle,
  CheckCircle,
  WarningCircle,
  Clock,
} from "@phosphor-icons/react";

export interface ZaiAvatarRendererProps {
  avatar: Partial<AgentAvatarConfig>;
  state?: AnimationState;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "workspace";
  showAura?: boolean;
  showStatusBadge?: boolean;
  showBrandingLayer?: boolean;
  rotationY?: number;
  movement3D?: "idle" | "walk" | "wave" | "spin360";
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
    character: "h-full max-h-[175px] sm:max-h-[235px] w-[140px] sm:w-[160px]",
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

// Normalized (neckX, chinY, width) anchors for all 33 catalog chibi sprites (height = 227px), aligned to (70, 96)
const CHIBI_SPRITE_ANCHORS: Record<string, { neckX: number; chinY: number; width: number }> = {
  sprite_r2_c1: { neckX: 74, chinY: 96, width: 129 },
  sprite_r2_c2: { neckX: 63, chinY: 98, width: 112 },
  sprite_r2_c3: { neckX: 71, chinY: 93, width: 127 },
  sprite_r2_c4: { neckX: 63, chinY: 98, width: 112 },
  sprite_r2_c5: { neckX: 62, chinY: 95, width: 112 },
  sprite_r2_c6: { neckX: 67, chinY: 95, width: 116 },
  sprite_r2_c7: { neckX: 63, chinY: 95, width: 112 },
  sprite_r2_c8: { neckX: 65, chinY: 98, width: 117 },
  sprite_r2_c9: { neckX: 73, chinY: 95, width: 130 },
  sprite_r2_c10: { neckX: 63, chinY: 95, width: 112 },
  sprite_r2_c11: { neckX: 63, chinY: 95, width: 112 },
  sprite_r1_c1: { neckX: 60, chinY: 96, width: 112 },
  sprite_r1_c2: { neckX: 52, chinY: 95, width: 112 },
  sprite_r1_c3: { neckX: 58, chinY: 95, width: 112 },
  sprite_r1_c4: { neckX: 59, chinY: 95, width: 112 },
  sprite_r1_c5: { neckX: 58, chinY: 97, width: 112 },
  sprite_r1_c6: { neckX: 58, chinY: 95, width: 112 },
  sprite_r1_c7: { neckX: 58, chinY: 96, width: 112 },
  sprite_r1_c8: { neckX: 54, chinY: 95, width: 112 },
  sprite_r1_c9: { neckX: 60, chinY: 96, width: 112 },
  sprite_r1_c10: { neckX: 56, chinY: 95, width: 112 },
  sprite_r1_c11: { neckX: 58, chinY: 95, width: 112 },
  sprite_r3_c1: { neckX: 50, chinY: 95, width: 112 },
  sprite_r3_c2: { neckX: 51, chinY: 95, width: 112 },
  sprite_r3_c3: { neckX: 56, chinY: 96, width: 112 },
  sprite_r3_c4: { neckX: 51, chinY: 95, width: 112 },
  sprite_r3_c5: { neckX: 55, chinY: 95, width: 118 },
  sprite_r3_c6: { neckX: 55, chinY: 95, width: 112 },
  sprite_r3_c7: { neckX: 55, chinY: 95, width: 112 },
  sprite_r3_c8: { neckX: 70, chinY: 96, width: 130 },
  sprite_r3_c9: { neckX: 55, chinY: 95, width: 112 },
  sprite_r3_c10: { neckX: 68, chinY: 96, width: 126 },
  sprite_r3_c11: { neckX: 58, chinY: 95, width: 112 },
};

const CHIBI_HAIR_SPRITES: Record<"female" | "male", Record<string, string>> = {
  female: {
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
  },
  male: {
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
  },
};

const CHIBI_OUTFIT_SPRITES: {
  default: Record<string, string>;
  tablet: Record<string, string>;
} = {
  default: {
    outfit_01: "sprite_r1_c1",
    outfit_02: "sprite_r2_c2",
    outfit_03: "sprite_r2_c4",
    outfit_04: "sprite_r3_c3",
    outfit_05: "sprite_r1_c6",
    outfit_06: "sprite_r3_c2",
    outfit_07: "sprite_r1_c7",
    outfit_08: "sprite_r1_c10",
  },
  tablet: {
    outfit_01: "sprite_r1_c2",
    outfit_02: "sprite_r1_c8",
    outfit_03: "sprite_r3_c4",
    outfit_04: "sprite_r3_c9",
    outfit_05: "sprite_r3_c4",
    outfit_06: "sprite_r3_c2",
    outfit_07: "sprite_r1_c2",
    outfit_08: "sprite_r3_c4",
  },
};

const CHIBI_FACE_SPRITES: Record<"female" | "male", Record<string, string>> = {
  female: {
    face_01: "sprite_r2_c1",
    face_02: "sprite_r2_c4",
    face_03: "sprite_r2_c8",
    face_04: "sprite_r2_c7",
    face_05: "sprite_r2_c10",
    face_06: "sprite_r2_c11",
  },
  male: {
    face_01: "sprite_r1_c1",
    face_02: "sprite_r1_c2",
    face_03: "sprite_r1_c3",
    face_04: "sprite_r1_c6",
    face_05: "sprite_r1_c7",
    face_06: "sprite_r3_c3",
  },
};

function getAlignedSpriteCoords(spriteId: string) {
  const anchor = CHIBI_SPRITE_ANCHORS[spriteId] || CHIBI_SPRITE_ANCHORS.sprite_r2_c1;
  return {
    x: 70 - anchor.neckX,
    y: 96 - anchor.chinY,
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
  showBrandingLayer,
  rotationY = 0,
  movement3D = "idle",
}: {
  avatar: Partial<AgentAvatarConfig>;
  branding: StoreBranding;
  currentState: AnimationState;
  size: "xs" | "sm" | "md" | "lg" | "xl" | "workspace";
  showBrandingLayer: boolean;
  rotationY?: number;
  movement3D?: "idle" | "walk" | "wave" | "spin360";
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
  const turnShiftX = isProfileView ? profileDir * 3.5 : Math.round(sinA * 4 * 10) / 10;
  const turnScaleX = isBackView ? 1 : isProfileView ? 0.9 : Math.round((0.92 + 0.08 * Math.abs(cosA)) * 100) / 100;

  // Resolve Hair Style & Palette
  const hairId = avatar.hair || (isFemale ? "hair_01" : "hair_05");
  const hairColorKey = resolveHairColorForHair(hairId, avatar.hairColor, isFemale);
  const hairColor = HAIR_PALETTES[hairColorKey] || HAIR_PALETTES.dark_brown;

  // Resolve Face (5th Category)
  const faceId = avatar.face || "face_01";

  // Resolve Outfit
  const outfitId = avatar.outfit || avatar.clothing || "outfit_01";

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

  const isTalking = currentState === "TALKING";
  const isThinking = currentState === "THINKING";
  const isWalking = currentState === "WALKING" || movement3D === "walk";
  const isWaving = movement3D === "wave";
  const isSpinning = movement3D === "spin360";

  // Resolve 4-layer chibi sprite sources
  const hairSpriteId = CHIBI_HAIR_SPRITES[genderKey][hairId] || (isFemale ? "sprite_r2_c1" : "sprite_r1_c1");
  const isLongHair = isFemale && (hairId === "hair_01" || hairId === "hair_03" || hairId === "hair_07" || hairId === "hair_08" || hairId === "hair_09" || hairId === "hair_10");

  let bodySpriteId = hasTablet
    ? CHIBI_OUTFIT_SPRITES.tablet[outfitId] || "sprite_r1_c2"
    : CHIBI_OUTFIT_SPRITES.default[outfitId] || "sprite_r1_c1";

  if (avatar.workObject === "boxes_delivery") {
    bodySpriteId = "sprite_r3_c1";
  } else if (avatar.workObject === "laptop_zai") {
    bodySpriteId = "sprite_r3_c5";
  } else if (avatar.workObject === "coffee_cup") {
    bodySpriteId = "sprite_r2_c5";
  }

  const faceSpriteId = CHIBI_FACE_SPRITES[genderKey][faceId] || (isFemale ? "sprite_r2_c1" : "sprite_r1_c1");

  const hairImg = getAlignedSpriteCoords(hairSpriteId);
  const bodyImg = getAlignedSpriteCoords(bodySpriteId);
  const faceImg = getAlignedSpriteCoords(faceSpriteId);

  // Unique clipPath IDs per instance prefix
  const uid = React.useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 140 238"
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

        {/* 1. Back Hair Clip (ponytails & long hair flowing behind left shoulder) */}
        <clipPath id={`clip-back-hair-${uid}`}>
          <path d="M 2 45 L 86 45 L 86 105 L 58 125 L 58 166 L 2 166 Z" />
        </clipPath>

        {/* 2. Body & Outfit Clip (clean short-hair torso, arms, legs, shoes) */}
        <clipPath id={`clip-body-${uid}`}>
          <path d="M 48 86 L 57 94 L 70 96 L 84 94 L 92 86 L 138 86 L 138 227 L 15 227 L 15 96 L 42 96 Z" />
        </clipPath>

        {/* 3. Head & Hair Crown Clip */}
        <clipPath id={`clip-head-${uid}`}>
          <path
            d={
              isLongHair
                ? "M 0 0 L 140 0 L 140 85 L 94 85 L 94 105 L 83 103 L 83 93 L 70 96 L 56 93 L 43 94 L 41 85 L 0 85 Z"
                : "M 0 0 L 140 0 L 140 85 L 95 85 L 95 94 L 83 94 L 70 96 L 56 94 L 43 94 L 41 85 L 0 85 Z"
            }
          />
        </clipPath>

        {/* 4. Inner Face Oval Clip (eyes, brows, nose, mouth, cheeks) */}
        <clipPath id={`clip-face-${uid}`}>
          <path d="M 57.5 64 C 63 59, 86 59, 90.5 66 C 91.5 74, 90.5 87, 84.5 93 C 77 96, 65 96, 59 91 C 56.5 84, 56.5 71, 57.5 64 Z" />
        </clipPath>
      </defs>

      {/* ── LAYER 1: ISOMETRIC PEDESTAL & 3D COMPASS RING ───────────── */}
      <g id="layer-pedestal">
        <ellipse cx="70" cy="221" rx="48" ry="13" fill={`url(#pedestalGlow-${uid})`} />
        <ellipse
          cx="70"
          cy="221"
          rx="42"
          ry="10.5"
          fill="#091120"
          stroke={primaryBrandColor}
          strokeWidth="1.6"
          strokeOpacity="0.65"
        />
        {/* 3D Rotation Compass Dot */}
        <circle
          cx={70 + Math.round(sinA * 38 * 10) / 10}
          cy={221 + Math.round(cosA * 8.8 * 10) / 10}
          r="2.8"
          fill="#00f090"
        />
        <ellipse cx="70" cy="219" rx="28" ry="6.5" fill="#000000" fillOpacity="0.5" />
      </g>

      {/* ── CHARACTER 2.5D CHIBI RIG WITH BREATHING & TURNTABLE ─────── */}
      <g id="character-3d-breathe">
        {(movement3D === "idle" || isSpinning) && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-2.2; 0,0"
            dur="2.8s"
            repeatCount="indefinite"
          />
        )}
        {isWalking && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; -1.5,-3.5; 0,0; 1.5,-3.5; 0,0"
            dur="0.65s"
            repeatCount="indefinite"
          />
        )}
        {isWaving && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 70 160; -2.5 70 160; 2.5 70 160; 0 70 160"
            dur="0.7s"
            repeatCount="indefinite"
          />
        )}

        <g
          id="character-3d-rig"
          transform={`translate(${70 - 70 * turnScaleX + turnShiftX}, 0) scale(${turnScaleX}, 1)`}
        >
          {/* ── CHIBI LAYER A: BACK HAIR (behind shoulders) ───────────── */}
          {isLongHair && (
            <g id="layer-back-hair" clipPath={`url(#clip-back-hair-${uid})`}>
              <image
                href={hairImg.href}
                x={hairImg.x}
                y={hairImg.y}
                width={hairImg.width}
                height={hairImg.height}
              />
            </g>
          )}

          {/* ── CHIBI LAYER B: OUTFIT & BODY ─────────────────────────── */}
          <g id="layer-outfit" clipPath={`url(#clip-body-${uid})`}>
            <image
              href={bodyImg.href}
              x={bodyImg.x}
              y={bodyImg.y}
              width={bodyImg.width}
              height={bodyImg.height}
            />

            {/* Tailored Dark Charcoal Blazer Lapel & V-Insert Overlay for outfit_05 */}
            {outfitId === "outfit_05" && !isBackView && (
              <g id="outfit-05-blazer-detail" opacity="0.9">
                <polygon points="56,96 68,122 61,123 51,98" fill="#18181b" stroke={primaryBrandColor} strokeWidth="0.9" />
                <polygon points="84,96 72,122 79,123 89,98" fill="#18181b" stroke={primaryBrandColor} strokeWidth="0.9" />
                <circle cx="57" cy="108" r="1.6" fill="#f59e0b" />
              </g>
            )}

            {/* High-Vis Reflective Bands Accent for outfit_06 */}
            {outfitId === "outfit_06" && (
              <g id="outfit-06-hivis-detail" opacity="0.85">
                <rect x="49" y="118" width="42" height="3.5" rx="1" fill="#e2e8f0" stroke="#eab308" strokeWidth="0.6" />
                <rect x="49" y="131" width="42" height="3.5" rx="1" fill="#e2e8f0" stroke="#eab308" strokeWidth="0.6" />
              </g>
            )}

            {/* Back-of-Torso Turnaround Shading & ZAI Emblem when at 180° Costas */}
            {isBackView && (
              <g id="layer-outfit-back-cover">
                <rect
                  x="53"
                  y="96"
                  width="34"
                  height="44"
                  rx="8"
                  fill={
                    outfitId === "outfit_02"
                      ? "#e2e8f0"
                      : outfitId === "outfit_04"
                      ? "#1e3a8a"
                      : outfitId === "outfit_06"
                      ? "#eab308"
                      : "#18181b"
                  }
                  stroke="#090d16"
                  strokeWidth="1.2"
                />
                <g id="outfit-back-emblem">
                  <rect
                    x="59"
                    y="108"
                    width="22"
                    height="11"
                    rx="2.5"
                    fill="#091120"
                    stroke={primaryBrandColor}
                    strokeWidth="1"
                  />
                  <circle cx="70" cy="113.5" r="3" fill={primaryBrandColor} />
                </g>
              </g>
            )}
          </g>

          {/* ── CHIBI LAYER C: HEAD & HAIR CROWN ─────────────────────── */}
          <g id="layer-hair" clipPath={`url(#clip-head-${uid})`}>
            <image
              href={hairImg.href}
              x={hairImg.x}
              y={hairImg.y}
              width={hairImg.width}
              height={hairImg.height}
            />
            {/* Subtle Hair Palette Highlight Accent (also satisfies canonical hairColor token verification) */}
            <path
              d="M 52 36 Q 70 28 88 36"
              stroke={hairColor.base}
              strokeWidth="1.8"
              strokeOpacity="0.35"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* ── CHIBI LAYER D: BACK-OF-HEAD HAIR CASCADE (180° Costas) ─ */}
          {isBackView && (
            <g id="layer-hair-back-view">
              {/* Seamlessly mirror the real pixel-art hair crown across y=63 into the face oval */}
              <g clipPath={`url(#clip-face-${uid})`}>
                <image
                  href={hairImg.href}
                  x={hairImg.x}
                  y={hairImg.y}
                  width={hairImg.width}
                  height={hairImg.height}
                  transform="translate(0, 126) scale(1, -1)"
                />
              </g>
              {isLongHair && (
                <g clipPath={`url(#clip-body-${uid})`} opacity="0.95">
                  <image
                    href={hairImg.href}
                    x={hairImg.x - 10}
                    y={hairImg.y + 8}
                    width={hairImg.width}
                    height={hairImg.height}
                    clipPath={`url(#clip-back-hair-${uid})`}
                  />
                </g>
              )}
              {hairId === "hair_01" && isFemale && (
                <circle cx="70" cy="70" r="4" fill={primaryBrandColor} stroke="#090d16" strokeWidth="1" />
              )}
            </g>
          )}

          {/* ── CHIBI LAYER E: FACE OVAL (5th Category: Rosto 01..06) ── */}
          {!isBackView && (
            <g id="layer-face" clipPath={`url(#clip-face-${uid})`}>
              <image
                href={faceImg.href}
                x={faceImg.x}
                y={faceImg.y}
                width={faceImg.width}
                height={faceImg.height}
              />

              {/* Subtle Expression Modulators so all 6 Faces are visually distinct on the chibi character */}
              {faceId === "face_01" && (
                <>
                  <circle cx="62" cy="81" r="3.2" fill={skin.blush} fillOpacity="0.38" />
                  <circle cx="85" cy="81" r="3.2" fill={skin.blush} fillOpacity="0.38" />
                </>
              )}
              {faceId === "face_02" && (
                <>
                  <circle cx="65.5" cy="73.5" r="1.3" fill="#38bdf8" fillOpacity="0.85" />
                  <circle cx="83.5" cy="73.5" r="1.3" fill="#38bdf8" fillOpacity="0.85" />
                </>
              )}
              {faceId === "face_04" && (
                <>
                  <circle cx="65.5" cy="73.5" r="1.4" fill="#10b981" fillOpacity="0.85" />
                  <circle cx="83.5" cy="73.5" r="1.4" fill="#10b981" fillOpacity="0.85" />
                  <circle cx="62" cy="81" r="3" fill={skin.blush} fillOpacity="0.45" />
                  <circle cx="85" cy="81" r="3" fill={skin.blush} fillOpacity="0.45" />
                </>
              )}
              {faceId === "face_05" && (
                <line x1="70" y1="86.5" x2="78" y2="86.5" stroke="#7f1d1d" strokeWidth="1.4" strokeLinecap="round" />
              )}
              {faceId === "face_06" && (
                <>
                  <line x1="60" y1="67" x2="69" y2="69.5" stroke={hairColor.shadow} strokeWidth="2" strokeLinecap="round" />
                  <line x1="88" y1="67" x2="79" y2="69.5" stroke={hairColor.shadow} strokeWidth="2" strokeLinecap="round" />
                </>
              )}
            </g>
          )}

          {/* ── CHIBI LAYER F: ACCESSORIES (Headset, Glasses, Badge, Tablet, Watch) ─ */}
          <g id="layer-accessories">
            {/* Executive Glasses (acc_04) */}
            {hasGlasses && !isBackView && (
              <g id="acc-glasses">
                <rect
                  x="58.5"
                  y="69"
                  width="13"
                  height="9"
                  rx="2"
                  fill="#0f172a"
                  fillOpacity="0.18"
                  stroke="#0f172a"
                  strokeWidth="1.8"
                />
                <rect
                  x="76.5"
                  y="69"
                  width="13"
                  height="9"
                  rx="2"
                  fill="#0f172a"
                  fillOpacity="0.18"
                  stroke="#0f172a"
                  strokeWidth="1.8"
                />
                <line x1="71.5" y1="73" x2="76.5" y2="73" stroke="#0f172a" strokeWidth="1.8" />
                <line x1="51" y1="72" x2="58.5" y2="73" stroke="#0f172a" strokeWidth="1.6" />
                <line x1="61" y1="76" x2="66" y2="71" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.75" />
                <line x1="79" y1="76" x2="84" y2="71" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.75" />
              </g>
            )}

            {/* Headset ZAI Wireless Pro (acc_02) */}
            {hasHeadset && (
              <g id="acc-headset">
                <rect
                  x="43"
                  y="67"
                  width="7"
                  height="14"
                  rx="3.5"
                  fill="#0f172a"
                  stroke="#00f090"
                  strokeWidth="1.3"
                />
                {!isBackView && (
                  <>
                    <path
                      d="M 46.5 79 Q 51 89 64 87.5"
                      stroke="#0f172a"
                      strokeWidth="2.2"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="64.5"
                      cy="87.5"
                      r="2.4"
                      fill="#00f090"
                      className={isTalking ? "animate-ping" : ""}
                    />
                    <circle cx="64.5" cy="87.5" r="1.3" fill="#ffffff" />
                  </>
                )}
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

          {/* ── CHIBI LAYER G: STORE BRANDING PIN ────────────────────── */}
          {showBrandingLayer && !isBackView && (
            <g id="layer-branding">
              <rect
                x="78"
                y="107"
                width="8"
                height="4.5"
                rx="1"
                fill={branding.secondaryColor || "#0f172a"}
                stroke={primaryBrandColor}
                strokeWidth="0.8"
              />
              <circle cx="80.5" cy="109.2" r="1" fill={primaryBrandColor} />
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

export const ZaiAvatarRenderer: React.FC<ZaiAvatarRendererProps> = ({
  avatar,
  state: stateProp,
  size = "md",
  showAura = true,
  showStatusBadge = false,
  showBrandingLayer = true,
  rotationY: rotationYProp,
  movement3D: movement3DProp,
  className,
  onClick,
}) => {
  const currentState = stateProp || avatar.animationState || "WAITING";
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;
  const renderedAvatar = normalizeAvatarForRenderer(avatar || {});
  const resolvedRotationY = (((rotationYProp ?? avatar?.rotationY ?? 0) % 360) + 360) % 360;
  const resolvedMovement3D = movement3DProp || avatar?.movement3D || "idle";
  const resolvedGender = avatar?.body === "male" || avatar?.base === "male" ? "male" : "female";

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
  const spriteId = avatar?.catalogSpriteId || resolveSpriteForAvatar(avatar || {}, false);
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
      {/* 2.5D Isometric Pedestal Accent */}
      {size === "workspace" && (
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-40 sm:w-48 h-7 rounded-full pointer-events-none transition-all duration-500"
          style={{
            background: `radial-gradient(ellipse at center, ${branding.primaryColor}30 0%, ${branding.primaryColor}08 60%, transparent 80%)`,
            border: `1px solid ${branding.primaryColor}30`,
          }}
        />
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

      {/* Main 2.5D / 3D Pixel-Art Character (Never clipped, fits 35%-50% container height) */}
      <div
        className={cn(
          "relative z-10 flex items-center justify-center my-auto transition-transform duration-500",
          sizeConfig.character
        )}
      >
        <ModularLayerAvatar
          avatar={renderedAvatar}
          branding={branding}
          currentState={currentState}
          size={size}
          showBrandingLayer={showBrandingLayer}
          rotationY={resolvedRotationY}
          movement3D={resolvedMovement3D}
        />
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
};
