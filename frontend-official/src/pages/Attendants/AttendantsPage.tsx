import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  CheckCircle,
  Clock,
  Sparkle,
  ChatCircleText,
  ArrowsLeftRight,
  ShieldCheck,
  Robot,
  TrendUp,
  TShirt,
  ArrowsClockwise,
  Brain,
  Scissors,
  Smiley,
  Eyeglasses,
  FloppyDisk,
} from "@phosphor-icons/react";
import { apiService, type AIMetricsResponse, type AIStatusResponse } from "@/core/services/apiService";
import { useAppStore } from "@/state/stores/appStore";
import { notify } from "@/core/services/notifyService";
import { cn } from "@/core/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ZaiPlatformAssistantView } from "@/components/ai/ZaiPlatformAssistantView";
import { AgentCustomizerModal } from "@/components/ai/AgentCustomizerModal";
import { AgentProfileModal } from "@/components/ai/AgentProfileModal";
import { NewAgentWizardModal } from "@/components/ai/NewAgentWizardModal";
import { AvatarEditorModal } from "@/components/avatar-engine/AvatarEditorModal";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { AttendantItemCard } from "@/components/attendants/AttendantItemCard";
import { AddAttendantCard } from "@/components/attendants/AddAttendantCard";
import { EXAMPLE_ATTENDANTS } from "@/components/attendants/exampleAttendants";
import { Pagination } from "@/components/ui/Pagination";
import { createAgentAvatar, buildStoreVisualDNA, resolveSpriteForAvatar, applyStylePreset } from "@/components/avatar-engine/CharacterFactory";
import {
  AVATAR_HAIRS,
  AVATAR_FACES,
  AVATAR_OUTFITS,
  AVATAR_ACCESSORIES,
  AVATAR_STYLES,
  type AgentAvatarConfig,
} from "@/components/avatar-engine/AvatarDefinition";
const CommercialPanel = React.lazy(() => import("@/components/evolution/HistoryBootstrapPanel").then(module => ({ default: module.HistoryBootstrapPanel })));
const AgentTab = React.lazy(() => import("@/pages/AI/AgentTab").then(module => ({ default: module.AgentTab })));
const EvolutionTab = React.lazy(() => import("@/pages/AI/EvolutionTab").then(module => ({ default: module.EvolutionTab })));
const MemoryView = React.lazy(() => import("@/pages/Memory").then(module => ({ default: module.default })));

