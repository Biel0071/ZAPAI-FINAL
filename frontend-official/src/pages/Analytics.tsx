import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import AnalyticsView from "@/lovable/pages/AnalyticsPageView";
import { createAnalyticsLovableViewModel } from "@/adapters/lovable/analyticsAdapter";
import { apiService } from "@/services/apiService";
import { useAppStore } from "@/stores/appStore";

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const storeMetrics = useAppStore((state) => state.metrics);
  const conversations = useAppStore((state) => state.conversations);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const [metricsResult, conversationsResult] = await Promise.allSettled([
          apiService.getMetrics(),
          apiService.getConversations(false, { limit: 200 }),
        ]);

        if (!mounted) return;

        if (metricsResult.status === "fulfilled" && metricsResult.value) {
          useAppStore.getState().setMetrics(metricsResult.value);
        }

        if (conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value)) {
          useAppStore.getState().setConversations(conversationsResult.value);
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
    metrics: storeMetrics,
    conversationCount: conversations.length,
    conversations,
  });

  return (
    <div className="min-h-screen">
      <Header title="Analytics Enterprise" subtitle="Deep intelligence e indicadores operacionais" />
      <AnalyticsView loading={loading} viewModel={analyticsViewModel} />
    </div>
  );
}
