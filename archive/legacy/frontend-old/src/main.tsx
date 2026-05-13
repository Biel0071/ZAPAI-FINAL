import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

async function purgeLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

void purgeLegacyServiceWorkers();

createRoot(document.getElementById("root")!).render(<App />);
