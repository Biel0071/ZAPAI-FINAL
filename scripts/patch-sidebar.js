const fs = require('fs');
const file = 'c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/lovable/pages/AIView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace "IA & Automação" with "Visão Geral"
content = content.replace(/IA & Automa.+o/, 'Visão Geral');

// Replace the Atendentes, Provedores, Operação buttons with Configurações
const targetRegex = /<button[\s\S]*?onClick=\{\(\) => onSectionChange\("atendentes"\)\}[\s\S]*?<\/button>\s*<button[\s\S]*?onClick=\{\(\) => onSectionChange\("provedores"\)\}[\s\S]*?<\/button>\s*<button[\s\S]*?onClick=\{\(\) => onSectionChange\("operacao"\)\}[\s\S]*?<\/button>/;

const replacement = `<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-2">Sistema</div>
              <button
                onClick={() => onSectionChange("configuracoes")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left",
                  (activeInternalTab === "configuracoes" || ["atendentes", "provedores", "operacao", "analise"].includes(activeInternalTab)) ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Sliders className="h-4 w-4" />
                <span>Configurações Gerais</span>
              </button>`;

content = content.replace(targetRegex, replacement);

// Replace Conhecimento and add Header
const targetConhecimentoRegex = /<button[\s\S]*?onClick=\{\(\) => onSectionChange\("conhecimento"\)\}/;
content = content.replace(targetConhecimentoRegex, `<div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-2">Inteligência</div>\n\n              <button\n                onClick={() => onSectionChange("conhecimento")}`);

// Remove Auditoria & Logs button
const targetAuditoriaRegex = /<button[\s\S]*?onClick=\{\(\) => onSectionChange\("analise"\)\}[\s\S]*?<\/button>/;
content = content.replace(targetAuditoriaRegex, '');

// Now we need to modify the config tabs logic
// Change `activeInternalTab === "atendentes"` logic block
const targetAtendentesBlockRegex = /\{activeInternalTab === "atendentes" && \([\s\S]*?\{activeAtendentesSubTab === "lista" && \(/;

const newAtendentesBlock = `{(activeInternalTab === "configuracoes" || ["atendentes", "provedores", "operacao", "analise"].includes(activeInternalTab)) && (
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

                  {(activeInternalTab === "configuracoes" || activeInternalTab === "atendentes") && (`;

content = content.replace(targetAtendentesBlockRegex, newAtendentesBlock);

fs.writeFileSync(file, content, 'utf8');
console.log('Sidebar updated');
