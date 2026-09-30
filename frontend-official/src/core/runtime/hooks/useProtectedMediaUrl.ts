import { useCallback, useEffect, useState } from "react";
import { ADMIN_AUTH_CHANGED_EVENT } from "@/core/lib/adminAuthSession";
import { authorizeMediaUrl } from "../utils/inboxNormalization";

/** Authorize media once and renew it while the preview is mounted. */
export function useProtectedMedia(rawUrl?: string | null) {
  const [state, setState] = useState<{ source: string | null; revision: number; url: string | null; loading: boolean; error: boolean }>({ source: null, revision: 0, url: null, loading: false, error: false });
  const [revision, setRevision] = useState(0);
  const source = rawUrl || null;
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    window.addEventListener(ADMIN_AUTH_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ADMIN_AUTH_CHANGED_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState({ source, revision, url: null, loading: Boolean(source), error: false });
    const load = async () => {
      const access = await authorizeMediaUrl(source, revision > 0);
      if (!active) return;
      setState({ source, revision, url: access?.url || null, loading: false, error: Boolean(source && !access) });
      if (access?.expiresAt) timer = setTimeout(() => { if (active) refresh(); }, Math.max(1000, access.expiresAt - Date.now() - 60_000));
    };
    void load();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [source, revision, refresh]);

  const current = state.source === source && state.revision === revision;
  return { url: current ? state.url : null, loading: current ? state.loading : Boolean(source), error: current && state.error, refresh };
}

export function useProtectedMediaUrl(rawUrl?: string | null): string | null {
  return useProtectedMedia(rawUrl).url;
}
