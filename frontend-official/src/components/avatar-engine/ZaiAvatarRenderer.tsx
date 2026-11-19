/**
 * ZAI CRM Enterprise — Modular Avatar Card & Vector Fallback Renderer
 * Renders saved high-resolution 3D snapshots (`snapshotDataUrl`) when present,
 * and falls back to an accurate, distinct layered vector humanoid matching every slot.
 */

import React from "react";
import {
  AgentAvatarConfig,
  AnimationState,
  StoreBranding,
  resolveHairColorForHair,
} from "./AvatarDefinition";
import {
  normalizeAvatarForRenderer,
  resolveBaseSpriteForAvatar,
  resolveSpriteForAvatar,
} from "./CharacterFactory";
import { cn } from "@/core/lib/utils";
import {
  HAIR_PALETTES,
  SKIN_PALETTES,
  resolveAccessoryFlags,
  resolveOutfitId,
} from "./avatarLook";
import {
  inferGenderFromConfig,
  normalizeAvatarComposition,
} from "./avatar3d/slotCatalog";

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

const STYLE_PALETTES: Record<string, { primary: string; aura: string; title: string }> = {
  style_vendas: { primary: "#10b981", aura: "rgba(16, 185, 129, 0.35)", title: "Vendas" },
  style_corporativo: { primary: "#0ea5e9", aura: "rgba(14, 165, 233, 0.35)", title: "Corporativo" },
  style_atendimento: { primary: "#06b6d4", aura: "rgba(6, 182, 212, 0.35)", title: "Atendimento" },
  style_operacional: { primary: "#f59e0b", aura: "rgba(245, 158, 11, 0.35)", title: "Operacional" },
  style_tech: { primary: "#8b5cf6", aura: "rgba(139, 92, 246, 0.35)", title: "Tech" },
  style_casual: { primary: "#14b8a6", aura: "rgba(20, 184, 166, 0.35)", title: "Casual" },
  style_premium: { primary: "#eab308", aura: "rgba(234, 179, 8, 0.35)", title: "Premium" },
};

const OUTFIT_VECTOR_COLORS: Record<string, { body: string; trim: string; inner?: string }> = {
  outfit_01: { body: "#1d2432", trim: "#10b981" },
  outfit_02: { body: "#f8fafc", trim: "#1e293b" },
  outfit_03: { body: "#18202c", trim: "#10b981" },
  outfit_04: { body: "#1e3a5f", trim: "#94a3b8" },
  outfit_05: { body: "#18181b", trim: "#10b981", inner: "#0f172a" },
  outfit_06: { body: "#facc15", trim: "#e2e8f0", inner: "#1f2937" },
  outfit_07: { body: "#1b2230", trim: "#10b981" },
  outfit_08: { body: "#131b2c", trim: "#10b981" },
  outfit_09: { body: "#059669", trim: "#064e3b" },
  outfit_10: { body: "#475569", trim: "#f97316" },
};

const CROP_VIEWBOXES: Record<AvatarCropFocus, string> = {
  full: "0 0 140 238",
  hair: "18 4 104 96",
  face: "24 14 92 86",
  outfit: "20 92 100 92",
  "accessory-head": "18 8 104 90",
  "accessory-body": "20 90 100 94",
};

function renderVectorHairBack(hairId: string, gradUrl: string, shadow: string) {
  if (["hair_03", "hair_07", "hair_10", "hair_11", "hair_12", "hair_13"].includes(hairId)) {
    return (
      <path
        d="M 43 56 Q 38 92 43 122 L 97 122 Q 102 92 97 56 Z"
        fill={gradUrl}
        stroke={shadow}
        strokeWidth="1"
      />
    );
  }
  if (hairId === "hair_02") {
    return (
      <path
        d="M 44 56 L 42 96 L 98 96 L 96 56 Z"
        fill={gradUrl}
        stroke={shadow}
        strokeWidth="1"
      />
    );
  }
  if (hairId === "hair_01") {
    return (
      <path
        d="M 88 46 Q 110 56 104 96 Q 94 92 90 64 Z"
        fill={gradUrl}
        stroke={shadow}
        strokeWidth="1"
      />
    );
  }
  if (hairId === "hair_04") {
    return <circle cx="70" cy="30" r="14" fill={gradUrl} stroke={shadow} strokeWidth="1" />;
  }
  if (hairId === "hair_06") {
    return <circle cx="70" cy="54" r="30" fill={gradUrl} stroke={shadow} strokeWidth="1" />;
  }
  return null;
}

