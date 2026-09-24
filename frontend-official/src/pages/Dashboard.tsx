import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { DashboardView } from "@/lovable/pages/DashboardView";
import {
  createDashboardLovableViewModel,
  getDashboardMapRows,
  type DashboardMapScope,
} from "@/adapters/lovable/dashboardAdapter";
import { createAnalyticsLovableViewModel } from "@/adapters/lovable/analyticsAdapter";
import {
  apiService,
  type MetricsSummary,
  type RuntimeHealthState,
  type AIStatusResponse,
  type AIMetricsResponse,
} from "@/services/apiService";
import { reportFrontendIssue } from "@/runtime/services/frontendHealthService";
import { useAppStore } from "@/stores/appStore";
import { useRuntime } from "@/providers/RuntimeProvider";

const STATUS_POLL_MS = 15_000;
const HEAVY_REFRESH_MS = 30_000;
const VALID_TABS = ["overview", "conversations", "ai", "commercial", "map"] as const;

type DashboardTab = (typeof VALID_TABS)[number];
type DashboardDateRange = "today" | "yesterday" | "7days" | "15days" | "30days" | "90days" | "week" | "month" | "year" | "hour" | "custom" | "all";

function normalizeTab(candidate: string | null): DashboardTab {
  return VALID_TABS.includes(candidate as DashboardTab) ? (candidate as DashboardTab) : "overview";
}

