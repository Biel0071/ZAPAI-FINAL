import { ChatCircleDots, PaperPlaneTilt, Lightning, Users, TrendUp, Clock, Tag } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import type { AnalyticsLovableViewModel } from "@/adapters/lovable/analyticsAdapter";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

export interface AnalyticsViewProps {
  loading: boolean;
  viewModel: AnalyticsLovableViewModel;
}

export function AnalyticsView({ loading, viewModel }: AnalyticsViewProps) {
  return (
    <div className="page-container section-stack">
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`analytics-skeleton-${index}`} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="metric-card border-primary/20 bg-primary/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{viewModel.kpis[0]?.label}</p>
                    <h3 className="mt-1 text-2xl font-bold font-display">{viewModel.kpis[0]?.value}</h3>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <PaperPlaneTilt weight="fill" className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-success font-bold">
                  <TrendUp weight="bold" /> {viewModel.kpis[0]?.hint}
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{viewModel.kpis[1]?.label}</p>
                    <h3 className="mt-1 text-2xl font-bold font-display">{viewModel.kpis[1]?.value}</h3>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <ChatCircleDots weight="fill" className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card border-info/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-info">{viewModel.kpis[2]?.label}</p>
                    <h3 className="mt-1 text-2xl font-bold font-display">{viewModel.kpis[2]?.value}</h3>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center text-info">
                    <Lightning weight="fill" className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="metric-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{viewModel.kpis[3]?.label}</p>
                    <h3 className="mt-1 text-2xl font-bold font-display">{viewModel.kpis[3]?.value}</h3>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Users weight="fill" className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <Clock weight="bold" /> Fluxo de Mensagens por Hora
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={viewModel.chartData}>
                    <defs>
                      <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ fontSize: "12px" }} />
                    <Area type="monotone" dataKey="msgs" name="Mensagens" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorMsgs)" strokeWidth={2} />
                    <Area type="monotone" dataKey="ai" name="Respostas IA" stroke="#0ea5e9" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest">Temperatura da Base</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={viewModel.tempDistribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {viewModel.tempDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-bold font-display">{viewModel.totalLeadsLabel}</span>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Leads</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
                  <Tag weight="bold" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Top Etiqueta</p>
                  <p className="text-sm font-bold">Lead Qualificado</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Users weight="bold" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Segmento dominante</p>
                  <p className="text-sm font-bold">Conversas B2B</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center text-info">
                  <Lightning weight="bold" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Camada IA</p>
                  <p className="text-sm font-bold">Operando com fallback</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
