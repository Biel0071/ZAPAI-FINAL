const fs = require('fs');
const file = 'c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/Inbox/components/SidebarPanel.tsx';
let c = fs.readFileSync(file, 'utf8');

// SharedMediaCard changes
c = c.replace(
  '<div className="group rounded-xl border border-border/30 bg-card/20 p-2.5 transition-all duration-300 hover:border-primary/30 hover:bg-card/40 hover:shadow-sm">',
  '<div className="group rounded-xl border border-border/30 bg-card/20 p-2.5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-card/40 hover:shadow-sm">'
);

c = c.replace(
  '<div className="relative aspect-square w-full flex items-center justify-center overflow-hidden rounded-lg border border-border/20 bg-muted/30">',
  '<div className="relative aspect-square w-full flex items-center justify-center overflow-hidden rounded-xl border border-border/20 bg-muted/30">'
);

c = c.replace(
  `onError={() =>
              setAssetError("O video nao pode ser carregado ou o formato nao e suportado.")
            }
          />`,
  `onError={() =>
              setAssetError("O video nao pode ser carregado ou o formato nao e suportado.")
            }
          />
          {mediaType === "video" && !assetError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <div className="h-8 w-8 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm border border-white/20 shadow-sm">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 256 256" className="ml-0.5"><path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65c-10.53,6.33-24.32-1.39-24.32-13.51V39.86C64,27.74,77.79,20,88.32,26.35l144.08,88.14A15.74,15.74,0,0,1,240,128Z"></path></svg>
               </div>
               <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">0:15</div>
            </div>
          )}`
);

c = c.replace(
  `<div className="absolute inset-0 bg-[#0C0F14]/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-2.5 z-10 backdrop-blur-[2px]">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 w-full text-[10px] rounded-lg bg-foreground text-background hover:bg-foreground/90 gap-1 justify-center font-medium"
              onClick={(e) => {
                e.stopPropagation();
                if (onAttachMedia) onAttachMedia(message);
              }}
            >
              <Paperclip className="h-3 w-3" /> Anexar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 w-full text-[10px] rounded-lg bg-background/90 hover:bg-background text-foreground gap-1 justify-center font-medium"
              onClick={(e) => {
                e.stopPropagation();
                onDownloadMedia(message);
              }}
            >
              <DownloadSimple className="h-3 w-3" /> Baixar
            </Button>
          </div>`,
  `<div className="absolute inset-0 bg-emerald-950/80 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 p-3 z-10 backdrop-blur-sm">
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 w-full text-[11px] rounded-full bg-emerald-500 hover:bg-emerald-400 text-white gap-1.5 justify-center font-semibold shadow-[0_0_15px_rgba(16,185,129,0.4)] border-none"
              onClick={(e) => {
                e.stopPropagation();
                if (onAttachMedia) onAttachMedia(message);
              }}
            >
              <Paperclip className="h-3.5 w-3.5" /> Anexar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-full text-[11px] rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-1.5 justify-center font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                onDownloadMedia(message);
              }}
            >
              <DownloadSimple className="h-3.5 w-3.5" /> Baixar
            </Button>
          </div>`
);

// RightPanelSectionTrigger
c = c.replace(
  `"flex h-[46px] w-full shrink-0 items-center justify-between px-4 text-left text-xs font-semibold tracking-wide transition-all duration-200 border-b",
        active
          ? "bg-primary/[0.04] text-primary border-b-border/50 border-l-[3px] border-l-primary"
          : "bg-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground border-b-border/30 border-l-[3px] border-l-transparent",`,
  `"flex h-[46px] w-full shrink-0 items-center justify-between px-4 text-left text-xs font-semibold tracking-wide transition-all duration-300 border-b",
        active
          ? "bg-emerald-500/[0.06] text-emerald-500 border-b-border/50 border-l-[4px] border-l-emerald-500 hover:shadow-[0_0_12px_rgba(16,185,129,0.08)]"
          : "bg-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground border-b-border/30 border-l-[4px] border-l-transparent",`
);

c = c.replace(
  `<Icon className={cn("h-4 w-4 transition-colors", active ? "text-primary" : "text-muted-foreground")} strokeWidth={2} aria-hidden />`,
  `<Icon className={cn("h-5 w-5 transition-colors", active ? "text-emerald-500" : "text-muted-foreground")} strokeWidth={2} aria-hidden />`
);

c = c.replace(
  `"h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200 ease-in-out",
          active && "rotate-90 text-primary"`,
  `"h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-300 ease-in-out",
          active && "rotate-90 text-emerald-500"`
);


fs.writeFileSync(file, c);
console.log('Done script 1');
