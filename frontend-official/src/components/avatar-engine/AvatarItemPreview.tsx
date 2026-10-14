import React from "react";
import { cn } from "@/core/lib/utils";

export type AvatarPreviewFocus =
  | "hair"
  | "face"
  | "outfit"
  | "accessory-head"
  | "accessory-body"
  | "full";

export interface AvatarItemPreviewProps {
  spriteRef?: string;
  focus?: AvatarPreviewFocus;
  title?: string;
  accentColor?: string;
  size?: "sm" | "md";
  className?: string;
}

const FOCUS_IMAGE_STYLES: Record<AvatarPreviewFocus, React.CSSProperties> = {
  hair: {
    width: "110%",
    height: "auto",
    top: "-2%",
    imageRendering: "pixelated",
  },
  face: {
    width: "132%",
    height: "auto",
    top: "-20%",
    imageRendering: "pixelated",
  },
  outfit: {
    width: "120%",
    height: "auto",
    top: "-76%",
    imageRendering: "pixelated",
  },
  "accessory-head": {
    width: "114%",
    height: "auto",
    top: "-6%",
    imageRendering: "pixelated",
  },
  "accessory-body": {
    width: "120%",
    height: "auto",
    top: "-72%",
    imageRendering: "pixelated",
  },
  full: {
    height: "92%",
    width: "auto",
    imageRendering: "pixelated",
  },
};

export const AvatarItemPreview: React.FC<AvatarItemPreviewProps> = ({
  spriteRef = "sprite_r2_c1",
  focus = "full",
  title = "",
  accentColor,
  size = "md",
  className,
}) => {
  const src = `/assets/avatar_factory/catalog/${spriteRef}_clean.png`;

  return (
    <div
      data-avatar-preview-focus={focus}
      className={cn(
        "relative shrink-0 overflow-hidden border border-border/70 bg-gradient-to-b from-slate-900/95 via-slate-950 to-black shadow-inner flex items-center justify-center",
        size === "sm" ? "h-10 w-10 rounded-lg" : "h-12 w-12 rounded-xl",
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
      {focus === "full" ? (
        <img
          src={src}
          alt={title}
          aria-hidden="true"
          className="h-[92%] w-auto max-w-none object-contain select-none pointer-events-none"
          style={FOCUS_IMAGE_STYLES.full}
        />
      ) : (
        <img
          src={src}
          alt={title}
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 max-w-none select-none pointer-events-none"
          style={FOCUS_IMAGE_STYLES[focus]}
        />
      )}
    </div>
  );
};
