import React from "react";
import { cn } from "@/core/lib/utils";

interface WhatsappLabelBadgesProps {
  labels?: string[];
  maxVisible?: number;
  className?: string;
}

const OFFICIAL_WPP_COLORS_MAP: Record<string, string> = {
  "orçamento": "#f97316",
  "orcamento": "#f97316",
  "dados para entrega": "#12b7f5",
  "entrega": "#12b7f5",
  "aguardando pagamento": "#8b5cf6",
  "pagamento": "#8b5cf6",
  "pago": "#64748b",
  "novo cliente": "#00d26a",
  "novo lead": "#00d26a",
  "cliente": "#00d26a",
  "cancelado": "#ef4444",
  "agendando": "#3b82f6",
  "agendado": "#3b82f6",
  "suporte": "#ec4899",
  "vip": "#eab308",
};

const PALETTE_FALLBACKS = [
  "#00d26a", "#12b7f5", "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#64748b", "#a855f7"
];

function getLabelColor(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (OFFICIAL_WPP_COLORS_MAP[normalized]) return OFFICIAL_WPP_COLORS_MAP[normalized];
  for (const [key, color] of Object.entries(OFFICIAL_WPP_COLORS_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return color;
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  return PALETTE_FALLBACKS[hash % PALETTE_FALLBACKS.length];
}

/**
 * Real WhatsApp labels with authentic WhatsApp Web colors and indicators.
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
      {visible.map((label) => {
        const hex = getLabelColor(label);
        return (
          <span
            key={label}
            title={`Etiqueta WhatsApp: ${label}`}
            className="inline-flex max-w-[85px] items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-2xs shrink-0"
            style={{
              backgroundColor: `${hex}18`,
              borderColor: `${hex}45`,
              color: hex,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
            <span className="truncate">{label}</span>
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          title={labels.slice(maxVisible).join(", ")}
          className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
