import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import { NewConversationDialog } from "./NewConversationDialog";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("zapflow_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const isMobile = useIsMobile();
  const location = useLocation();
  const isInbox = location.pathname === "/inbox";
  const isMobileChatOpen = useAppStore((state) => state.isMobileChatOpen);
  const isInboxActiveChat = isMobile && isInbox && isMobileChatOpen;

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setCollapsed(Boolean(customEvent.detail));
    };

    window.addEventListener(SIDEBAR_COLLAPSE_EVENT, handler as EventListener);
    return () => window.removeEventListener(SIDEBAR_COLLAPSE_EVENT, handler as EventListener);
  }, []);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background relative">
      <div className="flex-1 w-full flex overflow-hidden relative">
        <Sidebar />
        <main
          className={cn(
            "h-screen transition-all duration-200 animate-fade-in scrollbar-thin flex flex-col min-w-0",
            isMobile
              ? "ml-0 w-full"
              : collapsed
                ? "ml-[var(--sidebar-width-collapsed)] w-[calc(100%-var(--sidebar-width-collapsed))]"
                : "ml-[var(--sidebar-width)] w-[calc(100%-var(--sidebar-width))]",
            isInboxActiveChat
              ? "overflow-hidden pb-0"
              : isMobile
                ? "overflow-y-auto overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
                : isInbox
                  ? "overflow-hidden"
                  : "overflow-y-auto overflow-x-hidden"
          )}
        >
          <Outlet />
        </main>
      </div>
      {isMobile && <MobileBottomNav />}
      <NewConversationDialog />
    </div>
  );
}
