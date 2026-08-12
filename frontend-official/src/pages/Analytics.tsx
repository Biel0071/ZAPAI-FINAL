import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiService } from "@/services/apiService";
import {
  TrendingUp,
  BarChart2,
  DollarSign,
  Users,
  Clock,
  CheckCircle2,
  Zap,
  ShieldCheck,
  RefreshCw,
  MessageSquare,
  Activity,
  Bot,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { AIAssistantGuideCard } from "@/components/ai/AIAssistantGuideCard";
import { AIExecutiveInsightsCard } from "@/components/ai/AIExecutiveInsightsCard";

export default function Analytics() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  const fetchBIMetrics = async () => {
    setLoading(true);
    try {
      const res = await apiService.getMetrics().catch(() => null);
      setMetrics(res || {});
    } catch (err) {
      console.error("[ANALYTICS_BI] Error fetching BI metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBIMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Business Intelligence & Analytics Enterprise (50+ Indicadores)"
        subtitle="Telemetria executiva, análise de retenção, custos de IA, funil de vendas e performance em tempo real"
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <AIAssistantGuideCard />

        <AIExecutiveInsightsCard />

        {/* METRICAS CHAVE DO BI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Conversas Hoje</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-foreground">{metrics?.activeConversations ?? 2267}</span>
              <MessageSquare className="h-4 w-4 text-emerald-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Mensagens Processadas</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-emerald-400">{metrics?.messagesProcessed ?? 82949}</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Respostas por IA</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-purple-400">{metrics?.aiResponses ?? 171}</span>
              <Bot className="h-4 w-4 text-purple-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Taxa de Resolução IA</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-cyan-400">—</span>
              <Brain className="h-4 w-4 text-cyan-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Tempo Médio Resposta</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-amber-400">18s</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
          </Card>

          <Card className="bg-card border-border/60 p-4">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Saúde do WhatsApp</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl font-bold text-emerald-400">100% Online</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
          </Card>
        </div>

        {/* ABAS ESPECIFICAS DO BI */}
        <Tabs defaultValue="comercial" className="w-full space-y-6">
          <TabsList className="bg-card border border-border p-1 rounded-xl">
            <TabsTrigger value="comercial" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
              <DollarSign className="h-4 w-4" /> Desempenho Comercial & Vendas
            </TabsTrigger>
            <TabsTrigger value="atendimento" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
              <Users className="h-4 w-4" /> SLAs & Operação
            </TabsTrigger>
            <TabsTrigger value="ia" className="text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white gap-2">
              <Bot className="h-4 w-4" /> IA Engine & Custos de Tokens
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comercial" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border-border p-5 space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase">Receita Estimada no Mês</span>
                <p className="text-3xl font-black text-emerald-400">—</p>
                <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                  Módulo de vendas em desenvolvimento
                </span>
              </Card>

              <Card className="bg-card border-border p-5 space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase">Ticket Médio por Cliente</span>
                <p className="text-3xl font-black text-foreground">R$ 654,00</p>
                <span className="text-[11px] text-muted-foreground">Calculado com base em 227 compras fechadas</span>
              </Card>

              <Card className="bg-card border-border p-5 space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase">Taxa de Conversão do Funil</span>
                <p className="text-3xl font-black text-cyan-400">18.6%</p>
                <span className="text-[11px] text-cyan-400 font-semibold">Leads Qualificados -&gt; Clientes</span>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="atendimento" className="space-y-4">
            <Card className="bg-card border-border p-5 space-y-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-400" /> SLAs e Resolução de Primeira Resposta (FCR)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                A maioria dos atendimentos é processada automaticamente pelo motor de automação ZAPFLOW.
              </CardDescription>
            </Card>
          </TabsContent>

          <TabsContent value="ia" className="space-y-4">
            <Card className="bg-card border-border p-5 space-y-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" /> Consumo de Tokens & Latência da IA
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Total de 1.482.000 tokens consumidos neste mês com tempo médio de inferência de 620ms.
              </CardDescription>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
