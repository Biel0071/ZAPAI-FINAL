import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Settings2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  fetchZaiAssistantConfigFromApi,
  getZaiAssistantConfig,
  ZAI_CONFIG_EVENT,
  ZAI_PERSONALITY_TONES,
  type ZaiAssistantConfig,
} from "@/core/services/zaiAssistantConfigService";

export const ZAI_OPEN_EVENT = "zai-assistant-open";

const Copilot = lazy(() =>
  import("./ZaiPlatformAssistantView").then((module) => ({ default: module.ZaiPlatformAssistantView }))
);

interface ZaibotFloatingAssistantProps {
  forceEnabled?: boolean;
}

export function ZaibotFloatingAssistant({ forceEnabled = false }: ZaibotFloatingAssistantProps = {}) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ZaiAssistantConfig>(() => getZaiAssistantConfig());
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const refreshConfig = () => {
      if (document.visibilityState !== "visible") return;
      void fetchZaiAssistantConfigFromApi().then((loaded) => {
        if (mounted) setConfig(loaded);
      });
    };
    refreshConfig();

    const refreshTimer = window.setInterval(refreshConfig, 60_000);
    const handleFocus = () => refreshConfig();
    window.addEventListener("focus", handleFocus);

    const handleConfigUpdate = (event: Event) => {
      const custom = event as CustomEvent<ZaiAssistantConfig>;
      if (custom.detail) {
        setConfig(custom.detail);
      } else {
        setConfig(getZaiAssistantConfig());
      }
    };

    window.addEventListener(ZAI_CONFIG_EVENT, handleConfigUpdate);
    const openCopilot = () => {
      if (config.enabled && config.globallyEnabled !== false) setOpen(true);
    };
    window.addEventListener(ZAI_OPEN_EVENT, openCopilot);
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(ZAI_CONFIG_EVENT, handleConfigUpdate);
      window.removeEventListener(ZAI_OPEN_EVENT, openCopilot);
    };
  }, [config.enabled, config.globallyEnabled]);

  const isEnabled = config.globallyEnabled !== false && (forceEnabled || Boolean(config.enabled));

  if (!isEnabled) {
    return null;
  }

  const avatarSrc = "/assets/mascot/zaibot_avatar.png";
  const toneLabel =
    ZAI_PERSONALITY_TONES.find((t) => t.id === config.personality?.tone)?.label || "Executivo & Direto";

  return (
    <>
      <button
        type="button"
        title="Abrir Assistente ZAI"
        data-testid="zaibot-floating-button"
        aria-label="Abrir Assistente ZAI"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/60 bg-card p-1 shadow-[0_0_24px_rgba(16,185,129,0.35)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 motion-safe:animate-[pulse_3s_ease-in-out_infinite]"
      >
        <img src={avatarSrc} alt="" className="h-full w-full rounded-full object-cover" />
        <span className="sr-only">Abrir Assistente ZAI</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto border-emerald-500/30 bg-card p-4 sm:max-w-xl sm:p-6">
          <SheetHeader className="border-b border-border/40 pb-3 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)] p-0.5 overflow-hidden">
                  <img
                    src={avatarSrc}
                    alt="ZAIBOT"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold flex items-center gap-2 flex-wrap">
                    Assistente ZAI
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[9px] font-bold">
                      ASSISTENTE DO SISTEMA
                    </Badge>
                    <Badge variant="outline" className="border-border/60 text-muted-foreground text-[9px]">
                      {toneLabel}
                    </Badge>
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground">
                    Copiloto interno do sistema • Atendimento de clientes na loja via Camila.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/settings?tab=assistente-zai");
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-emerald-500/40 transition-colors"
                title="Configurar Assistente ZAI"
              >
                <Settings2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Configurar</span>
              </button>
            </div>
          </SheetHeader>

          <Suspense
            fallback={
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                Carregando copiloto ZAI...
              </p>
            }
          >
            <Copilot
              onNavigate={() => setOpen(false)}
              onOpenNewAgentWizard={() => {
                setOpen(false);
                navigate("/attendants?new=1");
              }}
            />
          </Suspense>
        </SheetContent>
      </Sheet>
    </>
  );
}
