import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageFallback } from "@/components/layout/PageFallback";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import AdminGuard from "@/components/admin/AdminGuard";
import { DebugTracePanel } from "@/components/DebugTracePanel";
import { BuildFooter } from "@/components/BuildFooter";
import { initializeCacheReset } from "@/lib/cacheReset";
import { validateRuntimeConfig } from "@/config/runtime";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Connections = lazy(() => import("./pages/Connections"));
const Inbox = lazy(() => import("./pages/Inbox"));
const CRM = lazy(() => import("./pages/CRM"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Flows = lazy(() => import("./pages/Flows"));
const AI = lazy(() => import("./pages/AI"));
const Settings = lazy(() => import("./pages/Settings"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Contacts = lazy(() => import("./pages/Contacts"));
const MessageTimers = lazy(() => import("./pages/MessageTimers"));
const FollowUp = lazy(() => import("./pages/FollowUp"));
const MediaLibrary = lazy(() => import("./pages/MediaLibrary"));
const Groups = lazy(() => import("./pages/Groups"));
const Scheduler = lazy(() => import("./pages/Scheduler"));
const HumanAlert = lazy(() => import("./pages/HumanAlert"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AdminMaster = lazy(() => import("./pages/AdminMaster"));
const Map = lazy(() => import("./pages/Map"));
const QuickReplies = lazy(() => import("./pages/QuickReplies"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
  // Force dark theme for consistent visual appearance
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  // Initialize cache reset on boot
  useEffect(() => {
    initializeCacheReset().catch((error) => {
      console.error('Failed to initialize cache reset:', error);
    });
  }, []);

  // Validate runtime config on boot
  useEffect(() => {
    const validation = validateRuntimeConfig();
    if (!validation.valid) {
      console.error('Runtime config validation failed:', validation.errors);
      if (import.meta.env.MODE === 'production') {
        alert('Configuration error. Please contact support.');
      }
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
                    <Route element={<MainLayout />}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/connections" element={<Connections />} />
                      <Route path="/inbox" element={<Inbox />} />
                      <Route path="/contacts" element={<Contacts />} />
                      <Route path="/ai" element={<AI />} />
                      <Route path="/timers" element={<MessageTimers />} />
                      <Route path="/follow-up" element={<FollowUp />} />
                      <Route path="/media-library" element={<MediaLibrary />} />
                      <Route path="/groups" element={<Groups />} />
                      <Route path="/scheduler" element={<Scheduler />} />
                      <Route path="/human-alert" element={<HumanAlert />} />
                      <Route path="/access-control" element={<AccessControl />} />
                      <Route path="/flows" element={<Flows />} />
                      <Route path="/crm" element={<CRM />} />
                      <Route path="/analytics" element={<Analytics />} />
                      <Route path="/campaigns" element={<Campaigns />} />
                      <Route path="/diagnostics" element={<Diagnostics />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/admin/master" element={
                        <AdminGuard>
                          <AdminMaster />
                        </AdminGuard>
                      } />
                      <Route path="/map" element={<Map />} />
                      <Route path="/quick-replies" element={<QuickReplies />} />
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
