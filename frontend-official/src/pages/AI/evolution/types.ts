export type EvolutionMainTab = "overview" | "memory" | "cognitive" | "results";

export type LegacyEvolutionSubTab = "hub" | "brain" | "timeline" | "conversations";

export type PeriodFilter = "today" | "7d" | "30d" | "all" | "custom";

export type MemoryCategory =
  | "preferences"
  | "products"
  | "pricing_conditions"
  | "objections"
  | "commercial_rules"
  | "attendance_strategies"
  | "insights";

export type MemoryScope = "agent" | "session" | "company_shared";

export type MemoryStatus = "active" | "disabled";

export interface AgentOption {
  key?: string;
  id?: string;
  name?: string;
  role?: string;
  active?: boolean;
  isPlatformAssistant?: boolean;
  avatarConfig?: any;
  character?: any;
  sessionId?: string;
  sessionIds?: string[];
  [field: string]: any;
}

export interface WhatsAppSessionOption {
  id: string;
  name: string;
  phone?: string | null;
  connected: boolean;
}

export interface MemoryOverviewResponse {
  success?: boolean;
  period?: {
    period: string;
    startIso: string | null;
    endIso: string | null;
  };
  agentKey?: string;
  sessionId?: string;
  dataOrigin?: {
    companyId?: string | null;
    source?: string | null;
    lastUpdatedAt?: string | null;
  };
  accumulated?: {
    conversationsTotal?: number | null;
    activeMemories?: number | null;
    objectionsIdentified?: number | null;
    strategiesActive?: number | null;
  };
  periodMetrics?: {
    conversationsAnalyzed?: number | null;
    recentLearnings?: number | null;
    aiTurnsExecuted?: number | null;
    customerContinuedTurns?: number | null;
  };
  pending?: {
    identifiedLearnings?: number | null;
    awaitingApproval?: number | null;
    totalPendingAnalysis?: number | null;
  };
  applied?: {
    provenImprovements?: number | null;
    activePlaybooks?: number | null;
  };
}

