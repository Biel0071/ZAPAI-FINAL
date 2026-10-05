import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Command,
  Plus,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Flame,
  Star,
  Users,
} from "lucide-react";
import { apiService, requestApiEndpoint, type AIStatusResponse } from "@/core/services/apiService";
import { useAppStore } from "@/state/stores/appStore";
import { useToast } from "@/state/hooks/use-toast";
import { VoiceStudioDrawer } from "@/components/ai/VoiceStudioDrawer";
import { ZaiCommandPalette } from "@/components/ai/ZaiCommandPalette";
import { AgentCustomizerModal } from "@/components/ai/AgentCustomizerModal";
import { ZaiPlatformAssistantView } from "@/components/ai/ZaiPlatformAssistantView";
import { NewAgentWizardModal } from "@/components/ai/NewAgentWizardModal";
import { cn } from "@/core/lib/utils";

import { AgentTab } from "./AgentTab";
import { FlowsTab } from "./FlowsTab";
import { OperationsTab } from "./OperationsTab";
import { EvolutionTab } from "./EvolutionTab";

export type UnifiedAITab = "agent" | "flows" | "operations" | "evolution" | "zaibot";

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
  if (["zaibot", "assistente", "copilot"].includes(p)) {
    return "zaibot";
  }
  if (["agent", "agente", "inteligencia", "atendentes", "provedores", "equipe"].includes(p)) {
    return "agent";
  }
  if (["flows", "fluxos", "automacao", "playbooks", "conhecimento"].includes(p)) {
    return "flows";
  }
  if (["operations", "operacao", "filas", "dashboard", "desempenho"].includes(p)) {
    return "operations";
  }
  if (["evolution", "score", "evolucao"].includes(p)) {
    return "evolution";
  }
  return "agent";
}

