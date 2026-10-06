/**
 * Tag Emojis & Monochromatic Icons Management System
 * Provides semantic default matching, deterministic fallback hash,
 * customizable user override with localStorage persistence, and real-time syncing.
 */

export interface TagVisualDescriptor {
  type: "icon" | "emoji" | "none";
  value: string; // Icon name from Phosphor or raw emoji
  isMonochrome?: boolean; // whether to force monochrome styling matching tag badge color
  category?: string;
  label?: string;
}

const STORAGE_KEY = "zapflow_custom_tag_icons_v1";

// 1. Curated palette of Phosphor Icon names for custom icon selection
export const DETERMINISTIC_ICON_PALETTE: { name: string; label: string }[] = [
  { name: "Target", label: "Alvo" },
  { name: "Star", label: "Estrela" },
  { name: "Briefcase", label: "Negócios" },
  { name: "CurrencyDollar", label: "Finanças" },
  { name: "Flame", label: "Destaque" },
  { name: "Warning", label: "Atenção" },
  { name: "FileText", label: "Documento" },
  { name: "Wrench", label: "Ferramenta" },
  { name: "Package", label: "Entrega" },
  { name: "CreditCard", label: "Pagamento" },
  { name: "Calendar", label: "Agendamento" },
  { name: "Sun", label: "Ativo" },
  { name: "Snowflake", label: "Frio" },
  { name: "Question", label: "Dúvida" },
  { name: "Info", label: "Informação" },
  { name: "RocketLaunch", label: "Inovação" },
  { name: "ShieldCheck", label: "Segurança" },
  { name: "Lightbulb", label: "Ideia" },
  { name: "Heart", label: "Fidelidade" },
  { name: "Crown", label: "Especial" },
  { name: "Lightning", label: "Rápido" },
  { name: "Trophy", label: "Sucesso" },
  { name: "Key", label: "Acesso" },
  { name: "Gift", label: "Oferta" },
  { name: "Tag", label: "Geral" },
  { name: "CheckCircle", label: "Aprovado" },
  { name: "XCircle", label: "Cancelado" },
  { name: "Handshake", label: "Parceria" },
  { name: "ChatText", label: "Contato" },
  { name: "Bell", label: "Notificação" },
  { name: "Headset", label: "Suporte" },
  { name: "Storefront", label: "Loja" },
  { name: "Sparkle", label: "Brilho" },
  { name: "Clock", label: "Tempo" },
  { name: "BookmarkSimple", label: "Marcador" },
  { name: "UserPlus", label: "Novo Contato" },
];

// 2. Default business emojis mapping
export const DEFAULT_BUSINESS_EMOJIS: Record<string, string> = {
  // Leads & Aquisição
  "novo lead": "🎯",
  "novo_lead": "🎯",
  "lead": "🎯",
  "prospect": "🎯",
  "inbound": "📥",

  // Clientes & Fidelização
  "vip": "⭐",
  "estrela": "⭐",
  "premium": "👑",
  "cliente": "💼",
  "ativo": "✅",

  // Vendas & Fechamento
  "venda": "💰",
  "vendas": "💰",
  "compra": "🛒",
  "orcamento": "📋",
  "orçamento": "📋",
  "proposta": "📋",
  "cotacao": "📋",
  "cotação": "📋",

  // Status & Temperaturas de Negócio
  "hot": "🔥",
  "quente": "🔥",
  "urgente": "🚨",
  "urgencia": "🚨",
  "urgência": "🚨",
  "prioridade": "🚨",

  // Suporte & Operações
  "suporte": "🛠️",
  "ajuda": "🛠️",
  "financeiro": "💳",
  "pix": "💳",
  "pagamento": "💳",
  "entrega": "📦",
  "envio": "📦",
  "parceria": "🤝",
  "cancelado": "❌",
  "concluido": "✅",
  "concluído": "✅",
};

