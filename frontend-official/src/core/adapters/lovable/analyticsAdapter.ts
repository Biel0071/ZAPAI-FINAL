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
  let aiCount = 0;

  if (conversations.length > 0) {
    for (const conversation of conversations) {
      const recorded = String((conversation as Conversation & { lead_temperature?: string }).lead_temperature || '').toLowerCase();
      const stage = String(conversation.funnel_stage || '').toLowerCase();
      const tags = (conversation.tags || []).map(tag => tag.toLowerCase());
      const values = [recorded, stage, ...tags];

      const hasAi = Boolean(
        conversation.isAI ||
        conversation.aiEnabled ||
        conversation.ai_enabled ||
        conversation.agent_name ||
        conversation.assignedAgentName ||
        tags.some(t => t.includes('ia') || t.includes('bot') || t.includes('camila')) ||
        (conversation.notes && conversation.notes.toLowerCase().includes('ia'))
      );
      if (hasAi) aiCount++;

      if (values.some(value => ['hot', 'quente', 'closed', 'fechado', 'negotiation', 'negociacao', 'decisao', 'proposta'].includes(value)) ||
          tags.some(t => t.includes('quente') || t.includes('venda') || t.includes('fech') || t.includes('negoc'))) {
        temperatures.hot++;
      } else if (values.some(value => ['warm', 'morno', 'qualificacao', 'atendimento', 'engaged', 'lead_qualificado'].includes(value)) ||
                 tags.some(t => t.includes('morno') || t.includes('orc') || t.includes('prosp'))) {
        temperatures.warm++;
      } else {
        temperatures.cold++;
      }
    }
  }

  const totalCategorized = temperatures.hot + temperatures.warm + temperatures.cold;
  const conversationsTotal = totalCategorized > 0
    ? totalCategorized
    : (rawConversationsTotal ?? (conversations.length > 0 ? conversations.length : null));

  let participation = '—';
  if (messages !== null && messages > 0 && ai !== null && ai > 0) {
    participation = `${Math.min(100, Math.max(0, Math.round(ai / messages * 100)))}%`;
  } else if (conversations.length > 0 && aiCount > 0) {
    participation = `${Math.min(100, Math.max(0, Math.round((aiCount / conversations.length) * 100)))}%`;
  } else if (ai !== null && ai > 0) {
    participation = '100%';
  } else if (messages !== null && messages === 0) {
    participation = '0%';
  }

  // Computação real de volumetria ao longo do tempo baseada nas conversas reais do período
  const chartData: AnalyticsChartPoint[] = [];
  if (conversations.length > 0) {
    const getConvTime = (c: Conversation): number => {
      const timeStr = c.lastMessageAt || c.updatedAt || (c as any).updated_at || (c as any).createdAt || (c as any).created_at;
      if (!timeStr) return 0;
      const t = new Date(timeStr).getTime();
      return isNaN(t) ? 0 : t;
    };

    const validTimestamps = conversations
      .map(getConvTime)
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
          const t = getConvTime(c);
          if (t === 0) continue;
          const h = new Date(t).getHours();
          const bucket = Math.floor(h / 4) * 4;
          const current = hourMap.get(bucket) || { msgs: 0, ai: 0 };
          current.msgs++;
          if (c.isAI || c.aiEnabled || c.ai_enabled || Boolean(c.agent_name) || Boolean(c.assignedAgentName) || c.tags?.some(t => t.toLowerCase().includes("ia") || t.toLowerCase().includes("bot") || t.toLowerCase().includes("camila"))) {
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
          const t = getConvTime(c);
          if (t === 0) continue;
          const d = new Date(t);
          const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
          const current = dayMap.get(key) || { msgs: 0, ai: 0 };
          current.msgs++;
          if (c.isAI || c.aiEnabled || c.ai_enabled || Boolean(c.agent_name) || Boolean(c.assignedAgentName) || c.tags?.some(t => t.toLowerCase().includes("ia") || t.toLowerCase().includes("bot") || t.toLowerCase().includes("camila"))) {
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
