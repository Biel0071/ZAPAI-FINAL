import type { Conversation, MetricsSummary, SessionInfo } from "@/services/apiService";

export type DashboardMapScope = "regions" | "states" | "ddds";

export type DashboardLovableMetricCard = {
  label: string;
  value: string;
  badgeLabel?: string;
  tone: "online" | "offline" | "warning" | "syncing";
};

export type DashboardLovableTab = {
  id: "overview" | "performance" | "conversations" | "ai" | "schedule" | "map";
  label: string;
};

export type DashboardMapPoint = {
  id: string;
  label: string;
  count: number;
  lat: number;
  lng: number;
};

export type DashboardMapRow = {
  id: string;
  label: string;
  meta: string;
  count: number;
  share: number;
  lat?: number;
  lng?: number;
};

export type DashboardMapSummaryCard = {
  label: string;
  value: string;
};

export type LeadPin = {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  funnelStage: string;
};

export type DashboardLovableViewModel = {
  tabs: DashboardLovableTab[];
  overviewCards: DashboardLovableMetricCard[];
  map: {
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    scopes: Array<{ id: DashboardMapScope; label: string }>;
    regionRows: DashboardMapRow[];
    stateRows: DashboardMapRow[];
    dddRows: DashboardMapRow[];
    points: DashboardMapPoint[];
    leadPins: LeadPin[];
    summaryCards: DashboardMapSummaryCard[];
    exportTitle: string;
    exportDescription: string;
  };
};

const DASHBOARD_TABS: DashboardLovableTab[] = [
  { id: "overview", label: "Visão Geral" },
  { id: "performance", label: "Performance" },
  { id: "conversations", label: "Conversas" },
  { id: "ai", label: "IA" },
  { id: "schedule", label: "Horários" },
  { id: "map", label: "Mapa de Origem" },
];

const MAP_SCOPES: Array<{ id: DashboardMapScope; label: string }> = [
  { id: "regions", label: "Regiões" },
  { id: "states", label: "Estados" },
  { id: "ddds", label: "DDDs" },
];

