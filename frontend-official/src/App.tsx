import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageFallback } from "@/components/layout/PageFallback";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { SafeRender } from "@/components/system/SafeRender";
import { type AppUserRole, useUserRole } from "@/hooks/useUserRole";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useFrontendHealthWatcher } from "@/hooks/useFrontendHealthWatcher";
import { RuntimeProvider } from "@/providers/RuntimeProvider";
import { InboxRuntimeBoundary } from "@/components/system/InboxRuntimeBoundary";

import { PageRouteBoundary } from "@/components/system/PageRouteBoundary";

function AppSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
        <span>Inicializando sistema…</span>
      </div>
    </div>
  );
}

function BootGate({ children }: { children: JSX.Element }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 160);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return <AppSplash />;
  return children;
}

function lazyWithRetry<T extends ComponentType<any>>(importer: () => Promise<{ default: T }>, key: string) {
  let retried = false;

  return lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      const isChunkLoadError =
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed") ||
        message.toLowerCase().includes("chunk");

      if (isChunkLoadError && !retried) {
        retried = true;
        console.warn(`[lazyWithRetry] retrying module load for ${key}`);
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        return importer();
      }

      throw error;
    }
  });
}

const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"), "dashboard");
const Inbox = lazyWithRetry(() => import("./pages/Inbox"), "inbox");
const Connections = lazyWithRetry(() => import("./pages/Connections"), "connections");
const Contacts = lazyWithRetry(() => import("./pages/Contacts"), "contacts");
const Flows = lazyWithRetry(() => import("./pages/Flows"), "flows");
const AI = lazyWithRetry(() => import("./pages/AI"), "ai");
const Analytics = lazyWithRetry(() => import("./pages/Analytics"), "analytics");
const Campaigns = lazyWithRetry(() => import("./pages/Campaigns"), "campaigns");
const Diagnostics = lazyWithRetry(() => import("./runtime/diagnostics/Diagnostics"), "diagnostics");
const Settings = lazyWithRetry(() => import("./pages/Settings"), "settings");
const Login = lazyWithRetry(() => import("./pages/Login"), "login");
const MasterNodes = lazyWithRetry(() => import("./pages/MasterNodes"), "master_nodes");
const NodeDetails = lazyWithRetry(() => import("./pages/NodeDetails"), "node_details");
const MasterDeployments = lazyWithRetry(() => import("./pages/MasterDeployments"), "master_deployments");
const MasterLogs = lazyWithRetry(() => import("./pages/MasterLogs"), "master_logs");
const MasterAdmins = lazyWithRetry(() => import("./pages/MasterAdmins"), "master_admins");
const MasterVersions = lazyWithRetry(() => import("./pages/MasterVersions"), "master_versions");
const Memory = lazyWithRetry(() => import("./pages/Memory"), "memory");

function RequireAdminAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) return <AppSplash />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

function LoginRoute() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return <AppSplash />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

function ProtectedRoute({ minRole, children }: { minRole: AppUserRole; children: JSX.Element }) {
  const { role, isLoading, roleLevel } = useUserRole();
  const currentLevel = roleLevel[role] ?? roleLevel.user;

  if (isLoading) return <AppSplash />;
  if (currentLevel < roleLevel[minRole]) return <Navigate to="/dashboard" replace />;

  return children;
}

function RootRoute() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return <AppSplash />;
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

function CatchAllRoute() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  if (isLoading) return <AppSplash />;
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

