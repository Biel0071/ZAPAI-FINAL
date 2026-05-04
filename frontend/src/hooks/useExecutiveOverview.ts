import { useCallback, useEffect, useState } from 'react';
import { buildApiUrl } from '@/config/runtime';
import { Contact, SessionStatus } from '@/types';
import {
  buildDddHeatmap,
  buildRegionSummary,
  buildStateHeatmap,
  type DddHeatmapEntry,
  type RegionSummaryEntry,
  type StateHeatmapEntry,
} from '@/lib/ddd';

type DailyPoint = {
  date: string;
  label: string;
  leads: number;
  messages: number;
};

type DashboardPayload = {
  charts?: { daily?: Array<{ date?: string; leads?: number; messages?: number }> };
  metrics?: { leads?: number; messages?: number; sessions?: number };
  resolvedConversations?: number;
  responseRate?: number;
};

type AnalyticsPayload = DashboardPayload & {
  aiErrors?: number;
  averageServiceTime?: number;
  topWords?: string[];
  totalConversations?: number;
};

type MetricsPayload = {
  activeConversations?: number;
  generatedAt?: string;
  leads?: number;
  messages?: number;
  sessions?: number;
  totalConversations?: number;
  totalMessages?: number;
  uptime?: number;
};

type SystemStatusPayload = {
  aiEngine?: string;
  campaignQueue?: string;
  database?: string;
  metrics?: {
    generatedAt?: string;
    messagesProcessed?: number;
    uptime?: number;
  };
  microtaskRunner?: string;
  sessions?: {
    connected?: number;
    total?: number;
  };
  socket?: string;
  whatsapp?: {
    connected?: boolean;
  };
};

type RuntimeStatusPayload = {
  runtime?: string;
  ngrok?: string;
  port?: string | number;
  tunnel?: string | null;
  ngrokProcess?: string;
  lastHealthCheck?: string | null;
  lastNgrokRestart?: string | null;
  ngrokRestartAttempts?: number;
};

type DiagnosticsPayload = {
  aiEngineStatus?: boolean;
  databaseStatus?: boolean;
  runtimeActive?: boolean;
  socketConnections?: number;
  systemStatus?: string;
  whatsappStatus?: {
    lastError?: string | null;
    phone?: string | null;
    retryCount?: number;
    sessionId?: string;
    sessionName?: string;
    status?: string;
    systemConnected?: boolean;
  };
};

export type ExecutiveStatusTone = 'danger' | 'good' | 'neutral' | 'warn';

export type ExecutiveStatusItem = {
  detail: string;
  id: string;
  label: string;
  status: string;
  tone: ExecutiveStatusTone;
};

export type ExecutiveOverviewData = {
  contacts: Contact[];
  coverage: {
    mappedContacts: number;
    totalContacts: number;
    unmappedContacts: number;
  };
  daily: DailyPoint[];
  dddHeatmap: DddHeatmapEntry[];
  diagnostics: DiagnosticsPayload;
  issues: string[];
  metrics: {
    activeConversations: number;
    aiErrors: number;
    averageServiceTime: number;
    leads: number;
    messages: number;
    resolvedConversations: number;
    responseRate: number;
    sessions: number;
    totalContacts: number;
    totalConversations: number;
  };
  partial: boolean;
  refreshedAt: string;
  regionSummary: RegionSummaryEntry[];
  runtime: RuntimeStatusPayload;
  sessions: SessionStatus[];
  sessionSummary: {
    connected: number;
    total: number;
  };
  stateHeatmap: StateHeatmapEntry[];
  statusItems: ExecutiveStatusItem[];
  system: SystemStatusPayload;
  topWords: string[];
};

const CACHE_TTL_MS = 60_000;

let cachedOverview: ExecutiveOverviewData | null = null;
let cachedOverviewAt = 0;
let pendingOverviewPromise: Promise<ExecutiveOverviewData> | null = null;

