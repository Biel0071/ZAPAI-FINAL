import { DddHeatmapCard } from '../components/modules/overview/DddHeatmapCard';
import { MetricGrid } from '../components/modules/overview/MetricGrid';
import { OverviewPageHeader } from '../components/modules/overview/OverviewPageHeader';
import { SessionOverviewList } from '../components/modules/overview/SessionOverviewList';
import { StatusGrid } from '../components/modules/overview/StatusGrid';
import { TrendBarsCard } from '../components/modules/overview/TrendBarsCard';
import { StatePanel } from '../components/ui/StatePanel';
import { useExecutiveOverview } from '../hooks/useExecutiveOverview';
import { formatCount, formatPercent } from '../views/overview/formatters';

export default function DashboardPage() {
  const { data, error, loading, refresh, refreshing } = useExecutiveOverview();

  return (
    <div className="space-y-4">
      <OverviewPageHeader
        title="Painel principal"
        description="Base executiva comum entre dashboard, analytics, mapa e diagnostico, com fallback seguro e sem polling agressivo."
        refreshedAt={data?.refreshedAt}
        partial={data?.partial}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      {loading && !data ? (
        <StatePanel
          tone="loading"
          title="Consolidando a operacao"
          description="As metricas do painel estao sendo montadas a partir das APIs principais e dos fallbacks locais."
        />
      ) : null}

      {error ? (
        <StatePanel
          tone={data ? 'info' : 'error'}
          title={data ? 'Dados parciais carregados' : 'Falha ao carregar o painel'}
          description={error}
        />
      ) : null}

      {data ? (
        <>
          <MetricGrid
            items={[
              {
                icon: 'message',
                label: 'Mensagens',
                value: formatCount(data.metrics.messages),
                hint: 'Volume total consolidado pelo backend e pela telemetria.',
              },
              {
                icon: 'contacts',
                label: 'Leads ativos',
                value: formatCount(data.metrics.leads),
                hint: `${formatCount(data.metrics.activeConversations)} conversas seguem ativas na fila atual.`,
              },
              {
                icon: 'sessions',
                label: 'Sessoes',
                value: formatCount(data.metrics.sessions),
                hint: `${formatCount(data.sessionSummary.connected)} conectadas em tempo real.`,
              },
              {
                icon: 'analytics',
                label: 'Resposta IA',
                value: formatPercent(data.metrics.responseRate),
                hint: `${formatCount(data.metrics.resolvedConversations)} conversas resolvidas no consolidado.`,
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-[1.6fr,1fr]">
            <TrendBarsCard
              title="Tendencia operacional"
              subtitle="Serie diaria compartilhada com a pagina de analytics para evitar cards e graficos duplicados."
              points={data.daily}
            />
            <StatusGrid title="Saude da operacao" items={data.statusItems.slice(0, 4)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.45fr,1fr]">
            <DddHeatmapCard
              compact
              entries={data.dddHeatmap}
              regions={data.regionSummary}
              states={data.stateHeatmap}
            />
            <SessionOverviewList sessions={data.sessions} />
          </div>
        </>
      ) : null}
    </div>
  );
}