// 3. Recommended Emojis with business groupings
export const POPULAR_BUSINESS_EMOJIS: { emoji: string; label: string; category: string }[] = [
  // Negócios
  { emoji: "🎯", label: "Alvo / Lead", category: "Negócios" },
  { emoji: "💼", label: "Cliente", category: "Negócios" },
  { emoji: "💰", label: "Venda / Dinheiro", category: "Negócios" },
  { emoji: "📋", label: "Orçamento", category: "Negócios" },
  { emoji: "💳", label: "Financeiro / PIX", category: "Negócios" },
  { emoji: "📦", label: "Entrega / Pacote", category: "Negócios" },
  { emoji: "🤝", label: "Parceria", category: "Negócios" },
  { emoji: "🛒", label: "Compra", category: "Negócios" },

  // Status & Atenção
  { emoji: "⭐", label: "VIP / Estrela", category: "Status" },
  { emoji: "🚨", label: "Urgente", category: "Status" },
  { emoji: "🔥", label: "Quente / Hot", category: "Status" },
  { emoji: "❄️", label: "Frio / Cold", category: "Status" },
  { emoji: "🌤️", label: "Morno / Warm", category: "Status" },
  { emoji: "⚡", label: "Rápido / Prioridade", category: "Status" },
  { emoji: "👑", label: "Premium / VIP", category: "Status" },
  { emoji: "🏆", label: "Meta Atingida", category: "Status" },

  // Atendimento & Ações
  { emoji: "🛠️", label: "Suporte", category: "Ações" },
  { emoji: "🎧", label: "Atendimento", category: "Ações" },
  { emoji: "❓", label: "Dúvida", category: "Ações" },
  { emoji: "ℹ️", label: "Informação", category: "Ações" },
  { emoji: "📅", label: "Agendamento", category: "Ações" },
  { emoji: "💬", label: "Mensagem", category: "Ações" },
  { emoji: "✅", label: "Concluído", category: "Ações" },
  { emoji: "❌", label: "Cancelado", category: "Ações" },

  // Diversos
  { emoji: "🏷️", label: "Etiqueta", category: "Geral" },
  { emoji: "📌", label: "Fixado", category: "Geral" },
  { emoji: "💡", label: "Ideia", category: "Geral" },
  { emoji: "💎", label: "Valioso", category: "Geral" },
  { emoji: "🚀", label: "Lançamento", category: "Geral" },
  { emoji: "🔔", label: "Notificação", category: "Geral" },
  { emoji: "🍀", label: "Oportunidade", category: "Geral" },
  { emoji: "🔑", label: "Chave", category: "Geral" },
];

/**
 * Normalizes tag string for reliable matching (removes accents, trims, lowercases).
 */
export function normalizeTagName(rawTag: string): string {
  return String(rawTag || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Checks if a string starts with a unicode emoji.
 */
const EMOJI_REGEX = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

export function extractLeadingEmoji(text: string): { emoji: string | null; cleanText: string } {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(EMOJI_REGEX);
  if (match) {
    const emoji = match[0];
    const cleanText = trimmed.slice(emoji.length).trim();
    return { emoji, cleanText: cleanText || trimmed };
  }
  return { emoji: null, cleanText: trimmed };
}

export function cleanTagName(text: string): string {
  return extractLeadingEmoji(text).cleanText;
}

/** Presentation only: stored tags and API values retain their original names. */
export function businessLabel(value: string): string {
  const labels: Record<string, string> = {
    open: 'Em atendimento', active: 'Ativo', closed: 'Encerrado', archived: 'Arquivado', blocked: 'Bloqueado',
    information: 'Informações', cold: 'Frio', warm: 'Morno', hot: 'Quente', educate: 'Orientar',
    unknown: 'Não identificado', new_lead: 'Novo lead', interested: 'Interessado', price_request: 'Pedido de preço',
    send_price: 'Enviar preço', price_sent: 'Preço enviado', negotiation: 'Negociação', ready_to_buy: 'Pronto para comprar',
    purchase: 'Compra', buy: 'Compra', support: 'Suporte', positive: 'Positivo', neutral: 'Neutro', negative: 'Negativo',
  };
  return labels[value.trim().toLowerCase()] || value;
}

/**
 * Deterministically generates an icon from the palette using DJB2 hash.
 */
export function getDeterministicIconForTag(tag: string): { name: string; label: string } {
  const norm = normalizeTagName(tag);
  let hash = 5381;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 33) ^ norm.charCodeAt(i);
  }
  const index = Math.abs(hash) % DETERMINISTIC_ICON_PALETTE.length;
  return DETERMINISTIC_ICON_PALETTE[index];
}

/**
 * Returns the emoji associated with a tag, if any.
 * If the tag does not have an emoji, returns null ("sem isso não colocar e não poluir tão visualmente").
 */
