import React from "react";
import { cn } from "@/core/lib/utils";
import { ZaiAvatarRenderer } from "./ZaiAvatarRenderer";

export type AvatarPreviewFocus =
  | "hair"
  | "face"
  | "outfit"
  | "accessory-head"
  | "accessory-body"
  | "full";

export interface AvatarItemPreviewProps {
  spriteRef?: string;
  itemId?: string;
  gender?: "male" | "female";
  focus?: AvatarPreviewFocus;
  title?: string;
  accentColor?: string;
  selected?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const FOCUS_WRAPPER_STYLES: Record<AvatarPreviewFocus, React.CSSProperties> = {
  hair: {
    transform: "translateY(28%) scale(1.65)",
  },
  face: {
    transform: "translateY(20%) scale(1.85)",
  },
  outfit: {
    transform: "translateY(-18%) scale(1.65)",
  },
  "accessory-head": {
    transform: "translateY(22%) scale(1.65)",
  },
  "accessory-body": {
    transform: "translateY(-14%) scale(1.6)",
  },
  full: {
    transform: "scale(1.05)",
  },
};

export const AvatarItemPreview: React.FC<AvatarItemPreviewProps> = ({
  spriteRef = "sprite_r2_c1",
  itemId,
  gender = "female",
  focus = "full",
  title = "",
  accentColor,
  selected,
  size = "md",
  className,
}) => {
  const src = `/assets/avatar_factory/catalog/${spriteRef}_clean.png`;

  const previewAvatar = React.useMemo(() => {
    const base: Record<string, any> = {
      body: gender,
      base: gender,
      hair: gender === "male" ? "hair_05" : "hair_01",
      face: "face_01",
      outfit: "outfit_01",
      clothing: "outfit_01",
      headset: "none",
      glasses: "none",
      workObject: "none",
      badge: false,
      accessories: { headset: "none", glasses: "none", badge: "none", watch: "none" },
      style: "style_vendas",
    };

    if (itemId) {
      if (itemId.startsWith("hair_")) {
        base.hair = itemId;
      } else if (itemId.startsWith("face_")) {
        base.face = itemId;
      } else if (itemId.startsWith("outfit_")) {
        base.outfit = itemId;
        base.clothing = itemId;
      } else if (itemId === "acc_02") {
        base.headset = "headset_zai_green";
        base.accessories.headset = "headset_zai_green";
      } else if (itemId === "acc_03") {
        base.badge = true;
        base.accessories.badge = "badge_zai_lanyard";
      } else if (itemId === "acc_04") {
        base.glasses = "glasses_square_exec";
        base.accessories.glasses = "glasses_square_exec";
      } else if (itemId === "acc_05") {
        base.workObject = "tablet_zai";
      } else if (itemId === "acc_06") {
        base.accessories.watch = "watch_zai_smart";
      } else if (itemId.startsWith("style_")) {
        base.style = itemId;
      }
    }
    return base;
  }, [itemId, gender]);

  return (
    <div
      data-avatar-preview-focus={focus}
      className={cn(
        "relative shrink-0 overflow-hidden border border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-950 to-black shadow-inner flex items-center justify-center",
        size === "sm" ? "h-10 w-10 rounded-lg" : "h-12 w-12 rounded-xl",
        selected && "ring-1 ring-emerald-500/60 border-emerald-500/60",
        className
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
      <div className="w-full h-full flex items-center justify-center pointer-events-none select-none p-0.5">
        <ZaiAvatarRenderer
          avatar={previewAvatar}
          state="WAITING"
          size="sm"
          cropFocus={focus}
          showAura={false}
          showStatusBadge={false}
          showBrandingLayer={focus === "outfit" || focus === "full"}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

