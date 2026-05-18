import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useRuntime } from "@/providers/RuntimeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { status } = useRuntime();

  const websocketStatus =
    status === "online"
      ? "ONLINE"
      : status === "reconnecting"
        ? "RECONNECTING"
        : "OFFLINE";

  const websocketStatusTone =
    websocketStatus === "ONLINE"
      ? "default"
      : websocketStatus === "RECONNECTING"
        ? "secondary"
        : "destructive";

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
        <div className="sticky top-0 z-40 border-b border-border/70 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xs text-muted-foreground">Painel operacional ativo</p>
            <Badge variant={websocketStatusTone} className="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide">
              {websocketStatus}
            </Badge>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