export interface EnterpriseMemoryItem {
  id: number | string;
  companyId?: string | null;
  agentKey?: string | null;
  sessionId?: string | null;
  memoryScope: MemoryScope | string;
  category: MemoryCategory | string;
  categoryLabel?: string | null;
  title: string;
  content: string;
  origin?: string | null;
  provenance?: Record<string, any> | null;
  occurrences?: number | null;
  confidence?: number | null;
  status: MemoryStatus | string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type CategoryCountsMap = Record<string, { total: number; active: number }>;

export interface CognitiveEvidenceItem {
  conversationId?: number | string;
  id?: number | string;
  contactName?: string;
  customerUtterance?: string;
  utterance?: string;
  excerpt?: string;
  snippet?: string;
  quote?: string;
  summary?: string;
  aiReply?: string;
  reply?: string;
  outcome?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface CognitiveProposal {
  id: number | string;
  companyId?: string | null;
  agentKey?: string | null;
  patternType?: string | null;
  title: string;
  beforeBehavior?: string | null;
  afterBehavior?: string | null;
  suggestedCta?: string | null;
  observedFrequency?: number | null;
  continuityImpactPct?: number | null;
  evidenceItems?: CognitiveEvidenceItem[];
  evidenceData?: Record<string, any> | null;
  impactMetrics?: Record<string, any> | null;
  stage: "identified" | "pending_approval" | "testing" | "applied" | "rejected" | "rolled_back" | string;
  status?: string | null;
  proposedPlaybookId?: number | string | null;
  appliedVersionId?: number | string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rolledBackAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AgentVersionItem {
  id: number | string;
  company_id?: string | null;
  session_id?: string | null;
  agent_key?: string | null;
  reason?: string | null;
  version_number?: number | null;
  change_scope?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  summary?: {
    name?: string | null;
    personalityPreset?: string | null;
    objective?: string | null;
    tone?: string | null;
    responseStyle?: string | null;
    temperature?: string | number | null;
    maxTokens?: string | number | null;
    providerId?: string | null;
    modelId?: string | null;
    routingMode?: string | null;
  } | null;
}

export interface CognitiveEvolutionResponse {
  success?: boolean;
  identified?: CognitiveProposal[];
  pendingApproval?: CognitiveProposal[];
  applied?: CognitiveProposal[];
  history?: CognitiveProposal[];
  versions?: AgentVersionItem[];
  counts?: {
    identified?: number;
    pendingApproval?: number;
    applied?: number;
    rolledBackOrRejected?: number;
  };
}

export interface AlgorithmResultRow {
  code: string;
  name: string;
  conversations: number;
  avgXp: number;
  conversions: number;
}

export interface ConversationResultRow {
  id: number | string;
  session_id?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  agent_name?: string | null;
  funnel_stage?: string | null;
  lead_temperature?: string | null;
  lead_intent?: string | null;
  ai_enabled?: boolean | null;
  last_activity_at?: string | null;
  algorithm_code?: string | null;
  algorithm_name?: string | null;
  total_xp?: number | null;
  has_order_sheet?: boolean | null;
  last_model?: string | null;
  last_provider?: string | null;
  last_strategy?: string | null;
}

export interface ResultsAndConversationsResponse {
  success?: boolean;
  period?: {
    period: string;
    startIso: string | null;
    endIso: string | null;
  };
  metrics?: {
    conversationsAnalyzed?: number | null;
    qualifiedConversations?: number | null;
    objectionsCount?: number | null;
    conversionsCount?: number | null;
    salesCount?: number | null;
    sheetsCount?: number | null;
    quotesCount?: number | null;
    salesRevenue?: number | null;
    continuityRatePct?: number | null;
    avgAiLatencyMs?: number | null;
    avgCustomerReplySec?: number | null;
  };
  byAlgorithm?: AlgorithmResultRow[];
  conversations?: ConversationResultRow[];
}

export interface ConversationExplanationResponse {
  success?: boolean;
  conversation?: {
    id: number | string;
    sessionId?: string | null;
    name?: string | null;
    phone?: string | null;
    funnelStage?: string | null;
    leadTemperature?: string | null;
    leadIntent?: string | null;
    agentName?: string | null;
    aiEnabled?: boolean | null;
  };
  configurationUsed?: Record<string, any> | null;
  modelUsed?: {
    provider?: string | null;
    model?: string | null;
    routingMode?: string | null;
    credentialScope?: string | null;
    latencyMs?: number | null;
    tokens?: number | null;
  } | null;
  retrievedMemories?: Array<{
    id: number | string;
    category?: string | null;
    label?: string | null;
    content?: string | null;
    memory_scope?: string | null;
    confidence?: number | null;
  }>;
  appliedStrategy?: string | null;
  outcome?: {
    funnelStage?: string | null;
    score?: Record<string, any> | null;
    sheets?: Array<{
      id: number | string;
      total_price?: number | string | null;
      payment_method?: string | null;
      status?: string | null;
      created_at?: string | null;
    }>;
    orders?: Array<{
      id: number | string;
      order_id?: string | null;
      order_title?: string | null;
      total_amount?: number | string | null;
      status?: string | null;
      created_at?: string | null;
    }>;
    quotes?: Array<{
      id: number | string;
      quote_number?: string | null;
      total_amount?: number | string | null;
      status?: string | null;
      created_at?: string | null;
    }>;
  };
  turns?: Array<{
    id: number | string;
    customer_utterance?: string | null;
    intent_detected?: string | null;
    strategy_applied?: string | null;
    playbook_id?: number | string | null;
    ai_reply?: string | null;
    customer_replied?: boolean | null;
    customer_replied_seconds?: number | null;
    human_intervened?: boolean | null;
    funnel_outcome?: string | null;
    metadata?: Record<string, any> | null;
    created_at?: string | null;
  }>;
  aiLogs?: Array<{
    id: number | string;
    provider?: string | null;
    model?: string | null;
    total_tokens?: number | null;
    latency_ms?: number | null;
    timestamp?: string | null;
  }>;
}

export interface MemoryCategoryMeta {
  id: MemoryCategory;
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
}

export const MEMORY_CATEGORY_META: MemoryCategoryMeta[] = [
  {
    id: "preferences",
    label: "Preferências",
    description: "Preferências de contato, pagamento ou atendimento.",
    badgeClass: "border-pink-500/40 bg-pink-500/10 text-pink-300",
    dotClass: "bg-pink-400",
  },
  {
    id: "products",
    label: "Produtos",
    description: "Fatos e especificações sobre itens e catálogo.",
    badgeClass: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    dotClass: "bg-sky-400",
  },
  {
    id: "pricing_conditions",
    label: "Preços e condições",
    description: "Condições de pagamento, parcelamento e tabelas validadas.",
    badgeClass: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    dotClass: "bg-amber-400",
  },
  {
    id: "objections",
    label: "Objeções",
    description: "Objeções frequentes e contornos comerciais validados.",
    badgeClass: "border-violet-500/40 bg-violet-500/10 text-violet-300",
    dotClass: "bg-violet-400",
  },
  {
    id: "commercial_rules",
    label: "Regras comerciais",
    description: "Regras operacionais e políticas comerciais oficiais.",
    badgeClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    dotClass: "bg-emerald-400",
  },
  {
    id: "attendance_strategies",
    label: "Estratégias de atendimento",
    description: "Abordagens e fluxos de condução aprovados.",
    badgeClass: "border-teal-500/40 bg-teal-500/10 text-teal-300",
    dotClass: "bg-teal-400",
  },
  {
    id: "insights",
    label: "Insights",
    description: "Padrões e aprendizados contextualizados das conversas.",
    badgeClass: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    dotClass: "bg-cyan-400",
  },
];

export const MEMORY_CATEGORY_BY_ID: Record<string, MemoryCategoryMeta> = Object.fromEntries(
  MEMORY_CATEGORY_META.map((cat) => [cat.id, cat])
);

export const MEMORY_SCOPE_LABELS: Record<string, string> = {
  agent: "Agente",
  session: "WhatsApp",
  company_shared: "Compartilhado Empresa",
};

export const PERIOD_OPTIONS: Array<{ id: PeriodFilter; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "all", label: "Geral" },
  { id: "custom", label: "Personalizado" },
];

export function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pt-BR");
}

export function formatPercent(value: unknown, decimals = 1): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(decimals).replace(".", ",");
  return `${formatted}%`;
}

