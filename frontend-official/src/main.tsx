import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { zapaiBuildInfo, ZAPAI_BUILD_STORAGE_KEY } from "@/config/buildInfo";

// ── Polyfill: String.prototype.replaceAll ─────────────────────────
// Some WebViews / older browsers lack replaceAll.
// Without this, any library or minified code calling .replaceAll()
// on a string crashes with "e.replaceAll is not a function".
if (typeof String.prototype.replaceAll !== "function") {
  // eslint-disable-next-line no-extend-native
  String.prototype.replaceAll = function (
    search: string | RegExp,
    replacement: string | ((match: string, ...args: unknown[]) => string),
  ): string {
    if (search instanceof RegExp) {
      if (!search.global) {
        throw new TypeError("String.prototype.replaceAll called with a non-global RegExp argument");
      }
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

function persistBuildInfo() {
  try {
    localStorage.setItem(ZAPAI_BUILD_STORAGE_KEY, JSON.stringify(zapaiBuildInfo));
  } catch {
    // storage indisponível
  }

  window.ZAPAI_BUILD = zapaiBuildInfo;
}

function renderFatalError(message: string) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif;padding:24px;">
      <div style="max-width:480px;text-align:center;">
        <h1 style="font-size:24px;font-weight:700;margin-bottom:12px;">ZAPFLOW AI</h1>
        <p style="font-size:14px;color:#a3a3a3;margin-bottom:24px;">O sistema encontrou um erro durante a inicialização.</p>
        <pre style="font-size:12px;background:#1a1a1a;padding:16px;border-radius:8px;overflow:auto;text-align:left;color:#ef4444;margin-bottom:24px;max-height:120px;">${message}</pre>
        <button onclick="location.reload()" style="padding:10px 24px;background:#3b82f6;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">Recarregar</button>
      </div>
    </div>
  `;
}

async function bootstrap() {
  persistBuildInfo();
  enforceDarkThemeDom();

  const url = new URL(window.location.href);
  if (url.searchParams.has("runtime_recover")) {
    url.searchParams.delete("runtime_recover");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}` || "/");
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap().catch((error) => {
  console.error("[ZAPFLOW] Fatal bootstrap error:", error);
  renderFatalError(error instanceof Error ? error.message : String(error ?? "Unknown error"));
});
