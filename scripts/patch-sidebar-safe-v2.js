const fs = require('fs');

const file = 'c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/lovable/pages/AIView.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldSidebar = `            <aside className="w-full lg:w-[240px] shrink-0 bg-card/50 border border-border/60 rounded-2xl p-4 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">IA & Automação</div>
              
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
                onClick={() => onSectionChange("atendentes")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "atendentes" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Users className="h-4 w-4" />
                <span>Atendentes</span>
              </button>

              <button
                onClick={() => onSectionChange("provedores")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "provedores" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Cpu className="h-4 w-4" />
                <span>Provedores</span>
              </button>

              <button
                onClick={() => onSectionChange("operacao")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "operacao" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Sliders className="h-4 w-4" />
                <span>Operação</span>
              </button>

              <button
                onClick={() => onSectionChange("evolution")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "evolution" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BrainCircuit className="h-4 w-4 text-emerald-400" />
                <span className="flex items-center gap-1.5">
                  Evolução IA
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </span>
              </button>

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
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "playbooks" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Target className="h-4 w-4 text-purple-400" />
                <span>Playbooks</span>
              </button>

              <button
                onClick={() => onSectionChange("analise")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  activeInternalTab === "analise" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Auditoria & Logs</span>
              </button>
            </aside>`;

const newSidebar = `<aside className="w-full lg:w-[240px] shrink-0 bg-card/50 border border-border/60 rounded-2xl p-4 space-y-1">
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

// We will use replace with exact string match, handling potential \r\n differences.
let oldSidebarNorm = oldSidebar.replace(/\r/g, '');
let newSidebarNorm = newSidebar.replace(/\r/g, '');
let contentNorm = content.replace(/\r/g, '');

// Since the file has "IA & Automação" encoded weirdly, we match only up to `<aside` and manually replace it in chunks if we have to.
// Actually, let's just do an index of:
const asideStart = '<aside className="w-full lg:w-[240px] shrink-0 bg-card/50 border border-border/60 rounded-2xl p-4 space-y-1">';
const asideEnd = '            </aside>';
const idx1 = contentNorm.indexOf(asideStart);
const idx2 = contentNorm.indexOf(asideEnd, idx1);

if (idx1 > -1 && idx2 > -1) {
    contentNorm = contentNorm.substring(0, idx1) + newSidebarNorm + contentNorm.substring(idx2 + asideEnd.length);
}

// Subtabs setup
const tab2_start = '              {/* TAB 2: ATENDENTES */}';
contentNorm = contentNorm.replace(tab2_start, '              {/* TAB 2: CONFIGURAÇÕES */}');

const old_atendentes_logic = '{activeInternalTab === "atendentes" && (';
const new_atendentes_logic = '{(activeInternalTab === "configuracoes" || ["atendentes", "provedores", "operacao", "analise"].includes(activeInternalTab)) && (';
contentNorm = contentNorm.replace(old_atendentes_logic, new_atendentes_logic);

const old_subtabs = `                  {/* Subtabs Menu */}
                  <div className="flex gap-2 border-b border-border/60 pb-2">
                    <button
                      onClick={() => setActiveAtendentesSubTab("lista")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeAtendentesSubTab === "lista" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Meus Atendentes
                    </button>
                    <button
                      onClick={() => setActiveAtendentesSubTab("simulador")}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeAtendentesSubTab === "simulador" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Simulador de Conversa
                    </button>
                    <button
                      onClick={() => {
                        setActiveAnaliseSubTab("evolucao");
                        onSectionChange?.("analise");
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                        activeInternalTab === "analise" && activeAnaliseSubTab === "evolucao" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      Evolução IA
                    </button>
                  </div>`;

const new_subtabs = `                  {/* Subtabs Menu */}
                  <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2 mb-4">
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
                  </div>`;

contentNorm = contentNorm.replace(old_subtabs.replace(/\r/g, ''), new_subtabs);

// Add Atendentes specific subtabs wrapper
const listStart = '                  {activeAtendentesSubTab === "lista" && (';
const listEnd = '                  {activeAtendentesSubTab === "simulador" && (';

contentNorm = contentNorm.replace(
    listStart,
    `                  {(activeInternalTab === "configuracoes" || activeInternalTab === "atendentes") && activeAtendentesSubTab === "lista" && (`
);

contentNorm = contentNorm.replace(
    listEnd,
    `                  {(activeInternalTab === "configuracoes" || activeInternalTab === "atendentes") && activeAtendentesSubTab === "simulador" && (`
);

fs.writeFileSync(file, contentNorm, 'utf8');
console.log("Updated correctly");