export default function AttendantsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: "attendants" | "copilot" | "config" | "memory" | "evolution" =
    rawTab === "copilot"
      ? "copilot"
      : rawTab === "config"
      ? "config"
      : rawTab === "memory"
      ? "memory"
      : rawTab === "evolution"
      ? "evolution"
      : "attendants";

  const handleTabChange = (tab: "attendants" | "copilot" | "config" | "memory" | "evolution") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "attendants") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    });
  };

  const [agents, setAgents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAgent, setPendingAgent] = useState<string | null>(null);
  const [aiStatus, setAIStatus] = useState<AIStatusResponse | null>(null);
  const liveSessions = useAppStore((state) => state.sessions);
  const progress = useAppStore((state) => state.aiProgressByConversationId);
  const requestVersion = useRef(0);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");
  const selectedWhatsApp = searchParams.get("sessionId") || "";
  const [switchingAttendant, setSwitchingAttendant] = useState(false);
  const [commercialOpen, setCommercialOpen] = useState(searchParams.get("section") === "business");
  useEffect(() => { if (searchParams.get("section") === "business") setCommercialOpen(true); }, [searchParams]);
  const selectWhatsApp = (sessionId: string) => setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (sessionId) next.set("sessionId", sessionId); else next.delete("sessionId");
    return next;
  });
  useEffect(() => {
    const storeId = searchParams.get("storeId");
    if (selectedWhatsApp || !storeId) return;
    const sessionId = stores.find(store => store.id === storeId)?.numbers?.[0]?.sessionId;
    if (sessionId) setSearchParams(current => { const next = new URLSearchParams(current); next.set("sessionId", sessionId); return next; }, { replace: true });
  }, [stores, searchParams, selectedWhatsApp, setSearchParams]);

  // Workspace Preview Drawer / Modal & Avatar Studio
  const [previewAgent, setPreviewAgent] = useState<any | null>(null);
  const [avatarEditorAgent, setAvatarEditorAgent] = useState<any | null>(null);

  // Modals
  const [customizerAgent, setCustomizerAgent] = useState<any | null>(null);
  const [profileAgent, setProfileAgent] = useState<any | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setIsWizardOpen(true);
    setSearchParams(current => { const next = new URLSearchParams(current); next.delete("new"); return next; }, { replace: true });
  }, [searchParams, setSearchParams]);

  // Reassign Number Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignAgent, setReassignAgent] = useState<any | null>(null);
  const [selectedSessionForReassign, setSelectedSessionForReassign] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);

  // Test sandbox & interactive console (Chat / Evolution / Real Sync)
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxMessages, setSandboxMessages] = useState<Array<{ sender: "user" | "agent"; text: string }>>([]);
  const [isTestingAgent, setIsTestingAgent] = useState(false);
  const [sessionMetrics, setSessionMetrics] = useState<AIMetricsResponse | null>(null);
  const [sandboxTab, setSandboxTab] = useState<"chat" | "evolution" | "sync">("chat");
  const [evolutionData, setEvolutionData] = useState<any>(null);
  const [realConversations, setRealConversations] = useState<any[]>([]);
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const selectedAgentKey = useRef(previewAgent?.key);
  const testVersion = useRef(0);
  selectedAgentKey.current = previewAgent?.key;

  const fetchData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoadError(null);
    try {
      const [agentsRes, storesRes, sessionsRes, statusRes] = await Promise.all([
        apiService.getAIAgents(),
        apiService.getStores(),
        apiService.getConnections({ throwOnError: true }),
        apiService.getAIStatus(true),
      ]);
      if (version !== requestVersion.current) return;
      if (agentsRes.success === false || storesRes.success === false) throw new Error("Não foi possível carregar os dados da operação.");
      const loadedAgents = agentsRes.agents || [];
      const cleanAgents = loadedAgents.filter((a: any) => !a.isPlatformAssistant && a.key !== "zaibot");
      setAgents(cleanAgents);

      if (storesRes.stores) {
        setStores(storesRes.stores);
      }

      const safeSessions = Array.isArray(sessionsRes) ? sessionsRes : [];
      setSessions(safeSessions);
      setAIStatus(statusRes.data || statusRes);
      setPreviewAgent((current: any) => cleanAgents.find((agent: any) => agent.key === current?.key) || cleanAgents[0] || null);
    } catch (err: any) {
      if (version === requestVersion.current) setLoadError(err?.message || "Erro ao carregar atendentes.");
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    return () => { requestVersion.current += 1; };
  }, [fetchData]);

  const getAssignedSession = (agent: any) => {
    if (selectedWhatsApp) {
      const saved = sessions.find(s => (s.sessionId || s.id) === selectedWhatsApp);
      const live = liveSessions.find(s => s.id === selectedWhatsApp);
      return saved ? { ...saved, sessionId: selectedWhatsApp, sessionName: saved.sessionName || selectedWhatsApp, status: live?.status || saved.status || "unknown" } : null;
    }
    const filteredStore = stores.find(store => store.id === selectedStoreFilter);
    const sessionId = agent?.sessionIds?.find((id: string) => filteredStore?.numbers?.some((number: any) => number.sessionId === id)) || agent?.sessionIds?.[0];
    if (!sessionId) return null;
    const saved = sessions.find((s) => s.sessionId === sessionId || s.id === sessionId);
    const live = liveSessions.find((s) => s.id === sessionId);
    return { ...saved, sessionId, sessionName: saved?.sessionName || sessionId, status: live?.status || saved?.status || "unknown" };
  };

  const getAssignedStore = (agent: any) => {
    const session = getAssignedSession(agent);
    if (session) return stores.find((store) => store.numbers?.some((number: any) => number.sessionId === session.sessionId)) || null;
    return stores.find((store) => store.id === agent?.storeId) || null;
  };

  const getPresence = (agent: any) => {
    const session = getAssignedSession(agent);
    if (agent.active === false) return { label: "Pausado", state: "WAITING" as const };
    if (!session) return { label: "Sem WhatsApp", state: "WAITING" as const };
    if (session.status !== "connected" && session.status !== "open") return { label: "WhatsApp desconectado", state: "OFFLINE" as const };
    if (aiStatus?.active === false || (aiStatus?.enabled ?? aiStatus?.ai) === false) return { label: "IA em espera", state: "WAITING" as const };
    const operation = Object.values(progress).find((item) => item.sessionId === session.sessionId && (!item.agentName || item.agentName === agent.name) && ["analyzing", "generating", "typing", "sending", "queued", "waiting"].includes(item.status));
    if (operation?.status === "typing" || operation?.status === "sending") return { label: "Conversando", state: "TYPING" as const };
    if (operation?.status === "analyzing" || operation?.status === "generating") return { label: "Preparando resposta", state: "WORKING" as const };
    return { label: "Aguardando conversa", state: "WAITING" as const };
  };

  const previewSession = getAssignedSession(previewAgent);
  const previewStore = getAssignedStore(previewAgent);
  const previewPresence = previewAgent ? getPresence(previewAgent) : null;

  useEffect(() => {
    let cancelled = false;
    setSessionMetrics(null);
    setSandboxMessages([]);
    setSandboxInput("");
    testVersion.current += 1;
    setIsTestingAgent(false);
    apiService.getAIMetrics(previewSession?.sessionId || undefined).then((metrics) => {
      if (!cancelled) setSessionMetrics(metrics.data || metrics);
    }).catch(() => { /* unavailable metrics stay empty */ });
    return () => { cancelled = true; };
  }, [previewAgent?.key, previewSession?.sessionId]);

  function formatTokens(tokens: number): string {
    if (!tokens || isNaN(tokens)) return "0";
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(tokens);
  }

  // Inline 5-category Avatar Studio state
  const [studioCategory, setStudioCategory] = useState<"hair" | "face" | "outfit" | "accessories" | "style">("hair");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  const handleUpdateAvatar = useCallback((overrides: Partial<AgentAvatarConfig>) => {
    if (!previewAgent) return;
    const baseConfig: AgentAvatarConfig = previewAgent.avatarConfig || createAgentAvatar({
      agentId: previewAgent.key || previewAgent.name,
      name: previewAgent.name,
      role: previewAgent.role,
      storeId: previewStore?.id,
      storeDNA: previewStore ? buildStoreVisualDNA(previewStore) : undefined,
      gender: previewAgent.character?.gender || (previewAgent.name?.toLowerCase().includes("carlos") ? "male" : "female"),
    });

    const updatedConfig: AgentAvatarConfig = { ...baseConfig, ...overrides };
    if (overrides.outfit) updatedConfig.clothing = overrides.outfit;
    if (overrides.clothing) updatedConfig.outfit = overrides.clothing;
    if (overrides.body) updatedConfig.base = overrides.body === "male" ? "male" : "female";
    if (overrides.base) updatedConfig.body = overrides.base === "male" ? "male" : "neutral";

    const updatedSprite = resolveSpriteForAvatar(updatedConfig, true);
    updatedConfig.catalogSpriteId = updatedSprite;
    const avatarUrl = `/assets/avatar_factory/catalog/${updatedSprite}_clean.png`;

    setPreviewAgent((prev: any) => ({
      ...prev,
      avatarConfig: updatedConfig,
      avatar: avatarUrl,
    }));

    if (previewAgent.isExample) return;

    setAgents((prev) =>
      prev.map((a) =>
        a.key === previewAgent.key
          ? { ...a, avatarConfig: updatedConfig, avatar: avatarUrl }
          : a
      )
    );
  }, [previewAgent, previewStore]);

  const handleSaveAvatar = useCallback(async () => {
    if (!previewAgent) return;
    if (previewAgent.isExample) {
      notify.info(`Este perfil é o modelo demonstrativo de ${previewAgent.name}. Clique em 'Criar Atendente' para criar um funcionário digital real para sua loja.`);
      setIsWizardOpen(true);
      return;
    }
    setIsSavingAvatar(true);
    try {
      const configToSave = previewAgent.avatarConfig || createAgentAvatar({
        agentId: previewAgent.key || previewAgent.name,
        name: previewAgent.name,
        role: previewAgent.role,
        storeId: previewStore?.id,
        storeDNA: previewStore ? buildStoreVisualDNA(previewStore) : undefined,
        gender: previewAgent.character?.gender || (previewAgent.name?.toLowerCase().includes("carlos") ? "male" : "female"),
      });
      const spriteId = configToSave.catalogSpriteId || resolveSpriteForAvatar(configToSave, true);
      const fullConfig = {
        ...configToSave,
        hair: previewAgent.avatarConfig?.hair || configToSave.hair,
        face: previewAgent.avatarConfig?.face || configToSave.face || "face_01",
        outfit: previewAgent.avatarConfig?.outfit || previewAgent.avatarConfig?.clothing || configToSave.outfit,
        clothing: previewAgent.avatarConfig?.outfit || previewAgent.avatarConfig?.clothing || configToSave.clothing,
        accessories: previewAgent.avatarConfig?.accessories || configToSave.accessories,
        style: previewAgent.avatarConfig?.style || configToSave.style || "style_vendas",
        catalogSpriteId: spriteId,
      };
      const avatarUrl = `/assets/avatar_factory/catalog/${spriteId}_clean.png`;

      const res = await apiService.updateAgentAvatar(previewAgent.key, {
        avatarConfig: fullConfig,
        avatar: avatarUrl,
      });
      if (res?.success === false) throw new Error(res.message || "Falha ao salvar avatar");

      notify.success(`Avatar de ${previewAgent.name} salvo com sucesso!`);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Não foi possível salvar o avatar.");
    } finally {
      setIsSavingAvatar(false);
    }
  }, [previewAgent, previewStore, fetchData]);

  const activeHairItem = useMemo(() => {
    const hair = previewAgent?.avatarConfig?.hair;
    return AVATAR_HAIRS.find((h) => h.id === hair) || { title: hair || "Cabelo 01" };
  }, [previewAgent?.avatarConfig?.hair]);

  const activeFaceItem = useMemo(() => {
    const face = previewAgent?.avatarConfig?.face;
    return AVATAR_FACES.find((f) => f.id === face) || { title: face || "Rosto 01" };
  }, [previewAgent?.avatarConfig?.face]);

  const activeOutfitItem = useMemo(() => {
    const outfit = previewAgent?.avatarConfig?.outfit || previewAgent?.avatarConfig?.clothing;
    return AVATAR_OUTFITS.find((o) => o.id === outfit) || { title: outfit || "Polo ZAI" };
  }, [previewAgent?.avatarConfig?.outfit, previewAgent?.avatarConfig?.clothing]);

  const activeAccessoryItem = useMemo(() => {
    const cfg = previewAgent?.avatarConfig;
    if (cfg?.headset && cfg.headset !== "none") return "Headset Pro";
    if (cfg?.accessories?.badge && cfg.accessories.badge !== "none") return "Crachá ZAI";
    if (cfg?.glasses && cfg.glasses !== "none") return "Óculos";
    if (cfg?.workObject === "tablet_zai") return "Tablet";
    if (cfg?.accessories?.watch && cfg.accessories.watch !== "none") return "Smartwatch";
    return null;
  }, [previewAgent?.avatarConfig]);

  const activeStyleItem = useMemo(() => {
    const style = previewAgent?.avatarConfig?.style;
    return AVATAR_STYLES.find((s) => s.id === style) || { title: style || "Vendas" };
  }, [previewAgent?.avatarConfig?.style]);

  useEffect(() => {
    let cancelled = false;
    if (previewAgent?.key && typeof apiService.getAgentEvolution === "function") {
      apiService.getAgentEvolution(previewAgent.key)
        .then((res: any) => {
          if (!cancelled && res?.success) setEvolutionData(res.evolution);
        })
        .catch(() => {});
    }
    if (typeof apiService.getConversations === "function") {
      apiService.getConversations(false, { limit: 6 })
        .then((convs: any) => {
          if (!cancelled && Array.isArray(convs)) setRealConversations(convs);
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [previewAgent?.key]);

  const handleSyncRealAttendance = async () => {
    setIsSyncingAttendance(true);
    setSyncStatus(null);
    try {
      if (typeof apiService.syncManualAttendance === "function") {
        const res = await apiService.syncManualAttendance(300);
        const mined = res?.minedCount ?? 0;
        const xp = res?.xpGained ?? 0;
        setSyncStatus(`${mined} conversas sincronizadas • +${xp} XP`);
        notify.success(`${mined} atendimentos reais foram sincronizados!`);
      }
      if (previewAgent?.key && typeof apiService.getAgentEvolution === "function") {
        const evo = await apiService.getAgentEvolution(previewAgent.key);
        if (evo?.success) setEvolutionData(evo.evolution);
      }
      if (typeof apiService.getConversations === "function") {
        const latestConvs = await apiService.getConversations(true, { limit: 6 });
        if (Array.isArray(latestConvs)) setRealConversations(latestConvs);
      }
    } catch (err: any) {
      notify.error(err?.message || "Não foi possível sincronizar os atendimentos reais.");
    } finally {
      setIsSyncingAttendance(false);
    }
  };


  // Filter attendants by store
  const belongsToStore = useCallback((agent: any, storeId: string) => {
    if (!agent.sessionIds?.length) return agent.storeId === storeId;
    return stores.find(store => store.id === storeId)?.numbers?.some((number: any) => agent.sessionIds.includes(number.sessionId)) === true;
  }, [stores]);
  const filteredAttendants = useMemo(() => {
    if (selectedWhatsApp) return agents.filter(a => a.sessionIds?.includes(selectedWhatsApp));
    if (selectedStoreFilter === "all") return agents;
    return agents.filter((a) => belongsToStore(a, selectedStoreFilter));
  }, [agents, selectedStoreFilter, belongsToStore, selectedWhatsApp]);

  // Top Carousel Pagination (Canonical: max 5 real attendants visible per view)
  const [attendantPage, setAttendantPage] = useState(1);
  const ATTENDANTS_PER_PAGE = 5;
  const totalAttendantPages = Math.max(1, Math.ceil(agents.length / ATTENDANTS_PER_PAGE));
  const paginatedAgents = useMemo(() => {
    const start = (attendantPage - 1) * ATTENDANTS_PER_PAGE;
    return agents.slice(start, start + ATTENDANTS_PER_PAGE);
  }, [agents, attendantPage]);

  // Operational Cards Pagination (Max 4 cards per page to prevent infinite page growth)
  const [opCardPage, setOpCardPage] = useState(1);
  const OP_CARDS_PER_PAGE = 4;
  const totalOpCardPages = Math.max(1, Math.ceil(filteredAttendants.length / OP_CARDS_PER_PAGE));
  const paginatedOpCards = useMemo(() => {
    const start = (opCardPage - 1) * OP_CARDS_PER_PAGE;
    return filteredAttendants.slice(start, start + OP_CARDS_PER_PAGE);
  }, [filteredAttendants, opCardPage]);

  const assignmentConflicts = useMemo(() => sessions.flatMap(session => {
    const sessionId = session.sessionId || session.id;
    const responsible = agents.filter(agent => agent.sessionIds?.includes(sessionId));
    return responsible.length > 1 ? [{ sessionId, session, responsible }] : [];
  }), [sessions, agents]);
  useEffect(() => {
    if (selectedWhatsApp) {
      const responsible = agents.filter(agent => agent.sessionIds?.includes(selectedWhatsApp));
      setPreviewAgent(responsible.length === 1 ? responsible[0] : null);
    }
  }, [selectedWhatsApp, agents]);
  const switchAttendant = async (agentKey: string) => {
    if (!selectedWhatsApp || !agentKey || switchingAttendant) return;
    setSwitchingAttendant(true);
    try {
      const result = await apiService.assignAttendantToConnection(selectedWhatsApp, agentKey);
      if (result.success === false) throw new Error("Não foi possível trocar o atendente.");
      await fetchData();
      notify.success("Atendente responsável atualizado. Os dados do WhatsApp foram preservados.");
    } catch (error) { notify.error(error instanceof Error ? error.message : "Falha ao trocar atendente."); }
    finally { setSwitchingAttendant(false); }
  };
  useEffect(() => {
    if (!selectedWhatsApp && selectedStoreFilter !== "all" && previewAgent && !filteredAttendants.some(agent => agent.key === previewAgent.key)) setPreviewAgent(filteredAttendants[0] || null);
  }, [selectedStoreFilter, filteredAttendants, previewAgent, selectedWhatsApp]);

  const handleToggleActive = async (agent: any) => {
    const nextState = agent.active === false;
    if (nextState && !agent.sessionIds?.length) {
      handleOpenReassign(agent);
      return;
    }
    if (pendingAgent) return;
    setPendingAgent(agent.key);
    try {
      const result = await apiService.toggleAIAgent(agent.key, nextState);
      if (result.success === false) throw new Error("A alteração não foi salva.");
      setAgents((prev) => prev.map((a) => (a.key === agent.key ? { ...a, active: nextState } : a)));
      setPreviewAgent((current: any) => current?.key === agent.key ? { ...current, active: nextState } : current);
      notify.success(nextState ? `${agent.name} ativado(a)` : `${agent.name} pausado(a)`);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao alternar status do atendente.");
    } finally {
      setPendingAgent(null);
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
        const result = await apiService.assignAttendantToConnection(selectedSessionForReassign, reassignAgent.key);
        if (result.success === false) throw new Error("Não foi possível salvar o vínculo.");
        notify.success(`${reassignAgent.name} vinculado(a) à conexão com sucesso!`);
      } else {
        // Desvincular de todas
        if (reassignAgent.sessionIds?.length) {
          for (const sessionId of reassignAgent.sessionIds) {
            const result = await apiService.assignAttendantToConnection(sessionId, null);
            if (result.success === false) throw new Error("Não foi possível remover o vínculo.");
          }
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
    const testedAgentKey = previewAgent?.key;
    const version = ++testVersion.current;
    setSandboxInput("");
    setSandboxMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setIsTestingAgent(true);

    try {
      const response = await apiService.testAIMessage({
        prompt: previewAgent?.personality || undefined,
        message: userText,
        agentKey: previewAgent?.key,
        sessionId: previewAgent?.sessionIds?.[0],
      });

      const reply = response.result?.response;
      if (response.success === false || !response.result?.ok || !reply) throw new Error(response.error || "O teste não retornou uma resposta.");
      if (selectedAgentKey.current !== testedAgentKey || version !== testVersion.current) return;
      setSandboxMessages((prev) => [...prev, { sender: "agent", text: reply }]);
    } catch (err: any) {
      if (selectedAgentKey.current !== testedAgentKey || version !== testVersion.current) return;
      setSandboxMessages((prev) => [
        ...prev,
        { sender: "agent", text: `Serviço de IA indisponível: ${err?.message || "conexão recusada"}` }
      ]);
    } finally {
      if (version === testVersion.current) setIsTestingAgent(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title="Atendente IA" />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors",
                  activeTab === "attendants"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : activeTab === "copilot"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : activeTab === "config"
                    ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                    : activeTab === "memory"
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                )}
              >
                {activeTab === "attendants" ? (
                  <Headset weight="fill" className="h-6 w-6" />
                ) : activeTab === "copilot" ? (
                  <img
                    src="/assets/mascot/zaibot_avatar.png"
                    alt="ZAIBOT"
                    className="h-8 w-8 rounded-xl object-cover shrink-0"
                  />
                ) : activeTab === "config" ? (
                  <Sliders className="h-6 w-6" />
                ) : activeTab === "memory" ? (
                  <Sparkle weight="fill" className="h-6 w-6" />
                ) : (
                  <TrendUp className="h-6 w-6" />
                )}
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-display flex items-center gap-2">
                  <span>
                    {activeTab === "attendants"
                      ? "Atendente IA"
                      : activeTab === "copilot"
                      ? "Assistente ZAI"
                      : activeTab === "config"
                      ? "Configuração IA"
                      : activeTab === "memory"
                      ? "Memória do Atendente"
                      : "Evolução IA"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase font-bold",
                      activeTab === "attendants"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : activeTab === "copilot"
                        ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                        : activeTab === "config"
                        ? "border-sky-500/30 text-sky-400 bg-sky-500/10"
                        : activeTab === "memory"
                        ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                        : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    )}
                  >
                    {activeTab === "attendants"
                      ? "Operação de Atendimento"
                      : activeTab === "copilot"
                      ? "Copiloto da Plataforma"
                      : activeTab === "config"
                      ? "Modelos & Comportamento"
                      : activeTab === "memory"
                      ? "Base de Conhecimento"
                      : "Aprendizado Contínuo"}
                  </Badge>
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>
                    {activeTab === "attendants"
                      ? "Loja, WhatsApp e atendimento em um só lugar."
                      : activeTab === "copilot"
                      ? "Consulte a operação e gerencie os atendentes com dados do sistema."
                      : activeTab === "config"
                      ? "Ajuste prompts, provedores, temperatura e tom de voz dos atendentes."
                      : "Acompanhe score, nível de aprendizado e respostas em tempo real."}
                  </span>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Copiloto da Plataforma:</span>
                    <button
                      type="button"
                      onClick={() => handleTabChange("copilot")}
                      className="text-amber-400 hover:text-amber-300 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <img
                        src="/assets/mascot/zaibot_avatar.png"
                        alt="ZAIBOT"
                        className="h-3.5 w-3.5 rounded-full inline"
                      />
                      <span>Assistente ZAI</span>
                    </button>
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsWizardOpen(true)}
              className="h-9 px-3.5 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-glow cursor-pointer"
            >
              <Plus weight="bold" className="h-4 w-4" />
              <span>Novo Atendente</span>
            </Button>
          </div>
        </div>

        {loadError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><span>{loadError}</span><Button size="sm" variant="outline" onClick={() => void fetchData()}>Tentar novamente</Button></div>}

        {/* ROW 0: ATTENDANTS CANONICAL TOP SYSTEM (REAL ATTENDANTS + SEPARATED EXAMPLE MODELS) */}
        <section aria-label="Lista de Atendentes" className="space-y-3 p-3.5 rounded-2xl border border-border/70 bg-card/40">
          {/* Real Attendants Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground font-display">Atendentes IA</h2>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold font-mono text-[11px]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{agents.length} Cadastrado(s)</span>
              </span>
            </div>

            {/* Pagination Controls for Real Attendants (Max 5 visible) */}
            {totalAttendantPages > 1 && (
              <div className="flex items-center gap-1 text-xs">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg cursor-pointer"
                  disabled={attendantPage <= 1}
                  onClick={() => setAttendantPage((p) => Math.max(1, p - 1))}
                  aria-label="Atendentes anteriores"
                >
                  <CaretLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono text-muted-foreground px-1">
                  {attendantPage} / {totalAttendantPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg cursor-pointer"
                  disabled={attendantPage >= totalAttendantPages}
                  onClick={() => setAttendantPage((p) => Math.min(totalAttendantPages, p + 1))}
                  aria-label="Próximos atendentes"
                >
                  <CaretRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Real Attendants Carousel (Max 5 real + 1 Add Card) */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-zai">
            {paginatedAgents.map((agent) => (
              <AttendantItemCard
                key={agent.key || agent.id}
                attendant={{
                  id: agent.id || agent.key,
                  key: agent.key || agent.id,
                  name: agent.name,
                  role: agent.role || "Especialista de Atendimento",
                  isExample: false,
                  active: agent.active !== false,
                  avatarConfig: agent.avatarConfig,
                }}
                isSelected={previewAgent?.key === (agent.key || agent.id) && !previewAgent?.isExample}
                onSelect={(att) => {
                  const found = agents.find((a) => (a.key || a.id) === att.key);
                  if (found) setPreviewAgent(found);
                }}
                onEdit={(att) => {
                  const found = agents.find((a) => (a.key || a.id) === att.key);
                  if (found) setPreviewAgent(found);
                }}
              />
            ))}

            {/* + Novo Atendente (Always the last card) */}
            <AddAttendantCard onAdd={() => setIsWizardOpen(true)} />
          </div>

          {/* Visually Separated Example Models Section */}
          <div className="pt-2.5 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Modelos de Exemplo
                </span>
                <span className="badge-zai-example">EXEMPLO</span>
              </div>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Perfis demonstrativos para inspiração — clique para visualizar
              </span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1.5 scrollbar-zai opacity-85 hover:opacity-100 transition-opacity">
              {EXAMPLE_ATTENDANTS.map((example) => (
                <AttendantItemCard
                  key={example.id}
                  attendant={{
                    id: example.id,
                    key: example.key,
                    name: example.name,
                    role: example.role,
                    isExample: true,
                    avatarConfig: example.avatarConfig as any,
                  }}
                  isSelected={previewAgent?.key === example.key && previewAgent?.isExample === true}
                  onSelect={() => {
                    setPreviewAgent({
                      ...example,
                      key: example.key,
                      active: true,
                      isExample: true,
                    });
                  }}
                  onEdit={() => {
                    setPreviewAgent({
                      ...example,
                      key: example.key,
                      active: true,
                      isExample: true,
                    });
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ROW 1: COMPACT OPERATIONAL INDICATORS BAR (Canonical 72–84px Height) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-2.5 rounded-2xl border border-border/70 bg-card/75 shadow-sm h-auto md:h-[76px]">
          <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 flex items-center justify-between h-full">
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium leading-none mb-1">Respostas IA hoje</span>
              <strong className="text-base font-bold text-foreground font-mono">{sessionMetrics?.messagesToday ?? 0}</strong>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <ChatCircleText className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 flex items-center justify-between h-full">
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium leading-none mb-1">Tokens hoje</span>
              <strong className="text-base font-bold text-foreground font-mono">{formatTokens(sessionMetrics?.tokensToday ?? 0)}</strong>
            </div>
            <div className="h-8 w-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
              <Sparkle className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 flex items-center justify-between h-full">
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium leading-none mb-1">Conversas hoje</span>
              <strong className="text-base font-bold text-foreground font-mono">{sessionMetrics?.conversationsToday ?? (sessionMetrics?.messagesToday ?? 0)}</strong>
            </div>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <WhatsappLogo className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/50 px-3 py-2 flex items-center justify-between h-full">
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium leading-none mb-1">Leads hoje</span>
              <strong className="text-base font-bold text-foreground font-mono">{sessionMetrics?.leadsToday ?? 0}</strong>
            </div>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <TrendUp className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* The 3 Main Menus */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-card/70 border border-border/70 w-fit flex-wrap">
          <button
            type="button"
            onClick={() => handleTabChange("attendants")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all select-none",
              activeTab === "attendants"
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <Headset weight="fill" className="h-4 w-4" />
            <span>Atendente IA</span>
            <Badge
              variant="outline"
              className={cn(
                "ml-1 text-[10px] px-1.5 py-0 border-emerald-500/30",
                activeTab === "attendants" ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground"
              )}
            >
              {agents.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("config")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all select-none",
              activeTab === "config"
                ? "bg-sky-500/15 border border-sky-500/40 text-sky-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <Sliders className="h-4 w-4" />
            <span>Configuração</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("evolution")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all select-none",
              (activeTab === "evolution" || activeTab === "memory")
                ? "bg-purple-500/15 border border-purple-500/40 text-purple-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <Sparkle weight="fill" className="h-4 w-4 text-purple-400" />
            <span>Memória & Evolução</span>
          </button>
        </div>

        {/* Tab Content: Views */}
        {activeTab === "copilot" ? (
          <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur shadow-sm p-4 md:p-6">
            <ZaiPlatformAssistantView
              onOpenNewAgentWizard={() => setIsWizardOpen(true)}
              onRefreshAgents={fetchData}
            />
          </div>
        ) : activeTab === "config" ? (
          <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur shadow-sm p-4 md:p-6">
            <React.Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Carregando configurações de IA...</div>}>
              <AgentTab
                selectedAgentKey={previewAgent?.key}
                agents={agents}
                onRefreshAgents={fetchData}
              />
            </React.Suspense>
          </div>
        ) : (activeTab === "evolution" || activeTab === "memory") ? (
          <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur shadow-sm p-4 md:p-6">
            <React.Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Carregando memória & evolução cognitiva...</div>}>
              <EvolutionTab
                agentKey={previewAgent?.key || "camila"}
                onSelectAgent={(key) => setPreviewAgent(agents.find((a) => a.key === key) || null)}
                agents={agents}
              />
            </React.Suspense>
          </div>
        ) : (
          <>
            {/* INÍCIO DO ATENDENTE IA: 2.5D AVATAR STUDIO & CHAT DE TESTE EM TEMPO REAL */}
            {previewAgent ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Coluna Esquerda: Avatar Studio 2.5D com 5 Categorias (Col 5) */}
                <div className="lg:col-span-5 space-y-4">
                  <Card className="rounded-2xl border-border/70 bg-card/85 backdrop-blur shadow-sm overflow-hidden flex flex-col h-auto lg:h-[510px] lg:max-h-[510px]">
                    <CardHeader className="p-3.5 pb-2.5 border-b border-border/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-bold text-foreground font-display flex items-center gap-2 truncate">
                            <span>Avatar Studio ({previewAgent.name})</span>
                            {previewAgent.isExample ? (
                              <span className="badge-zai-example">
                                Modelo Demonstrativo
                              </span>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-bold uppercase shrink-0",
                                  previewAgent.active !== false
                                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                    : "border-amber-500/30 text-amber-400 bg-amber-500/10"
                                )}
                              >
                                {previewPresence?.label}
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="text-[11px] truncate">
                            {previewAgent.role || (previewAgent.isExample ? "Modelo de Demonstração" : "Especialista em Vendas")} · {previewAgent.isExample ? "Exemplo Visual" : (previewStore?.name || "Sem loja vinculada")}
                          </CardDescription>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleSaveAvatar}
                            disabled={isSavingAvatar}
                            className={cn(
                              "h-7 text-xs rounded-xl px-2.5 gap-1.5 font-semibold shadow-xs",
                              previewAgent.isExample
                                ? "bg-sky-600 hover:bg-sky-500 text-white"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white"
                            )}
                            title={previewAgent.isExample ? "Criar atendente a partir deste modelo" : "Salvar alterações do avatar no servidor"}
                          >
                            {previewAgent.isExample ? (
                              <>
                                <Plus weight="bold" className="h-3.5 w-3.5" />
                                <span>Criar Atendente</span>
                              </>
                            ) : (
                              <>
                                <FloppyDisk className="h-3.5 w-3.5" />
                                <span>{isSavingAvatar ? "Salvando..." : "Salvar Avatar"}</span>
                              </>
                            )}
                          </Button>

                          {!previewAgent.isExample && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAvatarEditorAgent(previewAgent)}
                              className="h-7 text-xs rounded-xl px-2 border-border/60 text-muted-foreground hover:text-foreground"
                              title="Abrir Studio Completo em Janela Expandida"
                            >
                              <TShirt className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {previewAgent.isExample && (
                        <div className="mt-2.5 p-2.5 rounded-xl border border-sky-500/30 bg-sky-950/25 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="font-bold text-sky-300 text-[10px] uppercase tracking-wider block">
                              Modelo Demonstrativo ({previewAgent.name})
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              Este perfil é um exemplo visual para inspiração. Não envia mensagens nem consome recursos.
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setIsWizardOpen(true)}
                            className="h-6 text-[11px] bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shrink-0 gap-1 cursor-pointer"
                          >
                            <Plus weight="bold" className="h-3 w-3" />
                            <span>Ativar como Real</span>
                          </Button>
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="p-3.5 space-y-2.5 flex-1 flex flex-col min-h-0 overflow-hidden">
                      {/* 2.5D Living Avatar Box */}
                      <div className="w-full h-[200px] shrink-0 rounded-2xl overflow-hidden border border-border/50 shadow-inner relative flex flex-col items-center justify-center bg-gradient-to-b from-[#091120] to-[#040812] select-none">
                        {/* Isometric Grid Floor Accent */}
                        <div
                          className="absolute inset-0 opacity-15 pointer-events-none"
                          style={{
                            backgroundImage: "radial-gradient(circle at 2px 2px, #10b981 1px, transparent 0)",
                            backgroundSize: "20px 20px",
                          }}
                        />

                        {/* Top-left Info Chip */}
                        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-border/60 text-[10px] backdrop-blur-xs">
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              previewAgent.active !== false ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                            )}
                          />
                          <span className="font-semibold text-foreground">{previewAgent.name}</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="font-mono text-emerald-400 text-[9px]">{previewPresence?.label}</span>
                        </div>

                        {/* Top-right Gender Switcher */}
                        <button
                          type="button"
                          onClick={() => {
                            const currentGender = previewAgent?.avatarConfig?.body === "male" ? "female" : "male";
                            handleUpdateAvatar({ body: currentGender });
                          }}
                          className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-black/60 border border-emerald-500/30 text-[9px] text-emerald-300 font-mono hover:bg-emerald-500/20 transition-all flex items-center gap-1 backdrop-blur-xs cursor-pointer"
                          title="Alternar silhueta feminina / masculina"
                        >
                          <span>{previewAgent?.avatarConfig?.body === "male" ? "Masc" : "Fem"}</span>
                        </button>

                        {/* Centered 2.5D Character Sprite */}
                        <div className="relative w-full h-[160px] flex items-center justify-center my-auto">
                          <ZaiAvatarRenderer
                            avatar={previewAgent.avatarConfig || createAgentAvatar({
                              agentId: previewAgent.key || previewAgent.name,
                              name: previewAgent.name,
                              role: previewAgent.role,
                              storeId: previewStore?.id,
                              storeDNA: previewStore ? buildStoreVisualDNA(previewStore) : undefined,
                              gender: previewAgent.character?.gender || (previewAgent.name?.toLowerCase().includes("carlos") ? "male" : "female"),
                            })}
                            state={previewPresence?.state || "WAITING"}
                            size="workspace"
                            showAura={true}
                            showStatusBadge={false}
                            showBrandingLayer={false}
                          />
                        </div>

                        {/* Bottom Layer Summary Chips */}
                        <div className="absolute bottom-1.5 inset-x-2 z-20 flex items-center justify-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-black/70 border border-border/50 text-[9px] text-foreground font-mono truncate max-w-[100px]">
                            {activeHairItem.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-black/70 border border-border/50 text-[9px] text-foreground font-mono truncate max-w-[90px]">
                            {activeFaceItem.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-black/70 border border-border/50 text-[9px] text-foreground font-mono truncate max-w-[100px]">
                            {activeOutfitItem.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-[9px] text-emerald-300 font-mono font-bold truncate max-w-[80px]">
                            {activeStyleItem.title}
                          </span>
                        </div>
                      </div>

                      {/* Exactly 5 Category Buttons */}
                      <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-muted/20 border border-border/50 shrink-0">
                        <button
                          type="button"
                          onClick={() => setStudioCategory("hair")}
                          className={cn(
                            "py-1.5 px-1 rounded-lg text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                            studioCategory === "hair"
                              ? "bg-background text-emerald-400 border border-emerald-500/40 shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          )}
                        >
                          <Scissors className="h-3 w-3" />
                          <span>Cabelo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudioCategory("face")}
                          className={cn(
                            "py-1.5 px-1 rounded-lg text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                            studioCategory === "face"
                              ? "bg-background text-emerald-400 border border-emerald-500/40 shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          )}
                        >
                          <Smiley className="h-3 w-3" />
                          <span>Rosto</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudioCategory("outfit")}
                          className={cn(
                            "py-1.5 px-1 rounded-lg text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                            studioCategory === "outfit"
                              ? "bg-background text-emerald-400 border border-emerald-500/40 shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          )}
                        >
                          <TShirt className="h-3 w-3" />
                          <span>Roupa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudioCategory("accessories")}
                          className={cn(
                            "py-1.5 px-1 rounded-lg text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                            studioCategory === "accessories"
                              ? "bg-background text-emerald-400 border border-emerald-500/40 shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          )}
                        >
                          <Eyeglasses className="h-3 w-3" />
                          <span>Acessórios</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudioCategory("style")}
                          className={cn(
                            "py-1.5 px-1 rounded-lg text-[10px] font-bold uppercase transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                            studioCategory === "style"
                              ? "bg-background text-emerald-400 border border-emerald-500/40 shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          )}
                        >
                          <Sparkle className="h-3 w-3" />
                          <span>Estilo</span>
                        </button>
                      </div>

                      {/* Items Selection Grid for Current Category */}
                      <div className="flex-1 min-h-[110px] overflow-y-auto pr-1 scrollbar-zai">
                        {studioCategory === "hair" && (
                          <div className="grid grid-cols-2 gap-1.5">
                            {AVATAR_HAIRS.map((h) => {
                              const isSelected = previewAgent?.avatarConfig?.hair === h.id;
                              return (
                                <button
                                  key={h.id}
                                  type="button"
                                  data-avatar-item={h.id}
                                  onClick={() => handleUpdateAvatar({
                                    hair: h.id,
                                    catalogSpriteId: h.spriteRef || resolveSpriteForAvatar({ ...(previewAgent?.avatarConfig || {}), hair: h.id, catalogSpriteId: undefined }, true),
                                  })}
                                  className={cn(
                                    "p-1.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer",
                                    isSelected
                                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                                      : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/40 text-emerald-400 font-bold shrink-0">{h.number}</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate text-foreground">{h.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{h.title}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {studioCategory === "face" && (
                          <div className="grid grid-cols-2 gap-1.5">
                            {AVATAR_FACES.map((f) => {
                              const isSelected = previewAgent?.avatarConfig?.face === f.id || (!previewAgent?.avatarConfig?.face && f.id === "face_01");
                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  data-avatar-item={f.id}
                                  onClick={() => handleUpdateAvatar({ face: f.id })}
                                  className={cn(
                                    "p-1.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer",
                                    isSelected
                                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                                      : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/40 text-emerald-400 font-bold shrink-0">{f.number}</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate text-foreground">{f.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{f.title}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {studioCategory === "outfit" && (
                          <div className="grid grid-cols-2 gap-1.5">
                            {AVATAR_OUTFITS.map((o) => {
                              const isSelected = previewAgent?.avatarConfig?.outfit === o.id || previewAgent?.avatarConfig?.clothing === o.id;
                              return (
                                <button
                                  key={o.id}
                                  type="button"
                                  data-avatar-item={o.id}
                                  onClick={() => handleUpdateAvatar({
                                    outfit: o.id,
                                    clothing: o.id,
                                    catalogSpriteId: o.spriteRef || resolveSpriteForAvatar({ ...(previewAgent?.avatarConfig || {}), outfit: o.id, clothing: o.id, catalogSpriteId: undefined }, true),
                                  })}
                                  className={cn(
                                    "p-1.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer",
                                    isSelected
                                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                                      : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/40 text-emerald-400 font-bold shrink-0">{o.number}</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate text-foreground">{o.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{o.title}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {studioCategory === "accessories" && (
                          <div className="grid grid-cols-2 gap-1.5">
                            {AVATAR_ACCESSORIES.map((a) => {
                              const cfg = previewAgent?.avatarConfig;
                              const isEquipped =
                                (a.id === "acc_01" && (!cfg?.headset || cfg?.headset === "none") && (!cfg?.glasses || cfg?.glasses === "none")) ||
                                (a.id === "acc_02" && cfg?.headset === "headset_zai_green") ||
                                (a.id === "acc_03" && cfg?.accessories?.badge === "badge_zai_lanyard") ||
                                (a.id === "acc_04" && (cfg?.glasses === "glasses_square_exec" || cfg?.glasses?.includes("glasses"))) ||
                                (a.id === "acc_05" && cfg?.workObject === "tablet_zai") ||
                                (a.id === "acc_06" && cfg?.accessories?.watch === "watch_zai_smart");

                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  data-avatar-item={a.id}
                                  onClick={() => {
                                    const currentConfig = cfg || {};
                                    const currentAccessories = typeof currentConfig.accessories === "object" ? { ...currentConfig.accessories } : {};
                                    let updatedAccessories: any = currentAccessories;
                                    let updatedHeadset = currentConfig.headset;
                                    let updatedGlasses = currentConfig.glasses;
                                    let updatedWorkObject = currentConfig.workObject;
                                    if (a.id === "acc_01") {
                                      updatedAccessories = {};
                                      updatedHeadset = "none";
                                      updatedGlasses = "none";
                                    } else if (a.id === "acc_02") {
                                      updatedHeadset = updatedHeadset === "headset_zai_green" ? "none" : "headset_zai_green";
                                      updatedAccessories.headset = updatedHeadset;
                                    } else if (a.id === "acc_03") {
                                      updatedAccessories.badge = updatedAccessories.badge === "badge_zai_lanyard" ? "none" : "badge_zai_lanyard";
                                    } else if (a.id === "acc_04") {
                                      updatedGlasses = updatedGlasses === "glasses_square_exec" ? "none" : "glasses_square_exec";
                                      updatedAccessories.glasses = updatedGlasses;
                                    } else if (a.id === "acc_05") {
                                      updatedWorkObject = updatedWorkObject === "tablet_zai" ? "none" : "tablet_zai";
                                    } else if (a.id === "acc_06") {
                                      updatedAccessories.watch = updatedAccessories.watch === "watch_zai_smart" ? "none" : "watch_zai_smart";
                                    }
                                    handleUpdateAvatar({
                                      accessories: updatedAccessories,
                                      headset: updatedHeadset,
                                      glasses: updatedGlasses,
                                      workObject: updatedWorkObject,
                                    });
                                  }}
                                  className={cn(
                                    "p-1.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer",
                                    isEquipped
                                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                                      : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/40 text-emerald-400 font-bold shrink-0">{a.number}</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate text-foreground">{a.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{a.title}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {studioCategory === "style" && (
                          <div className="grid grid-cols-2 gap-1.5">
                            {AVATAR_STYLES.map((s) => {
                              const isSelected = previewAgent?.avatarConfig?.style === s.id;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  data-avatar-item={s.id}
                                  onClick={() => {
                                    const currentConfig = previewAgent?.avatarConfig || {};
                                    const styled = applyStylePreset(currentConfig, s.id);
                                    handleUpdateAvatar(styled);
                                  }}
                                  className={cn(
                                    "p-1.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer",
                                    isSelected
                                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                                      : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/40 text-emerald-400 font-bold shrink-0">{s.number}</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate text-foreground">{s.name}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{s.title}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Coluna Direita: Central Interativa / Chat de Teste Real (Col 7) */}
                <div className="lg:col-span-7 space-y-4">
                  <Card className="rounded-2xl border-border/70 bg-card/85 backdrop-blur shadow-sm overflow-hidden flex flex-col h-auto lg:h-[510px] lg:max-h-[510px]">
                    <CardHeader className="h-[56px] px-3.5 py-0 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <ChatCircleText weight="bold" className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-bold text-foreground truncate">
                            Chat de Teste ao Vivo ({previewAgent.name})
                          </CardTitle>
                          <CardDescription className="text-[11px] text-muted-foreground truncate">
                            Inteligência real do atendente. Mensagens de teste não afetam clientes no WhatsApp.
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold text-emerald-400 border-emerald-500/30 bg-emerald-500/10 uppercase shrink-0">
                        AO VIVO
                      </Badge>
                    </CardHeader>

                    <CardContent className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
                      {/* Quick test prompt pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground shrink-0 font-medium">Perguntas rápidas:</span>
                        {["Qual é o catálogo?", "Formas de pagamento?", "Horário de atendimento?", "Quais são as promoções?"].map((q, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSandboxInput(q)}
                            disabled={isTestingAgent}
                            className="px-2.5 py-0.5 rounded-full text-[10px] bg-muted/40 hover:bg-emerald-500/15 text-muted-foreground hover:text-emerald-300 border border-border/60 shrink-0 transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>

                      {/* Chat Messages Box */}
                      <div className="flex-1 min-h-0 rounded-xl border border-border/60 bg-background/50 p-3 overflow-y-auto space-y-2.5 text-xs scrollbar-zai">
                        {sandboxMessages.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground space-y-2">
                            <Headset className="h-8 w-8 text-muted-foreground/60" />
                            <p className="text-xs font-semibold text-foreground">Ambiente de Teste Interativo</p>
                            <p className="text-[11px] max-w-xs">
                              Envie uma pergunta para testar as respostas de <strong>{previewAgent.name}</strong>. Respostas utilizam a inteligência real configurada.
                            </p>
                          </div>
                        )}
                        {sandboxMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-xs",
                              msg.sender === "user"
                                ? "ml-auto bg-emerald-600 text-white rounded-br-xs"
                                : "mr-auto bg-card border border-border/60 text-foreground rounded-bl-xs"
                            )}
                          >
                            {msg.text}
                          </div>
                        ))}
                        {isTestingAgent && (
                          <div className="mr-auto bg-card border border-border/60 text-muted-foreground rounded-2xl rounded-bl-xs px-3.5 py-2 text-xs italic animate-pulse flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>{previewAgent.name} está digitando...</span>
                          </div>
                        )}
                      </div>

                      {/* Input form */}
                      <form onSubmit={handleSendTestMessage} className="h-[48px] flex items-center gap-2 pt-1 shrink-0">
                        <Input
                          placeholder={`Pergunte algo para ${previewAgent.name}...`}
                          value={sandboxInput}
                          onChange={(e) => setSandboxInput(e.target.value)}
                          className="rounded-xl text-xs h-9"
                          disabled={isTestingAgent}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!sandboxInput.trim() || isTestingAgent}
                          className="h-9 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-4 font-semibold shadow-xs"
                        >
                          Enviar
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}

            {/* Store Filter Tabs */}
            <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <label className="block text-sm font-semibold" htmlFor="attendant-whatsapp">WhatsApp do atendimento</label>
              <select id="attendant-whatsapp" className="w-full rounded-xl border border-border bg-background p-3 text-sm" value={selectedWhatsApp} onChange={event => selectWhatsApp(event.target.value)}>
                <option value="">Todos os atendentes</option>
                {sessions.map(session => <option key={session.sessionId || session.id} value={session.sessionId || session.id}>{session.sessionName || session.sessionId || session.id}{session.phone ? ` · ${session.phone}` : ""}</option>)}
              </select>
              {selectedWhatsApp && <>
                <label className="block text-sm font-semibold" htmlFor="whatsapp-attendant">Trocar atendente responsável</label>
                <select id="whatsapp-attendant" className="w-full rounded-xl border border-border bg-background p-3 text-sm" disabled={switchingAttendant} value={filteredAttendants.length === 1 ? filteredAttendants[0].key : ""} onChange={event => void switchAttendant(event.target.value)}>
                  <option value="" disabled>Selecione um atendente</option>
                  {agents.map(agent => <option key={agent.key} value={agent.key}>{agent.name}{agent.active === false ? " · Pausado" : " · Habilitado"}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">A troca preserva loja, histórico e memória deste número. As instruções de um atendente usado em vários números são compartilhadas.</p>
                {filteredAttendants.length > 1 && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Este WhatsApp tem vínculos antigos com mais de um atendente. Escolha acima o único responsável para regularizar o atendimento.</p>}
              </>}
            </section>
            {!selectedWhatsApp && assignmentConflicts.length > 0 && (
              <section role="alert" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-200">{assignmentConflicts.length} WhatsApp(s) têm mais de um atendente vinculado.</p>
                <p className="text-xs text-muted-foreground">O atendimento pode ficar pausado até cada número ter um único responsável. Escolha um WhatsApp para revisar os vínculos; nada será alterado até você selecionar o responsável.</p>
                <label className="sr-only" htmlFor="resolve-assignment-conflict">Escolher WhatsApp com conflito</label>
                <select id="resolve-assignment-conflict" className="w-full rounded-xl border border-amber-500/30 bg-background p-2.5 text-sm" value="" onChange={event => selectWhatsApp(event.target.value)}>
                  <option value="" disabled>Revisar conflito de um WhatsApp…</option>
                  {assignmentConflicts.map(({ sessionId, session, responsible }) => (
                    <option key={sessionId} value={sessionId}>{session.sessionName || session.name || sessionId} · {responsible.map(agent => agent.name).join(", ")}</option>
                  ))}
                </select>
              </section>
            )}
            {selectedWhatsApp && <details open={commercialOpen} onToggle={event => setCommercialOpen(event.currentTarget.open)} className="rounded-2xl border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold">Loja e dados comerciais deste WhatsApp</summary>
              <React.Suspense fallback={<p className="py-4 text-sm text-muted-foreground">Carregando dados comerciais…</p>}>
                <CommercialPanel key={selectedWhatsApp} requestedMode="store" initialSessionId={selectedWhatsApp} onCommercialSaved={fetchData} lockSession />
              </React.Suspense>
            </details>}
            {!selectedWhatsApp && searchParams.get("section") === "business" && <p className="text-sm text-muted-foreground">Selecione o WhatsApp acima para configurar a loja e os dados comerciais.</p>}
            {!selectedWhatsApp && stores.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedStoreFilter("all")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all select-none whitespace-nowrap shrink-0",
                    selectedStoreFilter === "all"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm"
                      : "bg-card/50 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  Todas as Lojas ({agents.length})
                </button>
                {stores.map((st) => {
                  const isSelected = selectedStoreFilter === st.id;
                  const count = agents.filter((a) => belongsToStore(a, st.id)).length;
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

            {/* Lista Completa de Atendentes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground font-display">Atendentes Cadastrados</h3>
                  <p className="text-xs text-muted-foreground">Gerencie vínculos com WhatsApp, lojas e personalização visual.</p>
                </div>
                <Button onClick={() => setIsWizardOpen(true)} className="gap-2 rounded-xl text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white">
                  <Plus weight="bold" className="h-3.5 w-3.5" />
                  <span>Novo Atendente</span>
                </Button>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-44 rounded-2xl bg-card/60 border border-border/50 animate-pulse" />
                  ))}
                </div>
              ) : filteredAttendants.length === 0 ? (
                <div className="text-center py-16 rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-4">
                  <Headset weight="light" className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold">{selectedWhatsApp ? "Nenhum atendente responsável por este WhatsApp" : "Nenhum atendente neste filtro"}</h3>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paginatedOpCards.map((agent) => {
                      const isSelected = previewAgent?.key === agent.key;
                      const assignedSession = getAssignedSession(agent);
                      const assignedStore = getAssignedStore(agent);
                      const isActive = agent.active !== false;
                      const isConnected = assignedSession?.status === "connected" || assignedSession?.status === "open";
                      const presence = getPresence(agent);
                      const storePrimaryColor = assignedStore?.settings?.primaryColor || assignedStore?.branding?.primaryColor || "#10b981";

                      return (
                        <Card
                          key={agent.key}
                          data-agent-key={agent.key}
                          onClick={() => setPreviewAgent(agent)}
                          className={cn(
                            "rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden",
                            isSelected
                              ? "bg-card border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/40"
                              : "bg-card/75 border-border/70 hover:border-emerald-500/30 hover:bg-card/90"
                          )}
                        >
                          <CardContent className="p-4 space-y-3.5">
                            {/* Top: Avatar, Name, Role, Store & WhatsApp Chips, Active Status */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                  {(() => {
                                    const cardSpriteId = agent.avatarConfig ? resolveSpriteForAvatar(agent.avatarConfig) : null;
                                    const cardAvatarSrc = cardSpriteId
                                      ? `/assets/avatar_factory/catalog/${cardSpriteId}_clean.png`
                                      : (agent.avatar ||
                                         (agent.character?.gender === "male"
                                           ? "/assets/evolution/joao_avatar.png"
                                           : "/assets/evolution/camila_avatar.png"));
                                    return (
                                      <img
                                        src={cardAvatarSrc}
                                        alt={agent.name}
                                        className={cn(
                                          "h-12 w-12 rounded-2xl border border-emerald-500/30 bg-background",
                                          cardSpriteId ? "object-contain p-1" : "object-cover"
                                        )}
                                        style={cardSpriteId ? { imageRendering: "pixelated" } : undefined}
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.onerror = null;
                                          target.src = "/assets/evolution/camila_avatar.png";
                                        }}
                                      />
                                    );
                                  })()}
                                  <span
                                    className={cn(
                                      "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-card",
                                      isActive ? "bg-emerald-500 shadow-glow" : "bg-amber-500"
                                    )}
                                  />
                                </div>

                                <div className="min-w-0 space-y-1">
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

                                  {/* Integrated Store & WhatsApp Chips */}
                                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                    {/* Store Chip */}
                                    <div
                                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border"
                                      style={{
                                        borderColor: `${storePrimaryColor}55`,
                                        backgroundColor: `${storePrimaryColor}15`,
                                        color: storePrimaryColor,
                                      }}
                                      title={`Loja vinculada: ${assignedStore?.name || "Sem loja vinculada"}`}
                                    >
                                      <Storefront weight="fill" className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate max-w-[180px] font-semibold">{assignedStore?.name || "Sem loja vinculada"}</span>
                                    </div>

                                    {/* WhatsApp Chip */}
                                    <div
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium border",
                                        assignedSession
                                          ? isConnected
                                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                            : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                          : "border-border/60 bg-muted/30 text-muted-foreground"
                                      )}
                                      title={assignedSession ? `WhatsApp: ${assignedSession.sessionName || assignedSession.sessionId}` : "Nenhum WhatsApp vinculado"}
                                    >
                                      <WhatsappLogo
                                        weight="fill"
                                        className={cn(
                                          "h-3.5 w-3.5 shrink-0",
                                          assignedSession ? (isConnected ? "text-emerald-400" : "text-amber-400") : "text-muted-foreground"
                                        )}
                                      />
                                      {assignedSession ? (
                                        <span className="truncate max-w-[150px]">
                                          {assignedSession.phone || assignedSession.sessionName || assignedSession.sessionId}
                                        </span>
                                      ) : (
                                        <span className="italic text-[11px]">Sem WhatsApp</span>
                                      )}
                                      {assignedSession && (
                                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] uppercase font-bold px-2 py-0.5 shrink-0",
                                  isActive
                                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/15"
                                    : "border-amber-500/40 text-amber-400 bg-amber-500/15"
                                )}
                              >
                                {presence.label}
                              </Badge>
                            </div>

                            {/* Summarized Visual KPI Chips */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/50">
                                <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                                  <ChatCircleText weight="bold" className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] text-muted-foreground block truncate">WhatsApps</span>
                                  <span className="text-xs font-bold text-foreground font-mono">{agent.sessionIds?.length ?? 0}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/50">
                                <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                                  <Clock weight="bold" className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] text-muted-foreground block truncate">Conexão</span>
                                  <span className="text-xs font-bold text-foreground">{assignedSession ? (isConnected ? "Online" : "Offline") : "—"}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/50">
                                <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                                  <TrendUp weight="bold" className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[10px] text-muted-foreground block truncate">Atendente</span>
                                  <span className="text-xs font-bold text-foreground">{isActive ? "Habilitado" : "Pausado"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Quick Actions Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAvatarEditorAgent(agent);
                                  }}
                                  className="h-7 text-[11px] px-2.5 rounded-lg gap-1 border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 font-semibold shadow-xs"
                                  title="Abrir ZAI Avatar Studio para personalizar corpo, roupas, cabelo e loja DNA"
                                >
                                  <TShirt weight="bold" className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Avatar Studio</span>
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenReassign(agent);
                                  }}
                                  className="h-7 text-[11px] px-2 rounded-lg gap-1 border-border/60 hover:border-emerald-500/40 text-foreground"
                                  title="Trocar ou vincular número WhatsApp"
                                >
                                  <ArrowsLeftRight className="h-3 w-3 text-emerald-400" />
                                  <span>{assignedSession ? "Trocar WhatsApp" : "Vincular WhatsApp"}</span>
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCustomizerAgent(agent);
                                  }}
                                  className="h-7 text-[11px] px-2 rounded-lg gap-1 border-border/60 text-muted-foreground hover:text-foreground"
                                  title="Configurar personalidade e IA"
                                >
                                  <Sliders className="h-3 w-3" />
                                  <span>Configurar IA</span>
                                </Button>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleActive(agent);
                                  }}
                                  className={cn(
                                    "h-7 text-[11px] px-2 rounded-lg gap-1 font-medium",
                                    isActive
                                      ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                      : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                  )}
                                  title={isActive ? "Colocar em espera (Pausar)" : "Ativar no PC"}
                                  disabled={pendingAgent !== null}
                                >
                                  {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                  <span>{isActive ? "Pausar" : "Ativar"}</span>
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

                {totalOpCardPages > 1 && (
                  <div className="flex justify-center pt-2">
                    <Pagination
                      currentPage={opCardPage}
                      totalPages={totalOpCardPages}
                      pageSize={OP_CARDS_PER_PAGE}
                      onPageChange={setOpCardPage}
                    />
                  </div>
                )}
              </div>

          </>
        )}
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
                  <p className="text-[11px] text-muted-foreground">Remove os vínculos com WhatsApp. Vincule um número antes de ativar o atendimento.</p>
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
          open={Boolean(customizerAgent)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCustomizerAgent(null);
            }
          }}
          agent={customizerAgent}
          onSave={async (updated) => {
            const result = await apiService.updateAIAgent(customizerAgent.key, updated);
            if (result.success === false) throw new Error("Não foi possível salvar o atendente.");
            setCustomizerAgent(null);
            await fetchData();
          }}
        />
      )}

      {/* ================= MODAL: PROFILE ================= */}
      {profileAgent && (
        <AgentProfileModal
          open={Boolean(profileAgent)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setProfileAgent(null);
          }}
          agent={profileAgent}
          onUpdated={fetchData}
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
          store={getAssignedStore(avatarEditorAgent)}
          runtimeState={getPresence(avatarEditorAgent).state}
          onSave={(updatedAvatar) => {
            const spriteId = updatedAvatar.catalogSpriteId || resolveSpriteForAvatar(updatedAvatar, true);
            const avatarUrl = `/assets/avatar_factory/catalog/${spriteId}_clean.png`;
            const fullConfig = { ...updatedAvatar, catalogSpriteId: spriteId };
            setAgents((prev) =>
              prev.map((a) =>
                a.key === avatarEditorAgent.key
                  ? { ...a, avatarConfig: fullConfig, avatar: avatarUrl }
                  : a
              )
            );
            if (previewAgent?.key === avatarEditorAgent.key) {
              setPreviewAgent((prev: any) => ({
                ...prev,
                avatarConfig: fullConfig,
                avatar: avatarUrl,
              }));
            }
            fetchData();
          }}
        />
      )}
    </div>
  );
}

