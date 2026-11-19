import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Award,
  Brain,
  Calendar,
  Clock,
  Database,
  GitBranch,
  LayoutDashboard,
  RefreshCw,
  Smartphone,
  Users,
} from "lucide-react";
import { apiService } from "@/core/services/apiService";
import { cn } from "@/core/lib/utils";
import { useAppStore } from "@/state/stores/appStore";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { createAgentAvatar } from "@/components/avatar-engine/CharacterFactory";
import { OverviewTabPanel } from "./evolution/OverviewTabPanel";
import { MemoryBrainTabPanel } from "./evolution/MemoryBrainTabPanel";
import { CognitiveEvolutionTabPanel } from "./evolution/CognitiveEvolutionTabPanel";
import { ResultsConversationsTabPanel } from "./evolution/ResultsConversationsTabPanel";
import {
  type AgentOption,
  type EvolutionMainTab,
  type LegacyEvolutionSubTab,
  type MemoryOverviewResponse,
  type PeriodFilter,
  type WhatsAppSessionOption,
  PERIOD_OPTIONS,
  formatDateTime,
  formatNumber,
  resolvePeriodDates,
} from "./evolution/types";

export interface EvolutionTabProps {
  agentKey?: string;
  onSelectAgent?: (key: string) => void;
  agents?: AgentOption[];
  selectedAgent?: AgentOption | null;
  isSessionConnected?: boolean;
  initialSubTab?: LegacyEvolutionSubTab | EvolutionMainTab;
  embeddedAgentKey?: string;
  embeddedSessionId?: string;
}

function mapInitialTab(tab?: LegacyEvolutionSubTab | EvolutionMainTab): EvolutionMainTab {
  switch (tab) {
    case "brain":
    case "memory":
      return "memory";
    case "timeline":
    case "cognitive":
      return "cognitive";
    case "conversations":
    case "results":
      return "results";
    case "hub":
    case "overview":
    default:
      return "overview";
  }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.error ||
    anyErr?.response?.data?.message ||
    (err instanceof Error ? err.message : null) ||
    fallback
  );
}

