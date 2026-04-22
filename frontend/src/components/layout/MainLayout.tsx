import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useFrontendHealthWatcher } from "@/hooks/useFrontendHealthWatcher";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  useFrontendHealthWatcher();

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setCollapsed(Boolean(customEvent.detail));
    };

    window.addEventListener(SIDEBAR_COLLAPSE_EVENT, handler as EventListener);
    return () => window.removeEventListener(SIDEBAR_COLLAPSE_EVENT, handler as EventListener);
  }, []);

  return (
    <div className="min-h-screen bg-background w-full">
      <Sidebar />
      <main
        className={
          isMobile
            ? "ml-0 min-h-screen w-full"
            : collapsed
              ? "ml-[72px] min-h-screen transition-all duration-200"
              : "ml-[240px] min-h-screen transition-all duration-200"
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
