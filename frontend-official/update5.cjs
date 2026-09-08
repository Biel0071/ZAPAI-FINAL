const fs = require('fs');
const file = 'c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/Inbox/components/SidebarPanel.tsx';
let c = fs.readFileSync(file, 'utf8');

const oldHistory = `<InboxSectionBoundary fallbackLabel="Histórico">
            <div className="rounded-xl border border-border/40 bg-card/25 p-3.5 shadow-sm">
              <p className="mb-3.5 text-xs font-semibold text-foreground/90">Linha do tempo</p>
              <div className="relative pl-4 border-l border-border ml-2 space-y-4 text-xs">
                {conversationTimeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground/75 py-2">
                    Ainda não há eventos cadastrados neste histórico.
                  </p>
                ) : (
                  conversationTimeline.map((evt) => (
                    <div key={evt.id} className="relative group">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary/70 ring-4 ring-background transition-transform group-hover:scale-125 duration-150" />
                      <div className="flex items-center justify-between gap-2">
                        <div
                          onClick={() => toggleTimelineItem(evt.id)}
                          className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors flex-grow min-w-0"
                        >
                          <CaretRight
                            className={cn(
                              "h-3 w-3 text-muted-foreground transition-transform duration-200 shrink-0",
                              expandedTimeline.has(evt.id) ? "rotate-90 text-primary" : "rotate-0"
                            )}
                          />
                          <span className="font-semibold text-foreground/90 truncate">{evt.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground/60 font-mono">
                            {formatTime(evt.timestamp)}
                          </span>
                          {onSaveTimelineToMemory && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onSaveTimelineToMemory(evt);
                              }}
                              title="Salvar na Memória"
                            >
                              <Star className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className={cn("text-muted-foreground/80 mt-1 transition-all duration-200 pl-4 text-[11px] leading-relaxed", expandedTimeline.has(evt.id) ? "" : "line-clamp-1")}>
                        {evt.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </InboxSectionBoundary>`;

const newHistory = `<InboxSectionBoundary fallbackLabel="Histórico">
            <div className="rounded-xl border border-border/40 bg-card/25 p-4 shadow-sm relative">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-foreground">Linha do tempo</p>
              </div>
              <div className="relative pl-5 border-l-2 border-border/40 ml-2.5 space-y-5 text-xs">
                {conversationTimeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground/75 py-2">
                    Ainda não há eventos cadastrados neste histórico.
                  </p>
                ) : (
                  conversationTimeline.map((evt) => {
                    const isReceived = evt.title.toLowerCase().includes("recebida");
                    const isSystem = evt.title.toLowerCase().includes("atualizado");
                    const ringColor = isSystem ? "ring-purple-500/20 bg-purple-500" : isReceived ? "ring-emerald-500/20 bg-emerald-500" : "ring-blue-500/20 bg-blue-500";
                    return (
                      <div key={evt.id} className="relative group">
                        <span className={cn("absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full ring-4 transition-transform group-hover:scale-125 duration-300", ringColor)} />
                        <div className="flex items-center justify-between gap-2">
                          <div
                            onClick={() => toggleTimelineItem(evt.id)}
                            className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-500 transition-colors flex-grow min-w-0"
                          >
                            <CaretRight
                              className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-300 shrink-0",
                                expandedTimeline.has(evt.id) ? "rotate-90 text-emerald-500" : "rotate-0"
                              )}
                            />
                            <span className="font-bold text-[11px] text-foreground/90 truncate uppercase tracking-wider">{evt.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground/70 font-mono font-medium bg-muted/40 px-1.5 py-0.5 rounded-md">
                              {formatTime(evt.timestamp)}
                            </span>
                            {onSaveTimelineToMemory && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all duration-200 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 p-0 rounded-md"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onSaveTimelineToMemory(evt);
                                }}
                                title="Salvar na Memória"
                              >
                                <Star className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className={cn(
                          "mt-2 text-muted-foreground/80 pl-5 text-[11px] leading-relaxed transition-all duration-300 overflow-hidden",
                          expandedTimeline.has(evt.id) ? "max-h-[500px] opacity-100 bg-muted/20 p-2 rounded-lg border border-border/40" : "max-h-6 opacity-80 line-clamp-1"
                        )}>
                          {evt.description}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {conversationTimeline.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/10 text-center">
                  <a href="#" className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors flex items-center justify-center gap-1 group">
                    Ver histórico completo 
                    <CaretRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              )}
            </div>
          </InboxSectionBoundary>`;

if(c.includes(oldHistory)) {
  c = c.replace(oldHistory, newHistory);
} else {
  console.log("Could not find oldHistory");
}


