import { MonochromeIcon } from '../../icons/MonochromeIcon';

type MetricIcon =
  | 'analytics'
  | 'chart'
  | 'contacts'
  | 'dashboard'
  | 'diagnostics'
  | 'inbox'
  | 'map'
  | 'message'
  | 'sessions';

type MetricItem = {
  hint?: string;
  icon: MetricIcon;
  label: string;
  value: string;
};

type MetricGridProps = {
  items: MetricItem[];
};

export function MetricGrid({ items }: MetricGridProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="crm-card crm-hover-lift min-w-0 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-textMuted">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-textPrimary">{item.value}</p>
            </div>
            <span className="rounded-xl border border-borderSoft bg-panelSoft/90 p-2.5 text-textSecondary">
              <MonochromeIcon name={item.icon} className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-sm text-textSecondary">{item.hint || 'Sem detalhe complementar.'}</p>
        </article>
      ))}
    </section>
  );
}
