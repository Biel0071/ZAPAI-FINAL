import React from "react";
import { AgentIdentity, AgentHairStyle, AgentClothingStyle } from "./AgentIdentity";
import { cn } from "@/core/lib/utils";

interface AgentCharacterProps {
  agent: AgentIdentity;
  pose: "seated" | "standing";
  isTyping?: boolean;
  className?: string;
  onClick?: () => void;
}

export const AgentCharacter: React.FC<AgentCharacterProps> = ({
  agent,
  pose,
  isTyping = false,
  className,
  onClick,
}) => {
  const appearance = agent?.appearance || {
    gender: agent?.character?.gender || (agent?.key === "rafael" ? "male" : "female"),
    skinTone: "#f5c6a5",
    hairStyle: agent?.key === "rafael" ? "short_sidepart" : "ponytail",
    hairColor: "#4a2c11",
    clothingStyle: "uniforme_loja",
    clothingColor: agent?.character?.theme === "emerald" ? "#10b981" : "#0ea5e9",
    accessories: ["headset", "cracha"],
  };
  const presenceState = agent?.presenceState || (agent?.active !== false ? "ONLINE" : "OFFLINE");
  const name = agent?.name || "Atendente";
  const key = agent?.key || "agent";
  const {
    gender = "female",
    skinTone = "#f5c6a5",
    hairStyle = "ponytail",
    hairColor = "#4a2c11",
    clothingStyle = "uniforme_loja",
    clothingColor = "#10b981",
    accessories = ["headset", "cracha"],
  } = appearance;

  const isBlinking = presenceState !== "OFFLINE";
  const hasHeadset = accessories.includes("headset");
  const hasCracha = accessories.includes("cracha");
  const hasGlasses = accessories.includes("oculos");
  const isMale = gender === "male" || key === "rafael";

  // Derive unique lighting gradients based on character skin & hair
  const charId = `char-${key || "agent"}-${pose}`;

  // 1. RENDER BACK HAIR (Drawn BEHIND the head and face)
  const renderBackHair = () => {
    switch (hairStyle) {
      case "ponytail": // CAMILA: High ponytail plume arching to the right
        return (
          <g id="hair-ponytail-back">
            {/* Back Hair Silhouette Behind Scalp */}
            <path
              d="M 36 34 C 36 22, 64 22, 64 34 C 64 38, 62 42, 62 42 L 38 42 C 38 42, 36 38, 36 34 Z"
              fill={`url(#hairDarkGrad-${charId})`}
            />
            {/* Plume Arching High with Volume & Bounce */}
            <path
              d="M 58 31 C 72 24, 82 42, 78 66 C 75 72, 70 74, 69 66 C 70 50, 66 36, 58 31 Z"
              fill={`url(#hairGrad-${charId})`}
              filter={`url(#softShadow-${charId})`}
            />
            {/* Specular Strand on Ponytail */}
            <path
              d="M 61 34 C 73 30, 77 46, 74 60"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.2"
              opacity="0.35"
              strokeLinecap="round"
            />
            {/* Ponytail Scrunchie */}
            <ellipse cx="58" cy="31" rx="4" ry="2.6" fill={clothingColor} stroke="#ffffff" strokeWidth="0.6" />
          </g>
        );

      case "wavy_long": // JULIA: Cascading rich waves behind shoulders
        return (
          <g id="hair-wavy-back">
            <path
              d="M 33 34 C 31 46, 27 62, 30 82 C 33 86, 38 84, 37 74 C 35 62, 37 48, 40 38 Z"
              fill={`url(#hairDarkGrad-${charId})`}
            />
            <path
              d="M 67 34 C 69 46, 73 62, 70 82 C 67 86, 62 84, 63 74 C 65 62, 63 48, 60 38 Z"
              fill={`url(#hairDarkGrad-${charId})`}
            />
          </g>
        );

      case "short_fade": // RAFAEL: Short back
      default:
        return (
          <g id="hair-back-default">
            <path
              d="M 36 34 C 36 22, 64 22, 64 34 C 64 38, 62 42, 62 42 L 38 42 C 38 42, 36 38, 36 34 Z"
              fill={`url(#hairDarkGrad-${charId})`}
            />
          </g>
        );
    }
  };

  // 2. RENDER FRONT HAIR (Drawn ABOVE the head, framing the crown & forehead without covering eyes or face)
  const renderFrontHair = () => {
    switch (hairStyle) {
      case "ponytail": // CAMILA: Crown volume & side face-framing fringes
        return (
          <g id="hair-ponytail-front">
            {/* Forehead Crown & Bangs (Starts high at y=20, hairline arches at y=33-35, above eyebrows at y=37) */}
            <path
              d="M 36 34 C 36 20, 64 20, 64 34 C 64 34, 58 32, 50 32 C 42 32, 36 34, 36 34 Z"
              fill={`url(#hairGrad-${charId})`}
            />
            {/* Left face-framing fringe (Stays on left temple x<=38) */}
            <path
              d="M 36 34 C 34 40, 36 48, 38 48 C 37 43, 37 38, 40 35 Z"
              fill={`url(#hairDarkGrad-${charId})`}
            />
            {/* Right face-framing fringe (Stays on right temple x>=62) */}
            <path
              d="M 64 34 C 66 40, 64 48, 62 48 C 63 43, 63 38, 60 35 Z"
              fill={`url(#hairDarkGrad-${charId})`}
            />
            {/* Crown Specular Arc */}
            <path
              d="M 40 24 Q 50 20 60 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.3"
              opacity="0.4"
              strokeLinecap="round"
            />
          </g>
        );

      case "short_fade": // RAFAEL: Textured modern quiff
        return (
          <g id="hair-short-fade-front">
            {/* Top Textured Quiff */}
            <path
              d="M 36 31 C 37 20, 63 20, 64 31 C 65 24, 58 19, 50 19 C 42 19, 35 24, 36 31 Z"
              fill={`url(#hairGrad-${charId})`}
            />
            {/* Forehead Hairline Lock (stays above y=34) */}
            <path
              d="M 37 32 Q 44 26 53 27 Q 46 31 37 32"
              fill={`url(#hairGrad-${charId})`}
            />
            {/* Temple Hairline Fade */}
            <path d="M 36 33 L 38 38 L 36 38 Z" fill={hairColor} opacity="0.4" />
            <path d="M 64 33 L 62 38 L 64 38 Z" fill={hairColor} opacity="0.4" />
            {/* Texture Strands */}
            <line x1="43" y1="21" x2="46" y2="25" stroke="#ffffff" strokeWidth="0.8" opacity="0.3" strokeLinecap="round" />
            <line x1="49" y1="20" x2="52" y2="24" stroke="#ffffff" strokeWidth="0.8" opacity="0.3" strokeLinecap="round" />
          </g>
        );

      case "wavy_long": // JULIA: Cascading rich waves framing face
        return (
          <g id="hair-wavy-front">
            <path
              d="M 35 34 C 35 19, 65 19, 65 34 C 65 34, 58 32, 50 32 C 42 32, 35 34, 35 34 Z"
              fill={`url(#hairGrad-${charId})`}
            />
            {/* Left Curled Lock */}
            <path
              d="M 35 34 C 33 46, 31 58, 34 68 C 36 70, 38 66, 37 58 C 36 48, 38 40, 40 35 Z"
              fill={`url(#hairGrad-${charId})`}
            />
            {/* Right Curled Lock */}
            <path
              d="M 65 34 C 67 46, 69 58, 66 68 C 64 70, 62 66, 63 58 C 64 48, 62 40, 60 35 Z"
              fill={`url(#hairGrad-${charId})`}
            />
            <path
              d="M 40 24 Q 50 20 60 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.3"
              opacity="0.4"
              strokeLinecap="round"
            />
          </g>
        );

      default:
        return (
          <g id="hair-front-default">
            <path
              d="M 36 34 C 36 21, 64 21, 64 34 C 64 34, 58 32, 50 32 C 42 32, 36 34, 36 34 Z"
              fill={`url(#hairGrad-${charId})`}
            />
          </g>
        );
    }
  };

  // RENDER VOLUMETRIC FACE & EXPRESSIONS
  const renderFace = () => {
    return (
      <g id="character-face-volumetric">
        {/* Neck with anatomical shading */}
        <path
          d="M 46 54 L 46 64 L 54 64 L 54 54 Z"
          fill={`url(#neckGrad-${charId})`}
        />
        {/* Soft shadow under chin */}
        <ellipse cx="50" cy="56" rx="5" ry="1.5" fill="#000000" opacity="0.25" />

        {/* Sculpted Head Base (Natural Tapered Jawline, not raw circle) */}
        <path
          d="M 37 36 C 36 48, 41 57, 50 58.5 C 59 57, 64 48, 63 36 C 63 26, 37 26, 37 36 Z"
          fill={`url(#skinGrad-${charId})`}
          filter={`url(#headGlow-${charId})`}
        />

        {/* Ears with inner cartilage detail */}
        <path d="M 35.5 40 C 34 40, 33.5 45, 35 47 C 36 48, 37 46, 36.5 43 Z" fill={skinTone} stroke="#df9c75" strokeWidth="0.4" />
        <path d="M 64.5 40 C 66 40, 66.5 45, 65 47 C 64 48, 63 46, 63.5 43 Z" fill={skinTone} stroke="#df9c75" strokeWidth="0.4" />

        {/* Female Delicate Cheek Blush */}
        {!isMale && (
          <>
            <ellipse cx="41" cy="46" rx="3.5" ry="2" fill="#f43f5e" opacity="0.22" />
            <ellipse cx="59" cy="46" rx="3.5" ry="2" fill="#f43f5e" opacity="0.22" />
          </>
        )}

        {/* Male Subtle Five O'clock Shadow / Stubble */}
        {isMale && (
          <path
            d="M 40 48 C 41 54, 45 57, 50 57.5 C 55 57, 59 54, 60 48 C 58 50, 42 50, 40 48 Z"
            fill="#1e293b"
            opacity="0.16"
          />
        )}

        {/* EYES (Almond shape, realistic iris, dual catchlights, blinking) */}
        <g className={cn(isBlinking && "animate-[blink_4.5s_infinite]")}>
          {/* Left Eye Whites */}
          <path
            d="M 40.5 41 C 42 39.5, 45 39.5, 46.5 41 C 45 42.5, 42 42.5, 40.5 41 Z"
            fill="#ffffff"
          />
          {/* Left Iris & Pupil */}
          <circle cx="43.5" cy="41" r="1.8" fill={isMale ? "#1e293b" : "#451a03"} />
          <circle cx="43.5" cy="41" r="1" fill="#000000" />
          {/* Left Primary Catchlight */}
          <circle cx="44" cy="40.5" r="0.6" fill="#ffffff" />
          <circle cx="43" cy="41.5" r="0.3" fill="#ffffff" opacity="0.8" />
          {/* Left Eyelash / Lid Line */}
          <path
            d="M 40 41 Q 43.5 39.2 47 41"
            fill="none"
            stroke="#18181b"
            strokeWidth={isMale ? "0.8" : "1.2"}
            strokeLinecap="round"
          />

          {/* Right Eye Whites */}
          <path
            d="M 53.5 41 C 55 39.5, 58 39.5, 59.5 41 C 58 42.5, 55 42.5, 53.5 41 Z"
            fill="#ffffff"
          />
          {/* Right Iris & Pupil */}
          <circle cx="56.5" cy="41" r="1.8" fill={isMale ? "#1e293b" : "#451a03"} />
          <circle cx="56.5" cy="41" r="1" fill="#000000" />
          {/* Right Catchlight */}
          <circle cx="57" cy="40.5" r="0.6" fill="#ffffff" />
          <circle cx="56" cy="41.5" r="0.3" fill="#ffffff" opacity="0.8" />
          {/* Right Eyelash / Lid Line */}
          <path
            d="M 53 41 Q 56.5 39.2 60 41"
            fill="none"
            stroke="#18181b"
            strokeWidth={isMale ? "0.8" : "1.2"}
            strokeLinecap="round"
          />

          {/* Eyebrows (Sculpted with Natural Arch) */}
          <path
            d={isMale ? "M 39 37.5 Q 43.5 36.2 47 37.8" : "M 39.5 37.2 Q 43.5 35.5 47 37.2"}
            fill="none"
            stroke={hairColor}
            strokeWidth={isMale ? "1.4" : "1.1"}
            strokeLinecap="round"
          />
          <path
            d={isMale ? "M 53 37.8 Q 56.5 36.2 61 37.5" : "M 53 37.2 Q 56.5 35.5 60.5 37.2"}
            fill="none"
            stroke={hairColor}
            strokeWidth={isMale ? "1.4" : "1.1"}
            strokeLinecap="round"
          />
        </g>

        {/* Nose with Bridge Highlight & Soft Nostrils */}
        <path d="M 50 39 L 49.3 45.2 Q 50 46.2 51.2 45.5" fill="none" stroke="#d97706" strokeWidth="0.75" strokeLinecap="round" opacity="0.65" />
        <ellipse cx="50" cy="44.8" rx="0.8" ry="0.6" fill="#ffffff" opacity="0.4" />

        {/* Expressive Warm Mouth / Smile */}
        {presenceState === "WORKING" || presenceState === "RESPONDING" ? (
          <g id="mouth-working">
            {/* Friendly Confident Smile with Soft Lip Tone */}
            <path
              d="M 45.5 49 Q 50 53.5 54.5 49"
              fill={isMale ? "#be123c" : "#e11d48"}
              stroke="#881337"
              strokeWidth="0.7"
              opacity="0.9"
            />
            {/* White Teeth Accent */}
            <path d="M 47 49.5 Q 50 51.5 53 49.5" fill="#ffffff" />
          </g>
        ) : presenceState === "ERROR" ? (
          <path d="M 46 51.5 Q 50 48.5 54 51.5" fill="none" stroke="#881337" strokeWidth="1.3" strokeLinecap="round" />
        ) : (
          <g id="mouth-idle">
            <path
              d="M 46.5 49.5 Q 50 52 53.5 49.5"
              fill="none"
              stroke={isMale ? "#991b1b" : "#be123c"}
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path d="M 48 51.5 Q 50 52.8 52 51.5" fill="none" stroke="#f43f5e" strokeWidth="0.7" opacity="0.6" />
          </g>
        )}

        {/* Designer Glasses Accessory */}
        {hasGlasses && (
          <g id="accessory-glasses" filter={`url(#softShadow-${charId})`}>
            {/* Frame Acetate */}
            <rect x="39" y="38" width="10" height="7.5" rx="2.5" fill="rgba(15,23,42,0.15)" stroke="#090d16" strokeWidth="1.3" />
            <rect x="51" y="38" width="10" height="7.5" rx="2.5" fill="rgba(15,23,42,0.15)" stroke="#090d16" strokeWidth="1.3" />
            {/* Bridge */}
            <path d="M 49 40 Q 50 38.5 51 40" fill="none" stroke="#090d16" strokeWidth="1.4" strokeLinecap="round" />
            {/* Temples */}
            <line x1="39" y1="40" x2="35" y2="39" stroke="#090d16" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="61" y1="40" x2="65" y2="39" stroke="#090d16" strokeWidth="1.2" strokeLinecap="round" />
            {/* Lens Specular Reflection */}
            <line x1="41" y1="39.5" x2="44" y2="43.5" stroke="#ffffff" strokeWidth="0.7" opacity="0.6" strokeLinecap="round" />
            <line x1="53" y1="39.5" x2="56" y2="43.5" stroke="#ffffff" strokeWidth="0.7" opacity="0.6" strokeLinecap="round" />
          </g>
        )}

        {/* Professional Headset with Live Mic LED */}
        {hasHeadset && (
          <g id="accessory-headset">
            {/* Arch headband over head */}
            <path d="M 34 38 C 32 18, 68 18, 66 38" fill="none" stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 34 38 C 32 18, 68 18, 66 38" fill="none" stroke="#334155" strokeWidth="1" strokeLinecap="round" />
            {/* Left Ear Cushion */}
            <rect x="32" y="37" width="4.5" height="11" rx="2" fill="#090d16" stroke={clothingColor} strokeWidth="0.8" />
            {/* Right Ear Cushion */}
            <rect x="63.5" y="37" width="4.5" height="11" rx="2" fill="#090d16" stroke={clothingColor} strokeWidth="0.8" />
            {/* Mic Boom Arm */}
            <path d="M 34 44 Q 34 55 43.5 53.5" fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
            {/* Active Mic Head & Neon Green Transmission LED */}
            <circle cx="44" cy="53.5" r="2.2" fill="#0f172a" />
            <circle cx="44" cy="53.5" r="1.4" fill="#10b981" className="animate-pulse" />
          </g>
        )}
      </g>
    );
  };

  // RENDER DETAILED TAILORED APPAREL (Blazer, Polo, Executive Suit)
  const renderClothingDetails = () => {
    switch (clothingStyle) {
      case "social_executivo": // Executive Suit / CS Blouse (Julia style)
        return (
          <g id="clothing-executivo">
            {/* Silk V-neck Inset */}
            <polygon points="46,62 50,74 54,62" fill="#ffffff" />
            {/* Executive Collar Lapels */}
            <path d="M 40 60 L 46 76 L 39 77 Z" fill="#090d16" opacity="0.35" />
            <path d="M 60 60 L 54 76 L 61 77 Z" fill="#090d16" opacity="0.35" />
            {/* Delicate Pearl Necklace for Executive CS */}
            {!isMale && (
              <path d="M 46 63 Q 50 67 54 63" fill="none" stroke="#f8fafc" strokeWidth="1.2" strokeDasharray="1.2,1.2" />
            )}
            {/* Silk Tie for Male Executive */}
            {isMale && (
              <polygon points="48.5,63 51.5,63 52.5,80 50,84 47.5,80" fill="#e11d48" stroke="#9f1239" strokeWidth="0.5" />
            )}
            {/* Pocket Handkerchief Accent */}
            <line x1="56" y1="72" x2="60" y2="72" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        );

      case "polo_comercial": // Technical Support Polo (Rafael style)
        return (
          <g id="clothing-polo">
            {/* Ribbed Collar */}
            <path d="M 44 60 L 47 68 L 50 65 L 50 60 Z" fill="#090d16" opacity="0.4" />
            <path d="M 56 60 L 53 68 L 50 65 L 50 60 Z" fill="#090d16" opacity="0.4" />
            {/* Button Placket */}
            <rect x="48.5" y="62" width="3" height="12" rx="0.8" fill="#ffffff" opacity="0.9" />
            {/* Buttons */}
            <circle cx="50" cy="65" r="0.7" fill="#0f172a" />
            <circle cx="50" cy="70" r="0.7" fill="#0f172a" />
            {/* Shoulder Seams */}
            <line x1="36" y1="64" x2="44" y2="60" stroke="#000000" strokeWidth="0.8" opacity="0.3" />
            <line x1="64" y1="64" x2="56" y2="60" stroke="#000000" strokeWidth="0.8" opacity="0.3" />
          </g>
        );

      case "uniforme_loja": // ZAI Corporate Store Uniform (Camila style: tailored black/charcoal with emerald details)
      default:
        return (
          <g id="clothing-uniforme">
            {/* Inner Emerald Silk Shirt / V-Neck */}
            <polygon points="45,61 50,73 55,61" fill={clothingColor} />
            {/* Left Tailored Lapel with subtle emerald piping */}
            <path d="M 36 60 L 46 76 L 43 88 L 35 86 Z" fill="#0b1120" stroke={clothingColor} strokeWidth="0.5" />
            {/* Right Tailored Lapel */}
            <path d="M 64 60 L 54 76 L 57 88 L 65 86 Z" fill="#0b1120" stroke={clothingColor} strokeWidth="0.5" />
            {/* Metallic Center Button */}
            <circle cx="50" cy="77" r="1.1" fill="#cbd5e1" stroke="#090d16" strokeWidth="0.4" />
            {/* Subtle Emerald Collar Edge */}
            <path d="M 43 60 Q 50 63 57 60" fill="none" stroke={clothingColor} strokeWidth="1" strokeLinecap="round" />
          </g>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center select-none transition-all duration-300",
        className
      )}
    >
      {/* SVG DEFS: VOLUMETRIC GRADIENTS & AMBIENT SHADOWS */}
      <svg className="absolute w-0 h-0 pointer-events-none">
        <defs>
          {/* Volumetric Skin Gradient */}
          <linearGradient id={`skinGrad-${charId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="35%" stopColor={skinTone} />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0.4" />
          </linearGradient>

          {/* Neck Occlusion Shadow */}
          <linearGradient id={`neckGrad-${charId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b45309" stopOpacity="0.6" />
            <stop offset="60%" stopColor={skinTone} />
            <stop offset="100%" stopColor="#92400e" stopOpacity="0.3" />
          </linearGradient>

          {/* Volumetric Hair Highlight Gradient */}
          <linearGradient id={`hairGrad-${charId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="30%" stopColor={hairColor} />
            <stop offset="100%" stopColor="#090d16" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={`hairDarkGrad-${charId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hairColor} />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
          </linearGradient>

          {/* Tailored Clothing Gradient */}
          <linearGradient id={`clothingGrad-${charId}`} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="25%" stopColor={clothingColor} />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id={`blazerGrad-${charId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090d16" />
          </linearGradient>

          {/* Trousers Fabric Gradient */}
          <linearGradient id={`trousersGrad-${charId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* Floor Radial Shadow */}
          <radialGradient id={`floorContactShadow-${charId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#000000" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Drop Shadow Filter */}
          <filter id={`softShadow-${charId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.6" />
          </filter>
          <filter id={`headGlow-${charId}`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.35" />
          </filter>
        </defs>
      </svg>

      {/* ========================================================
         MODE A: SEATED WORKING AT EXECUTIVE WORKSPACE
         3/4 Engaging Perspective: Head, Face, Torso, Arms on Desk,
         Hands with Knuckles/Fingers on Keyboard/Mouse, Legs & Shoes
         ======================================================== */}
      {pose === "seated" ? (
        <svg
          viewBox="0 0 100 135"
          className="w-full h-full max-h-[360px] object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.85)]"
        >
          {/* 1. EXECUTIVE CHAIR (Behind Character with Depth) */}
          <g id="chair-seated-depth">
            {/* Headrest */}
            <rect x="42" y="10" width="16" height="8" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
            <line x1="50" y1="18" x2="50" y2="24" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
            {/* High Ergonomic Mesh Backrest */}
            <path
              d="M 33 24 C 33 22, 67 22, 67 24 L 69 70 C 69 75, 31 75, 31 70 Z"
              fill="#0b1120"
              stroke="#334155"
              strokeWidth="1.2"
            />
            {/* Mesh Texture Lattice */}
            <path
              d="M 35 30 L 65 30 M 34 38 L 66 38 M 34 46 L 66 46 M 33 54 L 67 54 M 33 62 L 67 62"
              stroke="#1e293b"
              strokeWidth="0.8"
              strokeDasharray="2,2"
              opacity="0.6"
            />
            {/* Chrome Lumbar Support Bracket */}
            <path d="M 30 52 Q 50 62 70 52" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" />
            {/* Chair Armrests (Under arms) */}
            <rect x="25" y="66" width="6" height="2" rx="1" fill="#475569" />
            <line x1="28" y1="68" x2="28" y2="82" stroke="#1e293b" strokeWidth="2.2" />
            <rect x="69" y="66" width="6" height="2" rx="1" fill="#475569" />
            <line x1="72" y1="68" x2="72" y2="82" stroke="#1e293b" strokeWidth="2.2" />
            {/* Heavy Hydraulic Gas Cylinder & 5-Star Wheel Base */}
            <line x1="50" y1="88" x2="50" y2="114" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
            <path d="M 28 119 L 50 115 L 72 119" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <circle cx="28" cy="121" r="2.4" fill="#090d16" stroke="#475569" strokeWidth="0.6" />
            <circle cx="50" cy="117" r="2.4" fill="#090d16" stroke="#475569" strokeWidth="0.6" />
            <circle cx="72" cy="121" r="2.4" fill="#090d16" stroke="#475569" strokeWidth="0.6" />
          </g>

          {/* 2. LEGS & FEET (Bent Naturally Under Desk Toward Chair Base) */}
          <g id="legs-seated-anatomy">
            {/* Left Thigh extending forward under seat */}
            <path d="M 37 84 L 35 106 L 45 106 L 47 84 Z" fill={`url(#trousersGrad-${charId})`} />
            {/* Right Thigh extending forward */}
            <path d="M 53 84 L 55 106 L 65 106 L 63 84 Z" fill={`url(#trousersGrad-${charId})`} />
            {/* Knees anatomical shading */}
            <ellipse cx="40" cy="106" rx="5" ry="3" fill="#0f172a" />
            <ellipse cx="60" cy="106" rx="5" ry="3" fill="#0f172a" />
            {/* Shins resting down to floor */}
            <rect x="37" y="106" width="7" height="13" rx="2" fill="#020617" />
            <rect x="56" y="106" width="7" height="13" rx="2" fill="#020617" />
            {/* Shoes with White Enterprise Sneaker/Sole Trim */}
            <path d="M 34 119 C 33 121, 33 124, 38 124 L 46 124 C 47 121, 46 119, 44 119 Z" fill="#090d16" />
            <rect x="34" y="122.5" width="12" height="1.8" rx="0.9" fill="#e2e8f0" />
            <path d="M 54 119 C 53 121, 53 124, 58 124 L 66 124 C 67 121, 66 119, 64 119 Z" fill="#090d16" />
            <rect x="54" y="122.5" width="12" height="1.8" rx="0.9" fill="#e2e8f0" />
          </g>

          {/* 3. TORSO & APPAREL WITH BREATHING MICRO-ANIMATION */}
          <g id="torso-seated" className="animate-[breathe_4s_ease-in-out_infinite]">
            {/* Main Tailored Torso Silhouette */}
            <path
              d="M 35 60 Q 50 56 65 60 L 63 88 Q 50 91 37 88 Z"
              fill={clothingStyle === "uniforme_loja" ? `url(#blazerGrad-${charId})` : `url(#clothingGrad-${charId})`}
              stroke="#0f172a"
              strokeWidth="0.8"
              filter={`url(#softShadow-${charId})`}
            />
            {renderClothingDetails()}

            {/* Official ZAI Employee Badge / Lanyard */}
            {hasCracha && (
              <g id="cracha-accessory" filter={`url(#softShadow-${charId})`}>
                <path d="M 46 60 L 50 70 L 54 60" fill="none" stroke="#047857" strokeWidth="1.2" />
                <rect x="47" y="70" width="6" height="8.5" rx="1" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.5" />
                {/* Employee Photo Slot */}
                <rect x="48" y="71" width="4" height="3.5" rx="0.5" fill={clothingColor} />
                {/* Employee Name Line & Barcode */}
                <line x1="48" y1="75.5" x2="52" y2="75.5" stroke="#0f172a" strokeWidth="0.6" />
                <line x1="48" y1="77" x2="52" y2="77" stroke="#10b981" strokeWidth="0.6" />
              </g>
            )}

            {/* 4. ARMS & REAL HANDS (Extended over desk with Fingers & Knuckles) */}
            <g id="arms-seated-realistic">
              {/* Left Arm & Sleeve with Cuff Seam */}
              <path
                d="M 36 62 C 27 72, 28 82, 40 85"
                fill="none"
                stroke={clothingStyle === "uniforme_loja" ? "#111827" : clothingColor}
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Left Sleeve Cuff with accent trim */}
              <ellipse
                cx="40"
                cy="85"
                rx="3.2"
                ry="2"
                fill={clothingStyle === "uniforme_loja" ? clothingColor : "#0f172a"}
                opacity={clothingStyle === "uniforme_loja" ? 0.9 : 0.6}
              />

              {/* Left Hand with Palm & Articulated Fingers (Typing or Resting on Keys) */}
              <g
                id="hand-left"
                className={cn(
                  "origin-[42px_85px] transition-transform duration-150",
                  isTyping && "animate-bounce [animation-duration:0.22s]"
                )}
              >
                {/* Palm Base */}
                <ellipse cx="43" cy="85.5" rx="2.8" ry="2" fill={skinTone} />
                {/* Thumb */}
                <path d="M 42 85 Q 43 88 45 88" fill="none" stroke={skinTone} strokeWidth="1.6" strokeLinecap="round" />
                {/* Index & Middle Fingers pressing keyboard keys */}
                <line x1="44" y1="84.5" x2="47" y2="85" stroke={skinTone} strokeWidth="1.4" strokeLinecap="round" />
                <line x1="44" y1="86" x2="47" y2="86.8" stroke={skinTone} strokeWidth="1.4" strokeLinecap="round" />
              </g>

              {/* Right Arm & Sleeve extending to Mouse / Keyboard */}
              <path
                d="M 64 62 C 73 72, 72 82, 60 85"
                fill="none"
                stroke={clothingStyle === "uniforme_loja" ? "#111827" : clothingColor}
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Right Sleeve Cuff with accent trim */}
              <ellipse
                cx="60"
                cy="85"
                rx="3.2"
                ry="2"
                fill={clothingStyle === "uniforme_loja" ? clothingColor : "#0f172a"}
                opacity={clothingStyle === "uniforme_loja" ? 0.9 : 0.6}
              />

              {/* Right Hand cupped over Optical Mouse / Keys */}
              <g
                id="hand-right"
                className={cn(
                  "origin-[58px_85px] transition-transform duration-150",
                  isTyping && "animate-bounce [animation-duration:0.22s] [animation-delay:0.11s]"
                )}
              >
                {/* Palm Base */}
                <ellipse cx="57" cy="85.5" rx="2.8" ry="2" fill={skinTone} />
                {/* Thumb */}
                <path d="M 58 85 Q 57 88 55 88" fill="none" stroke={skinTone} strokeWidth="1.6" strokeLinecap="round" />
                {/* Fingers resting naturally */}
                <line x1="56" y1="84.5" x2="53" y2="85" stroke={skinTone} strokeWidth="1.4" strokeLinecap="round" />
                <line x1="56" y1="86" x2="53" y2="86.8" stroke={skinTone} strokeWidth="1.4" strokeLinecap="round" />
              </g>
            </g>

            {/* 5. HEAD, VOLUMETRIC FACE & HAIR (Unobstructed Layering) */}
            {renderBackHair()}
            {renderFace()}
            {renderFrontHair()}
          </g>
        </svg>
      ) : (
        /* ========================================================
           MODE B: FULL-BODY STANDING IN EXECUTIVE OFFICE ("Boneco Maior")
           Complete Human Anatomy: Head, Torso, Belt, Full Legs,
           Shoes with Soles firmly on Floor with Contact Shadow
           ======================================================== */
        <svg
          viewBox="0 0 100 155"
          className="w-full h-full max-h-[340px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.95)]"
        >
          {/* 1. FLOOR CONTACT SHADOW & AMBIENT PEDESTAL GLOW */}
          <ellipse cx="50" cy="148" rx="26" ry="6" fill={`url(#floorContactShadow-${charId})`} />
          <ellipse cx="50" cy="148" rx="16" ry="3.5" fill="#000000" opacity="0.9" />

          {/* 2. STANDING ANATOMICAL BODY WITH RELAXED BREATHING */}
          <g className="animate-[breathe_4s_ease-in-out_infinite]">
            {/* FULL LEGS & TAILORED TROUSERS */}
            <g id="legs-standing-proportional">
              {/* Waistband & Metallic Belt Buckle */}
              <rect x="36" y="85" width="28" height="4.5" rx="1" fill="#090d16" />
              <rect x="47.5" y="84.5" width="5" height="5.5" rx="1" fill="#cbd5e1" stroke="#090d16" strokeWidth="0.6" />
              <rect x="49" y="86" width="2" height="2.5" fill="#090d16" />

              {/* Left Tapered Leg */}
              <path
                d="M 37 89.5 L 39.5 137 L 46.5 137 L 48.5 89.5 Z"
                fill={`url(#trousersGrad-${charId})`}
                stroke="#090d16"
                strokeWidth="0.8"
              />
              {/* Right Tapered Leg */}
              <path
                d="M 51.5 89.5 L 53.5 137 L 60.5 137 L 63 89.5 Z"
                fill={`url(#trousersGrad-${charId})`}
                stroke="#090d16"
                strokeWidth="0.8"
              />

              {/* Tailored Front Crease Highlights */}
              <line x1="43" y1="92" x2="43" y2="135" stroke="#334155" strokeWidth="0.8" opacity="0.6" />
              <line x1="57" y1="92" x2="57" y2="135" stroke="#334155" strokeWidth="0.8" opacity="0.6" />
              {/* Subtle Knee Shadow Fold */}
              <path d="M 40 114 Q 43 116 46 114" fill="none" stroke="#020617" strokeWidth="0.9" opacity="0.7" />
              <path d="M 54 114 Q 57 116 60 114" fill="none" stroke="#020617" strokeWidth="0.9" opacity="0.7" />
            </g>

            {/* FULL DETAILED SHOES FIRMLY ON THE FLOOR */}
            <g id="shoes-standing-detailed">
              {/* Left Shoe: Sleek Leather Oxford with Sole */}
              <path
                d="M 37.5 137 C 35 140, 32 144, 34 147 L 48 147 C 49 143, 47.5 138, 46 137 Z"
                fill="#090d16"
                stroke="#1e293b"
                strokeWidth="0.5"
              />
              {/* White/Grey Sole Layer */}
              <rect x="33.5" y="145.5" width="15" height="2" rx="1" fill="#475569" />

              {/* Right Shoe */}
              <path
                d="M 54 137 C 52.5 138, 51 143, 52 147 L 66 147 C 68 144, 65 140, 62.5 137 Z"
                fill="#090d16"
                stroke="#1e293b"
                strokeWidth="0.5"
              />
              {/* White/Grey Sole Layer */}
              <rect x="51.5" y="145.5" width="15" height="2" rx="1" fill="#475569" />
            </g>

            {/* TORSO & CLOTHING IN RELAXED STANDING POSTURE */}
            <g id="torso-standing">
              <path
                d="M 35 59 Q 50 55 65 59 L 64 87 Q 50 89 36 87 Z"
                fill={clothingStyle === "uniforme_loja" ? `url(#blazerGrad-${charId})` : `url(#clothingGrad-${charId})`}
                stroke="#0f172a"
                strokeWidth="0.8"
                filter={`url(#softShadow-${charId})`}
              />
              {renderClothingDetails()}

              {/* Crachá */}
              {hasCracha && (
                <g id="cracha-standing" filter={`url(#softShadow-${charId})`}>
                  <path d="M 46 60 L 50 70 L 54 60" fill="none" stroke="#047857" strokeWidth="1.2" />
                  <rect x="47" y="70" width="6" height="8.5" rx="1" fill="#ffffff" stroke="#94a3b8" strokeWidth="0.5" />
                  <rect x="48" y="71" width="4" height="3.5" rx="0.5" fill={clothingColor} />
                  <line x1="48" y1="75.5" x2="52" y2="75.5" stroke="#0f172a" strokeWidth="0.6" />
                  <line x1="48" y1="77" x2="52" y2="77" stroke="#10b981" strokeWidth="0.6" />
                </g>
              )}
            </g>

            {/* ARMS RELAXED AT SIDES WITH NATURAL HANDS & FINGERS */}
            <g id="arms-standing-natural">
              {/* Left Arm Hanging Relaxed */}
              <path
                d="M 36 61 C 29 74, 30 86, 33 97"
                fill="none"
                stroke={clothingStyle === "uniforme_loja" ? "#111827" : clothingColor}
                strokeWidth="5.8"
                strokeLinecap="round"
              />
              <ellipse
                cx="33"
                cy="97"
                rx="3"
                ry="1.8"
                fill={clothingStyle === "uniforme_loja" ? clothingColor : "#0f172a"}
                opacity={clothingStyle === "uniforme_loja" ? 0.9 : 0.6}
              />
              {/* Left Hand with Thumb and Curled Fingers */}
              <ellipse cx="33" cy="100.5" rx="2.6" ry="3.2" fill={skinTone} />
              <path d="M 34.5 99 Q 36 101 35.5 103" fill="none" stroke={skinTone} strokeWidth="1.2" strokeLinecap="round" />

              {/* Right Arm Hanging Relaxed */}
              <path
                d="M 64 61 C 71 74, 70 86, 67 97"
                fill="none"
                stroke={clothingStyle === "uniforme_loja" ? "#111827" : clothingColor}
                strokeWidth="5.8"
                strokeLinecap="round"
              />
              <ellipse
                cx="67"
                cy="97"
                rx="3"
                ry="1.8"
                fill={clothingStyle === "uniforme_loja" ? clothingColor : "#0f172a"}
                opacity={clothingStyle === "uniforme_loja" ? 0.9 : 0.6}
              />
              {/* Right Hand */}
              <ellipse cx="67" cy="100.5" rx="2.6" ry="3.2" fill={skinTone} />
              <path d="M 65.5 99 Q 64 101 64.5 103" fill="none" stroke={skinTone} strokeWidth="1.2" strokeLinecap="round" />
            </g>

            {/* HEAD, VOLUMETRIC FACE & HAIR (Unobstructed Layering) */}
            {renderBackHair()}
            {renderFace()}
            {renderFrontHair()}
          </g>
        </svg>
      )}
    </div>
  );
};