const oldFiles = `<InboxSectionBoundary fallbackLabel="Arquivos">
            <div className="rounded-xl border border-border/40 bg-card/25 p-3.5 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-foreground/90 font-display">Mídias Compartilhadas</p>
              
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { value: "all", label: "Todos" },
                    { value: "image", label: "Imagens" },
                    { value: "video", label: "Vídeos" },
                    { value: "document", label: "Docs" },
                  ] as const
                ).map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={fileFilter === option.value ? "default" : "outline"}
                    className="h-6 rounded-full px-2.5 text-[10px]"
                    onClick={() => setFileFilter(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {(() => {
                const mediaMessages = messages.filter((message) => {
                  const mediaType =
                    message.mediaType ??
                    inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? ""));
                  return Boolean(extractMessageAssetUrl(message) || mediaType);
                });

                const filteredMedia = mediaMessages.filter((message) => {
                  const mediaType =
                    message.mediaType ??
                    inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? ""));
                  if (fileFilter === "all") return true;
                  if (fileFilter === "image") return mediaType === "image" || mediaType === "sticker";
                  if (fileFilter === "video") return mediaType === "video";
                  if (fileFilter === "document") return mediaType === "file" || mediaType === "audio";
                  return true;
                });

                if (filteredMedia.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground/70 text-center py-6">
                      Nenhuma mídia encontrada com este filtro.
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredMedia.map((msg) => (
                      <SharedMediaCard
                        key={msg.id}
                        message={msg}
                        onOpenMediaPreview={handleOpenMediaPreview}
                        onDownloadMedia={handleDownloadMedia}
                        onAttachMedia={onAttachMedia}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          </InboxSectionBoundary>`;

const newFiles = `<InboxSectionBoundary fallbackLabel="Arquivos">
            <div className="rounded-xl border border-border/40 bg-card/25 p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground font-display">Mídias Compartilhadas</p>
              </div>

              {/* Barra de armazenamento fictícia (visual requirement) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                  <span>Armazenamento da conversa</span>
                  <span>1.2 GB de 5 GB — 24%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[24%]" />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { value: "all", label: "Todos", icon: Folder },
                    { value: "image", label: "Imagens", icon: FileIcon },
                    { value: "video", label: "Vídeos", icon: Waveform },
                    { value: "document", label: "Docs", icon: Paperclip },
                  ] as const
                ).map((option) => {
                  const Icon = option.icon;
                  return (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={fileFilter === option.value ? "default" : "outline"}
                      className={cn(
                        "h-7 rounded-full px-3 text-[11px] font-semibold flex items-center gap-1.5 transition-all",
                        fileFilter === option.value ? "bg-emerald-500 text-white border-none shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-card text-muted-foreground hover:bg-muted/50 border-border/50"
                      )}
                      onClick={() => setFileFilter(option.value)}
                    >
                      <Icon className="h-3 w-3" />
                      {option.label}
                    </Button>
                  );
                })}
              </div>

              {/* Área drag & drop fictícia (visual requirement) */}
              <div className="border-2 border-dashed border-border/50 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 bg-muted/10 hover:bg-muted/20 hover:border-emerald-500/30 transition-all cursor-pointer">
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <DownloadSimple className="h-4 w-4 text-emerald-500 rotate-180" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground/90">Clique ou arraste arquivos</p>
                  <p className="text-[10px] text-muted-foreground">Tamanho máximo: 50MB</p>
                </div>
              </div>

              {(() => {
                const mediaMessages = messages.filter((message) => {
                  const mediaType =
                    message.mediaType ??
                    inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? ""));
                  return Boolean(extractMessageAssetUrl(message) || mediaType);
                });

                const filteredMedia = mediaMessages.filter((message) => {
                  const mediaType =
                    message.mediaType ??
                    inferMediaTypeFromSource(String(extractMessageAssetUrl(message) ?? ""));
                  if (fileFilter === "all") return true;
                  if (fileFilter === "image") return mediaType === "image" || mediaType === "sticker";
                  if (fileFilter === "video") return mediaType === "video";
                  if (fileFilter === "document") return mediaType === "file" || mediaType === "audio";
                  return true;
                });

                if (filteredMedia.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground/70 text-center py-8 bg-muted/20 rounded-xl border border-border/30">
                      Nenhuma mídia encontrada com este filtro.
                    </p>
                  );
                }

                const visibleMedia = filteredMedia.slice(0, 6);
                const hasMore = filteredMedia.length > 6;

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {visibleMedia.map((msg) => (
                        <SharedMediaCard
                          key={msg.id}
                          message={msg}
                          onOpenMediaPreview={handleOpenMediaPreview}
                          onDownloadMedia={handleDownloadMedia}
                          onAttachMedia={onAttachMedia}
                        />
                      ))}
                    </div>
                    {hasMore && (
                      <Button variant="outline" className="w-full h-8 text-[11px] font-bold border-border/50 hover:bg-muted/50 rounded-xl">
                        +{filteredMedia.length - 6} Ver todos
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          </InboxSectionBoundary>`;

if(c.includes(oldFiles)) {
  c = c.replace(oldFiles, newFiles);
} else {
  console.log("Could not find oldFiles");
}

fs.writeFileSync(file, c);
console.log('Done script 5 (History & Files)');
