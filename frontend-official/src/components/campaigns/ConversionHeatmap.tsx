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
  const totalRevenue = useMemo(() => campaigns.reduce((acc, c) => acc + (c.revenue || 0), 0), [campaigns]);
  const avgRoi = useMemo(() => campaigns.length > 0 ? Math.round(campaigns.reduce((acc, c) => acc + (c.roi || 0), 0) / campaigns.length) : 0, [campaigns]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border/80 bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Receita Total Acumulada</span>
          <h3 className="font-display font-black text-2xl text-emerald-400">
            R$ {totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </h3>
          <span className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
            Receita baseada nos dados reais
          </span>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conversão (ROI) Médio</span>
          <h3 className="font-display font-black text-2xl text-primary">{avgRoi}%</h3>
          <span className="text-[10px] text-primary font-semibold flex items-center gap-1">
            Taxa média de sucesso das campanhas
          </span>
        </Card>

        <Card className="rounded-2xl border-border/80 bg-card p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total de Campanhas Analisadas</span>
          <h3 className="font-display font-black text-2xl text-blue-400">{campaigns.length}</h3>
          <span className="text-[10px] text-blue-300 font-semibold flex items-center gap-1">
            Histórico real processado
          </span>
        </Card>
      </div>

      {/* Regional & Campaign Conversion Table */}
      <Card className="rounded-2xl border-border/80 bg-card p-6 space-y-4">
        <h3 className="font-bold text-base text-foreground flex items-center gap-2">
          <ChartBar className="text-primary" size={20} /> Performance Real das Campanhas
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px]">
                <th className="py-2.5 px-3">Campanha</th>
                <th className="py-2.5 px-3">Enviados</th>
                <th className="py-2.5 px-3">Convertidos / Entregues</th>
                <th className="py-2.5 px-3">Estado Líder</th>
                <th className="py-2.5 px-3">Cidade Top</th>
                <th className="py-2.5 px-3">Receita Gerada</th>
                <th className="py-2.5 px-3">Conversão (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma campanha enviada com dados de análise disponíveis no momento.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 font-bold text-foreground">{c.name || "Sem Nome"}</td>
                    <td className="py-3 px-3">{c.sent?.toLocaleString() ?? 0}</td>
                    <td className="py-3 px-3 font-semibold text-emerald-400">{c.converted ?? 0}</td>
                    <td className="py-3 px-3 text-muted-foreground">{c.topState || "—"}</td>
                    <td className="py-3 px-3 text-muted-foreground">{c.topCity || "—"}</td>
                    <td className="py-3 px-3 font-bold text-emerald-400">
                      R$ {(c.revenue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3">
                      <Badge className="bg-primary/20 text-primary border-primary/40 font-bold">{(c.roi || 0)}%</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
