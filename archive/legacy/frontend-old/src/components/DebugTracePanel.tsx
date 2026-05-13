/**
 * ============================================================================
 * DEBUG TRACE PANEL
 * ============================================================================
 * 
 * Painel de debug para visualizar source of truth.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { sourceOfTruthTrace, TraceInfo } from '@/lib/traceSourceOfTruth';

export function DebugTracePanel() {
  const [traceInfo, setTraceInfo] = useState<TraceInfo | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadTrace = async () => {
      try {
        const info = await sourceOfTruthTrace.traceAll();
        if (!isMounted) return;
        setTraceInfo(info);
        setIsValid(sourceOfTruthTrace.validateSingleSourceOfTruth());
      } catch {
        if (!isMounted) return;
        setIsValid(false);
      }
    };

    void loadTrace();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadTrace = async () => {
    try {
      const info = await sourceOfTruthTrace.traceAll();
      setTraceInfo(info);
      setIsValid(sourceOfTruthTrace.validateSingleSourceOfTruth());
    } catch {
      setIsValid(false);
    }
  };

  if (import.meta.env.MODE === 'production') {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '10px 20px',
          background: isValid ? '#22c55e' : '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        🔍 Trace Source of Truth
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        background: 'rgba(0,0,0,0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#1e293b',
          color: '#f1f5f9',
          padding: '30px',
          borderRadius: '12px',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: isValid ? '#22c55e' : '#ef4444' }}>
            {isValid ? '✅ Single Source of Truth Valid' : '❌ Single Source of Truth Violation'}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              padding: '8px 16px',
              background: '#334155',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>

        <button
          onClick={loadTrace}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '20px',
          }}
        >
          🔄 Refresh Trace
        </button>

        {traceInfo && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <TraceSection title="Build Info">
              <TraceRow label="Build ID" value={traceInfo.buildId} />
              <TraceRow label="Build Time" value={traceInfo.buildTime} />
              <TraceRow label="Environment" value={traceInfo.environment} />
            </TraceSection>

            <TraceSection title="Frontend Source">
              <TraceRow label="Frontend Source" value={traceInfo.frontendSource} />
              <TraceRow label="JS Bundle" value={traceInfo.jsBundle} />
              <TraceRow label="CSS Bundle" value={traceInfo.cssBundle} />
            </TraceSection>

            <TraceSection title="API Origins">
              <TraceRow label="API Origin" value={traceInfo.apiOrigin} />
              <TraceRow label="WebSocket Origin" value={traceInfo.websocketOrigin} />
            </TraceSection>

            <TraceSection title="Service Worker">
              <TraceRow label="Registered" value={traceInfo.serviceWorker.registered.toString()} />
              <TraceRow label="Active" value={traceInfo.serviceWorker.active.toString()} />
              <TraceRow label="Controlled" value={traceInfo.serviceWorker.controlled.toString()} />
              <TraceRow label="State" value={traceInfo.serviceWorker.state} />
            </TraceSection>

            <TraceSection title="Cache Keys">
              {traceInfo.cacheKeys.length > 0 ? (
                traceInfo.cacheKeys.map((key, i) => (
                  <TraceRow key={i} label={`Cache ${i + 1}`} value={key} />
                ))
              ) : (
                <div style={{ color: '#94a3b8' }}>No cache keys found</div>
              )}
            </TraceSection>

            <TraceSection title="Storage Values">
              <TraceRow label="LocalStorage Keys" value={Object.keys(traceInfo.storageValues.localStorage || {}).length.toString()} />
              <TraceRow label="SessionStorage Keys" value={Object.keys(traceInfo.storageValues.sessionStorage || {}).length.toString()} />
              <TraceRow label="Cookies" value={traceInfo.storageValues.cookies ? 'present' : 'none'} />
            </TraceSection>

            <TraceSection title="Full Trace JSON">
              <pre style={{ background: '#0f172a', padding: '15px', borderRadius: '6px', overflow: 'auto' }}>
                {JSON.stringify(traceInfo, null, 2)}
              </pre>
            </TraceSection>
          </div>
        )}
      </div>
    </div>
  );
}

function TraceSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa', borderBottom: '1px solid #334155', paddingBottom: '5px' }}>
        {title}
      </h3>
      <div style={{ display: 'grid', gap: '8px' }}>{children}</div>
    </div>
  );
}

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px' }}>
      <div style={{ color: '#94a3b8' }}>{label}:</div>
      <div style={{ wordBreak: 'break-all', color: '#e2e8f0' }}>{value}</div>
    </div>
  );
}