import { AIExecutiveInsightsCard } from "@/components/ai/AIExecutiveInsightsCard";

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSessionId = searchParams.get('sessionId');
  const { forceRefresh, status: runtimeStatus } = useRuntime();

  const sessions = useAppStore((state) => state.sessions);
  const conversations = useAppStore((state) => state.conversations);
  const storeMetrics = useAppStore((state) => state.metrics);

  const [activeTab, setActiveTab] = useState<DashboardTab>(() => normalizeTab(searchParams.get("tab")));
  const [activeMapScope, setActiveMapScope] = useState<DashboardMapScope>("regions");
  const [dateRange, setDateRange] = useState<DashboardDateRange>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");

  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AIMetricsResponse | null>(null);
  const [databaseMetrics, setDatabaseMetrics] = useState<MetricsSummary | null>(null);

  const metricWindow = useMemo(() => {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = new Date(0);
    let end = now;
    if (dateRange === 'today' || dateRange === 'day') start = day;
    if (dateRange === 'yesterday') { start = new Date(day.getTime() - 86_400_000); end = day; }
    const days = dateRange === '7days' ? 7 : dateRange === '15days' ? 15 : dateRange === '30days' ? 30 : dateRange === '90days' ? 90 : 0;
    if (days) start = new Date(now.getTime() - days * 86_400_000);
    if (dateRange === 'hour') start = new Date(now.getTime() - 3_600_000);
    if (dateRange === 'week') { start = new Date(day); start.setDate(day.getDate() - ((day.getDay() + 6) % 7)); }
    if (dateRange === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (dateRange === 'year') start = new Date(now.getFullYear(), 0, 1);
    if (dateRange === 'custom') {
      start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(0);
      end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : now;
    }
    if (timeStart) start.setHours(Number(timeStart.slice(0, 2)), Number(timeStart.slice(3, 5)), 0, 0);
    if (timeEnd) end.setHours(Number(timeEnd.slice(0, 2)), Number(timeEnd.slice(3, 5)), 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [dateRange, customStart, customEnd, timeStart, timeEnd]);

  useEffect(() => {
    let active = true;
    const load = () => apiService.getMetrics(selectedSessionId, metricWindow)
      .then((metrics) => { if (active) setDatabaseMetrics(metrics); })
      .catch((error) => reportFrontendIssue({ type: 'unexpected_error', service: 'dashboard.getMetrics', message: error instanceof Error ? error.message : 'Falha ao carregar métricas reais' }));
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, HEAVY_REFRESH_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedSessionId, metricWindow]);

  const activeSessions = useMemo(
    () => (Array.isArray(sessions) ? sessions.filter((s) => s && s.status === "connected").length : 0),
    [sessions]
  );
  const totalSessions = Array.isArray(sessions) ? sessions.length : 0;
  const sessionState = activeSessions > 0 ? "online" : "offline";

  const loadStatus = useCallback(async () => {
    try {
      await forceRefresh();
      const [status, metrics] = await Promise.all([
        apiService.getAIStatus().catch(() => null),
        apiService.getAIMetrics().catch(() => null),
      ]);
      setAiStatus(status);
      setAiMetrics(metrics);
    } catch (error) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "dashboard.loadStatus",
        message: error instanceof Error ? error.message : "Falha ao carregar status do dashboard",
      });
    }
  }, [forceRefresh]);

  useEffect(() => {
    void loadStatus();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadStatus();
    }, STATUS_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadStatus]);

  useEffect(() => {
    const nextTab = normalizeTab(searchParams.get("tab"));
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  const handleTabChange = useCallback(
    (nextTab: DashboardTab) => {
      setActiveTab(nextTab);
      const params = new URLSearchParams(searchParams);
      if (nextTab === 'overview') params.delete('tab'); else params.set('tab', nextTab);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleResetMap = useCallback(() => {
    setActiveMapScope("regions");
    handleTabChange("map");
  }, [handleTabChange]);

  // Filters only real conversation timestamps. No metric multipliers or estimates.
  const filteredConversations = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date | null = null;
    let end: Date | null = null;

    if (dateRange === "today" || dateRange === "day") start = startOfToday;
    if (dateRange === "yesterday") {
      start = new Date(startOfToday.getTime() - 86_400_000);
      end = startOfToday;
    }
    const rollingDays = dateRange === "7days" ? 7 : dateRange === "15days" ? 15 : dateRange === "30days" ? 30 : dateRange === "90days" ? 90 : 0;
    if (rollingDays) start = new Date(now.getTime() - rollingDays * 86_400_000);
    if (dateRange === "hour") start = new Date(now.getTime() - 3_600_000);
    if (dateRange === "week") {
      start = new Date(startOfToday);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    }
    if (dateRange === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (dateRange === "year") start = new Date(now.getFullYear(), 0, 1);
    if (dateRange === "custom") {
      start = customStart ? new Date(`${customStart}T00:00:00`) : null;
      end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
    }

    const startMinutes = timeStart ? Number(timeStart.slice(0, 2)) * 60 + Number(timeStart.slice(3, 5)) : null;
    const endMinutes = timeEnd ? Number(timeEnd.slice(0, 2)) * 60 + Number(timeEnd.slice(3, 5)) : null;

    return conversations.filter((conversation) => {
      if (selectedSessionId && conversation.sessionId !== selectedSessionId) return false;
      if (!conversation.updatedAt) return false;
      const timestamp = new Date(conversation.updatedAt);
      if (!Number.isFinite(timestamp.getTime())) return false;
      if (start && timestamp < start) return false;
      if (end && timestamp > end) return false;
      const minutes = timestamp.getHours() * 60 + timestamp.getMinutes();
      if (startMinutes != null && minutes < startMinutes) return false;
      if (endMinutes != null && minutes > endMinutes) return false;
      return true;
    });
  }, [conversations, customEnd, customStart, dateRange, timeEnd, timeStart, selectedSessionId]);

  const filteredMetrics = useMemo(() => {
    return databaseMetrics ? { ...storeMetrics, ...databaseMetrics } as MetricsSummary : null;
  }, [storeMetrics, databaseMetrics]);
  const dashboardViewModel = useMemo(
    () =>
      createDashboardLovableViewModel({
        conversations: filteredConversations,
        metrics: filteredMetrics,
        sessions,
        runtimeStatus,
        sessionState,
        activeSessions,
        totalSessions,
      }),
    [filteredConversations, filteredMetrics, sessions, runtimeStatus, sessionState, activeSessions, totalSessions],
  );

  const analyticsViewModel = useMemo(
    () =>
      createAnalyticsLovableViewModel({
        metrics: filteredMetrics,
        conversationCount: filteredConversations.length,
        conversations: filteredConversations,
      }),
    [filteredMetrics, filteredConversations],
  );

  const currentMapRows = useMemo(
    () => getDashboardMapRows(dashboardViewModel.map, activeMapScope),
    [activeMapScope, dashboardViewModel.map],
  );

  const handleExportMap = useCallback(() => {
    const header = ["escopo", "label", "detalhe", "leads", "percentual"];
    const scopeLabel = activeMapScope === "regions" ? "região" : activeMapScope === "states" ? "estado" : "ddd";
    const lines = currentMapRows.map((row) => [scopeLabel, row.label, row.meta, String(row.count), `${row.share}%`]);
    const csv = [header, ...lines]
      .map((columns) => columns.map((value) => `"${String(value).split('"').join('""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dashboard-mapa-${activeMapScope}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [activeMapScope, currentMapRows]);

  return (
    <div className="flex flex-col min-h-full bg-background">
      <Header title="Hub ZAI" subtitle="Central inteligente de atendimento, IA e inteligência comercial" />

      <div className="w-full max-w-[var(--content-max-width)] mx-auto px-3.5 sm:px-5 lg:px-6 py-3.5 sm:py-4 space-y-4">
        <AIExecutiveInsightsCard />
        <DashboardView
          viewModel={dashboardViewModel}
          analyticsViewModel={analyticsViewModel}
          activeTab={activeTab}
          activeMapScope={activeMapScope}
          mapRows={currentMapRows}
          onTabChange={handleTabChange}
          onMapScopeChange={setActiveMapScope}
          onResetMap={handleResetMap}
          onExportMap={handleExportMap}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          customStart={customStart}
          customEnd={customEnd}
          timeStart={timeStart}
          timeEnd={timeEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
          onTimeStartChange={setTimeStart}
          onTimeEndChange={setTimeEnd}
          aiStatus={aiStatus}
          aiMetrics={aiMetrics}
        />
      </div>
    </div>
  );
}
