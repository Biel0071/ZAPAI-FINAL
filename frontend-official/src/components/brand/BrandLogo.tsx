import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/core/lib/utils";

export interface BrandLogoProps {
  /** Rendered pixel size (width & height). Default 44. */
  size?: number;
  /** Extra classes for the wrapping element. */
  className?: string;
  /** Subtle pulse (used on loading screens). */
  animated?: boolean;
  /**
   * Force a variant for the Z letter ("black" for light surfaces, "white" for dark surfaces).
   * When omitted, automatically adapts to the active theme (white Z in dark mode, carbon-black Z in light mode).
   */
  forceZColor?: "black" | "white";
  /** Alias for forceZColor using theme terminology ("dark" = white Z, "light" = black Z). */
  variant?: "auto" | "dark" | "light";
}

function getDomThemeClass(): "light" | "dark" | null {
  if (typeof document === "undefined") return null;
  const cl = document.documentElement.classList;
  if (cl.contains("light")) return "light";
  if (cl.contains("dark")) return "dark";
  return null;
}

/**
 * Official ZAI Brand Logo Component (Pure Vector SVG).
 *
 * Modeled 1:1 from the official ZAI Dark & Light brand marks:
 * - Open-left neon-to-forest emerald speech bubble with tapered top-left needle tip and bottom-left tail
 * - 3 left circuit trace nodes (hollow rings + 45° angled kinks + tapered needles)
 * - Two-part stylized "Z":
 *   - Main body (top bar + diagonal leg): Pure White (#FFFFFF) in Dark Theme, Carbon Black (#0F1412) in Light Theme
 *   - Detached bottom-right bar: Emerald gradient (#0A641E -> #00C838) with parallel diagonal gap
 */
