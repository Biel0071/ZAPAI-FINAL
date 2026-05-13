import { lazy, Suspense, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageFallback } from "@/components/layout/PageFallback";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AdminGuard from "@/components/admin/AdminGuard";
import { DebugTracePanel } from "@/components/DebugTracePanel";
import { BuildFooter } from "@/components/BuildFooter";
import { initializeCacheReset } from "@/lib/cacheReset";
import { validateRuntimeConfig } from "@/config/runtime";

const LAZY_RETRY_ATTEMPTS = 1;
const LAZY_RETRY_DELAY_MS = 200;
const RUNTIME_ALERT_KEY = "zapai_runtime_config_alerted";

function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  importer: () => Promise<T>,
  retries = LAZY_RETRY_ATTEMPTS,
): React.LazyExoticComponent<T["default"]> {
  return lazy(async () => {
    let attempt = 0;
    while (attempt <= retries) {
      try {
        return await importer();
      } catch (error) {
        attempt += 1;
        if (attempt > retries) throw error;
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, LAZY_RETRY_DELAY_MS);
        });
      }
    }
    throw new Error("Lazy import failed after retry attempts");
  });
}

const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Connections = lazyWithRetry(() => import("./pages/Connections"));
const Inbox = lazyWithRetry(() => import("./pages/Inbox"));
const Campaigns = lazyWithRetry(() => import("./pages/Campaigns"));
const Flows = lazyWithRetry(() => import("./pages/Flows"));
const AI = lazyWithRetry(() => import("./pages/AI"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const Diagnostics = lazyWithRetry(() => import("./pages/Diagnostics"));
const Contacts = lazyWithRetry(() => import("./pages/Contacts"));
const AdminMaster = lazyWithRetry(() => import("./pages/AdminMaster"));
const AdminSystem = lazyWithRetry(() => import("./pages/AdminSystem"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function App() {
  const bootInitializedRef = useRef(false);

  // Boot sequence (idempotent under React StrictMode)
  useEffect(() => {
    if (bootInitializedRef.current) return;
    bootInitializedRef.current = true;

    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");

    initializeCacheReset().catch((error) => {
      console.error("Failed to initialize cache reset:", error);
    });

    const validation = validateRuntimeConfig();
    if (!validation.valid) {
      console.error("Runtime config validation failed:", validation.errors);
      // Removed the alert. Just log and continue.
    }
  }, []);

  return (
    <>
      <GlobalErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    {/* Public routes — no layout, no auth required */}
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* Protected routes — require auth */}
                    <Route element={<ProtectedRoute />}>
                      <Route element={<MainLayout />}>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/connections" element={<Connections />} />
                        <Route path="/inbox" element={<Inbox />} />
                        <Route path="/contacts" element={<Contacts />} />
                        <Route path="/ai" element={<AI />} />
                        <Route path="/flows" element={<Flows />} />
                        <Route path="/campaigns" element={<Campaigns />} />
                        <Route path="/diagnostics" element={<Diagnostics />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/admin/master" element={
                          <AdminGuard>
                            <AdminMaster />
                          </AdminGuard>
                        } />
                        <Route path="/admin/system" element={
                          <AdminGuard>
                            <AdminSystem />
                          </AdminGuard>
                        } />
                      </Route>
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </GlobalErrorBoundary>
      <DebugTracePanel />
      <BuildFooter />
    </>
  );
}

export default App;
