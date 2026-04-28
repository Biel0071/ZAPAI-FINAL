import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { mockSessions } from '../lib/mocks';
import { socket } from '../lib/socket';
import { SessionStatus } from '../types';
import { ConnectionsList } from '../views/connections/ConnectionsList';

function normalizeSessionStatus(status: string | undefined): string {
  const normalized = String(status || 'idle').toLowerCase();

  if (normalized === 'qr_ready') {
    return 'qr';
  }

  if (normalized === 'disconnected') {
    return 'idle';
  }

  return normalized || 'idle';
}

export default function ConnectionsPage() {
  const [sessions, setSessions] = useState<SessionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>('idle');
  const qrSessionId = 'main';

  async function loadQr(sessionId: string = qrSessionId) {
    if (usingMock) {
      setQrCode(null);
      setQrStatus('mock');
      return;
    }

    try {
      const payload = await api.get<{ qr: string | null; status: string }>(`/sessions/qr?sessionId=${encodeURIComponent(sessionId)}`);
      setQrCode(payload?.qr || null);
      setQrStatus(payload?.status || 'idle');
    } catch {
      setQrCode(null);
      setQrStatus('pending');
    }
  }

  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<SessionStatus[]>('/sessions');
      setUsingMock(false);
      setSessions(
        (Array.isArray(data) ? data : []).map((item) => ({
          ...item,
          status: normalizeSessionStatus(item.status),
        })),
      );
      await loadQr(qrSessionId);
    } catch (loadError) {
      setUsingMock(true);
      setSessions(mockSessions);
      setQrCode(null);
      setQrStatus('mock');
      setError('Backend indisponivel. Exibindo sessoes mock.');
      console.warn('[Connections] fallback mock ativo:', loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    const onQrUpdate = (payload: { sessionId?: string; qr?: string; status?: string } = {}) => {
      if ((payload.sessionId || qrSessionId) !== qrSessionId) {
        return;
      }

      setQrCode(payload.qr || null);
      setQrStatus(normalizeSessionStatus(payload.status || 'qr'));
      setSessions((previous) => {
        const nextItem = {
          qr: payload.qr || null,
          sessionId: qrSessionId,
          sessionName: qrSessionId,
          status: 'qr',
        };

        if (!previous.some((item) => item.sessionId === qrSessionId)) {
          return [...previous, nextItem];
        }

        return previous.map((item) =>
          item.sessionId === qrSessionId ? { ...item, status: 'qr', qr: payload.qr || null } : item,
        );
      });
    };

    const onSessionConnected = (payload: { sessionId?: string; phone?: string; status?: string } = {}) => {
      const targetSessionId = payload.sessionId || qrSessionId;
      if (targetSessionId !== qrSessionId) {
        return;
      }

      setQrCode(null);
      setQrStatus('connected');
      setSessions((previous) => {
        if (!previous.some((item) => item.sessionId === targetSessionId)) {
          return [
            ...previous,
            {
              connected: true,
              phone: payload.phone || null,
              sessionId: targetSessionId,
              sessionName: targetSessionId,
              status: normalizeSessionStatus(payload.status || 'connected'),
            },
          ];
        }

        return previous.map((item) =>
          item.sessionId === targetSessionId
            ? {
                ...item,
                connected: true,
                phone: payload.phone || item.phone,
                status: normalizeSessionStatus(payload.status || 'connected'),
              }
            : item,
        );
      });
    };

    const onSessionStatus = (payload: { sessionId?: string; status?: string } = {}) => {
      const targetSessionId = payload.sessionId || qrSessionId;
      const nextStatus = normalizeSessionStatus(payload.status || 'idle');

      if (targetSessionId === qrSessionId) {
        setQrStatus(nextStatus);
      }

      setSessions((previous) => {
        if (!previous.some((item) => item.sessionId === targetSessionId)) {
          return [
            ...previous,
            {
              sessionId: targetSessionId,
              sessionName: targetSessionId,
              status: nextStatus,
            },
          ];
        }

        return previous.map((item) =>
          item.sessionId === targetSessionId ? { ...item, status: nextStatus } : item,
        );
      });
    };

    socket.on('qr.update', onQrUpdate);
    socket.on('session_qr', onQrUpdate);
    socket.on('session.connected', onSessionConnected);
    socket.on('session_connected', onSessionConnected);
    socket.on('session:status', onSessionStatus);
    socket.on('session_status', onSessionStatus);

    return () => {
      socket.off('qr.update', onQrUpdate);
      socket.off('session_qr', onQrUpdate);
      socket.off('session.connected', onSessionConnected);
      socket.off('session_connected', onSessionConnected);
      socket.off('session:status', onSessionStatus);
      socket.off('session_status', onSessionStatus);
    };
  }, [usingMock]);

  async function startSession() {
    if (usingMock) {
      setSessions((previous) => [
        ...previous,
        {
          sessionId: `mock-${Date.now()}`,
          sessionName: 'Sessao local',
          status: 'connecting',
        },
      ]);
      return;
    }

    await api.post('/sessions/start', {});
    await loadSessions();
  }

  async function reconnect(sessionId: string) {
    if (usingMock) {
      setSessions((previous) =>
        previous.map((item) => (item.sessionId === sessionId ? { ...item, status: 'connecting' } : item)),
      );
      return;
    }

    await api.post(`/sessions/${sessionId}/reconnect`, { force: true });
    await loadSessions();
  }

  return (
    <ConnectionsList
      sessions={sessions}
      loading={loading}
      error={error}
      onStartSession={() => void startSession()}
      onReconnect={(sessionId) => void reconnect(sessionId)}
      qrCode={qrCode}
      qrSessionId={qrSessionId}
      qrStatus={qrStatus}
      onRefreshQr={() => void loadQr(qrSessionId)}
    />
  );
}