function renderVectorHairFront(hairId: string, gradUrl: string, shadow: string, primaryBrandColor: string) {
  if (hairId === "none") return null;

  if (["hair_08", "hair_15", "hair_17"].includes(hairId)) {
    return (
      <path
        d="M 44 58 L 49 34 L 58 46 L 68 29 L 76 45 L 88 33 L 96 58 Q 84 48 70 49 Q 56 48 44 58 Z"
        fill={gradUrl}
        stroke={shadow}
        strokeWidth="0.9"
      />
    );
  }
  if (hairId === "hair_09") {
    return (
      <g fill={gradUrl} stroke={shadow} strokeWidth="0.8">
        <circle cx="52" cy="44" r="9" />
        <circle cx="64" cy="38" r="10" />
        <circle cx="77" cy="38" r="10" />
        <circle cx="88" cy="44" r="9" />
        <circle cx="46" cy="55" r="7" />
        <circle cx="94" cy="55" r="7" />
      </g>
    );
  }
  if (hairId === "hair_07" || hairId === "hair_02") {
    return (
      <path
        d="M 44 58 Q 45 33 70 33 Q 95 33 96 58 L 93 61 Q 70 55 47 61 Z"
        fill={gradUrl}
        stroke={shadow}
        strokeWidth="0.9"
      />
    );
  }
  if (hairId === "hair_01") {
    return (
      <g>
        <path d="M 44 60 Q 45 34 70 34 Q 95 34 96 60 Q 82 47 70 49 Q 58 47 44 60 Z" fill={gradUrl} />
        <circle cx="88" cy="45" r="3.2" fill={primaryBrandColor} />
      </g>
    );
  }
  if (hairId === "hair_04") {
    return (
      <g>
        <path d="M 45 58 Q 46 34 70 34 Q 94 34 95 58 Q 82 48 70 50 Q 58 48 45 58 Z" fill={gradUrl} />
        <ellipse cx="70" cy="40" rx="11" ry="2.6" fill={primaryBrandColor} />
      </g>
    );
  }
  if (hairId === "hair_06") {
    return (
      <path
        d="M 43 56 Q 48 34 70 34 Q 92 34 97 56 Q 82 48 70 49 Q 58 48 43 56 Z"
        fill={gradUrl}
      />
    );
  }
  // Short fade / medium / classic slick back / layered
  return (
    <path
      d="M 45 60 Q 45 34 70 34 Q 95 34 95 60 Q 87 46 70 48 Q 53 46 45 60 Z"
      fill={gradUrl}
      stroke={shadow}
      strokeWidth="0.8"
    />
  );
}

