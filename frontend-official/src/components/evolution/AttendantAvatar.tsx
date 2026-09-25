import React, { useState } from 'react';
import { AttendantConfig } from './AICharacterViewer';

export interface AttendantAvatarProps {
  name?: string;
  avatarUrl?: string;
  themeColor?: string;
  config?: AttendantConfig;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AttendantAvatar: React.FC<AttendantAvatarProps> = ({
  name = 'Atendente',
  avatarUrl,
  themeColor = '#10b981',
  config,
  className = '',
  size = 'md',
}) => {
  const [imageError, setImageError] = useState(false);

  const hairColor = config?.hairColor || '#4a2c11';
  const clothingColor = config?.clothingColor || themeColor || '#10b981';
  const skinTone = config?.skinTone || '#fcd34d';
  const gender = config?.gender || (
    name.toLowerCase().includes('camila') ||
    name.toLowerCase().includes('julia') ||
    name.toLowerCase().includes('maria') ||
    name.toLowerCase().includes('ana') ||
    name.toLowerCase().includes('vitória') ||
    name.toLowerCase().includes('vitoria') ||
    name.toLowerCase().includes('aline') ||
    name.toLowerCase().includes('larissa')
      ? 'female'
      : 'male'
  );
  const accessories = config?.accessories || ['headset', 'cracha'];

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-sm',
    xl: 'w-20 h-20 text-base',
  }[size] || 'w-10 h-10';

  // If custom avatarUrl is provided and not the fallback generic image or error
  const hasCustomUrl = Boolean(avatarUrl && !avatarUrl.includes('camila_avatar.png') && !imageError);

  if (hasCustomUrl) {
    return (
      <div
        className={`relative rounded-xl overflow-hidden shrink-0 border bg-[#0d131f] flex items-center justify-center ${sizeClasses} ${className}`}
        style={{ borderColor: clothingColor }}
      >
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Procedural Pixel-Art / Vector Avatar reflecting the store attendant's custom styling
  return (
    <div
      className={`relative rounded-xl overflow-hidden shrink-0 border bg-[#0d131f] flex items-center justify-center select-none shadow-sm ${sizeClasses} ${className}`}
      style={{ borderColor: clothingColor }}
      title={`${name} — Atendente da loja`}
    >
      <svg
        viewBox="0 0 40 40"
        className="w-full h-full"
        style={{ shapeRendering: 'crispEdges' }}
      >
        {/* Background glow */}
        <rect width="40" height="40" fill="#090d16" />
        <circle cx="20" cy="20" r="16" fill={clothingColor} fillOpacity="0.18" />

        {/* Torso / Uniform with custom store clothingColor */}
        <rect x="8" y="27" width="24" height="13" fill={clothingColor} rx="3" />

        {/* Collar / Tie */}
        {gender === 'female' ? (
          <>
            <polygon points="17,27 20,31 23,27" fill="#ffffff" />
            <rect x="18" y="29" width="4" height="2" fill={clothingColor} />
          </>
        ) : (
          <>
            <polygon points="18,27 20,30 22,27" fill="#ffffff" />
            <rect x="19" y="29" width="2" height="7" fill="#dc2626" />
          </>
        )}

        {/* Badge / Crachá */}
        {accessories.includes('cracha') && (
          <rect x="25" y="30" width="4" height="3" fill="#ffffff" rx="0.5" />
        )}

        {/* Neck */}
        <rect x="17" y="23" width="6" height="5" fill={skinTone} />

        {/* Head / Face */}
        <rect x="13" y="11" width="14" height="14" fill={skinTone} rx="2" />

        {/* Eyes */}
        <rect x="15" y="16" width="2" height="3" fill="#0f172a" />
        <rect x="16" y="16" width="1" height="1" fill="#ffffff" />
        <rect x="23" y="16" width="2" height="3" fill="#0f172a" />
        <rect x="24" y="16" width="1" height="1" fill="#ffffff" />

        {/* Glasses */}
        {accessories.includes('oculos') && (
          <g>
            <rect x="14" y="15" width="4" height="4" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            <rect x="22" y="15" width="4" height="4" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            <line x1="18" y1="17" x2="22" y2="17" stroke="#e2e8f0" strokeWidth="0.8" />
          </g>
        )}

        {/* Smile */}
        <rect x="18" y="21" width="4" height="1.5" fill="#991b1b" rx="0.5" />

        {/* Hair */}
        {gender === 'female' ? (
          <>
            <rect x="12" y="8" width="16" height="5" fill={hairColor} rx="2" />
            <rect x="11" y="11" width="3" height="13" fill={hairColor} rx="1" />
            <rect x="26" y="11" width="3" height="13" fill={hairColor} rx="1" />
          </>
        ) : (
          <>
            <rect x="12" y="7" width="16" height="6" fill={hairColor} rx="2" />
            <rect x="11" y="10" width="3" height="5" fill={hairColor} />
            <rect x="26" y="10" width="3" height="5" fill={hairColor} />
          </>
        )}

        {/* Headset */}
        {accessories.includes('headset') && (
          <g>
            <path d="M 11 14 A 9 9 0 0 1 29 14" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="10" y="13" width="2.5" height="4" fill="#38bdf8" rx="0.5" />
            <rect x="27.5" y="13" width="2.5" height="4" fill="#38bdf8" rx="0.5" />
            <path d="M 11 17 Q 13 22 17 21" fill="none" stroke="#0f172a" strokeWidth="1" />
            <circle cx="17.5" cy="21" r="1.2" fill="#38bdf8" />
          </g>
        )}
      </svg>
    </div>
  );
};
