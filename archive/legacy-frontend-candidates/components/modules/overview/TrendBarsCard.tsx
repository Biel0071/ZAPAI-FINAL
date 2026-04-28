import { StatePanel } from '../../ui/StatePanel';

type TrendPoint = {
  label: string;
  leads: number;
  messages: number;
};

type TrendBarsCardProps = {
  points: TrendPoint[];
  subtitle?: string;
  title: string;
};

export function TrendBarsCard({ title, subtitle, points }: TrendBarsCardProps) {
  const peak = points.reduce((accumulator, point) => Math.max(accumulator, point.messages, point.leads), 1);

  return (
    <article className="crm-card p-4">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-textPrimary">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-textSecondary">{subtitle}</p> : null}
      </header>

      {points.length === 0 ? (
        <StatePanel
          compact
          tone="empty"
          title="Sem historico suficiente"
          description="Os indicadores aparecem aqui assim que o backend consolidar o volume diario."
        />
      ) : (
        <div className="space-y-3">
          {points.map((point) => {
            const primaryWidth = Math.max(6, (point.messages / peak) * 100);
            const secondaryWidth = Math.max(4, (point.leads / peak) * 100);

            return (
              <div key={point.label} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-textPrimary">{point.label}</p>
                  <p className="text-xs text-textSecondary">
                    {point.messages} msgs • {point.leads} leads
                  </p>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-textMuted">
                      <span>Mensagens</span>
                      <span>{point.messages}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/20">
                      <div
                        className="h-full rounded-full bg-slate-200/90"
                        style={{ width: `${primaryWidth}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-textMuted">
                      <span>Leads</span>
                      <span>{point.leads}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/20">
                      <div
                        className="h-full rounded-full bg-slate-500/80"
                        style={{ width: `${secondaryWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