/**
 * Modular Layered Vector Humanoid Fallback Compositor.
 * Renders a crisp, distinct character matching every slot without raster sprite leaks.
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
  const isV2 = Boolean(avatar.compositionVersion && avatar.compositionVersion >= 2);
  const inferred = inferGenderFromConfig(avatar);
  const isFemale = inferred !== "male";
  const comp = normalizeAvatarComposition(avatar);

  const skin = SKIN_PALETTES[comp.skin] || SKIN_PALETTES.peach;
  const hairId = comp.hair || (isFemale ? "hair_01" : "hair_05");
  const hairColorKey = isV2
    ? comp.hairColor
    : resolveHairColorForHair(hairId, avatar.hairColor, isFemale);
  const hairColor = HAIR_PALETTES[hairColorKey] || HAIR_PALETTES.dark_brown;
  const faceId = comp.face || "face_01";
  const outfitId = resolveOutfitId(avatar);

  const angle = (((rotationY % 360) + 360) % 360);
  const rad = (angle * Math.PI) / 180;
  const sinA = Math.sin(rad);
  const cosA = Math.cos(rad);
  const isBackView = cosA < -0.35;
  const turnShiftX = Math.round(sinA * 4.2 * 10) / 10;
  const turnScaleX = isBackView ? 1 : Math.round((0.84 + 0.16 * Math.abs(cosA)) * 100) / 100;

  const accFlags = resolveAccessoryFlags(comp);
  const styleId = comp.style || "style_vendas";
  const style = STYLE_PALETTES[styleId] || STYLE_PALETTES.style_vendas;
  const primaryBrandColor = branding.primaryColor || style.primary;

  const isTalking = currentState === "TALKING";
  const isThinking = currentState === "THINKING";
  const isWalking = currentState === "WALKING" || movement3D === "walk";
  const isWaving = movement3D === "wave";
  const isPosing = movement3D === "pose";
  const isSpinning = movement3D === "spin360";

  const baseSpriteId = resolveSpriteForAvatar({ body: comp.body, base: comp.base, hair: hairId }, true);
  const baseHref = `/assets/avatar_factory/catalog/${baseSpriteId}_clean.png`;

  const outfitPalette = OUTFIT_VECTOR_COLORS[outfitId] || OUTFIT_VECTOR_COLORS.outfit_01;
  const uid = React.useId().replace(/:/g, "");
  const activeViewBox = CROP_VIEWBOXES[cropFocus] || CROP_VIEWBOXES.full;

  const shoulderHalf = isFemale ? 20 : 24;
  const waistHalf = isFemale ? 14 : 17;
  const hipHalf = isFemale ? 18 : 17;
  const pantColor = comp.lowerBody === "lower_slacks" ? "#111827" : comp.lowerBody === "lower_cargo" ? "#1e293b" : "#18202c";
  const shoeColor = comp.footwear === "shoe_oxford" ? "#18181b" : comp.footwear === "shoe_boot" ? "#292524" : "#1e293b";

  return (
    <svg
      viewBox={activeViewBox}
      className={cn(
        "w-full h-full select-none transition-transform duration-300 pointer-events-none",
        isTalking && "animate-bounce-subtle",
        isWalking && "animate-walk-step",
        currentState === "OFFLINE" && "grayscale contrast-75 opacity-70",
      )}
      style={{
        imageRendering: size === "workspace" ? "auto" : undefined,
        shapeRendering: "geometricPrecision",
      }}
    >
      <defs>
        <radialGradient id={`pedestalGlow-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={primaryBrandColor} stopOpacity="0.45" />
          <stop offset="70%" stopColor={primaryBrandColor} stopOpacity="0.14" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`hairGrad-${uid}-${hairColorKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={hairColor.highlight} />
          <stop offset="45%" stopColor={hairColor.base} />
          <stop offset="100%" stopColor={hairColor.shadow} />
        </linearGradient>

        <linearGradient id={`skinGrad-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={skin.highlight} />
          <stop offset="55%" stopColor={skin.base} />
          <stop offset="100%" stopColor={skin.shadow} />
        </linearGradient>
      </defs>

      {/* LAYER 1: ISOMETRIC TURNTABLE PEDESTAL */}
      {cropFocus === "full" && (
        <g id="layer-pedestal">
          <ellipse cx="70" cy="222" rx="52" ry="14" fill={`url(#pedestalGlow-${uid})`} />
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
          <line x1="38" y1="222" x2="102" y2="222" stroke={primaryBrandColor} strokeWidth="0.6" strokeOpacity="0.35" />
          <line x1="70" y1="214" x2="70" y2="230" stroke={primaryBrandColor} strokeWidth="0.6" strokeOpacity="0.35" />
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
          <ellipse cx="70" cy="222" rx="28" ry="6.5" fill="#000000" fillOpacity="0.65" />
        </g>
      )}

      {/* CHARACTER LAYERED VECTOR RIG */}
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
          {/* Invisible legacy contract anchor (0x0 opacity=0 so female pixel art NEVER renders visually) */}
          <g id="layer-unified-base" data-composed-hair={hairId} opacity="0" aria-hidden="true">
            <image href={baseHref} x="0" y="0" width="0" height="0" />
          </g>

          {/* Back Hair */}
          {!isBackView && renderVectorHairBack(hairId, `url(#hairGrad-${uid}-${hairColorKey})`, hairColor.shadow)}

          {/* Backpack (if worn behind torso) */}
          {accFlags.backpack && (
            <rect x="44" y="96" width="52" height="44" rx="10" fill="#0f172a" stroke={primaryBrandColor} strokeWidth="1.2" />
          )}

          {/* Lower Body & Footwear */}
          <g id="layer-lower-body">
            {comp.lowerBody === "lower_skirt_exec" ? (
              <>
                <path d={`M ${70 - hipHalf} 142 L ${70 + hipHalf} 142 L ${70 + hipHalf + 2} 178 L ${70 - hipHalf - 2} 178 Z`} fill={pantColor} />
                <rect x="56" y="178" width="9" height="32" rx="3.5" fill={skin.base} />
                <rect x="75" y="178" width="9" height="32" rx="3.5" fill={skin.base} />
              </>
            ) : (
              <>
                <rect x={70 - hipHalf} y="142" width={hipHalf * 2} height="16" rx="5" fill={pantColor} />
                <rect x={70 - hipHalf} y="152" width="14" height="58" rx="5" fill={pantColor} />
                <rect x={70 + hipHalf - 14} y="152" width="14" height="58" rx="5" fill={pantColor} />
              </>
            )}
            {/* Footwear */}
            <rect x={70 - hipHalf - 1} y="208" width="16" height="10" rx="4" fill={shoeColor} />
            <rect x={70 - hipHalf - 1} y="216" width="16" height="3.5" rx="1.5" fill={comp.footwear === "shoe_oxford" ? "#09090b" : "#f8fafc"} />
            <rect x={70 + hipHalf - 15} y="208" width="16" height="10" rx="4" fill={shoeColor} />
            <rect x={70 + hipHalf - 15} y="216" width="16" height="3.5" rx="1.5" fill={comp.footwear === "shoe_oxford" ? "#09090b" : "#f8fafc"} />
          </g>

          {/* Torso & Upper Body Outfit */}
          <g id="layer-outfit" data-outfit-id={outfitId}>
            {/* Arms */}
            <rect
              x={70 - shoulderHalf - 9}
              y="98"
              width="10"
              height="44"
              rx="5"
              fill={outfitId === "outfit_01" || outfitId === "outfit_06" || outfitId === "outfit_07" || outfitId === "outfit_09" ? skin.base : outfitPalette.body}
            />
            <rect
              x={70 + shoulderHalf - 1}
              y="98"
              width="10"
              height="44"
              rx="5"
              fill={outfitId === "outfit_01" || outfitId === "outfit_06" || outfitId === "outfit_07" || outfitId === "outfit_09" ? skin.base : outfitPalette.body}
            />
            {/* Short sleeves */}
            {(outfitId === "outfit_01" || outfitId === "outfit_07" || outfitId === "outfit_09") && (
              <>
                <rect x={70 - shoulderHalf - 10} y="97" width="12" height="16" rx="4" fill={outfitPalette.body} />
                <rect x={70 + shoulderHalf - 2} y="97" width="12" height="16" rx="4" fill={outfitPalette.body} />
              </>
            )}
            {/* Hands */}
            <circle cx={70 - shoulderHalf - 4} cy="144" r="4.8" fill={skin.base} />
            <circle cx={70 + shoulderHalf + 4} cy="144" r="4.8" fill={skin.base} />

            {/* Sculpted Torso */}
            <path
              d={`M ${70 - shoulderHalf} 96 Q 70 92 ${70 + shoulderHalf} 96 L ${70 + waistHalf} 144 L ${70 - waistHalf} 144 Z`}
              fill={outfitPalette.inner || outfitPalette.body}
              stroke="#0f172a"
              strokeWidth="0.9"
            />
            {outfitId === "outfit_05" && !isBackView && (
              <g id="outfit-05-blazer-detail">
                <polygon points="56,96 68,122 61,123 51,98" fill="#18181b" stroke={primaryBrandColor} strokeWidth="0.9" />
                <polygon points="84,96 72,122 79,123 89,98" fill="#18181b" stroke={primaryBrandColor} strokeWidth="0.9" />
                <polygon points="63,96 70,116 77,96" fill="#0f172a" />
              </g>
            )}
            {outfitId === "outfit_02" && !isBackView && (
              <polygon points="70,97 73,104 71.5,134 70,137 68.5,134 67,104" fill="#1e293b" />
            )}
            {outfitId === "outfit_01" && !isBackView && (
              <path d="M 63 96 L 70 105 L 77 96" fill="none" stroke={primaryBrandColor} strokeWidth="2" />
            )}
            {outfitId === "outfit_06" && (
              <g id="outfit-06-hivis-detail" opacity="0.9">
                <rect x="52" y="96" width="36" height="46" rx="4" fill="#facc15" />
                <rect x="51" y="116" width="38" height="3.5" rx="1" fill="#e2e8f0" stroke="#eab308" strokeWidth="0.6" />
                <rect x="51" y="129" width="38" height="3.5" rx="1" fill="#e2e8f0" stroke="#eab308" strokeWidth="0.6" />
              </g>
            )}
            {isBackView && (
              <g id="outfit-back-emblem" opacity="0">
                <circle cx="70" cy="107" r="2.2" fill={primaryBrandColor} />
              </g>
            )}
          </g>

          {/* Neck & Head */}
          <rect x="64" y="84" width="12" height="14" rx="4" fill={skin.shadow} />
          <ellipse cx="44" cy="70" rx="4.2" ry="6" fill={skin.shadow} />
          <ellipse cx="96" cy="70" rx="4.2" ry="6" fill={skin.shadow} />
          <ellipse cx="70" cy="67" rx="25" ry="27" fill={`url(#skinGrad-${uid})`} stroke={skin.shadow} strokeWidth="0.8" />

          {/* Back View Full Hair Coverage */}
          {isBackView && (
            <ellipse cx="70" cy="64" rx="26" ry="27" fill={`url(#hairGrad-${uid}-${hairColorKey})`} />
          )}

          {/* Face Layer */}
          {!isBackView && cropFocus !== "outfit" && (
            <g id="layer-face">
              {/* 3D-shaded subtle nose */}
              <path d="M 70 67 L 68.5 75 Q 70 77 72 75" fill="none" stroke={skin.shadow} strokeWidth="1.5" strokeLinecap="round" />

              {/* Eyebrows */}
              <path d="M 55 59 Q 60 57 64 59" stroke={hairColor.shadow} strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <path d="M 76 59 Q 80 57 85 59" stroke={hairColor.shadow} strokeWidth="1.8" strokeLinecap="round" fill="none" />

              {/* Eyes */}
              <ellipse cx="60" cy="66" rx="4" ry="4.4" fill="#ffffff" />
              <circle cx="60.2" cy="66.2" r="2.3" fill={faceId === "face_04" ? "#10b981" : faceId === "face_02" ? "#38bdf8" : "#3b2316"} />
              <circle cx="60.2" cy="66.2" r="1.2" fill="#090b10" />
              <circle cx="59.3" cy="65.1" r="0.8" fill="#ffffff" />

              {faceId === "face_03" ? (
                <path d="M 76 66.5 Q 80 63.5 84 66.5" stroke="#180d0b" strokeWidth="2" strokeLinecap="round" fill="none" />
              ) : (
                <>
                  <ellipse cx="80" cy="66" rx="4" ry="4.4" fill="#ffffff" />
                  <circle cx="79.8" cy="66.2" r="2.3" fill={faceId === "face_04" ? "#10b981" : faceId === "face_02" ? "#38bdf8" : "#3b2316"} />
                  <circle cx="79.8" cy="66.2" r="1.2" fill="#090b10" />
                  <circle cx="78.9" cy="65.1" r="0.8" fill="#ffffff" />
                </>
              )}

              {/* Cheek blush */}
              <ellipse cx="53" cy="74" rx="4" ry="2.2" fill={skin.blush} opacity={isFemale ? 0.45 : 0.2} />
              <ellipse cx="87" cy="74" rx="4" ry="2.2" fill={skin.blush} opacity={isFemale ? 0.45 : 0.2} />

              {/* Mouth */}
              {faceId === "face_03" || faceId === "face_04" ? (
                <path d="M 64 80 Q 70 86 76 80 Z" fill="#9f1239" stroke="#7f1d1d" strokeWidth="0.9" />
              ) : faceId === "face_02" ? (
                <path d="M 65 81 Q 71 83.5 76 79.5" stroke="#9a3412" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              ) : (
                <path d="M 65 80.5 Q 70 84.5 75 80.5" stroke="#9a3412" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              )}

              {/* Independent Facial Hair */}
              {comp.facialHair !== "none" && (
                <path
                  d="M 52 78 Q 55 94 70 95 Q 85 94 88 78 Q 80 86 70 86 Q 60 86 52 78 Z"
                  fill={hairColor.shadow}
                  opacity={comp.facialHair === "stubble" ? 0.35 : 0.88}
                />
              )}

              {/* Legacy compatibility markers ONLY when non-v2 legacy object is passed */}
              {!isV2 && faceId === "face_07" && (
                <>
                  {!isFemale && (
                    <g id="face-07-beard" opacity="0.9">
                      <path d="M 60 83 Q 70 95 80 83 Q 76 92 70 93 Q 64 92 60 83 Z" fill={hairColor.shadow} />
                    </g>
                  )}
                  <g id="face-07-intellectual-frames" opacity="0.95">
                    <circle cx="60" cy="66" r="6" fill="rgba(255,255,255,0.16)" stroke="#334155" strokeWidth="1.2" />
                    <circle cx="80" cy="66" r="6" fill="rgba(255,255,255,0.16)" stroke="#334155" strokeWidth="1.2" />
                    <line x1="66" y1="66" x2="74" y2="66" stroke="#334155" strokeWidth="1.2" />
                  </g>
                </>
              )}
              {!isV2 && faceId === "face_08" && (
                <g id="face-08-sunglasses" opacity="0.95">
                  <polygon points="52,61 67,61 65.5,71 53.5,71" fill="#09090b" stroke="#18181b" strokeWidth="0.9" />
                  <polygon points="73,61 88,61 86.5,71 74.5,71" fill="#09090b" stroke="#18181b" strokeWidth="0.9" />
                  <line x1="67" y1="62" x2="73" y2="62" stroke="#09090b" strokeWidth="1.2" />
                </g>
              )}
            </g>
          )}

          {/* Hair Front */}
          <g id="layer-hair" data-hair-id={hairId}>
            {!isBackView && renderVectorHairFront(hairId, `url(#hairGrad-${uid}-${hairColorKey})`, hairColor.shadow, primaryBrandColor)}
          </g>

          {/* Accessories */}
          <g id="layer-accessories">
            {accFlags.glasses && !isBackView && (
              <g id="acc-glasses" opacity="0.95">
                <rect x="53" y="61" width="13" height="9" rx="2" fill="rgba(255,255,255,0.15)" stroke="#94a3b8" strokeWidth="1.3" />
                <rect x="74" y="61" width="13" height="9" rx="2" fill="rgba(255,255,255,0.15)" stroke="#94a3b8" strokeWidth="1.3" />
                <line x1="66" y1="65" x2="74" y2="65" stroke="#94a3b8" strokeWidth="1.3" />
              </g>
            )}

            {accFlags.sunglasses && !isBackView && (
              <g id="acc-sunglasses" opacity="0.95">
                <polygon points="52,61 67,61 65.5,71 53.5,71" fill="#09090b" stroke="#334155" strokeWidth="1" />
                <polygon points="73,61 88,61 86.5,71 74.5,71" fill="#09090b" stroke="#334155" strokeWidth="1" />
                <line x1="67" y1="62" x2="73" y2="62" stroke="#334155" strokeWidth="1.4" />
              </g>
            )}

            {accFlags.cap && (
              <g id="acc-cap">
                <path d="M 44 50 Q 46 31 70 31 Q 94 31 96 50 Z" fill={primaryBrandColor} />
                <path d="M 46 49 L 100 52 Q 84 57 48 53 Z" fill="#0f172a" />
              </g>
            )}

            {accFlags.hardhat && (
              <g id="acc-hardhat">
                <path d="M 43 49 Q 45 27 70 27 Q 95 27 97 49 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                <rect x="67" y="25" width="6" height="19" rx="2" fill={primaryBrandColor} />
                <rect x="39" y="48" width="62" height="5" rx="2.5" fill="#e2e8f0" />
              </g>
            )}

            {accFlags.headset && cropFocus !== "outfit" && cropFocus !== "accessory-body" && (
              <g id="acc-headset" opacity="0.95">
                <path d="M 45 64 Q 44 31 70 31 Q 96 31 95 64" fill="none" stroke="#1e293b" strokeWidth="2.8" />
                <rect x="40" y="60" width="7" height="14" rx="3" fill="#0f172a" stroke={primaryBrandColor} strokeWidth="1" />
                <rect x="93" y="60" width="7" height="14" rx="3" fill="#0f172a" stroke={primaryBrandColor} strokeWidth="1" />
                <path d="M 44 72 Q 48 80 58 82" fill="none" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="59" cy="82" r="2.2" fill="#00f090" />
              </g>
            )}

            {accFlags.badge && !isBackView && (
              <g id="acc-badge">
                <path d="M 62 96 L 69 116 L 77 96" stroke={primaryBrandColor} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <rect x="65" y="115" width="9" height="12" rx="1.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1" />
                <rect x="65.5" y="115.5" width="8" height="3.5" rx="0.8" fill={primaryBrandColor} />
              </g>
            )}

            {accFlags.badgeClip && !isBackView && (
              <rect x="75" y="106" width="10" height="6" rx="1" fill="#e2e8f0" stroke={primaryBrandColor} strokeWidth="0.9" />
            )}

            {accFlags.tablet && !isBackView && (
              <g id="acc-tablet">
                <rect x="38" y="128" width="16" height="22" rx="2.5" fill="#0f172a" stroke={primaryBrandColor} strokeWidth="1" />
                <rect x="40" y="131" width="12" height="16" rx="1" fill={primaryBrandColor} opacity="0.7" />
              </g>
            )}

            {accFlags.coffee && !isBackView && (
              <g id="acc-coffee">
                <rect x="89" y="134" width="9" height="12" rx="2" fill="#f8fafc" stroke={primaryBrandColor} strokeWidth="0.8" />
                <rect x="88" y="132" width="11" height="3" rx="1" fill={primaryBrandColor} />
              </g>
            )}

            {accFlags.watch && !isBackView && (
              <g id="acc-watch">
                <rect x={70 - shoulderHalf - 9} y="135" width="8" height="5" rx="1.2" fill="#0f172a" stroke="#00f090" strokeWidth="0.9" />
              </g>
            )}
          </g>

          {showBrandingLayer && !isBackView && (
            <g id="layer-branding" opacity="0">
              <circle cx="80" cy="108" r="1.2" fill={primaryBrandColor} />
            </g>
          )}

          {isWaving && !isBackView && (
            <g id="zai-waving-arm" transform={`translate(${70 + shoulderHalf + 2}, 102)`}>
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
  const inferred = inferGenderFromConfig(avatar);
  const resolvedGender: "male" | "female" = inferred === "male" ? "male" : "female";

  const renderedAvatar = {
    ...normalizeAvatarForRenderer(avatar || {}),
    body: resolvedGender,
    base: resolvedGender,
  };

  const resolvedRotationY = (((rotationYProp ?? avatar?.rotationY ?? 0) % 360) + 360) % 360;
  const resolvedMovement3D = movement3DProp || avatar?.movement3D || "idle";
  const isWorking =
    currentState === "WORKING" ||
    currentState === "TALKING" ||
    currentState === "TYPING" ||
    currentState === "THINKING" ||
    currentState === "SUCCESS";

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
  const hasSnapshot = Boolean(avatar?.snapshotDataUrl && cropFocus === "full");

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
        className,
      )}
      style={{ imageRendering: size === "workspace" ? "auto" : undefined }}
    >
      {/* Semantic image for catalog sprite reference & accessibility */}
      <img
        src={spriteUrl}
        alt={avatar?.agentId || "atendente"}
        className="sr-only"
        aria-hidden="true"
      />

      {/* Turntable Stage Pedestal Accent */}
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

      {/* Ambient Aura Glow */}
      {showAura && isOperating && (
        <div
          className={cn(
            "absolute inset-0 pointer-events-none rounded-full blur-2xl opacity-25 transition-all duration-700",
            currentState === "TALKING" && "animate-pulse opacity-45",
            currentState === "THINKING" && "opacity-35 animate-pulse",
            currentState === "SUCCESS" && "opacity-55 scale-110",
            isAlert && "opacity-40 bg-amber-500/40",
          )}
          style={{
            backgroundColor: isAlert ? "#f59e0b" : branding.primaryColor,
          }}
        />
      )}

      {/* Main Character Display: High-Res 3D Snapshot OR Distinct Vector Humanoid Fallback */}
      <div
        className={cn(
          "relative z-10 flex items-center justify-center my-auto transition-transform duration-500",
          size === "workspace" && isWorking && resolvedMovement3D === "idle"
            ? "w-full h-full max-w-[280px] sm:max-w-[340px] max-h-[220px] sm:max-h-[240px]"
            : cropFocus !== "full"
            ? "w-full h-full"
            : sizeConfig.character,
        )}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {hasSnapshot ? (
            <img
              src={avatar.snapshotDataUrl}
              alt={avatar?.agentId || "Avatar 3D"}
              data-avatar-snapshot="true"
              className="w-full h-full object-contain drop-shadow-xl select-none"
            />
          ) : (
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
          )}

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

      {/* 3D Angle Indicator for Workspace */}
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
                : "bg-slate-800/60 border-slate-700 text-slate-400",
            )}
          >
            <span
              className={cn(
                "rounded-full",
                sizeConfig.indicator,
                isAlert ? "bg-amber-400 animate-pulse" : isOperating ? "bg-emerald-400 animate-pulse" : "bg-slate-500",
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
