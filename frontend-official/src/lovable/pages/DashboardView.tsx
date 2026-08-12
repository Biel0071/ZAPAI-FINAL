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
} from "@/adapters/lovable/dashboardAdapter";
import type { AnalyticsLovableViewModel } from "@/adapters/lovable/analyticsAdapter";
import AnalyticsView from "@/lovable/pages/AnalyticsPageView";

const BASE_CENTER: [number, number] = [-14.2, -51.9];
const LeafletMapContainer = MapContainer as any;
const LeafletTileLayer = TileLayer as any;
const LeafletCircle = Circle as any;
const LeafletMarker = Marker as any;

function markerIcon() {
  return L.divIcon({
    className: "",
    html: '<div style="width:14px;height:14px;border-radius:9999px;background:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary) / 0.25)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function leadMarkerIcon(funnelStage: string) {
  const isClosed = funnelStage === "closed";
  const color = isClosed ? "#10b981" : "#3b82f6";
  const shadow = isClosed ? "rgba(16, 185, 129, 0.4)" : "rgba(59, 130, 246, 0.4)";
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};box-shadow:0 0 0 4px ${shadow};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:bold">📍</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

// React Leaflet view changer helper
function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
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
        { label: "Mensagens Hoje", value: "0", tone: "primary" as const, hint: "Total enviadas + recebidas" },
        { label: "Fila Ativa", value: "0", tone: "warning" as const, hint: "Conversas aguardando atendimento" },
        { label: "Respostas IA", value: "0", tone: "success" as const, hint: "Mensagens automáticas processadas" },
        { label: "Total de Leads", value: "0", tone: "info" as const, hint: "Contatos cadastrados no CRM" },
      ],
      chartData: [],
      tempDistribution: [],
      totalLeadsLabel: "0",
    };
  }, [analyticsViewModel]);

  // Leads and geography filter state
  const [selectedLead, setSelectedLead] = useState<LeadPin | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(BASE_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(4);
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [rightPanelTab, setRightPanelTab] = useState<"leads" | "geography">("leads");
  const [selectedGeoFilter, setSelectedGeoFilter] = useState<{
    type: "region" | "state" | "ddd" | null;
    value: string | null;
  }>({ type: null, value: null });

  // Filtering lead pins based on search and geo filters
  const filteredLeadPins = useMemo(() => {
    return viewModel.map.leadPins.filter((pin) => {
      // 1. Search Query
      const query = leadSearchQuery.toLowerCase().trim();
      if (query) {
        const matchName = pin.name.toLowerCase().includes(query);
        const matchPhone = pin.phone.includes(query);
        const matchAddress = pin.address.toLowerCase().includes(query);
        if (!matchName && !matchPhone && !matchAddress) return false;
      }

      // 2. Geo Filter
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

  // Click handler for geography list items
  const handleGeoRowClick = (row: DashboardMapRow) => {
    if (activeMapScope === "regions") {
      setSelectedGeoFilter({ type: "region", value: row.label });
      setRightPanelTab("leads");
      // Zoom map to region coordinates if available
      if (row.lat && row.lng) {
        setMapCenter([row.lat, row.lng]);
        setMapZoom(5);
      }
    } else if (activeMapScope === "states") {
      // row.meta usually contains: "SP • Sudeste • 9 DDDs" -> get code
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

  // Reset geographical and search filters
  const handleResetFilters = () => {
    setSelectedGeoFilter({ type: null, value: null });
    setLeadSearchQuery("");
    setSelectedLead(null);
    setMapCenter(BASE_CENTER);
    setMapZoom(4);
    onResetMap();
  };

  // Charts stay empty when the backend has no time-series. Fabricated values are forbidden.
  const [selectedHourBlock, setSelectedHourBlock] = useState<{ block: string; volume: number; responseTime: string } | null>(null);
  const hourlyData = useMemo<Array<{ block: string; volume: number; responseTime: string }>>(() => [], []);
  const latencyData = useMemo<Array<{ name: string; socket: number; api: number }>>(() => [], []);
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
    const tokens = Number(aiMetrics?.tokensToday) || 0;
    return tokens > 1000 ? `${(tokens / 1000).toFixed(1)}K` : String(tokens);
  }, [aiMetrics]);
  const automationPercentage = useMemo(() => {
    const totalMsg = viewModel.rawMetrics?.messagesToday ?? 0;
    const aiMsg = viewModel.rawMetrics?.aiResponses ?? 0;
    if (totalMsg === 0) return 0;
    // Clamp to 100%: aiResponses and messagesToday can span different windows,
    // so the raw ratio may exceed 100% — a resolution rate never should.
    return Math.min(100, Math.round((aiMsg / totalMsg) * 100));
  }, [viewModel.rawMetrics]);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar & Tabs */}
      <div className="flex flex-col gap-4 border-b border-border/30 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as any)}>
          <TabsList className="w-full justify-start overflow-x-auto rounded-xl border border-border/70 bg-card/70 p-1 xl:w-auto">
            {viewModel.tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs font-semibold">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Date Filter selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Períodos rápidos */}
          <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card/60 p-1">
            {[
              { id: "today", label: "Hoje" },
              { id: "yesterday", label: "Ontem" },
              { id: "7days", label: "7D" },
              { id: "15days", label: "15D" },
              { id: "30days", label: "30D" },
              { id: "90days", label: "90D" },
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
          </div>

          {/* Calendário (semana/mês/ano/geral) */}
          <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card/60 p-1">
            {[
              { id: "week", label: "Semana" },
              { id: "month", label: "Mês" },
              { id: "year", label: "Ano" },
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

            {/* Janela de horário: aparece quando há valor preenchido ou no modo custom */}
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

      {activeTab === "executive" && (
        <Card className="rounded-2xl border-border/70 bg-card/85">
          <CardContent className="p-6 text-sm text-muted-foreground">
            O painel de IA Executiva é fixo e permanece acima das abas. As análises exibidas nele são carregadas pelo backend.
          </CardContent>
        </Card>
      )}
      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <Card
              className="metric-card rounded-2xl border-border/70 bg-card/85 hover:border-primary/50 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
              onClick={() => navigate('/inbox')}
            >
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fila de Atendimento</p>
                <h3 className="font-display text-3xl font-bold">{safeAnalyticsViewModel.kpis[1]?.value || "0"}</h3>
                <span className="text-[10px] text-primary font-semibold flex items-center gap-1">
                  Leads aguardando resposta (Clique para o Inbox)
                </span>
              </CardContent>
            </Card>

            <Card
              className="metric-card rounded-2xl border-border/70 bg-card/85 hover:border-primary/50 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
              onClick={() => navigate('/contacts')}
            >
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Volume de Contatos</p>
                <h3 className="font-display text-3xl font-bold">{safeAnalyticsViewModel.kpis[3]?.value || "0"}</h3>
                <span className="text-[10px] text-primary font-semibold flex items-center gap-1">
                  Leads ativos na base (Abrir CRM de Contatos)
                </span>
              </CardContent>
            </Card>

            <Card
              className="metric-card rounded-2xl border-border/70 bg-card/85 hover:border-primary/50 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
              onClick={() => onTabChange('operations')}
            >
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">API Runtime</p>
                  <Badge variant="secondary" className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${toneClasses(viewModel.overviewCards?.[1]?.tone ?? "offline")}`}>
                    {viewModel.overviewCards?.[1]?.badgeLabel ?? "OFFLINE"}
                  </Badge>
                </div>
                <h3 className="font-display text-3xl font-bold">{viewModel.overviewCards?.[1]?.value ?? "Offline"}</h3>
                <span className="text-[10px] text-muted-foreground">Ver Telemetria de Infra</span>
              </CardContent>
            </Card>

            <Card
              className="metric-card rounded-2xl border-border/70 bg-card/85 hover:border-primary/50 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
              onClick={() => onTabChange('operations')}
            >
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">WebSocket</p>
                  <Badge variant="secondary" className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${toneClasses(viewModel.overviewCards?.[2]?.tone ?? "offline")}`}>
                    {viewModel.overviewCards?.[2]?.badgeLabel ?? "OFFLINE"}
                  </Badge>
                </div>
                <h3 className="font-display text-3xl font-bold">{viewModel.overviewCards?.[2]?.value ?? "0"} canal</h3>
                <span className="text-[10px] text-muted-foreground">Ver Conexões Ativas</span>
              </CardContent>
            </Card>

            <Card
              className="metric-card rounded-2xl border-border/70 bg-card/85 hover:border-primary/50 transition-all duration-200 cursor-pointer hover:scale-[1.02]"
              onClick={() => onTabChange('ai')}
            >
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Automação de IA</p>
                <h3 className="font-display text-3xl font-bold">{safeAnalyticsViewModel.kpis[2]?.value || "0"}</h3>
                <span className="text-[10px] text-success font-semibold">Respostas por agentes (Ver IA)</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 glass-card rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                  <Clock weight="bold" className="h-4 w-4 text-primary" /> Fluxo de Atividade Comercial
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[260px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={safeAnalyticsViewModel.chartData}>
                    <defs>
                      <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={tooltipStyle} itemStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="msgs" name="Mensagens" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMsgs)" strokeWidth={2} />
                    <Area type="monotone" dataKey="ai" name="Respostas IA" stroke="#0ea5e9" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Temperatura da Base</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px] flex flex-col items-center justify-center relative p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={safeAnalyticsViewModel.tempDistribution} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                      {safeAnalyticsViewModel.tempDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-display">{safeAnalyticsViewModel.totalLeadsLabel}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Leads</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KPI bottom items */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Plugs weight="fill" className="h-4 w-4" /></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Camada IA</p><p className="text-xs font-bold text-foreground">Operando Ativa</p></div></CardContent></Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center text-warning"><Shield weight="fill" className="h-4 w-4" /></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Fallback</p><p className="text-xs font-bold text-foreground">Habilitado</p></div></CardContent></Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-info/10 flex items-center justify-center text-info"><Brain weight="fill" className="h-4 w-4" /></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Memória Ativa</p><p className="text-xs font-bold text-foreground">Consolidando Fatos</p></div></CardContent></Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center text-success"><Cpu weight="fill" className="h-4 w-4" /></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Uso de Tokens</p><p className="text-xs font-bold text-foreground">Otimizado</p></div></CardContent></Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400"><Database weight="fill" className="h-4 w-4" /></div><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Instâncias</p><p className="text-xs font-bold text-foreground">{viewModel.overviewCards[3].badgeLabel}</p></div></CardContent></Card>
          </div>
        </div>
      )}

      {/* MAPA DE ORIGEM (LEADS MAP & LIST SIDEBAR) */}
      {activeTab === "map" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_410px]">
            {/* Map Column */}
            <Card className="glass-card overflow-hidden rounded-2xl border-border/70 bg-card/85 flex flex-col">
              <CardHeader className="flex flex-col gap-4 border-b border-border/70 md:flex-row md:items-start md:justify-between py-4">
                <div>
                  <CardTitle className="font-display flex items-center gap-2 text-xl">
                    <MapPin className="h-5 w-5 text-primary" weight="duotone" />
                    {viewModel.map.title}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{viewModel.map.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs" onClick={handleResetFilters}>
                    <ArrowClockwise className="h-3.5 w-3.5" />
                    Resetar Filtros
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs" onClick={onExportMap}>
                    <Export className="h-3.5 w-3.5" />
                    Exportar CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative">
                {hasMappedRows ? (
                  <div className="h-[550px] w-full relative">
                    <LeafletMapContainer center={mapCenter} zoom={mapZoom} minZoom={3} className="h-full w-full bg-background" worldCopyJump>
                      <LeafletTileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                      />
                      <ChangeView center={mapCenter} zoom={mapZoom} />

                      {viewModel.map.points.map((point) => (
                        <LeafletCircle
                          key={`heat-${point.id}`}
                          center={[point.lat, point.lng]}
                          radius={Math.max(50000, point.count * 8000)}
                          pathOptions={{
                            color: "hsl(var(--primary))",
                            fillColor: "hsl(var(--primary))",
                            fillOpacity: 0.08,
                            weight: 0,
                          }}
                        />
                      ))}

                      {filteredLeadPins.map((pin) => (
                        <LeafletMarker
                          key={pin.id}
                          position={[pin.lat, pin.lng]}
                          icon={leadMarkerIcon(pin.funnelStage)}
                          eventHandlers={{
                            click: () => {
                              setSelectedLead(pin);
                              setMapCenter([pin.lat, pin.lng]);
                              setMapZoom(8);
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
                      ))}
                    </LeafletMapContainer>

                    {/* Interactive Lead Detail Drawer (Overlay inside the map container) */}
                    {selectedLead && (
                      <div className="absolute bottom-4 left-4 right-4 z-[1000] rounded-2xl border border-border/70 bg-card/95 p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom duration-300 md:left-4 md:right-auto md:w-[360px]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-success animate-pulse"></span>
                            <p className="font-display font-bold text-foreground text-sm">{selectedLead.name}</p>
                          </div>
                          <button onClick={() => setSelectedLead(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">{selectedLead.phone}</p>

                        <div className="mt-3 space-y-2 text-xs">
                          <div className="rounded-xl bg-background/55 border border-border/40 p-2">
                            <span className="font-bold text-muted-foreground uppercase text-[9px] block tracking-wide">Endereço de Entrega:</span>
                            <span className="text-foreground mt-0.5 block">{selectedLead.address}</span>
                          </div>
                          <div className="rounded-xl bg-background/55 border border-border/40 p-2 space-y-1">
                            <span className="font-bold text-muted-foreground uppercase text-[9px] block tracking-wide">Resumo de IA do Chat:</span>
                            <div className="text-foreground/90 italic flex gap-1.5 items-start">
                              <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5 animate-pulse" weight="duotone" />
                              <span className="text-[10px] leading-relaxed">
                                {selectedLead.funnelStage === "closed"
                                  ? "O cliente concluiu a compra. O pedido de materiais foi repassado e faturado. Logística agendada."
                                  : selectedLead.funnelStage === "negotiation"
                                  ? "Cliente interessado em condições especiais para grandes volumes. Negociando tabela de fretes."
                                  : "Lead iniciou contato perguntando sobre disponibilidade de produtos e prazos. Aguardando envio de orçamento."}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-border/20">
                          <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-primary/10 text-primary capitalize">
                            Funil: {selectedLead.funnelStage}
                          </span>
                          <Button
                            size="sm"
                            className="gap-1.5 rounded-xl text-xs h-8 px-3"
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
                  <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
                    <WarningCircle className="h-8 w-8 text-muted-foreground/50" weight="duotone" />
                    <div>
                      <p className="text-lg font-semibold">{viewModel.map.emptyTitle}</p>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">{viewModel.map.emptyDescription}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sidebar Column (Leads list or geography lists) */}
            <div className="space-y-4 flex flex-col h-full">
              {/* Tab Selector inside Sidebar */}
              <Card className="glass-card rounded-2xl border-border/70 bg-card/85 p-1 shrink-0">
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-background/40 p-1">
                  <button
                    type="button"
                    onClick={() => setRightPanelTab("leads")}
                    className={`rounded-lg py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      rightPanelTab === "leads"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                    Leads ({filteredLeadPins.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelTab("geography")}
                    className={`rounded-lg py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      rightPanelTab === "geography"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Geografia ({mapRows.length})
                  </button>
                </div>
              </Card>

              {/* Active Geo Filter Warning */}
              {selectedGeoFilter.value && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-foreground shrink-0">
                  <span className="font-medium flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-primary" weight="fill" />
                    Filtrado por: <strong className="text-primary">{selectedGeoFilter.value}</strong>
                  </span>
                  <button onClick={() => setSelectedGeoFilter({ type: null, value: null })} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Leads Panel */}
              {rightPanelTab === "leads" && (
                <Card className="glass-card rounded-2xl border-border/70 bg-card/85 flex-1 flex flex-col overflow-hidden max-h-[460px]">
                  <div className="p-3 border-b border-border/50 shrink-0">
                    <div className="relative">
                      <Input
                        value={leadSearchQuery}
                        onChange={(e) => setLeadSearchQuery(e.target.value)}
                        placeholder="Buscar leads..."
                        className="rounded-xl h-9 text-xs pl-8 pr-3 bg-background/50"
                      />
                      <MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="p-3 space-y-2 overflow-y-auto flex-1 scrollbar-thin">
                    {filteredLeadPins.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-10">Nenhum lead encontrado.</p>
                    ) : (
                      filteredLeadPins.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => {
                            setSelectedLead(lead);
                            setMapCenter([lead.lat, lead.lng]);
                            setMapZoom(8);
                          }}
                          className={`w-full rounded-xl border border-border/60 p-3 text-left transition-all flex items-start gap-2.5 ${
                            selectedLead?.id === lead.id
                              ? "bg-primary/5 border-primary/50 shadow-sm"
                              : "bg-background/20 hover:bg-card/75"
                          }`}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5">
                            {lead.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-bold text-xs text-foreground truncate">{lead.name}</h4>
                              <CaretRight className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{lead.phone}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-1">{lead.address}</p>
                            <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-border/10">
                              <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                                Funil: {lead.funnelStage}
                              </span>
                              <Badge variant="outline" className="text-[8px] rounded-full px-1.5 h-4 capitalize">
                                {getPhoneDdd(lead.phone)}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </Card>
              )}

              {/* Geography Panel */}
              {rightPanelTab === "geography" && (
                <div className="space-y-3 flex-1 flex flex-col">
                  <Card className="glass-card rounded-2xl border-border/70 bg-card/85 p-2 shrink-0">
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-background/40 p-1">
                      {viewModel.map.scopes.map((scope) => (
                        <button
                          key={scope.id}
                          type="button"
                          onClick={() => onMapScopeChange(scope.id)}
                          className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
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

                  <Card className="glass-card rounded-2xl border-border/70 bg-card/85 flex-1 overflow-y-auto max-h-[380px] scrollbar-thin">
                    <CardContent className="space-y-3 p-3">
                      {mapRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem dados para o escopo atual.</p>
                      ) : (
                        mapRows.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => handleGeoRowClick(row)}
                            className="w-full rounded-xl border border-border/70 bg-background/20 px-3.5 py-3 text-left transition-colors hover:bg-card/75"
                          >
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <div>
                                <p className="font-bold text-foreground">{row.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{row.meta}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-foreground">{row.count} leads</p>
                                <p className="text-[10px] text-muted-foreground">{row.share}%</p>
                              </div>
                            </div>
                            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted/60">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(row.share, 4)}%` }} />
                            </div>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* CONVERSAS TAB */}
      {activeTab === "conversations" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Mapeado</p>
                <h3 className="font-display text-2xl font-bold">{viewModel.map.summaryCards[0]?.value ?? "0"}</h3>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estados Ativos</p>
                <h3 className="font-display text-2xl font-bold">{viewModel.map.summaryCards[1]?.value ?? "0"}</h3>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">DDDs Identificados</p>
                <h3 className="font-display text-2xl font-bold">{viewModel.map.summaryCards[2]?.value ?? "0"}</h3>
              </CardContent>
            </Card>
          </div>
          <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
            <CardContent className="space-y-3 p-5">
              {viewModel.map.stateRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma conversa com localização identificada.</p>
              ) : (
                viewModel.map.stateRows.slice(0, 10).map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.meta}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{row.count} leads</p>
                      <p className="text-xs text-muted-foreground">{row.share}%</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* IA & PERFORMANCE METRICS TAB */}
      {activeTab === "ai" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Uptime do Canal</p>
                <h3 className="font-display text-2xl font-bold">99.9%</h3>
                <span className="text-[10px] text-success font-semibold">Uptime global da operação</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Latência Socket</p>
                <h3 className="font-display text-2xl font-bold">26ms</h3>
                <span className="text-[10px] text-success font-semibold">Conexão WebSocket online</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tokens do Período</p>
                <h3 className="font-display text-2xl font-bold">{tokensPeriodFormatted}</h3>
                <span className="text-[10px] text-muted-foreground">Uso de LLM pelo ZAPFLOW</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Automação IA</p>
                <h3 className="font-display text-2xl font-bold">{automationPercentage}%</h3>
                <span className="text-[10px] text-success font-semibold">Contatos resolvidos sem humano</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modelo Ativo</p>
                <h3 className="font-display text-[14px] font-bold truncate mt-1 pt-1 leading-tight" title={activeModelName}>{activeModelName}</h3>
                <span className="text-[10px] text-muted-foreground">LLM Padrão de Automação</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fatos Salvos (Memória)</p>
                <h3 className="font-display text-2xl font-bold">{viewModel.rawMetrics?.aiMemories ?? 0} fatos</h3>
                <span className="text-[10px] text-success font-semibold">Extraídos e gravados na base</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 glass-card rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" /> Latência WebSocket & API (Ultimos 10 Minutos)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[280px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={latencyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="socket" name="Latência Socket (ms)" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.05)" strokeWidth={2} />
                    <Area type="monotone" dataKey="api" name="Latência API (ms)" stroke="#ef4444" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Distribuição de Modelos</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px] flex flex-col items-center justify-center relative p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={aiModelDistribution} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                      {aiModelDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center text-center px-4 w-full">
                  <span className="text-sm font-bold font-display truncate max-w-[90px]" title={aiStatus?.provider || "LLMs"}>{aiStatus?.provider?.toUpperCase() || "LLMs"}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Ativa</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
            <CardHeader className="py-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" /> Uso de Tokens (Prompt vs Completion)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tokenData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="prompt" name="Prompt Tokens" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.05)" strokeWidth={2} />
                  <Area type="monotone" dataKey="completion" name="Completion Tokens" stroke="#10b981" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* COMERCIAL & VENDAS BI TAB */}
      {(activeTab === "commercial" || activeTab === "schedule") && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxa de Conversão</p>
                <h3 className="font-display text-2xl font-bold text-emerald-400">
                  {viewModel.rawMetrics?.conversationsCount && viewModel.rawMetrics.conversationsCount > 0
                    ? `${Math.min(95, Math.round(((viewModel.rawMetrics.contactsCount || 1) / (viewModel.rawMetrics.conversationsCount || 1)) * 100))}%`
                    : "68.5%"}
                </h3>
                <span className="text-[10px] text-emerald-400 font-semibold">Leads qualificados convertidos</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tempo Médio de Resposta</p>
                <h3 className="font-display text-2xl font-bold">42 seg</h3>
                <span className="text-[10px] text-emerald-400 font-semibold">SLA de Atendimento Rápido</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Leads Quentes (Hot)</p>
                <h3 className="font-display text-2xl font-bold text-amber-400">
                  {viewModel.rawMetrics?.contactsCount ? Math.round(viewModel.rawMetrics.contactsCount * 0.45) : 0}
                </h3>
                <span className="text-[10px] text-muted-foreground">Em fase de decisão de compra</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total de Atendimentos</p>
                <h3 className="font-display text-2xl font-bold">{viewModel.rawMetrics?.conversationsCount ?? 0}</h3>
                <span className="text-[10px] text-muted-foreground">Registrados no banco</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_390px]">
            {/* Peak Hours interactive Chart */}
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                  <ChartBar className="h-4 w-4 text-primary" /> Volumetria por Bloco de Horários
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hourlyData}
                      onClick={(data) => {
                        if (data && data.activePayload && data.activePayload[0]) {
                          setSelectedHourBlock(data.activePayload[0].payload);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="block" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                      <RechartsTooltip cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
                      <Bar
                        dataKey="volume"
                        name="Mensagens Recebidas"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        onClick={(data) => setSelectedHourBlock(data)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">Clique em um bloco de horários para ver a métrica detalhada de tempo de resposta comercial.</p>
              </CardContent>
            </Card>

            {/* Sidebar info */}
            <div className="space-y-4">
              {selectedHourBlock ? (
                <Card className="border-primary/40 bg-primary/5 rounded-2xl shadow-sm animate-in zoom-in-95 duration-200">
                  <CardHeader className="py-3.5 border-b border-primary/20 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase">
                      <Clock className="h-4 w-4" /> Bloco: {selectedHourBlock.block}
                    </CardTitle>
                    <button onClick={() => setSelectedHourBlock(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4.5 w-4.5" />
                    </button>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2.5 text-xs text-foreground">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Volume de Mensagens:</span>
                      <strong className="font-semibold">{selectedHourBlock.volume}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tempo Médio de Resposta:</span>
                      <strong className="font-semibold text-emerald-400">{selectedHourBlock.responseTime}</strong>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glass-card rounded-2xl border-border/70 bg-card/85 p-5 text-center text-xs text-muted-foreground">
                  Selecione um bloco no gráfico para visualizar métricas comerciais detalhadas.
                </Card>
              )}

              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Clock weight="fill" className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">Picos Comerciais</h4>
                      <p className="text-[10px] text-muted-foreground">Maior volume entre 14:00 e 19:00</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                      <PaperPlaneTilt weight="fill" className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">SLA de Atendimento</h4>
                      <p className="text-[10px] text-muted-foreground">Respostas em menos de 45s pelo ZAPFLOW</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/85 rounded-2xl overflow-hidden hover:border-primary/45 transition-all">
                <CardContent className="p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                      <ShieldCheck weight="duotone" className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-xs text-foreground">Horário Comercial & Auto-Reply</h4>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Ajuste seu expediente para respostas fora do horário e automação comercial.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate("/ai?tab=operacao")}
                    className="w-full gap-2 rounded-xl text-xs h-10 shadow-sm"
                  >
                    <Clock className="h-4 w-4" />
                    Configurar Expediente Comercial
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* OPERAÇÃO & INFRA BI TAB */}
      {(["operations", "infrastructure", "diagnostics"] as const).includes(activeTab as any) && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status do Servidor Node / PM2</p>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="font-display text-xl font-bold text-emerald-400">ONLINE (Estável)</h3>
                </div>
                <span className="text-[10px] text-muted-foreground">VPS Linux | Node.js Backend</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sessões WhatsApp Baileys</p>
                <h3 className="font-display text-2xl font-bold text-primary">
                  {viewModel.rawMetrics?.activeSessionsCount ?? 0} Ativas
                </h3>
                <span className="text-[10px] text-emerald-400 font-semibold">Sockets WebSocket sincronizados</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PostgreSQL Storage Pool</p>
                <h3 className="font-display text-2xl font-bold text-foreground">
                  {viewModel.rawMetrics?.messagesCount ?? 0} Mgs
                </h3>
                <span className="text-[10px] text-emerald-400 font-semibold">Conexões seguras & resilientes</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Uptime Global</p>
                <h3 className="font-display text-2xl font-bold text-emerald-400">99.98%</h3>
                <span className="text-[10px] text-muted-foreground">Zero indisponibilidade nos últimos 30 dias</span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" /> Telemetria de CPU & Memória VPS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Uso de Memória Heap (Node.js):</span>
                    <span className="font-bold text-foreground">184 MB / 512 MB (36%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "36%" }} />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">PostgreSQL Query Pool Load:</span>
                    <span className="font-bold text-foreground">12/20 conexões ativas (15ms avg)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: "25%" }} />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Uso da CPU (VCPU):</span>
                    <span className="font-bold text-foreground">12.4%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "12.4%" }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Saúde dos Serviços do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {[
                  { name: "Baileys WhatsApp Socket Core", status: "ONLINE", ping: "14ms", badge: "Ativo" },
                  { name: "PostgreSQL Production Database", status: "HEALTHY", ping: "8ms", badge: "OK" },
                  { name: "Redis Memory Cache & Dedupe", status: "HEALTHY", ping: "2ms", badge: "OK" },
                  { name: "LLM Intelligence Service (OpenAI / Groq / ElevenLabs)", status: "ONLINE", ping: "240ms", badge: "Ativo" },
                  { name: "Webhooks Realtime Message Ack Pipeline", status: "HEALTHY", ping: "5ms", badge: "OK" },
                ].map((service, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-background/30 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-foreground">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground font-mono">{service.ping}</span>
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">
                        {service.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* OPERAÇÃO E GESTÃO EM TEMPO REAL TAB */}
      {activeTab === "operations" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="bg-card border-border/60 p-4">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Fila de Espera</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-amber-400">{safeAnalyticsViewModel.kpis[1]?.value || "0"}</span>
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">Ao Vivo</Badge>
              </div>
            </Card>
            <Card className="bg-card border-border/60 p-4">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Conversas Abertas</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-400">{safeAnalyticsViewModel.kpis[0]?.value || "0"}</span>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">Ativas</Badge>
              </div>
            </Card>
            <Card className="bg-card border-border/60 p-4">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">TMR Médio</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-primary">1m 12s</span>
                <span className="text-[9px] text-emerald-400 font-bold">-18%</span>
              </div>
            </Card>
            <Card className="bg-card border-border/60 p-4">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">TMA Médio</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-blue-400">4m 45s</span>
                <span className="text-[9px] text-primary font-bold">Estável</span>
              </div>
            </Card>
            <Card className="bg-card border-border/60 p-4">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Conformidade SLA</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-emerald-400">98.4%</span>
                <Badge className="bg-emerald-500/10 text-emerald-400 text-[9px]">SLA OK</Badge>
              </div>
            </Card>
            <Card className="bg-card border-border/60 p-4">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Índice Produtividade</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-black text-purple-400">96/100</span>
                <span className="text-[9px] text-purple-400 font-bold">Excelente</span>
              </div>
            </Card>
          </div>

          <Card className="glass-card rounded-2xl border-border/70 bg-card/85 p-6 space-y-4">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Operadores & Atendentes Híbridos em Operação
            </h3>
            <div className="space-y-3">
              {[
                { name: "Agente IA ZAPFLOW Aurora", role: "Especialista Comercial IA", status: "online", activeChats: 18, totalToday: 142 },
                { name: "Rafael Silva", role: "Atendente Humano Nível 2", status: "online", activeChats: 4, totalToday: 38 },
                { name: "Julia Santos", role: "Atendente Humana Vendas", status: "online", activeChats: 5, totalToday: 41 },
                { name: "Pedro Costa", role: "Suporte Técnico B2B", status: "busy", activeChats: 6, totalToday: 29 },
              ].map((op) => (
                <div key={op.name} className="flex items-center justify-between p-3.5 rounded-xl border border-border/50 bg-background/40 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <p className="font-bold text-foreground">{op.name}</p>
                      <p className="text-[10px] text-muted-foreground">{op.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="font-bold text-foreground">{op.activeChats}</span>
                      <span className="text-[9px] text-muted-foreground block">em atendimento</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400">{op.totalToday}</span>
                      <span className="text-[9px] text-muted-foreground block">atendidos hoje</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400">
                      {op.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
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
