# outros/ — Repositório de Artefatos do ZapFlow

Este diretório é o **repositório oficial de artefatos auxiliares** do ZapFlow.
Não é um depósito de "tudo que não sei onde colocar".
É uma área deliberadamente organizada de artefatos de desenvolvimento.

---

## Estrutura

```
outros/
├── ai/
│   ├── analyses/       → análises arquiteturais geradas por agentes
│   ├── experiments/    → experimentos de melhoria autônoma (ratchet loop)
│   └── agent-reports/  → relatórios de execução de agentes
│
├── plans/              → planos de feature, brainstorming, ADRs
│
├── reports/
│   ├── qa/             → relatórios de qualidade (npm run qa)
│   ├── security/       → relatórios de segurança
│   └── architecture/   → revisões de arquitetura, code reviews
│
├── diagnostics/        → diagnósticos de bugs (root cause analysis)
├── generated/          → arquivos gerados automaticamente
├── exports/            → exports de dados, dumps de análise
├── migrations/         → scripts de migration em análise (NÃO executáveis)
├── temp/               → arquivos temporários (limpar após uso)
└── archive/            → histórico de artefatos antigos
```

---

## Regra do Agente — Classificar Antes de Criar

```
NOVO ARQUIVO?
      │
      ├─ Código de produção?      → backend/ frontend-official/ scripts/ infrastructure/
      ├─ Teste executável?        → tests/
      ├─ Documentação principal?  → docs/
      └─ Artefato auxiliar?       → outros/<subdiretório>
```

| Tipo de arquivo | Subdiretório |
|----------------|-------------|
| Relatório de QA | `reports/qa/` |
| Relatório de segurança | `reports/security/` |
| Code review / revisão | `reports/architecture/` |
| Relatório de Engineering Pack | `reports/` |
| Plano de feature | `plans/` |
| Resultado de brainstorming | `plans/` |
| ADR (Architecture Decision Record) | `plans/` |
| Diagnóstico de bug | `diagnostics/` |
| Análise arquitetural de IA | `ai/analyses/` |
| Experimento de melhoria autônoma | `ai/experiments/` |
| Relatório de execução de agente | `ai/agent-reports/` |
| Arquivo gerado automaticamente | `generated/` |
| Export de dados | `exports/` |
| Script de migration em análise | `migrations/` |
| Arquivo temporário | `temp/` |
| Artefato histórico | `archive/` |

---

## O que NÃO vai para outros/

```
❌ Código de produção (backend/, frontend-official/, scripts/, infrastructure/)
❌ Arquivos de configuração do projeto (package.json, docker-compose.yml, etc.)
❌ Arquivos de secrets (.env, .env.*, *.pem, *.key)
❌ Testes executáveis (vão para tests/)
❌ Documentação principal (vai para docs/)
❌ Qualquer coisa que o sistema precise em produção
```

---

## Convenção de Nomenclatura

```
reports/qa/         → qa-report-YYYY-MM-DD.md
reports/security/   → security-YYYY-MM-DD.md
reports/architecture/ → review-<feature>-YYYY-MM-DD.md
plans/              → <feature>-plan-YYYY-MM-DD.md
diagnostics/        → <issue>-debug-YYYY-MM-DD.md
ai/experiments/     → experiment-<nome>-YYYY-MM-DD.md
temp/               → temp-<descrição>-<timestamp>
```

---

## Limpeza

- `temp/`: limpar após uso — não acumular arquivos temporários
- `archive/`: manter histórico mas não crescer indefinidamente
- Revisar periodicamente artefatos com mais de 90 dias
