/**
 * Feature flag & safe runtime rollback switch between Avatar Engine 2.0 ("glb")
 * and preserved procedural Three.js engine ("procedural").
 *
 * Resolution priority:
 *  1. Query parameter `?avatarEngine=procedural|glb`
 *  2. localStorage `"zai_avatar_engine"`
 *  3. Vite env `VITE_AVATAR_ENGINE`
 *  4. Default: `"glb"`
 */

export type AvatarEngineKind = "glb" | "procedural";

const STORAGE_KEY = "zai_avatar_engine";

export function normalizeAvatarEngineKind(raw?: string | null): AvatarEngineKind | null {
  if (!raw) return null;
  const val = raw.trim().toLowerCase();
  if (val === "procedural" || val === "v1" || val === "legacy") return "procedural";
  if (val === "glb" || val === "v2" || val === "modular") return "glb";
  return null;
}

export function getActiveAvatarEngine(): AvatarEngineKind {
  if (typeof window !== "undefined") {
    try {
      const qs = new URLSearchParams(window.location.search).get("avatarEngine");
      const fromQuery = normalizeAvatarEngineKind(qs);
      if (fromQuery) return fromQuery;
    } catch {
      // Ignore invalid location access
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const fromStorage = normalizeAvatarEngineKind(stored);
      if (fromStorage) return fromStorage;
    } catch {
      // Ignore blocked storage
    }
  }

  try {
    const envVal = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.VITE_AVATAR_ENGINE;
    const fromEnv = normalizeAvatarEngineKind(envVal);
    if (fromEnv) return fromEnv;
  } catch {
    // Ignore non-Vite test runtime
  }

  return "glb";
}

export function setAvatarEnginePreference(engine: AvatarEngineKind | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!engine) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, engine);
    }
  } catch {
    // Ignore storage write errors
  }
}
