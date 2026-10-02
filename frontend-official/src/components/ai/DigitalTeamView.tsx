import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserPlus,
  Play,
  Pause,
  Sliders,
  Smartphone,
  MessageSquare,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Award,
  Activity,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Bot,
} from "lucide-react";
import { cn } from "@/core/lib/utils";
import { useToast } from "@/state/hooks/use-toast";
import { apiService } from "@/core/services/apiService";

export function getAgentStatusBadge(agent: any) {
  const isFemale =
    agent.character?.gender === "female" ||
    agent.gender === "female" ||
    (typeof agent.name === "string" && agent.name.toLowerCase().endsWith("a"));

  const rawStatus = String(agent.status || (agent.active === false ? "paused" : "active")).toLowerCase();

  switch (rawStatus) {
    case "active":
    case "online":
    case "ativo":
    case "ativa":
      return {
        label: isFemale ? "● Ativa" : "● Ativo",
        className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        isOnline: true,
      };
    case "paused":
    case "pausado":
    case "pausada":
      return {
        label: isFemale ? "○ Pausada" : "○ Pausado",
        className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        isOnline: false,
      };
    case "offline":
      return {
        label: "○ Offline",
        className: "bg-muted text-muted-foreground border-border/60",
        isOnline: false,
      };
    case "busy":
    case "ocupado":
    case "ocupada":
      return {
        label: isFemale ? "● Ocupada" : "● Ocupado",
        className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
        isOnline: true,
      };
    case "processing":
    case "processando":
      return {
        label: "⚡ Processando",
        className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
        isOnline: true,
      };
    case "in_service":
    case "em_atendimento":
    case "em atendimento":
      return {
        label: "💬 Em Atendimento",
        className: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
        isOnline: true,
      };
    case "learning":
    case "aprendendo":
      return {
        label: "🧠 Aprendendo",
        className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
        isOnline: true,
      };
    case "error":
    case "erro":
      return {
        label: "⚠️ Erro",
        className: "bg-destructive/15 text-destructive border-destructive/30",
        isOnline: false,
      };
    default:
      return {
        label: isFemale ? "● Ativa" : "● Ativo",
        className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        isOnline: agent.active !== false,
      };
  }
}

interface DigitalTeamViewProps {
  agents: any[];
  onSelectAgent: (agent: any) => void;
  onOpenNewAgentWizard: (defaultRole?: string) => void;
  onOpenCustomizer?: (agent: any) => void;
  onRefresh?: () => void;
}

