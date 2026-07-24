---
name: documentation
description: Use ao finalizar alterações relevantes no ZAPFLOW para atualizar documentação — README, CHANGELOG, arquitetura, API/Swagger, diagramas e roadmap. Aciona quando uma mudança altera comportamento, contrato de API ou arquitetura.
---

# Documentation Skill

## Atualizar quando aplicável

- **CHANGELOG.md** — toda mudança de comportamento/feature/fix relevante.
- **docs/ARCHITECTURE.md** — quando a arquitetura ou o fluxo mudar.
- **docs/ROADMAP.md** — mover itens entre Backlog/Sprint/Doing/Done/Blocked/Technical Debt.
- **README.md** — se mudar setup, stack, portas ou comandos.
- **API / Swagger** — se criar/alterar endpoint (documentar contrato: método, path, body, resposta).
- **Diagramas** — `graphify update .` regenera o mapa; referenciar em vez de desenhar à mão quando possível.

## Regra

Documentar o **porquê**, não só o quê. Mudança de arquitetura exige justificativa registrada. Não criar docs supérfluos (a skill `karpathy` vale para documentação também — só documentar o que agrega). Não criar arquivos `.md` novos sem necessidade; preferir atualizar os existentes.