export const DDD_METADATA: Record<string, { stateCode: string; stateName: string; region: string; lat: number; lng: number }> = {
  "11": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -23.55, lng: -46.63 },
  "12": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -22.9, lng: -45.3 },
  "13": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -23.96, lng: -46.33 },
  "14": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -22.31, lng: -49.06 },
  "15": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -23.5, lng: -47.46 },
  "16": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -21.17, lng: -47.81 },
  "17": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -20.81, lng: -49.38 },
  "18": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -21.21, lng: -50.43 },
  "19": { stateCode: "SP", stateName: "São Paulo", region: "Sudeste", lat: -22.9, lng: -47.06 },
  "21": { stateCode: "RJ", stateName: "Rio de Janeiro", region: "Sudeste", lat: -22.91, lng: -43.17 },
  "22": { stateCode: "RJ", stateName: "Rio de Janeiro", region: "Sudeste", lat: -22.38, lng: -41.78 },
  "24": { stateCode: "RJ", stateName: "Rio de Janeiro", region: "Sudeste", lat: -22.52, lng: -44.1 },
  "27": { stateCode: "ES", stateName: "Espírito Santo", region: "Sudeste", lat: -20.32, lng: -40.34 },
  "28": { stateCode: "ES", stateName: "Espírito Santo", region: "Sudeste", lat: -19.54, lng: -40.63 },
  "31": { stateCode: "MG", stateName: "Minas Gerais", region: "Sudeste", lat: -19.92, lng: -43.94 },
  "32": { stateCode: "MG", stateName: "Minas Gerais", region: "Sudeste", lat: -21.76, lng: -43.35 },
  "33": { stateCode: "MG", stateName: "Minas Gerais", region: "Sudeste", lat: -18.85, lng: -41.95 },
  "34": { stateCode: "MG", stateName: "Minas Gerais", region: "Sudeste", lat: -18.91, lng: -48.27 },
  "35": { stateCode: "MG", stateName: "Minas Gerais", region: "Sudeste", lat: -21.55, lng: -45.43 },
  "37": { stateCode: "MG", stateName: "Minas Gerais", region: "Sudeste", lat: -20.14, lng: -44.88 },
  "38": { stateCode: "MG", stateName: "Minas Gerais", region: "Sudeste", lat: -16.73, lng: -43.86 },
  "41": { stateCode: "PR", stateName: "Paraná", region: "Sul", lat: -25.43, lng: -49.27 },
  "42": { stateCode: "PR", stateName: "Paraná", region: "Sul", lat: -25.1, lng: -50.16 },
  "43": { stateCode: "PR", stateName: "Paraná", region: "Sul", lat: -23.3, lng: -51.17 },
  "44": { stateCode: "PR", stateName: "Paraná", region: "Sul", lat: -23.42, lng: -51.93 },
  "45": { stateCode: "PR", stateName: "Paraná", region: "Sul", lat: -24.95, lng: -53.46 },
  "46": { stateCode: "PR", stateName: "Paraná", region: "Sul", lat: -26.23, lng: -52.67 },
  "47": { stateCode: "SC", stateName: "Santa Catarina", region: "Sul", lat: -26.92, lng: -49.07 },
  "48": { stateCode: "SC", stateName: "Santa Catarina", region: "Sul", lat: -27.59, lng: -48.55 },
  "49": { stateCode: "SC", stateName: "Santa Catarina", region: "Sul", lat: -27.1, lng: -52.61 },
  "51": { stateCode: "RS", stateName: "Rio Grande do Sul", region: "Sul", lat: -30.03, lng: -51.23 },
  "53": { stateCode: "RS", stateName: "Rio Grande do Sul", region: "Sul", lat: -31.77, lng: -52.34 },
  "54": { stateCode: "RS", stateName: "Rio Grande do Sul", region: "Sul", lat: -28.26, lng: -52.41 },
  "55": { stateCode: "RS", stateName: "Rio Grande do Sul", region: "Sul", lat: -29.69, lng: -53.8 },
  "61": { stateCode: "DF", stateName: "Distrito Federal", region: "Centro-Oeste", lat: -15.79, lng: -47.88 },
  "62": { stateCode: "GO", stateName: "Goiás", region: "Centro-Oeste", lat: -16.68, lng: -49.25 },
  "63": { stateCode: "TO", stateName: "Tocantins", region: "Norte", lat: -10.18, lng: -48.33 },
  "64": { stateCode: "GO", stateName: "Goiás", region: "Centro-Oeste", lat: -18.01, lng: -49.35 },
  "65": { stateCode: "MT", stateName: "Mato Grosso", region: "Centro-Oeste", lat: -15.6, lng: -56.1 },
  "66": { stateCode: "MT", stateName: "Mato Grosso", region: "Centro-Oeste", lat: -12.54, lng: -55.72 },
  "67": { stateCode: "MS", stateName: "Mato Grosso do Sul", region: "Centro-Oeste", lat: -20.47, lng: -54.62 },
  "68": { stateCode: "AC", stateName: "Acre", region: "Norte", lat: -9.97, lng: -67.81 },
  "69": { stateCode: "RO", stateName: "Rondônia", region: "Norte", lat: -8.76, lng: -63.9 },
  "71": { stateCode: "BA", stateName: "Bahia", region: "Nordeste", lat: -12.97, lng: -38.5 },
  "73": { stateCode: "BA", stateName: "Bahia", region: "Nordeste", lat: -14.79, lng: -39.28 },
  "74": { stateCode: "BA", stateName: "Bahia", region: "Nordeste", lat: -9.42, lng: -40.5 },
  "75": { stateCode: "BA", stateName: "Bahia", region: "Nordeste", lat: -12.26, lng: -38.96 },
  "77": { stateCode: "BA", stateName: "Bahia", region: "Nordeste", lat: -14.86, lng: -40.84 },
  "79": { stateCode: "SE", stateName: "Sergipe", region: "Nordeste", lat: -10.91, lng: -37.07 },
  "81": { stateCode: "PE", stateName: "Pernambuco", region: "Nordeste", lat: -8.05, lng: -34.88 },
  "82": { stateCode: "AL", stateName: "Alagoas", region: "Nordeste", lat: -9.65, lng: -35.71 },
  "83": { stateCode: "PB", stateName: "Paraíba", region: "Nordeste", lat: -7.12, lng: -34.86 },
  "84": { stateCode: "RN", stateName: "Rio Grande do Norte", region: "Nordeste", lat: -5.79, lng: -35.21 },
  "85": { stateCode: "CE", stateName: "Ceará", region: "Nordeste", lat: -3.73, lng: -38.52 },
  "86": { stateCode: "PI", stateName: "Piauí", region: "Nordeste", lat: -5.09, lng: -42.8 },
  "87": { stateCode: "PE", stateName: "Pernambuco", region: "Nordeste", lat: -8.28, lng: -35.97 },
  "88": { stateCode: "CE", stateName: "Ceará", region: "Nordeste", lat: -4.83, lng: -40.32 },
  "89": { stateCode: "PI", stateName: "Piauí", region: "Nordeste", lat: -7.08, lng: -41.47 },
  "91": { stateCode: "PA", stateName: "Pará", region: "Norte", lat: -1.45, lng: -48.49 },
  "92": { stateCode: "AM", stateName: "Amazonas", region: "Norte", lat: -3.1, lng: -60.02 },
  "93": { stateCode: "PA", stateName: "Pará", region: "Norte", lat: -5.37, lng: -49.12 },
  "94": { stateCode: "PA", stateName: "Pará", region: "Norte", lat: -6.07, lng: -49.89 },
  "95": { stateCode: "RR", stateName: "Roraima", region: "Norte", lat: 2.82, lng: -60.67 },
  "96": { stateCode: "AP", stateName: "Amapá", region: "Norte", lat: 0.03, lng: -51.05 },
  "97": { stateCode: "AM", stateName: "Amazonas", region: "Norte", lat: -4.24, lng: -69.94 },
  "98": { stateCode: "MA", stateName: "Maranhão", region: "Nordeste", lat: -2.53, lng: -44.3 },
  "99": { stateCode: "MA", stateName: "Maranhão", region: "Nordeste", lat: -5.53, lng: -47.49 },
};

