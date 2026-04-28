import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { MonochromeIcon } from '../../icons/MonochromeIcon';

type OverviewPageHeaderProps = {
  description: string;
  onRefresh?: () => void;
  partial?: boolean;
  refreshedAt?: string | null;
  refreshing?: boolean;
  title: string;
};

function formatRefreshLabel(value?: string | null) {
  if (!value) {
    return 'Sem sincronizacao recente';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Sem sincronizacao recente';
  }

  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

export function OverviewPageHeader({
  title,
  description,
  refreshedAt,
  partial = false,
  refreshing = false,
  onRefresh,
}: OverviewPageHeaderProps) {
  return (
    <header className="crm-card flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">Executive view</Badge>
          {partial ? <Badge variant="warning">Fallback parcial</Badge> : <Badge variant="success">Dados sincronizados</Badge>}
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-textPrimary">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-textSecondary">{description}</p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 md:items-end">
        <div className="inline-flex items-center gap-2 rounded-full border border-borderSoft bg-panelSoft/80 px-3 py-1.5 text-xs text-textSecondary">
          <MonochromeIcon name="clock" className="h-3.5 w-3.5" />
          <span>{formatRefreshLabel(refreshedAt)}</span>
        </div>
        {onRefresh ? (
          <Button type="button" variant="secondary" onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-2">
            <MonochromeIcon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Sincronizando' : 'Atualizar'}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
