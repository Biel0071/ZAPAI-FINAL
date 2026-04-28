import { MetricGrid } from '../components/modules/overview/MetricGrid';
import { OverviewPageHeader } from '../components/modules/overview/OverviewPageHeader';
import { StatusGrid } from '../components/modules/overview/StatusGrid';
import { TrendBarsCard } from '../components/modules/overview/TrendBarsCard';
import { StatePanel } from '../components/ui/StatePanel';
import { useExecutiveOverview } from '../hooks/useExecutiveOverview';
import { formatCount, formatDurationSeconds, formatPercent } from '../views/overview/formatters';

export default function AnalyticsPage() {
  const { data, error, loading, refresh, refreshing } = useExecutiveOverview();

  return (
    <div className="space-y-4">
      <OverviewPageHeader
        title="Analytics"
        description="Visao analitica em cima da mesma base do painel principal, com metricas de eficiencia, palavras-chave e status consolidados."
        refreshedAt={data?.refreshedAt}
        partial={data?.partial}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      {loading && !data ? (
        <StatePanel
          tone="loading"
          title="Montando os indicadores"
          description="A camada analitica reutiliza o mesmo snapshot executivo para evitar tela vazia e re-fetch desnecessario."
        />
      ) : null}

      {error ? (
        <StatePanel
          tone={data ? 'info' : 'error'}
          title={data ? 'Analytics parcial carregado' : 'Falha ao carregar analytics'}
          description={error}
        />
      ) : null}

      {data ? (
        <>
          <MetricGrid
            items={[
              {
                icon: 'analytics',
                label: 'Conversas resolvidas',
                value: formatCount(data.metrics.resolvedConversations),
                hint: 'Consolidado compartilhado entre /api/dashboard e /api/analytics.',
              },
              {
                icon: 'chart',
                label: 'Taxa de resposta',
                value: formatPercent(data.metrics.responseRate),
                hint: 'Indicador mantido com fallback caso apenas uma das fontes responda.',
              },
              {
                icon: 'diagnostics',
                label: 'Tempo medio',
                value: formatDurationSeconds(data.metrics.averageServiceTime),
                hint: 'Exibicao segura mesmo quando o backend ainda nao calcula esse campo.',
              },
              {
                icon: 'dashboard',
                label: 'Erros de IA',
                value: formatCount(data.metrics.aiErrors),
                hint: 'Guard rail para analise rapida de regressao operacional.',
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-[1.7fr,1fr]">
            <TrendBarsCard
              title="Serie de mensagens e leads"
              subtitle="Componente reutilizavel compartilhado com o Dashboard para manter leitura e arquitetura alinhadas."
              points={data.daily}
            />

            <article className="crm-card p-4">
              <h3 className="text-sm font-semibold text-textPrimary">Palavras e cobertura</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.topWords.length > 0 ? (
                  data.topWords.map((word) => (
                    <span
                      key={word}
                      className="rounded-full border border-borderSoft bg-panelSoft/80 px-3 py-1.5 text-xs text-textSecondary"
                    >
                      {word}
                    </span>
                  ))
                ) : (
                  <StatePanel
                    compact
                    tone="empty"
                    title="Sem palavras-chave"
                    description="A API ainda nao retornou termos destacados. O painel segue funcional."
                  />
                )}
              </div>

              <div className="mt-4 space-y-2">
                {data.regionSummary.map((region) => (
                  <div key={region.region} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-textPrimary">{region.region}</p>
                      <p className="text-sm font-semibold text-textPrimary">{formatPercent(region.share)}</p>
                    </div>
                    <p className="mt-1 text-xs text-textSecondary">
                      {formatCount(region.count)} contatos mapeados • estados {region.states.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <StatusGrid title="Status reutilizado pela camada analitica" items={data.statusItems} />
        </>
      ) : null}
    </div>
  );
}
