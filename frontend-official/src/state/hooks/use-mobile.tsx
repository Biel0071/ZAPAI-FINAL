import * as React from "react";

export const MOBILE_BREAKPOINT = 768;

export type AppViewMode = "auto" | "mobile" | "desktop";
export const VIEW_MODE_STORAGE_KEY = "zapflow_view_mode";
export const VIEW_MODE_CHANGE_EVENT = "zapflow:viewmode:changed";

export function getViewMode(): AppViewMode {
  if (typeof window === "undefined") return "auto";
  try {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (saved === "mobile" || saved === "desktop" || saved === "auto") {
      return saved;
    }
  } catch {}
  return "auto";
}

export function setViewMode(mode: AppViewMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {}
  window.dispatchEvent(new CustomEvent<AppViewMode>(VIEW_MODE_CHANGE_EVENT, { detail: mode }));
}

export function useViewMode(): [AppViewMode, (mode: AppViewMode) => void] {
  const [mode, setModeState] = React.useState<AppViewMode>(() => getViewMode());

  React.useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<AppViewMode>;
      setModeState(customEvent.detail || getViewMode());
    };
    window.addEventListener(VIEW_MODE_CHANGE_EVENT, handler as EventListener);
    return () => window.removeEventListener(VIEW_MODE_CHANGE_EVENT, handler as EventListener);
  }, []);

  const updateMode = React.useCallback((next: AppViewMode) => {
    setViewMode(next);
  }, []);

  return [mode, updateMode];
}

export function useIsMobile() {
  const [mode] = useViewMode();
  const [windowIsMobile, setWindowIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setWindowIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setWindowIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (mode === "mobile") return true;
  if (mode === "desktop") return false;
  return windowIsMobile;
}
