/**
 * Tag Emojis & Monochromatic Icons Management System
 * Provides semantic default matching, deterministic fallback hash,
 * customizable user override with localStorage persistence, and real-time syncing.
 */

export interface TagVisualDescriptor {
  type: "icon" | "emoji";
  value: string; // Icon name from Phosphor or raw emoji
  isMonochrome?: boolean; // whether to force monochrome styling matching tag badge color
  category?: string;
  label?: string;
}

const STORAGE_KEY = "zapflow_custom_tag_icons_v1";

// 1. Curated palette of Phosphor Icon names for deterministic generation of custom tags
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

// 2. Semantic dictionary for automatic matching of business tags
const SEMANTIC_TAG_MAP: Record<string, TagVisualDescriptor> = {
  // Leads & Aquisição
  "novo lead": { type: "icon", value: "Target", isMonochrome: true, label: "Novo Lead" },
  lead: { type: "icon", value: "Target", isMonochrome: true, label: "Lead" },
  prospect: { type: "icon", value: "Target", isMonochrome: true, label: "Prospect" },
  inbound: { type: "icon", value: "ArrowDownLeft", isMonochrome: true, label: "Inbound" },

  // Clientes & Fidelização
  cliente: { type: "icon", value: "Briefcase", isMonochrome: true, label: "Cliente" },
  vip: { type: "icon", value: "Star", isMonochrome: true, label: "VIP" },
  ativo: { type: "icon", value: "CheckCircle", isMonochrome: true, label: "Ativo" },
  estrela: { type: "icon", value: "Star", isMonochrome: true, label: "Estrela" },

  // Vendas & Fechamento
  venda: { type: "icon", value: "CurrencyDollar", isMonochrome: true, label: "Venda" },
  vendas: { type: "icon", value: "CurrencyDollar", isMonochrome: true, label: "Vendas" },
  orcamento: { type: "icon", value: "FileText", isMonochrome: true, label: "Orçamento" },
  proposta: { type: "icon", value: "FileText", isMonochrome: true, label: "Proposta" },
  cotacao: { type: "icon", value: "FileText", isMonochrome: true, label: "Cotação" },

  // Status & Temperaturas
  hot: { type: "icon", value: "Flame", isMonochrome: true, label: "Hot" },
  quente: { type: "icon", value: "Flame", isMonochrome: true, label: "Quente" },
  warm: { type: "icon", value: "Sun", isMonochrome: true, label: "Warm" },
  morno: { type: "icon", value: "Sun", isMonochrome: true, label: "Morno" },
  cold: { type: "icon", value: "Snowflake", isMonochrome: true, label: "Cold" },
  frio: { type: "icon", value: "Snowflake", isMonochrome: true, label: "Frio" },

  // Urgência & Suporte
  urgente: { type: "icon", value: "Warning", isMonochrome: true, label: "Urgente" },
  urgencia: { type: "icon", value: "Warning", isMonochrome: true, label: "Urgência" },
  prioridade: { type: "icon", value: "Warning", isMonochrome: true, label: "Prioridade" },
  suporte: { type: "icon", value: "Wrench", isMonochrome: true, label: "Suporte" },
  ajuda: { type: "icon", value: "Headset", isMonochrome: true, label: "Ajuda" },
  duvida: { type: "icon", value: "Question", isMonochrome: true, label: "Dúvida" },
  question: { type: "icon", value: "Question", isMonochrome: true, label: "Question" },
  informacao: { type: "icon", value: "Info", isMonochrome: true, label: "Informação" },
  information: { type: "icon", value: "Info", isMonochrome: true, label: "Information" },

  // Financeiro & Operações
  financeiro: { type: "icon", value: "CreditCard", isMonochrome: true, label: "Financeiro" },
  pix: { type: "icon", value: "CreditCard", isMonochrome: true, label: "PIX" },
  pagamento: { type: "icon", value: "CreditCard", isMonochrome: true, label: "Pagamento" },
  entrega: { type: "icon", value: "Package", isMonochrome: true, label: "Entrega" },
  jadlog: { type: "icon", value: "Package", isMonochrome: true, label: "Jadlog" },
  correios: { type: "icon", value: "Package", isMonochrome: true, label: "Correios" },
  envio: { type: "icon", value: "Package", isMonochrome: true, label: "Envio" },

  // Outros
  contrato: { type: "icon", value: "Scroll", isMonochrome: true, label: "Contrato" },
  agendamento: { type: "icon", value: "Calendar", isMonochrome: true, label: "Agendamento" },
  reuniao: { type: "icon", value: "Calendar", isMonochrome: true, label: "Reunião" },
  parceria: { type: "icon", value: "Handshake", isMonochrome: true, label: "Parceria" },
  feedback: { type: "icon", value: "ChatText", isMonochrome: true, label: "Feedback" },
  cancelado: { type: "icon", value: "XCircle", isMonochrome: true, label: "Cancelado" },
  concluido: { type: "icon", value: "CheckCircle", isMonochrome: true, label: "Concluído" },
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
 * 3. Semantic keyword dictionary
 * 4. Deterministic hash palette (never all the same!)
 */
export function getTagDescriptor(tag: string): TagVisualDescriptor {
  const rawTag = String(tag || "").trim();
  if (!rawTag) {
    return { type: "icon", value: "Tag", isMonochrome: true, label: "Etiqueta" };
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
      label: cleanText,
    };
  }

  // 3. Check semantic dictionary
  const norm = normalizeTagName(cleanText || rawTag);
  if (SEMANTIC_TAG_MAP[norm]) {
    return SEMANTIC_TAG_MAP[norm];
  }

  // Check if tag contains a known semantic keyword
  for (const [keyword, desc] of Object.entries(SEMANTIC_TAG_MAP)) {
    if (norm.includes(keyword)) {
      return desc;
    }
  }

  // 4. Deterministic generation
  const deterministic = getDeterministicIconForTag(rawTag);
  return {
    type: "icon",
    value: deterministic.name,
    isMonochrome: true,
    label: deterministic.label,
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
