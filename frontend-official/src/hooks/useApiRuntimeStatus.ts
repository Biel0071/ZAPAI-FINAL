import { useEffect, useRef } from "react";
import { API_ORIGIN, IS_API_URL_CONFIGURED, IS_MIXED_CONTENT_BLOCKED } from "@/lib/backendConfig";
import { getCurrentTenantId } from "@/lib/apiGuard";
import { useAppStore } from "@/stores/appStore";

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
  const response = await fetch(`${API_ORIGIN}/health`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
      "x-tenant-id": getCurrentTenantId(),
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
  const connectionState = useAppStore((state) => state.apiHealth);
  const latencyMs = useAppStore((state) => state.apiLatency);
  const isOnline = connectionState === "ONLINE";
  const apiLabel = isOnline ? "ONLINE" : "OFFLINE";

  const retryDelayRef = useRef(OFFLINE_BASE_RETRY_MS);
  const offlineStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runProbeRef = useRef<() => void>(() => {});

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;

    if (!IS_API_URL_CONFIGURED || !API_ORIGIN) {
      useAppStore.getState().updateApiHealth("OFFLINE", null);
      return () => {
        mounted = false;
      };
    }

    const schedule = (ms: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        runProbeRef.current();
      }, ms);
    };

    const runProbe = async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const nextStatus = await pingBackend(controller.signal);
        if (!mounted) return;

        if (nextStatus.online) {
          offlineStartedAtRef.current = null;
          retryDelayRef.current = OFFLINE_BASE_RETRY_MS;
          useAppStore.getState().updateApiHealth("ONLINE", nextStatus.latencyMs);
          schedule(ONLINE_REVALIDATE_MS);
          return;
        }

        if (!offlineStartedAtRef.current) {
          offlineStartedAtRef.current = Date.now();
        }

        const offlineForMs = Date.now() - (offlineStartedAtRef.current ?? Date.now());
        const nextState = offlineForMs < 30_000 ? "RECONNECTING" : "OFFLINE";
        useAppStore.getState().updateApiHealth(nextState, nextStatus.latencyMs);

        const nextDelay = Math.min(retryDelayRef.current, OFFLINE_MAX_RETRY_MS);
        schedule(nextDelay);
        retryDelayRef.current = Math.min(Math.round(nextDelay * 1.6), OFFLINE_MAX_RETRY_MS);
      } catch {
        if (!mounted) return;

        if (!offlineStartedAtRef.current) {
          offlineStartedAtRef.current = Date.now();
        }
        const offlineForMs = Date.now() - (offlineStartedAtRef.current ?? Date.now());
        const nextState = offlineForMs < 30_000 ? "RECONNECTING" : "OFFLINE";
        useAppStore.getState().updateApiHealth(nextState, null);

        const nextDelay = Math.min(retryDelayRef.current, OFFLINE_MAX_RETRY_MS);
        schedule(nextDelay);
        retryDelayRef.current = Math.min(Math.round(nextDelay * 1.6), OFFLINE_MAX_RETRY_MS);
      }
    };

    runProbeRef.current = () => {
      void runProbe();
    };

    void runProbe();

    return () => {
      mounted = false;
      clearTimer();
      abortRef.current?.abort();
    };
  }, []);

  const manualReconnect = () => {
    offlineStartedAtRef.current = null;
    retryDelayRef.current = OFFLINE_BASE_RETRY_MS;
    clearTimer();
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    void pingBackend(controller.signal)
      .then((nextStatus) => {
        useAppStore.getState().updateApiHealth(nextStatus.online ? "ONLINE" : "OFFLINE", nextStatus.latencyMs);
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          runProbeRef.current();
        }, nextStatus.online ? ONLINE_REVALIDATE_MS : OFFLINE_BASE_RETRY_MS);
      })
      .catch(() => {
        useAppStore.getState().updateApiHealth("OFFLINE", null);
      });
  };

  return {
    apiLabel,
    connectionState,
    latencyMs,
    isOnline,
    retryIntervalMs: OFFLINE_BASE_RETRY_MS,
    manualReconnect,
  };
}
