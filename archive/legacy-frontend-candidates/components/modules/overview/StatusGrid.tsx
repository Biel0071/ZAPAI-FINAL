import { ExecutiveStatusItem } from '../../../hooks/useExecutiveOverview';
import { MonochromeIcon } from '../../icons/MonochromeIcon';
import { StatePanel } from '../../ui/StatePanel';

type StatusGridProps = {
  items: ExecutiveStatusItem[];
  title: string;
};

function toneClasses(tone: ExecutiveStatusItem['tone']) {
  switch (tone) {
    case 'good':
      return 'border-emerald-500/25 bg-emerald-500/8 text-emerald-100';
    case 'warn':
      return 'border-amber-500/25 bg-amber-500/8 text-amber-100';
    case 'danger':
      return 'border-rose-500/25 bg-rose-500/8 text-rose-100';
    default:
      return 'border-borderSoft bg-panelSoft/70 text-textSecondary';
  }
}

function toneIcon(tone: ExecutiveStatusItem['tone']) {
  switch (tone) {
    case 'good':
      return 'checkCircle';
    case 'warn':
      return 'clock';
    case 'danger':
      return 'warning';
    default:
      return 'info';
  }
}

export function StatusGrid({ title, items }: StatusGridProps) {
  return (
    <article className="crm-card p-4">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-textPrimary">{title}</h3>
        <p className="mt-1 text-sm text-textSecondary">Guarda de resiliencia para API, runtime e canais de comunicacao.</p>
      </header>

      {items.length === 0 ? (
        <StatePanel
          compact
          tone="empty"
          title="Sem telemetria"
          description="Nenhum bloco de status foi disponibilizado pela camada de diagnostico."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className={`rounded-xl border px-4 py-3 ${toneClasses(item.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-current/70">{item.label}</p>
                  <p className="mt-2 text-base font-semibold text-textPrimary">{item.status}</p>
                </div>
                <span className="rounded-full border border-current/10 bg-black/10 p-2">
                  <MonochromeIcon name={toneIcon(item.tone)} className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-sm text-current/85">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
