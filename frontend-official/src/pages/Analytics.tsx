import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import AnalyticsView from "@/lovable/pages/AnalyticsPageView";
import { createAnalyticsLovableViewModel } from "@/adapters/lovable/analyticsAdapter";
import { apiService, type MetricsSummary } from "@/services/apiService";

export default function Analytics() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [conversationCount, setConversationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const [metricsResult, conversationsResult] = await Promise.allSettled([
          apiService.getMetrics(),
          apiService.getConversations(false, { limit: 200 }),
        ]);

        if (!mounted) return;

        if (metricsResult.status === "fulfilled") {
          setMetrics(metricsResult.value);
        }

        if (conversationsResult.status === "fulfilled") {
          setConversationCount(Array.isArray(conversationsResult.value) ? conversationsResult.value.length : 0);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const analyticsViewModel = createAnalyticsLovableViewModel({
    metrics,
    conversationCount,
  });

  return (
    <div className="min-h-screen">
      <Header title="Analytics Enterprise" subtitle="Deep intelligence e indicadores operacionais" />
      <AnalyticsView loading={loading} viewModel={analyticsViewModel} />
    </div>
  );
}
