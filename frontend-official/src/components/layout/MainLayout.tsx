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
    <div className="min-h-screen w-full bg-background">
      <Sidebar />
      <main
        className={
          isMobile
            ? "ml-0 min-h-screen w-full overflow-x-hidden"
            : collapsed
              ? "ml-[88px] min-h-screen w-[calc(100%-88px)] overflow-x-hidden transition-all duration-200"
              : "ml-[288px] min-h-screen w-[calc(100%-288px)] overflow-x-hidden transition-all duration-200"
        }
      >
        <Outlet />
      </main>
    </div>
  );
}
