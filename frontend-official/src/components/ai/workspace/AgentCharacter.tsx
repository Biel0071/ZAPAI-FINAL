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
  const { appearance, presenceState } = agent;
  const {
    gender = "female",
    skinTone = "#e2b07e",
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

  // RENDER HAIR SHAPES ACCORDING TO HAIR STYLE
  const renderHair = () => {
    switch (hairStyle) {
      case "ponytail":
        return (
          <g id="hair-ponytail">
            {/* Top crown */}
            <path
              d="M 40 45 C 38 28, 62 28, 60 45 C 60 40, 40 40, 40 45 Z"
              fill={hairColor}
            />
            <circle cx="50" cy="38" r="16" fill={hairColor} />
            {/* Side bangs */}
            <path d="M 37 40 C 37 54, 42 58, 42 58 C 40 50, 40 42, 43 38 Z" fill={hairColor} />
            <path d="M 63 40 C 63 54, 58 58, 58 58 C 60 50, 60 42, 57 38 Z" fill={hairColor} />
            {/* Back high ponytail */}
            <path
              d="M 60 36 C 72 38, 76 56, 73 70 C 70 72, 67 65, 68 55 C 68 45, 63 40, 60 36 Z"
              fill={hairColor}
              className="drop-shadow-sm"
            />
            {/* Ponytail tie */}
            <ellipse cx="61" cy="37" rx="3" ry="2" fill={clothingColor} />
          </g>
        );

      case "wavy_long":
        return (
          <g id="hair-wavy-long">
            <circle cx="50" cy="38" r="17" fill={hairColor} />
            {/* Left flowing wave */}
            <path
              d="M 36 38 C 34 50, 31 66, 34 80 C 36 84, 40 78, 39 70 C 38 60, 42 50, 42 42 Z"
              fill={hairColor}
            />
            {/* Right flowing wave */}
            <path
              d="M 64 38 C 66 50, 69 66, 66 80 C 64 84, 60 78, 61 70 C 62 60, 58 50, 58 42 Z"
              fill={hairColor}
            />
            {/* Forehead fringe */}
            <path d="M 40 34 Q 50 38 60 34 Q 50 29 40 34" fill={hairColor} />
          </g>
        );

      case "short_fade":
        return (
          <g id="hair-short-fade">
            {/* Modern faded trim on sides */}
            <path
              d="M 38 46 C 36 30, 64 30, 62 46 C 64 33, 36 33, 38 46 Z"
              fill={hairColor}
            />
            <path d="M 37 38 C 37 30, 63 30, 63 38 C 60 27, 40 27, 37 38 Z" fill={hairColor} />
            {/* Top texture */}
            <rect x="42" y="26" width="16" height="5" rx="2.5" fill={hairColor} />
            <rect x="44" y="24" width="12" height="4" rx="2" fill={hairColor} />
          </g>
        );

      case "afro_puff":
        return (
          <g id="hair-afro-puff">
            {/* Rich rounded afro silhouette */}
            <circle cx="50" cy="36" r="21" fill={hairColor} />
            <circle cx="34" cy="38" r="8" fill={hairColor} />
            <circle cx="66" cy="38" r="8" fill={hairColor} />
            <circle cx="50" cy="22" r="10" fill={hairColor} />
            <circle cx="38" cy="26" r="8" fill={hairColor} />
            <circle cx="62" cy="26" r="8" fill={hairColor} />
          </g>
        );

      case "buzz_cut":
        return (
          <g id="hair-buzz-cut">
            {/* Close shaved trim */}
            <path
              d="M 38 42 C 38 29, 62 29, 62 42 Q 50 36 38 42"
              fill={hairColor}
              opacity="0.9"
            />
          </g>
        );

      case "undercut":
        return (
          <g id="hair-undercut">
            {/* Shaved sides, swept voluminous top */}
            <path d="M 38 34 Q 50 23 62 30 Q 64 25 50 22 Q 36 25 38 34" fill={hairColor} />
            <rect x="42" y="24" width="16" height="8" rx="3" fill={hairColor} />
            <path d="M 39 36 L 43 45 L 41 45 Z" fill={hairColor} opacity="0.6" />
            <path d="M 61 36 L 57 45 L 59 45 Z" fill={hairColor} opacity="0.6" />
          </g>
        );

      case "curly_bob":
        return (
          <g id="hair-curly-bob">
            <circle cx="50" cy="36" r="17" fill={hairColor} />
            <circle cx="36" cy="44" r="6" fill={hairColor} />
            <circle cx="34" cy="52" r="6.5" fill={hairColor} />
            <circle cx="64" cy="44" r="6" fill={hairColor} />
            <circle cx="66" cy="52" r="6.5" fill={hairColor} />
            <circle cx="50" cy="25" r="7" fill={hairColor} />
          </g>
        );

      case "straight_mid":
      default:
        return (
          <g id="hair-straight-mid">
            <circle cx="50" cy="38" r="16.5" fill={hairColor} />
            <rect x="36" y="38" width="5" height="24" rx="2.5" fill={hairColor} />
            <rect x="59" y="38" width="5" height="24" rx="2.5" fill={hairColor} />
            <path d="M 40 33 Q 50 36 60 33 Q 50 28 40 33" fill={hairColor} />
          </g>
        );
    }
  };

  // RENDER FACE & EXPRESSIONS
  const renderFace = () => {
    return (
      <g id="character-head">
        {/* Neck */}
        <rect x="46" y="54" width="8" height="9" fill={skinTone} rx="2" />

        {/* Head Base */}
        <circle cx="50" cy="42" r="14" fill={skinTone} />

        {/* Ears */}
        <circle cx="36" cy="43" r="3.2" fill={skinTone} />
        <circle cx="64" cy="43" r="3.2" fill={skinTone} />

        {/* Eyes (With Natural Blink) */}
        <g className={cn(isBlinking && "animate-[blink_4s_infinite]")}>
          {/* Left Eye */}
          <circle cx="45" cy="42" r="2.2" fill="#0f172a" />
          <circle cx="45.7" cy="41.3" r="0.8" fill="#ffffff" />

          {/* Right Eye */}
          <circle cx="55" cy="42" r="2.2" fill="#0f172a" />
          <circle cx="55.7" cy="41.3" r="0.8" fill="#ffffff" />

          {/* Eyebrows */}
          <path d="M 42.5 38.5 Q 45 37 47.5 38.5" stroke="#1e293b" strokeWidth="0.9" fill="none" strokeLinecap="round" />
          <path d="M 52.5 38.5 Q 55 37 57.5 38.5" stroke="#1e293b" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        </g>

        {/* Nose */}
        <path d="M 50 43 L 49.2 46.5 L 51 46.5" stroke="#a36e3c" strokeWidth="0.8" fill="none" strokeLinecap="round" />

        {/* Mouth / Smile */}
        {presenceState === "ERROR" ? (
          <path d="M 47 50 Q 50 48 53 50" stroke="#881337" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        ) : presenceState === "WORKING" || presenceState === "RESPONDING" ? (
          <path d="M 46.5 48.5 Q 50 52 53.5 48.5" stroke="#991b1b" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M 47 49 Q 50 51.5 53 49" stroke="#991b1b" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        )}

        {/* Glasses Accessory */}
        {hasGlasses && (
          <g id="accessory-glasses">
            <rect x="41" y="39.5" width="8" height="6" rx="2" fill="none" stroke="#0f172a" strokeWidth="1.1" />
            <rect x="51" y="39.5" width="8" height="6" rx="2" fill="none" stroke="#0f172a" strokeWidth="1.1" />
            <line x1="49" y1="42.5" x2="51" y2="42.5" stroke="#0f172a" strokeWidth="1.1" />
            <line x1="37" y1="41" x2="41" y2="41.5" stroke="#0f172a" strokeWidth="0.9" />
            <line x1="59" y1="41.5" x2="63" y2="41" stroke="#0f172a" strokeWidth="0.9" />
          </g>
        )}

        {/* Headset Accessory */}
        {hasHeadset && (
          <g id="accessory-headset">
            {/* Headband arch */}
            <path d="M 36 42 C 34 22, 66 22, 64 42" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
            {/* Left earphone pad */}
            <rect x="33.5" y="38" width="4.5" height="9" rx="2" fill="#0f172a" />
            <rect x="34.5" y="39.5" width="2" height="6" rx="1" fill={clothingColor} />
            {/* Right earphone pad */}
            <rect x="62" y="38" width="4.5" height="9" rx="2" fill="#0f172a" />
            <rect x="63.5" y="39.5" width="2" height="6" rx="1" fill={clothingColor} />
            {/* Microphone boom */}
            <path d="M 35 45 Q 36 54 44 53" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="45" cy="53" r="1.8" fill="#10b981" className="animate-pulse" />
          </g>
        )}
      </g>
    );
  };

  // RENDER CLOTHING DETAILS (Uniform, Executive Suit, Polo, etc.)
  const renderClothingDetails = () => {
    switch (clothingStyle) {
      case "social_executivo":
        return (
          <>
            {/* White Dress Shirt V-neck */}
            <polygon points="46,60 50,72 54,60" fill="#ffffff" />
            {/* Silk Tie */}
            <polygon points="48.5,63 51.5,63 52,78 50,82 48,78" fill="#e11d48" />
            {/* Suit Lapels */}
            <path d="M 42 60 L 46 75 L 42 77 Z" fill="#090d16" opacity="0.3" />
            <path d="M 58 60 L 54 75 L 58 77 Z" fill="#090d16" opacity="0.3" />
          </>
        );

      case "polo_comercial":
        return (
          <>
            {/* Polo Collar */}
            <polygon points="45,60 48,67 50,65 50,60" fill="#ffffff" />
            <polygon points="55,60 52,67 50,65 50,60" fill="#ffffff" />
            <line x1="50" y1="65" x2="50" y2="74" stroke="#ffffff" strokeWidth="1" />
            {/* Buttons */}
            <circle cx="50" cy="68" r="0.7" fill="#1e293b" />
            <circle cx="50" cy="72" r="0.7" fill="#1e293b" />
          </>
        );

      case "avental_balcao":
        return (
          <>
            {/* Inner T-shirt */}
            <rect x="44" y="60" width="12" height="6" fill="#1e293b" />
            {/* Specialist Apron Bib */}
            <polygon points="43,64 57,64 58,85 42,85" fill="#334155" />
            {/* Apron Straps */}
            <line x1="43" y1="64" x2="48" y2="60" stroke="#1e293b" strokeWidth="1.2" />
            <line x1="57" y1="64" x2="52" y2="60" stroke="#1e293b" strokeWidth="1.2" />
            {/* Front pocket */}
            <rect x="46" y="73" width="8" height="6" rx="1" fill="#1e293b" />
          </>
        );

      case "casual_tech":
        return (
          <>
            {/* Hoodie V-neck strings */}
            <path d="M 46 62 Q 50 67 54 62" fill="none" stroke="#ffffff" strokeWidth="1.2" />
            <line x1="48" y1="65" x2="48" y2="73" stroke="#e2e8f0" strokeWidth="0.8" />
            <line x1="52" y1="65" x2="52" y2="73" stroke="#e2e8f0" strokeWidth="0.8" />
          </>
        );

      case "uniforme_loja":
      default:
        return (
          <>
            {/* Standard Store Uniform Collar */}
            <polygon points="46,60 50,65 54,60" fill="#ffffff" />
            <circle cx="50" cy="62.5" r="1.2" fill={clothingColor} />
            {/* ZAI / Store Brand Patch */}
            <rect x="42" y="66" width="5" height="3" rx="0.5" fill="#ffffff" opacity="0.9" />
            <line x1="43" y1="67.5" x2="46" y2="67.5" stroke={clothingColor} strokeWidth="1" />
          </>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center transition-transform select-none cursor-pointer",
        className
      )}
      title={`${agent.name} • ${agent.role} (${pose === "seated" ? "No computador trabalhando" : "Em pé aguardando"})`}
    >
      {pose === "seated" ? (
        /* ========================================================
           FULL-BODY ANATOMY: SITTING AT ERGONOMIC DESK
           Includes Chair, Torso, Arms on Desk, Bent Legs, Shoes
           ======================================================== */
        <svg
          viewBox="0 0 100 130"
          className="w-full h-full max-h-[300px] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)]"
        >
          <defs>
            {/* Linear gradient for clothing */}
            <linearGradient id="clothingGradSeated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={clothingColor} />
              <stop offset="100%" stopColor={clothingColor} stopOpacity="0.85" />
            </linearGradient>
            {/* Chair gradient */}
            <linearGradient id="chairGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* 1. ERGONOMIC CHAIR (Backrest & Headrest Behind Character) */}
          <g id="ergonomic-chair-back">
            {/* Headrest */}
            <rect x="39" y="16" width="22" height="10" rx="4" fill="url(#chairGrad)" stroke="#334155" strokeWidth="1" />
            {/* Chair Main Backrest */}
            <path
              d="M 32 30 C 30 50, 28 85, 30 92 C 34 94, 66 94, 70 92 C 72 85, 70 50, 68 30 Z"
              fill="url(#chairGrad)"
              stroke="#334155"
              strokeWidth="1.2"
            />
            {/* Lumbar cushion accent */}
            <rect x="36" y="68" width="28" height="10" rx="3" fill="#334155" opacity="0.6" />
            {/* Armrests */}
            <rect x="25" y="66" width="6" height="18" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="0.8" />
            <rect x="69" y="66" width="6" height="18" rx="3" fill="#1e293b" stroke="#334155" strokeWidth="0.8" />
          </g>

          {/* 2. CHAIR BASE & HYDRAULIC STEM (Visible Under Desk) */}
          <g id="chair-base">
            <rect x="48" y="96" width="4" height="20" fill="#475569" />
            {/* 5-Star Wheel Base */}
            <path d="M 30 118 L 50 114 L 70 118" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="29" cy="120" r="2.2" fill="#0f172a" />
            <circle cx="50" cy="116" r="2.2" fill="#0f172a" />
            <circle cx="71" cy="120" r="2.2" fill="#0f172a" />
          </g>

          {/* 3. LEGS & FEET (Bent Under Desk While Seated) */}
          <g id="legs-seated">
            {/* Thighs under seat */}
            <rect x="38" y="86" width="10" height="22" rx="4" fill="#1e293b" />
            <rect x="52" y="86" width="10" height="22" rx="4" fill="#1e293b" />
            {/* Lower Shins */}
            <rect x="39" y="104" width="8" height="15" rx="3" fill="#0f172a" />
            <rect x="53" y="104" width="8" height="15" rx="3" fill="#0f172a" />
            {/* Shoes resting on floor */}
            <ellipse cx="43" cy="120" rx="5.5" ry="3.5" fill="#020617" />
            <ellipse cx="57" cy="120" rx="5.5" ry="3.5" fill="#020617" />
            <rect x="38.5" y="121" width="9" height="2" rx="1" fill="#475569" />
            <rect x="52.5" y="121" width="9" height="2" rx="1" fill="#475569" />
          </g>

          {/* 4. UPPER BODY / TORSO */}
          <g id="torso-seated" className="animate-[breathe_4s_ease-in-out_infinite]">
            {/* Main Torso */}
            <path
              d="M 36 60 Q 50 56 64 60 L 63 88 Q 50 90 37 88 Z"
              fill="url(#clothingGradSeated)"
              stroke="#0f172a"
              strokeWidth="0.8"
            />
            {renderClothingDetails()}

            {/* Crachá / Badge Accessory */}
            {hasCracha && (
              <g id="accessory-cracha">
                {/* Lanyard */}
                <path d="M 46 60 L 50 69 L 54 60" fill="none" stroke="#334155" strokeWidth="0.9" />
                {/* Badge Card */}
                <rect x="47.5" y="69" width="5" height="7" rx="0.8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
                <rect x="48.5" y="70" width="3" height="2.5" fill={clothingColor} />
                <line x1="48.5" y1="73.5" x2="51.5" y2="73.5" stroke="#334155" strokeWidth="0.6" />
              </g>
            )}

            {/* 5. ARMS EXTENDED TO DESK (Typing or Mouse Interaction) */}
            <g id="arms-seated">
              {/* Left Arm & Forearm reaching forward to keyboard */}
              <path
                d="M 36 62 Q 28 72 35 83 Q 40 85 45 83"
                fill="none"
                stroke={clothingColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Left Hand on keyboard */}
              <circle
                cx="46"
                cy="84"
                r="3"
                fill={skinTone}
                className={cn(isTyping && "animate-bounce [animation-duration:0.25s]")}
              />

              {/* Right Arm reaching to Mouse / Keyboard */}
              <path
                d="M 64 62 Q 72 72 65 83 Q 60 85 55 83"
                fill="none"
                stroke={clothingColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Right Hand */}
              <circle
                cx="54"
                cy="84"
                r="3"
                fill={skinTone}
                className={cn(isTyping && "animate-bounce [animation-duration:0.25s] [animation-delay:0.12s]")}
              />
            </g>

            {/* 6. HEAD, FACE & HAIR */}
            {renderFace()}
            {renderHair()}
          </g>
        </svg>
      ) : (
        /* ========================================================
           FULL-BODY ANATOMY: STANDING IN OFFICE ("Boneco Maior")
           Complete Upright Anatomy: Head, Torso, Full Legs, Shoes
           ======================================================== */
        <svg
          viewBox="0 0 100 150"
          className="w-full h-full max-h-[300px] object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.9)]"
        >
          <defs>
            <linearGradient id="clothingGradStanding" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={clothingColor} />
              <stop offset="100%" stopColor={clothingColor} stopOpacity="0.88" />
            </linearGradient>
            {/* Floor Shadow Pedestal */}
            <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={clothingColor} stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>

          {/* Floor Ambient Glow & Contact Shadow */}
          <ellipse cx="50" cy="144" rx="28" ry="6" fill="url(#floorGlow)" />
          <ellipse cx="50" cy="144" rx="20" ry="3.5" fill="#000000" opacity="0.6" />

          {/* STANDING BODY GROUP WITH RELAXED BREATHING ANIMATION */}
          <g className="animate-[breathe_4s_ease-in-out_infinite]">
            {/* 1. FULL LEGS & TROUSERS / SKIRT */}
            <g id="legs-standing">
              {/* Belt / Waist */}
              <rect x="36" y="86" width="28" height="4" rx="1" fill="#0f172a" />
              <rect x="48" y="86" width="4" height="4" fill="#e2e8f0" />

              {/* Left Leg */}
              <path
                d="M 37 90 L 40 134 L 46 134 L 48 90 Z"
                fill="#1e293b"
                stroke="#0f172a"
                strokeWidth="0.8"
              />
              {/* Right Leg */}
              <path
                d="M 52 90 L 54 134 L 60 134 L 63 90 Z"
                fill="#1e293b"
                stroke="#0f172a"
                strokeWidth="0.8"
              />

              {/* Knees subtle creases */}
              <line x1="40" y1="112" x2="45" y2="112" stroke="#334155" strokeWidth="0.8" />
              <line x1="55" y1="112" x2="60" y2="112" stroke="#334155" strokeWidth="0.8" />
            </g>

            {/* 2. FULL SHOES FIRMLY ON THE FLOOR */}
            <g id="shoes-standing">
              {/* Left Shoe */}
              <path d="M 38 134 C 36 136, 33 140, 34 143 L 47 143 C 48 139, 47 135, 46 134 Z" fill="#090d16" />
              <rect x="34" y="141" width="13" height="2" rx="1" fill="#475569" />

              {/* Right Shoe */}
              <path d="M 54 134 C 53 135, 52 139, 53 143 L 66 143 C 67 140, 64 136, 62 134 Z" fill="#090d16" />
              <rect x="53" y="141" width="13" height="2" rx="1" fill="#475569" />
            </g>

            {/* 3. TORSO & CLOTHING */}
            <g id="torso-standing">
              <path
                d="M 35 60 Q 50 56 65 60 L 64 88 Q 50 90 36 88 Z"
                fill="url(#clothingGradStanding)"
                stroke="#0f172a"
                strokeWidth="0.8"
              />
              {renderClothingDetails()}

              {/* Crachá */}
              {hasCracha && (
                <g id="accessory-cracha-standing">
                  <path d="M 46 60 L 50 69 L 54 60" fill="none" stroke="#334155" strokeWidth="0.9" />
                  <rect x="47.5" y="69" width="5" height="7" rx="0.8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
                  <rect x="48.5" y="70" width="3" height="2.5" fill={clothingColor} />
                  <line x1="48.5" y1="73.5" x2="51.5" y2="73.5" stroke="#334155" strokeWidth="0.6" />
                </g>
              )}
            </g>

            {/* 4. ARMS RELAXED AT SIDES */}
            <g id="arms-standing">
              {/* Left Arm */}
              <path
                d="M 36 62 Q 30 76 34 94"
                fill="none"
                stroke={clothingColor}
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle cx="34" cy="97" r="3.2" fill={skinTone} />

              {/* Right Arm */}
              <path
                d="M 64 62 Q 70 76 66 94"
                fill="none"
                stroke={clothingColor}
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle cx="66" cy="97" r="3.2" fill={skinTone} />
            </g>

            {/* 5. HEAD, FACE & HAIR */}
            {renderFace()}
            {renderHair()}
          </g>
        </svg>
      )}
    </div>
  );
};
