import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { zapaiBuildInfo, ZAPAI_BUILD_STORAGE_KEY } from "@/config/buildInfo";

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

void bootstrap();
