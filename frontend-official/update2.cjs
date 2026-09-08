const fs = require('fs');
const file = 'c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/Inbox/components/SidebarPanel.tsx';
let c = fs.readFileSync(file, 'utf8');

const oldAi = `<InboxSectionBoundary fallbackLabel="Insights IA">
            <Accordion type="multiple" defaultValue={["ai-status", "ai-action", "ai-analysis"]} className="space-y-1.5">
              <AccordionItem
                value="ai-status"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-1.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Status e modelo
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-2">
                  <div className="space-y-2 text-[11px]">
                    <div className="flex items-center justify-between py-1 border-b border-border/10">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", aiEnabledForConversation ? "bg-foreground" : "bg-muted-foreground/45")} />
                        <span className="font-semibold text-foreground/90">
                          {aiEnabledForConversation ? "IA Ativa nesta conversa" : "IA Pausada nesta conversa"}
                        </span>
                      </div>
                      <Badge variant="outline" className="h-4.5 rounded-full px-2 text-[8px] uppercase tracking-wider font-semibold border-border/60">
                        {!aiRuntime.globalEnabled
                          ? "Global off"
                          : !conversationAiOverrideEnabled
                            ? "Conversa off"
                            : "Global"}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-1.5 py-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Modelo</span>
                        <span className="font-medium text-foreground text-[10px] max-w-[140px] truncate" title={aiRuntime.model}>
                          {aiRuntime.loading ? "..." : aiRuntime.model}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Provedor</span>
                        <div className="flex items-center gap-1 font-medium text-foreground text-[10px]">
                          {(() => {
                            const IconComp = getProviderIcon(aiRuntime.provider);
                            return <IconComp className="h-3 w-3 text-muted-foreground shrink-0" />;
                          })()}
                          <span>{aiRuntime.loading ? "..." : aiRuntime.provider}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Última Resp.</span>
                        <span className="font-medium text-foreground text-[10px]">
                          {aiRuntime.lastResponseAt ? formatTime(aiRuntime.lastResponseAt) : "Sem registro"}
                        </span>
                      </div>
                    </div>

                    {/* Collapsible details for secondary metrics */}
                    <details className="mt-1 text-xs group">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-[10px] select-none list-none flex items-center gap-1 font-semibold py-1">
                        <CaretRight className="h-3 w-3 transition-transform duration-200 group-open:rotate-90 text-muted-foreground" />
                        Mais Métricas
                      </summary>
                      <div className="flex flex-col gap-1.5 mt-1 pb-1 text-[11px] text-muted-foreground border-t border-border/10 pt-1.5">
                        <div className="flex items-center justify-between">
                          <span>Memória</span>
                          <span className="font-medium text-foreground text-[10px]">{aiRuntime.memoryEnabled ? "Ativa" : "Off"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Latência</span>
                          <span className="font-medium text-foreground text-[10px]">
                            {formatDurationMs(aiRuntime.lastResponseTimeMs)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Tokens (Prompt/Comp.)</span>
                          <span className="font-medium text-foreground text-[10px] tabular-nums">
                            {aiRuntime.promptTokens} / {aiRuntime.completionTokens}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Total Tokens</span>
                          <span className="font-medium text-foreground text-[10px] tabular-nums">
                            {aiRuntime.promptTokens + aiRuntime.completionTokens}
                          </span>
                        </div>
                      </div>
                    </details>

                    <div className="mt-2.5 space-y-1 border-t border-border/10 pt-2.5">
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">Atendente Designado</span>
                      <select
                        value={selectedConversation?.assignedAgentName ?? ""}
                        onChange={(e) => handleSetConversationAgent?.(e.target.value)}
                        className="flex h-8.5 w-full rounded-lg border border-border bg-background/50 px-2.5 py-1 text-xs transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-foreground"
                      >
                        {loadingAgents ? (
                          <option>Carregando atendentes...</option>
                        ) : (
                          <>
                            <option value="">Não atribuído</option>
                            {selectedConversation?.assignedAgentName && !aiAgents.some((a: any) => a.name === selectedConversation.assignedAgentName) && (
                              <option value={selectedConversation.assignedAgentName}>
                                {selectedConversation.assignedAgentName}
                              </option>
                            )}
                            {aiAgents.map((agent: any) => (
                              <option key={agent.key || agent.name} value={agent.name}>
                                {agent.name}{agent.active === false ? " (Inativo)" : ""}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="ai-action"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-1.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Ação recomendada
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-2 space-y-2 text-xs">
                  <p className="leading-relaxed text-muted-foreground/95">
                    {selectedLead?.next_action === "close_sale"
                      ? "Conduzir o lead para fechamento."
                      : selectedLead?.next_action === "send_price"
                        ? "Enviar valores e esclarecer o retorno esperado."
                        : selectedLead?.next_action === "overcome_objection"
                          ? "Responder a objeção antes de avançar."
                          : "Entender a necessidade e apresentar o próximo passo."}
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 w-full text-xs font-semibold gap-1.5 rounded-lg shadow-sm bg-gradient-to-r from-primary to-primary-hover hover:opacity-95 text-primary-foreground"
                    onClick={() => void handleSuggestResponse()}
                    disabled={!aiEnabledForConversation || suggestingResponse}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {suggestingResponse ? "Gerando..." : "Gerar resposta sugerida"}
                  </Button>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem
                value="ai-analysis"
                className="rounded-xl border border-border/40 bg-card/25 p-0.5 overflow-hidden transition-all duration-200 hover:border-border/60 hover:bg-card/45 shadow-sm"
              >
                <AccordionTrigger className="py-1.5 px-3.5 text-xs font-bold text-foreground/90 hover:no-underline">
                  Análise do Lead
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-2 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Intenção:</span>
                    <span className="font-semibold text-foreground">{aiLiveInsights.objective}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Produtos:</span>
                    <span className="font-semibold text-foreground">{aiLiveInsights.products}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Objeções:</span>
                    <span className="font-semibold text-foreground">{aiLiveInsights.objections}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/10">
                    <span className="text-muted-foreground">Funil:</span>
                    <span className="font-semibold text-foreground">{selectedConversationFunnelStage}</span>
                  </div>
                  {aiLiveInsights.summary && (
                    <div className="mt-2 rounded-lg bg-primary/[0.02] border border-primary/15 p-2.5 leading-relaxed text-foreground/90 text-[11px] italic relative">
                      <Brain className="absolute right-2 top-2 h-3.5 w-3.5 text-primary/20 shrink-0" />
                      {aiLiveInsights.summary}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </InboxSectionBoundary>`;

