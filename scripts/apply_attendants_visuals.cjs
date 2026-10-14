const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('frontend-official/src/pages/Attendants/AttendantsPage.tsx');
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Replace ROW 0 Simple Attendant Selector
const row0Regex = /\{\/\* ROW 0: SIMPLE ATTENDANT SELECTOR \*\/\}[\s\S]*?<\/section>/;
const visualRow0 = `{/* ROW 0: VISUAL ATTENDANT & EXAMPLE PROFILES SELECTOR */}
        <section aria-label="Seleção de atendente" className="p-4 rounded-2xl border border-border/70 bg-card/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-foreground font-display flex items-center gap-2">
                <span>Atendentes & Perfis de Exemplo</span>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  {agents.length} Ativo(s)
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">Clique no card com a prévia do avatar para personalizar ou testar o funcionário digital.</p>
            </div>
            {/* Hidden native select kept for headless test and accessibility compatibility */}
            <div className="sr-only">
              <Label htmlFor="attendant-selector">Atendente selecionado</Label>
              <select
                id="attendant-selector"
                aria-label="Selecionar atendente"
                value={previewAgent?.isExample ? \`example:\${previewAgent.key}\` : previewAgent?.key || ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value.startsWith("example:")) {
                    const example = EXAMPLE_ATTENDANTS.find((item) => item.key === value.slice("example:".length));
                    if (example) setPreviewAgent({ ...example, active: true, isExample: true });
                    return;
                  }
                  setPreviewAgent(agents.find((agent) => (agent.key || agent.id) === value) || null);
                }}
              >
                <option value="">{isLoading ? "Carregando atendentes…" : "Selecione um atendente"}</option>
                {agents.length > 0 && (
                  <optgroup label="Atendentes cadastrados">
                    {agents.map((agent) => (
                      <option key={agent.key || agent.id} value={agent.key || agent.id}>
                        {agent.name || agent.key}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Perfis de exemplo · demonstração">
                  {EXAMPLE_ATTENDANTS.map((example) => (
                    <option key={example.key} value={\`example:\${example.key}\`}>
                      {example.name} · exemplo
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Horizontal scroll cards with avatar preview & attendant details */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1.5 scrollbar-zai">
            {/* Real Agents */}
            {agents.map((agent) => {
              const isSelected = !previewAgent?.isExample && previewAgent?.key === agent.key;
              const sprite = agent.avatarConfig?.catalogSpriteId || (agent.character?.gender === "male" || agent.name?.toLowerCase().includes("carlos") ? "sprite_r1_c1" : "sprite_r2_c1");
              return (
                <button
                  key={agent.key || agent.id}
                  type="button"
                  onClick={() => setPreviewAgent(agent)}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left shrink-0 cursor-pointer select-none",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50"
                      : "border-border/70 bg-card hover:border-emerald-500/40 hover:bg-card/90"
                  )}
                >
                  <div className="relative h-11 w-11 rounded-lg bg-black/40 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={\`/assets/avatar_factory/catalog/\${sprite}_clean.png\`}
                      alt={agent.name}
                      className="h-full w-full object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border border-black animate-pulse" />
                  </div>
                  <div className="min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground truncate max-w-[110px]">{agent.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                        Ativo
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate max-w-[130px]">{agent.role || "Especialista"}</span>
                  </div>
                </button>
              );
            })}

            {/* Separator */}
            <div className="h-8 w-px bg-border/60 shrink-0" />

            {/* Example Profiles (João, Ana, Pedro, Mariana) with Visual Avatar Thumbnails */}
            {EXAMPLE_ATTENDANTS.map((example) => {
              const isSelected = previewAgent?.isExample && previewAgent?.key === example.key;
              const sprite = example.avatarConfig?.catalogSpriteId || "sprite_r1_c2";
              return (
                <button
                  key={example.key}
                  type="button"
                  onClick={() => setPreviewAgent({ ...example, active: true, isExample: true })}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left shrink-0 cursor-pointer select-none",
                    isSelected
                      ? "border-amber-500 bg-amber-500/15 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/50"
                      : "border-border/60 bg-card/40 hover:border-amber-500/40 hover:bg-card/70"
                  )}
                >
                  <div className="relative h-11 w-11 rounded-lg bg-black/40 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={\`/assets/avatar_factory/catalog/\${sprite}_clean.png\`}
                      alt={example.name}
                      className="h-full w-full object-contain filter contrast-105"
                      style={{ imageRendering: "pixelated" }}
                    />
                    <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-amber-400 border border-black" />
                  </div>
                  <div className="min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground truncate max-w-[100px]">{example.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-300 bg-amber-500/10">
                        Exemplo
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate max-w-[120px]">{example.role}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>`;

if (row0Regex.test(code)) {
  code = code.replace(row0Regex, visualRow0);
  console.log('ROW 0 replaced successfully');
} else {
  console.error('ROW 0 regex did not match');
}

// 2. Reassign modal header with avatar thumbnail
const reassignModalTarget = `<DialogTitle className="font-display text-base">
              Vincular Conexão WhatsApp a {reassignAgent?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Regra Oficial: 1 Número WhatsApp = 1 Atendente Principal. Ao vincular, o atendente anterior deste número será substituído com segurança.
            </DialogDescription>`;

const reassignModalReplacement = `<div className="flex items-center gap-3 mb-1">
              <div className="h-11 w-11 rounded-xl bg-black/40 border border-emerald-500/40 overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={\`/assets/avatar_factory/catalog/\${reassignAgent?.avatarConfig?.catalogSpriteId || (reassignAgent?.name?.toLowerCase().includes("carlos") || reassignAgent?.character?.gender === "male" ? "sprite_r1_c1" : "sprite_r2_c1")}_clean.png\`}
                  alt={reassignAgent?.name || "Atendente"}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-display text-base truncate">
                  Vincular WhatsApp a {reassignAgent?.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  1 Número = 1 Atendente Principal.
                </DialogDescription>
              </div>
            </div>`;

if (code.includes(reassignModalTarget)) {
  code = code.replace(reassignModalTarget, reassignModalReplacement);
  console.log('Reassign modal updated successfully');
} else {
  console.error('Reassign modal target not found');
}

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Done!');
