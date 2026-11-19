import React, { useEffect, useState } from "react";
import { cn } from "@/core/lib/utils";
import type { AgentAvatarConfig } from "./AvatarDefinition";
import { findCatalogItem } from "./avatar3d/slotCatalog";
import { HAIR_PALETTES, SKIN_PALETTES } from "./avatarLook";
import { supportsWebGL } from "./avatar3d/webglSupport";
import { renderCatalogItemThumbnail3D } from "./avatar3d/thumbnailRenderer3D";
import { getActiveAvatarEngine } from "./avatar3d/avatarEngineFlag";
import { renderCatalogItemThumbnailGLBAsync } from "./avatar3d/glb/thumbnailRendererGLB";

export type AvatarPreviewFocus =
  | "hair"
  | "face"
  | "outfit"
  | "upper_body"
  | "lower_body"
  | "footwear"
  | "accessory-head"
  | "accessory-body"
  | "accessories"
  | "uniform"
  | "style"
  | "full";

export interface AvatarItemPreviewProps {
  spriteRef?: string;
  itemId?: string;
  gender?: "male" | "female" | "neutral" | string;
  focus?: AvatarPreviewFocus;
  title?: string;
  accentColor?: string;
  hairColor?: string;
  skinTone?: string;
  baseAvatar?: Partial<AgentAvatarConfig> | null;
  selected?: boolean;
  size?: "sm" | "md";
  className?: string;
}

function resolvePreviewHairHex(hairColorProp?: string, itemId?: string, gender?: string): string {
  if (hairColorProp && HAIR_PALETTES[hairColorProp]) {
    return HAIR_PALETTES[hairColorProp].base;
  }
  if (itemId === "hair_03" || itemId === "hair_08" || itemId === "hair_12") return "#eab308";
  if (itemId === "hair_10") return "#0284c7";
  if (itemId === "hair_11") return "#ec4899";
  if (itemId === "hair_15") return "#cbd5e1";
  if (itemId === "hair_17") return "#dc2626";
  return gender === "male" ? "#1e293b" : "#432818";
}

function renderHairSvg(style: string, hairHex: string, skinHex: string, accent: string) {
  return (
    <g>
      {/* Back hair volume for long styles */}
      {(style === "long" || style === "long_bangs" || style === "cyber_wave" || style === "layered_long" || style === "glamour_waves" || style === "long_tucked") && (
        <path d="M 14 26 Q 12 44 16 54 L 48 54 Q 52 44 50 26 Z" fill={hairHex} />
      )}
      {style === "bob" && <path d="M 15 26 L 14 44 L 50 44 L 49 26 Z" fill={hairHex} />}
      {style === "ponytail" && (
        <>
          <path d="M 42 20 Q 56 26 52 48 Q 46 44 43 30 Z" fill={hairHex} />
          <circle cx="43" cy="21" r="2.8" fill={accent} />
        </>
      )}
      {style === "bun" && (
        <>
          <circle cx="32" cy="11" r="8" fill={hairHex} />
          <ellipse cx="32" cy="17" rx="6" ry="1.8" fill={accent} />
        </>
      )}
      {style === "afro" && <circle cx="32" cy="26" r="19" fill={hairHex} />}

      {/* Head contour */}
      <ellipse cx="32" cy="33" rx="13" ry="14" fill={skinHex} />

      {/* Top hair crown */}
      <path d="M 18 29 Q 18 14 32 14 Q 46 14 46 29 Q 40 22 32 23 Q 24 22 18 29 Z" fill={hairHex} />

      {/* Style-specific front bangs / spikes / curls */}
      {(style === "spiky" || style === "anime_spiky" || style === "urban_flame") && (
        <path
          d="M 18 25 L 22 12 L 28 20 L 33 10 L 38 20 L 44 13 L 46 25 Z"
          fill={hairHex}
        />
      )}
      {style === "curly" && (
        <g fill={hairHex}>
          <circle cx="22" cy="19" r="5" />
          <circle cx="32" cy="16" r="5.5" />
          <circle cx="42" cy="19" r="5" />
          <circle cx="19" cy="26" r="4.2" />
          <circle cx="45" cy="26" r="4.2" />
        </g>
      )}
      {(style === "long_bangs" || style === "bob") && (
        <path d="M 19 23 Q 32 27 45 23 L 45 29 Q 32 30 19 29 Z" fill={hairHex} />
      )}
      {(style === "medium_side" || style === "cyber_wave" || style === "glamour_waves" || style === "slick_back") && (
        <path d="M 19 25 Q 28 16 44 21 Q 36 28 20 29 Z" fill={hairHex} />
      )}
    </g>
  );
}

