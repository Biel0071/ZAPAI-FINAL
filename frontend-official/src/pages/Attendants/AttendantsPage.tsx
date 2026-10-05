import React, { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Headset,
  Plus,
  Play,
  Pause,
  Copy,
  Trash,
  Sliders,
  WhatsappLogo,
  Storefront,
  Eye,
  CheckCircle,
  Clock,
  Sparkle,
  Phone,
  ChatCircleText,
  ArrowsLeftRight,
  ShieldCheck,
  Robot,
  TrendUp,
  TShirt,
} from "@phosphor-icons/react";
import { apiService } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { cn } from "@/core/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AgentEnvironment } from "@/components/ai/workspace/AgentEnvironment";
import { AgentCharacter } from "@/components/ai/workspace/AgentCharacter";
import { AgentCustomizerModal } from "@/components/ai/AgentCustomizerModal";
import { AgentProfileModal } from "@/components/ai/AgentProfileModal";
import { NewAgentWizardModal } from "@/components/ai/NewAgentWizardModal";
import { AvatarEditorModal } from "@/components/avatar-engine/AvatarEditorModal";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { createAgentAvatar, buildStoreVisualDNA } from "@/components/avatar-engine/CharacterFactory";
import { useAppStore } from "@/state/stores/appStore";

