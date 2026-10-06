import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Target, Compass, BookOpen, Brain, Zap, HelpCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const Copilot = lazy(() =>
  import("./ZaiPlatformAssistantView").then((module) => ({ default: module.ZaiPlatformAssistantView }))
);

export function ZaibotFloatingAssistant() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const quickCommands = [
    { cmd: "/goal", label: "Meta & Objetivo", icon: Target, desc: "Definir meta comercial" },
    { cmd: "/browser", label: "Navegar Memórias", icon: Compass, desc: "Explorar grafo da IA" },
    { cmd: "/plan", label: "Planejar", icon: BookOpen, desc: "Estratégia de vendas" },
    { cmd: "/grill-me", label: "Sabatinar IA", icon: HelpCircle, desc: "Teste de estresse" },
    { cmd: "/learn", label: "Aprender", icon: Brain, desc: "Mineração de conversas" },
    { cmd: "/boost", label: "Turbinar", icon: Zap, desc: "Otimizar respostas" },
  ];

  const handleCommandClick = (cmd: string) => {
    if (cmd === "/browser") {
      setOpen(false);
      navigate("/ai?tab=evolution");
    } else if (cmd === "/plan") {
      setOpen(false);
      navigate("/ai?tab=flows");
    } else if (cmd === "/goal") {
      setOpen(false);
      navigate("/ai?tab=agent");
    } else if (cmd === "/learn") {
      setOpen(false);
      navigate("/ai?tab=evolution&action=mine");
    } else if (cmd === "/boost") {
      setOpen(false);
      navigate("/ai?tab=agent&sub=providers");
    }
  };

  return (
    <>
      {/* Floating Animated Mascot Button */}
      <div className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6 group select-none">
        {/* Tooltip speech bubble on hover */}
        <div className="absolute right-16 top-1/2 -translate-y-1/2 bg-card/95 border border-emerald-500/40 text-foreground text-[11px] font-semibold py-1 px-2.5 rounded-xl shadow-lg backdrop-blur-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-emerald-400" />
          <span>ZAI Copiloto</span>
        </div>

        <button
          type="button"
          aria-label="Abrir Assistente ZAI"
          onClick={() => setOpen(true)}
          className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0e271e] via-[#091510] to-[#040a08] border-2 border-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.45)] hover:shadow-[0_0_30px_rgba(16,185,129,0.75)] hover:border-emerald-300 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center cursor-pointer"
        >
          {/* Animated Mascot Vector: ZAI Cute Robot */}
          <svg viewBox="0 0 44 44" className="w-9 h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Antenna */}
            <line x1="22" y1="8" x2="22" y2="4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            <circle cx="22" cy="3.5" r="2.5" fill="#00ff88" className="animate-pulse shadow-[0_0_8px_#00ff88]" />

            {/* Headset arc */}
            <path d="M9 20 C9 12 35 12 35 20" stroke="#34d399" strokeWidth="2" strokeLinecap="round" fill="none" />
            <rect x="7" y="18" width="3" height="7" rx="1.5" fill="#10b981" />
            <rect x="34" y="18" width="3" height="7" rx="1.5" fill="#10b981" />
            <path d="M10 24 Q13 28 17 28" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            <circle cx="18" cy="28" r="1.5" fill="#00ff88" />

            {/* Robot Head Body */}
            <rect x="11" y="12" width="22" height="18" rx="6" fill="#0b1712" stroke="#10b981" strokeWidth="1.5" />

            {/* Digital Visor */}
            <rect x="14" y="16" width="16" height="8" rx="3" fill="#040b08" stroke="#00ff88" strokeWidth="1" />

            {/* Glowing Eyes */}
            <circle cx="18" cy="20" r="1.8" fill="#00ff88" className="animate-pulse" />
            <circle cx="26" cy="20" r="1.8" fill="#00ff88" className="animate-pulse" />

            {/* Friendly Digital Smile */}
            <path d="M19 26 Q22 28 25 26" stroke="#00ff88" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </svg>

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
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
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

            {/* Quick Slash Commands Pills */}
            <div className="flex items-center gap-1.5 pt-3 overflow-x-auto scrollbar-none">
              {quickCommands.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.cmd}
                    type="button"
                    onClick={() => handleCommandClick(item.cmd)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/70 bg-card hover:bg-emerald-500/10 hover:border-emerald-500/40 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
                  >
                    <Icon className="h-3 w-3 text-emerald-400" />
                    <span>{item.cmd}</span>
                  </button>
                );
              })}
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
