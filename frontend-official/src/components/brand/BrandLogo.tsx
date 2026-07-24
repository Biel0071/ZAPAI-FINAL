import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  /** Rendered pixel size (width & height). Default 44. */
  size?: number;
  /** Extra classes for the wrapping svg. */
  className?: string;
  /** Subtle pulse on the badge (used on loading screens). */
  animated?: boolean;
  /** Force a Z color instead of theme-driven (e.g. on colored splash). */
  forceZColor?: "black" | "white";
}

/**
 * ZAPFLOW "Z" mark — a green chat bubble with a bold Z.
 *
 * Kept intentionally simple so it stays crisp at small sizes (down to ~28px in
 * the sidebar). The bubble/gradient are always green; the Z inverts with the
 * theme via `currentColor` (dark Z on light bg, white Z on dark bg).
 */
export function BrandLogo({ size = 44, className, animated = false, forceZColor }: BrandLogoProps) {
  const zColorClass =
    forceZColor === "black"
      ? "text-[#0b0f17]"
      : forceZColor === "white"
        ? "text-white"
        : // theme-driven: dark on light theme, white on dark theme
          "text-white dark:text-[#0b1120]";

  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      role="img"
      aria-label="ZAPFLOW AI"
      className={cn(zColorClass, animated && "zf-logo-pulse", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="zf-bubble" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>

      {/* Chat bubble with a short tail at the bottom-left */}
      <path
        d="M64 12
           C93 12 116 33 116 60
           C116 87 93 108 64 108
           L44 108
           L26 120
           L30 104
           C18 95 12 78 12 60
           C12 33 35 12 64 12 Z"
        fill="url(#zf-bubble)"
      />

      {/* Bold Z, centered, high-contrast against the bubble */}
      <path
        d="M44 44 H84 V56 L60 76 H84 V88 H44 V76 L68 56 H44 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default BrandLogo;
