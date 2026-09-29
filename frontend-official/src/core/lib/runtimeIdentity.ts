/**
 * Runtime Identity — permanent identity beacon for the ZAPFLOW frontend.
 *
 * Solves the "which frontend is actually running?" problem that caused
 * the ghost worktree incident. Every tab/window running ZAPFLOW will
 * have window.__ZAPFLOW_RUNTIME__ set with verifiable identity data.
 *
 * Usage:
 *   - Check DevTools console for "[ZAPFLOW Runtime Identity]" on load
 *   - In console: window.__ZAPFLOW_RUNTIME__
 *   - Diagnostics page can read this to display identity
 */

export interface ZapflowRuntimeIdentity {
  /** Which frontend tree this is */
  frontend: string;
  /** Vite root directory (set via env or fallback) */
  viteRoot: string;
  /** Unique ID for this browser session */
  runtimeId: string;
  /** When this runtime was initialized */
  startedAt: string;
  /** Build environment */
  env: string;
  /** Build hash/version */
  buildHash: string;
  /** Whether this is HMR-hot-reloaded */
  isHmr: boolean;
}

declare global {
  interface Window {
    __ZAPFLOW_RUNTIME_IDENTITY__?: ZapflowRuntimeIdentity;
  }
}

let initialized = false;

/**
 * Call once from main.tsx — injects runtime identity into window and logs it.
 */
export function initRuntimeIdentity(buildHash: string): ZapflowRuntimeIdentity {
  // Guard: don't re-initialize on HMR hot reload
  if (initialized && window.__ZAPFLOW_RUNTIME_IDENTITY__) {
    window.__ZAPFLOW_RUNTIME_IDENTITY__.isHmr = true;
    return window.__ZAPFLOW_RUNTIME_IDENTITY__;
  }

  const identity: ZapflowRuntimeIdentity = {
    frontend: "frontend-official",
    viteRoot: import.meta.env.BASE_URL ?? "/",
    runtimeId: `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    env: import.meta.env.DEV ? "development" : "production",
    buildHash,
    isHmr: false,
  };

  window.__ZAPFLOW_RUNTIME_IDENTITY__ = identity;
  initialized = true;

  // Structured log — always visible in DevTools
  console.info(
    "%c[ZAPFLOW Runtime Identity]",
    "color: #22c55e; font-weight: bold; font-size: 13px;",
    "\n  frontend:", identity.frontend,
    "\n  runtimeId:", identity.runtimeId,
    "\n  env:", identity.env,
    "\n  buildHash:", identity.buildHash,
    "\n  viteRoot:", identity.viteRoot,
    "\n  startedAt:", identity.startedAt,
  );

  return identity;
}