export function getTagEmoji(tag: string): string | null {
  const rawTag = String(tag || "").trim();
  if (!rawTag) return null;

  // 1. User custom override in localStorage
  const customMap = getAllCustomTagDescriptors();
  const normalizedKey = normalizeTagName(rawTag);
  const custom = customMap[normalizedKey] || customMap[rawTag];
  if (custom && custom.value) {
    if (custom.type === "emoji") return custom.value;
  }

  // 2. Tag string starts with an emoji (e.g. "🎯 Novo Lead", "⭐ VIP", "🔥 Hot")
  const { emoji } = extractLeadingEmoji(rawTag);
  if (emoji) return emoji;

  // 3. Default business tags
  const norm = normalizeTagName(rawTag);
  if (DEFAULT_BUSINESS_EMOJIS[norm]) {
    return DEFAULT_BUSINESS_EMOJIS[norm];
  }

  for (const [key, em] of Object.entries(DEFAULT_BUSINESS_EMOJIS)) {
    if (norm === key || norm.startsWith(key + " ") || norm.endsWith(" " + key)) {
      return em;
    }
  }

  // 4. "se tiver sem isso não colocar e não poluir tão visualmente"
  return null;
}

/**
 * Reads all custom tag descriptors from localStorage.
 */
export function getAllCustomTagDescriptors(): Record<string, TagVisualDescriptor> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TagVisualDescriptor>) : {};
  } catch {
    return {};
  }
}

/**
 * Returns the resolved visual descriptor for a tag.
 * Priority:
 * 1. User custom override in localStorage
 * 2. Leading emoji in the tag name itself
 * 3. Default business emoji dictionary
 * 4. type: "none" if no emoji/icon defined (does not pollute UI with synthetic icons!)
 */
export function getTagDescriptor(tag: string): TagVisualDescriptor {
  const rawTag = String(tag || "").trim();
  if (!rawTag) {
    return { type: "none", value: "", isMonochrome: false, label: "" };
  }

  // 1. Check custom overrides
  const customMap = getAllCustomTagDescriptors();
  const normalizedKey = normalizeTagName(rawTag);
  if (customMap[normalizedKey]) {
    return customMap[normalizedKey];
  }
  if (customMap[rawTag]) {
    return customMap[rawTag];
  }

  // 2. Check if tag string starts with an emoji
  const { emoji, cleanText } = extractLeadingEmoji(rawTag);
  if (emoji) {
    return {
      type: "emoji",
      value: emoji,
      isMonochrome: false,
      label: cleanText || rawTag,
    };
  }

  // 3. Check default business emojis
  const norm = normalizeTagName(cleanText || rawTag);
  if (DEFAULT_BUSINESS_EMOJIS[norm]) {
    return {
      type: "emoji",
      value: DEFAULT_BUSINESS_EMOJIS[norm],
      isMonochrome: false,
      label: cleanText || rawTag,
    };
  }

  for (const [key, em] of Object.entries(DEFAULT_BUSINESS_EMOJIS)) {
    if (norm === key || norm.startsWith(key + " ") || norm.endsWith(" " + key)) {
      return {
        type: "emoji",
        value: em,
        isMonochrome: false,
        label: cleanText || rawTag,
      };
    }
  }

  // 4. No synthetic icons! ("se tiver sem isso não colocar e não poluir tão visualmente")
  return {
    type: "none",
    value: "",
    isMonochrome: false,
    label: cleanText || rawTag,
  };
}

/**
 * Sets a custom tag visual descriptor and notifies all listening components.
 */
export function setCustomTagDescriptor(tag: string, descriptor: TagVisualDescriptor): void {
  if (typeof window === "undefined") return;
  try {
    const customMap = getAllCustomTagDescriptors();
    const key = normalizeTagName(tag);
    customMap[key] = descriptor;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customMap));

    window.dispatchEvent(
      new CustomEvent("zapflow:tag-icons-updated", {
        detail: { tag, descriptor },
      }),
    );
  } catch (err) {
    console.warn("Failed to save custom tag descriptor", err);
  }
}

/**
 * Resets a custom tag descriptor back to the intelligent default.
 */
export function resetTagDescriptor(tag: string): void {
  if (typeof window === "undefined") return;
  try {
    const customMap = getAllCustomTagDescriptors();
    const key = normalizeTagName(tag);
    delete customMap[key];
    delete customMap[tag];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customMap));

    window.dispatchEvent(
      new CustomEvent("zapflow:tag-icons-updated", {
        detail: { tag, descriptor: null },
      }),
    );
  } catch (err) {
    console.warn("Failed to reset custom tag descriptor", err);
  }
}
