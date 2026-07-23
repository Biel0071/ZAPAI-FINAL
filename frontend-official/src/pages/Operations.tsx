import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/apiService";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Headphones,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { AIAssistantGuideCard } from "@/components/ai/AIAssistantGuideCard";

export interface OperationsData {
  queue: {
    totalWaiting: number;
    averageWaitSeconds: number;
    slaStatus: string;
    slaCompliancePercent: number;
  };
  operators: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    activeChats: number;
    totalToday: number;
  }>;
  metrics: {
    totalConversations: number;
    openConversations: number;
    waitingConversations: number;
    closedConversations: number;
    avgResponseTimeSeconds: number;
    avgHandlingTimeMinutes: number;
    slaCompliancePercent: number;
    transfersToday: number;
    productivityIndex: number;
  };
  timestamp: string;
}

export default function Operations() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await apiService.fetchOperationsMetrics();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error("[OPERATIONS_PAGE] Error loading operations metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Operação e Gestão de Atendimento em Tempo Real"
        subtitle="Monitoramento ao vivo de filas de espera, operadores, cumprimento de SLA e produtividade"
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <AIAssistantGuideCard />

        {/* METRICAS PRINCIPAIS DA OPERACAO */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Fila de Espera</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-amber-400">{data?.metrics.waitingConversations ?? 0}</span>
              <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">Ao Vivo</Badge>
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Conversas Abertas</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-emerald-400">{data?.metrics.openConversations ?? 0}</span>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Atendimentos Encerrados</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-foreground">{data?.metrics.closedConversations ?? 0}</span>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Tempo Médio Resposta</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-cyan-400">{data?.metrics.avgResponseTimeSeconds ?? 0}s</span>
              <Clock className="h-4 w-4 text-cyan-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Nível de SLA</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-emerald-400">{data?.metrics.slaCompliancePercent ?? 100}%</span>
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Índice de Produtividade</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-purple-400">{data?.metrics.productivityIndex ?? 95}%</span>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
          </Card>
        </div>

        {/* TABELA DE OPERADORES & ATENDENTES */}
        <Card className="bg-card border-border/80 shadow-xl">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-emerald-400" /> Status dos Atendentes & Operadores
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Acompanhamento de carga de trabalho e atendimentos em andamento por operador
                </CardDescription>
              </div>

              <Button onClick={fetchMetrics} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar Dados
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-border/40 text-xs">
              {data?.operators.map((op) => (
                <div key={op.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
                      {op.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{op.name}</p>
                      <span className="text-[10px] text-muted-foreground">{op.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Chats Ativos</span>
                      <span className="font-bold text-foreground">{op.activeChats} em andamento</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block">Atendimentos Hoje</span>
                      <span className="font-bold text-emerald-400">{op.totalToday} total</span>
                    </div>

                    <Badge
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                        op.status === "online"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      }`}
                    >
                      {op.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
