// ── MUST be first import — patches globals before any other module loads ──
import {
  injectRuntimeHardening,
} from "@/lib/runtimeHardening";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  createRuntimeManifest,
  OFFICIAL_BACKEND_PORT,
  OFFICIAL_FRONTEND_PORT,
  zapaiBuildInfo,
  ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY,
} from "@/config/buildInfo";
import { initRuntimeIdentity } from "@/lib/runtimeIdentity";
import { API_ORIGIN } from "@/lib/backendConfig";

injectRuntimeHardening(zapaiBuildInfo.hash);

if (typeof (String.prototype as any).replaceAll !== "function") {
  (String.prototype as any).replaceAll = function (
    search: string | RegExp,
    replacement: string | ((match: string, ...args: unknown[]) => string),
  ): string {
    if (search instanceof RegExp) {
      if (!search.global)
        throw new TypeError("String.prototype.replaceAll called with a non-global RegExp argument");
      return this.replace(search, replacement as string);
    }
    return this.split(String(search)).join(String(replacement));
  };
}

function enforceDarkThemeDom() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.add("dark");
  root.classList.remove("light");
  root.setAttribute("data-theme", "dark");
  root.style.colorScheme = "dark";
}

function resolveSocketOrigin(): string | null {
  if (API_ORIGIN) return API_ORIGIN;
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return null;
}

function persistBuildInfo() {
  const frontendOrigin = typeof window !== "undefined" ? window.location.origin : null;
  const socketOrigin = resolveSocketOrigin();
  const runtimeManifest = createRuntimeManifest({
    apiOrigin: API_ORIGIN || frontendOrigin,
    backend: OFFICIAL_BACKEND_PORT,
    frontend: OFFICIAL_FRONTEND_PORT,
    frontendOrigin,
    socketOrigin,
  });

  try {
    localStorage.setItem(ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY, JSON.stringify(runtimeManifest));
  } catch {
    // storage indisponível
  }

  window.ZAPAI_BUILD = zapaiBuildInfo;
  window.__ZAPFLOW_RUNTIME__ = runtimeManifest;
}

function renderFatalError(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  if (root.children.length > 0) return;
  root.innerHTML = `
    <div style="display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif;padding:24px;">
      <div style="max-width:480px;text-align:center;">
        <h1 style="font-size:24px;font-weight:700;margin-bottom:12px;">ZAPFLOW AI</h1>
        <p style="font-size:14px;color:#a3a3a3;margin-bottom:24px;">O sistema encontrou um erro durante a inicialização.</p>
        <pre style="font-size:12px;background:#1a1a1a;padding:16px;border-radius:8px;overflow:auto;text-align:left;color:#ef4444;margin-bottom:24px;max-height:120px;">${message}</pre>
        <button onclick="localStorage.clear();sessionStorage.clear();location.reload()" style="padding:10px 24px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;margin-right:8px;">Limpar e Recarregar</button>
        <button onclick="location.reload()" style="padding:10px 24px;background:#334155;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Recarregar</button>
      </div>
    </div>
  `;
}

function clearLegacyRuntimeCaches() {
  try {
    if ("caches" in window) {
      void caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => /lovable|swift-wa-assist|preview|vite/i.test(key))
            .map((key) => caches.delete(key)),
        ),
      );
    }
  } catch {
    // ignore
  }
}

async function bootstrap() {
  persistBuildInfo();
  initRuntimeIdentity(zapaiBuildInfo.hash);
  enforceDarkThemeDom();
  clearLegacyRuntimeCaches();

  const url = new URL(window.location.href);
  if (url.searchParams.has("runtime_recover")) {
    url.searchParams.delete("runtime_recover");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}` || "/");
  }

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    console.error("[ZAPFLOW] bootstrap: #root element not found!");
    renderFatalError("Elemento #root não encontrado no DOM.");
    return;
  }

  createRoot(rootEl).render(<App />);
}

void bootstrap().catch((error) => {
  console.error("[ZAPFLOW] Fatal bootstrap error:", error);
  renderFatalError(error instanceof Error ? error.message : String(error ?? "Unknown error"));
});