const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Norte: { lat: -3.9, lng: -61.5 },
  Nordeste: { lat: -9.6, lng: -38.5 },
  Sudeste: { lat: -21.2, lng: -44.5 },
  Sul: { lat: -27.6, lng: -51.0 },
  "Centro-Oeste": { lat: -15.6, lng: -54.3 },
};

function toNumber(candidate: unknown): number {
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveMetricNumber(metrics: MetricsSummary | null, keys: string[]): number {
  if (!metrics) return 0;
  const bag = metrics as Record<string, unknown>;
  for (const key of keys) {
    if (key in bag && bag[key] !== undefined && bag[key] !== null) {
      return toNumber(bag[key]);
    }
  }
  return 0;
}

function resolveRuntimeLabel(runtimeStatus: "online" | "offline" | "reconnecting") {
  return runtimeStatus === "online" ? "Online" : runtimeStatus === "reconnecting" ? "Reconectando" : "Offline";
}

function normalizePhoneDdd(phone: string | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const ddd = normalized.slice(0, 2);
  return DDD_METADATA[ddd] ? ddd : null;
}

function buildAggregates(conversations: Conversation[]) {
  const dddMap = new Map<string, { count: number; meta: (typeof DDD_METADATA)[string] }>();
  const stateMap = new Map<string, { count: number; meta: (typeof DDD_METADATA)[string]; ddds: Set<string> }>();
  const regionMap = new Map<string, { count: number; states: Set<string> }>();
  const leadPins: LeadPin[] = [];

  conversations.forEach((conversation) => {
    const ddd = normalizePhoneDdd(conversation.phone);
    let lat = 0;
    let lng = 0;
    let hasCoords = false;

    // 1. Process custom geocoded pins from notes
    if (conversation.notes && conversation.notes.includes("Coordenadas:")) {
      try {
        const coordsMatch = conversation.notes.match(/Coordenadas:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i);
        if (coordsMatch) {
          lat = parseFloat(coordsMatch[1]);
          lng = parseFloat(coordsMatch[2]);
          hasCoords = true;
        }
      } catch (err) {
        console.error("Failed to parse lead pin:", err);
      }
    }

    // Fallback to DDD coordinates with dynamic jitter
    if (!hasCoords && ddd && DDD_METADATA[ddd]) {
      const idx = leadPins.length;
      const offsetLat = ((idx % 5) - 2) * 0.06 + (Math.random() - 0.5) * 0.05;
      const offsetLng = ((idx % 7) - 3) * 0.06 + (Math.random() - 0.5) * 0.05;
      lat = DDD_METADATA[ddd].lat + offsetLat;
      lng = DDD_METADATA[ddd].lng + offsetLng;
      hasCoords = true;
    }

    if (hasCoords) {
      let address = "";
      const addressMatch = conversation.notes?.match(/Endereço de Entrega:\s*(.+)/i);
      if (addressMatch) address = addressMatch[1].trim();

      leadPins.push({
        id: `lead-pin-${conversation.id}`,
        name: conversation.contactName || conversation.phone,
        phone: conversation.phone,
        address: address || (ddd ? `${DDD_METADATA[ddd].stateName}, Brasil` : "Brasil"),
        lat,
        lng,
        funnelStage: conversation.funnel_stage || "new_lead",
      });
    }

    if (!ddd) return;
    const metadata = DDD_METADATA[ddd];

    const existingDdd = dddMap.get(ddd) ?? { count: 0, meta: metadata };
    existingDdd.count += 1;
    dddMap.set(ddd, existingDdd);

    const existingState = stateMap.get(metadata.stateCode) ?? { count: 0, meta: metadata, ddds: new Set<string>() };
    existingState.count += 1;
    existingState.ddds.add(ddd);
    stateMap.set(metadata.stateCode, existingState);

    const existingRegion = regionMap.get(metadata.region) ?? { count: 0, states: new Set<string>() };
    existingRegion.count += 1;
    existingRegion.states.add(metadata.stateCode);
    regionMap.set(metadata.region, existingRegion);
  });

  const totalMapped = [...dddMap.values()].reduce((sum, entry) => sum + entry.count, 0);

  const dddRows: DashboardMapRow[] = [...dddMap.entries()]
    .map(([ddd, entry], index) => ({
      id: `ddd-${ddd}`,
      label: `DDD ${ddd}`,
      meta: `${entry.meta.stateCode} • ${entry.meta.region}`,
      count: entry.count,
      share: totalMapped > 0 ? Math.round((entry.count / totalMapped) * 100) : 0,
      lat: entry.meta.lat + ((index % 3) - 1) * 0.35,
      lng: entry.meta.lng + ((index % 4) - 1.5) * 0.35,
    }))
    .sort((a, b) => b.count - a.count);

  const stateRows: DashboardMapRow[] = [...stateMap.entries()]
    .map(([stateCode, entry]) => ({
      id: `state-${stateCode}`,
      label: entry.meta.stateName,
      meta: `${stateCode} • ${entry.meta.region} • ${entry.ddds.size} DDDs`,
      count: entry.count,
      share: totalMapped > 0 ? Math.round((entry.count / totalMapped) * 100) : 0,
      lat: entry.meta.lat,
      lng: entry.meta.lng,
    }))
    .sort((a, b) => b.count - a.count);

  const regionRows: DashboardMapRow[] = [...regionMap.entries()]
    .map(([region, entry]) => ({
      id: `region-${region}`,
      label: region,
      meta: `${entry.states.size} estados ativos`,
      count: entry.count,
      share: totalMapped > 0 ? Math.round((entry.count / totalMapped) * 100) : 0,
      lat: REGION_COORDINATES[region]?.lat,
      lng: REGION_COORDINATES[region]?.lng,
    }))
    .sort((a, b) => b.count - a.count);

  const points: DashboardMapPoint[] = stateRows.map((row) => ({
    id: row.id,
    label: row.label,
    count: row.count,
    lat: row.lat ?? -14.2,
    lng: row.lng ?? -51.9,
  }));

  return {
    totalMapped,
    regionRows,
    stateRows,
    dddRows,
    points,
    leadPins,
  };
}

export function getDashboardMapRows(
  map: DashboardLovableViewModel["map"],
  scope: DashboardMapScope,
): DashboardMapRow[] {
  if (scope === "states") return map.stateRows;
  if (scope === "ddds") return map.dddRows;
  return map.regionRows;
}

export function createDashboardLovableViewModel(params: {
  conversations: Conversation[];
  metrics: MetricsSummary | null;
  sessions: SessionInfo[];
  runtimeStatus: "online" | "offline" | "reconnecting";
  sessionState: "online" | "offline";
  activeSessions?: number;
  totalSessions?: number;
}): DashboardLovableViewModel {
  const {
    conversations,
    metrics,
    sessions,
    runtimeStatus,
    sessionState,
    activeSessions: providedActiveSessions,
    totalSessions: providedTotalSessions,
  } = params;

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const activeSessions = typeof providedActiveSessions === "number"
    ? providedActiveSessions
    : safeSessions.filter((session) => session && (session.connected || (session.status ?? "").toLowerCase() === "connected")).length;
  const totalSessions = typeof providedTotalSessions === "number" ? providedTotalSessions : safeSessions.length;
  const activeChats = resolveMetricNumber(metrics, ["activeChats", "activeConversations", "totalConversations", "chats"]);
  const newLeads = resolveMetricNumber(metrics, ["newLeads", "leads"]);
  const { totalMapped, regionRows, stateRows, dddRows, points, leadPins } = buildAggregates(conversations);

  return {
    tabs: DASHBOARD_TABS,
    overviewCards: [
      {
        label: "Fila operacional",
        value: String(activeChats),
        badgeLabel: `${Math.max(newLeads, 0)} pendentes`,
        tone: activeChats > 0 ? "syncing" : "offline",
      },
      {
        label: "Status do runtime",
        value: resolveRuntimeLabel(runtimeStatus),
        badgeLabel: runtimeStatus === "online" ? "ONLINE" : runtimeStatus === "reconnecting" ? "RECONNECTING" : "OFFLINE",
        tone: runtimeStatus === "online" ? "online" : runtimeStatus === "reconnecting" ? "warning" : "offline",
      },
      {
        label: "Saúde do websocket",
        value: runtimeStatus === "online" ? "1" : "0",
        badgeLabel: runtimeStatus === "online" ? "ONLINE" : "DEGRADADO",
        tone: runtimeStatus === "online" ? "online" : "warning",
      },
      {
        label: "Estado da operação",
        value: sessionState === "online" ? "Online" : "Offline",
        badgeLabel: activeSessions > 0 ? `${activeSessions}/${Math.max(totalSessions, 1)} sessões online` : "Operação degradada",
        tone: sessionState === "online" ? "online" : "offline",
      },
    ],
    map: {
      title: "Densidade de Leads por Localização",
      description: "Interaja com o mapa para filtrar por região, estado ou DDD",
      emptyTitle: "Nenhum lead com geografia válida",
      emptyDescription: "Assim que conversas com DDD reconhecível entrarem na base, o mapa do dashboard será populado automaticamente.",
      scopes: MAP_SCOPES,
      regionRows,
      stateRows,
      dddRows,
      points,
      leadPins,
      summaryCards: [
        { label: "TOTAL MAPEADO", value: totalMapped.toLocaleString("pt-BR") },
        { label: "ESTADOS ATIVOS", value: String(stateRows.length) },
        { label: "DDDS IDENTIFICADOS", value: String(dddRows.length) },
      ],
      exportTitle: "Exportar Dados",
      exportDescription: "Baixe volumetria em CSV",
    },
  };
}