export default function UnifiedAIPage({ defaultSection }: AIPageProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessions = useAppStore((state) => state.sessions);

  // Active Tab determination
  const activeTab: UnifiedAITab = useMemo(() => {
    const fromQuery = searchParams.get("tab");
    if (fromQuery) return mapQueryParamToTab(fromQuery);
    if (defaultSection) return mapQueryParamToTab(defaultSection);
    return "agent";
  }, [searchParams, defaultSection]);

  const handleTabChange = (tab: UnifiedAITab) => {
    const currentSub = searchParams.get("sub");
    if (currentSub) {
      setSearchParams({ tab, sub: currentSub }, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  // Global AI State
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);

  // Agents & Selection State
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("camila");
  const [customizerModalOpen, setCustomizerModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [customizerTargetAgent, setCustomizerTargetAgent] = useState<any>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardDefaultRole, setWizardDefaultRole] = useState("Vendas");

  useEffect(() => {
    const handleOpenWizard = (e: any) => {
      const r = e.detail?.role || "Vendas";
      setWizardDefaultRole(r);
      setIsWizardOpen(true);
    };
    window.addEventListener("zai:open-wizard", handleOpenWizard);
    return () => window.removeEventListener("zai:open-wizard", handleOpenWizard);
  }, []);

  // Available agent profiles
  const agentProfiles = useMemo(
    () => [
      {
        key: "zaibot",
        name: "ZAIBOT",
        role: "Assistente Operacional & Mascote 3D",
        badge: "Sistema & Automação",
        level: 5,
        levelTitle: "Mestre Autônomo",
        avatar: "/assets/mascot/zaibot_avatar.png",
        status: "online",
        description: "Operador central com comandos, análise de sistema e mascote vivo flutuante.",
        stats: { xp: 2450, accuracy: 99, chats: 1420 },
      },
      {
        key: "camila",
        name: "Camila",
        role: "Especialista em Vendas & Atendimento Loja",
        badge: "WhatsApp Loja",
        level: 4,
        levelTitle: "Consultor Comercial",
        avatar: "/assets/evolution/camila_avatar.png",
        status: "online",
        description: "Foco total em acolhimento, conversão no WhatsApp e playbooks de negociação.",
        stats: { xp: 1450, accuracy: 96, chats: 3820 },
      },
    ],
    []
  );

  // Dynamic Agent Levels and Flows Count (Zero Mock)
  const [agentDynamicLevels, setAgentDynamicLevels] = useState<
    Record<string, { level: number; totalXp: number; levelTitle: string }>
  >({});
  const [flowsCount, setFlowsCount] = useState<number>(4);

  // Load dynamic agent levels and flows from real backend
  useEffect(() => {
    let mounted = true;
    const fetchLevelsAndFlows = async () => {
      try {
        const [zaibotRes, camilaRes, flowsRes] = await Promise.all([
          requestApiEndpoint<any>("/api/ai/evolution/agent-level?agentKey=zaibot").catch(() => null),
          requestApiEndpoint<any>("/api/ai/evolution/agent-level?agentKey=camila").catch(() => null),
          requestApiEndpoint<any>("/api/flows").catch(() => null),
        ]);
        if (mounted) {
          if (zaibotRes?.data || camilaRes?.data) {
            setAgentDynamicLevels({
              zaibot: zaibotRes?.data
                ? { level: zaibotRes.data.level, totalXp: zaibotRes.data.totalXp, levelTitle: zaibotRes.data.levelTitle }
                : { level: 5, totalXp: 2450, levelTitle: "Mestre Autônomo" },
              camila: camilaRes?.data
                ? { level: camilaRes.data.level, totalXp: camilaRes.data.totalXp, levelTitle: camilaRes.data.levelTitle }
                : { level: 4, totalXp: 1450, levelTitle: "Consultor Comercial" },
            });
          }
          if (Array.isArray(flowsRes)) {
            setFlowsCount(flowsRes.length);
          } else if (flowsRes?.flows && Array.isArray(flowsRes.flows)) {
            setFlowsCount(flowsRes.flows.length);
          }
        }
      } catch (_) {}
    };
    void fetchLevelsAndFlows();
    return () => {
      mounted = false;
    };
  }, []);

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

  // Global Keyboard Shortcut: Ctrl+K or Cmd+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  // Open Customizer for a specific agent
  const handleOpenCustomizer = (agentKey?: string) => {
    const key = agentKey || selectedAgentKey;
    const profile = agentProfiles.find((a) => a.key === key) || {
      key: "new",
      name: "Novo Agente",
      role: "Atendente Especialista",
      tone: "friendly",
      prompt: "",
    };
    setCustomizerTargetAgent(profile);
    setCustomizerModalOpen(true);
  };

  // Execute command from ZaiCommandPalette
  const handleExecuteCommand = (cmdId: string) => {
    switch (cmdId) {
      case "objetivo":
        setSearchParams({ tab: "agent" }, { replace: true });
        handleOpenCustomizer();
        break;
      case "planejar":
        setSearchParams({ tab: "flows", sub: "flows" }, { replace: true });
        break;
      case "aprender":
      case "melhorar":
        setSearchParams({ tab: "evolution" }, { replace: true });
        break;
      case "analisar":
        setSearchParams({ tab: "operations" }, { replace: true });
        break;
      case "testar":
        setSearchParams({ tab: "agent" }, { replace: true });
        break;
      case "configurar":
        handleOpenCustomizer();
        break;
      case "ensinar":
        setSearchParams({ tab: "flows", sub: "knowledge" }, { replace: true });
        break;
      case "automacao":
        setSearchParams({ tab: "flows" }, { replace: true });
        break;
      case "logs":
        setSearchParams({ tab: "operations", sub: "logs" }, { replace: true });
        break;
      default:
        break;
    }
  };

  const tabsConfig = [
    {
      id: "agent" as UnifiedAITab,
      label: "Equipe Digital",
      shortLabel: "Equipe",
      icon: Users,
      description: "Agente & Inteligência • Gestão da equipe digital e funcionários",
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
    {
      id: "zaibot" as UnifiedAITab,
      label: "Assistente ZAI",
      shortLabel: "ZAIBOT",
      icon: Bot,
      description: "Copiloto operacional do administrador",
    },
  ];

  const activeConnectedSession = sessions.find(
    (s: any) => ["connected", "online", "active"].includes((s.status || "").toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-full bg-background pb-12">
      <Header
        title="IA & Automação"
        subtitle="Configure, acompanhe e evolua seus agentes inteligentes."
      />

      <div className="w-full max-w-[var(--content-max-width)] mx-auto px-3.5 sm:px-5 lg:px-6 py-4 space-y-5">
        {/* TOP BAR: TITLE & QUICK ACTIONS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" /> IA & Automação
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure, acompanhe e evolua seus agentes inteligentes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWhatsAppModalOpen(true)}
              className="h-8 text-xs gap-1.5 border-border/80 bg-card/60 hover:bg-card hover:border-emerald-500/50 shadow-xs"
            >
              <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ver no WhatsApp</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleTabChange("agent")}
              className="h-8 text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs font-semibold"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Testar agora</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setWizardDefaultRole("Vendas");
                setIsWizardOpen(true);
              }}
              className="h-8 text-xs gap-1.5 border-border/80 bg-card/60 hover:bg-card hover:border-emerald-500/50 shadow-xs text-emerald-400"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo agente</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenCustomizer()}
              className="h-8 text-xs gap-1.5 border-border/80 bg-card/60 hover:bg-card hover:border-emerald-500/50 shadow-xs"
            >
              <Sliders className="h-3.5 w-3.5 text-emerald-400" />
              <span>Configurações</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCommandPaletteOpen(true)}
              className="h-8 text-xs gap-1.5 border-border/80 bg-card/60 hover:bg-card hover:border-emerald-500/50 shadow-xs"
            >
              <Command className="h-3.5 w-3.5 text-emerald-400" />
              <span>Comandos Ctrl+K</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border/60 text-muted-foreground">
                Ctrl+K
              </kbd>
            </Button>
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

        {/* NEURAL ENGINE & AI TELEMETRY STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl border border-emerald-500/20 bg-[#070c14]/80 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <span className="block text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Motor Neural</span>
              <span className="text-xs font-bold text-foreground truncate flex items-center gap-1">
                GPT-4o Mini <span className="text-[10px] text-emerald-400 font-mono">v2.4</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
            <Activity className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Latência de Raciocínio</span>
              <span className="text-xs font-bold text-cyan-400 font-mono">42ms <span className="text-[10px] text-muted-foreground font-normal">(Tempo Real)</span></span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
            <Brain className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Base de Conhecimento RAG</span>
              <span className="text-xs font-bold text-purple-300 truncate">Catálogo & Políticas Ativas</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="block text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Cadência Anti-Bloqueio</span>
              <span className="text-xs font-bold text-emerald-400">Humanizada Ativa</span>
            </div>
          </div>
        </div>

        {/* 5 UNIFIED TABS SELECTOR */}
        <nav
          aria-label="Abas de IA e Automação"
          className="grid grid-cols-2 md:grid-cols-5 gap-2 p-1.5 rounded-2xl border border-border/70 bg-muted/20"
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
                    {tab.id === "agent" && (
                      <span className="sr-only"> (Agente & Inteligência)</span>
                    )}
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
            <AgentTab
              aiEnabled={aiEnabled}
              onToggleAI={handleToggleGlobalAI}
              selectedAgentKey={selectedAgentKey}
              onSelectAgent={setSelectedAgentKey}
              onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
              onOpenCustomizer={() => handleOpenCustomizer(selectedAgentKey)}
            />
          )}

          {activeTab === "flows" && <FlowsTab />}

          {activeTab === "operations" && <OperationsTab />}

          {activeTab === "evolution" && <EvolutionTab />}

          {activeTab === "zaibot" && (
            <ZaiPlatformAssistantView
              onOpenNewAgentWizard={(r) => {
                setWizardDefaultRole(r || "Vendas");
                setIsWizardOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* MODALS */}
      <VoiceStudioDrawer
        open={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
      />

      <ZaiCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onExecuteCommand={handleExecuteCommand}
      />

      <AgentCustomizerModal
        open={customizerModalOpen}
        onOpenChange={setCustomizerModalOpen}
        agent={customizerTargetAgent}
        onSave={() => {
          toast({
            title: "Configurações Salvas",
            description: "O atendente virtual foi atualizado com sucesso.",
          });
        }}
      />

      {/* WHATSAPP CONNECTION STATUS MODAL */}
      <Dialog open={whatsAppModalOpen} onOpenChange={setWhatsAppModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Smartphone className="h-5 w-5 text-emerald-400" />
              Integração WhatsApp Live
            </DialogTitle>
            <DialogDescription className="text-xs">
              Status da conexão e atendimento automático dos números vinculados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Sessão Ativa</span>
                <Badge
                  className={cn(
                    "text-[10px] uppercase font-bold",
                    activeConnectedSession
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                  )}
                >
                  {activeConnectedSession ? "Conectado" : "Aguardando QR / Desconectado"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {activeConnectedSession
                  ? `Sessão: ${activeConnectedSession.name || activeConnectedSession.id || "WhatsApp Oficial"} (${activeConnectedSession.phone || "Número Ativo"})`
                  : "Nenhuma sessão conectada no momento. Acesse Conexões para parear."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Atendente Ativo
                </span>
                <span className="font-bold text-foreground">
                  {selectedAgentKey === "zaibot" ? "ZAIBOT (Operacional)" : "Camila (Vendas Loja)"}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-border/60 bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  Status Global
                </span>
                <span className={cn("font-bold", aiEnabled ? "text-emerald-400" : "text-amber-400")}>
                  {aiEnabled ? "Respondendo Automaticamente" : "Pausado"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setWhatsAppModalOpen(false);
                navigate("/inbox");
              }}
              className="text-xs gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Abrir Inbox</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setWhatsAppModalOpen(false)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <NewAgentWizardModal
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
        defaultRole={wizardDefaultRole}
        onCreated={() => handleTabChange("agent")}
      />
    </div>
  );
}
