import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useRuntime } from "@/providers/RuntimeProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";

const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapsed";

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { status } = useRuntime();
  const runtimeManifest = typeof window !== "undefined" ? window.__ZAPFLOW_RUNTIME__ : undefined;

  const runtimeTone =
    status === "online"
      ? "online"
      : status === "reconnecting"
        ? "warning"
        : "offline";

  const runtimeLabel =
    status === "online"
      ? "Runtime online"
      : status === "reconnecting"
        ? "Runtime degradado"
        : "Runtime offline";

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
            ? "ml-0 min-h-screen w-full"
            : collapsed
              ? "ml-[72px] min-h-screen transition-all duration-200"
              : "ml-[260px] min-h-screen transition-all duration-200"
        }
      >
        <div className="sticky top-0 z-30 border-b border-border/60 bg-background/80 px-4 py-2.5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                {runtimeManifest
                  ? `${runtimeManifest.runtime} · build ${runtimeManifest.hash} · ${runtimeManifest.frontend}/${runtimeManifest.backend}`
                  : "Runtime oficial"}
              </p>
              <p className="truncate text-xs text-muted-foreground">Workspace operacional unificado</p>
            </div>
            <OperationalStatusBadge label={runtimeLabel} tone={runtimeTone} pulse={status === "reconnecting"} />
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
