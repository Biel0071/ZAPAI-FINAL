import { useEffect, useRef, useState } from "react";
import { API_ORIGIN, IS_API_URL_CONFIGURED, IS_MIXED_CONTENT_BLOCKED } from "@/lib/backendConfig";

const OFFLINE_BASE_RETRY_MS = 12_000;
const OFFLINE_MAX_RETRY_MS = 45_000;
const ONLINE_REVALIDATE_MS = 60_000;

type ApiRuntimeStatus = {
  online: boolean;
  latencyMs: number | null;
};

async function pingBackend(signal: AbortSignal): Promise<ApiRuntimeStatus> {
  if (IS_MIXED_CONTENT_BLOCKED) {
    return { online: false, latencyMs: null };
  }

  if (!IS_API_URL_CONFIGURED || !API_ORIGIN) {
    return { online: false, latencyMs: null };
  }

  const startedAt = performance.now();
  const response = await fetch(`${API_ORIGIN}/api/health`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
      "x-tenant-id": "main",
      "ngrok-skip-browser-warning": "true",
    },
  });

  const latencyMs = Math.round(performance.now() - startedAt);
  if (!response.ok) {
    return { online: false, latencyMs };
  }

  return { online: true, latencyMs };
}

export function useApiRuntimeStatus() {
  const [status, setStatus] = useState<ApiRuntimeStatus>({
    online: IS_API_URL_CONFIGURED,
    latencyMs: null,
  });
  const retryDelayRef = useRef(OFFLINE_BASE_RETRY_MS);
  const offlineStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!IS_API_URL_CONFIGURED || !API_ORIGIN) {
      setStatus({ online: false, latencyMs: null });
      return () => {
        mounted = false;
      };
    }

    const clearTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const schedule = (ms: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        void runProbe();
      }, ms);
    };

    const runProbe = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const nextStatus = await pingBackend(controller.signal);
        if (!mounted) return;

        setStatus(nextStatus);
        if (nextStatus.online) {
          offlineStartedAtRef.current = null;
          retryDelayRef.current = OFFLINE_BASE_RETRY_MS;
          schedule(ONLINE_REVALIDATE_MS);
          return;
        }

        if (!offlineStartedAtRef.current) {
          offlineStartedAtRef.current = Date.now();
        }

        const nextDelay = Math.min(retryDelayRef.current, OFFLINE_MAX_RETRY_MS);
        schedule(nextDelay);
        retryDelayRef.current = Math.min(Math.round(nextDelay * 1.6), OFFLINE_MAX_RETRY_MS);
      } catch {
        if (!mounted) return;

        setStatus({ online: false, latencyMs: null });
        if (!offlineStartedAtRef.current) {
          offlineStartedAtRef.current = Date.now();
        }
        const nextDelay = Math.min(retryDelayRef.current, OFFLINE_MAX_RETRY_MS);
        schedule(nextDelay);
        retryDelayRef.current = Math.min(Math.round(nextDelay * 1.6), OFFLINE_MAX_RETRY_MS);
      }
    };

    void runProbe();

    return () => {
      mounted = false;
      clearTimer();
      abortRef.current?.abort();
    };
  }, []);

  const apiLabel = status.online ? "ONLINE" : "OFFLINE";
  const offlineForMs = offlineStartedAtRef.current ? Date.now() - offlineStartedAtRef.current : 0;
  const connectionState: "ONLINE" | "RECONNECTING" | "OFFLINE" = status.online
    ? "ONLINE"
    : offlineForMs < 30_000
      ? "RECONNECTING"
      : "OFFLINE";

  return {
    apiLabel,
    connectionState,
    latencyMs: status.latencyMs,
    isOnline: status.online,
    retryIntervalMs: OFFLINE_BASE_RETRY_MS,
  };
}