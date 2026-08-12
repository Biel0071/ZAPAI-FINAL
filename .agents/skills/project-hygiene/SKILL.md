---
name: project-hygiene
description: Use sempre que criar um arquivo novo, gerar um artefato, escrever um relatório ou produzir qualquer output — classificar onde o arquivo deve ir antes de criá-lo. Aciona automaticamente ao criar qualquer arquivo que não seja código de produção.
---

# Project Hygiene Skill

Responsável por manter a organização do ZAPFLOW. **Classificar antes de criar.**

## Regra Central

```
ANTES de criar qualquer arquivo, perguntar:
  "Esse arquivo é código de produção ou artefato?"

CÓDIGO DE PRODUÇÃO → diretório correto do sistema
ARTEFATO AUXILIAR → outros/
```

## Árvore de Decisão

```
NOVO ARQUIVO
      │
      ├─ É código que roda em produção?
      │   ├─ Backend Node.js/Express  → backend/
      │   ├─ Frontend React/TS        → frontend-official/src/
      │   ├─ Script executável        → scripts/
      │   ├─ Infraestrutura/Docker    → infrastructure/ ou raiz
      │   └─ Deploy config            → deploy/
      │
      ├─ É um teste?                  → tests/
      │
      ├─ É documentação principal?    → docs/
      │
      └─ É um artefato auxiliar?
          ├─ Relatório de QA          → outros/reports/qa/
          ├─ Relatório de segurança   → outros/reports/security/
          ├─ Relatório de arquitetura → outros/reports/architecture/
          ├─ Plano / proposta         → outros/plans/
          ├─ Diagnóstico de bug       → outros/diagnostics/
          ├─ Análise de IA            → outros/ai/analyses/
          ├─ Experimento de IA        → outros/ai/experiments/
          ├─ Relatório de agente      → outros/ai/agent-reports/
          ├─ Arquivo gerado           → outros/generated/
          ├─ Export de dados          → outros/exports/
          ├─ Arquivo temporário       → outros/temp/
          └─ Arquivo histórico        → outros/archive/
```

## O que NUNCA colocar em outros/

```
❌ package.json ou configurações do projeto
❌ .env ou qualquer arquivo de secrets
❌ Código executável (backend, frontend, scripts)
❌ Arquivos de configuração essenciais (docker-compose.yml, etc.)
❌ Arquivos de migração SQL executáveis
❌ Qualquer coisa que o sistema precise em produção
```

## O que NUNCA colocar na raiz do projeto

```
❌ FINAL_XXX.md
❌ FIX_XXX.md
❌ TEMP_XXX.md
❌ BACKUP_XXX.md
❌ REPORT_XXX.md
❌ NEW_XXX.md
❌ TEST_XXX.md
❌ arquivos de diagnóstico (vps-*.js, tmp_*.js, etc.)
❌ relatórios de qualquer tipo
❌ planos ad-hoc
```

## Nomeação

```
outros/reports/     → <categoria>-<data>-<descricao>.md
outros/plans/       → <feature>-plan-<data>.md
outros/diagnostics/ → <issue>-debug-<data>.md
outros/temp/        → temp-<descricao>-<timestamp>.ext
```

## Limpeza Periódica

Antes de finalizar qualquer tarefa:
1. Verificar se algum artefato ficou na raiz indevidamente
2. Mover para `outros/` se for artefato
3. Remover arquivos em `outros/temp/` após uso

## Raiz do Projeto — Permitidos

```
✅ package.json, package-lock.json
✅ .env.example (não .env real)
✅ docker-compose.yml, docker-compose.production.yml
✅ Dockerfile
✅ README.md, CHANGELOG.md, AGENTS.md
✅ Makefile
✅ .gitignore, .gitattributes
✅ pm2.json
✅ Arquivos de configuração de ferramentas (tsconfig, vite.config, etc.)
```
