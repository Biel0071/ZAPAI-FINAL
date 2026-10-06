import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const Copilot = lazy(() =>
  import("./ZaiPlatformAssistantView").then((module) => ({ default: module.ZaiPlatformAssistantView }))
);

export function ZaibotFloatingAssistant() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* Floating Animated Mascot Button */}
      <div className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 group select-none">
        {/* Tooltip speech bubble on hover */}
        <div className="absolute right-16 top-1/2 -translate-y-1/2 bg-card/95 border border-emerald-500/40 text-foreground text-[11px] font-semibold py-1 px-2.5 rounded-xl shadow-lg backdrop-blur-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-1.5">
          <img
            src="/assets/mascot/zaibot_avatar.png"
            alt="ZAIBOT"
            className="h-3.5 w-3.5 rounded-full object-cover shrink-0"
          />
          <span>Assistente ZAI</span>
        </div>

        <button
          type="button"
          title="Assistente ZAI"
          data-testid="zaibot-floating-button"
          aria-label="Abrir Assistente ZAI"
          onClick={() => setOpen(true)}
          className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0e271e] via-[#091510] to-[#040a08] border-2 border-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.45)] hover:shadow-[0_0_30px_rgba(16,185,129,0.75)] hover:border-emerald-300 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer p-1 overflow-hidden"
        >
          {/* Official Mascot Avatar */}
          <img
            src="/assets/mascot/zaibot_avatar.png"
            alt="ZAIBOT"
            className="w-full h-full object-cover rounded-xl"
          />

          {/* Active Status Ping Badge */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-background" />
          </span>
        </button>
      </div>

      {/* ZAI Assistant Copilot Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="max-w-2xl max-h-[92dvh] overflow-y-auto border-emerald-500/30 bg-card p-4 sm:p-6"
        >
          <DialogHeader className="border-b border-border/40 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)] p-0.5 overflow-hidden">
                  <img
                    src="/assets/mascot/zaibot_avatar.png"
                    alt="ZAIBOT"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    Assistente ZAI
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[9px] font-bold">
                      COGNITIVO ONLINE
                    </Badge>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Copiloto inteligente de operação WhatsApp, inteligência comercial e evolução.
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <Suspense
            fallback={
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground p-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                Carregando copiloto ZAI...
              </p>
            }
          >
            <Copilot
              onOpenNewAgentWizard={() => {
                setOpen(false);
                navigate("/attendants?new=1");
              }}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
}
