import { SessionStatus } from '../../../types';
import { StatePanel } from '../../ui/StatePanel';

type SessionOverviewListProps = {
  sessions: SessionStatus[];
};

function sessionTone(session: SessionStatus) {
  const normalized = String(session?.status || '').toLowerCase();

  if (Boolean(session?.connected) || normalized.includes('connected')) {
    return 'border-emerald-500/25 bg-emerald-500/8 text-emerald-100';
  }

  if (normalized.includes('qr') || normalized.includes('connecting')) {
    return 'border-amber-500/25 bg-amber-500/8 text-amber-100';
  }

  return 'border-borderSoft bg-panelSoft/70 text-textSecondary';
}

function humanizeStatus(value: string | undefined) {
  return String(value || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function SessionOverviewList({ sessions }: SessionOverviewListProps) {
  return (
    <article className="crm-card p-4">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-textPrimary">Lista de sessoes</h3>
        <p className="mt-1 text-sm text-textSecondary">Estado consolidado para painel executivo e pagina de diagnostico.</p>
      </header>

      {sessions.length === 0 ? (
        <StatePanel
          tone="empty"
          title="Nenhuma sessao retornada"
          description="O fallback mantem a tela operacional mesmo quando a API ainda nao entregou sessoes."
        />
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.sessionId} className={`rounded-xl border px-4 py-3 ${sessionTone(session)}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-textPrimary">
                    {session.sessionName || session.sessionId}
                  </p>
                  <p className="mt-1 text-xs text-current/85">{session.phone || 'Sem telefone vinculado'}</p>
                </div>
                <span className="rounded-full border border-current/10 bg-black/10 px-2 py-1 text-[11px] font-medium">
                  {humanizeStatus(session.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
