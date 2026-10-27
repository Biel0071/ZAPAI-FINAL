import React from "react";

export function ZaiLogo({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="zai-grad-logo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#zai-grad-logo)" fillOpacity="0.2" stroke="url(#zai-grad-logo)" strokeWidth="1.3" />
      <path d="M7 8h10l-6.5 8H17" stroke="url(#zai-grad-logo)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="8" r="1.3" fill="#10b981" />
      <circle cx="7" cy="16" r="1.3" fill="#06b6d4" />
    </svg>
  );
}

export function OpenAILogo({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#10a37f" fillOpacity="0.18" stroke="#10a37f" strokeWidth="1.3" />
      <path
        d="M17.5 9.5a3.4 3.4 0 0 0-.3-2.8 3.5 3.5 0 0 0-3.7-1.6 3.5 3.5 0 0 0-2.3-1A3.4 3.4 0 0 0 8 5.7a3.5 3.5 0 0 0-.4 2.8 3.4 3.4 0 0 0-2.3 1.7 3.5 3.5 0 0 0 .4 4 3.4 3.4 0 0 0 .3 2.8 3.5 3.5 0 0 0 3.7 1.6 3.5 3.5 0 0 0 2.3 1 3.4 3.4 0 0 0 3.2-1.6 3.5 3.5 0 0 0 .4-2.8 3.4 3.4 0 0 0 2.3-1.7 3.5 3.5 0 0 0-.4-4zm-5.2 7.2a2.6 2.6 0 0 1-1.6-.6l2.7-1.6a.4.4 0 0 0 .2-.4v-3.8l1.1.7a.04.04 0 0 1 .02.03v3.1a2.5 2.5 0 0 1-2.4 2.6zm-5.4-2.3a2.6 2.6 0 0 1-.3-1.7l2.7 1.6a.4.4 0 0 0 .4 0l3.3-1.9v1.3a.04.04 0 0 1-.02.04l-2.7 1.6a2.6 2.6 0 0 1-3.4-.9zm-1.4-5.1a2.6 2.6 0 0 1 1.4-1.1v3.1a.4.4 0 0 0 .2.4l3.3 1.9-1.1.7a.04.04 0 0 1-.04 0l-2.7-1.6a2.6 2.6 0 0 1-1.1-3.4zm9.4 2.2l-3.3-1.9 1.1-.7a.04.04 0 0 1 .04 0l2.7 1.6a2.6 2.6 0 0 1-.4 4.6v-3.2a.4.4 0 0 0-.2-.4zm1.1-1.7a.4.4 0 0 0-.4 0L12.7 8v-1.3a.04.04 0 0 1 .02-.04l2.7-1.6a2.6 2.6 0 0 1 3.8 2.6l-2.7-1.6zm-4.7-4.4a2.6 2.6 0 0 1 4.2-2l-2.7 1.6a.4.4 0 0 0-.2.4v3.8l-1.1-.7a.04.04 0 0 1-.02-.03V5.4z"
        fill="#10a37f"
      />
    </svg>
  );
}

