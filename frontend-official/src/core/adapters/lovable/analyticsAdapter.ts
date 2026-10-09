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
  const rawConversationsTotal = resolveMetric(metrics, ['totalConversations', 'leads', 'conversationCount']) ?? (metrics ? conversationCount : null);
  const format = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR');
  const temperatures = { hot: 0, warm: 0, cold: 0 };
  for (const conversation of conversations) {
    const recorded = String((conversation as Conversation & { lead_temperature?: string }).lead_temperature || '').toLowerCase();
    const values = [recorded, ...(conversation.tags || []).map(tag => tag.toLowerCase())];
    if (values.some(value => ['hot', 'quente'].includes(value))) temperatures.hot++;
    else if (values.some(value => ['warm', 'morno'].includes(value))) temperatures.warm++;
    else if (values.some(value => ['cold', 'frio'].includes(value))) temperatures.cold++;
  }
  const totalCategorized = temperatures.hot + temperatures.warm + temperatures.cold;
  const conversationsTotal = totalCategorized > 0
    ? totalCategorized
    : (rawConversationsTotal ?? (conversations.length > 0 ? conversations.length : null));
  const participation = messages !== null && messages > 0 && ai !== null
    ? `${Math.min(100, Math.max(0, Math.round(ai / messages * 100)))}%` : '—';

  // Computação real de volumetria ao longo do tempo baseada nas conversas reais do período
  const chartData: AnalyticsChartPoint[] = [];
  if (conversations.length > 0) {
    const validTimestamps = conversations
      .map(c => c.updatedAt ? new Date(c.updatedAt).getTime() : 0)
      .filter(t => t > 0)
      .sort((a, b) => a - b);

    if (validTimestamps.length > 0) {
      const minTime = validTimestamps[0];
      const maxTime = validTimestamps[validTimestamps.length - 1];
      const spanHours = (maxTime - minTime) / 3_600_000;

      if (spanHours <= 36) {
        // Agrupamento por blocos de horários dentro de 24h
        const hourMap = new Map<number, { msgs: number; ai: number }>();
        for (let h = 0; h < 24; h += 4) {
          hourMap.set(h, { msgs: 0, ai: 0 });
        }
        for (const c of conversations) {
          if (!c.updatedAt) continue;
          const h = new Date(c.updatedAt).getHours();
          const bucket = Math.floor(h / 4) * 4;
          const current = hourMap.get(bucket) || { msgs: 0, ai: 0 };
          current.msgs++;
          if (c.tags?.some(t => t.toLowerCase().includes("ia") || t.toLowerCase().includes("bot"))) {
            current.ai++;
          }
          hourMap.set(bucket, current);
        }
        for (let h = 0; h < 24; h += 4) {
          const entry = hourMap.get(h) || { msgs: 0, ai: 0 };
          chartData.push({
            name: `${String(h).padStart(2, "0")}:00`,
            msgs: entry.msgs,
            ai: entry.ai,
          });
        }
      } else {
        // Agrupamento por dia (DD/MM)
        const dayMap = new Map<string, { msgs: number; ai: number }>();
        for (const c of conversations) {
          if (!c.updatedAt) continue;
          const d = new Date(c.updatedAt);
          const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
          const current = dayMap.get(key) || { msgs: 0, ai: 0 };
          current.msgs++;
          if (c.tags?.some(t => t.toLowerCase().includes("ia") || t.toLowerCase().includes("bot"))) {
            current.ai++;
          }
          dayMap.set(key, current);
        }
        for (const [day, val] of dayMap.entries()) {
          chartData.push({
            name: day,
            msgs: val.msgs,
            ai: val.ai,
          });
        }
      }
    }
  }

  return {
    kpis: [
      { label: 'Mensagens no período', value: format(messages), tone: 'primary', hint: 'Total registrado no período selecionado' },
      { label: 'Conversas ativas no período', value: format(active), tone: 'default' },
      { label: 'Participação da IA nas mensagens', value: participation, tone: 'info' },
      { label: 'Conversas no período', value: format(conversationsTotal), tone: 'success' },
    ],
    chartData,
    tempDistribution: [
      { name: 'Quente', value: temperatures.hot, color: '#ef4444' },
      { name: 'Morno', value: temperatures.warm, color: '#f59e0b' },
      { name: 'Frio', value: temperatures.cold, color: '#0ea5e9' },
    ],
    totalLeadsLabel: format(conversationsTotal),
  };
}
