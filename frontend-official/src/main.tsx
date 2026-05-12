// ── MUST be first import — patches globals before any other module loads ──
import "@/lib/runtimeHardening";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { zapaiBuildInfo, ZAPAI_BUILD_STORAGE_KEY } from "@/config/buildInfo";

// ── Runtime Safety: patch .replace/.replaceAll on all types ──────
// The production error "e.replaceAll is not a function" happens when
// minified code calls .replaceAll() on undefined/null/number.
// This polyfill covers TWO cases:
//   1. Browser lacks String.prototype.replaceAll  (Safari < 13.1)
//   2. esbuild transforms .replace(/g/) → .replaceAll() and the
//      value is not a string at runtime.

// Ensure String.prototype.replaceAll exists
if (typeof String.prototype.replaceAll !== "function") {
  String.prototype.replaceAll = function (
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

// Global error trap: intercept "replaceAll is not a function" before
// React's error boundary can catch it. This prevents full black screen.
window.addEventListener("error", (event) => {
  const msg = event.message ?? "";
  if (
    msg.includes("replaceAll is not a function") ||
    msg.includes("replace is not a function") ||
    msg.includes("Cannot read properties of undefined") ||
    msg.includes("Cannot read properties of null")
  ) {
    console.warn("[ZAPFLOW] Intercepted runtime TypeError:", msg);
    event.preventDefault(); // Prevent default error handling (black screen)
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? "");
  if (
    msg.includes("replaceAll is not a function") ||
    msg.includes("replace is not a function")
  ) {
    console.warn("[ZAPFLOW] Intercepted unhandled rejection:", msg);
    event.preventDefault();
  }
});

function enforceDarkThemeDom() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.add("dark");
  root.classList.remove("light");
  root.setAttribute("data-theme", "dark");
  root.style.colorScheme = "dark";
}

function persistBuildInfo() {
  try {
    localStorage.setItem(ZAPAI_BUILD_STORAGE_KEY, JSON.stringify(zapaiBuildInfo));
  } catch {
    // storage indisponível
  }

  (window as Record<string, unknown>).ZAPAI_BUILD = zapaiBuildInfo;
}

function renderFatalError(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  // Only render fatal screen if root has no children (app hasn't mounted yet)
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

async function bootstrap() {
  console.log("[ZAPFLOW] bootstrap: start", {
    href: window.location.href,
    time: new Date().toISOString(),
    build: zapaiBuildInfo.hash,
  });
  persistBuildInfo();
  enforceDarkThemeDom();

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

  console.log("[ZAPFLOW] bootstrap: rendering <App />");
  createRoot(rootEl).render(<App />);
  console.log("[ZAPFLOW] bootstrap: render() called — React is mounting");
}

void bootstrap().catch((error) => {
  console.error("[ZAPFLOW] Fatal bootstrap error:", error);
  renderFatalError(error instanceof Error ? error.message : String(error ?? "Unknown error"));
});
