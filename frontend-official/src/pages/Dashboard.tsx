import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { DashboardView } from "@/lovable/pages/DashboardView";
import {
  createDashboardLovableViewModel,
  getDashboardMapRows,
  type DashboardMapScope,
} from "@/adapters/lovable/dashboardAdapter";
import {
  apiService,
  type MetricsSummary,
  type RuntimeHealthState,
} from "@/services/apiService";
import { reportFrontendIssue } from "@/services/frontendHealthService";
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
  const runtime = useRuntime();

  const sessions = useAppStore((state) => state.sessions);
  const conversations = useAppStore((state) => state.conversations);
  const storeMetrics = useAppStore((state) => state.metrics);

  const [sessionState, setSessionState] = useState<RuntimeHealthState>("offline");
  const [activeSessions, setActiveSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [metricsSnapshot, setMetricsSnapshot] = useState<MetricsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => normalizeTab(searchParams.get("tab")));
  const [activeMapScope, setActiveMapScope] = useState<DashboardMapScope>("regions");
  const lastHeavyFetchAtRef = useRef(0);

  const loadStatus = useCallback(async () => {
    try {
      const shouldRefreshHeavyData = Date.now() - lastHeavyFetchAtRef.current >= HEAVY_REFRESH_MS;
      const [healthStatusResult, metricsResult] = await Promise.allSettled([
        apiService.getRuntimeSessionHealth(),
        shouldRefreshHeavyData ? apiService.getMetrics() : Promise.resolve(null),
      ]);

      if (shouldRefreshHeavyData) {
        lastHeavyFetchAtRef.current = Date.now();
      }

      const healthStatus =
        healthStatusResult.status === "fulfilled"
          ? healthStatusResult.value
          : ({ sessions: "offline", activeSessions: 0, totalSessions: 0 } as const);

      setSessionState(healthStatus.sessions);
      setActiveSessions(healthStatus.activeSessions);
      setTotalSessions(healthStatus.totalSessions);

      if (metricsResult.status === "fulfilled" && metricsResult.value) {
        setMetricsSnapshot(metricsResult.value);
      }
    } catch (error) {
      reportFrontendIssue({
        type: "unexpected_error",
        service: "dashboard.loadStatus",
        message: error instanceof Error ? error.message : "Falha ao carregar status do dashboard",
      });
      setSessionState("offline");
    }
  }, []);

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
        metrics: metricsSnapshot ?? storeMetrics,
        sessions,
        runtimeStatus: runtime.status,
        sessionState,
        activeSessions,
        totalSessions,
      }),
    [activeSessions, conversations, metricsSnapshot, runtime.status, sessionState, sessions, storeMetrics, totalSessions],
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
