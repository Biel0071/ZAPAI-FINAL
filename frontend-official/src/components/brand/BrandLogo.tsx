import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  /** Rendered pixel size (width & height). Default 44. */
  size?: number;
  /** Extra classes for the wrapping element. */
  className?: string;
  /** Subtle pulse (used on loading screens). */
  animated?: boolean;
  /** Force a variant for the Z letter ("black" or "white"). Default is theme-driven (white on dark, dark on light). */
  forceZColor?: "black" | "white";
}

/**
 * ZAPFLOW AI Brand Logo Component (Pure Vector SVG).
 * Features 100% transparent background, vibrant emerald green speech bubble + circuit lines,
 * and sharp theme-adaptive "Z" mark.
 */
export function BrandLogo({ size = 44, className, animated = false, forceZColor }: BrandLogoProps) {
  const zFill =
    forceZColor === "black"
      ? "#0F172A"
      : forceZColor === "white"
        ? "#FFFFFF"
        : "currentColor";

  return (
    <svg
      viewBox="0 0 500 500"
      width={size}
      height={size}
      role="img"
      aria-label="ZAPFLOW AI Logo"
      className={cn(
        forceZColor === "white" ? "text-white" : forceZColor === "black" ? "text-slate-900" : "text-slate-900 dark:text-white",
        animated && "animate-pulse",
        className
      )}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Emerald WhatsApp Gradient */}
        <linearGradient id="zap-green-gradient" x1="0" y1="0" x2="500" y2="500" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00E676" />
          <stop offset="60%" stopColor="#25D366" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        {/* Accent Green Gradient for Z bottom */}
        <linearGradient id="zap-accent-green" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00E676" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        {/* Subtle drop shadow */}
        <filter id="zap-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Outer Speech Bubble (WhatsApp style) */}
      <path
        d="M 265,70 
           C 365,70 445,150 445,250 
           C 445,350 365,430 265,430 
           C 230,430 198,420 170,403 
           L 100,435 
           L 125,368 
           C 100,336 85,295 85,250 
           C 85,150 165,70 265,70 Z"
        stroke="url(#zap-green-gradient)"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#zap-shadow)"
      />

      {/* Left Circuit Lines & Nodes */}
      <g stroke="url(#zap-green-gradient)" strokeWidth="16" strokeLinecap="round">
        {/* Top Circuit Line */}
        <line x1="80" y1="195" x2="185" y2="195" />
        {/* Middle Circuit Line */}
        <line x1="55" y1="250" x2="235" y2="250" />
        {/* Bottom Circuit Line */}
        <line x1="80" y1="305" x2="205" y2="305" />
      </g>

      {/* Circuit End Node Rings */}
      <g fill="#020617" stroke="url(#zap-green-gradient)" strokeWidth="12">
        <circle cx="80" cy="195" r="16" />
        <circle cx="55" cy="250" r="16" />
        <circle cx="80" cy="305" r="16" />
      </g>

      {/* Stylized Z Letter Mark */}
      <path
        d="M 195,165 
           H 360 
           C 375,165 385,177 378,190 
           L 245,335 
           H 355 
           C 365,335 372,342 372,352 
           V 362 
           C 372,368 365,375 355,375 
           H 190 
           C 175,375 165,363 172,350 
           L 305,205 
           H 195 
           C 185,205 178,198 178,188 
           V 178 
           C 178,171 185,165 195,165 Z"
        fill={zFill}
        filter="url(#zap-shadow)"
      />

      {/* Z Bottom Accent Bar in Gradient Green */}
      <path
        d="M 235,335 H 355 C 365,335 372,342 372,352 V 362 C 372,368 365,375 355,375 H 225 L 235,335 Z"
        fill="url(#zap-accent-green)"
      />
    </svg>
  );
}

export default BrandLogo;
