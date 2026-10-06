import type { Conversation, MetricsSummary } from "@/core/services/apiService";

export type AnalyticsKpiCard = {
  label: string;
  value: string;
  tone: "primary" | "default" | "info" | "success" | "warning";
  hint?: string;
};

export type AnalyticsChartPoint = {
  name: string;
  msgs: number;
  ai: number;
};

export type AnalyticsDistributionPoint = {
  name: string;
  value: number;
  color: string;
};

export type AnalyticsLovableViewModel = {
  kpis: AnalyticsKpiCard[];
  chartData: AnalyticsChartPoint[];
  tempDistribution: AnalyticsDistributionPoint[];
  totalLeadsLabel: string;
};

function resolveMetric(payload: MetricsSummary | null, keys: string[]): number | null {
  if (!payload) return null;
  const bag = payload as Record<string, unknown>;
  for (const key of keys) {
    const candidate = bag[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      const value = Number(candidate);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

export function createAnalyticsLovableViewModel(params: {
  metrics: MetricsSummary | null;
  conversationCount: number;
  conversations?: Conversation[];
}): AnalyticsLovableViewModel {
  const { metrics, conversationCount, conversations = [] } = params;
  const messages = resolveMetric(metrics, ['messagesToday', 'todayMessages', 'messages']);
  const active = resolveMetric(metrics, ['activeChats', 'activeConversations', 'chats']);
  const ai = resolveMetric(metrics, ['aiResponses', 'ai', 'botResponses']);
  const conversationsTotal = resolveMetric(metrics, ['totalConversations', 'leads', 'conversationCount']) ?? (metrics ? conversationCount : null);
  const format = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR');
  const temperatures = { hot: 0, warm: 0, cold: 0 };
  for (const conversation of conversations) {
    const recorded = String((conversation as Conversation & { lead_temperature?: string }).lead_temperature || '').toLowerCase();
    const values = [recorded, ...(conversation.tags || []).map(tag => tag.toLowerCase())];
    if (values.some(value => ['hot', 'quente'].includes(value))) temperatures.hot++;
    else if (values.some(value => ['warm', 'morno'].includes(value))) temperatures.warm++;
    else if (values.some(value => ['cold', 'frio'].includes(value))) temperatures.cold++;
  }
  const participation = messages !== null && messages > 0 && ai !== null
    ? `${Math.min(100, Math.max(0, Math.round(ai / messages * 100)))}%` : '—';
  return {
    kpis: [
      { label: 'Mensagens no período', value: format(messages), tone: 'primary', hint: 'Total registrado no período selecionado' },
      { label: 'Conversas ativas no período', value: format(active), tone: 'default' },
      { label: 'Participação da IA nas mensagens', value: participation, tone: 'info' },
      { label: 'Conversas no período', value: format(conversationsTotal), tone: 'success' },
    ],
    // Aggregate totals cannot establish a time-series.
    chartData: [],
    tempDistribution: [
      { name: 'Quente', value: temperatures.hot, color: '#ef4444' },
      { name: 'Morno', value: temperatures.warm, color: '#f59e0b' },
      { name: 'Frio', value: temperatures.cold, color: '#0ea5e9' },
    ],
    totalLeadsLabel: format(conversationsTotal),
  };
}
