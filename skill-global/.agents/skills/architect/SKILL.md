---
name: architect
description: Use antes de qualquer alteração estrutural — analisar estrutura, dependências, impacto, modularização, escalabilidade e aderência a SOLID/DDD antes de codar. Aciona em refactors, novos módulos, mudança de camadas, ou quando a tarefa pode afetar a arquitetura.
---

# Architect Skill

Objetivo: **pensar antes de agir**. Nenhuma alteração estrutural no projeto deve ser feita sem uma análise prévia de impacto e modularização.

## Quando usar

- Antes de criar novos serviços, rotas, módulos ou repositórios.
- Antes de refatorar código existente que afeta mais de um arquivo.
- Quando o usuário pede uma feature nova de grande porte.
- Ao identificar duplicidade de código entre módulos.

## Perguntas obrigatórias do Architect

1. **Estrutura atual** — onde este código deveria morar segundo a arquitetura do projeto?
2. **Dependências** — o que importa isso? O que isso importa?
3. **Impacto** — quem quebra se eu mudar a assinatura/contrato? APIs não podem quebrar sem migração.
4. **Modularização** — cabe num módulo existente ou justifica um novo? Evitar arquivos soltos.
5. **Multi-Tenancy** — isolamento por tenant identifier (e.g. tenantId / organizationId / workspaceId) mantido?
6. **DDD / SOLID** — só onde agrega. Não criar camadas de abstração para um único caso de uso.

## Regras

- **Nunca criar um novo módulo** se um existente pode receber a responsabilidade.
- **Respeitar o contrato de API existente** — se mudar, precisa de plano de migração.
- **Documentar a decisão** em `outros/plans/` antes de implementar.
- **Escalar para o usuário** se o refactor afeta mais de 3 diretórios principais.

## Workflow

```
1. ANALISAR ESTRUTURA ATUAL (ler arquivos relevantes)
2. AVALIAR IMPACTO (localizar todos os chamadores)
3. PROPOR SOLUÇÃO MÍNIMA (menor mudança com maior segurança)
4. ESCEVER PLANO EM outros/plans/<nome>-plan.md
5. AGUARDAR APROVAÇÃO DO USUÁRIO
```
