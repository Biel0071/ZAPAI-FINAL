import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, CurrencyDollar, TrendUp, Fire, ChartBar } from "@phosphor-icons/react";

interface ConversionHeatmapProps {
  campaigns?: Array<{
    id: string;
    name: string;
    sent: number;
    converted: number;
    revenue: number;
    roi: number;
    topState?: string;
    topCity?: string;
    bestHour?: string;
  }>;
}

export function ConversionHeatmap({ campaigns = [] }: ConversionHeatmapProps) {
  const sampleCampaigns = useMemo(() => {
    if (campaigns && campaigns.length > 0) return campaigns;
    return [
      {
        id: "camp-01",
        name: "Disparo Inbound Q3 - Software Enterprise",
        sent: 1250,
        converted: 184,
        revenue: 918160.0,
        roi: 485,
        topState: "SP (42%)",
        topCity: "São Paulo - SP",
        bestHour: "14:00 - 16:00",
      },
      {
        id: "camp-02",
        name: "Reengajamento de Leads Frios",
        sent: 850,
        converted: 96,
        revenue: 479040.0,
        roi: 320,
        topState: "RJ (28%)",
        topCity: "Rio de Janeiro - RJ",
        bestHour: "10:00 - 11:30",
      },
      {
        id: "camp-03",
        name: "Oferta Módulo ZAPFLOW AI Voices",
        sent: 420,
        converted: 68,
        revenue: 101320.0,
        roi: 290,
        topState: "MG (19%)",
        topCity: "Belo Horizonte - MG",
        bestHour: "15:00 - 17:00",
      },
    ];
  }, [campaigns]);

  // Hourly distribution breakdown (00h to 23h)
  const hourlyData = [
    { hour: "08h", rate: 12 },
    { hour: "09h", rate: 28 },
    { hour: "10h", rate: 65 },
    { hour: "11h", rate: 82 },
    { hour: "12h", rate: 45 },
    { hour: "13h", rate: 58 },
    { hour: "14h", rate: 95 },
    { hour: "15h", rate: 88 },
    { hour: "16h", rate: 76 },
    { hour: "17h", rate: 54 },
    { hour: "18h", rate: 30 },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/80 bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receita Total Acumulada</span>
          <h3 className="font-display font-black text-2xl text-emerald-400">R$ 1.498.520,00</h3>
          <span className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
            <TrendUp size={12} /> +34% vs mês anterior
          </span>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ROI Médio de Campanhas</span>
          <h3 className="font-display font-black text-2xl text-primary">365%</h3>
          <span className="text-[10px] text-primary font-semibold flex items-center gap-1">
            Retorno sobre investimento em disparos
          </span>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pico de Conversão por Horário</span>
          <h3 className="font-display font-black text-2xl text-amber-400">14:00 às 16:00</h3>
          <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
            <Fire size={12} /> Maior taxa de resposta
          </span>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado Líder em Vendas</span>
          <h3 className="font-display font-black text-2xl text-blue-400">São Paulo (SP)</h3>
          <span className="text-[10px] text-blue-300 font-semibold flex items-center gap-1">
            42% do volume nacional
          </span>
        </Card>
      </div>

      {/* Hourly Conversion Heatmap Chart */}
      <Card className="rounded-2xl border-border/80 bg-card p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Clock className="text-amber-400" size={20} /> Heatmap de Conversão por Horário de Envio
            </h3>
            <p className="text-xs text-muted-foreground">
              Intensidade de respostas e conversões registradas por faixa horária.
            </p>
          </div>
          <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400">
            Horário Nobre: 14h - 16h
          </Badge>
        </div>

        {/* Heatmap Bar Grid */}
        <div className="grid grid-cols-11 gap-2 pt-2">
          {hourlyData.map((d) => {
            const intensity =
              d.rate > 80 ? "bg-amber-500 text-slate-950 font-bold" : d.rate > 50 ? "bg-amber-500/70 text-slate-900 font-semibold" : "bg-amber-500/30 text-amber-200";
            return (
              <div key={d.hour} className="flex flex-col items-center space-y-2">
                <div
                  style={{ height: `${d.rate * 1.2}px` }}
                  className={`w-full rounded-xl transition-all duration-300 hover:scale-105 flex items-end justify-center pb-1 text-[10px] ${intensity}`}
                >
                  {d.rate}%
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{d.hour}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Regional & Campaign Conversion Table */}
      <Card className="rounded-2xl border-border/80 bg-card p-6 space-y-4">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <MapPin className="text-primary" size={20} /> Performance por Estado, Cidade e Campanha
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px]">
                <th className="py-2.5 px-3">Campanha</th>
                <th className="py-2.5 px-3">Enviados</th>
                <th className="py-2.5 px-3">Convertidos</th>
                <th className="py-2.5 px-3">Estado Líder</th>
                <th className="py-2.5 px-3">Cidade Top</th>
                <th className="py-2.5 px-3">Receita Gerada</th>
                <th className="py-2.5 px-3">ROI (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sampleCampaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-3 font-bold text-foreground">{c.name}</td>
                  <td className="py-3 px-3">{c.sent.toLocaleString()}</td>
                  <td className="py-3 px-3 font-semibold text-emerald-400">{c.converted}</td>
                  <td className="py-3 px-3">{c.topState}</td>
                  <td className="py-3 px-3">{c.topCity}</td>
                  <td className="py-3 px-3 font-bold text-emerald-400">
                    R$ {c.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3">
                    <Badge className="bg-primary/20 text-primary border-primary/40 font-bold">+{c.roi}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
