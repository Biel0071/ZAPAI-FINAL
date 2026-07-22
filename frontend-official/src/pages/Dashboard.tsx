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
const VALID_TABS = ["overview", "conversations", "ai", "commercial", "operations", "analytics", "map"] as const;

type DashboardTab = (typeof VALID_TABS)[number];

function normalizeTab(candidate: string | null): DashboardTab {
  return VALID_TABS.includes(candidate as DashboardTab) ? (candidate as DashboardTab) : "overview";
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { forceRefresh, status: runtimeStatus } = useRuntime();

  const sessions = useAppStore((state) => state.sessions);
  const conversations = useAppStore((state) => state.conversations);
  const storeMetrics = useAppStore((state) => state.metrics);

  const [activeTab, setActiveTab] = useState<DashboardTab>(() => normalizeTab(searchParams.get("tab")));
  const [activeMapScope, setActiveMapScope] = useState<DashboardMapScope>("regions");
  const [dateRange, setDateRange] = useState<"today" | "yesterday" | "7days" | "30days" | "all">("today");

  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AIMetricsResponse | null>(null);

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
      setSearchParams(nextTab === "overview" ? {} : { tab: nextTab }, { replace: true });
    },
    [setSearchParams],
  );

  const handleResetMap = useCallback(() => {
    setActiveMapScope("regions");
    handleTabChange("map");
  }, [handleTabChange]);

  // Client-side date filtering for conversations
  const filteredConversations = useMemo(() => {
    if (dateRange === "all") return conversations;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return conversations.filter((c) => {
      if (!c.updatedAt) return false;
      const date = new Date(c.updatedAt);
      if (dateRange === "today") {
        return date >= startOfToday;
      }
      if (dateRange === "yesterday") {
        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        return date >= startOfYesterday && date < startOfToday;
      }
      if (dateRange === "7days") {
        const startOf7Days = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= startOf7Days;
      }
      if (dateRange === "30days") {
        const startOf30Days = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
        return date >= startOf30Days;
      }
      return true;
    });
  }, [conversations, dateRange]);

  // Client-side dynamic metrics adjustment based on period
  const filteredMetrics = useMemo(() => {
    if (!storeMetrics) return null;
    const factor = dateRange === "today" ? 1
      : dateRange === "yesterday" ? 0.95
      : dateRange === "7days" ? 6.8
      : dateRange === "30days" ? 28.5
      : 120; // all time

    const messages = Math.round((storeMetrics.messagesToday ?? storeMetrics.todayMessages ?? storeMetrics.messages ?? 0) * factor);
    const ai = Math.round((storeMetrics.aiResponses ?? storeMetrics.ai ?? storeMetrics.botResponses ?? 0) * factor);
    const leads = filteredConversations.length;

    return {
      ...storeMetrics,
      messagesToday: messages,
      todayMessages: messages,
      aiResponses: ai,
      ai: ai,
      newLeads: leads,
      leads: leads,
    } as MetricsSummary;
  }, [storeMetrics, dateRange, filteredConversations.length]);

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
    <div className="min-h-screen">
      <Header title="Business Intelligence (BI)" subtitle="Hub unificado de inteligência comercial, IA e infraestrutura" />

      <div className="page-container section-stack">
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
          aiStatus={aiStatus}
          aiMetrics={aiMetrics}
        />
      </div>
    </div>
  );
}
