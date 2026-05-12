import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <div className="min-h-screen">
      <Header title="Relatórios" subtitle="Indicadores operacionais em tempo real" />
      <div className="page-container section-stack">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`analytics-skeleton-${index}`} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Mensagens hoje</p><p className="mt-1 text-2xl font-bold font-display">{Number(metrics?.messagesToday ?? metrics?.todayMessages ?? metrics?.totalMessages ?? 0).toLocaleString("pt-BR")}</p></CardContent></Card>
            <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Conversas ativas</p><p className="mt-1 text-2xl font-bold font-display">{Number(metrics?.activeChats ?? metrics?.chats ?? 0).toLocaleString("pt-BR")}</p></CardContent></Card>
            <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Respostas IA</p><p className="mt-1 text-2xl font-bold font-display">{Number(metrics?.aiResponses ?? metrics?.ai ?? 0).toLocaleString("pt-BR")}</p></CardContent></Card>
            <Card className="metric-card rounded-lg"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Conversas carregadas</p><p className="mt-1 text-2xl font-bold font-display">{conversationCount.toLocaleString("pt-BR")}</p></CardContent></Card>
          </div>
        )}
      </div>
    </div>
  );
}
