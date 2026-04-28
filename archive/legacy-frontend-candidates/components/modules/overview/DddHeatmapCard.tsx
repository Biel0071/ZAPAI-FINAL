import { RegionSummaryEntry, StateHeatmapEntry, type DddHeatmapEntry } from '../../../utils/ddd';
import { StatePanel } from '../../ui/StatePanel';

type DddHeatmapCardProps = {
  compact?: boolean;
  entries: DddHeatmapEntry[];
  regions: RegionSummaryEntry[];
  states: StateHeatmapEntry[];
  title?: string;
};

function intensityClasses(share: number) {
  if (share >= 18) {
    return 'border-slate-200/35 bg-slate-100/12';
  }

  if (share >= 10) {
    return 'border-slate-300/25 bg-slate-300/10';
  }

  if (share >= 5) {
    return 'border-slate-400/20 bg-slate-400/6';
  }

  return 'border-borderSoft bg-panelSoft/70';
}

export function DddHeatmapCard({
  entries,
  regions,
  states,
  compact = false,
  title = 'Mapa de DDD e calor regional',
}: DddHeatmapCardProps) {
  const visibleStates = compact ? states.slice(0, 8) : states.slice(0, 18);
  const visibleDdds = compact ? entries.slice(0, 6) : entries.slice(0, 10);

  return (
    <article className="crm-card p-4">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-textPrimary">{title}</h3>
        <p className="mt-1 text-sm text-textSecondary">
          Leitura pronta para dashboard e analytics com DDD validado, estado e regiao consolidados.
        </p>
      </header>

      {states.length === 0 ? (
        <StatePanel
          tone="empty"
          title="Sem base geografica suficiente"
          description="A camada de DDD ignora grupos, newsletters e identificadores invalidos para manter o mapa confiavel."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.2fr,0.95fr]">
          <div className="space-y-3">
            <div className={`grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {visibleStates.map((state) => (
                <div key={state.stateCode} className={`rounded-xl border px-3 py-3 ${intensityClasses(state.share)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-textMuted">{state.stateCode}</p>
                      <p className="mt-1 text-sm font-semibold text-textPrimary">{state.state}</p>
                    </div>
                    <p className="text-lg font-semibold text-textPrimary">{state.count}</p>
                  </div>
                  <p className="mt-2 text-xs text-textSecondary">
                    {state.region} • {state.share}% do mapa • DDDs {state.ddds.join(', ')}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              {regions.map((region) => (
                <div key={region.region} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-textMuted">{region.region}</p>
                  <p className="mt-2 text-xl font-semibold text-textPrimary">{region.count}</p>
                  <p className="mt-1 text-xs text-textSecondary">{region.share}% dos contatos mapeados</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {visibleDdds.map((entry) => (
              <div key={entry.ddd} className="rounded-xl border border-borderSoft bg-panelSoft/70 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-textMuted">DDD {entry.ddd}</p>
                    <p className="mt-1 text-sm font-semibold text-textPrimary">
                      {entry.state} • {entry.region}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-textPrimary">{entry.count}</p>
                    <p className="text-xs text-textSecondary">{entry.share}% da base</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
