---
name: graphify
description: Use para mapear dependências, imports, fluxo de chamadas, ciclos e impacto do código do ZAPFLOW antes de alterar arquivos ou mover/renomear módulos. Aciona no início de tarefas estruturais e quando precisar entender o que quebra ao mudar algo.
---

# Graphify Skill

Ferramenta de mapa de código (CLI `graphify`, já instalado e liberado). Custo zero de API.

## No início de uma tarefa estrutural

```bash
graphify update .
```

Isso regenera em `graphify-out/`:
- **Dependências / imports** — quem importa o quê
- **Fluxo de chamadas** — `ZAPAI-FINAL-callflow.html`
- **Arquitetura / comunidades** — `GRAPH_REPORT.md` (god nodes, hubs, ciclos)
- **Ciclos de import** — seção "Import Cycles"
- **Impacto** — usar antes de mover/renomear/remover um arquivo

## Como usar o mapa

- Antes de renomear/mover um símbolo: checar quem depende dele no `GRAPH_REPORT.md`.
- Antes de remover código: confirmar que é órfão (0 imports) no grafo.
- Ao investigar acoplamento: olhar god nodes e comunidades.
- O relatório traz o commit de origem — se estiver defasado do HEAD, rodar `graphify update .` de novo.

Complementa a skill `architect` (passo 2 do fluxo em `CLAUDE.md`).
