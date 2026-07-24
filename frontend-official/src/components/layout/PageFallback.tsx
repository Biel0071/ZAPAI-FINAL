import { BrandLogo } from "@/components/brand/BrandLogo";

export function PageFallback() {
  return (
    <div className="flex min-h-[80vh] w-full flex-col items-center justify-center p-6 text-center select-none animate-fade-in">
      <div className="relative flex flex-col items-center justify-center">
        <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.25)]">
          <BrandLogo size={52} animated />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
          </span>
        </div>

        <h3 className="font-display text-xl font-bold tracking-tight text-foreground mb-1">
          ZAPFLOW <span className="text-emerald-400">AI</span>
        </h3>
        <p className="text-xs text-muted-foreground font-medium mb-4">Carregando Módulo...</p>

        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-[11px] text-emerald-400 font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          Sincronizando Dados
        </div>
      </div>
    </div>
  );
}
