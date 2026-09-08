const fs = require('fs');
const file = 'c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/Inbox/components/SidebarPanel.tsx';
let c = fs.readFileSync(file, 'utf8');

// Replace renderQuickReplyRow
const oldRow = `  const renderQuickReplyRow = (item: QuickReplyItem) => (
    <div
      key={item.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "text/plain",
          getQuickReplyPreviewText(item, conversationVariableContext),
        );
      }}
      onClick={() => {
        setMessageInput(getQuickReplyPreviewText(item, conversationVariableContext));
      }}
      onDoubleClick={() => {
        void sendQuickReply(item);
      }}
      className="group rounded-xl border border-border/40 bg-card/20 p-3 transition-all duration-200 hover:border-primary/40 hover:bg-card/40 hover:shadow-sm cursor-pointer active:scale-[0.99] select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-xs text-foreground/90 truncate flex-grow flex items-center gap-1.5">
          {item.isFlow && (
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] px-1 py-0.2 h-[15px] leading-none font-bold shrink-0">
              Fluxo
            </Badge>
          )}
          <span className="truncate">{item.title || getQuickReplyPreviewText(item, conversationVariableContext).split("\\n")[0]}</span>
        </h4>
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-0.5 max-w-[45%] overflow-hidden shrink-0">
            {item.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[8px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 scale-90"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground mt-1">
        {getQuickReplyPreviewText(item, conversationVariableContext)}
      </p>
      {item.items && item.items.some((entry) => entry.type !== "text") && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.items
            .filter((entry) => entry.type !== "text")
            .map((entry, index) => {
              const type = entry.type === "pdf" ? "document" : entry.type;
              const badgeStyle = 
                type === "image" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" :
                type === "video" ? "bg-rose-500/10 text-rose-400 border border-rose-500/25" :
                type === "audio" ? "bg-amber-500/10 text-amber-400 border border-amber-500/25" :
                type === "document" || type === "file" ? "bg-sky-500/10 text-sky-400 border border-sky-500/25" :
                "bg-slate-500/10 text-slate-400 border border-slate-500/25";
              const label = 
                type === "image" ? "IMAGEM" :
                type === "video" ? "VÍDEO" :
                type === "audio" ? "ÁUDIO" :
                type === "document" || type === "file" ? "DOCUMENTO" : "MÍDIA";
              return (
                <span
                  key={\`\${item.id}-\${entry.type}-\${index}\`}
                  className={\`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider \${badgeStyle}\`}
                >
                  {label}
                </span>
              );
            })}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <Button
          size="sm"
          className={cn(
            "h-7 flex-grow text-[10.5px] font-semibold rounded-lg shadow-sm transition-all",
            item.isFlow ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          onClick={(e) => {
            e.stopPropagation();
            void sendQuickReply(item);
          }}
        >
          {item.isFlow ? (
            <>
              <PaperPlaneTilt className="mr-1 h-3.5 w-3.5" weight="fill" /> Disparar
            </>
          ) : (
            <>
              <PaperPlaneTilt className="mr-1 h-3.5 w-3.5" weight="fill" /> Enviar
            </>
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavoriteQuickReply(item.id);
          }}
          title="Favoritar"
        >
          <Star
            className={cn("h-3.5 w-3.5", item.favorite ? "text-warning" : "text-muted-foreground")}
            weight={item.favorite ? "fill" : "regular"}
          />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            openEditQuickReplyDialog(item);
          }}
          title="Editar"
        >
          <PencilSimple className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            duplicateQuickReply(item);
          }}
          title="Duplicar"
        >
          <CopySimple className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            deleteQuickReply(item.id);
          }}
          title="Excluir"
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );`;