export function formatConfidencePct(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const pct = num > 0 && num <= 1 ? Math.round(num * 100) : Math.round(num);
  return `${pct}%`;
}

export function formatCurrencyBRL(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatLatencyMs(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${Math.round(num).toLocaleString("pt-BR")} ms`;
}

export function formatDurationSec(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  if (num < 60) return `${num.toFixed(1).replace(".", ",")} s`;
  const mins = Math.floor(num / 60);
  const secs = Math.round(num % 60);
  return `${mins}m ${secs}s`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMemoryOrigin(origin?: string | null, provenance?: Record<string, any> | null): string {
  const raw = origin || provenance?.source;
  if (!raw) return "—";
  const map: Record<string, string> = {
    manual_operator: "Cadastro manual",
    approved_evolution: "Evolução aprovada",
    evolution_engine: "Motor evolutivo",
    conversation: "Atendimento real",
    human_admin: "Operador",
  };
  const base = map[raw] || raw.replace(/[_-]+/g, " ");
  const creator = provenance?.createdBy;
  return creator ? `${base} (${creator})` : base;
}

export function resolvePeriodDates(
  period: PeriodFilter,
  customStart: string,
  customEnd: string
): { period: PeriodFilter; start?: string; end?: string } {
  if (period !== "custom") return { period };
  const start = customStart ? new Date(`${customStart}T00:00:00`).toISOString() : undefined;
  const end = customEnd ? new Date(`${customEnd}T23:59:59.999`).toISOString() : undefined;
  return { period: "custom", start, end };
}
