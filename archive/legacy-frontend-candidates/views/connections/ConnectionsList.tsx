import { SessionStatus } from '../../types';

type ConnectionsListProps = {
  sessions: SessionStatus[];
  loading: boolean;
  error: string | null;
  onStartSession: () => void;
  onReconnect: (sessionId: string) => void;
  qrCode: string | null;
  qrSessionId: string;
  qrStatus: string;
  onRefreshQr: () => void;
};

function statusColor(status: string): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'connected') return 'text-emerald-300';
  if (normalized === 'creating' || normalized === 'connecting' || normalized === 'qr') return 'text-amber-300';
  return 'text-rose-300';
}

function isConnectedStatus(status: string): boolean {
  return String(status || '').toLowerCase() === 'connected';
}

function isPendingStatus(status: string): boolean {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'connecting' || normalized === 'qr' || normalized === 'creating';
}

function formatStatusLabel(status: string): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'connected') return 'Conectada';
  if (normalized === 'connecting') return 'Conectando';
  if (normalized === 'qr') return 'Aguardando QR';
  if (normalized === 'creating') return 'Inicializando';
  if (normalized === 'error') return 'Erro';
  if (normalized === 'idle' || normalized === 'disconnected') return 'Desconectada';

  return status || 'Desconhecida';
}

export function ConnectionsList({
  sessions,
  loading,
  error,
  onStartSession,
  onReconnect,
  qrCode,
  qrSessionId,
  qrStatus,
  onRefreshQr,
}: ConnectionsListProps) {
  const connected = sessions.filter((item) => isConnectedStatus(item.status)).length;
  const connecting = sessions.filter((item) => isPendingStatus(item.status)).length;
  const disconnected = Math.max(0, sessions.length - connected - connecting);

  return (
    <div className="space-y-4">
      <header className="crm-card bg-panelSoft/80 p-5">
        <h2 className="text-2xl font-semibold text-textPrimary">Connections</h2>
        <p className="text-sm text-textSecondary">Gestao de sessoes WhatsApp</p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="crm-card p-4">
          <p className="text-xs text-textSecondary">Conectadas</p>
          <p className="mt-1 text-3xl font-bold text-emerald-300">{connected}</p>
        </article>
        <article className="crm-card p-4">
          <p className="text-xs text-textSecondary">Conectando</p>
          <p className="mt-1 text-3xl font-bold text-amber-300">{connecting}</p>
        </article>
        <article className="crm-card p-4">
          <p className="text-xs text-textSecondary">Desconectadas</p>
          <p className="mt-1 text-3xl font-bold text-rose-300">{disconnected}</p>
        </article>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onStartSession}
          className="rounded-xl border border-accent bg-gradient-primary px-4 py-2 text-sm font-semibold text-black shadow-glow"
        >
          Nova conexao
        </button>
      </div>

      {loading ? <p className="text-xs text-slate-400">Carregando sessoes...</p> : null}
      {error ? <p className="rounded-lg border border-amber-700 bg-amber-950/40 p-3 text-xs text-amber-200">{error}</p> : null}

      <section className="crm-card space-y-2 p-4">
        {sessions.length === 0 ? <p className="text-xs text-slate-400">Nenhuma sessao encontrada.</p> : null}

        {sessions.map((session) => (
          <article key={session.sessionId} className="crm-hover-lift flex items-center justify-between rounded-lg border border-borderSoft bg-panelSoft px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-textPrimary">{session.sessionName || session.sessionId}</p>
              <p className={`text-xs ${statusColor(session.status)}`}>Status: {formatStatusLabel(session.status)}</p>
            </div>
            <button
              type="button"
              onClick={() => onReconnect(session.sessionId)}
              className="rounded-lg border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textSecondary"
            >
              Reconectar
            </button>
          </article>
        ))}
      </section>

      <section className="crm-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-textPrimary">QR da Sessao</p>
            <p className="text-xs text-textSecondary">Sessao: {qrSessionId} | Status: {qrStatus || 'idle'}</p>
          </div>
          <button
            type="button"
            onClick={onRefreshQr}
            className="rounded-lg border border-borderSoft bg-panel px-3 py-1.5 text-xs font-semibold text-textSecondary"
          >
            Atualizar QR
          </button>
        </div>

        {String(qrStatus).toLowerCase() === 'connected' ? (
          <p className="rounded-lg border border-emerald-700 bg-emerald-950/30 p-3 text-xs text-emerald-200">
            Sessao conectada. Nao e necessario gerar novo QR.
          </p>
        ) : qrCode ? (
          <div className="rounded-lg border border-borderSoft bg-panelSoft p-3">
            <img src={qrCode} alt="QR Code da sessao WhatsApp" className="mx-auto h-72 w-72 max-w-full rounded-lg bg-white p-2" />
          </div>
        ) : (
          <p className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-xs text-amber-200">
            QR ainda nao disponivel. Inicie/reconecte a sessao e aguarde o evento realtime.
          </p>
        )}
      </section>
    </div>
  );
}
