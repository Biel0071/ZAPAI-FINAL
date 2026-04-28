import { MetricGrid } from '../components/modules/overview/MetricGrid';
import { OverviewPageHeader } from '../components/modules/overview/OverviewPageHeader';
import { SessionOverviewList } from '../components/modules/overview/SessionOverviewList';
import { StatusGrid } from '../components/modules/overview/StatusGrid';
import { StatePanel } from '../components/ui/StatePanel';
import { useExecutiveOverview } from '../hooks/useExecutiveOverview';
import { formatCount } from '../views/overview/formatters';

export default function DiagnosticsPage() {
  const { data, error, loading, refresh, refreshing } = useExecutiveOverview();

  return (
    <div className="space-y-4">
      <OverviewPageHeader
        title="Diagnostico"
        description="Leitura tecnica da saude do runtime, conexoes e camadas de resiliencia, sem depender de uma unica API para renderizar."
        refreshedAt={data?.refreshedAt}
        partial={data?.partial}
        refreshing={refreshing}
        onRefresh={refresh}
      />

      {loading && !data ? (
        <StatePanel
          tone="loading"
          title="Verificando o ambiente"
          description="O diagnostico combina runtime, socket, AI engine e sessoes para manter a tela consistente."
        />
      ) : null}

      {error ? (
        <StatePanel
          tone={data ? 'info' : 'error'}
          title={data ? 'Diagnostico parcial carregado' : 'Falha ao carregar diagnostico'}
          description={error}
        />
      ) : null}

      {data ? (
        <>
          <MetricGrid
            items={[
              {
                icon: 'sessions',
                label: 'Sessoes conectadas',
                value: formatCount(data.sessionSummary.connected),
                hint: `${formatCount(data.sessionSummary.total)} sessoes monitoradas.`,
              },
              {
                icon: 'diagnostics',
                label: 'Socket clients',
                value: formatCount(data.diagnostics.socketConnections),
                hint: 'Quantidade de clientes conectados reportada pela API de diagnostico.',
              },
              {
                icon: 'dashboard',
                label: 'Runtime',
                value: String(data.runtime.runtime || 'unknown').toUpperCase(),
                hint: `Ngrok ${data.runtime.ngrok || 'unknown'} • porta ${data.runtime.port || 'n/d'}.`,
              },
              {
                icon: 'analytics',
                label: 'Issues em fallback',
                value: formatCount(data.issues.length),
                hint: data.issues.length > 0 ? data.issues.join(', ') : 'Nenhuma origem em fallback no ultimo snapshot.',
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-[1.35fr,1fr]">
            <StatusGrid title="Blocos de status estruturados" items={data.statusItems} />
            <SessionOverviewList sessions={data.sessions} />
          </div>
        </>
      ) : null}
    </div>
  );
}
