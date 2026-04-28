import { AiEngineStatus } from '../../lib/aiEngine';
import { KpiTile } from '../../components/modules/dashboard/KpiTile';

type DailyPoint = { date: string; messages: number; leads: number };

type AnalyticsSummary = {
  metrics: { messages: number; leads: number; sessions: number };
  responseRate: number;
  resolvedConversations: number;
  charts: { daily: DailyPoint[] };
};

type DashboardStatsProps = {
  loading: boolean;
  error: string | null;
  summary: AnalyticsSummary | null;
  aiStatus: AiEngineStatus | null;
};

function metric(value: number | undefined): string {
  return new Intl.NumberFormat('pt-BR').format(value ?? 0);
}

export function DashboardStats({ loading, error, summary, aiStatus }: DashboardStatsProps) {
  const points = summary?.charts?.daily || [];
  const peak = points.reduce((acc, item) => Math.max(acc, item.messages), 1);

  return (
    <div className="space-y-4">
      <header className="crm-card bg-panelSoft/80 p-5">
        <h2 className="text-2xl font-semibold text-textPrimary">Dashboard</h2>
        <p className="text-sm text-textSecondary">Visao geral do atendimento e performance operacional.</p>
      </header>

      {loading ? <p className="text-xs text-textSecondary">Carregando metricas...</p> : null}
      {error ? <p className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-xs text-amber-200">{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <KpiTile label="Mensagens" value={metric(summary?.metrics?.messages)} />
        <KpiTile label="Leads" value={metric(summary?.metrics?.leads)} />
        <KpiTile label="Sessoes" value={metric(summary?.metrics?.sessions)} />
        <KpiTile label="Taxa IA" value={`${summary?.responseRate ?? 0}%`} />
      </div>

      <section className="grid gap-3 lg:grid-cols-[2fr,1fr]">
        <article className="crm-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-textPrimary">Volume diario</h3>
          <div className="space-y-2">
            {points.length === 0 ? <p className="text-xs text-textSecondary">Sem dados no momento.</p> : null}
            {points.map((item) => (
              <div key={item.date} className="rounded-lg border border-borderSoft bg-panelSoft px-3 py-2">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-textPrimary">{item.date}</span>
                  <span className="text-textSecondary">Msgs: {item.messages}  Leads: {item.leads}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink/80">
                  <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${Math.max(8, (item.messages / peak) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="crm-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-textPrimary">System Control</h3>
          <p className={`text-sm font-semibold ${aiStatus?.active ? 'text-emerald-300' : 'text-amber-300'}`}>
            {aiStatus?.active ? 'AI Engine ativa' : 'AI Engine desativada'}
          </p>
          <p className="mt-1 text-xs text-textSecondary">{aiStatus?.message || 'Verificando...'}</p>
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg border border-accent/40 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-emerald-200">Ativar sistema</button>
            <button className="rounded-lg border border-borderSoft bg-panelSoft px-3 py-1.5 text-xs font-semibold text-textSecondary">Diagnostico</button>
          </div>
          <p className="mt-4 text-xs text-textMuted">Fallback seguro habilitado em caso de falha.</p>
        </article>
      </section>
    </div>
  );
}
