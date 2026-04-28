import { DddHeatmapCard } from '../components/modules/overview/DddHeatmapCard';
import { MetricGrid } from '../components/modules/overview/MetricGrid';
import { OverviewPageHeader } from '../components/modules/overview/OverviewPageHeader';
import { StatePanel } from '../components/ui/StatePanel';
import { useExecutiveOverview } from '../hooks/useExecutiveOverview';
import { formatCount, formatPercent } from '../views/overview/formatters';

export default function MapPage() {
  const { data, error, loading, refresh, refreshing } = useExecutiveOverview();
  const coveragePercent =
    data && data.coverage.totalContacts > 0
      ? (data.coverage.mappedContacts / data.coverage.totalContacts) * 100
      : 0;

  return (
    <div className="space-y-4">
      <OverviewPageHeader
        title="Mapa DDD"
        description="Distribuicao por DDD, estado e regiao, pronta para heatmap executivo sem depender de IDs invalidos ou grupos."
        refreshedAt={data?.refreshedAt}
        partial={data?.partial}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      {loading && !data ? (
        <StatePanel
          tone="loading"
          title="Organizando o mapa de DDD"
          description="Os contatos estao sendo filtrados para remover grupos, newsletters e identificadores sem DDD confiavel."
        />
      ) : null}

      {error ? (
        <StatePanel
          tone={data ? 'info' : 'error'}
          title={data ? 'Mapa carregado com fallback parcial' : 'Falha ao montar o mapa'}
          description={error}
        />
      ) : null}

      {data ? (
        <>
          <MetricGrid
            items={[
              {
                icon: 'map',
                label: 'Contatos mapeados',
                value: formatCount(data.coverage.mappedContacts),
                hint: `${formatPercent(coveragePercent)} da base retornou DDD valido.`,
              },
              {
                icon: 'contacts',
                label: 'Contatos fora do mapa',
                value: formatCount(data.coverage.unmappedContacts),
                hint: 'Grupos, newsletters, lid e formatos invalidos ficam fora da leitura geografica.',
              },
              {
                icon: 'dashboard',
                label: 'Estados ativos',
                value: formatCount(data.stateHeatmap.length),
                hint: 'Estados com pelo menos um DDD valido identificado.',
              },
              {
                icon: 'analytics',
                label: 'Regioes',
                value: formatCount(data.regionSummary.length),
                hint: 'Resumo pronto para dashboard e analytics.',
              },
            ]}
          />

          <DddHeatmapCard
            entries={data.dddHeatmap}
            regions={data.regionSummary}
            states={data.stateHeatmap}
            title="Heatmap de estados e DDDs"
          />
        </>
      ) : null}
    </div>
  );
}
