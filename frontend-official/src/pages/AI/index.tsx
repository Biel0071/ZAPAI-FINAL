import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Bot,
  GitBranch,
  Activity,
  Brain,
  CheckCircle2,
  RefreshCw,
  Zap,
  Sliders,
  Settings2,
} from "lucide-react";
import { apiService, type AIStatusResponse } from "@/core/services/apiService";
import { useToast } from "@/state/hooks/use-toast";
import { VoiceStudioDrawer } from "@/components/ai/VoiceStudioDrawer";
import { cn } from "@/core/lib/utils";

import { AgentTab } from "./AgentTab";
import { FlowsTab } from "./FlowsTab";
import { OperationsTab } from "./OperationsTab";
import { EvolutionTab } from "./EvolutionTab";

export type UnifiedAITab = "agent" | "flows" | "operations" | "evolution";

interface AIPageProps {
  defaultSection?: string;
}

function resolveAIEnabled(status: AIStatusResponse | null): boolean {
  if (!status) return false;
  if (typeof status.enabled === "boolean") return status.enabled;
  if (typeof status.active === "boolean") return status.active;
  if (typeof status.ai === "boolean") return status.ai;
  if (typeof status.status === "string") {
    const normalized = status.status.toLowerCase();
    return normalized === "on" || normalized === "enabled" || normalized === "active";
  }
  return false;
}

function mapQueryParamToTab(param: string | null): UnifiedAITab {
  if (!param) return "agent";
  const p = param.toLowerCase().trim();
  if (["agent", "agente", "inteligencia", "atendentes", "provedores"].includes(p)) {
    return "agent";
  }
  if (["flows", "fluxos", "automacao", "playbooks", "conhecimento"].includes(p)) {
    return "flows";
  }
  if (["operations", "operacao", "filas", "dashboard"].includes(p)) {
    return "operations";
  }
  if (["evolution", "score", "evolucao"].includes(p)) {
    return "evolution";
  }
  return "agent";
}

export default function UnifiedAIPage({ defaultSection }: AIPageProps) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab determination
  const activeTab: UnifiedAITab = useMemo(() => {
    const fromQuery = searchParams.get("tab");
    if (fromQuery) return mapQueryParamToTab(fromQuery);
    if (defaultSection) return mapQueryParamToTab(defaultSection);
    return "agent";
  }, [searchParams, defaultSection]);

  const handleTabChange = (tab: UnifiedAITab) => {
    setSearchParams({ tab }, { replace: true });
  };

  // Global AI State
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);

  // Load global AI Status
  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const res = await apiService.getAIStatus();
        if (mounted) {
          setAiEnabled(resolveAIEnabled(res));
        }
      } catch (err) {
        console.error("[UnifiedAIPage] Error fetching AI status:", err);
      } finally {
        if (mounted) setLoadingStatus(false);
      }
    };

    void fetchStatus();
    return () => {
      mounted = false;
    };
  }, []);

  // Toggle Global AI Status
  const handleToggleGlobalAI = async (checked: boolean) => {
    setTogglingStatus(true);
    setAiEnabled(checked);
    try {
      await apiService.updateAIStatus(checked);
      toast({
        title: checked ? "Automação IA Ativada" : "Automação IA Pausada",
        description: checked
          ? "O robô responderá aos clientes conforme as regras e prompt configurados."
          : "O robô não enviará respostas automáticas até ser reativado.",
      });
    } catch (err: any) {
      setAiEnabled(!checked);
      toast({
        title: "Erro ao atualizar status",
        description: err?.message || "Não foi possível alterar o status global da IA.",
        variant: "destructive",
      });
    } finally {
      setTogglingStatus(false);
    }
  };

  const tabsConfig = [
    {
      id: "agent" as UnifiedAITab,
      label: "Agente & Inteligência",
      shortLabel: "Agente",
      icon: Bot,
      description: "Prompt, tom de voz, personalidade e sandbox",
    },
    {
      id: "flows" as UnifiedAITab,
      label: "Automação & Fluxos",
      shortLabel: "Fluxos",
      icon: GitBranch,
      description: "Regras de atendimento, gatilhos e playbooks",
    },
    {
      id: "operations" as UnifiedAITab,
      label: "Operações & Filas",
      shortLabel: "Operações",
      icon: Activity,
      description: "Métricas ao vivo, nós de conexão e fila",
    },
    {
      id: "evolution" as UnifiedAITab,
      label: "Evolução & Score",
      shortLabel: "Evolução",
      icon: Brain,
      description: "Maturidade, aprendizado e lacunas",
    },
  ];

  return (
    <div className="flex flex-col min-h-full bg-background pb-12">
      <Header
        title="IA & Automação"
        subtitle="Central unificada de inteligência artificial, automações, fluxos e monitoramento operacional"
      />

      <div className="w-full max-w-[var(--content-max-width)] mx-auto px-3.5 sm:px-5 lg:px-6 py-4 space-y-5">
        {/* PAGE TITLE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" /> IA & Automação
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Central unificada de inteligência artificial, automações, fluxos e monitoramento operacional
            </p>
          </div>
        </div>

        {/* GLOBAL STATUS & CONTROL STRIP */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                aiEnabled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-muted/30 border-border/60 text-muted-foreground"
              )}
            >
              <Sparkles className="h-5 w-5" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  Atendimento Automático Global
                </span>
                <Badge
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                    aiEnabled
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-muted text-muted-foreground border-border/60"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full mr-1.5",
                      aiEnabled ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"
                    )}
                  />
                  {aiEnabled ? "Ativo" : "Pausado"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {aiEnabled
                  ? "O atendente virtual está ativo e respondendo aos contatos configurados."
                  : "O atendimento automático está em pausa. Nenhuma mensagem será disparada."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">
              {aiEnabled ? "Pausar IA" : "Ativar IA"}
            </span>
            <Switch
              checked={aiEnabled}
              disabled={loadingStatus || togglingStatus}
              onCheckedChange={handleToggleGlobalAI}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </div>

        {/* 4 UNIFIED TABS SELECTOR */}
        <nav
          aria-label="Abas de IA e Automação"
          className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1.5 rounded-2xl border border-border/70 bg-muted/20"
        >
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl text-left transition-all",
                  isSelected
                    ? "bg-card text-foreground shadow-sm ring-1 ring-emerald-500/40 border border-emerald-500/20 font-bold"
                    : "text-muted-foreground hover:bg-card/50 hover:text-foreground font-medium border border-transparent"
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isSelected
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-muted/40 text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs block truncate leading-tight">
                    {tab.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate font-normal mt-0.5 hidden sm:block">
                    {tab.description}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* ACTIVE TAB CONTENT */}
        <main className="w-full min-h-[500px] animate-fade-in transition-all duration-200">
          {activeTab === "agent" && (
            <AgentTab onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)} />
          )}

          {activeTab === "flows" && <FlowsTab />}

          {activeTab === "operations" && <OperationsTab />}

          {activeTab === "evolution" && <EvolutionTab />}
        </main>
      </div>

      {/* Voice Studio Drawer */}
      <VoiceStudioDrawer
        open={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
      />
    </div>
  );
}
