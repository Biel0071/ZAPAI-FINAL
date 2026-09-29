const fs = require('fs');

const file = 'c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/lovable/pages/AIView.tsx';
let content = fs.readFileSync(file, 'utf8');

// I will just read the exact lines from sidebar.txt
let sidebarContent = fs.readFileSync('c:/projetos/ZAPAI-FINAL/sidebar.txt', 'utf8');
// Trim trailing whitespace from the extraction
sidebarContent = sidebarContent.replace(/\r/g, '').trim();

// The exact string in AIView.tsx is using LF or CRLF, so we will match by stripping \r and normalizing
let normalizedContent = content.replace(/\r/g, '');

const oldSidebarStart = `            <aside className="w-full lg:w-[240px] shrink-0 bg-card/50 border border-border/60 rounded-2xl p-4 space-y-1">`;
const oldSidebarEnd = `              </button>\n            </aside>`;

const startIndex = normalizedContent.indexOf(oldSidebarStart);
const endIndex = normalizedContent.indexOf(oldSidebarEnd, startIndex) + oldSidebarEnd.length;

const newSidebar = `            <aside className="w-full lg:w-[240px] shrink-0 bg-card/50 border border-border/60 rounded-2xl p-4 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Visão Geral</div>
              
              <button
                onClick={() => onSectionChange("dashboard")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "dashboard" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard IA</span>
              </button>

              <button
                onClick={() => onSectionChange("evolution")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left mt-1",
                  activeInternalTab === "evolution" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BrainCircuit className="h-4 w-4 text-emerald-400" />
                <span className="flex items-center gap-1.5">
                  Evolução IA
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </span>
              </button>

              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-2">Inteligência</div>

              <button
                onClick={() => onSectionChange("conhecimento")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "conhecimento" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Verdade Oficial</span>
              </button>

              <button
                onClick={() => onSectionChange("playbooks")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left mt-1",
                  activeInternalTab === "playbooks" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Target className="h-4 w-4 text-purple-400" />
                <span>Playbooks</span>
              </button>

              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-2">Sistema</div>

              <button
                onClick={() => onSectionChange("configuracoes")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  (activeInternalTab === "configuracoes" || ["atendentes", "provedores", "operacao", "analise"].includes(activeInternalTab)) ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Sliders className="h-4 w-4" />
                <span>Configurações</span>
              </button>
            </aside>`;

if (startIndex > -1 && endIndex > startIndex) {
  normalizedContent = normalizedContent.substring(0, startIndex) + newSidebar + normalizedContent.substring(endIndex);
}

// Subtabs replacement
const oldAtendentesStart = `              {/* TAB 2: ATENDENTES */}
              {activeInternalTab === "atendentes" && (
                <div className="space-y-6">
                  {/* Subtabs Menu */}
                  <div className="flex gap-2 border-b border-border/60 pb-2">
                    <button
                      onClick={() => setActiveAtendentesSubTab("lista")}`;

const oldAtendentesEnd = `                  </div>

                  {activeAtendentesSubTab === "lista" && (`;

const atIdx = normalizedContent.indexOf(oldAtendentesStart);
const endAtIdx = normalizedContent.indexOf(oldAtendentesEnd, atIdx) + oldAtendentesEnd.length;

const newAtendentesBlock = `              {/* TAB 2: CONFIGURAÇÕES GERAIS */}
              {(activeInternalTab === "configuracoes" || ["atendentes", "provedores", "operacao", "analise"].includes(activeInternalTab)) && (
                <div className="space-y-6">
                  {/* Subtabs Menu */}
                  <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
                    <button
                      onClick={() => onSectionChange?.("atendentes")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        (activeInternalTab === "atendentes" || activeInternalTab === "configuracoes") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Meus Atendentes
                    </button>
                    <button
                      onClick={() => onSectionChange?.("provedores")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeInternalTab === "provedores" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Provedores LLM
                    </button>
                    <button
                      onClick={() => onSectionChange?.("operacao")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeInternalTab === "operacao" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Regras de Operação
                    </button>
                    <button
                      onClick={() => onSectionChange?.("analise")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeInternalTab === "analise" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Auditoria & Logs
                    </button>
                  </div>

                  {(activeInternalTab === "configuracoes" || activeInternalTab === "atendentes") && (
                    <>
                      <div className="flex gap-2 border-b border-border/60 pb-2 mb-4">
                        <button
                          onClick={() => setActiveAtendentesSubTab("lista")}
                          className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                            activeAtendentesSubTab === "lista" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          Lista
                        </button>
                        <button
                          onClick={() => setActiveAtendentesSubTab("simulador")}
                          className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                            activeAtendentesSubTab === "simulador" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          Simulador
                        </button>
                      </div>
                      {activeAtendentesSubTab === "lista" && (`;

if (atIdx > -1 && endAtIdx > atIdx) {
  normalizedContent = normalizedContent.substring(0, atIdx) + newAtendentesBlock + normalizedContent.substring(endAtIdx);
}

const endOfListTab = `                  )}
                  
                  {activeAtendentesSubTab === "simulador" && (`;
const newEndOfListTab = `                      )}
                    </>
                  )}
                  
                  {(activeInternalTab === "configuracoes" || activeInternalTab === "atendentes") && activeAtendentesSubTab === "simulador" && (`;

const endListIdx = normalizedContent.indexOf(endOfListTab);
if (endListIdx > -1) {
  normalizedContent = normalizedContent.substring(0, endListIdx) + newEndOfListTab + normalizedContent.substring(endListIdx + endOfListTab.length);
}

fs.writeFileSync(file, normalizedContent, 'utf8');
console.log('Sidebar updated');
