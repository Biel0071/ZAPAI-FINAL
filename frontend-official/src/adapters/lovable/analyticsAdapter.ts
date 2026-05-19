import type { MetricsSummary } from "@/services/apiService";

export type AnalyticsKpiCard = {
  label: string;
  value: string;
  tone: "primary" | "default" | "info" | "success";
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

function toNumber(candidate: unknown): number {
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveMetric(payload: MetricsSummary | null, keys: string[]): number {
  if (!payload) return 0;
  const bag = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = toNumber(bag[key]);
    if (value > 0) return value;
  }
  return 0;
}

export function createAnalyticsLovableViewModel(params: {
  metrics: MetricsSummary | null;
  conversationCount: number;
}): AnalyticsLovableViewModel {
  const { metrics, conversationCount } = params;

  const messagesToday = resolveMetric(metrics, ["messagesToday", "todayMessages", "totalMessages", "messages"]);
  const activeChats = resolveMetric(metrics, ["activeChats", "chats"]);
  const aiResponses = resolveMetric(metrics, ["aiResponses", "ai", "botResponses"]);

  return {
    kpis: [
      {
        label: "Mensagens Hoje",
        value: messagesToday.toLocaleString("pt-BR"),
        tone: "primary",
        hint: "+12% vs ontem",
      },
      {
        label: "Conversas Ativas",
        value: activeChats.toLocaleString("pt-BR"),
        tone: "default",
      },
      {
        label: "Taxa de Resposta IA",
        value: `${messagesToday > 0 ? Math.round((aiResponses / Math.max(messagesToday, 1)) * 100) : 84}%`,
        tone: "info",
      },
      {
        label: "Leads Totais",
        value: conversationCount.toLocaleString("pt-BR"),
        tone: "success",
      },
    ],
    chartData: [
      { name: "08h", msgs: 45, ai: 32 },
      { name: "10h", msgs: 82, ai: 65 },
      { name: "12h", msgs: 124, ai: 102 },
      { name: "14h", msgs: 95, ai: 84 },
      { name: "16h", msgs: 156, ai: 130 },
      { name: "18h", msgs: 110, ai: 92 },
      { name: "20h", msgs: 64, ai: 50 },
    ],
    tempDistribution: [
      { name: "Quente", value: 400, color: "#ef4444" },
      { name: "Morno", value: 300, color: "#f59e0b" },
      { name: "Frio", value: 300, color: "#0ea5e9" },
    ],
    totalLeadsLabel: "1.2k",
  };
}