export function EvolutionTab({
  agentKey,
  onSelectAgent,
  agents: initialAgents,
  selectedAgent,
  isSessionConnected: propIsSessionConnected,
  initialSubTab = "overview",
  embeddedAgentKey,
  embeddedSessionId,
}: EvolutionTabProps = {}) {
  const storeSessions = useAppStore((state) => state.sessions);
  const onSelectAgentRef = useRef(onSelectAgent);
  onSelectAgentRef.current = onSelectAgent;

  // Resolve initial and prop-driven agent & session filters without ever faking defaults
  const propAgentKey = embeddedAgentKey ?? agentKey;
  const resolveFirstSelectableKey = (list?: AgentOption[]) => {
    const first = (list || []).find((a) => !a.isPlatformAssistant && a.key !== "zaibot");
    return first?.key || first?.id || "all";
  };
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>(
    () => propAgentKey || resolveFirstSelectableKey(initialAgents)
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => embeddedSessionId || "all");

  useEffect(() => {
    if (propAgentKey !== undefined) {
      setSelectedAgentKey(propAgentKey || "all");
    }
  }, [propAgentKey]);

  useEffect(() => {
    if (embeddedSessionId !== undefined) {
      setSelectedSessionId(embeddedSessionId || "all");
    }
  }, [embeddedSessionId]);

  // Agents list
  const [agentsList, setAgentsList] = useState<AgentOption[]>(initialAgents || []);
  useEffect(() => {
    if (initialAgents && initialAgents.length > 0) {
      setAgentsList(initialAgents);
      if (!propAgentKey) {
        setSelectedAgentKey((prev) => (prev === "all" ? resolveFirstSelectableKey(initialAgents) : prev));
      }
      return;
    }
    if (typeof apiService?.getAIAgents === "function") {
      apiService
        .getAIAgents()
        .then((res) => {
          const list = Array.isArray(res?.agents) ? res.agents : [];
          setAgentsList(list);
          if (!propAgentKey) {
            setSelectedAgentKey((prev) => (prev === "all" ? resolveFirstSelectableKey(list) : prev));
          }
        })
        .catch(() => {});
    }
  }, [initialAgents, propAgentKey]);

  // WhatsApp sessions (store + connections API)
  const [fetchedConnections, setFetchedConnections] = useState<any[]>([]);
  useEffect(() => {
    if (typeof apiService?.getConnections !== "function") return;
    apiService
      .getConnections()
      .then((list) => {
        if (Array.isArray(list)) setFetchedConnections(list);
      })
      .catch(() => {});
  }, []);

  const whatsappSessions = useMemo<WhatsAppSessionOption[]>(() => {
    const map = new Map<string, WhatsAppSessionOption>();
    const ingest = (raw: any) => {
      if (!raw || typeof raw !== "object") return;
      const id = String(raw.id || raw.sessionId || "").trim();
      if (!id) return;
      const connected = Boolean(raw.connected || raw.status === "connected");
      const existing = map.get(id);
      const name = String(raw.name || raw.pushName || raw.label || existing?.name || id);
      const phone = raw.phone || raw.phoneNumber || existing?.phone || null;
      map.set(id, {
        id,
        name,
        phone,
        connected: existing ? existing.connected || connected : connected,
      });
    };
    (storeSessions || []).forEach(ingest);
    fetchedConnections.forEach(ingest);
    return Array.from(map.values());
  }, [storeSessions, fetchedConnections]);

  const isSessionConnected = useMemo(() => {
    if (propIsSessionConnected !== undefined) return propIsSessionConnected;
    if (whatsappSessions.length > 0) {
      return whatsappSessions.some((s) => s.connected);
    }
    return true;
  }, [propIsSessionConnected, whatsappSessions]);

  const selectableAgents = useMemo(
    () => agentsList.filter((a) => !a.isPlatformAssistant && a.key !== "zaibot"),
    [agentsList]
  );

  const currentAgent = useMemo(() => {
    if (selectedAgentKey === "all") return null;
    if (selectedAgent && (selectedAgent.key || selectedAgent.id) === selectedAgentKey) {
      return selectedAgent;
    }
    return selectableAgents.find((a) => (a.key || a.id) === selectedAgentKey) || null;
  }, [selectedAgentKey, selectedAgent, selectableAgents]);

  const currentAvatarConfig = useMemo(() => {
    if (!currentAgent && selectedAgentKey === "all") return null;
    if (currentAgent?.avatarConfig) return currentAgent.avatarConfig;
    const name = currentAgent?.name || selectedAgentKey || "Atendente";
    return createAgentAvatar({
      agentId: currentAgent?.key || currentAgent?.id || selectedAgentKey || "default",
      name,
      role: currentAgent?.role || "Atendente",
      gender: currentAgent?.character?.gender || (name.toLowerCase().includes("carlos") ? "male" : "female"),
    });
  }, [currentAgent, selectedAgentKey]);

  const handleChangeAgent = (value: string) => {
    setSelectedAgentKey(value);
    if (value !== "all") {
      onSelectAgentRef.current?.(value);
    }
  };

  // Top navigation & period filter
  const [activeTab, setActiveTab] = useState<EvolutionMainTab>(() => mapInitialTab(initialSubTab));
  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(mapInitialTab(initialSubTab));
    }
  }, [initialSubTab]);

  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const activePeriodLabel = useMemo(() => {
    if (period === "custom") {
      if (customStart || customEnd) {
        return `${customStart || "..."} até ${customEnd || "..."}`;
      }
      return "Personalizado";
    }
    return PERIOD_OPTIONS.find((p) => p.id === period)?.label || "30D";
  }, [period, customStart, customEnd]);

  // Overview data (drives Tab 1 + top provenance banner + badge counters)
  const overviewReqRef = useRef(0);
  const [overviewData, setOverviewData] = useState<MemoryOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const reqId = ++overviewReqRef.current;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      if (typeof apiService?.getMemoryEvolutionOverview !== "function") {
        throw new Error("Serviço de visão geral de Memória & Evolução indisponível.");
      }
      const range = resolvePeriodDates(period, customStart, customEnd);
      const res = await apiService.getMemoryEvolutionOverview({
        agentKey: selectedAgentKey !== "all" ? selectedAgentKey : undefined,
        sessionId: selectedSessionId !== "all" ? selectedSessionId : undefined,
        period: range.period,
        start: range.start,
        end: range.end,
      });
      if (reqId !== overviewReqRef.current) return;
      if ((res as any)?.success === false) {
        throw new Error((res as any)?.error || "Não foi possível carregar os indicadores.");
      }
      setOverviewData(res as MemoryOverviewResponse);
    } catch (err) {
      if (reqId !== overviewReqRef.current) return;
      setOverviewData(null);
      setOverviewError(extractErrorMessage(err, "Falha ao consultar visão geral no PostgreSQL."));
    } finally {
      if (reqId === overviewReqRef.current) setOverviewLoading(false);
    }
  }, [selectedAgentKey, selectedSessionId, period, customStart, customEnd, refreshTick]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleGlobalRefresh = () => {
    setRefreshTick((t) => t + 1);
  };

  const pendingApprovalsCount = overviewData?.pending?.awaitingApproval;
  const activeMemoriesCount = overviewData?.accumulated?.activeMemories;

  return (
    <div className="space-y-4">
      {/* HEADER & CONTEXT BAR */}
      <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {currentAvatarConfig ? (
              <div className="h-11 w-11 rounded-2xl bg-[#091120] border border-emerald-500/40 flex items-center justify-center overflow-hidden shrink-0">
                <ZaiAvatarRenderer
                  avatar={currentAvatarConfig}
                  state={currentAgent?.active === false || !isSessionConnected ? "IDLE" : "WORKING"}
                  size="sm"
                  showAura={false}
                  showStatusBadge={false}
                  showBrandingLayer={false}
                />
              </div>
            ) : (
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Brain className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm md:text-base font-bold text-foreground">
                  Memória & Evolução
                </h3>
                {selectedAgentKey !== "all" ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                    {currentAgent?.name || selectedAgentKey}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-border/70 text-muted-foreground">
                    Todos os atendentes
                  </Badge>
                )}
                {!isSessionConnected && (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-300">
                    WhatsApp offline • Dados reais do PostgreSQL
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Governança real de memórias corporativas, aprovações com rollback e explicabilidade por conversa.
              </p>
            </div>
          </div>

          {/* GLOBAL FILTERS: ATTENDANT + WHATSAPP + REFRESH */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background/50 px-2.5 h-9 text-xs">
              <Users className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-semibold text-muted-foreground">Atendente:</span>
              <select
                aria-label="Filtrar por atendente"
                value={selectedAgentKey}
                onChange={(e) => handleChangeAgent(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer"
              >
                <option value="all" className="bg-popover text-foreground">
                  Todos os atendentes
                </option>
                {selectableAgents.map((agent) => {
                  const key = String(agent.key || agent.id || "");
                  if (!key) return null;
                  return (
                    <option key={key} value={key} className="bg-popover text-foreground">
                      {agent.name || key}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background/50 px-2.5 h-9 text-xs">
              <Smartphone className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-semibold text-muted-foreground">WhatsApp:</span>
              <select
                aria-label="Filtrar por WhatsApp"
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground outline-none cursor-pointer max-w-[180px]"
              >
                <option value="all" className="bg-popover text-foreground">
                  Todos os WhatsApps
                </option>
                {whatsappSessions.map((sess) => (
                  <option key={sess.id} value={sess.id} className="bg-popover text-foreground">
                    {sess.name} {sess.connected ? "• Online" : "• Offline"}
                  </option>
                ))}
              </select>
            </label>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGlobalRefresh}
              disabled={overviewLoading}
              className="h-9 text-xs border-border/70 hover:border-emerald-500/40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", overviewLoading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* 4-TAB NAVIGATION + PERIOD FILTER */}
        <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3 pt-2 border-t border-border/50">
          <nav aria-label="Áreas de Memória e Evolução" className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer",
                activeTab === "overview"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-xs"
                  : "border-transparent bg-background/30 text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-emerald-400" />
              <span>Visão Geral</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("memory")}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer",
                activeTab === "memory"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-xs"
                  : "border-transparent bg-background/30 text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <Brain className="h-3.5 w-3.5 text-emerald-400" />
              <span>Cérebro & Memória</span>
              {activeMemoriesCount != null && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background/70 text-foreground">
                  {formatNumber(activeMemoriesCount)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("cognitive")}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer",
                activeTab === "cognitive"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-xs"
                  : "border-transparent bg-background/30 text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
              <span>Evolução Cognitiva</span>
              {typeof pendingApprovalsCount === "number" && pendingApprovalsCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  {formatNumber(pendingApprovalsCount)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("results")}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer",
                activeTab === "results"
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-xs"
                  : "border-transparent bg-background/30 text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              <Award className="h-3.5 w-3.5 text-emerald-400" />
              <span>Resultados & Conversas</span>
            </button>
          </nav>

          {/* BACKEND-DRIVEN PERIOD FILTER */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/70 bg-background/40 p-1 w-fit" data-testid="evolution-date-filter">
            <span className="inline-flex items-center gap-1 px-2 text-[11px] font-semibold text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-emerald-400" />
              Período:
            </span>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                  period === opt.id
                    ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                {opt.label}
              </button>
            ))}

            {period === "custom" && (
              <div className="flex items-center gap-1.5 px-1.5">
                <input
                  type="date"
                  aria-label="Data inicial"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-7 px-2 rounded-lg bg-background/70 border border-border/70 text-[11px] text-foreground outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-muted-foreground">até</span>
                <input
                  type="date"
                  aria-label="Data final"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-7 px-2 rounded-lg bg-background/70 border border-border/70 text-[11px] text-foreground outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* DATA ORIGIN & LAST UPDATED BANNER */}
        <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <Database className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-foreground shrink-0">Origem:</span>
            <span className="truncate">
              {overviewLoading && !overviewData ? "Consultando PostgreSQL..." : overviewData?.dataOrigin?.source || "—"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Atualizado em:</span>
            <strong className="font-mono text-foreground">
              {overviewLoading && !overviewData ? "…" : formatDateTime(overviewData?.dataOrigin?.lastUpdatedAt)}
            </strong>
          </div>
        </div>
      </div>

      {/* ACTIVE AREA */}
      {activeTab === "overview" && (
        <OverviewTabPanel
          data={overviewData}
          isLoading={overviewLoading}
          error={overviewError}
          periodLabel={activePeriodLabel}
          onRetry={() => void loadOverview()}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === "memory" && (
        <MemoryBrainTabPanel
          agentKey={selectedAgentKey}
          sessionId={selectedSessionId}
          agents={selectableAgents}
          sessions={whatsappSessions}
          refreshTrigger={refreshTick}
          onDataChanged={() => void loadOverview()}
        />
      )}

      {activeTab === "cognitive" && (
        <CognitiveEvolutionTabPanel
          agentKey={selectedAgentKey}
          refreshTrigger={refreshTick}
          onDataChanged={() => void loadOverview()}
        />
      )}

      {activeTab === "results" && (
        <ResultsConversationsTabPanel
          agentKey={selectedAgentKey}
          sessionId={selectedSessionId}
          period={period}
          customStart={customStart}
          customEnd={customEnd}
          periodLabel={activePeriodLabel}
          refreshTrigger={refreshTick}
        />
      )}
    </div>
  );
}
