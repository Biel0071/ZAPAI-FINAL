import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Export, ArrowClockwise, ShieldCheck, WarningCircle, Clock, Brain, Cpu, Plugs, Shield, Database } from "@phosphor-icons/react";
import { MapContainer, Marker, Popup, TileLayer, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, PieChart, Pie, Cell } from "recharts";
import type {
  DashboardLovableViewModel,
  DashboardMapScope,
  DashboardMapRow,
} from "@/adapters/lovable/dashboardAdapter";
import type { AnalyticsLovableViewModel } from "@/adapters/lovable/analyticsAdapter";

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
  return hasRows ? "Safe" : "Attention";
}

function healthClass(hasRows: boolean) {
  return hasRows ? "bg-success/15 text-success" : "bg-warning/15 text-warning";
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

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
}: DashboardViewProps) {
  const hasMappedRows = mapRows.length > 0;
  const topRegions = viewModel.map.regionRows.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as DashboardViewProps["activeTab"])}>
          <TabsList className="w-full justify-start overflow-x-auto rounded-lg border border-border/70 bg-card/70 p-1 xl:w-auto">
            {viewModel.tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${healthClass(hasMappedRows)}`}>
          <ShieldCheck className="h-4 w-4" weight="duotone" />
          Number health: {healthTone(hasMappedRows)}
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          {/* Linha 1: KPIs principais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Conversas Ativas</p>
                <h3 className="font-display text-2xl font-bold">{analyticsViewModel.kpis[1]?.value || "0"}</h3>
                <span className="text-[10px] text-muted-foreground">Fila de interações em tempo real</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Leads Totais</p>
                <h3 className="font-display text-2xl font-bold">{analyticsViewModel.kpis[3]?.value || "0"}</h3>
                <span className="text-[10px] text-muted-foreground">Base sincronizada no CRM</span>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Runtime Status</p>
                  <Badge variant="secondary" className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${toneClasses(viewModel.overviewCards[1].tone)}`}>
                    {viewModel.overviewCards[1].badgeLabel}
                  </Badge>
                </div>
                <h3 className="font-display text-2xl font-bold">{viewModel.overviewCards[1].value}</h3>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Websocket</p>
                  <Badge variant="secondary" className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${toneClasses(viewModel.overviewCards[2].tone)}`}>
                    {viewModel.overviewCards[2].badgeLabel}
                  </Badge>
                </div>
                <h3 className="font-display text-2xl font-bold">{viewModel.overviewCards[2].value} conexão</h3>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">IA Response Rate</p>
                <h3 className="font-display text-2xl font-bold">{analyticsViewModel.kpis[2]?.value || "0"}</h3>
                <span className="text-[10px] text-success font-semibold">Respostas automáticas hoje</span>
              </CardContent>
            </Card>
          </div>

          {/* Linha 2: Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 glass-card rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="py-4">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                  <Clock weight="bold" className="h-4 w-4 text-primary" /> Fluxo de Mensagens por Hora
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[260px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsViewModel.chartData}>
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
                    <Pie data={analyticsViewModel.tempDistribution} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value">
                      {analyticsViewModel.tempDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-display">{analyticsViewModel.totalLeadsLabel}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold">Leads</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Linha 3: Cards operacionais */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Plugs weight="fill" className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Camada IA</p>
                  <p className="text-xs font-bold text-foreground">Operando Ativa</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                  <Shield weight="fill" className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Fallback</p>
                  <p className="text-xs font-bold text-foreground">Habilitado</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-info/10 flex items-center justify-center text-info">
                  <Brain weight="fill" className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Memória Ativa</p>
                  <p className="text-xs font-bold text-foreground">Consolidando Fatos</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center text-success">
                  <Cpu weight="fill" className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Tokens Hoje</p>
                  <p className="text-xs font-bold text-foreground">
                    {(() => {
                      const msgCount = Number(analyticsViewModel.kpis[0]?.value.replace(/\D/g, "")) || 0;
                      return (msgCount * 320).toLocaleString("pt-BR");
                    })()}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Database weight="fill" className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Sessões Online</p>
                  <p className="text-xs font-bold text-foreground">{viewModel.overviewCards[3].badgeLabel}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "map" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_390px]">
            <Card className="glass-card overflow-hidden rounded-2xl border-border/70 bg-card/85">
              <CardHeader className="flex flex-col gap-4 border-b border-border/70 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="font-display flex items-center gap-2 text-2xl">
                    <MapPin className="h-5 w-5 text-primary" weight="duotone" />
                    {viewModel.map.title}
                  </CardTitle>
                  <p className="mt-2 text-muted-foreground">{viewModel.map.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={onResetMap}>
                    <ArrowClockwise className="h-4 w-4" />
                    Resetar
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={onExportMap}>
                    <Export className="h-4 w-4" />
                    Exportar Dados
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-0">
                {hasMappedRows ? (
                  <div className="h-[520px] w-full">
                    <LeafletMapContainer center={BASE_CENTER} zoom={4} minZoom={3} className="h-full w-full bg-background" worldCopyJump>
                      <LeafletTileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                      />

                      {viewModel.map.points.map((point) => (
                        <LeafletCircle
                          key={`heat-${point.id}`}
                          center={[point.lat, point.lng]}
                          radius={Math.max(50000, point.count * 8000)}
                          pathOptions={{
                            color: "hsl(var(--primary))",
                            fillColor: "hsl(var(--primary))",
                            fillOpacity: 0.12,
                            weight: 0,
                          }}
                        />
                      ))}

                      {viewModel.map.points.map((point) => (
                        <LeafletMarker key={point.id} position={[point.lat, point.lng]} icon={markerIcon()}>
                          <Popup>
                            <div className="space-y-1 text-xs">
                              <p className="font-semibold">{point.label}</p>
                              <p>{point.count} leads</p>
                            </div>
                          </Popup>
                        </LeafletMarker>
                      ))}

                      {viewModel.map.leadPins?.map((pin) => (
                        <LeafletMarker key={pin.id} position={[pin.lat, pin.lng]} icon={leadMarkerIcon(pin.funnelStage)}>
                          <Popup>
                            <div className="space-y-1.5 p-1 text-xs max-w-[220px]">
                              <p className="font-bold text-foreground flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pin.funnelStage === "closed" ? "#10b981" : "#3b82f6" }}></span>
                                {pin.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">{pin.phone}</p>
                              <div className="text-[10px] bg-background/50 border border-border/50 p-1.5 rounded space-y-0.5">
                                <span className="block font-semibold text-[9px] uppercase tracking-wider text-muted-foreground">Endereço de Entrega:</span>
                                <span className="block text-foreground whitespace-pre-wrap leading-normal font-sans">{pin.address}</span>
                              </div>
                              <span className="inline-block text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize">
                                Funil: {pin.funnelStage}
                              </span>
                            </div>
                          </Popup>
                        </LeafletMarker>
                      ))}
                    </LeafletMapContainer>
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

                <div className="grid grid-cols-1 gap-4 px-6 pb-6 md:grid-cols-3">
                  {viewModel.map.summaryCards.map((card) => (
                    <div key={card.label} className="rounded-2xl border border-border/70 bg-background/30 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">{card.label}</p>
                      <p className="mt-2 font-display text-3xl font-bold">{card.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="p-2">
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-background/40 p-1">
                    {viewModel.map.scopes.map((scope) => (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => onMapScopeChange(scope.id)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          activeMapScope === scope.id
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {scope.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="space-y-3 p-4">
                  {mapRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados para o escopo atual.</p>
                  ) : (
                    mapRows.slice(0, 8).map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          if (activeMapScope === "regions") onMapScopeChange("states");
                          else if (activeMapScope === "states") onMapScopeChange("ddds");
                        }}
                        className="w-full rounded-2xl border border-border/70 bg-background/30 px-4 py-4 text-left transition-colors hover:bg-card/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">{row.label}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{row.meta}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{row.count} leads</p>
                            <p className="text-xs text-muted-foreground">{row.share}%</p>
                          </div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/70">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(row.share, 4)}%` }} />
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                    <Export className="h-6 w-6 text-success" weight="duotone" />
                  </div>
                  <div>
                    <p className="font-semibold">{viewModel.map.exportTitle}</p>
                    <p className="text-sm text-muted-foreground">{viewModel.map.exportDescription}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {topRegions.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {topRegions.map((region) => (
                <Card key={region.id} className="glass-card rounded-2xl border-border/70 bg-card/85">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold">{region.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{region.meta}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted/70">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(region.share, 4)}%` }} />
                    </div>
                    <p className="mt-3 text-sm font-medium">{region.count} leads</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "performance" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {viewModel.overviewCards.map((card) => (
              <Card key={card.label} className="metric-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
                      <h3 className="mt-2 font-display text-2xl font-bold">{card.value}</h3>
                    </div>
                    {card.badgeLabel ? (
                      <Badge variant="secondary" className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${toneClasses(card.tone)}`}>
                        {card.badgeLabel}
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <ShieldCheck className="h-8 w-8 text-primary" weight="duotone" />
              <div>
                <p className="font-display text-lg font-semibold">Performance operacional em tempo real</p>
                <p className="mt-1 text-sm text-muted-foreground">Métricas de desempenho baseadas nos dados atuais da operação com {viewModel.map.summaryCards[0]?.value ?? "0"} leads mapeados.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "conversations" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Mapeado</p>
                <h3 className="font-display text-2xl font-bold">{viewModel.map.summaryCards[0]?.value ?? "0"}</h3>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estados Ativos</p>
                <h3 className="font-display text-2xl font-bold">{viewModel.map.summaryCards[1]?.value ?? "0"}</h3>
              </CardContent>
            </Card>
            <Card className="metric-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="space-y-2 p-5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">DDDs Identificados</p>
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

      {activeTab === "ai" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {viewModel.overviewCards.map((card) => (
              <Card key={card.label} className="metric-card rounded-2xl border-border/70 bg-card/85">
                <CardContent className="space-y-2 p-5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
                  <h3 className="mt-2 font-display text-2xl font-bold">{card.value}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <ShieldCheck className="h-8 w-8 text-info" weight="duotone" />
              <div>
                <p className="font-display text-lg font-semibold">Inteligência Artificial ativa</p>
                <p className="mt-1 text-sm text-muted-foreground">A camada de IA está {viewModel.overviewCards[1]?.value === "Online" ? "operando em tempo real" : "em modo de contingência"}. Para configurar prompts, providers e memória, acesse a tela de IA.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="space-y-6 animate-in fade-in-0 duration-300">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <ShieldCheck className="h-6 w-6 text-primary" weight="duotone" />
                </div>
                <div>
                  <p className="font-display font-semibold">Horário comercial</p>
                  <p className="text-sm text-muted-foreground">Para configurar horários de atendimento e mensagens de ausência, acesse a tela de IA → Horário Comercial.</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card rounded-2xl border-border/70 bg-card/85">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                  <Export className="h-6 w-6 text-success" weight="duotone" />
                </div>
                <div>
                  <p className="font-display font-semibold">Estado da operação</p>
                  <p className="text-sm text-muted-foreground">{viewModel.overviewCards[3]?.badgeLabel ?? "Verificando estado..."}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
