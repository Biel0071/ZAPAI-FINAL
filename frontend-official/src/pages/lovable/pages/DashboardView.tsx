import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Export,
  ArrowClockwise,
  ShieldCheck,
  WarningCircle,
  Clock,
  Brain,
  Cpu,
  Plugs,
  Shield,
  Database,
  MagnifyingGlass,
  User,
  Chat,
  X,
  CaretRight,
  ChartBar,
  PaperPlaneTilt,
  CheckCircle,
  CalendarBlank,
} from "@phosphor-icons/react";
import { MapContainer, Marker, Popup, TileLayer, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  DDD_METADATA,
  type DashboardLovableViewModel,
  type DashboardMapScope,
  type DashboardMapRow,
  type LeadPin,
} from "@/core/adapters/lovable/dashboardAdapter";
import type { AnalyticsLovableViewModel } from "@/core/adapters/lovable/analyticsAdapter";
import AnalyticsView from "@/pages/lovable/pages/AnalyticsPageView";

const BASE_CENTER: [number, number] = [-14.2, -51.9];
const LeafletMapContainer = MapContainer as any;
const LeafletTileLayer = TileLayer as any;
const LeafletCircle = Circle as any;
const LeafletMarker = Marker as any;

function markerIcon() {
  return L.divIcon({
    className: "vivid-neon-marker",
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;width:100%;height:100%;border-radius:9999px;background:#06b6d4;opacity:0.6;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:absolute;width:140%;height:140%;border-radius:9999px;border:1.5px solid #06b6d4;opacity:0.4;animation:ping 3s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <div style="position:relative;width:12px;height:12px;border-radius:9999px;background:#06b6d4;box-shadow:0 0 12px #06b6d4, 0 0 24px #06b6d4;border:2px solid #ffffff;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function leadMarkerIcon(funnelStage: string, isSelected = false) {
  const isClosed = funnelStage === "closed";
  const isNegotiation = funnelStage === "negotiation" || funnelStage === "hot";
  const color = isSelected ? "#10b981" : isClosed ? "#00ff88" : isNegotiation ? "#f59e0b" : "#06b6d4";
  const glow = isSelected ? "rgba(16, 185, 129, 1)" : isClosed ? "rgba(0, 255, 136, 0.95)" : isNegotiation ? "rgba(245, 158, 11, 0.95)" : "rgba(6, 182, 212, 0.95)";
  const size = isSelected ? 36 : 28;
  const half = isSelected ? 18 : 14;
  const innerSize = isSelected ? 20 : 16;
  const zIndex = isSelected ? 9999 : 100;
  return L.divIcon({
    className: isSelected ? "vivid-lead-marker vivid-lead-marker-selected" : "vivid-lead-marker",
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:${zIndex};">
        <span style="position:absolute;width:${isSelected ? '180%' : '150%'};height:${isSelected ? '180%' : '150%'};border-radius:9999px;border:${isSelected ? '2px' : '1.5px'} solid ${color};opacity:${isSelected ? '0.85' : '0.5'};animation:ping ${isSelected ? '1.5s' : '3s'} cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:absolute;width:100%;height:100%;border-radius:9999px;background:${color};opacity:${isSelected ? '0.75' : '0.5'};animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <div style="position:relative;width:${innerSize}px;height:${innerSize}px;border-radius:9999px;background:${color};box-shadow:0 0 12px ${color}, 0 0 24px ${color}, 0 0 40px ${glow};border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;">
          <div style="width:${isSelected ? '7px' : '5px'};height:${isSelected ? '7px' : '5px'};border-radius:9999px;background:#ffffff;box-shadow:0 0 6px #ffffff;"></div>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

function toneClasses(tone: "online" | "offline" | "warning" | "syncing") {
  if (tone === "online") return "border-success/20 bg-success/10 text-success";
  if (tone === "warning") return "border-warning/20 bg-warning/10 text-warning";
  if (tone === "syncing") return "border-info/20 bg-info/10 text-info";
  return "border-border/70 bg-background/60 text-muted-foreground";
}

function healthTone(hasRows: boolean) {
  return hasRows ? "Saudável" : "Atenção";
}

function healthClass(hasRows: boolean) {
  return hasRows ? "bg-success/15 text-success" : "bg-warning/15 text-warning";
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

// React Leaflet view changer helper com transição suave flyTo
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { animate: true, duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

const getPhoneDdd = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  return normalized.slice(0, 2);
};

type DashboardDateRange = "today" | "yesterday" | "7days" | "15days" | "30days" | "90days" | "week" | "month" | "year" | "hour" | "custom" | "all";

export interface DashboardViewProps {
  viewModel: DashboardLovableViewModel;
  analyticsViewModel: AnalyticsLovableViewModel;
  activeTab: DashboardLovableViewModel["tabs"][number]["id"];
  activeMapScope: DashboardMapScope;
  mapRows: DashboardMapRow[];
  onTabChange: (tabId: DashboardLovableViewModel["tabs"][number]["id"]) => void;
  onMapScopeChange: (scope: DashboardMapScope) => void;
  onResetMap: () => void;
  onExportMap: () => void;
  dateRange: string;
  onDateRangeChange: (range: any) => void;
  customStart: string;
  customEnd: string;
  timeStart: string;
  timeEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  onTimeStartChange: (value: string) => void;
  onTimeEndChange: (value: string) => void;
  aiStatus?: any;
  aiMetrics?: any;
}

export function DashboardView({
  viewModel,
  analyticsViewModel,
  activeTab,
  activeMapScope,
  mapRows,
  onTabChange,
  onMapScopeChange,
  onResetMap,
  onExportMap,
  dateRange,
  onDateRangeChange,
  customStart,
  customEnd,
  timeStart,
  timeEnd,
  onCustomStartChange,
  onCustomEndChange,
  onTimeStartChange,
  onTimeEndChange,
  aiStatus,
  aiMetrics,
}: DashboardViewProps) {
  const navigate = useNavigate();
  const hasMappedRows = mapRows.length > 0;
  const topRegions = viewModel.map.regionRows.slice(0, 3);

  const safeAnalyticsViewModel = useMemo(() => {
    if (analyticsViewModel && Array.isArray(analyticsViewModel.kpis) && analyticsViewModel.kpis.length > 0) {
      return analyticsViewModel;
    }
    return {
      kpis: [
        { label: "Mensagens no período", value: "—", tone: "primary" as const, hint: "Total enviadas + recebidas" },
        { label: "Fila Ativa", value: "—", tone: "warning" as const, hint: "Conversas aguardando atendimento" },
        { label: "Participação da IA", value: "—", tone: "success" as const, hint: "Mensagens automáticas processadas" },
        { label: "Conversas no período", value: "—", tone: "info" as const, hint: "Contatos cadastrados no CRM" },
      ],
      chartData: [],
      tempDistribution: [],
      totalLeadsLabel: "0",
    };
  }, [analyticsViewModel]);

  // Leads and geography filter state for Hub 2
  const [selectedLead, setSelectedLead] = useState<LeadPin | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(BASE_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(4);
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [rightPanelTab, setRightPanelTab] = useState<"geography" | "leads">("geography");
  const [selectedGeoFilter, setSelectedGeoFilter] = useState<{
    type: "region" | "state" | "ddd" | null;
    value: string | null;
  }>({ type: null, value: null });

  // Filtering lead pins (exact coordinates) based on search and geo filters
  const filteredLeadPins = useMemo(() => {
    return viewModel.map.leadPins.filter((pin) => {
      const query = leadSearchQuery.toLowerCase().trim();
      if (query) {
        const matchName = pin.name.toLowerCase().includes(query);
        const matchPhone = pin.phone.includes(query);
        const matchAddress = pin.address.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchAddress) return false;
      }
      if (selectedGeoFilter.type === "region") {
        const ddd = getPhoneDdd(pin.phone);
        const meta = DDD_METADATA[ddd];
        return meta && meta.region === selectedGeoFilter.value;
      }
      if (selectedGeoFilter.type === "state") {
        const ddd = getPhoneDdd(pin.phone);
        const meta = DDD_METADATA[ddd];
        return meta && meta.stateCode === selectedGeoFilter.value;
      }
      if (selectedGeoFilter.type === "ddd") {
        const ddd = getPhoneDdd(pin.phone);
        return ddd === selectedGeoFilter.value;
      }
      return true;
    });
  }, [viewModel.map.leadPins, leadSearchQuery, selectedGeoFilter]);

  // All conversations formatted for geographical intelligence
  const allLeadsInPeriod = useMemo(() => {
    if (viewModel.map.leadPins && viewModel.map.leadPins.length > 0) {
      return viewModel.map.leadPins.map((pin) => {
        const ddd = pin.ddd || getPhoneDdd(pin.phone || "");
        const meta = ddd ? DDD_METADATA[ddd] : null;
        return {
          id: pin.conversationId ? String(pin.conversationId) : pin.id.replace("lead-pin-", ""),
          pinId: pin.id,
          name: pin.name,
          phone: pin.phone,
          address: pin.address,
          ddd: ddd || "—",
          state: pin.stateCode || meta?.stateCode || "—",
          stateName: pin.stateName || meta?.stateName || "Brasil",
          region: pin.region || meta?.region || "—",
          funnelStage: pin.funnelStage,
          lat: pin.lat,
          lng: pin.lng,
          hasExactCoords: pin.hasExactCoords ?? false,
        };
      });
    }

    return (viewModel.conversations || []).map((c) => {
      const ddd = getPhoneDdd(c.phone || "");
      const meta = ddd ? DDD_METADATA[ddd] : null;
      let lat = 0;
      let lng = 0;
      let hasCoords = false;
      if (c.notes && c.notes.includes("Coordenadas:")) {
        try {
          const match = c.notes.match(/Coordenadas:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
          if (match) {
            lat = parseFloat(match[1]);
            lng = parseFloat(match[2]);
            hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
          }
        } catch {
          // ignore
        }
      }
      return {
        id: String(c.id),
        pinId: `lead-pin-${c.id}`,
        name: c.contactName || c.phone || "Lead",
        phone: c.phone || "",
        address: c.notes?.match(/Endereço de Entrega:\s*(.+)/i)?.[1]?.trim() || (meta ? `${meta.stateName} (DDD ${ddd})` : "Brasil"),
        ddd: ddd || "—",
        state: meta?.stateCode || "—",
        stateName: meta?.stateName || "Brasil",
        region: meta?.region || "—",
        funnelStage: c.funnel_stage || "new_lead",
        lat: hasCoords ? lat : (meta?.lat || 0),
        lng: hasCoords ? lng : (meta?.lng || 0),
        hasExactCoords: hasCoords,
      };
    });
  }, [viewModel.map.leadPins, viewModel.conversations]);

  const filteredRegionalLeads = useMemo(() => {
    return allLeadsInPeriod.filter((lead) => {
      const query = leadSearchQuery.toLowerCase().trim();
      if (query) {
        const matchName = lead.name.toLowerCase().includes(query);
        const matchPhone = lead.phone.includes(query);
        const matchState = lead.state.toLowerCase().includes(query) || lead.stateName.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchState) return false;
      }
      if (selectedGeoFilter.type === "region") {
        return lead.region === selectedGeoFilter.value;
      }
      if (selectedGeoFilter.type === "state") {
        return lead.state === selectedGeoFilter.value;
      }
      if (selectedGeoFilter.type === "ddd") {
        return lead.ddd === selectedGeoFilter.value;
      }
      return true;
    });
  }, [allLeadsInPeriod, leadSearchQuery, selectedGeoFilter]);

  // Click handler to focus, fly-to and highlight a lead on the Leaflet map from the lateral list or map pin
  const handleLeadSelect = (lead: {
    id?: string | number;
    pinId?: string;
    name: string;
    phone: string;
    address?: string;
    lat?: number;
    lng?: number;
    funnelStage: string;
    ddd?: string;
    state?: string;
    stateName?: string;
    region?: string;
    hasExactCoords?: boolean;
  }) => {
    if (lead.lat && lead.lng) {
      setMapCenter([lead.lat, lead.lng]);
      setMapZoom(11);
    }
    const pinEquivalent: LeadPin = {
      id: lead.pinId || (String(lead.id || "").startsWith("lead-pin-") ? String(lead.id) : `lead-pin-${lead.id || lead.phone}`),
      name: lead.name,
      phone: lead.phone,
      address: lead.address || `${lead.stateName || lead.state || "Brasil"} (DDD ${lead.ddd || ""})`,
      lat: lead.lat ?? 0,
      lng: lead.lng ?? 0,
      funnelStage: lead.funnelStage || "new_lead",
      ddd: lead.ddd,
      stateCode: lead.state,
      stateName: lead.stateName,
      region: lead.region,
      hasExactCoords: lead.hasExactCoords,
    };
    setSelectedLead(pinEquivalent);
  };

  // Click handler for geography list items
  const handleGeoRowClick = (row: DashboardMapRow) => {
    if (activeMapScope === "regions") {
      setSelectedGeoFilter({ type: "region", value: row.label });
      setRightPanelTab("leads");
      if (row.lat && row.lng) {
        setMapCenter([row.lat, row.lng]);
        setMapZoom(5);
      }
    } else if (activeMapScope === "states") {
      const stateCode = row.id.replace("state-", "");
      setSelectedGeoFilter({ type: "state", value: stateCode });
      setRightPanelTab("leads");
      if (row.lat && row.lng) {
        setMapCenter([row.lat, row.lng]);
        setMapZoom(6);
      }
    } else if (activeMapScope === "ddds") {
      const dddCode = row.label.replace("DDD ", "");
      setSelectedGeoFilter({ type: "ddd", value: dddCode });
      setRightPanelTab("leads");
      if (row.lat && row.lng) {
        setMapCenter([row.lat, row.lng]);
        setMapZoom(8);
      }
    }
  };

  const handleConversasStateRowClick = (row: DashboardMapRow) => {
    const stateCode = row.id.replace("state-", "");
    setSelectedGeoFilter({ type: "state", value: stateCode });
    setRightPanelTab("leads");
    if (row.lat && row.lng) {
      setMapCenter([row.lat, row.lng]);
      setMapZoom(6);
    }
    onTabChange("map" as any);
  };

  // Reset geographical and search filters
  const handleResetFilters = () => {
    setSelectedGeoFilter({ type: null, value: null });
    setLeadSearchQuery("");
    setSelectedLead(null);
    setMapCenter(BASE_CENTER);
    setMapZoom(4);
    onResetMap();
  };

  const handleCenterBrazil = () => {
    setMapCenter(BASE_CENTER);
    setMapZoom(4);
  };

  const [selectedHourBlock, setSelectedHourBlock] = useState<{ block: string; volume: number; responseTime: string } | null>(null);
  const tokenData = useMemo(() => [{
    name: "Período",
    prompt: Number(aiMetrics?.promptTokensToday) || 0,
    completion: Number(aiMetrics?.completionTokensToday) || 0,
  }], [aiMetrics]);

  // Model distribution data
  const aiModelDistribution = useMemo(() => {
    if (!aiStatus || !aiStatus.model) {
      return [{ name: "Nenhum ativo", value: 100, color: "#94a3b8" }];
    }
    const rawProvider = String(aiStatus.provider || 'openai').toLowerCase();
    const isGemini = rawProvider === 'gemini' || rawProvider === 'google';
    const isClaude = rawProvider === 'claude' || rawProvider === 'anthropic';

    const providerLabel = isGemini ? "Google" : isClaude ? "Anthropic" : "OpenAI";
    const name = `${aiStatus.model} (${providerLabel})`;
    const color = isGemini ? "#38bdf8" : isClaude ? "#f97316" : "#10b981";

    return [{ name, value: 100, color }];
  }, [aiStatus]);

  const activeModelName = useMemo(() => {
    if (!aiStatus || !aiStatus.model) return "Nenhum ativo";
    return aiStatus.model;
  }, [aiStatus]);

  const tokensPeriodFormatted = useMemo(() => {
    if (aiMetrics?.tokensToday === undefined || aiMetrics?.tokensToday === null) return "—";
    const tokens = Number(aiMetrics.tokensToday);
    return tokens > 1000 ? `${(tokens / 1000).toFixed(1)}K` : String(tokens);
  }, [aiMetrics]);

  const participationLabel = safeAnalyticsViewModel.kpis[2]?.value ?? '—';

  const totalConversationsCount = viewModel.commercialMetrics?.conversationsCount || 0;
  const hotAndClosedCount = (viewModel.commercialMetrics?.hotLeadsCount || 0) + (viewModel.commercialMetrics?.closedLeadsCount || 0);
  const conversionRateDisplay = totalConversationsCount > 0 && hotAndClosedCount > 0
    ? `${Math.min(100, Math.round((hotAndClosedCount / totalConversationsCount) * 100))}%`
    : totalConversationsCount > 0 && (viewModel.commercialMetrics?.contactsCount || 0) > 0
    ? `${Math.min(100, Math.round(((viewModel.commercialMetrics?.contactsCount || 0) / totalConversationsCount) * 100))}%`
    : "—";

  const closingLeads = useMemo(() => {
    return (viewModel.conversations || [])
      .filter((c) => c.funnel_stage === "closed" || c.funnel_stage === "negotiation" || c.funnel_stage === "hot" || (c.tags || []).some(t => t.toLowerCase().includes("venda") || t.toLowerCase().includes("fechado") || t.toLowerCase().includes("negoc")))
      .sort((a, b) => (a.funnel_stage === "closed" ? -1 : 1))
      .slice(0, 10);
  }, [viewModel.conversations]);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar & Tabs */}
      <div className="flex flex-col gap-4 border-b border-border/30 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as any)} className="w-full xl:w-auto">
          <TabsList className="flex w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card/70 p-1 scrollbar-none xl:w-auto">
            {viewModel.tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Date Filter selector (Compact SaaS toolbar) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Core Periods */}
          <div className="flex items-center gap-0.5 rounded-xl border border-border bg-card/60 p-1">
            {[
              { id: "today", label: "Hoje" },
              { id: "7days", label: "7D" },
              { id: "30days", label: "30D" },
              { id: "all", label: "Geral" },
            ].map((range) => (
              <button
                key={range.id}
                type="button"
                onClick={() => onDateRangeChange(range.id as any)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  dateRange === range.id
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {range.label}
              </button>
            ))}

            {/* Extended Periods Selector */}
            <select
              aria-label="Mais períodos de análise"
              value={["yesterday", "15days", "90days", "week", "month", "year"].includes(dateRange) ? dateRange : "more"}
              onChange={(e) => {
                if (e.target.value !== "more") {
                  onDateRangeChange(e.target.value as any);
                }
              }}
              className={`h-6 rounded-lg border-none bg-transparent px-2 text-xs font-medium transition-colors outline-none cursor-pointer ${
                ["yesterday", "15days", "90days", "week", "month", "year"].includes(dateRange)
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <option value="more" disabled className="bg-popover text-foreground">Outros...</option>
              <option value="yesterday" className="bg-popover text-foreground">Ontem</option>
              <option value="15days" className="bg-popover text-foreground">15D</option>
              <option value="90days" className="bg-popover text-foreground">90D</option>
              <option value="week" className="bg-popover text-foreground">Semana</option>
              <option value="month" className="bg-popover text-foreground">Mês</option>
              <option value="year" className="bg-popover text-foreground">Ano</option>
            </select>
          </div>

          {/* Personalizado (hora/datas + janela horária) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onDateRangeChange((dateRange === "custom" ? "today" : "custom") as any)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                dateRange === "custom" || dateRange === "hour"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card/80"
              }`}
            >
              <CalendarBlank className="h-3.5 w-3.5" weight={dateRange === "custom" ? "fill" : "regular"} />
              Personalizado
            </button>

            {dateRange === "custom" && (
              <div className="flex items-center gap-1 rounded-xl border border-border bg-card/60 p-1 shadow-sm">
                <input 
                  aria-label="Data inicial" 
                  type="date" 
                  value={customStart} 
                  onChange={(event) => onCustomStartChange(event.target.value)} 
                  className="h-7 w-28 rounded-lg border-none bg-transparent px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted/50 focus:bg-muted" 
                />
                <span className="text-xs font-medium text-muted-foreground/70 px-1">até</span>
                <input 
                  aria-label="Data final" 
                  type="date" 
                  value={customEnd} 
                  onChange={(event) => onCustomEndChange(event.target.value)} 
                  className="h-7 w-28 rounded-lg border-none bg-transparent px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted/50 focus:bg-muted" 
                />
              </div>
            )}

            {/* Janela de horário */}
            {(dateRange === "custom" || timeStart || timeEnd) && (
              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card/60 p-1 shadow-sm text-xs text-muted-foreground">
                <div className="flex items-center justify-center pl-2 pr-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/70" weight="duotone" />
                </div>
                <input 
                  aria-label="Hora inicial" 
                  type="time" 
                  value={timeStart} 
                  onChange={(event) => onTimeStartChange(event.target.value)} 
                  className="h-7 w-20 rounded-lg border-none bg-transparent px-2 outline-none text-center transition-colors hover:bg-muted/50 focus:bg-muted" 
                />
                <span className="font-medium text-muted-foreground/70">até</span>
                <input 
                  aria-label="Hora final" 
                  type="time" 
                  value={timeEnd} 
                  onChange={(event) => onTimeEndChange(event.target.value)} 
                  className="h-7 w-20 rounded-lg border-none bg-transparent px-2 outline-none text-center transition-colors hover:bg-muted/50 focus:bg-muted" 
                />
              </div>
            )}
          </div>

          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${healthClass(hasMappedRows)}`}>
            <ShieldCheck className="h-4 w-4" weight="duotone" />
            Operação: {healthTone(hasMappedRows)}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HUB 1: HUB ZAI & PERFORMANCE COMERCIAL                                   */}
      {/* Unifica Hub ZAI + Performance IA + Comercial em 1 único centro executivo */}
      {/* ========================================================================= */}
      {(activeTab === "overview" || activeTab === "ai" || activeTab === "commercial" || activeTab === "operations" || activeTab === "schedule") && (
        <div className="space-y-3.5 animate-in fade-in-0 duration-300">
          {/* Top Executive KPI Row (6 Cards - Compact Single Screen Fit) */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            <Card
              className="glass-card metric-card rounded-xl border-border/70 hover:border-primary/50 transition-all duration-200 cursor-pointer hover-lift select-none"
              onClick={() => navigate('/inbox')}
            >
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fila de Atendimento</p>
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-black">{safeAnalyticsViewModel.kpis[1]?.value || "0"}</h3>
                <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 truncate">
                  Leads no Inbox
                </span>
              </CardContent>
            </Card>

            <Card
              className="glass-card metric-card rounded-xl border-border/70 hover:border-primary/50 transition-all duration-200 cursor-pointer hover-lift select-none"
              onClick={() => navigate('/contacts')}
            >
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conversas no Período</p>
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-black">{safeAnalyticsViewModel.kpis[3]?.value || "0"}</h3>
                <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 truncate">
                  No período selecionado
                </span>
              </CardContent>
            </Card>

            <Card
              className="glass-card metric-card rounded-xl border-border/70 hover:border-emerald-500/50 transition-all duration-200 cursor-pointer hover-lift select-none"
              onClick={() => navigate('/inbox')}
            >
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxa de Conversão</p>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-black text-emerald-400">
                  {conversionRateDisplay}
                </h3>
                <span className="text-[10px] text-emerald-400 font-semibold truncate block">
                  Qualificação comercial
                </span>
              </CardContent>
            </Card>

            <Card
              className="glass-card metric-card rounded-xl border-border/70 hover:border-amber-500/50 transition-all duration-200 cursor-pointer hover-lift select-none"
              onClick={() => navigate('/inbox')}
            >
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Leads em Decisão</p>
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-black text-amber-400">
                  {hotAndClosedCount}
                </h3>
                <span className="text-[10px] text-muted-foreground truncate block">
                  Negociação & Fechamento
                </span>
              </CardContent>
            </Card>

            <Card
              className="glass-card metric-card rounded-xl border-border/70 hover:border-emerald-500/50 transition-all duration-200 cursor-pointer hover-lift select-none"
              onClick={() => navigate('/ai')}
            >
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Automação IA</p>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-black">{safeAnalyticsViewModel.kpis[2]?.value || "—"}</h3>
                <span className="text-[10px] text-success font-semibold flex items-center gap-0.5 truncate">
                  Participação nas mensagens
                </span>
              </CardContent>
            </Card>

            <Card
              className="glass-card metric-card rounded-xl border-border/70 hover:border-primary/50 transition-all duration-200 cursor-pointer hover-lift select-none"
              onClick={() => navigate('/settings?tab=diagnostics')}
            >
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Infra & WebSocket</p>
                  <Badge variant="secondary" className={`rounded-full border px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider ${toneClasses(viewModel.overviewCards?.[1]?.tone ?? "offline")}`}>
                    {viewModel.overviewCards?.[1]?.badgeLabel ?? "OFFLINE"}
                  </Badge>
                </div>
                <h3 className="font-display text-lg sm:text-xl font-black truncate">{viewModel.overviewCards?.[1]?.value ?? "Offline"}</h3>
                <span className="text-[10px] text-muted-foreground truncate block">
                  {viewModel.overviewCards?.[2]?.value ?? "0"} canais conectados
                </span>
              </CardContent>
            </Card>
          </div>

          {/* MAIN EXECUTIVE DASHBOARD GRID: 12 Columns, Harmonious Single-Screen Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            {/* Left Column (7 cols): Activity Flow + Volumetry + Closing Esteira */}
            <div className="lg:col-span-7 flex flex-col gap-3.5">
              {/* Row 1: Activity Flow & Volumetry Charts Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Activity Flow */}
                <Card className="glass-card rounded-2xl border-border/70 hover-lift">
                  <CardHeader className="py-2.5 px-3.5 border-b border-border/40">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-muted-foreground">
                      <Clock weight="bold" className="h-3.5 w-3.5 text-primary" /> Fluxo de Atividade Comercial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[185px] p-2.5">
                    {safeAnalyticsViewModel.chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={safeAnalyticsViewModel.chartData}>
                          <defs>
                            <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={9} axisLine={false} tickLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} axisLine={false} tickLine={false} />
                          <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ fontSize: "11px" }} />
                          <Area type="monotone" dataKey="msgs" name="Atendimentos" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMsgs)" strokeWidth={2} />
                          <Area type="monotone" dataKey="ai" name="Respostas IA" stroke="#0ea5e9" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center p-3">
                        <Clock className="h-6 w-6 text-muted-foreground/40 mb-1" weight="duotone" />
                        <p className="text-xs font-semibold text-foreground">Sem atividade no período</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Volumetry By Hour */}
                <Card className="glass-card rounded-2xl border-border/70 hover-lift">
                  <CardHeader className="py-2.5 px-3.5 border-b border-border/40 flex flex-row items-center justify-between">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-muted-foreground">
                      <ChartBar className="h-3.5 w-3.5 text-primary" /> Volumetria por Bloco de Horários
                    </CardTitle>
                    {selectedHourBlock && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary">
                        {selectedHourBlock.block}: {selectedHourBlock.volume} leads
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="h-[185px] p-2.5">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={viewModel.commercialMetrics?.hourlyData || []}
                        onClick={(data) => {
                          if (data && data.activePayload && data.activePayload[0]) {
                            setSelectedHourBlock(data.activePayload[0].payload);
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="block" stroke="hsl(var(--muted-foreground))" fontSize={9} axisLine={false} tickLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: "hsl(var(--muted)/0.25)" }} contentStyle={tooltipStyle} />
                        <Bar
                          dataKey="volume"
                          name="Contatos"
                          fill="hsl(var(--primary))"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Row 2: Esteira Comercial (Fechamentos & Negociações) */}
              <Card className="glass-card rounded-2xl border-border/70 hover-lift flex flex-col h-[205px] overflow-hidden">
                <CardHeader className="py-2.5 px-3.5 border-b border-border/50 shrink-0 flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <CheckCircle weight="bold" className="h-3.5 w-3.5 text-success" /> Esteira Comercial (Fechamentos & Negociações)
                  </CardTitle>
                  <span className="text-[10px] text-muted-foreground font-semibold">{closingLeads.length} leads qualificados</span>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-thin">
                  {closingLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <CheckCircle className="h-6 w-6 text-muted-foreground/40 mb-1" weight="duotone" />
                      <p className="text-xs text-muted-foreground">Nenhum lead em fase final de funil no período selecionado.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/20">
                      {closingLeads.map((lead) => (
                        <div key={`closing-${lead.id}`} className="px-3.5 py-2 flex items-center justify-between hover:bg-card/50 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                              {(lead.contactName || lead.phone || "L").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{lead.contactName || lead.phone}</p>
                              <p className="text-[9px] text-muted-foreground font-mono truncate">{lead.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-[8px] rounded-full px-1.5 py-0 capitalize ${lead.funnel_stage === 'closed' ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                              {lead.funnel_stage === 'closed' ? 'Fechado' : 'Negociação'}
                            </Badge>
                            <Button size="sm" variant="secondary" className="h-6 text-[9px] px-2 rounded-md" onClick={() => navigate(`/inbox?chatId=${lead.phone}`)}>
                              Abrir
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column (5 cols): Temperature Donut + Real AI Usage */}
            <div className="lg:col-span-5 flex flex-col gap-3.5">
              {/* Temperature Donut */}
              <Card className="glass-card rounded-2xl border-border/70 hover-lift h-[205px] flex flex-col">
                <CardHeader className="py-2.5 px-3.5 border-b border-border/40 shrink-0">
                  <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <ChartBar weight="bold" className="h-3.5 w-3.5 text-primary" /> Temperatura da Base de Leads
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center relative p-2">
                  <div className="h-[120px] w-full relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={safeAnalyticsViewModel.tempDistribution} innerRadius={40} outerRadius={54} paddingAngle={4} dataKey="value">
                          {safeAnalyticsViewModel.tempDistribution.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-bold font-display">
                        {(() => {
                          const sumDist = (safeAnalyticsViewModel.tempDistribution[0]?.value || 0) +
                            (safeAnalyticsViewModel.tempDistribution[1]?.value || 0) +
                            (safeAnalyticsViewModel.tempDistribution[2]?.value || 0);
                          if (sumDist > 0) return String(sumDist);
                          return safeAnalyticsViewModel.totalLeadsLabel && safeAnalyticsViewModel.totalLeadsLabel !== "0"
                            ? safeAnalyticsViewModel.totalLeadsLabel
                            : "0";
                        })()}
                      </span>
                      <span className="text-[8px] text-muted-foreground uppercase font-bold">Leads Ativos</span>
                    </div>
                  </div>
                  <div className="flex justify-center gap-3 text-xs mt-1 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444]" />
                      <span className="text-muted-foreground text-[10px]">Quente ({safeAnalyticsViewModel.tempDistribution[0]?.value || 0})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]" />
                      <span className="text-muted-foreground text-[10px]">Morno ({safeAnalyticsViewModel.tempDistribution[1]?.value || 0})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#0ea5e9]" />
                      <span className="text-muted-foreground text-[10px]">Frio ({safeAnalyticsViewModel.tempDistribution[2]?.value || 0})</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Real AI Usage */}
              <Card className="glass-card rounded-2xl border-border/70 hover-lift h-[185px] flex flex-col justify-between">
                <CardHeader className="py-2.5 px-3.5 border-b border-border/40 shrink-0 flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-muted-foreground">
                    <Brain weight="bold" className="h-3.5 w-3.5 text-primary" /> Uso Real da IA
                  </CardTitle>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                    {activeModelName}
                  </Badge>
                </CardHeader>
                <CardContent className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[9px] font-bold uppercase text-muted-foreground">Tokens Hoje</p>
                      <p className="text-lg font-display font-bold text-foreground">{tokensPeriodFormatted}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase text-muted-foreground">Memória Operacional</p>
                      <p className="text-sm font-bold text-foreground">{viewModel.rawMetrics?.aiMemories ?? 0} fatos gravados</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-1">
                      <span>Automação IA</span>
                      <span className="text-foreground">{participationLabel}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-success rounded-full transition-all" style={{ width: `${participationLabel}` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground truncate">Expediente comercial integrado</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate("/ai?tab=flows")}
                      className="h-6 text-[10px] px-2 text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-md"
                    >
                      <Clock className="h-3 w-3" />
                      Horários
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HUB 2: MAPA & INTELIGÊNCIA DE CONVERSAS                                  */}
      {/* Unifica o Mapa Interativo + Análise Geográfica de Conversas em 1 Hub     */}
      {/* ========================================================================= */}
      {(activeTab === "map" || activeTab === "conversations") && (
        <div className="space-y-3.5 animate-in fade-in-0 duration-300">
          {/* Top Geo Summary Row (4 Cards - Compact Single Screen) */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 sm:grid-cols-4">
            <Card className="glass-card metric-card rounded-xl border-border/70 hover-lift">
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Mapeado</p>
                <h3 className="font-display text-xl sm:text-2xl font-black text-foreground">{viewModel.map.summaryCards[0]?.value ?? "0"}</h3>
                <span className="text-[10px] text-primary font-semibold">Leads identificados por DDD</span>
              </CardContent>
            </Card>

            <Card className="glass-card metric-card rounded-xl border-border/70 hover-lift">
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estados Ativos</p>
                <h3 className="font-display text-xl sm:text-2xl font-black text-emerald-400">{viewModel.map.summaryCards[1]?.value ?? "0"}</h3>
                <span className="text-[10px] text-emerald-400/80 font-semibold">Estados com interações</span>
              </CardContent>
            </Card>

            <Card className="glass-card metric-card rounded-xl border-border/70 hover-lift">
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">DDDs Identificados</p>
                <h3 className="font-display text-xl sm:text-2xl font-black text-blue-400">{viewModel.map.summaryCards[2]?.value ?? "0"}</h3>
                <span className="text-[10px] text-muted-foreground">Códigos de área ativos</span>
              </CardContent>
            </Card>

            <Card className="glass-card metric-card rounded-xl border-border/70 hover-lift">
              <CardContent className="space-y-0.5 p-2.5 sm:p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Região Principal</p>
                <h3 className="font-display text-base sm:text-lg font-black text-primary truncate mt-0.5">{viewModel.map.topRegionLabel || "—"}</h3>
                <span className="text-[10px] text-muted-foreground">Maior concentração de leads</span>
              </CardContent>
            </Card>
          </div>

          {/* Main Interactive Map & Lateral Intelligence Panel (Single Screen Height) */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.7fr)_390px] h-[calc(100vh-235px)] min-h-[460px] max-h-[580px]">
            {/* Map Column */}
            <Card className="glass-card overflow-hidden rounded-2xl border-border/70 bg-card/85 flex flex-col h-full">
              <CardHeader className="flex flex-col gap-2 border-b border-border/70 md:flex-row md:items-center md:justify-between py-2.5 px-3.5 shrink-0">
                <div>
                  <CardTitle className="font-display flex items-center gap-1.5 text-base font-bold">
                    <MapPin className="h-4 w-4 text-primary" weight="duotone" />
                    {viewModel.map.title}
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground">{viewModel.map.description}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" className="rounded-lg h-7 text-xs px-2.5" onClick={handleResetFilters}>
                    <ArrowClockwise className="h-3 w-3" />
                    Resetar Filtros
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg h-7 text-xs px-2.5" onClick={handleCenterBrazil}>
                    <MapPin className="h-3 w-3" />
                    Centralizar Brasil
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg h-7 text-xs px-2.5" onClick={onExportMap}>
                    <Export className="h-3 w-3" />
                    CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative min-h-0">
                {hasMappedRows ? (
                  <div className="h-full w-full relative">
                    <LeafletMapContainer center={mapCenter} zoom={mapZoom} minZoom={3} className="h-full w-full bg-background" worldCopyJump>
                      <LeafletTileLayer
                        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                        className="google-map-tiles"
                      />
                      <ChangeView center={mapCenter} zoom={mapZoom} />

                      {viewModel.map.points.map((point) => (
                        <LeafletCircle
                          key={`heat-${point.id}`}
                          center={[point.lat, point.lng]}
                          radius={Math.max(45000, Math.min(point.count * 7000, 180000))}
                          pathOptions={{
                            color: "#06b6d4",
                            fillColor: "#00ff88",
                            fillOpacity: 0.28,
                            weight: 2,
                            dashArray: "4 6",
                          }}
                        />
                      ))}

                      {filteredLeadPins.map((pin) => {
                        const isSelected = selectedLead?.id === pin.id || (selectedLead?.phone && selectedLead.phone === pin.phone);
                        return (
                          <LeafletMarker
                            key={pin.id}
                            position={[pin.lat, pin.lng]}
                            icon={leadMarkerIcon(pin.funnelStage, isSelected)}
                            zIndexOffset={isSelected ? 1000 : 0}
                            eventHandlers={{
                              click: () => {
                                handleLeadSelect(pin);
                              },
                            }}
                          >
                            <Popup>
                              <div className="space-y-1 p-1 text-xs">
                                <p className="font-bold">{pin.name}</p>
                                <p className="text-[10px] text-muted-foreground">{pin.phone}</p>
                                <p className="text-[10px] truncate max-w-[150px]">{pin.address}</p>
                                <span className="inline-block mt-1 text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                                  {pin.funnelStage}
                                </span>
                              </div>
                            </Popup>
                          </LeafletMarker>
                        );
                      })}
                    </LeafletMapContainer>

                    {/* Interactive Lead Detail Drawer (Overlay inside the map container) */}
                    {selectedLead && (
                      <div className="absolute bottom-3 left-3 right-3 z-[1000] rounded-2xl border border-emerald-500/40 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-300 md:left-3 md:right-auto md:w-[340px]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#00ff88]"></span>
                            <p className="font-display font-bold text-foreground text-sm">{selectedLead.name}</p>
                          </div>
                          <button onClick={() => setSelectedLead(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">{selectedLead.phone}</p>

                        <div className="mt-2.5 space-y-1.5 text-xs">
                          <div className="rounded-xl bg-background/55 border border-border/40 p-2">
                            <span className="font-bold text-muted-foreground uppercase text-[9px] block tracking-wide">Endereço:</span>
                            <span className="text-foreground mt-0.5 block">{selectedLead.address}</span>
                          </div>
                          <div className="rounded-xl bg-background/55 border border-border/40 p-2 space-y-0.5">
                            <span className="font-bold text-muted-foreground uppercase text-[9px] block tracking-wide">Origem Geográfica:</span>
                            <div className="text-foreground/90 italic flex gap-1.5 items-start">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" weight="duotone" />
                              <span className="text-[10px] leading-relaxed">
                                {selectedLead.address}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 pt-2.5 border-t border-border/20">
                          <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">
                            Funil: {selectedLead.funnelStage}
                          </span>
                          <Button
                            size="sm"
                            className="gap-1.5 rounded-xl text-xs h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={() => navigate(`/inbox?chatId=${selectedLead.phone}`)}
                          >
                            <Chat className="h-3.5 w-3.5" />
                            Ver no Inbox
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 p-6 text-center">
                    <WarningCircle className="h-8 w-8 text-muted-foreground/50" weight="duotone" />
                    <div>
                      <p className="text-base font-semibold">{viewModel.map.emptyTitle}</p>
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">{viewModel.map.emptyDescription}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sidebar Column (Leads list or geography lists) */}
            <div className="space-y-2.5 flex flex-col h-full min-h-0">
              {/* Tab Selector inside Sidebar */}
              <Card className="glass-card rounded-xl border-border/70 hover-lift p-1 shrink-0">
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-background/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setRightPanelTab("geography")}
                    className={`rounded-md py-1.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      rightPanelTab === "geography"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Geografia & Conversas ({mapRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelTab("leads")}
                    className={`rounded-md py-1.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      rightPanelTab === "leads"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    Leads na Região ({filteredRegionalLeads.length})
                  </button>
                </div>
              </Card>

              {/* Active Geo Filter Warning */}
              {selectedGeoFilter.value && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-foreground shrink-0">
                  <span className="font-medium flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-primary" weight="fill" />
                    Filtrado por: <strong className="text-primary">{selectedGeoFilter.value}</strong>
                  </span>
                  <button onClick={() => setSelectedGeoFilter({ type: null, value: null })} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Geography & Rankings Panel */}
              {rightPanelTab === "geography" && (
                <div className="space-y-2 flex-1 flex flex-col min-h-0">
                  <Card className="glass-card rounded-xl border-border/70 hover-lift p-1 shrink-0">
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-background/40 p-0.5">
                      {viewModel.map.scopes.map((scope) => (
                        <button
                          key={scope.id}
                          type="button"
                          onClick={() => onMapScopeChange(scope.id)}
                          className={`rounded-md py-1 text-xs font-medium transition-colors ${
                            activeMapScope === scope.id
                              ? "bg-card text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {scope.label}
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Card className="glass-card rounded-2xl border-border/70 hover-lift flex-1 overflow-y-auto max-h-[calc(100vh-340px)] min-h-[300px] scrollbar-thin">
                    <CardContent className="space-y-1.5 p-2.5">
                      {mapRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">Sem dados para o escopo atual.</p>
                      ) : (
                        mapRows.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => handleGeoRowClick(row)}
                            className="w-full rounded-xl border border-border/70 bg-background/20 px-3 py-2 text-left transition-colors hover:bg-card/75"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div>
                                <p className="font-bold text-foreground">{row.label}</p>
                                <p className="text-[10px] text-muted-foreground">{row.meta}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-foreground">{row.count} leads</p>
                                <p className="text-[10px] text-muted-foreground">{row.share}%</p>
                              </div>
                            </div>
                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/60">
                              <div className="h-full rounded-full bg-emerald-400 shadow-[0_0_8px_#00ff88]" style={{ width: `${Math.max(row.share, 4)}%` }} />
                            </div>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Regional Leads Panel */}
              {rightPanelTab === "leads" && (
                <Card className="glass-card rounded-2xl border-border/70 hover-lift flex-1 flex flex-col overflow-hidden max-h-[calc(100vh-340px)] min-h-[300px]">
                  <div className="p-2.5 border-b border-border/50 shrink-0">
                    <div className="relative">
                      <Input
                        value={leadSearchQuery}
                        onChange={(e) => setLeadSearchQuery(e.target.value)}
                        placeholder="Buscar leads por nome ou telefone..."
                        className="rounded-lg h-8 text-xs pl-8 pr-3 bg-background/50"
                      />
                      <MagnifyingGlass className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="p-2.5 space-y-1.5 overflow-y-auto flex-1 scrollbar-thin">
                    {filteredRegionalLeads.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-8">Nenhum lead encontrado.</p>
                    ) : (
                      filteredRegionalLeads.map((lead) => {
                        const isSelected = selectedLead?.id === lead.pinId ||
                          selectedLead?.id === `lead-pin-${lead.id}` ||
                          (selectedLead?.phone && selectedLead.phone === lead.phone);
                        return (
                          <div
                            key={`lead-row-${lead.id}`}
                            onClick={() => handleLeadSelect(lead)}
                            className={`w-full rounded-xl border p-2.5 transition-all flex items-start gap-2 cursor-pointer select-none group ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                                : "border-border/60 bg-background/20 hover:bg-card/75 hover:border-emerald-500/50"
                            }`}
                          >
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 transition-colors ${
                              isSelected ? "bg-emerald-500 text-white shadow-[0_0_8px_#10b981]" : "bg-primary/10 text-primary group-hover:bg-primary/20"
                            }`}>
                              {lead.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <h4 className={`font-bold text-xs truncate transition-colors ${isSelected ? "text-emerald-400 font-black" : "text-foreground"}`}>
                                  {lead.name}
                                </h4>
                                <div className="flex items-center gap-1">
                                  <span
                                    title="Focar e ver no mapa"
                                    className="h-5 px-1.5 rounded-md text-[9px] font-medium flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors"
                                  >
                                    <MapPin className="h-2.5 w-2.5" />
                                    Ver no Mapa
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 text-[9px] px-1.5 rounded-md text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/inbox?chatId=${lead.phone}`);
                                    }}
                                  >
                                    Inbox
                                  </Button>
                                </div>
                              </div>
                              <p className="text-[9px] text-muted-foreground font-mono">{lead.phone}</p>
                              <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-border/10">
                                <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Funil: {lead.funnelStage}
                                </span>
                                <Badge variant="outline" className={`text-[8px] rounded-full px-1.5 py-0 capitalize ${
                                  isSelected ? "border-emerald-500/50 text-emerald-400 font-semibold" : ""
                                }`}>
                                  {lead.state} • DDD {lead.ddd}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS AVANÇADO UNIFICADO TAB */}
      {(["analytics", "reports"] as const).includes(activeTab as any) && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <AnalyticsView loading={false} viewModel={safeAnalyticsViewModel} />
        </div>
      )}
    </div>
  );
}