const App = () => {
  useFrontendHealthWatcher();

  return (
    <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <BootGate>
              <SafeRender scope="app-routes">
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/login" element={<LoginRoute />} />
                    <Route element={<RequireAdminAuth><RuntimeProvider><MainLayout /></RuntimeProvider></RequireAdminAuth>}>
                      <Route path="/" element={<RootRoute />} />
                      <Route path="/dashboard" element={<PageRouteBoundary pageName="Dashboard"><Dashboard /></PageRouteBoundary>} />
                      <Route path="/inbox" element={<InboxRuntimeBoundary><Inbox /></InboxRuntimeBoundary>} />
                      <Route path="/connections" element={<PageRouteBoundary pageName="Conexões"><Connections /></PageRouteBoundary>} />
                      <Route path="/contacts" element={<PageRouteBoundary pageName="Contatos"><Contacts /></PageRouteBoundary>} />
                      <Route path="/flows" element={<PageRouteBoundary pageName="Fluxos"><Flows /></PageRouteBoundary>} />
                      <Route path="/ai" element={<PageRouteBoundary pageName="Inteligência Artificial"><AI /></PageRouteBoundary>} />
                      <Route path="/analytics" element={<PageRouteBoundary pageName="Relatórios & Métricas"><Analytics /></PageRouteBoundary>} />
                      <Route path="/campaigns" element={<PageRouteBoundary pageName="Campanhas"><Campaigns /></PageRouteBoundary>} />
                      <Route path="/automation" element={<Navigate to="/flows" replace />} />
                      <Route path="/integrations" element={<Navigate to="/connections" replace />} />
                      <Route path="/dev-tools" element={<ProtectedRoute minRole="user"><Navigate to="/diagnostics" replace /></ProtectedRoute>} />
                      <Route path="/memory" element={<PageRouteBoundary pageName="Memória de Sistema"><Memory /></PageRouteBoundary>} />
                      <Route path="/users" element={<ProtectedRoute minRole="user"><PageRouteBoundary pageName="Usuários Master"><MasterAdmins /></PageRouteBoundary></ProtectedRoute>} />

                      <Route path="/nodes" element={<ProtectedRoute minRole="user"><PageRouteBoundary pageName="Nós do Cluster"><MasterNodes /></PageRouteBoundary></ProtectedRoute>} />
                      <Route path="/nodes/:id" element={<ProtectedRoute minRole="user"><PageRouteBoundary pageName="Detalhes do Nó"><NodeDetails /></PageRouteBoundary></ProtectedRoute>} />
                      <Route path="/deployments" element={<ProtectedRoute minRole="user"><PageRouteBoundary pageName="Implantações"><MasterDeployments /></PageRouteBoundary></ProtectedRoute>} />
                      <Route path="/logs" element={<ProtectedRoute minRole="user"><PageRouteBoundary pageName="Logs do Cluster"><MasterLogs /></PageRouteBoundary></ProtectedRoute>} />
                      <Route path="/versions" element={<ProtectedRoute minRole="user"><PageRouteBoundary pageName="Histórico de Versões"><MasterVersions /></PageRouteBoundary></ProtectedRoute>} />
                      <Route path="/system/runtime" element={<Navigate to="/diagnostics" replace />} />
                      <Route path="/system/performance" element={<Navigate to="/diagnostics" replace />} />
                      <Route path="/system/websocket" element={<Navigate to="/diagnostics" replace />} />
                      <Route path="/system/database" element={<Navigate to="/diagnostics" replace />} />
                      <Route path="/system/files" element={<Navigate to="/diagnostics" replace />} />
                      <Route path="/system/health" element={<Navigate to="/diagnostics" replace />} />
                      <Route path="/system/metrics" element={<Navigate to="/diagnostics" replace />} />

                      <Route
                        path="/diagnostics"
                        element={
                          <ProtectedRoute minRole="user">
                            <PageRouteBoundary pageName="Status & Saúde">
                              <Diagnostics />
                            </PageRouteBoundary>
                          </ProtectedRoute>
                        }
                      />

                      <Route path="/settings" element={<PageRouteBoundary pageName="Configurações"><Settings /></PageRouteBoundary>} />
                    </Route>
                    <Route path="*" element={<CatchAllRoute />} />
                  </Routes>
                </Suspense>
              </SafeRender>
            </BootGate>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