export function GroqLogo({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#F55036" fillOpacity="0.18" stroke="#F55036" strokeWidth="1.3" />
      <path d="M12.5 5.5L7.5 12.5H12L11.5 18.5L16.5 11.5H12L12.5 5.5Z" fill="#F55036" stroke="#F55036" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function DeepSeekLogo({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#0066FF" fillOpacity="0.18" stroke="#0066FF" strokeWidth="1.3" />
      <path
        d="M17.8 9.8c-.3-.4-.8-.7-1.4-.9-1.2-.5-3-.8-4.9-.8-2.6 0-4.9.7-6.2 1.8-1 1-1.3 1.7-1.3 2.3 0 .9.7 1.7 2 2.3 1.3.6 3.1 1 5.3 1 1.6 0 3-.2 4.2-.6 1.1-.4 1.9-.9 2.4-1.5.6-.8.7-1.7.5-2.4-.2-.5-.4-.9-.6-1.2zm-1.3 2.5c-.4.5-1.1.9-2.1 1.2-1 .3-2.3.5-3.8.5-1.9 0-3.5-.3-4.6-.8-.9-.4-1.2-.9-1.2-1.2 0-.4.4-.8 1.3-1.3 1.2-.6 3.2-.9 5.8-.9 1.6 0 3 .3 3.8.7.6.3 1 .6 1.1 1 .1.5 0 1-.3 1.4z"
        fill="#0066FF"
      />
      <circle cx="15.5" cy="11.2" r="0.9" fill="#0066FF" />
    </svg>
  );
}

export function ClaudeLogo({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#D97757" fillOpacity="0.18" stroke="#D97757" strokeWidth="1.3" />
      <path
        d="M13.2 4.5a1.2 1.2 0 0 0-1.6 0l-1.8 1.5a.8.8 0 0 1-.9.1L6.7 5.2a1.2 1.2 0 0 0-1.4.9l-.6 2.3a.8.8 0 0 1-.6.6l-2.3.6a1.2 1.2 0 0 0-.9 1.4l.9 2.2a.8.8 0 0 1-.1.9l-1.5 1.8a1.2 1.2 0 0 0 0 1.6l1.5 1.8a.8.8 0 0 1 .1.9l-.9 2.2a1.2 1.2 0 0 0 .9 1.4l2.3.6a.8.8 0 0 1 .6.6l.6 2.3a1.2 1.2 0 0 0 1.4.9l2.2-.9a.8.8 0 0 1 .9.1l1.8 1.5a1.2 1.2 0 0 0 1.6 0l1.8-1.5a.8.8 0 0 1 .9-.1l2.2.9a1.2 1.2 0 0 0 1.4-.9l.6-2.3a.8.8 0 0 1 .6-.6l2.3-.6a1.2 1.2 0 0 0 .9-1.4l-.9-2.2a.8.8 0 0 1 .1-.9l1.5-1.8a1.2 1.2 0 0 0 0-1.6l-1.5-1.8a.8.8 0 0 1-.1-.9l.9-2.2a1.2 1.2 0 0 0-.9-1.4l-2.3-.6a.8.8 0 0 1-.6-.6l-.6-2.3a1.2 1.2 0 0 0-1.4-.9l-2.2.9a.8.8 0 0 1-.9-.1L13.2 4.5z"
        fill="#D97757"
      />
    </svg>
  );
}

export function GeminiLogo({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="gemini-grad-logo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4E82EE" />
          <stop offset="50%" stopColor="#7E57C2" />
          <stop offset="100%" stopColor="#F06292" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#gemini-grad-logo)" fillOpacity="0.18" stroke="url(#gemini-grad-logo)" strokeWidth="1.3" />
      <path d="M12 4.5C12 8.64 8.64 12 4.5 12C8.64 12 12 15.36 12 19.5C12 15.36 15.36 12 19.5 12C15.36 12 12 8.64 12 4.5Z" fill="url(#gemini-grad-logo)" />
    </svg>
  );
}

export function OllamaLogo({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="6" fill="#64748b" fillOpacity="0.2" stroke="#64748b" strokeWidth="1.3" />
      <path d="M9 18V11a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v7M10 7V5m4 2V5" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="11.5" r="1" fill="#cbd5e1" />
      <circle cx="14" cy="11.5" r="1" fill="#cbd5e1" />
    </svg>
  );
}

export function ProviderLogo({
  providerId,
  className = "h-4 w-4 shrink-0",
}: {
  providerId?: string;
  className?: string;
}) {
  const norm = String(providerId || "").toLowerCase().trim();
  if (norm === "vps_engine" || norm === "vps" || norm === "zai" || norm === "vps_api" || norm === "api_platform") {
    return <ZaiLogo className={className} />;
  }
  if (norm === "openai") return <OpenAILogo className={className} />;
  if (norm === "groq") return <GroqLogo className={className} />;
  if (norm === "deepseek") return <DeepSeekLogo className={className} />;
  if (norm === "claude") return <ClaudeLogo className={className} />;
  if (norm === "gemini") return <GeminiLogo className={className} />;
  if (norm === "ollama") return <OllamaLogo className={className} />;
  return <ZaiLogo className={className} />;
}