export function DigitalTeamView({
  agents,
  onSelectAgent,
  onOpenNewAgentWizard,
  onOpenCustomizer,
  onRefresh,
}: DigitalTeamViewProps) {
  const { toast } = useToast();
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // Filter out platform-only assistants (like ZAIBOT) from the human digital employees list
  const companyEmployees = agents.filter((a) => !a.isPlatformAssistant && a.key !== "zaibot");

  // Fallback showing full digital employee team
  const displayEmployees = companyEmployees.length > 0 ? companyEmployees : [
    {
      key: "camila",
      name: "Camila",
      role: "Vendas",
      active: true,
      status: "active",
      channels: ["whatsapp", "inbox"],
      avatar: "/assets/mascot/mascot_laptop_working.png",
      personalityType: "comercial",
      character: { gender: "female", outfit: "uniforme_vendas", theme: "emerald" },
      stats: { chatsToday: 127, slaPercent: 94, satisfactionCsat: 98, avgResponseTime: "18s" },
      recentActivity: [{ time: "10:42", action: "Respondeu cliente sobre cimento e telhas" }],
    },
    {
      key: "joao",
      name: "João",
      role: "Suporte",
      active: true,
      status: "active",
      channels: ["whatsapp", "inbox"],
      avatar: "/assets/mascot/zaibot_avatar.png",
      personalityType: "tecnico",
      character: { gender: "male", outfit: "uniforme_suporte", theme: "cyan" },
      stats: { chatsToday: 68, slaPercent: 97, satisfactionCsat: 95, avgResponseTime: "22s" },
      recentActivity: [{ time: "10:35", action: "Solucionou dúvida sobre aplicação de argamassa" }],
    },
    {
      key: "marina",
      name: "Marina",
      role: "Pós-venda",
      active: false,
      status: "paused",
      channels: ["whatsapp"],
      avatar: "/assets/mascot/mascot_laptop_working.png",
      personalityType: "empatica",
      character: { gender: "female", outfit: "uniforme_pos_venda", theme: "purple" },
      stats: { chatsToday: 42, slaPercent: 96, satisfactionCsat: 99, avgResponseTime: "16s" },
      recentActivity: [{ time: "10:15", action: "Confirmou entrega pontual de pedido faturado" }],
    },
    {
      key: "carlos",
      name: "Carlos",
      role: "Financeiro",
      active: false,
      status: "offline",
      channels: ["inbox"],
      avatar: "/assets/mascot/zaibot_avatar.png",
      personalityType: "formal",
      character: { gender: "male", outfit: "business", theme: "slate" },
      stats: { chatsToday: 15, slaPercent: 92, satisfactionCsat: 94, avgResponseTime: "25s" },
      recentActivity: [{ time: "09:40", action: "Emitiu 2ª via de boleto bancário faturado" }],
    },
  ];

  const activeCount = displayEmployees.filter((a) => a.active !== false).length;
  const totalChats = displayEmployees.reduce((acc, a) => acc + (a.stats?.chatsToday || (a.key === "camila" ? 127 : 35)), 0);

  const handleToggle = async (e: React.MouseEvent, agent: any) => {
    e.stopPropagation();
    const nextState = agent.active === false;
    setTogglingKey(agent.key);
    try {
      await apiService.toggleAIAgent(agent.key, nextState);
      toast({
        title: nextState ? "Agente ativado" : "Agente pausado",
        description: `${agent.name} agora está ${nextState ? "ativo(a)" : "pausado(a)"}.`,
      });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast({
        title: "Erro ao alternar status",
        description: err?.message || "Não foi possível alterar o status.",
        variant: "destructive",
      });
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* TEAM OVERVIEW / DASHBOARD DA EQUIPE */}
      <div className="p-5 rounded-2xl border border-border/80 bg-card/60 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              Equipe Digital
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Funcionários digitais dedicados ao atendimento, vendas e pós-venda da sua empresa.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenNewAgentWizard()}
              className="h-8 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 shadow-xs px-3"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Adicionar Agente</span>
            </Button>
          </div>
        </div>

        {/* METRICS STRIP: HOJE */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Agentes Ativos</span>
            <div className="text-xl font-bold text-foreground mt-0.5">
              {activeCount} <span className="text-xs font-normal text-muted-foreground">/ {displayEmployees.length}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">Equipe pronta</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Atendimentos Hoje</span>
            <div className="text-xl font-bold text-foreground mt-0.5">{totalChats}</div>
            <span className="text-[10px] text-emerald-400 font-medium">100% no SLA</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Conversas Ativas</span>
            <div className="text-xl font-bold text-foreground mt-0.5">38</div>
            <span className="text-[10px] text-muted-foreground">Em andamento</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Tempo Médio</span>
            <div className="text-xl font-bold text-foreground mt-0.5">18s</div>
            <span className="text-[10px] text-emerald-400 font-medium">Imediato</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Satisfação (CSAT)</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">98%</div>
            <span className="text-[10px] text-emerald-400 font-medium">Excelente</span>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Conversões</span>
            <div className="text-xl font-bold text-foreground mt-0.5">24</div>
            <span className="text-[10px] text-emerald-400 font-medium">Oportunidades</span>
          </div>
        </div>
      </div>

      {/* TEAM MEMBERS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Membros da Equipe ({displayEmployees.length})
          </span>
          <span className="text-xs text-muted-foreground">
            Clique em qualquer membro para abrir o perfil operacional
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayEmployees.map((agent, index) => {
            const isOnline = agent.active !== false;
            const channels = Array.isArray(agent.channels) && agent.channels.length > 0 ? agent.channels : ["whatsapp"];
            const chats = agent.stats?.chatsToday ?? (agent.key === "camila" ? 127 : 35);
            const sla = agent.stats?.slaPercent ?? (agent.key === "camila" ? 94 : 98);
            const latestAct = agent.recentActivity?.[0]?.action || "Atendimento comercial ativo";
            const agentKey = agent.key || agent.id || `agent-${index}`;

            const statusInfo = getAgentStatusBadge(agent);

            return (
              <div
                key={agentKey}
                role="button"
                tabIndex={0}
                onClick={() => onSelectAgent(agent)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectAgent(agent);
                }}
                className={cn(
                  "p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-3.5 relative group",
                  "bg-card/70 border-border/80 hover:border-emerald-500/50 hover:shadow-sm"
                )}
              >
                {/* TOP INFO */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={agent.avatar || (agent.key === "camila" ? "/assets/mascot/mascot_laptop_working.png" : "/assets/mascot/zaibot_avatar.png")}
                      alt={agent.name}
                      className="h-12 w-12 rounded-xl object-cover border border-border/80 bg-black/30 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-foreground group-hover:text-emerald-400 transition-colors">
                          {agent.name}
                        </h3>
                        <Badge
                          className={cn(
                            "text-[9px] font-bold py-0 h-4 px-1.5",
                            statusInfo.className
                          )}
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                        {agent.role || agent.sector || "Vendas"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    title={isOnline ? "Pausar agente" : "Ativar agente"}
                    disabled={togglingKey === agent.key}
                    onClick={(e) => handleToggle(e, agent)}
                    className={cn(
                      "h-7 w-7 rounded-lg border flex items-center justify-center transition-colors shrink-0",
                      isOnline
                        ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    )}
                  >
                    {isOnline ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {/* ACTIVITY & CHANNELS */}
                <div className="space-y-2 pt-2 border-t border-border/60 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate max-w-[200px]" title={latestAct}>
                      {latestAct}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400 font-semibold shrink-0">
                      SLA {sla}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      {channels.map((c: string, cIdx: number) => (
                        <span
                          key={`${c}-${cIdx}`}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-muted/60 text-foreground/80 border border-border/50"
                        >
                          {c}
                        </span>
                      ))}
                    </div>

                    <span className="text-[11px] font-bold text-foreground">
                      {chats} atendimentos
                    </span>
                  </div>
                </div>

                {/* BOTTOM HOVER HINT */}
                <div className="flex items-center justify-end text-[11px] font-semibold text-emerald-400 opacity-90 group-hover:opacity-100 transition-opacity gap-1">
                  <span>Abrir Perfil</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}

          {/* ADD AGENT CARD */}
          <button
            type="button"
            onClick={() => onOpenNewAgentWizard()}
            className="p-6 rounded-xl border border-dashed border-border/80 hover:border-emerald-500/50 bg-muted/10 hover:bg-muted/20 transition-all flex flex-col items-center justify-center gap-2 text-center group cursor-pointer min-h-[160px]"
          >
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground group-hover:text-emerald-400 transition-colors">
                + Novo Agente
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Adicione Vendedor, Suporte, Pós-venda ou Financeiro
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