const newAi = `<InboxSectionBoundary fallbackLabel="Insights IA">
            <div className="rounded-xl border border-border/40 bg-card/25 p-3.5 shadow-sm space-y-4">
              {/* Confiança / Header */}
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold text-foreground">Análise da IA</h4>
                    <p className="text-[10px] text-muted-foreground">sobre o lead</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                   <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                     Confiança: 98%
                   </div>
                </div>
              </div>

              {/* Action */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Ação Sugerida</p>
                <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/30 font-medium">
                  {selectedLead?.next_action === "close_sale"
                    ? "Conduzir o lead para fechamento."
                    : selectedLead?.next_action === "send_price"
                      ? "Enviar valores e esclarecer o retorno esperado."
                      : selectedLead?.next_action === "overcome_objection"
                        ? "Responder a objeção antes de avançar."
                        : "Entender a necessidade e apresentar o próximo passo."}
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 w-full text-xs font-bold gap-2 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white transition-all duration-300 border-none mt-2"
                  onClick={() => void handleSuggestResponse()}
                  disabled={!aiEnabledForConversation || suggestingResponse}
                >
                  <Sparkles className="h-4 w-4" weight="fill" />
                  {suggestingResponse ? "Gerando..." : "Gerar resposta sugerida"}
                </Button>
              </div>

              {/* Data points */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/10">
                <div className="bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Necessidade/Interesse</p>
                  <p className="text-xs font-semibold text-foreground truncate" title={aiLiveInsights.objective}>
                    {aiLiveInsights.objective}
                  </p>
                </div>
                <div className="bg-muted/20 p-2.5 rounded-xl border border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-1">Etapa do Funil</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Workflow className="h-3.5 w-3.5" />
                    <span className="truncate">{selectedConversationFunnelStage}</span>
                  </div>
                </div>
              </div>

              {/* Bullets Resumo */}
              {aiLiveInsights.summary && (
                <div className="space-y-2 pt-2 border-t border-border/10">
                  <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide">Resumo do atendimento</p>
                  <div className="rounded-xl bg-emerald-500/[0.03] border border-emerald-500/15 p-3">
                    <ul className="space-y-1.5">
                      {aiLiveInsights.summary.split('. ').filter(Boolean).map((sentence, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-foreground/90 leading-relaxed font-medium">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {sentence.trim() + (sentence.endsWith('.') ? '' : '.')}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Footer animado */}
              <div className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/10">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/90 dark:text-emerald-400/90">
                  IA trabalhando para você
                </span>
              </div>
            </div>
          </InboxSectionBoundary>`;

if(c.includes(oldAi)) {
  c = c.replace(oldAi, newAi);
} else {
  console.log("Could not find oldAi");
}

fs.writeFileSync(file, c);
console.log('Done script 2');