const newRow = `  const renderQuickReplyRow = (item: QuickReplyItem) => (
    <div
      key={item.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "text/plain",
          getQuickReplyPreviewText(item, conversationVariableContext),
        );
      }}
      onClick={() => {
        setMessageInput(getQuickReplyPreviewText(item, conversationVariableContext));
      }}
      onDoubleClick={() => {
        void sendQuickReply(item);
      }}
      className="group rounded-xl border border-border/30 bg-card/40 p-3.5 transition-all duration-300 hover:border-emerald-500/40 hover:bg-card/60 hover:shadow-[0_0_15px_rgba(16,185,129,0.06)] cursor-pointer active:scale-[0.99] select-none space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-bold text-xs text-foreground/90 truncate flex-grow flex items-center gap-1.5">
          {item.isFlow && (
            <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] px-1 py-0.2 h-[15px] leading-none font-bold shrink-0 shadow-sm border-none">
              Fluxo
            </Badge>
          )}
          <span className="truncate">{item.title || getQuickReplyPreviewText(item, conversationVariableContext).split("\\n")[0]}</span>
        </h4>
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1 max-w-[45%] overflow-hidden shrink-0">
            {item.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {getQuickReplyPreviewText(item, conversationVariableContext)}
      </p>
      {item.items && item.items.some((entry) => entry.type !== "text") && (
        <div className="flex flex-wrap gap-1.5">
          {item.items
            .filter((entry) => entry.type !== "text")
            .map((entry, index) => {
              const type = entry.type === "pdf" ? "document" : entry.type;
              const badgeStyle = 
                type === "image" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                type === "video" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                type === "audio" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                type === "document" || type === "file" ? "bg-sky-500/10 text-sky-500 border-sky-500/20" :
                "bg-slate-500/10 text-slate-500 border-slate-500/20";
              const label = 
                type === "image" ? "IMAGEM" :
                type === "video" ? "VÍDEO" :
                type === "audio" ? "ÁUDIO" :
                type === "document" || type === "file" ? "DOCUMENTO" : "MÍDIA";
              return (
                <span
                  key={\`\${item.id}-\${entry.type}-\${index}\`}
                  className={\`rounded-md border px-1.5 py-0.5 text-[9px] font-bold tracking-wider \${badgeStyle}\`}
                >
                  {label}
                </span>
              );
            })}
        </div>
      )}
      <div className="flex items-center gap-1.5 pt-1">
        <Button
          size="sm"
          className={cn(
            "h-8 flex-grow text-[11px] font-bold rounded-lg shadow-sm transition-all border-none",
            item.isFlow ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-emerald-500 hover:bg-emerald-400 text-white"
          )}
          onClick={(e) => {
            e.stopPropagation();
            void sendQuickReply(item);
          }}
        >
          {item.isFlow ? (
            <>
              <PaperPlaneTilt className="mr-1.5 h-4 w-4" weight="fill" /> Disparar
            </>
          ) : (
            <>
              <PaperPlaneTilt className="mr-1.5 h-4 w-4" weight="fill" /> Enviar
            </>
          )}
        </Button>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="outline"
            className={cn(
              "h-8 w-8 rounded-lg border-border/50 transition-colors",
              item.favorite ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteQuickReply(item.id);
            }}
            title="Favoritar"
          >
            <Star
              className="h-4 w-4"
              weight={item.favorite ? "fill" : "regular"}
            />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-lg border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              openEditQuickReplyDialog(item);
            }}
            title="Editar"
          >
            <PencilSimple className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-lg border-border/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              deleteQuickReply(item.id);
            }}
            title="Excluir"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );`;

if(c.includes(oldRow)) {
  c = c.replace(oldRow, newRow);
} else {
  console.log("Could not find oldRow");
}


const oldCatTab = `{favoriteQuickReplies.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-card/25 p-3 shadow-sm space-y-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                  <Star className="h-3.5 w-3.5 text-warning" weight="fill" /> Favoritas
                </p>
                <div className="space-y-2">{favoriteQuickReplies.map(renderQuickReplyRow)}</div>
              </div>
            )}

            <Accordion type="multiple" defaultValue={allCategories} className="space-y-1.5">
              {allCategories.map((cat) => {
                const items = quickRepliesByCategory[cat] ?? [];
                if (items.length === 0) return null;
                return (
                  <AccordionItem
                    key={cat}
                    value={cat}
                    className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
                  >
                    <AccordionTrigger className="py-1.5 px-3.5 text-xs font-bold capitalize hover:no-underline text-foreground">
                      <span className="flex items-center gap-2">
                        {cat}
                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-muted/60 font-semibold text-muted-foreground">
                          {items.length}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 px-3.5 pb-2">
                      {items.map(renderQuickReplyRow)}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>`;

const newCatTab = `{favoriteQuickReplies.length > 0 && (
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 shadow-sm space-y-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-500">
                  <Star className="h-4 w-4" weight="fill" /> Favoritas
                </p>
                <div className="space-y-3">{favoriteQuickReplies.map(renderQuickReplyRow)}</div>
              </div>
            )}

            <Accordion type="multiple" defaultValue={allCategories} className="space-y-2">
              {allCategories.map((cat) => {
                const items = quickRepliesByCategory[cat] ?? [];
                if (items.length === 0) return null;
                return (
                  <AccordionItem
                    key={cat}
                    value={cat}
                    className="rounded-xl border border-border/40 bg-card/25 px-1 overflow-hidden transition-all duration-200 hover:border-emerald-500/30 hover:bg-card/45 shadow-sm"
                  >
                    <AccordionTrigger className="py-2.5 px-3 text-[13px] font-bold capitalize hover:no-underline text-foreground">
                      <span className="flex items-center gap-2">
                        {cat}
                        <Badge variant="secondary" className="h-5 px-2 text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                          {items.length}
                        </Badge>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 px-3 pb-3">
                      {items.map(renderQuickReplyRow)}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>`;

if(c.includes(oldCatTab)) {
  c = c.replace(oldCatTab, newCatTab);
} else {
  console.log("Could not find oldCatTab");
}

fs.writeFileSync(file, c);
console.log('Done script 4 (Quick Replies)');
