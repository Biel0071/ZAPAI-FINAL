import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  /** Rendered pixel size (width & height). Default 44. */
  size?: number;
  /** Extra classes for the wrapping svg. */
  className?: string;
  /** Animate the circuit dots / ring (used on loading screens). */
  animated?: boolean;
  /** Force a Z color instead of theme-driven (e.g. on colored splash). */
  forceZColor?: "black" | "white";
}

/**
 * ZAPFLOW "Z" mark, recreated as a themeable SVG.
 *
 * The green ring, speech-bubble tail and circuit traces stay green in both
 * themes. Only the Z body inverts: black on light theme, white on dark theme.
 * That inversion is driven by `currentColor`, which we set via Tailwind
 * `text-*` utilities that react to the `.dark` class on <html>.
 */
export function BrandLogo({ size = 44, className, animated = false, forceZColor }: BrandLogoProps) {
  const zColorClass =
    forceZColor === "black"
      ? "text-black"
      : forceZColor === "white"
        ? "text-white"
        : // theme-driven: black in light, white in dark
          "text-[#0b0f17] dark:text-white";

  return (
    <svg
      viewBox="0 0 128 128"
      width={size}
      height={size}
      role="img"
      aria-label="ZAPFLOW AI"
      className={cn(zColorClass, className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="zf-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="55%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#0f7a34" />
        </linearGradient>
        <linearGradient id="zf-zbase" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#0f7a34" />
        </linearGradient>
      </defs>

      {/* Open green ring + speech-bubble tail */}
      <path
        d="M96 24 A46 46 0 1 0 40 104 L28 118 L44 100"
        stroke="url(#zf-ring)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? "zf-ring-anim" : undefined}
      />

      {/* Circuit traces on the left */}
      <g stroke="url(#zf-ring)" strokeWidth="4" strokeLinecap="round">
        <line x1="18" y1="46" x2="44" y2="46" className={animated ? "zf-trace zf-trace-1" : undefined} />
        <line x1="12" y1="60" x2="40" y2="60" className={animated ? "zf-trace zf-trace-2" : undefined} />
        <line x1="18" y1="74" x2="44" y2="74" className={animated ? "zf-trace zf-trace-3" : undefined} />
      </g>
      <g fill="#22c55e">
        <circle cx="16" cy="46" r="4" className={animated ? "zf-trace zf-trace-1" : undefined} />
        <circle cx="10" cy="60" r="4" className={animated ? "zf-trace zf-trace-2" : undefined} />
        <circle cx="16" cy="74" r="4" className={animated ? "zf-trace zf-trace-3" : undefined} />
      </g>

      {/* Z — top half inverts with theme (currentColor), bottom bar stays green */}
      <path d="M50 40 H86 L64 62 H50 Z" fill="currentColor" />
      <path d="M50 62 H64 L58 68 H50 Z" fill="currentColor" />
      <path d="M52 68 H82 L86 78 H50 Z" fill="url(#zf-zbase)" />
    </svg>
  );
}

export default BrandLogo;
