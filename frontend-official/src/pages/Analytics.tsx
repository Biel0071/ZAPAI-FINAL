import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import AnalyticsView from "@/lovable/pages/AnalyticsPageView";
import { createAnalyticsLovableViewModel } from "@/adapters/lovable/analyticsAdapter";
import { apiService } from "@/services/apiService";
import { useAppStore } from "@/stores/appStore";
import { SafeRender } from "@/components/system/SafeRender";
import { Button } from "@/components/ui/button";
import { ArrowClockwise } from "@phosphor-icons/react";

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const storeMetrics = useAppStore((state) => state.metrics);
  const conversations = useAppStore((state) => state.conversations);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [metricsResult, conversationsResult] = await Promise.allSettled([
        apiService.getMetrics(),
        apiService.getConversations(true, { limit: 200 }),
      ]);

      if (metricsResult.status === "fulfilled" && metricsResult.value) {
        useAppStore.getState().setMetrics(metricsResult.value);
      }

      if (conversationsResult.status === "fulfilled" && Array.isArray(conversationsResult.value)) {
        useAppStore.getState().setConversations(conversationsResult.value);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const analyticsViewModel = createAnalyticsLovableViewModel({
    metrics: storeMetrics,
    conversationCount: Array.isArray(conversations) ? conversations.length : 0,
    conversations: Array.isArray(conversations) ? conversations : [],
  });

  return (
    <div className="min-h-screen">
      <Header
        title="Analytics Enterprise"
        subtitle="Deep intelligence e indicadores operacionais"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => void loadData(true)}
            disabled={refreshing}
          >
            <ArrowClockwise className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar"}
          </Button>
        }
      />
      <SafeRender scope="analytics-view">
        <AnalyticsView loading={loading} viewModel={analyticsViewModel} />
      </SafeRender>
    </div>
  );
}
