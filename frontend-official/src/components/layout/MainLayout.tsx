import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { NewConversationDialog } from "./NewConversationDialog";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const isInbox = location.pathname === "/inbox";

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setCollapsed(Boolean(customEvent.detail));
    };

    window.addEventListener(SIDEBAR_COLLAPSE_EVENT, handler as EventListener);
    return () => window.removeEventListener(SIDEBAR_COLLAPSE_EVENT, handler as EventListener);
  }, []);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background">
      <Sidebar />
      <main
        className={cn(
          "h-screen transition-all duration-200 animate-fade-in scrollbar-thin",
          isMobile
            ? "ml-0 w-full"
            : collapsed
              ? "ml-[88px] w-[calc(100%-88px)]"
              : "ml-[288px] w-[calc(100%-288px)]",
          isInbox ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden"
        )}
      >
        <Outlet />
      </main>
      <NewConversationDialog />
    </div>
  );
}

