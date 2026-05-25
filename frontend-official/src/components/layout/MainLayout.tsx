import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setCollapsed(Boolean(customEvent.detail));
    };

    window.addEventListener(SIDEBAR_COLLAPSE_EVENT, handler as EventListener);
    return () => window.removeEventListener(SIDEBAR_COLLAPSE_EVENT, handler as EventListener);
  }, []);

  return (
    <div className="h-dvh w-full overflow-hidden bg-background flex">
      <Sidebar />
      <main
        className={
          isMobile
            ? "flex-1 flex flex-col min-w-0 h-dvh overflow-hidden"
            : collapsed
              ? "ml-[72px] flex-1 flex flex-col min-w-0 h-dvh overflow-hidden transition-all duration-200"
              : "ml-[260px] flex-1 flex flex-col min-w-0 h-dvh overflow-hidden transition-all duration-200"
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
