import re

file_path = "c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/lovable/pages/AIView.tsx"

with open(file_path, "r", encoding="utf8") as f:
    content = f.read()

# 1. Sidebar group
sidebar_start = '<aside className="w-full lg:w-[240px] shrink-0 bg-card/50 border border-border/60 rounded-2xl p-4 space-y-1">'
sidebar_end = '            </aside>'
idx1 = content.find(sidebar_start)
idx2 = content.find(sidebar_end, idx1)

if idx1 != -1 and idx2 != -1:
    old_sidebar = content[idx1:idx2 + len(sidebar_end)]
    
    new_sidebar = """<aside className="w-full lg:w-[240px] shrink-0 bg-card/50 border border-border/60 rounded-2xl p-4 space-y-1">
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
            </aside>"""
    
    content = content.replace(old_sidebar, new_sidebar)

# 2. Configurações Tabs setup
tab2_start = '              {/* TAB 2: ATENDENTES */}'
content = content.replace(tab2_start, '              {/* TAB 2: CONFIGURACOES */}')

old_atendentes_logic = '{activeInternalTab === "atendentes" && ('
new_atendentes_logic = '{(activeInternalTab === "configuracoes" || ["atendentes", "provedores", "operacao", "analise"].includes(activeInternalTab)) && ('
content = content.replace(old_atendentes_logic, new_atendentes_logic)

# Replace the subtabs menu
old_subtabs = """                  {/* Subtabs Menu */}
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
                  </div>"""

new_subtabs = """                  {/* Subtabs Menu */}
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
                  </div>"""

content = content.replace(old_subtabs, new_subtabs)

# Modify the Atendentes wrapper logic
content = content.replace(
    '                  {activeAtendentesSubTab === "lista" && (',
    '                  {(activeInternalTab === "configuracoes" || activeInternalTab === "atendentes") && activeAtendentesSubTab === "lista" && ('
)

content = content.replace(
    '                  {activeAtendentesSubTab === "simulador" && (',
    '                  {(activeInternalTab === "configuracoes" || activeInternalTab === "atendentes") && activeAtendentesSubTab === "simulador" && ('
)

with open(file_path, "w", encoding="utf8") as f:
    f.write(content)

print("Updated perfectly.")
