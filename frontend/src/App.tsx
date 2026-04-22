import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageFallback } from "@/components/layout/PageFallback";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Connections = lazy(() => import("./pages/Connections"));
const Inbox = lazy(() => import("./pages/Inbox"));
const AI = lazy(() => import("./pages/AI"));
const Flows = lazy(() => import("./pages/Flows"));
const CRM = lazy(() => import("./pages/CRM"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Contacts = lazy(() => import("./pages/Contacts"));
const MessageTimers = lazy(() => import("./pages/MessageTimers"));
const FollowUp = lazy(() => import("./pages/FollowUp"));
const MediaLibrary = lazy(() => import("./pages/MediaLibrary"));
const Groups = lazy(() => import("./pages/Groups"));
const Scheduler = lazy(() => import("./pages/Scheduler"));
const HumanAlert = lazy(() => import("./pages/HumanAlert"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
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
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
