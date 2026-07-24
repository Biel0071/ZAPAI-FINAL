---
name: architect
description: Use antes de qualquer alteração estrutural no ZAPFLOW — analisar estrutura, dependências, impacto, modularização, escalabilidade e aderência a SOLID/DDD antes de codar. Aciona em refactors, novos módulos, mudança de camadas (routes/controllers/services/repositories), ou quando a tarefa pode afetar a arquitetura.
---

# Architect Skill

Responsável por toda decisão de arquitetura no ZAPFLOW AI. Nunca permitir overengineering.

## Antes de qualquer alteração, analisar

1. **Estrutura** — onde isso vive? Respeita `routes → controllers → services → repositories → config/database` (backend) e `pages → adapters/lovable → lovable/*View` (frontend)?
2. **Dependências** — o que importa isso? O que isso importa? Rodar a skill `graphify` para ver o grafo real antes de mover/renomear.
3. **Impacto** — quem quebra se eu mudar a assinatura/contrato? APIs não podem quebrar.
4. **Modularização** — cabe num módulo existente ou justifica um novo? Evitar arquivos soltos.
5. **Escalabilidade** — multi-tenant por `companyId` mantido? Baileys stateful (1 instância PM2) respeitado?
6. **DDD / SOLID** — só onde agrega. Não criar camadas de abstração para um único caso de uso.

## Regras

- Reutilizar antes de criar. Procurar componente/serviço existente (há muitos órfãos prontos: RichCampaignEditor, ConversionHeatmap, etc.).
- Não quebrar contratos de API nem eventos de socket sem migração.
- Toda mudança de arquitetura precisa de justificativa explícita.
- Se a mudança for não trivial, planejar (EnterPlanMode) antes de codar.

Ver `CLAUDE.md` e `docs/ARCHITECTURE.md`.
