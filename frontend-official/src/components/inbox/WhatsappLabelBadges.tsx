import React from "react";
import { cn } from "@/core/lib/utils";

interface WhatsappLabelBadgesProps {
  labels?: string[];
  maxVisible?: number;
  className?: string;
}

/**
 * Real WhatsApp labels (source = whatsapp): always BLUE with a "WA" marker so they are
 * never confused with funnel/system tags (green). Read-only: the system never edits them.
 */
export function WhatsappLabelBadges({ labels = [], maxVisible = 2, className }: WhatsappLabelBadgesProps) {
  if (!Array.isArray(labels) || labels.length === 0) return null;
  const visible = labels.slice(0, maxVisible);
  const overflow = labels.length - visible.length;
  return (
    <span
      className={cn("inline-flex flex-wrap items-center gap-1", className)}
      data-testid="whatsapp-label-badges"
      aria-label={`Etiquetas do WhatsApp: ${labels.join(", ")}`}
    >
      {visible.map((label) => (
        <span
          key={label}
          title={`Etiqueta do WhatsApp: ${label}`}
          className="inline-flex max-w-[120px] items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-sky-600 dark:text-sky-300"
        >
          <span className="rounded-sm bg-sky-500 px-1 text-[8px] font-bold text-white">WA</span>
          <span className="truncate">{label}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={labels.slice(maxVisible).join(", ")}
          className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-300"
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
