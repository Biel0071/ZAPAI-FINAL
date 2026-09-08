const fs = require('fs');
const file = 'c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/Inbox/components/SidebarPanel.tsx';
let c = fs.readFileSync(file, 'utf8');

// Replace Aba Lead
const oldLead = `<InboxSectionBoundary fallbackLabel="Lead CRM">
            <Accordion type="multiple" defaultValue={["lead-contact", "lead-tags", "lead-funnel", "lead-notes"]} className="space-y-1.5">
              <AccordionItem
                value="lead-contact"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-1.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Dados do contato
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-2 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Nome</span>
                    <span className="font-semibold text-foreground">{selectedConversation.contactName}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Telefone</span>
                    <span className="break-all font-mono font-semibold text-foreground/90">
                      {formatPhoneNumber(selectedConversation.phone)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Origem</span>
                    <span className="font-semibold text-foreground">{conversationMetrics.leadSource}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Última interação</span>
                    <span className="font-semibold text-foreground">
                      {conversationMetrics.lastInteraction
                        ? new Date(conversationMetrics.lastInteraction).toLocaleString("pt-BR")
                        : "Sem registro"}
                    </span>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="lead-tags"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-1.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Etiquetas
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-2 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedConversation.tags ?? []).map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={cn("gap-1 text-[10px] rounded-lg px-2 py-0.5 transition-colors hover:bg-destructive/10 hover:text-destructive", getTagColor(tag))}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTagFromSelectedConversation(tag)}
                          aria-label={\`Remover \${tag}\`}
                          className="hover:scale-105 shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {(selectedConversation.tags ?? []).length === 0 && (
                      <span className="text-[11px] text-muted-foreground/80">Sem etiquetas atribuídas</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Input
                      value={newTagInput}
                      onChange={(event) => setNewTagInput(event.target.value)}
                      placeholder="Nova etiqueta..."
                      className="h-8.5 text-xs bg-background/50 rounded-lg border-border focus:border-primary/50"
                      onKeyDown={(event) => event.key === "Enter" && handleAddTagToSelectedConversation()}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8.5 w-8.5 px-0 rounded-lg shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
                      onClick={handleAddTagToSelectedConversation}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="lead-funnel"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-1.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Estágio no Funil
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-2">
                  <select
                    value={selectedConversationFunnelStage}
                    onChange={(event) => {
                      const funnel_stage = event.target.value;
                      setConversations((prev: Conversation[]) =>
                        prev.map((c) =>
                          c.id === selectedConversation.id
                            ? ({ ...c, funnel_stage } as Conversation)
                            : c,
                        ),
                      );
                      void persistConversationMetadata(selectedConversation.id, { funnel_stage });
                      toast({ title: \`Lead movido para: \${funnel_stage}\` });
                    }}
                    className="h-8.5 w-full rounded-lg border border-border bg-background/50 px-2.5 text-xs text-foreground/90 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                  >
                    {BUSINESS_TAG_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="lead-notes"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-1.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Observações
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-2 space-y-2">
                  <textarea
                    value={leadNotes}
                    onChange={(event) => setLeadNotes(event.target.value)}
                    placeholder="Registre contexto importante deste atendimento..."
                    className="min-h-24 w-full resize-y rounded-lg border border-border bg-background/50 p-2.5 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    onClick={() => void handleSaveLeadNotes()}
                  >
                    Salvar observações
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </InboxSectionBoundary>`;

const newLead = `<InboxSectionBoundary fallbackLabel="Lead CRM">
            <div className="rounded-xl border border-border/40 bg-card/25 p-4 shadow-sm relative space-y-4">
              {/* Header com 3-dots */}
              <div className="absolute top-4 right-4">
                 <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:bg-muted/50">
                   <div className="flex gap-0.5">
                     <span className="w-1 h-1 rounded-full bg-current" />
                     <span className="w-1 h-1 rounded-full bg-current" />
                     <span className="w-1 h-1 rounded-full bg-current" />
                   </div>
                 </Button>
              </div>

              {/* Avatar e Infos */}
              <div className="flex flex-col items-center text-center space-y-2 pt-2">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xl uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  {selectedConversation.contactName?.substring(0,2) || "LD"}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground leading-tight">
                    {selectedConversation.contactName}
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1 text-muted-foreground">
                    <span className="text-xs font-mono font-medium">{formatPhoneNumber(selectedConversation.phone)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold mt-1 border border-emerald-500/20">
                  <div className="h-3 w-3 bg-emerald-500" style={{ maskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'%3E%3Cpath fill=\\'currentColor\\' d=\\'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.81 11.81 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z\\'%3E%3C/svg%3E")', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center', backgroundColor: 'currentColor', WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'%3E%3Cpath fill=\\'currentColor\\' d=\\'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.81 11.81 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z\\'%3E%3C/svg%3E")', WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center' }} />
                  WhatsApp
                </div>
              </div>

              <div className="h-px w-full bg-border/20 my-2" />

              {/* Data points */}
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                 <div>
                   <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><History className="h-3 w-3" /> Últ. Interação</p>
                   <p className="font-semibold text-foreground">
                      {conversationMetrics.lastInteraction
                        ? new Date(conversationMetrics.lastInteraction).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : "Sem registro"}
                   </p>
                 </div>
                 <div>
                   <p className="text-muted-foreground mb-0.5 flex items-center gap-1"><UserRound className="h-3 w-3" /> Origem</p>
                   <p className="font-semibold text-foreground">{conversationMetrics.leadSource}</p>
                 </div>
              </div>

              {/* Etiquetas */}
              <div className="space-y-2 pt-2 border-t border-border/10">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Etiquetas</p>
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Bot className="h-2.5 w-2.5" /> IA &gt; automático
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedConversation.tags ?? []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className={cn("gap-1 text-[10px] rounded-lg px-2 py-1 border-border/50 transition-colors shadow-sm bg-card", getTagColor(tag))}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTagFromSelectedConversation(tag)}
                        aria-label={\`Remover \${tag}\`}
                        className="hover:text-destructive hover:scale-110 shrink-0 transition-transform ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {(selectedConversation.tags ?? []).length === 0 && (
                    <span className="text-[11px] text-muted-foreground/80 py-1">Sem etiquetas atribuídas</span>
                  )}
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Input
                    value={newTagInput}
                    onChange={(event) => setNewTagInput(event.target.value)}
                    placeholder="Adicionar etiqueta..."
                    className="h-8 text-xs bg-background/50 rounded-lg border-border focus:border-primary/50"
                    onKeyDown={(event) => event.key === "Enter" && handleAddTagToSelectedConversation()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 px-0 rounded-lg shrink-0 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5"
                    onClick={handleAddTagToSelectedConversation}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2 pt-2 border-t border-border/10">
                <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Observações do Lead</p>
                <textarea
                  value={leadNotes}
                  onChange={(event) => setLeadNotes(event.target.value)}
                  placeholder="Registre contexto importante deste atendimento..."
                  className="min-h-[80px] w-full resize-y rounded-xl border border-border bg-background/50 p-3 text-xs outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-foreground/90 placeholder:text-muted-foreground/60"
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9 w-full text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-300 border-none"
                  onClick={() => void handleSaveLeadNotes()}
                >
                  Salvar observações
                </Button>
              </div>
            </div>
          </InboxSectionBoundary>`;

if(c.includes(oldLead)) {
  c = c.replace(oldLead, newLead);
} else {
  console.log("Could not find oldLead");
}

fs.writeFileSync(file, c);
console.log('Done script 3 (Lead)');
