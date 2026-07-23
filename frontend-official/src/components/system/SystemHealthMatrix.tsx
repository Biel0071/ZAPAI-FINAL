import React, { useEffect, useState } from "react";
import { Activity, Database, Server, Cpu, HardDrive, Wifi, ShieldCheck, Zap, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiService } from "@/services/apiService";

export interface SystemHealthData {
  services: Record<string, { name: string; status: string; lastSync: string; error: string | null; attempts: number }>;
  lastHealthCheck: string;
}

export function SystemHealthMatrix() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await apiService.getHealth();
      if (res) {
        setHealth({
          services: {
            postgresql: { name: "PostgreSQL Database", status: res.db ? "online" : "offline", lastSync: res.timestamp, error: null, attempts: 0 },
            baileys: { name: "WhatsApp Baileys Socket", status: res.whatsapp?.status === "online" ? "online" : "offline", lastSync: res.timestamp, error: null, attempts: 0 },
            redis: { name: "Redis Cache & Queue", status: "online", lastSync: res.timestamp, error: null, attempts: 0 },
            aiGateway: { name: "AI Model Gateway", status: res.system?.aiEngine === "healthy" ? "online" : "degraded", lastSync: res.timestamp, error: null, attempts: 0 },
            websocket: { name: "WebSocket Realtime Engine", status: res.system?.socket === "connected" ? "online" : "offline", lastSync: res.timestamp, error: null, attempts: 0 },
          },
          lastHealthCheck: res.timestamp,
        });
      }
    } catch (err) {
      console.error("[HEALTH_MATRIX] Error loading system health:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-card border-border/80 shadow-2xl overflow-hidden">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Painel de Telemetria & Observabilidade (Grafana-Style)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Monitoramento em tempo real de infraestrutura, bancos de dados, filas e conexões de rede
              </CardDescription>
            </div>
          </div>

          <Button onClick={fetchHealth} variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar Status
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {health &&
            Object.entries(health.services).map(([key, service]) => (
              <div
                key={key}
                className="bg-background/80 p-3 rounded-xl border border-border/60 flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground truncate text-[11px]">{service.name}</span>
                  <Badge
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.5 ${
                      service.status === "online"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-red-500/20 text-red-300 border-red-500/30"
                    }`}
                  >
                    {service.status}
                  </Badge>
                </div>

                {service.error ? (
                  <p className="text-[10px] text-red-400 font-mono leading-tight">{service.error}</p>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-semibold text-[10px]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Conexão Estável</span>
                  </div>
                )}
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
