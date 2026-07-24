import { useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { API_ORIGIN, IS_API_URL_CONFIGURED } from "@/lib/backendConfig";
import { getCurrentTenantId } from "@/lib/apiGuard";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { WifiSlash, ArrowsClockwise } from "@phosphor-icons/react";

/**
 * Full-screen overlay shown when the backend health probe reports OFFLINE.
 *
 * The continuous health polling lives in useApiRuntimeStatus (mounted once via
 * the Header). This overlay only *reflects* the shared store state, so it does
 * not start a second poll loop. The retry button fires a single manual ping and
 * writes the result back to the same store; the background loop then takes over.
 */
export function ConnectionLostOverlay() {
  const apiHealth = useAppStore((state) => state.apiHealth);
  const updateApiHealth = useAppStore((state) => state.updateApiHealth);
  const [retrying, setRetrying] = useState(false);

  if (apiHealth !== "OFFLINE") return null;

  const retryNow = async () => {
    if (!IS_API_URL_CONFIGURED || !API_ORIGIN) return;
    setRetrying(true);
    const startedAt = performance.now();
    try {
      const response = await fetch(`${API_ORIGIN}/health`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-tenant-id": getCurrentTenantId(),
          "ngrok-skip-browser-warning": "true",
        },
      });
      const latencyMs = Math.round(performance.now() - startedAt);
      updateApiHealth(response.ok ? "ONLINE" : "OFFLINE", response.ok ? latencyMs : null);
    } catch {
      updateApiHealth("OFFLINE", null);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6 text-center select-none animate-fade-in">
      <div className="flex flex-col items-center max-w-md">
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-destructive/10 border border-destructive/30 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
          <BrandLogo size={58} />
          <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg">
            <WifiSlash weight="bold" className="h-5 w-5" />
          </span>
        </div>

        <h2 className="font-display text-2xl font-black tracking-tight text-foreground mb-2">
          Sem conexão com o servidor
        </h2>
        <p className="text-sm text-muted-foreground mb-1">
          Não estamos conseguindo falar com o backend do ZAPFLOW AI.
        </p>
        <p className="text-xs text-muted-foreground/80 mb-6">
          Tentando reconectar automaticamente em segundo plano. Verifique se o serviço está no ar e sua
          conexão de rede.
        </p>

        <button
          type="button"
          onClick={retryNow}
          disabled={retrying}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <ArrowsClockwise weight="bold" className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {retrying ? "Reconectando…" : "Tentar reconectar agora"}
        </button>

        <div className="mt-5 flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-4 py-1.5 text-xs font-semibold text-destructive">
          <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
          Reconectando em segundo plano
        </div>
      </div>
    </div>
  );
}

export default ConnectionLostOverlay;
