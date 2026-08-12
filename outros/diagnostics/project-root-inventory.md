# Inventário Completo da Raiz do Projeto (Fase 1)

**Projeto:** `c:\projetos\ZAPAI-FINAL`  
**Data:** 2026-08-11  
**Ferramentas:** Google Antigravity / Gemini 3.6 High  

---

## 📌 Categorização dos Itens Encontrados

### A) ARQUITETURA DO SISTEMA
- `.agents/` — Diretório canônico do framework de agentes de IA (skills, agentes, regras).
- `.claude/` — Configurações locais e skills ativas do Claude Code.
- `.zapflow/` — Manifesto de skills (`skills.json`), lockfile (`lock.json`), política de segurança (`policy.json`) e perfil do projeto (`project-profile.json`).
- `graphify-out/` — Grafo de dependências e mapa arquitetural extraído pelo Graphify.
- `AGENTS.md` — Instruções e regras primárias dos agentes para o repositório.
- `zapflow-engineering-pack/` — Pacote de engenharia universal (a ser renomeado para `skill-global` na Fase 12).

### B) CÓDIGO
- `backend/` — Código do servidor Node.js/Express, API REST, WebSocket, Baileys WhatsApp.
- `frontend-official/` — Código da SPA React + Vite + TypeScript.

### C) CONFIGURAÇÃO
- `package.json` — Manifesto de dependências e scripts npm na raiz.
- `package-lock.json` — Lockfile de dependências npm.
- `pm2.json` — Configuração do gerenciador de processos PM2.
- `.gitignore` — Regras de ignorados do Git.
- `.gitattributes` — Configuração de final de linha do Git.
- `.env.example` — Template de variáveis de ambiente.
- `.env.production.example` — Template de variáveis de produção.
- `.env`, `.env.local`, `.env.production`, `.env.production.local` *(atualmente em `outros/`)* — Configurações reais de ambiente com segredos.

### D) TESTES
- `tests/` — Testes unitários, de integração, suítes Playwright e testes do engineering pack.

### E) DOCUMENTAÇÃO
- `README.md` — Documentação principal do repositório.
- `docs/` — Documentação técnica (arquitetura, deployment, runtime, auditorias).
- `CHANGELOG.md` *(atualmente em `outros/`)* — Histórico de versões e alterações do sistema.
- `CLAUDE.md` *(atualmente em `outros/`)* — Diretrizes e fluxos operacionais de IA.

### F) INFRAESTRUTURA
- `Dockerfile` — Definição de container de produção.
- `docker-compose.yml` — Configuração Docker local.
- `docker-compose.production.yml` — Configuração Docker para produção.
- `infrastructure/` — Configurações de Nginx, SSL e infraestrutura.
- `deploy/` — Scripts de deploy oficial (`deploy.sh`, `auto-deploy.sh`, `backup.sh`, `rollback.sh`) e `nginx.conf`.

### G) SCRIPTS
- `scripts/` — Scripts operacionais do sistema (`runtime-*.mjs`, `deploy-*.js`, `qa/`, `run-e2e-smoke.js`, `sync-lovable.ps1`, etc.).
- `Makefile` — Comandos automatizados de build, start, stop e qa.
- `ZAPAI-CONTROL.bat`, `ZAPFLOW-CONTROL.bat`, `START-ZAPAI.bat`, `start-zapflow.bat`, `STATUS-ZAPAI.bat`, `ZAPAI-DEPLOY.bat` *(atualmente em `outros/`)* — Batch files de controle local Windows.
- `vps-*.js` *(atualmente em `outros/`)* — Scripts de consulta e diagnóstico ad-hoc do banco na VPS.
- `check_schema.sh`, `fix_db.sh`, `deploy.sh`, `test.sh` *(atualmente em `outros/`)* — Shell scripts operacionais/auxiliares.

### H) ARTEFATOS
- `outros/` — Diretório oficial de artefatos organizados por categoria.
- `reports/` — Pasta legada de relatórios (a ser consolidada em `outros/reports/`).
- Relatórios soltos em `outros/`:
  - `FINAL_ENTERPRISE_STABILIZATION_REPORT.md`
  - `FINAL_OPERATIONAL_VALIDATION_REPORT.md`
  - `FINAL_STABILIZATION_REPORT.md`
  - `PRODUCTION_READINESS_REPORT.md`
  - `CONSOLIDATION_IMPLEMENTATION_REPORT.md`
  - `PROMPTS-ANTIGRAVITY-UPGRADES.md`
  - `PLANO-REVISAO-ADDENDUM.md`
  - `qa-report.json`, `qa-report.md`
  - `refactor-safe.patch`

### I) TEMPORÁRIOS
- `scratch/` — Rascunhos temporários de desenvolvimento.
- `tmp_ssh/` — Chaves e scripts temporários para diagnóstico SSH na VPS (gitignorado).
- `scratch_conversationRepository.js` *(atualmente em `outros/`)* — Rascunho pontual.

### J) BACKUPS
- `backups/` — Diretório de backups locais e tarballs.

### K) HISTÓRICOS
- `archive/` — Artefatos legados e arquivos históricos.
- `TODO-BUGS.md` *(atualmente em `outros/`)* — Checklist histórico de bugs.

### L) DESCONHECIDOS / DIVERSOS
- `storage/` — Armazenamento de runtime.
- `logs/` — Logs operacionais do sistema.
- `vendor/` — Cache local de skills upstream.
- `node.exe` *(atualmente em `outros/`)* — Binário executável do Node preservado no repositório.

---

## 🔒 Status de Preservação (Fase 1)

Nenhum arquivo foi movido durante a Fase 1. Todos os itens foram catalogados e mapeados para posterior alocação segura na Fase 2 e subsequentes.
