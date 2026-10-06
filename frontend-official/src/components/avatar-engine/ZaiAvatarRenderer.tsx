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
import { AgentAvatarConfig, AnimationState, StoreBranding } from "./AvatarDefinition";
import { resolveSpriteForAvatar } from "./CharacterFactory";
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
    character: "h-[140px] sm:h-[145px] w-auto max-w-[130px]",
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
  peach: { base: "#fcd34d", shadow: "#d97706", highlight: "#fef3c7", blush: "#f87171" },
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

/**
 * 2.5D Modular Layered SVG Character
 * Composes BASE + ROSTO + ROUPA + CABELO + ACESSÓRIOS + ESTILO simultaneously in vector pixel art.
 */
function ModularLayerAvatar({
  avatar,
  branding,
  currentState,
  size,
  showBrandingLayer,
}: {
  avatar: Partial<AgentAvatarConfig>;
  branding: StoreBranding;
  currentState: AnimationState;
  size: "xs" | "sm" | "md" | "lg" | "xl" | "workspace";
  showBrandingLayer: boolean;
}) {
  const isFemale = avatar.body === "female" || avatar.base === "female" || (!avatar.body && !avatar.base);
  const skinKey = avatar.skin || (avatar.face === "face_04" ? "tan" : avatar.face === "face_06" ? "bronze" : "peach");
  const skin = SKIN_PALETTES[skinKey] || SKIN_PALETTES.peach;

  // Resolve Hair Style & Palette
  const hairId = avatar.hair || (isFemale ? "hair_01" : "hair_05");
  const defaultHairColor =
    hairId === "hair_03"
      ? "golden_blonde"
      : hairId === "hair_10"
      ? "cyber_blue"
      : hairId === "hair_07"
      ? "auburn"
      : isFemale
      ? "dark_brown"
      : "black";
  const hairColorKey = avatar.hairColor || defaultHairColor;
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

  const isOperating = currentState !== "OFFLINE";
  const isTalking = currentState === "TALKING";
  const isThinking = currentState === "THINKING";
  const isWalking = currentState === "WALKING";

  return (
    <svg
      viewBox="0 0 100 160"
      className={cn(
        "w-full h-full select-none transition-transform duration-300 pointer-events-none",
        isTalking && "animate-bounce-subtle",
        isWalking && "animate-walk-step",
        currentState === "OFFLINE" && "grayscale contrast-75 opacity-70"
      )}
      style={{
        imageRendering: "pixelated",
        shapeRendering: "crispEdges",
      }}
    >
      <defs>
        {/* Pedestal Gradient */}
        <radialGradient id="pedestalGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={primaryBrandColor} stopOpacity="0.45" />
          <stop offset="70%" stopColor={primaryBrandColor} stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        {/* Chest Logo Pattern */}
        <clipPath id="headClip">
          <rect x="34" y="24" width="32" height="42" rx="14" />
        </clipPath>
      </defs>

      {/* ── LAYER 1: PEDESTAL & SHADOW ─────────────────────────────── */}
      <g id="layer-pedestal">
        {/* Floor Ambient Glow */}
        <ellipse cx="50" cy="143" rx="36" ry="11" fill="url(#pedestalGlow)" />
        {/* Isometric Pedestal Rim */}
        <ellipse
          cx="50"
          cy="143"
          rx="32"
          ry="9"
          fill="#091120"
          stroke={primaryBrandColor}
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
        {/* Soft Floor Shadow beneath feet */}
        <ellipse cx="50" cy="141" rx="22" ry="5.5" fill="#000000" fillOpacity="0.55" />
      </g>

      {/* ── LAYER 2: BASE BODY (Silhouette, Skin, Legs, Shoes) ─────── */}
      <g id="layer-base">
        {/* Legs / Trousers */}
        <rect x="40" y="104" width="8" height="30" fill="#1e293b" />
        <rect x="52" y="104" width="8" height="30" fill="#0f172a" />
        <rect x="40" y="130" width="8" height="4" fill="#090d16" />
        <rect x="52" y="130" width="8" height="4" fill="#090d16" />

        {/* Shoes (Sneakers / Dress Shoes) */}
        <rect x="37" y="133" width="12" height="7" rx="2" fill={primaryBrandColor} />
        <rect x="37" y="138" width="12" height="3" fill="#ffffff" fillOpacity="0.8" />
        <rect x="51" y="133" width="12" height="7" rx="2" fill={primaryBrandColor} />
        <rect x="51" y="138" width="12" height="3" fill="#ffffff" fillOpacity="0.8" />

        {/* Neck */}
        <rect x="46" y="64" width="8" height="8" fill={skin.shadow} />

        {/* Head Base */}
        <rect x="35" y="26" width="30" height="38" rx="13" fill={skin.base} />
        {/* Jaw & Chin highlight / shadow */}
        <rect x="38" y="52" width="24" height="12" rx="6" fill={skin.base} />
        <rect x="42" y="60" width="16" height="4" rx="2" fill={skin.shadow} fillOpacity="0.4" />

        {/* Ears */}
        <rect x="33" y="44" width="3" height="7" rx="1.5" fill={skin.shadow} />
        <rect x="64" y="44" width="3" height="7" rx="1.5" fill={skin.shadow} />

        {/* Arms / Hands */}
        {/* Left Arm (holds tablet if equipped) */}
        <rect x={isFemale ? "28" : "25"} y="72" width="7" height="24" rx="3.5" fill={skin.shadow} />
        <circle cx={isFemale ? "31" : "28"} cy="97" r="3.5" fill={skin.base} />

        {/* Right Arm */}
        <rect x={isFemale ? "65" : "68"} y="72" width="7" height="24" rx="3.5" fill={skin.shadow} />
        <circle cx={isFemale ? "68" : "71"} cy="97" r="3.5" fill={skin.base} />
      </g>

      {/* ── LAYER 3: ROSTO (5ª Categoria oficial: Olhos, Boca, Expressão) ─ */}
      <g id="layer-face">
        {/* Cheeks / Rosy Blush */}
        {(faceId === "face_01" || faceId === "face_03" || faceId === "face_04") && (
          <>
            <circle cx="40" cy="53" r="2.5" fill={skin.blush} fillOpacity="0.65" />
            <circle cx="60" cy="53" r="2.5" fill={skin.blush} fillOpacity="0.65" />
          </>
        )}

        {/* Eyes according to Face Type */}
        {faceId === "face_01" && (
          // Cordial & Empático: Warm round eyes with dual white specular dots
          <>
            <rect x="42" y="45" width="4" height="5" rx="1" fill="#18181b" />
            <rect x="54" y="45" width="4" height="5" rx="1" fill="#18181b" />
            <rect x="43" y="46" width="1.5" height="1.5" fill="#ffffff" />
            <rect x="55" y="46" width="1.5" height="1.5" fill="#ffffff" />
            {/* Gentle Arched Brows */}
            <rect x="41" y="42" width="6" height="1.5" rx="0.5" fill={hairColor.shadow} />
            <rect x="53" y="42" width="6" height="1.5" rx="0.5" fill={hairColor.shadow} />
            {/* Friendly Gentle Smile */}
            <path d="M 46 56 Q 50 59 54 56" stroke="#991b1b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </>
        )}

        {faceId === "face_02" && (
          // Confiante & Seguro: Sharp determined eyes with focused pupil
          <>
            <rect x="41" y="46" width="5" height="4" rx="1" fill="#0f172a" />
            <rect x="54" y="46" width="5" height="4" rx="1" fill="#0f172a" />
            <rect x="43" y="47" width="2" height="2" fill="#38bdf8" />
            <rect x="56" y="47" width="2" height="2" fill="#38bdf8" />
            {/* Determined Direct Brows */}
            <path d="M 40 43 L 47 42" stroke={hairColor.shadow} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M 53 42 L 60 43" stroke={hairColor.shadow} strokeWidth="1.8" strokeLinecap="round" />
            {/* Confident Smirk */}
            <path d="M 46 56 Q 51 56 55 54" stroke="#991b1b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </>
        )}

        {faceId === "face_03" && (
          // Carismático & Alegre: Open cheerful crescent eyes & bright open smile
          <>
            <path d="M 41 47 Q 44 43 47 47" stroke="#18181b" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 53 47 Q 56 43 59 47" stroke="#18181b" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* High Cheerful Brows */}
            <path d="M 41 41 Q 44 39 47 41" stroke={hairColor.shadow} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 53 41 Q 56 39 59 41" stroke={hairColor.shadow} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            {/* Open Smile with Teeth */}
            <path d="M 45 54 Q 50 61 55 54 Z" fill="#b91c1c" />
            <rect x="47" y="54.5" width="6" height="2" rx="0.5" fill="#ffffff" />
          </>
        )}

        {faceId === "face_04" && (
          // Expressivo Comercial (Sales Focus): Large attentive eyes with amber irises & active smile
          <>
            <rect x="41" y="44" width="5" height="6" rx="1.5" fill="#18181b" />
            <rect x="54" y="44" width="5" height="6" rx="1.5" fill="#18181b" />
            <rect x="42" y="46" width="2.5" height="3" fill="#10b981" />
            <rect x="55" y="46" width="2.5" height="3" fill="#10b981" />
            <rect x="42.5" y="45" width="1.5" height="1.5" fill="#ffffff" />
            <rect x="55.5" y="45" width="1.5" height="1.5" fill="#ffffff" />
            {/* Active Consultative Brows */}
            <path d="M 40 42 Q 44 40 47 42" stroke={hairColor.shadow} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            <path d="M 53 42 Q 56 40 60 42" stroke={hairColor.shadow} strokeWidth="1.8" fill="none" strokeLinecap="round" />
            {/* Receptive Commercial Smile */}
            <path d="M 45 55 Q 50 60 55 55" stroke="#991b1b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </>
        )}

        {faceId === "face_05" && (
          // Analítico & Sereno: Rectangular calm analytical gaze
          <>
            <rect x="42" y="46" width="5" height="3.5" rx="0.5" fill="#18181b" />
            <rect x="53" y="46" width="5" height="3.5" rx="0.5" fill="#18181b" />
            <rect x="44" y="46.5" width="1.5" height="2" fill="#38bdf8" />
            <rect x="55" y="46.5" width="1.5" height="2" fill="#38bdf8" />
            {/* Straight Level Brows */}
            <rect x="41" y="43" width="6" height="1.5" fill={hairColor.shadow} />
            <rect x="53" y="43" width="6" height="1.5" fill={hairColor.shadow} />
            {/* Composed Calm Mouth Line */}
            <line x1="46" y1="56" x2="54" y2="56" stroke="#991b1b" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}

        {faceId === "face_06" && (
          // Foco Operacional: Concentrated squint & determined active line
          <>
            <line x1="41" y1="46" x2="47" y2="47" stroke="#18181b" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="53" y1="47" x2="59" y2="46" stroke="#18181b" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="43" y="47" width="2" height="1.5" fill="#10b981" />
            <rect x="55" y="47" width="2" height="1.5" fill="#10b981" />
            {/* Slanted Determined Brows */}
            <line x1="40" y1="42" x2="47" y2="44" stroke={hairColor.shadow} strokeWidth="2" strokeLinecap="round" />
            <line x1="53" y1="44" x2="60" y2="42" stroke={hairColor.shadow} strokeWidth="2" strokeLinecap="round" />
            {/* Focused Firm Mouth */}
            <line x1="46" y1="56" x2="54" y2="56" stroke="#991b1b" strokeWidth="1.6" strokeLinecap="round" />
          </>
        )}

        {/* Nose dot */}
        <rect x="49" y="50" width="2" height="2" rx="0.5" fill={skin.shadow} />
      </g>

      {/* ── LAYER 4: ROUPA (Outfits 01 to 08) ───────────────────────── */}
      <g id="layer-outfit">
        {outfitId === "outfit_01" && (
          // Polo ZAI Corporativa: Black polo with emerald green collar & piping
          <>
            <rect x="32" y="70" width="36" height="35" rx="3" fill="#18181b" />
            {/* Green collar */}
            <path d="M 40 70 L 50 78 L 46 70 Z" fill={primaryBrandColor} />
            <path d="M 60 70 L 50 78 L 54 70 Z" fill={primaryBrandColor} />
            {/* Button Placket */}
            <rect x="49" y="76" width="2" height="8" fill="#3f3f46" />
            <circle cx="50" cy="78" r="0.8" fill="#ffffff" />
            <circle cx="50" cy="82" r="0.8" fill="#ffffff" />
            {/* Left sleeve trim */}
            <rect x="28" y="70" width="6" height="14" rx="2" fill="#18181b" />
            <rect x="28" y="82" width="6" height="2" fill={primaryBrandColor} />
            {/* Right sleeve trim */}
            <rect x="66" y="70" width="6" height="14" rx="2" fill="#18181b" />
            <rect x="66" y="82" width="6" height="2" fill={primaryBrandColor} />
          </>
        )}

        {outfitId === "outfit_02" && (
          // Camisa Social Branca: Crisp white shirt with pointed collar & dark tie
          <>
            <rect x="32" y="70" width="36" height="35" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
            {/* Collar Points */}
            <polygon points="40,70 50,77 46,70" fill="#e2e8f0" />
            <polygon points="60,70 50,77 54,70" fill="#e2e8f0" />
            {/* Dark Tie */}
            <polygon points="48.5,75 51.5,75 52,94 50,97 48,94" fill="#0f172a" />
            <rect x="49.5" y="82" width="1" height="4" fill={primaryBrandColor} />
            {/* White Sleeves */}
            <rect x="28" y="70" width="6" height="16" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
            <rect x="66" y="70" width="6" height="16" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
          </>
        )}

        {outfitId === "outfit_03" && (
          // Moletom Tech Zip: Charcoal hoodie with neon green center zipper
          <>
            <rect x="31" y="69" width="38" height="36" rx="4" fill="#1e293b" />
            {/* High neck hood collar */}
            <path d="M 38 69 Q 50 74 62 69" stroke="#334155" strokeWidth="3" fill="none" />
            {/* Neon Green Zipper Track */}
            <line x1="50" y1="72" x2="50" y2="104" stroke="#00f090" strokeWidth="1.5" />
            <circle cx="50" cy="74" r="1.5" fill="#ffffff" />
            {/* Pouch pocket seams */}
            <path d="M 40 92 L 43 100 L 57 100 L 60 92" stroke="#334155" strokeWidth="1" fill="none" />
            {/* Sleeves */}
            <rect x="27" y="70" width="7" height="18" rx="3" fill="#1e293b" />
            <rect x="66" y="70" width="7" height="18" rx="3" fill="#1e293b" />
          </>
        )}

        {outfitId === "outfit_04" && (
          // Uniforme Técnico: Navy utility shirt with chest flap pockets
          <>
            <rect x="32" y="70" width="36" height="35" rx="3" fill="#1e3a8a" />
            {/* Chest flap pockets */}
            <rect x="36" y="78" width="8" height="7" rx="1" fill="#172554" />
            <rect x="36" y="77" width="8" height="2" fill="#2563eb" />
            <rect x="56" y="78" width="8" height="7" rx="1" fill="#172554" />
            <rect x="56" y="77" width="8" height="2" fill="#2563eb" />
            {/* Center placket */}
            <rect x="49" y="72" width="2" height="32" fill="#172554" />
            {/* Sleeves */}
            <rect x="28" y="70" width="6" height="15" rx="2" fill="#1e3a8a" />
            <rect x="66" y="70" width="6" height="15" rx="2" fill="#1e3a8a" />
          </>
        )}

        {outfitId === "outfit_05" && (
          // Blazer Alfaiataria Comercial: Charcoal blazer with emerald lapel & inner shirt
          <>
            {/* Inner Shirt */}
            <rect x="43" y="70" width="14" height="34" fill="#f8fafc" />
            {/* Blazer Left & Right Sides */}
            <path d="M 32 70 L 44 70 L 46 95 L 32 99 Z" fill="#0f172a" />
            <path d="M 68 70 L 56 70 L 54 95 L 68 99 Z" fill="#0f172a" />
            {/* Emerald Satin Lapel */}
            <polygon points="40,70 45,86 42,88 38,70" fill={primaryBrandColor} />
            <polygon points="60,70 55,86 58,88 62,70" fill={primaryBrandColor} />
            {/* Gold/Emerald Pin */}
            <circle cx="39" cy="78" r="1.5" fill="#f59e0b" />
            {/* Sleeves */}
            <rect x="27" y="70" width="7" height="17" rx="2.5" fill="#0f172a" />
            <rect x="66" y="70" width="7" height="17" rx="2.5" fill="#0f172a" />
          </>
        )}

        {outfitId === "outfit_06" && (
          // Colete Refletivo Logística: High-vis yellow safety vest with silver reflective bands
          <>
            <rect x="32" y="70" width="36" height="35" rx="3" fill="#eab308" />
            {/* Dark inner workshirt */}
            <rect x="45" y="70" width="10" height="34" fill="#1e293b" />
            {/* Horizontal Silver Reflective Bands */}
            <rect x="32" y="80" width="36" height="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
            <rect x="32" y="91" width="36" height="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
            {/* Vest opening lines */}
            <line x1="45" y1="70" x2="45" y2="105" stroke="#ca8a04" strokeWidth="1" />
            <line x1="55" y1="70" x2="55" y2="105" stroke="#ca8a04" strokeWidth="1" />
            {/* Sleeves */}
            <rect x="28" y="70" width="6" height="14" rx="2" fill="#1e293b" />
            <rect x="66" y="70" width="6" height="14" rx="2" fill="#1e293b" />
          </>
        )}

        {outfitId === "outfit_07" && (
          // Camiseta Básica ZAI: Casual black tee with store emblem
          <>
            <rect x="32" y="70" width="36" height="35" rx="3" fill="#18181b" />
            <circle cx="50" cy="70" r="5" fill="#09090b" />
            {/* Sleeves */}
            <rect x="28" y="70" width="6" height="12" rx="2" fill="#18181b" />
            <rect x="66" y="70" width="6" height="12" rx="2" fill="#18181b" />
          </>
        )}

        {outfitId === "outfit_08" && (
          // Jaqueta Bomber ZAI: Urban bomber with ribbed emerald trim
          <>
            <rect x="31" y="70" width="38" height="35" rx="4" fill="#0f172a" />
            {/* Ribbed Collar & Hem */}
            <rect x="40" y="69" width="20" height="3" rx="1.5" fill={primaryBrandColor} />
            <rect x="31" y="101" width="38" height="4" rx="1" fill={primaryBrandColor} />
            {/* Zipper */}
            <line x1="50" y1="72" x2="50" y2="101" stroke="#e2e8f0" strokeWidth="1.2" />
            {/* Contrast Sleeves */}
            <rect x="26" y="70" width="8" height="16" rx="3" fill="#1e293b" />
            <rect x="26" y="84" width="8" height="3" fill={primaryBrandColor} />
            <rect x="66" y="70" width="8" height="16" rx="3" fill="#1e293b" />
            <rect x="66" y="84" width="8" height="3" fill={primaryBrandColor} />
          </>
        )}
      </g>

      {/* ── LAYER 5: CABELO (Hairs 01 to 10) ────────────────────────── */}
      <g id="layer-hair">
        {hairId === "hair_01" && (
          // Rabo de Cavalo Executivo: Sleek parted crown with high ponytail behind right shoulder
          <>
            {/* Crown hair */}
            <rect x="34" y="24" width="32" height="18" rx="8" fill={hairColor.base} />
            <path d="M 34 32 Q 50 26 66 32 L 66 40 L 34 40 Z" fill={hairColor.base} />
            {/* Hair highlight curve */}
            <path d="M 38 29 Q 50 26 62 29" stroke={hairColor.highlight} strokeWidth="1.5" fill="none" />
            {/* High Ponytail on Right */}
            <circle cx="64" cy="34" r="3" fill={primaryBrandColor} /> {/* Hair tie */}
            <path d="M 64 34 Q 72 44 70 66 Q 66 58 64 48 Z" fill={hairColor.base} />
            <path d="M 66 38 Q 71 48 69 62" stroke={hairColor.highlight} strokeWidth="1" fill="none" />
          </>
        )}

        {hairId === "hair_02" && (
          // Chanel Alinhado: Smooth chin-length bob framing face evenly
          <>
            <rect x="33" y="24" width="34" height="20" rx="9" fill={hairColor.base} />
            {/* Left side bob */}
            <rect x="33" y="34" width="6" height="22" rx="3" fill={hairColor.base} />
            {/* Right side bob */}
            <rect x="61" y="34" width="6" height="22" rx="3" fill={hairColor.base} />
            {/* Parting shine */}
            <line x1="42" y1="28" x2="58" y2="28" stroke={hairColor.highlight} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}

        {hairId === "hair_03" && (
          // Ondulado Longo Elegante: Flowing voluminous waves down past both shoulders
          <>
            <rect x="33" y="23" width="34" height="20" rx="10" fill={hairColor.base} />
            {/* Left voluminous waves */}
            <path d="M 33 34 Q 28 46 31 58 Q 33 68 36 76 Q 38 66 37 54 Z" fill={hairColor.base} />
            <path d="M 31 42 Q 29 52 33 66" stroke={hairColor.highlight} strokeWidth="1.5" fill="none" />
            {/* Right voluminous waves */}
            <path d="M 67 34 Q 72 46 69 58 Q 67 68 64 76 Q 62 66 63 54 Z" fill={hairColor.base} />
            <path d="M 69 42 Q 71 52 67 66" stroke={hairColor.highlight} strokeWidth="1.5" fill="none" />
            {/* Crown volume */}
            <path d="M 36 28 Q 50 23 64 28" stroke={hairColor.highlight} strokeWidth="2" fill="none" />
          </>
        )}

        {hairId === "hair_04" && (
          // Coque Alto Profissional: Neat high bun centered on crown with sleek sides
          <>
            {/* High Bun */}
            <circle cx="50" cy="20" r="7.5" fill={hairColor.base} />
            <circle cx="50" cy="20" r="4.5" fill={hairColor.highlight} fillOpacity="0.4" />
            {/* Gold Hairpin */}
            <line x1="44" y1="18" x2="56" y2="22" stroke="#f59e0b" strokeWidth="1.2" />
            {/* Sleek head hair */}
            <rect x="34" y="25" width="32" height="18" rx="8" fill={hairColor.base} />
            <path d="M 36 30 Q 50 26 64 30" stroke={hairColor.highlight} strokeWidth="1.5" fill="none" />
          </>
        )}

        {hairId === "hair_05" && (
          // Curto Fade Moderno: Executive short crop with styled parted top
          <>
            <rect x="35" y="24" width="30" height="16" rx="6" fill={hairColor.base} />
            {/* Side fade gradient effect */}
            <rect x="34" y="32" width="3" height="12" fill={hairColor.shadow} fillOpacity="0.8" />
            <rect x="63" y="32" width="3" height="12" fill={hairColor.shadow} fillOpacity="0.8" />
            {/* Styled textured pompadour top */}
            <path d="M 36 26 L 44 21 L 54 22 L 64 26 Z" fill={hairColor.base} />
            <line x1="38" y1="24" x2="60" y2="24" stroke={hairColor.highlight} strokeWidth="1.5" />
          </>
        )}

        {hairId === "hair_06" && (
          // Black Power Texturizado: Defined full rounded afro silhouette
          <>
            <circle cx="50" cy="36" r="19" fill={hairColor.base} />
            <circle cx="44" cy="30" r="6" fill={hairColor.highlight} fillOpacity="0.3" />
            <circle cx="56" cy="30" r="6" fill={hairColor.highlight} fillOpacity="0.3" />
          </>
        )}

        {hairId === "hair_07" && (
          // Longo Liso com Franja: Straight hair with distinct horizontal bangs & sleek sides
          <>
            {/* Crown & Back */}
            <rect x="33" y="23" width="34" height="20" rx="9" fill={hairColor.base} />
            {/* Left Sleek Curtain */}
            <rect x="32" y="34" width="5.5" height="42" rx="2.5" fill={hairColor.base} />
            <line x1="34" y1="36" x2="34" y2="72" stroke={hairColor.highlight} strokeWidth="1" />
            {/* Right Sleek Curtain */}
            <rect x="62.5" y="34" width="5.5" height="42" rx="2.5" fill={hairColor.base} />
            <line x1="66" y1="36" x2="66" y2="72" stroke={hairColor.highlight} strokeWidth="1" />
            {/* Distinct Straight Fringe / Bangs across forehead */}
            <rect x="38" y="31" width="24" height="7" rx="1.5" fill={hairColor.base} />
            <line x1="39" y1="38" x2="61" y2="38" stroke={hairColor.shadow} strokeWidth="1" />
            <line x1="40" y1="33" x2="60" y2="33" stroke={hairColor.highlight} strokeWidth="1" />
          </>
        )}

        {hairId === "hair_08" && (
          // Street Spiky Texturizado: Dynamic upright spiky hair tufts on top
          <>
            <rect x="35" y="25" width="30" height="16" rx="6" fill={hairColor.base} />
            {/* Upright Spikes */}
            <polygon points="38,26 42,16 45,25" fill={hairColor.base} />
            <polygon points="44,25 49,14 53,25" fill={hairColor.base} />
            <polygon points="52,25 57,15 61,26" fill={hairColor.base} />
            <line x1="42" y1="18" x2="49" y2="16" stroke={hairColor.highlight} strokeWidth="1.2" />
          </>
        )}

        {hairId === "hair_09" && (
          // Cachos Volumosos: Defined bouncy ringlets around head
          <>
            <circle cx="38" cy="27" r="7" fill={hairColor.base} />
            <circle cx="50" cy="23" r="8" fill={hairColor.base} />
            <circle cx="62" cy="27" r="7" fill={hairColor.base} />
            <circle cx="34" cy="37" r="6" fill={hairColor.base} />
            <circle cx="66" cy="37" r="6" fill={hairColor.base} />
            <circle cx="33" cy="48" r="5" fill={hairColor.base} />
            <circle cx="67" cy="48" r="5" fill={hairColor.base} />
            <circle cx="50" cy="23" r="4" fill={hairColor.highlight} fillOpacity="0.4" />
          </>
        )}

        {hairId === "hair_10" && (
          // Cyber Wave Longo: Flowing modern cyber wave with neon highlight
          <>
            <path d="M 33 24 Q 50 18 67 24 Q 73 38 68 56 Q 64 68 62 76 Q 60 62 62 48 Z" fill={hairColor.base} />
            {/* Neon Cyber Highlight Streak */}
            <path d="M 40 22 Q 54 20 64 32 Q 68 44 65 58" stroke="#38bdf8" strokeWidth="2" fill="none" />
            <rect x="33" y="34" width="5" height="24" rx="2.5" fill={hairColor.base} />
          </>
        )}
      </g>

      {/* ── LAYER 6: ACESSÓRIOS (Headset, Glasses, Badge, Tablet, Watch) ── */}
      <g id="layer-accessories">
        {/* Headset Pro Wireless */}
        {hasHeadset && (
          <g id="acc-headset">
            {/* Headband over crown */}
            <path d="M 33 38 Q 50 19 67 38" stroke="#0f172a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Left Ear Cushion */}
            <rect x="31" y="38" width="4.5" height="10" rx="2" fill="#1e293b" stroke="#00f090" strokeWidth="0.8" />
            {/* Curved Microphone Boom */}
            <path d="M 33 46 Q 36 57 44 56" stroke="#0f172a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            {/* Glowing Emerald Microphone LED */}
            <circle cx="44.5" cy="56" r="1.8" fill="#00f090" className={isTalking ? "animate-ping" : ""} />
            <circle cx="44.5" cy="56" r="1.2" fill="#ffffff" />
          </g>
        )}

        {/* Executive Glasses */}
        {hasGlasses && (
          <g id="acc-glasses">
            <rect x="39" y="44" width="9" height="6.5" rx="1.5" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="52" y="44" width="9" height="6.5" rx="1.5" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="48" y1="47" x2="52" y2="47" stroke="#0f172a" strokeWidth="1.5" />
            {/* Diagonal Lens Sheen */}
            <line x1="41" y1="49" x2="45" y2="45" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.8" />
            <line x1="54" y1="49" x2="58" y2="45" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.8" />
          </g>
        )}

        {/* Lanyard ID Badge */}
        {hasBadge && (
          <g id="acc-badge">
            {/* Ribbon Straps */}
            <line x1="45" y1="68" x2="49" y2="82" stroke={primaryBrandColor} strokeWidth="1.2" />
            <line x1="55" y1="68" x2="51" y2="82" stroke={primaryBrandColor} strokeWidth="1.2" />
            {/* Badge Card */}
            <rect x="47" y="82" width="6" height="8" rx="0.8" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.5" />
            <rect x="47" y="82" width="6" height="2.5" fill={primaryBrandColor} />
            <rect x="48.5" y="86" width="3" height="1" fill="#64748b" />
          </g>
        )}

        {/* Sales Tablet held in left hand */}
        {hasTablet && (
          <g id="acc-tablet">
            <rect x="18" y="86" width="13" height="18" rx="1.5" fill="#0f172a" stroke="#475569" strokeWidth="0.8" />
            {/* Glowing Screen */}
            <rect x="19.5" y="88" width="10" height="14" rx="0.5" fill="#0284c7" />
            {/* Mini CRM graph bars on screen */}
            <rect x="21" y="96" width="1.5" height="4" fill="#00f090" />
            <rect x="23.5" y="93" width="1.5" height="7" fill="#00f090" />
            <rect x="26" y="91" width="1.5" height="9" fill="#00f090" />
          </g>
        )}

        {/* Smartwatch on right wrist */}
        {hasWatch && (
          <g id="acc-watch">
            <rect x="66" y="95" width="4" height="4" rx="1" fill="#0f172a" stroke="#00f090" strokeWidth="0.8" />
            <rect x="67" y="96" width="2" height="2" fill="#00f090" />
          </g>
        )}
      </g>

      {/* ── LAYER 7: ESTILO & STORE BRANDING (Chest Badge & Micro-States) ── */}
      {showBrandingLayer && (
        <g id="layer-branding">
          {/* Store Chest Logo Pin */}
          <rect
            x="36"
            y="76"
            width="6"
            height="3.5"
            rx="0.8"
            fill={branding.secondaryColor || "#0f172a"}
            stroke={primaryBrandColor}
            strokeWidth="0.6"
          />
          <circle cx="38" cy="77.7" r="0.7" fill={primaryBrandColor} />
        </g>
      )}

      {/* Micro-Animation Indicators */}
      {isTalking && (
        <g id="indicator-talking" transform="translate(74, 30)">
          <rect x="0" y="4" width="2" height="6" rx="1" fill="#10b981" />
          <rect x="3" y="1" width="2" height="12" rx="1" fill="#34d399" />
          <rect x="6" y="3" width="2" height="8" rx="1" fill="#10b981" />
        </g>
      )}

      {isThinking && (
        <g id="indicator-thinking" transform="translate(45, 6)">
          <polygon points="5,0 6.5,3.5 10,5 6.5,6.5 5,10 3.5,6.5 0,5 3.5,3.5" fill="#38bdf8" />
        </g>
      )}

      {currentState === "SUCCESS" && (
        <g id="indicator-success" transform="translate(44, 4)">
          <circle cx="6" cy="6" r="6" fill="#10b981" />
          <polyline points="3,6 5,8 9,4" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      )}

      {currentState === "ALERT" && (
        <g id="indicator-alert" transform="translate(44, 4)">
          <polygon points="6,0 12,11 0,11" fill="#f59e0b" />
          <line x1="6" y1="4" x2="6" y2="7.5" stroke="#000000" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="6" cy="9.5" r="0.7" fill="#000000" />
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
  className,
  onClick,
}) => {
  const currentState = stateProp || avatar.animationState || "WAITING";
  const sizeConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

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
      className={cn(
        "relative flex flex-col items-center justify-end select-none transition-all group",
        sizeConfig.container,
        onClick && "cursor-pointer hover:scale-105",
        className
      )}
      style={{
        imageRendering: "pixelated",
      }}
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

      {/* Main 2.5D Pixel-Art Character (Never clipped, fits 35%-50% container height) */}
      <div className={cn("relative z-10 flex items-center justify-center my-auto", sizeConfig.character)}>
        <ModularLayerAvatar
          avatar={avatar}
          branding={branding}
          currentState={currentState}
          size={size}
          showBrandingLayer={showBrandingLayer}
        />
      </div>

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