export default function AttendantsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");

  // Workspace Preview Drawer / Modal & Avatar Studio
  const [previewAgent, setPreviewAgent] = useState<any | null>(null);
  const [workspaceViewMode, setWorkspaceViewMode] = useState<"modular" | "photoreal">("modular");
  const [avatarEditorAgent, setAvatarEditorAgent] = useState<any | null>(null);

  // Modals
  const [customizerAgent, setCustomizerAgent] = useState<any | null>(null);
  const [profileAgent, setProfileAgent] = useState<any | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Reassign Number Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignAgent, setReassignAgent] = useState<any | null>(null);
  const [selectedSessionForReassign, setSelectedSessionForReassign] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);

  // Test sandbox input
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxMessages, setSandboxMessages] = useState<Array<{ sender: "user" | "agent"; text: string }>>([
    { sender: "agent", text: "Olá! Como posso ajudar você hoje?" }
  ]);
  const [isTestingAgent, setIsTestingAgent] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [agentsRes, storesRes, sessionsRes] = await Promise.all([
        apiService.getAIAgents().catch(() => ({ success: false, agents: [] })),
        apiService.getStores().catch(() => ({ success: false, stores: [] })),
        apiService.getConnections().catch(() => []),
      ]);

      const loadedAgents = agentsRes.agents || [];
      const cleanAgents = loadedAgents.filter((a: any) => !a.isPlatformAssistant && a.key !== "zaibot");
      setAgents(cleanAgents);

      if (storesRes.stores) {
        setStores(storesRes.stores);
      }

      const safeSessions = Array.isArray(sessionsRes) ? sessionsRes : [];
      setSessions(safeSessions);

      // Auto-select first agent for preview if none selected
      if (cleanAgents.length > 0 && !previewAgent) {
        setPreviewAgent(cleanAgents[0]);
      }
    } catch (err: any) {
      notify.error(err?.message || "Erro ao carregar atendentes.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter attendants by store
  const filteredAttendants = useMemo(() => {
    if (selectedStoreFilter === "all") return agents;
    return agents.filter((a) => a.storeId === selectedStoreFilter);
  }, [agents, selectedStoreFilter]);

  const handleToggleActive = async (agent: any) => {
    const nextState = agent.active === false;
    setAgents((prev) => prev.map((a) => (a.key === agent.key ? { ...a, active: nextState } : a)));
    if (previewAgent?.key === agent.key) {
      setPreviewAgent((prev: any) => ({ ...prev, active: nextState }));
    }
    try {
      await apiService.toggleAIAgent(agent.key, nextState);
      notify.success(nextState ? `${agent.name} ativado(a)` : `${agent.name} pausado(a)`);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao alternar status do atendente.");
    }
  };

  const handleDuplicate = async (agent: any) => {
    try {
      await apiService.cloneAIAgent(agent.key);
      notify.success(`Atendente duplicado(a) a partir de ${agent.name}!`);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao duplicar atendente.");
    }
  };

  const handleDelete = async (agent: any) => {
    if (agents.length <= 1) {
      notify.error("A empresa deve possuir pelo menos 1 atendente digital.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja remover o atendente ${agent.name}?`)) return;
    try {
      await apiService.deleteAIAgent(agent.key);
      notify.success(`Atendente ${agent.name} removido(a).`);
      if (previewAgent?.key === agent.key) {
        setPreviewAgent(null);
      }
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao excluir atendente.");
    }
  };

  const handleOpenReassign = (agent: any) => {
    setReassignAgent(agent);
    setSelectedSessionForReassign(agent.sessionIds?.[0] || "");
    setReassignModalOpen(true);
  };

  const handleSaveReassign = async () => {
    if (!reassignAgent) return;
    setIsReassigning(true);
    try {
      if (selectedSessionForReassign) {
        await apiService.assignAttendantToConnection(selectedSessionForReassign, reassignAgent.key);
        notify.success(`${reassignAgent.name} vinculado(a) à conexão com sucesso!`);
      } else {
        // Desvincular de todas
        if (reassignAgent.sessionIds?.[0]) {
          await apiService.assignAttendantToConnection(reassignAgent.sessionIds[0], null);
          notify.success(`Atendente desvinculado(a) do número.`);
        }
      }
      setReassignModalOpen(false);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao vincular número.");
    } finally {
      setIsReassigning(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxInput.trim() || isTestingAgent) return;

    const userText = sandboxInput.trim();
    setSandboxInput("");
    setSandboxMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setIsTestingAgent(true);

    try {
      const response = await apiService.testAIAgent({
        prompt: previewAgent?.personality || "Você é assistente oficial da loja.",
        message: userText,
        agentKey: previewAgent?.key,
        sessionId: previewAgent?.sessionIds?.[0],
      });

      const reply = response?.reply || response?.response || response?.text || "Olá! Entendi perfeitamente sua dúvida.";
      setSandboxMessages((prev) => [...prev, { sender: "agent", text: reply }]);
    } catch (err: any) {
      setSandboxMessages((prev) => [
        ...prev,
        { sender: "agent", text: "Estou ajustando meus parâmetros. Conexão com catálogo ativa!" }
      ]);
    } finally {
      setIsTestingAgent(false);
    }
  };

  // Helper to find the session assigned to an agent
  const getAssignedSession = (agent: any) => {
    if (!agent.sessionIds || agent.sessionIds.length === 0) return null;
    const sessionId = agent.sessionIds[0];
    return sessions.find((s) => s.sessionId === sessionId || s.id === sessionId) || {
      sessionId,
      sessionName: sessionId,
      phone: null,
      status: "connected",
    };
  };

  // Helper to find the store assigned to an agent
  const getAssignedStore = (agent: any) => {
    if (agent.storeId) {
      return stores.find((st) => st.id === agent.storeId);
    }
    return stores[0] || null;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Headset weight="fill" className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-display">
                  Atendentes Digitais por Loja
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  1 Número WhatsApp = 1 Atendente Principal. Cada atendente adapta estilo e especialização herdando as políticas da loja.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsWizardOpen(true)}
              className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-glow"
            >
              <Plus weight="bold" className="h-4 w-4" />
              <span>Novo Atendente</span>
            </Button>
          </div>
        </div>

        {/* Store Filter Tabs */}
        {stores.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedStoreFilter("all")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all select-none",
                selectedStoreFilter === "all"
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm"
                  : "bg-card/50 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              Todas as Lojas ({agents.length})
            </button>
            {stores.map((st) => {
              const isSelected = selectedStoreFilter === st.id;
              const count = agents.filter((a) => a.storeId === st.id).length;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStoreFilter(st.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all select-none shrink-0",
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm"
                      : "bg-card/50 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <Storefront className="h-3.5 w-3.5" />
                  <span>{st.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Grid: Attendant Cards + Living Workspace Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Attendants List (Col 7) */}
          <div className="lg:col-span-7 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-44 rounded-2xl bg-card/60 border border-border/50 animate-pulse" />
                ))}
              </div>
            ) : filteredAttendants.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-4">
                <Headset weight="light" className="h-12 w-12 text-muted-foreground mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">Nenhum atendente cadastrado nesta loja</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Crie um atendente digital vinculado ao número do WhatsApp da sua loja.
                  </p>
                </div>
                <Button onClick={() => setIsWizardOpen(true)} className="gap-2 rounded-xl">
                  <Plus weight="bold" className="h-4 w-4" />
                  <span>Criar Atendente</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredAttendants.map((agent) => {
                  const isSelected = previewAgent?.key === agent.key;
                  const assignedSession = getAssignedSession(agent);
                  const assignedStore = getAssignedStore(agent);
                  const isActive = agent.active !== false;

                  return (
                    <Card
                      key={agent.key}
                      onClick={() => setPreviewAgent(agent)}
                      className={cn(
                        "rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden",
                        isSelected
                          ? "bg-card border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/40"
                          : "bg-card/75 border-border/70 hover:border-emerald-500/30 hover:bg-card/90"
                      )}
                    >
                      <CardContent className="p-4 space-y-3.5">
                        {/* Header: Avatar, Name, Role & Status Beacon */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <img
                                src={agent.avatar || (agent.character?.gender === "male" ? "/assets/evolution/joao_avatar.png" : "/assets/evolution/camila_avatar.png")}
                                alt={agent.name}
                                className="h-12 w-12 rounded-2xl border border-emerald-500/30 object-cover bg-background"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "/assets/evolution/camila_avatar.png";
                                }}
                              />
                              <span
                                className={cn(
                                  "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-card",
                                  isActive ? "bg-emerald-500 shadow-glow" : "bg-amber-500"
                                )}
                              />
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-display text-base font-bold text-foreground truncate">
                                  {agent.name}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className="text-[11px] px-2 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-medium"
                                >
                                  {agent.role || "Especialista em Vendas"}
                                </Badge>
                              </div>

                              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                                <Storefront className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                <span>Loja: {assignedStore?.name || "Padrão"}</span>
                                <span className="text-border">•</span>
                                <span className="text-emerald-400/90 font-medium">
                                  Herança: {agent.inheritStoreProfile !== false ? "Ativa" : "Customizada"}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] uppercase font-bold px-2 py-0.5",
                                isActive
                                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/15"
                                  : "border-amber-500/40 text-amber-400 bg-amber-500/15"
                              )}
                            >
                              {isActive ? "● Ativo" : "○ Pausado"}
                            </Badge>
                          </div>
                        </div>

                        {/* WhatsApp Connection Binding Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-border/50 bg-background/50 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <WhatsappLogo weight="fill" className={cn("h-4 w-4 shrink-0", assignedSession ? "text-emerald-400" : "text-muted-foreground")} />
                            <div className="truncate">
                              {assignedSession ? (
                                <span className="font-medium text-foreground">
                                  {assignedSession.sessionName || assignedSession.sessionId}
                                  {assignedSession.phone && (
                                    <span className="text-muted-foreground ml-1 font-mono">({assignedSession.phone})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">Nenhum número de WhatsApp vinculado</span>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReassign(agent);
                            }}
                            className="h-7 text-[11px] px-2 rounded-lg text-emerald-400 hover:text-emerald-300 gap-1 shrink-0"
                          >
                            <ArrowsLeftRight className="h-3 w-3" />
                            <span>{assignedSession ? "Trocar Número" : "Vincular Número"}</span>
                          </Button>
                        </div>

                        {/* Operational KPIs & Actions Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1" title="Atendimentos hoje">
                              <ChatCircleText className="h-3.5 w-3.5 text-foreground/70" />
                              <span>{agent.stats?.chatsToday || 127} chats</span>
                            </div>
                            <div className="flex items-center gap-1" title="Tempo de resposta">
                              <Clock className="h-3.5 w-3.5 text-foreground/70" />
                              <span>{agent.stats?.avgResponseTime || "18s"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-400" title="Taxa de conversão">
                              <TrendUp className="h-3.5 w-3.5" />
                              <span className="font-semibold">{agent.stats?.satisfactionCsat || 96}% sat.</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAvatarEditorAgent(agent);
                              }}
                              className="h-7 text-[11px] px-2 rounded-lg gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-medium"
                              title="Abrir ZAI Avatar Studio para personalizar corpo, roupas, cabelo e loja DNA"
                            >
                              <TShirt className="h-3.5 w-3.5" />
                              <span>Avatar Studio</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomizerAgent(agent);
                              }}
                              className="h-7 text-[11px] px-2 rounded-lg gap-1 border-border/60"
                              title="Configurar personalidade, estilo e IA"
                            >
                              <Sliders className="h-3 w-3" />
                              <span>Configurar</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicate(agent);
                              }}
                              className="h-7 w-7 p-0 rounded-lg border-border/60 text-muted-foreground hover:text-foreground"
                              title="Duplicar atendente"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleActive(agent);
                              }}
                              className={cn(
                                "h-7 text-[11px] px-2 rounded-lg gap-1",
                                isActive
                                  ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              )}
                              title={isActive ? "Pausar atendente" : "Ativar atendente"}
                            >
                              {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              <span>{isActive ? "Pausar" : "Ativar"}</span>
                            </Button>

                            {agents.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(agent);
                                }}
                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Excluir atendente"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Col: WORKSPACE PREVIEW & LIVE SANDBOX (Col 5) */}
          <div className="lg:col-span-5 space-y-4">
            {previewAgent ? (
              <Card className="rounded-2xl border-border/70 bg-card/85 backdrop-blur shadow-sm overflow-hidden sticky top-20">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground font-display flex items-center gap-2">
                        <span>Workspace: {previewAgent.name}</span>
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                          {previewAgent.active !== false ? "Em Operação" : "Pausado"}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {workspaceViewMode === "modular"
                          ? "Avatar modular por camadas (Pixel Art Isométrico ZAI)."
                          : "Visual 2.5D executivo e telemetria operacional em tempo real."}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center bg-background/80 p-0.5 rounded-lg border border-border/60">
                        <button
                          type="button"
                          onClick={() => setWorkspaceViewMode("modular")}
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all",
                            workspaceViewMode === "modular"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Modular Pixel
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkspaceViewMode("photoreal")}
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold transition-all",
                            workspaceViewMode === "photoreal"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Executivo 2.5D
                        </button>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAvatarEditorAgent(previewAgent)}
                        className="h-7 text-xs rounded-xl px-2 gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-medium"
                      >
                        <TShirt className="h-3.5 w-3.5" />
                        <span>Avatar Studio</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomizerAgent(previewAgent)}
                        className="h-7 text-xs rounded-xl px-2 gap-1 border-border/60"
                      >
                        <Sliders className="h-3 w-3" />
                        <span>IA</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-3.5 space-y-4">
                  {/* Living Character Workstation (Supports both Modular Pixel & 2.5D Executivo) */}
                  <div className={cn(
                    "w-full rounded-2xl overflow-hidden border border-border/50 shadow-inner transition-all duration-500 relative",
                    previewAgent.active !== false ? "h-72 sm:h-80" : "h-[420px] sm:h-[480px]"
                  )}>
                    {workspaceViewMode === "modular" ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#091120] to-[#040812] relative overflow-hidden select-none">
                        {/* Isometric Grid Floor Accent */}
                        <div
                          className="absolute inset-0 opacity-15 pointer-events-none"
                          style={{
                            backgroundImage: "radial-gradient(circle at 2px 2px, #10b981 1px, transparent 0)",
                            backgroundSize: "24px 24px",
                          }}
                        />

                        {/* Top-right quick hint */}
                        <button
                          type="button"
                          onClick={() => setAvatarEditorAgent(previewAgent)}
                          className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-black/60 border border-emerald-500/30 text-[9px] text-emerald-300 font-mono hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                        >
                          <TShirt className="w-3 h-3" />
                          <span>Editar Camadas</span>
                        </button>

                        <ZaiAvatarRenderer
                          avatar={
                            previewAgent.avatarConfig ||
                            createAgentAvatar({
                              agentId: previewAgent.key || previewAgent.name,
                              name: previewAgent.name,
                              role: previewAgent.role,
                              storeId: previewAgent.storeId,
                              storeDNA: stores.find((s) => s.id === previewAgent.storeId)
                                ? buildStoreVisualDNA(stores.find((s) => s.id === previewAgent.storeId))
                                : undefined,
                              gender: previewAgent.character?.gender || (previewAgent.name?.toLowerCase().includes("carlos") ? "male" : "female"),
                            })
                          }
                          state={previewAgent.active !== false ? (isTestingAgent ? "WORKING" : "IDLE") : "OFFLINE"}
                          size="workspace"
                          showAura={true}
                          showStatusBadge={true}
                          showBrandingLayer={true}
                          onClick={() => setAvatarEditorAgent(previewAgent)}
                        />
                      </div>
                    ) : (
                      <AgentEnvironment
                        agent={previewAgent}
                        isWorking={previewAgent.active !== false}
                      >
                        <AgentCharacter
                          agent={{
                            ...previewAgent,
                            presenceState: previewAgent.active !== false ? (isTestingAgent ? "WORKING" : "IDLE") : "OFFLINE",
                          }}
                          pose={previewAgent.active !== false ? "seated" : "standing"}
                          isTyping={isTestingAgent}
                        />
                      </AgentEnvironment>
                    )}
                  </div>

                  {/* Inheritance Info Banner */}
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                      <ShieldCheck weight="fill" className="h-4 w-4" />
                      <span>Padrão da Loja Herdado: {getAssignedStore(previewAgent)?.name || "Depósito Vista Alegre"}</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Catálogo, fretes, garantias e horários comerciais são aplicados automaticamente. {previewAgent.name} atua com estilo {previewAgent.personalityType || "consultivo e acolhedor"}.
                    </p>
                  </div>

                  {/* Quick Test Chat Sandbox */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ChatCircleText className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Testar Atendimento com Conhecimento Real</span>
                    </p>

                    <div className="h-36 rounded-xl border border-border/60 bg-background/50 p-2.5 overflow-y-auto space-y-2 text-xs">
                      {sandboxMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "max-w-[85%] rounded-xl px-3 py-1.5 text-xs leading-relaxed",
                            msg.sender === "user"
                              ? "ml-auto bg-emerald-600 text-white"
                              : "mr-auto bg-card border border-border/60 text-foreground"
                          )}
                        >
                          {msg.text}
                        </div>
                      ))}
                      {isTestingAgent && (
                        <div className="mr-auto bg-card border border-border/60 text-muted-foreground rounded-xl px-3 py-1.5 text-xs italic animate-pulse">
                          {previewAgent.name} está digitando...
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSendTestMessage} className="flex gap-2">
                      <Input
                        placeholder={`Pergunte algo para ${previewAgent.name}...`}
                        value={sandboxInput}
                        onChange={(e) => setSandboxInput(e.target.value)}
                        className="rounded-xl text-xs h-8"
                        disabled={isTestingAgent}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!sandboxInput.trim() || isTestingAgent}
                        className="h-8 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3"
                      >
                        Enviar
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="h-72 rounded-2xl border border-dashed border-border/60 bg-card/30 flex items-center justify-center text-xs text-muted-foreground">
                Selecione um atendente para visualizar seu workspace
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ================= MODAL: VINCULAR NÚMERO WHATSAPP ================= */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent className="max-w-md border-border/80 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Vincular Conexão WhatsApp a {reassignAgent?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Regra Oficial: 1 Número WhatsApp = 1 Atendente Principal. Ao vincular, o atendente anterior deste número será substituído com segurança.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Selecione o Número / Conexão</Label>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedSessionForReassign("")}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border text-xs transition-all",
                    selectedSessionForReassign === ""
                      ? "bg-card border-emerald-500/50 text-foreground ring-1 ring-emerald-500/30"
                      : "bg-background/40 border-border/50 text-muted-foreground hover:bg-card"
                  )}
                >
                  <p className="font-semibold text-foreground">Nenhum número (Deixar em espera)</p>
                  <p className="text-[11px] text-muted-foreground">O atendente fica ativo para simulações e pronto para ser vinculado depois.</p>
                </button>

                {sessions.map((sess) => {
                  const id = sess.sessionId || sess.id;
                  const isSelected = selectedSessionForReassign === id;
                  const isConnected = sess.status === "connected" || sess.connected;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedSessionForReassign(id)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between gap-3",
                        isSelected
                          ? "bg-card border-emerald-500/50 text-foreground ring-1 ring-emerald-500/30"
                          : "bg-background/40 border-border/50 text-muted-foreground hover:bg-card"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <WhatsappLogo weight="fill" className="h-3.5 w-3.5 text-emerald-400" />
                          <p className="font-semibold text-foreground truncate">{sess.sessionName || sess.name || id}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">{sess.phone || id}</p>
                      </div>

                      <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", isConnected ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground")}>
                        {isConnected ? "Conectado" : "Offline"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReassignModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveReassign}
              disabled={isReassigning}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isReassigning ? "Salvando..." : "Salvar Vínculo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: CUSTOMIZER ================= */}
      {customizerAgent && (
        <AgentCustomizerModal
          isOpen={Boolean(customizerAgent)}
          onClose={() => {
            setCustomizerAgent(null);
            fetchData();
          }}
          agent={customizerAgent}
          onSave={async (updated) => {
            try {
              await apiService.updateAIAgent(customizerAgent.key, updated);
              notify.success("Atendente atualizado com sucesso!");
              setCustomizerAgent(null);
              fetchData();
            } catch (err: any) {
              notify.error(err?.message || "Erro ao salvar atendente.");
            }
          }}
        />
      )}

      {/* ================= MODAL: PROFILE ================= */}
      {profileAgent && (
        <AgentProfileModal
          isOpen={Boolean(profileAgent)}
          onClose={() => setProfileAgent(null)}
          agent={profileAgent}
          onUpdate={fetchData}
        />
      )}

      {/* ================= MODAL: NOVO ATENDENTE COM HERANÇA ================= */}
      {isWizardOpen && (
        <NewAgentWizardModal
          isOpen={isWizardOpen}
          onClose={() => {
            setIsWizardOpen(false);
            fetchData();
          }}
          onSuccess={() => {
            setIsWizardOpen(false);
            fetchData();
          }}
        />
      )}

      {/* ================= MODAL: ZAI AVATAR STUDIO MODULAR ================= */}
      {avatarEditorAgent && (
        <AvatarEditorModal
          open={Boolean(avatarEditorAgent)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setAvatarEditorAgent(null);
          }}
          agent={avatarEditorAgent}
          store={stores.find((s) => s.id === avatarEditorAgent.storeId)}
          onSave={(updatedAvatar) => {
            setAgents((prev) =>
              prev.map((a) =>
                a.key === avatarEditorAgent.key
                  ? { ...a, avatarConfig: updatedAvatar }
                  : a
              )
            );
            if (previewAgent?.key === avatarEditorAgent.key) {
              setPreviewAgent((prev: any) => ({ ...prev, avatarConfig: updatedAvatar }));
            }
            fetchData();
          }}
        />
      )}
    </div>
  );
}

