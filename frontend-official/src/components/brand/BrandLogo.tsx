import { useState } from "react";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  /** Rendered pixel size (width & height). Default 44. */
  size?: number;
  /** Extra classes for the wrapping element. */
  className?: string;
  /** Subtle pulse (used on loading screens). */
  animated?: boolean;
  /** Force a variant instead of theme-driven (e.g. on a colored splash). */
  forceZColor?: "black" | "white";
}

/**
 * ZAPFLOW "Z" brand logo.
 *
 * Prefers the real brand PNGs in /public/brand:
 *   - brand/logo-dark.png  → Z with a BLACK body (used on the LIGHT theme)
 *   - brand/logo-light.png → Z with a WHITE body (used on the DARK theme)
 *
 * Both variants are rendered and toggled purely by CSS (`dark:` classes) so the
 * correct one shows without JS. If an image fails to load (files not added yet),
 * we fall back to the inline SVG mark so the UI never shows a broken image.
 */
export function BrandLogo({ size = 44, className, animated = false, forceZColor }: BrandLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return <BrandLogoSvg size={size} className={className} animated={animated} forceZColor={forceZColor} />;
  }

  // Which PNG to show. When forced, show a single variant; otherwise toggle by theme.
  const darkBodySrc = "/brand/logo-dark.png"; // black Z → for light backgrounds
  const whiteBodySrc = "/brand/logo-light.png"; // white Z → for dark backgrounds

  const commonImgClass = "object-contain";
  const style = { width: size, height: size };

  if (forceZColor === "black") {
    return <img src={darkBodySrc} alt="ZAPFLOW AI" style={style} onError={() => setImgFailed(true)} className={cn(commonImgClass, animated && "zf-logo-pulse", className)} />;
  }
  if (forceZColor === "white") {
    return <img src={whiteBodySrc} alt="ZAPFLOW AI" style={style} onError={() => setImgFailed(true)} className={cn(commonImgClass, animated && "zf-logo-pulse", className)} />;
  }

  return (
    <span className={cn("inline-flex", animated && "zf-logo-pulse", className)} style={style} aria-label="ZAPFLOW AI" role="img">
      {/* Light theme → black-bodied logo */}
      <img
        src={darkBodySrc}
        alt="ZAPFLOW AI"
        style={style}
        onError={() => setImgFailed(true)}
        className={cn(commonImgClass, "block dark:hidden")}
      />
      {/* Dark theme → white-bodied logo */}
      <img
        src={whiteBodySrc}
        alt="ZAPFLOW AI"
        style={style}
        onError={() => setImgFailed(true)}
        className={cn(commonImgClass, "hidden dark:block")}
      />
    </span>
  );
}

/** Inline SVG fallback (approximation) used only if the PNGs are missing. */
function BrandLogoSvg({ size = 44, className, animated = false, forceZColor }: BrandLogoProps) {
  const zColorClass =
    forceZColor === "black"
      ? "text-[#111111]"
      : forceZColor === "white"
        ? "text-white"
        : "text-[#111111] dark:text-white";

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
        <linearGradient id="zf-ring" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#3ef23e" />
          <stop offset="50%" stopColor="#1bbf2f" />
          <stop offset="100%" stopColor="#0a6b22" />
        </linearGradient>
        <linearGradient id="zf-zbase" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3ef23e" />
          <stop offset="100%" stopColor="#0a7a26" />
        </linearGradient>
      </defs>
      <path
        d="M40 22 A52 52 0 1 1 40 106 L24 120 L34 98"
        stroke="url(#zf-ring)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
      />
      <g stroke="url(#zf-ring)" strokeWidth="4.5" strokeLinecap="round">
        <line x1="20" y1="44" x2="46" y2="44" />
        <line x1="10" y1="60" x2="44" y2="60" />
        <line x1="20" y1="76" x2="46" y2="76" />
      </g>
      <g fill="none" stroke="url(#zf-ring)" strokeWidth="4">
        <circle cx="16" cy="44" r="4.5" />
        <circle cx="6" cy="60" r="4.5" />
        <circle cx="16" cy="76" r="4.5" />
      </g>
      <path d="M50 40 H88 L64 70 H52 L74 45 H50 Z" fill="currentColor" />
      <path d="M52 70 H84 L80 88 H50 L60 72 Z" fill="url(#zf-zbase)" />
    </svg>
  );
}

export default BrandLogo;