export function BrandLogo({
  size = 44,
  className,
  animated = false,
  forceZColor,
  variant = "auto",
}: BrandLogoProps) {
  const uid = useId().replace(/:/g, "");
  const { resolvedTheme, theme } = useTheme();
  const [domTheme, setDomTheme] = useState<"light" | "dark" | null>(() => getDomThemeClass());

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    setDomTheme(getDomThemeClass());
    const observer = new MutationObserver(() => {
      setDomTheme(getDomThemeClass());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const nextTheme = resolvedTheme || theme;
  const effectiveTheme = domTheme || (nextTheme === "light" ? "light" : nextTheme === "dark" ? "dark" : null);

  const resolvedZMode: "white" | "black" | "css" =
    forceZColor === "white" || variant === "dark"
      ? "white"
      : forceZColor === "black" || variant === "light"
        ? "black"
        : effectiveTheme === "light"
          ? "black"
          : effectiveTheme === "dark"
            ? "white"
            : "css";

  const bubbleGradId = `zai-bubble-grad-${uid}`;
  const circuitGradId = `zai-circuit-grad-${uid}`;
  const barGradId = `zai-bar-grad-${uid}`;
  const zWhiteGradId = `zai-z-white-${uid}`;
  const zBlackGradId = `zai-z-black-${uid}`;
  const shadowId = `zai-z-shadow-${uid}`;

  const zFill =
    resolvedZMode === "white"
      ? `url(#${zWhiteGradId})`
      : resolvedZMode === "black"
        ? `url(#${zBlackGradId})`
        : "currentColor";

  return (
    <svg
      viewBox="135 180 945 855"
      width={size}
      height={size}
      role="img"
      aria-label="ZAI Logo"
      data-theme-variant={resolvedZMode}
      className={cn(
        "shrink-0 select-none",
        resolvedZMode === "white"
          ? "text-white"
          : resolvedZMode === "black"
            ? "text-[#0F1412]"
            : "text-[#0F1412] dark:text-white",
        animated && "animate-pulse",
        className
      )}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Outer Speech Bubble Gradient: Deep Forest Left -> Vivid Neon Top-Right -> Deep Emerald Bottom */}
        <linearGradient id={bubbleGradId} x1="265" y1="880" x2="985" y2="260" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#085A18" />
          <stop offset="42%" stopColor="#0B7A22" />
          <stop offset="76%" stopColor="#00C838" />
          <stop offset="100%" stopColor="#00EB3C" />
        </linearGradient>

        {/* Left Circuit Traces Gradient: Deep Emerald Rings -> Bright Emerald Tips */}
        <linearGradient id={circuitGradId} x1="158" y1="590" x2="585" y2="590" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#075216" />
          <stop offset="50%" stopColor="#0A8424" />
          <stop offset="100%" stopColor="#00C436" />
        </linearGradient>

        {/* Detached Z Bottom-Right Bar Gradient */}
        <linearGradient id={barGradId} x1="588" y1="815" x2="870" y2="795" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#085A18" />
          <stop offset="55%" stopColor="#0A8E26" />
          <stop offset="100%" stopColor="#00C838" />
        </linearGradient>

        {/* Crisp White Z Gradient for Dark Theme */}
        <linearGradient id={zWhiteGradId} x1="480" y1="424" x2="720" y2="852" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F1F5F3" />
        </linearGradient>

        {/* Rich Carbon Black Z Gradient for Light Theme */}
        <linearGradient id={zBlackGradId} x1="480" y1="424" x2="720" y2="852" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#141A17" />
          <stop offset="100%" stopColor="#0A0E0C" />
        </linearGradient>

        {/* Subtle Elevation Shadow for Z Mark */}
        <filter id={shadowId} x="-8%" y="-8%" width="118%" height="118%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* 1. Outer Speech Bubble Arc (Tapered Top-Left Needle -> Clockwise Circle -> Bottom-Left Tail -> Rounded Lower-Left Cap) */}
      <path
        d="M 317 450
           C 365 305, 500 212, 660 212
           C 878 212, 1055 388, 1055 606.5
           C 1055 824.5, 878 1001, 660 1001
           C 586 1001, 517 980, 458 944
           L 282 1004
           C 268 1009, 259 997, 265 983
           L 352 752
           C 356 741, 369 737, 376 743
           C 382 749, 382 759, 378 769
           L 304 962
           L 455 910
           C 464 907, 472 909, 480 915
           C 533 952, 595 973, 660 973
           C 863 973, 1027 809, 1027 606.5
           C 1027 404, 863 240, 660 240
           C 507 240, 377 325, 317 450 Z"
        fill={`url(#${bubbleGradId})`}
      />

      {/* 2. Left Circuit Traces & Hollow Rings */}
      <g>
        {/* Top Circuit Ring (cx=245, cy=500, r_out=27, r_in=13) */}
        <circle
          cx="245"
          cy="500"
          r="20"
          stroke={`url(#${circuitGradId})`}
          strokeWidth="14"
          fill="none"
        />
        {/* Top Circuit Trace with 45° Kink */}
        <path
          d="M 268 492
             H 442
             L 479 530
             H 457
             L 434 507
             H 268 Z"
          fill={`url(#${circuitGradId})`}
        />

        {/* Middle Circuit Ring (cx=184, cy=590, r_out=26, r_in=13) */}
        <circle
          cx="184"
          cy="590"
          r="19.5"
          stroke={`url(#${circuitGradId})`}
          strokeWidth="13.5"
          fill="none"
        />
        {/* Middle Circuit Trace with 45° Kink + Long Tapered Needle */}
        <path
          d="M 207 583
             H 395
             L 411 600
             L 592 609
             L 402 613
             L 386 597
             H 207 Z"
          fill={`url(#${circuitGradId})`}
        />

        {/* Bottom Circuit Ring (cx=256, cy=680, r_out=26, r_in=13) */}
        <circle
          cx="256"
          cy="680"
          r="19.5"
          stroke={`url(#${circuitGradId})`}
          strokeWidth="13.5"
          fill="none"
        />
        {/* Bottom Circuit Straight Tapered Needle */}
        <path
          d="M 279 673
             L 532 681
             L 279 689 Z"
          fill={`url(#${circuitGradId})`}
        />
      </g>

      {/* 3. Stylized Z Letter — Main Body (Top Bar + Diagonal Stem) */}
      <path
        d="M 530 424
           H 852
           C 884 424, 901 456, 880 482
           L 559 852
           H 485
           C 461 852, 452 824, 469 804
           L 720 515
           H 526
           C 499 515, 484 494, 484 470
           C 484 443, 503 424, 530 424 Z"
        fill={zFill}
        filter={`url(#${shadowId})`}
      />

      {/* 4. Stylized Z Letter — Detached Bottom-Right Emerald Bar */}
      <path
        d="M 671 758
           H 870
           C 871 798, 842 852, 795 852
           H 588
           L 671 758 Z"
        fill={`url(#${barGradId})`}
      />
    </svg>
  );
}

export default BrandLogo;
