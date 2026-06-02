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
} from "@/services/apiService";
import { reportFrontendIssue } from "@/runtime/services/frontendHealthService";
import { useAppStore } from "@/stores/appStore";
import { useRuntime } from "@/providers/RuntimeProvider";

const STATUS_POLL_MS = 15_000;
const HEAVY_REFRESH_MS = 30_000;
const VALID_TABS = ["overview", "performance", "conversations", "ai", "schedule", "map"] as const;

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

  const activeSessions = useMemo(
    () => (Array.isArray(sessions) ? sessions.filter((s) => s && s.status === "connected").length : 0),
    [sessions]
  );
  const totalSessions = Array.isArray(sessions) ? sessions.length : 0;
  const sessionState = activeSessions > 0 ? "online" : "offline";

  const loadStatus = useCallback(async () => {
    try {
      await forceRefresh();
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

  const dashboardViewModel = useMemo(
    () =>
      createDashboardLovableViewModel({
        conversations,
        metrics: storeMetrics,
        sessions,
        runtimeStatus,
        sessionState,
        activeSessions,
        totalSessions,
      }),
    [conversations, storeMetrics, sessions, runtimeStatus, sessionState, activeSessions, totalSessions],
  );

  const analyticsViewModel = useMemo(
    () =>
      createAnalyticsLovableViewModel({
        metrics: storeMetrics,
        conversationCount: conversations.length,
        conversations,
      }),
    [storeMetrics, conversations],
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
      .map((columns) => columns.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
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
      <Header title="CRM Operacional" subtitle="Operação comercial unificada" />

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
        />
      </div>
    </div>
  );
}
