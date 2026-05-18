import {
  type ZapAIRuntimeManifest,
  ZAPAI_RUNTIME_DIAG_STORAGE_KEY,
  ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY,
} from "@/config/buildInfo";
import { API_ORIGIN } from "@/lib/backendConfig";

export type RuntimeCoherenceSnapshot = {
  runtimeSource: string;
  buildHash: string;
  commit: string;
  frontendOrigin: string | null;
  apiOrigin: string | null;
  socketOrigin: string | null;
  expectedFrontend: string;
  expectedBackend: string;
  apiHealthy: boolean;
  websocketHealthy: boolean;
  buildHashMatch: boolean;
  cacheHealthy: boolean;
  chunkHealthy: boolean;
  checkedAt: string;
  mismatchReason: string | null;
};

function safeParseManifest(raw: string | null): ZapAIRuntimeManifest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ZapAIRuntimeManifest;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function readRuntimeManifest(): ZapAIRuntimeManifest | null {
  if (typeof window === "undefined") return null;
  if (window.__ZAPFLOW_RUNTIME__) return window.__ZAPFLOW_RUNTIME__;
  try {
    return safeParseManifest(localStorage.getItem(ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function buildRuntimeCoherenceSnapshot(input: {
  apiHealthy: boolean;
  websocketHealthy: boolean;
  socketOrigin?: string | null;
  mismatchReason?: string | null;
}): RuntimeCoherenceSnapshot {
  const manifest = readRuntimeManifest();
  const frontendOrigin = typeof window !== "undefined" ? window.location.origin : null;
  const apiOrigin = API_ORIGIN || frontendOrigin;
  const socketOrigin = input.socketOrigin ?? apiOrigin;
  const buildHashMatch = Boolean(manifest?.hash && window.ZAPAI_BUILD?.hash && manifest.hash === window.ZAPAI_BUILD.hash);
  const runtimeSource = manifest?.runtime || "unknown";
  const mismatchReason = input.mismatchReason ?? null;
  const cacheHealthy = mismatchReason == null;

  return {
    runtimeSource,
    buildHash: manifest?.hash || window.ZAPAI_BUILD?.hash || "unknown",
    commit: manifest?.commit || window.ZAPAI_BUILD?.commit || "unknown",
    frontendOrigin,
    apiOrigin,
    socketOrigin,
    expectedFrontend: manifest?.frontend || "8080",
    expectedBackend: manifest?.backend || "4025",
    apiHealthy: input.apiHealthy,
    websocketHealthy: input.websocketHealthy,
    buildHashMatch,
    cacheHealthy,
    chunkHealthy: true,
    checkedAt: new Date().toISOString(),
    mismatchReason,
  };
}

export function persistRuntimeCoherenceSnapshot(snapshot: RuntimeCoherenceSnapshot) {
  if (typeof window === "undefined") return;
  window.ZAPAI_RUNTIME_HEALTH = {
    buildHashMatch: snapshot.buildHashMatch,
    apiHealthy: snapshot.apiHealthy,
    websocketHealthy: snapshot.websocketHealthy,
    chunkHealthy: snapshot.chunkHealthy,
    cacheHealthy: snapshot.cacheHealthy,
    checkedAt: snapshot.checkedAt,
    runtimeSource: snapshot.runtimeSource,
    frontendOrigin: snapshot.frontendOrigin,
    apiOrigin: snapshot.apiOrigin,
    socketOrigin: snapshot.socketOrigin,
    mismatchReason: snapshot.mismatchReason,
  };

  try {
    localStorage.setItem(ZAPAI_RUNTIME_DIAG_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}