async function fetchJson<T>(endpoint: string): Promise<T> {
  const response = await fetch(buildApiUrl(endpoint), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${endpoint} returned ${response.status}`);
  }

  return (await response.json()) as T;
}

function buildFallbackDailySeries(): DailyPoint[] {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));

    return {
      date: date.toISOString(),
      label: date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      }),
      leads: 0,
      messages: 0,
    };
  });
}

function normalizeDailySeries(
  primary: Array<{ date?: string; leads?: number; messages?: number }> | undefined,
  secondary: Array<{ date?: string; leads?: number; messages?: number }> | undefined,
) {
  const source = Array.isArray(primary) && primary.length > 0 ? primary : Array.isArray(secondary) ? secondary : [];

  if (source.length === 0) {
    return buildFallbackDailySeries();
  }

  return source.map((point) => {
    const rawDate = String(point?.date || '').trim();
    const parsed = rawDate ? new Date(rawDate) : new Date();
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

    return {
      date: safeDate.toISOString(),
      label: safeDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      }),
      leads: Number(point?.leads) || 0,
      messages: Number(point?.messages) || 0,
    };
  });
}

function toneFromStatus(value: string | boolean | undefined): ExecutiveStatusTone {
  if (typeof value === 'boolean') {
    return value ? 'good' : 'danger';
  }

  const normalized = String(value || '').toLowerCase();

  if (!normalized || normalized === 'unknown') {
    return 'neutral';
  }

  if (
    normalized.includes('connected') ||
    normalized.includes('running') ||
    normalized.includes('healthy') ||
    normalized.includes('active') ||
    normalized.includes('connected')
  ) {
    return 'good';
  }

  if (
    normalized.includes('qr') ||
    normalized.includes('pending') ||
    normalized.includes('connecting') ||
    normalized.includes('degraded')
  ) {
    return 'warn';
  }

  if (
    normalized.includes('disconnected') ||
    normalized.includes('inactive') ||
    normalized.includes('offline') ||
    normalized.includes('error') ||
    normalized.includes('failed')
  ) {
    return 'danger';
  }

  return 'neutral';
}

function humanizeStatus(value: string | boolean | undefined, fallback: string) {
  if (typeof value === 'boolean') {
    return value ? 'Ativo' : 'Indisponível';
  }

  const normalized = String(value || '').trim();

  if (!normalized) {
    return fallback;
  }

  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueWords(words: string[] | undefined) {
  return Array.from(new Set((words || []).map((entry) => String(entry || '').trim()).filter(Boolean))).slice(0, 8);
}

async function fetchExecutiveOverview(force = false): Promise<ExecutiveOverviewData> {
  if (!force && cachedOverview && Date.now() - cachedOverviewAt < CACHE_TTL_MS) {
    return cachedOverview;
  }

  if (!force && pendingOverviewPromise) {
    return pendingOverviewPromise;
  }

  pendingOverviewPromise = (async () => {
    const labels = [
      'dashboard',
      'analytics',
      'metrics',
      'system',
      'runtime',
      'diagnostics',
      'contacts',
      'sessions',
    ] as const;

    const [
      dashboardResult,
      analyticsResult,
      metricsResult,
      systemResult,
      runtimeResult,
      diagnosticsResult,
      contactsResult,
      sessionsResult,
    ] = await Promise.allSettled([
      fetchJson<DashboardPayload>('/api/dashboard'),
      fetchJson<AnalyticsPayload>('/api/analytics'),
      fetchJson<MetricsPayload>('/metrics'),
      fetchJson<SystemStatusPayload>('/system/status'),
      fetchJson<RuntimeStatusPayload>('/system/runtime/status'),
      fetchJson<DiagnosticsPayload>('/diagnostics'),
      fetchJson<Contact[]>('/api/contacts'),
      fetchJson<SessionStatus[]>('/sessions'),
    ]);

    const settled = [
      dashboardResult,
      analyticsResult,
      metricsResult,
      systemResult,
      runtimeResult,
      diagnosticsResult,
      contactsResult,
      sessionsResult,
    ];

    const issues = settled.reduce<string[]>((accumulator, result, index) => {
      if (result.status === 'rejected') {
        accumulator.push(labels[index]);
      }

      return accumulator;
    }, []);

    const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value : {};
    const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : {};
    const metrics = metricsResult.status === 'fulfilled' ? metricsResult.value : {};
    const system = systemResult.status === 'fulfilled' ? systemResult.value : {};
    const runtime = runtimeResult.status === 'fulfilled' ? runtimeResult.value : {};
    const diagnostics = diagnosticsResult.status === 'fulfilled' ? diagnosticsResult.value : {};
    const contacts = contactsResult.status === 'fulfilled' && Array.isArray(contactsResult.value)
      ? contactsResult.value
      : [];
    const sessions = sessionsResult.status === 'fulfilled' && Array.isArray(sessionsResult.value)
      ? sessionsResult.value
      : [];

    const daily = normalizeDailySeries(analytics?.charts?.daily, dashboard?.charts?.daily);
    const dddHeatmap = buildDddHeatmap(contacts);
    const regionSummary = buildRegionSummary(dddHeatmap);
    const stateHeatmap = buildStateHeatmap(dddHeatmap);
    const mappedContacts = dddHeatmap.reduce((sum, entry) => sum + entry.count, 0);
    const sessionSummary = {
      connected:
        sessions.filter((session) => Boolean(session?.connected) || String(session?.status || '').toLowerCase().includes('connected'))
          .length || Number(system?.sessions?.connected) || 0,
      total: sessions.length || Number(system?.sessions?.total) || 0,
    };

    const overview: ExecutiveOverviewData = {
      contacts,
      coverage: {
        mappedContacts,
        totalContacts: contacts.length,
        unmappedContacts: Math.max(0, contacts.length - mappedContacts),
      },
      daily,
      dddHeatmap,
      diagnostics,
      issues,
      metrics: {
        activeConversations: Number(metrics?.activeConversations) || 0,
        aiErrors: Number(analytics?.aiErrors) || 0,
        averageServiceTime: Number(analytics?.averageServiceTime) || 0,
        leads: Number(metrics?.leads ?? dashboard?.metrics?.leads ?? analytics?.metrics?.leads) || 0,
        messages: Number(metrics?.messages ?? dashboard?.metrics?.messages ?? analytics?.metrics?.messages) || 0,
        resolvedConversations: Number(analytics?.resolvedConversations ?? dashboard?.resolvedConversations) || 0,
        responseRate: Number(analytics?.responseRate ?? dashboard?.responseRate) || 0,
        sessions: Number(metrics?.sessions ?? dashboard?.metrics?.sessions ?? analytics?.metrics?.sessions) || 0,
        totalContacts: contacts.length,
        totalConversations: Number(metrics?.totalConversations ?? analytics?.totalConversations ?? contacts.length) || 0,
      },
      partial: issues.length > 0,
      refreshedAt:
        String(metrics?.generatedAt || system?.metrics?.generatedAt || new Date().toISOString()) || new Date().toISOString(),
      regionSummary,
      runtime,
      sessions,
      sessionSummary,
      stateHeatmap,
      statusItems: [
        {
          detail: system?.database ? `Estado reportado: ${system.database}` : diagnostics?.databaseStatus ? 'Conexão validada' : 'Sem telemetria',
          id: 'database',
          label: 'Banco',
          status: humanizeStatus(system?.database || diagnostics?.databaseStatus, 'Sem status'),
          tone: toneFromStatus(system?.database || diagnostics?.databaseStatus),
        },
        {
          detail: diagnostics?.whatsappStatus?.phone
            ? `Número ${diagnostics.whatsappStatus.phone}`
            : `Sessões conectadas ${sessionSummary.connected}/${Math.max(sessionSummary.total, 1)}`,
          id: 'whatsapp',
          label: 'WhatsApp',
          status: humanizeStatus(
            diagnostics?.whatsappStatus?.status || system?.whatsapp?.connected,
            'Sem status',
          ),
          tone: toneFromStatus(diagnostics?.whatsappStatus?.status || system?.whatsapp?.connected),
        },
        {
          detail: runtime?.ngrok ? `Ngrok ${runtime.ngrok}` : 'Monitoramento local',
          id: 'runtime',
          label: 'Runtime',
          status: humanizeStatus(runtime?.runtime || diagnostics?.runtimeActive, 'Sem status'),
          tone: toneFromStatus(runtime?.runtime || diagnostics?.runtimeActive),
        },
        {
          detail: `${Number(diagnostics?.socketConnections) || 0} conexões ativas`,
          id: 'socket',
          label: 'Socket',
          status: humanizeStatus(system?.socket || diagnostics?.systemStatus, 'Sem status'),
          tone: toneFromStatus(system?.socket || diagnostics?.systemStatus),
        },
        {
          detail: `Motor reportado: ${system?.aiEngine || 'unknown'}`,
          id: 'ai',
          label: 'AI Engine',
          status: humanizeStatus(diagnostics?.aiEngineStatus, 'Sem status'),
          tone: toneFromStatus(diagnostics?.aiEngineStatus),
        },
        {
          detail: `Fila ${system?.campaignQueue || 'unknown'} e microtarefas ${system?.microtaskRunner || 'unknown'}`,
          id: 'operations',
          label: 'Operação',
          status: humanizeStatus(system?.campaignQueue || system?.microtaskRunner, 'Sem status'),
          tone: toneFromStatus(system?.campaignQueue || system?.microtaskRunner),
        },
      ],
      system,
      topWords: uniqueWords(analytics?.topWords),
    };

    cachedOverview = overview;
    cachedOverviewAt = Date.now();

    return overview;
  })().finally(() => {
    pendingOverviewPromise = null;
  });

  return pendingOverviewPromise;
}

export function useExecutiveOverview() {
  const [data, setData] = useState<ExecutiveOverviewData | null>(cachedOverview);
  const [loading, setLoading] = useState(!cachedOverview);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(
    cachedOverview?.partial ? 'Algumas fontes do backend não responderam. A interface segue com dados reais parciais.' : null,
  );

  const load = useCallback(async (force = false) => {
    const hasSnapshot = Boolean(cachedOverview);

    if (hasSnapshot) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const next = await fetchExecutiveOverview(force);
      setData(next);
      setError(
        next.partial
          ? `Dados reais parciais carregados. Fontes indisponíveis: ${next.issues.join(', ')}.`
          : null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar o overview executivo.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cacheIsFresh = Boolean(cachedOverview && Date.now() - cachedOverviewAt < CACHE_TTL_MS);

    if (cacheIsFresh) {
      setData(cachedOverview);
      setLoading(false);
      setError(
        cachedOverview?.partial
          ? `Dados reais parciais carregados. Fontes indisponíveis: ${cachedOverview.issues.join(', ')}.`
          : null,
      );
      return;
    }

    void load(true);
  }, [load]);

  return {
    data,
    error,
    loading,
    refresh: () => load(true),
    refreshing,
  };
}