function renderFaceSvg(expr: string, skinHex: string, irisColor: string) {
  return (
    <g>
      <ellipse cx="32" cy="33" rx="16" ry="17" fill={skinHex} />
      {/* Subtle 3D nose ridge */}
      <path d="M 32 30 L 31 37 Q 32 38.5 33.5 37" fill="none" stroke="#c27a57" strokeWidth="1.4" strokeLinecap="round" />

      {/* Eyebrows */}
      <path
        d={expr === "focused" ? "M 21 24 L 28 26" : expr === "confident" ? "M 21 25 Q 24.5 23 28 25" : "M 21 25 Q 24.5 23 28 24.5"}
        stroke="#291d16"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={expr === "focused" ? "M 36 26 L 43 24" : expr === "confident" ? "M 36 23.5 Q 39.5 21.5 43 24" : "M 36 24.5 Q 39.5 23 43 25"}
        stroke="#291d16"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Left Eye */}
      <ellipse cx="24.5" cy="30.5" rx="3.4" ry="3.8" fill="#ffffff" />
      <circle cx="24.5" cy="30.8" r="2.1" fill={irisColor} />
      <circle cx="24.5" cy="30.8" r="1.1" fill="#090b10" />
      <circle cx="23.8" cy="29.8" r="0.7" fill="#ffffff" />

      {/* Right Eye (winks on face_03) */}
      {expr === "wink" ? (
        <path d="M 36 31 Q 39.5 28 43 31" stroke="#180d0b" strokeWidth="2" strokeLinecap="round" fill="none" />
      ) : (
        <>
          <ellipse cx="39.5" cy="30.5" rx="3.4" ry="3.8" fill="#ffffff" />
          <circle cx="39.5" cy="30.8" r="2.1" fill={irisColor} />
          <circle cx="39.5" cy="30.8" r="1.1" fill="#090b10" />
          <circle cx="38.8" cy="29.8" r="0.7" fill="#ffffff" />
        </>
      )}

      {/* Sculpted mouth */}
      {expr === "open_smile" || expr === "wink" ? (
        <path d="M 26 41 Q 32 47 38 41 Q 32 42 26 41 Z" fill="#9f1239" stroke="#7f1d1d" strokeWidth="0.9" />
      ) : expr === "confident" ? (
        <path d="M 27 42 Q 33 44 38 40.5" stroke="#882222" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      ) : expr === "calm" || expr === "focused" ? (
        <path d="M 27.5 42.5 Q 32 43.8 36.5 42.5" stroke="#882222" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M 26.5 41.5 Q 32 45.5 37.5 41.5" stroke="#882222" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}

function renderUpperSvg(kind: string, bodyColor: string, trimColor: string) {
  return (
    <g>
      {/* Shoulders + torso silhouette */}
      <path d="M 14 22 Q 18 14 27 14 L 37 14 Q 46 14 50 22 L 54 38 L 46 40 L 44 28 L 44 52 L 20 52 L 20 28 L 18 40 L 10 38 Z" fill={bodyColor} stroke="#334155" strokeWidth="1" />
      {kind === "polo" && (
        <>
          <path d="M 25 14 L 32 22 L 39 14" fill="none" stroke={trimColor} strokeWidth="2.4" />
          <rect x="30.5" y="21" width="3" height="9" rx="1" fill={trimColor} />
        </>
      )}
      {kind === "shirt" && (
        <>
          <path d="M 26 14 L 32 21 L 38 14" fill="#e2e8f0" />
          <polygon points="32,19 35,24 33.5,43 32,46 30.5,43 29,24" fill={trimColor} />
        </>
      )}
      {kind === "hoodie" && (
        <>
          <ellipse cx="32" cy="14" rx="9" ry="4" fill="#0f172a" stroke={trimColor} strokeWidth="1.3" />
          <line x1="32" y1="18" x2="32" y2="51" stroke={trimColor} strokeWidth="2" />
          <rect x="23" y="37" width="18" height="10" rx="3" fill="#0f172a" opacity="0.55" />
        </>
      )}
      {kind === "jacket" && (
        <>
          <polygon points="27,14 32,32 37,14" fill="#0f172a" />
          <path d="M 26 14 L 31 32 M 38 14 L 33 32" stroke={trimColor} strokeWidth="2" />
        </>
      )}
      {kind === "vest" && (
        <>
          <rect x="20" y="30" width="24" height="3.5" fill="#e2e8f0" />
          <rect x="20" y="40" width="24" height="3.5" fill="#e2e8f0" />
        </>
      )}
      {kind === "uniform" && (
        <>
          <rect x="20" y="27" width="24" height="3" fill={trimColor} />
          <rect x="22" y="19" width="7" height="6" rx="1" fill={trimColor} />
          <rect x="35" y="19" width="7" height="6" rx="1" fill={trimColor} />
        </>
      )}
      {kind === "bomber" && (
        <>
          <line x1="32" y1="16" x2="32" y2="49" stroke={trimColor} strokeWidth="2" />
          <rect x="20" y="48" width="24" height="4" rx="1" fill={trimColor} />
        </>
      )}
      {kind === "tee" && (
        <circle cx="38" cy="24" r="3" fill={trimColor} />
      )}
    </g>
  );
}

function renderLowerSvg(kind: string, color: string, accent: string) {
  if (kind === "skirt_exec") {
    return (
      <g>
        <rect x="20" y="12" width="24" height="5" rx="1.5" fill={accent} />
        <path d="M 20 17 L 44 17 L 47 44 L 17 44 Z" fill={color} stroke="#475569" strokeWidth="1" />
        <line x1="17" y1="42" x2="47" y2="42" stroke={accent} strokeWidth="2" />
      </g>
    );
  }
  return (
    <g>
      <rect x="20" y="11" width="24" height="5" rx="1.5" fill={accent} />
      <path d="M 20 16 L 44 16 L 46 52 L 35 52 L 32 30 L 29 52 L 18 52 Z" fill={color} stroke="#475569" strokeWidth="1" />
      {kind === "cargo" && (
        <>
          <rect x="16" y="27" width="5" height="9" rx="1" fill={accent} />
          <rect x="43" y="27" width="5" height="9" rx="1" fill={accent} />
        </>
      )}
      {kind === "jogger" && (
        <>
          <rect x="18" y="49" width="11" height="3.5" rx="1" fill={accent} />
          <rect x="35" y="49" width="11" height="3.5" rx="1" fill={accent} />
        </>
      )}
    </g>
  );
}

function renderFootwearSvg(kind: string, upper: string, sole: string, accent: string) {
  return (
    <g>
      {kind === "boot" || kind === "safety" ? (
        <path d="M 16 22 L 32 22 L 34 34 L 49 37 Q 53 40 50 45 L 14 45 Z" fill={upper} stroke="#475569" strokeWidth="1" />
      ) : (
        <path d="M 14 31 L 31 30 L 48 37 Q 53 40 50 45 L 13 45 Z" fill={upper} stroke="#475569" strokeWidth="1" />
      )}
      <rect x="12" y="44" width="40" height="5.5" rx="2.5" fill={sole} />
      <rect x="22" y="36" width="13" height="3" rx="1.5" fill={accent} />
    </g>
  );
}

function renderAccessorySvg(builderId: string, accent: string) {
  switch (builderId) {
    case "acc_01":
      return <circle cx="32" cy="32" r="10" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />;
    case "eyewear_executive":
      return (
        <g fill="rgba(56,189,248,0.18)" stroke="#cbd5e1" strokeWidth="2.2">
          <rect x="12" y="25" width="16" height="12" rx="3" />
          <rect x="36" y="25" width="16" height="12" rx="3" />
          <line x1="28" y1="30" x2="36" y2="30" />
        </g>
      );
    case "eyewear_wayfarer":
      return (
        <g fill="#09090b" stroke="#334155" strokeWidth="1.5">
          <polygon points="11,25 29,25 27,38 13,38" />
          <polygon points="35,25 53,25 51,38 37,38" />
          <line x1="29" y1="27" x2="35" y2="27" strokeWidth="2.5" />
        </g>
      );
    case "headwear_cap":
      return (
        <g>
          <path d="M 14 36 Q 16 17 33 17 Q 49 17 50 36 Z" fill={accent} />
          <path d="M 14 35 L 55 37 Q 45 42 16 39 Z" fill="#0f172a" />
        </g>
      );
    case "headwear_hardhat":
      return (
        <g>
          <path d="M 14 36 Q 16 16 32 16 Q 48 16 50 36 Z" fill="#f8fafc" />
          <rect x="29" y="14" width="6" height="16" rx="2" fill={accent} />
          <rect x="10" y="35" width="44" height="4.5" rx="2" fill="#cbd5e1" />
        </g>
      );
    case "headset_pro":
      return (
        <g>
          <path d="M 16 34 Q 16 14 32 14 Q 48 14 48 34" fill="none" stroke="#334155" strokeWidth="4" />
          <rect x="11" y="27" width="8" height="14" rx="3" fill="#0f172a" stroke={accent} strokeWidth="1.5" />
          <rect x="45" y="27" width="8" height="14" rx="3" fill="#0f172a" stroke={accent} strokeWidth="1.5" />
          <path d="M 15 39 Q 20 48 30 47" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="31" cy="47" r="2.2" fill={accent} />
        </g>
      );
    case "headset_earbud":
      return (
        <g>
          <circle cx="32" cy="28" r="8" fill="#0f172a" stroke={accent} strokeWidth="2" />
          <rect x="30" y="34" width="4" height="14" rx="2" fill="#334155" />
          <circle cx="32" cy="28" r="3" fill={accent} />
        </g>
      );
    case "badge_lanyard":
      return (
        <g>
          <path d="M 20 10 L 32 28 L 44 10" fill="none" stroke={accent} strokeWidth="3" />
          <rect x="23" y="27" width="18" height="24" rx="2.5" fill="#f8fafc" stroke="#334155" strokeWidth="1.2" />
          <rect x="24" y="28" width="16" height="5" fill={accent} />
          <line x1="27" y1="39" x2="37" y2="39" stroke="#64748b" strokeWidth="2" />
          <line x1="27" y1="44" x2="35" y2="44" stroke="#94a3b8" strokeWidth="2" />
        </g>
      );
    case "badge_clip":
      return (
        <g>
          <rect x="14" y="23" width="36" height="18" rx="3" fill="#e2e8f0" stroke="#475569" strokeWidth="1.4" />
          <rect x="14" y="23" width="36" height="5" rx="1.5" fill={accent} />
          <line x1="20" y1="34" x2="42" y2="34" stroke="#334155" strokeWidth="2" />
        </g>
      );
    case "wrist_smartwatch":
      return (
        <g>
          <rect x="26" y="10" width="12" height="44" rx="3" fill="#1e293b" />
          <rect x="20" y="20" width="24" height="24" rx="5" fill="#0f172a" stroke={accent} strokeWidth="2" />
          <rect x="24" y="24" width="16" height="16" rx="3" fill={accent} opacity="0.85" />
        </g>
      );
    case "prop_tablet":
      return (
        <g>
          <rect x="18" y="12" width="28" height="40" rx="3.5" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <rect x="21" y="16" width="22" height="32" rx="1.5" fill={accent} opacity="0.82" />
        </g>
      );
    case "prop_laptop":
      return (
        <g>
          <rect x="14" y="16" width="36" height="24" rx="2" fill="#94a3b8" stroke="#334155" strokeWidth="1.2" />
          <rect x="17" y="19" width="30" height="18" fill="#0f172a" />
          <polygon points="10,41 54,41 58,47 6,47" fill="#cbd5e1" />
        </g>
      );
    case "prop_coffee":
      return (
        <g>
          <polygon points="21,20 43,20 40,50 24,50" fill="#f8fafc" />
          <rect x="22" y="29" width="20" height="10" fill={accent} />
          <rect x="19" y="15" width="26" height="5" rx="2" fill={accent} />
        </g>
      );
    case "prop_clipboard":
      return (
        <g>
          <rect x="18" y="14" width="28" height="38" rx="3" fill="#78350f" />
          <rect x="22" y="20" width="20" height="28" rx="1" fill="#f8fafc" />
          <rect x="26" y="11" width="12" height="6" rx="1.5" fill="#cbd5e1" />
        </g>
      );
    case "prop_smartphone":
      return (
        <g>
          <rect x="22" y="12" width="20" height="40" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <rect x="25" y="17" width="14" height="30" rx="1.5" fill="#22c55e" opacity="0.85" />
        </g>
      );
    case "prop_boxes":
      return (
        <g>
          <rect x="14" y="29" width="36" height="21" rx="2" fill="#c08a4d" stroke="#78350f" strokeWidth="1.2" />
          <rect x="18" y="14" width="28" height="16" rx="2" fill="#d49d5e" stroke="#78350f" strokeWidth="1.2" />
          <rect x="14" y="36" width="36" height="3.5" fill={accent} />
        </g>
      );
    case "back_backpack":
      return (
        <g>
          <rect x="17" y="15" width="30" height="36" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          <rect x="20" y="27" width="24" height="4" rx="1.5" fill={accent} />
          <rect x="22" y="34" width="20" height="13" rx="3" fill="#0f172a" />
        </g>
      );
    default:
      return <circle cx="32" cy="32" r="12" fill={accent} opacity="0.7" />;
  }
}

export const AvatarItemPreview: React.FC<AvatarItemPreviewProps> = React.memo(({
  spriteRef = "sprite_r2_c1",
  itemId,
  gender = "female",
  focus = "full",
  title = "",
  accentColor,
  hairColor,
  skinTone,
  baseAvatar,
  selected,
  size = "md",
  className,
}) => {
  const src = `/assets/avatar_factory/catalog/${spriteRef}_clean.png`;
  const hasWebgl = React.useMemo(() => typeof window !== "undefined" && supportsWebGL(), []);
  const activeEngine = React.useMemo(() => getActiveAvatarEngine(), []);
  const catalogItem = React.useMemo(() => findCatalogItem(itemId), [itemId]);
  const skinHex = (skinTone && SKIN_PALETTES[skinTone]?.base) || (gender === "male" ? SKIN_PALETTES.tan.base : SKIN_PALETTES.peach.base);
  const hairHex = resolvePreviewHairHex(hairColor, itemId, gender);
  const resolvedAccent = accentColor || catalogItem?.thumbnailSpec.accentColor || catalogItem?.palette?.primary || "#10b981";
  const [thumb3dUrl, setThumb3dUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasWebgl || !itemId || itemId === "acc_01") {
      setThumb3dUrl(null);
      return;
    }
    let cancelled = false;

    if (activeEngine === "glb") {
      renderCatalogItemThumbnailGLBAsync({
        itemId,
        focus,
        gender,
        hairColor,
        skinTone,
        accentColor: resolvedAccent,
        baseAvatar,
      })
        .then((generated) => {
          if (!cancelled && generated) {
            setThumb3dUrl(generated);
          }
        })
        .catch(() => {
          // Keep clean vector preview if GLB fails
        });
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const generated = renderCatalogItemThumbnail3D({
        itemId,
        focus,
        gender,
        hairColor,
        skinTone,
        accentColor: resolvedAccent,
      });
      if (!cancelled && generated) {
        setThumb3dUrl(generated);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hasWebgl, activeEngine, itemId, focus, gender, hairColor, skinTone, resolvedAccent, baseAvatar]);

  const previewBody = React.useMemo(() => {
    const category = catalogItem?.category;

    if (category === "hair" || focus === "hair" || itemId?.startsWith("hair_")) {
      const style = catalogItem?.assetBuilderId || "short";
      return renderHairSvg(style, hairHex, skinHex, resolvedAccent);
    }

    if (category === "face" || focus === "face" || itemId?.startsWith("face_")) {
      const expr = catalogItem?.assetBuilderId || "smile";
      const irisMap: Record<string, string> = {
        smile: "#4a2512",
        confident: "#2563eb",
        wink: "#522914",
        open_smile: "#059669",
        calm: "#475569",
        focused: "#b45309",
        executive: "#334155",
        charismatic: "#6d28d9",
      };
      return renderFaceSvg(expr, skinHex, irisMap[expr] || "#4a2512");
    }

    if (category === "upper_body" || focus === "outfit" || focus === "upper_body" || itemId?.startsWith("outfit_") || itemId?.startsWith("upper_")) {
      const kind = catalogItem?.assetBuilderId || "polo";
      const bodyCol = catalogItem?.palette?.primary || "#1d2432";
      const trimCol = catalogItem?.palette?.accent || resolvedAccent;
      return renderUpperSvg(kind, bodyCol, trimCol);
    }

    if (category === "lower_body" || focus === "lower_body" || itemId?.startsWith("lower_")) {
      const kind = catalogItem?.assetBuilderId || "chinos";
      const col = catalogItem?.palette?.primary || "#1e293b";
      const acc = catalogItem?.palette?.accent || "#0f172a";
      return renderLowerSvg(kind, col, acc);
    }

    if (category === "footwear" || focus === "footwear" || itemId?.startsWith("shoe_")) {
      const kind = catalogItem?.assetBuilderId || "sneaker";
      const upper = catalogItem?.palette?.primary || "#1e293b";
      const sole = catalogItem?.palette?.secondary || "#f8fafc";
      const acc = catalogItem?.palette?.accent || resolvedAccent;
      return renderFootwearSvg(kind, upper, sole, acc);
    }

    if (
      category === "accessories" ||
      focus === "accessory-head" ||
      focus === "accessory-body" ||
      focus === "accessories" ||
      itemId?.startsWith("acc_")
    ) {
      const builderId = itemId === "acc_01" ? "acc_01" : (catalogItem?.assetBuilderId || itemId || "acc_01");
      return renderAccessorySvg(builderId, resolvedAccent);
    }

    if (category === "uniform" || category === "style" || focus === "uniform" || focus === "style") {
      const primary = catalogItem?.palette?.primary || resolvedAccent;
      const secondary = catalogItem?.palette?.secondary || "#0f172a";
      return (
        <g>
          <circle cx="32" cy="32" r="20" fill={secondary} stroke={primary} strokeWidth="3.5" />
          <circle cx="32" cy="32" r="11" fill={primary} opacity="0.28" />
          <path d="M 24 38 L 32 21 L 40 38 Z" fill={primary} />
        </g>
      );
    }

    // Full body gender silhouette
    const isMale = gender === "male";
    return (
      <g>
        <circle cx="32" cy="18" r="8" fill={skinHex} />
        <path d={isMale ? "M 24 17 Q 25 10 32 10 Q 39 10 40 17 Z" : "M 22 22 Q 22 9 32 9 Q 42 9 42 22 L 44 29 L 20 29 Z"} fill={hairHex} />
        <path
          d={isMale
            ? "M 18 30 Q 22 26 32 26 Q 42 26 46 30 L 44 45 L 20 45 Z"
            : "M 20 30 Q 24 26 32 26 Q 40 26 44 30 L 42 45 L 22 45 Z"}
          fill="#1d2432"
          stroke={resolvedAccent}
          strokeWidth="1.2"
        />
        <rect x="23" y="45" width="7" height="12" rx="2" fill="#111827" />
        <rect x="34" y="45" width="7" height="12" rx="2" fill="#111827" />
      </g>
    );
  }, [catalogItem, focus, itemId, gender, hairHex, skinHex, resolvedAccent]);

  return (
    <div
      data-avatar-preview-focus={focus}
      data-avatar-preview-item={itemId}
      data-webgl-available={hasWebgl ? "true" : "false"}
      className={cn(
        "relative shrink-0 overflow-hidden border border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-950 to-black shadow-inner flex items-center justify-center",
        size === "sm" ? "h-10 w-10 rounded-lg" : "h-12 w-12 rounded-xl",
        selected && "ring-1 ring-emerald-500/60 border-emerald-500/60",
        className,
      )}
      style={
        accentColor
          ? {
              borderColor: `${accentColor}55`,
              boxShadow: `inset 0 0 12px ${accentColor}22`,
            }
          : undefined
      }
    >
      <img
        src={src}
        alt={title}
        aria-hidden="true"
        className="sr-only"
      />
      {thumb3dUrl ? (
        <img
          src={thumb3dUrl}
          alt={title || itemId || "Miniatura 3D"}
          data-avatar-3d-thumb="1"
          className="w-full h-full object-cover pointer-events-none select-none"
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full pointer-events-none select-none p-0.5"
          aria-hidden="true"
        >
          {previewBody}
        </svg>
      )}
    </div>
  );
});

AvatarItemPreview.displayName = "AvatarItemPreview";
