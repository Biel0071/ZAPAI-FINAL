---
name: devops
description: Use para deploy, infraestrutura e operação do ZAPFLOW — Docker, PM2, Nginx/OpenResty, SSL, healthcheck, deploy, rollback, backup, CI/CD. Aciona ao deployar, mexer em config de infra, ou diagnosticar problema de produção na VPS.
---

# DevOps Skill

## Infra real

- **VPS produção:** `209.50.241.22` (AlmaLinux), app em `/opt/zapai`. Acesso SSH via `./node.exe` + lib `ssh2` (scripts em `tmp_ssh/` — contêm senha, nunca commitar).
- **PM2:** processo `zapflow-api`, porta 4025, **fork 1 instância** (Baileys é stateful — NUNCA cluster). `ecosystem.config.js`.
- **Nginx/OpenResty:** container "iContainer". Frontend dist servido de `/www/zapai`. Config `deploy/lib/nginx.sh` auto-detecta e recarrega.
- **Docker:** compose dev (postgres/redis/backend) e production (7 serviços: nginx/certbot/postgres/redis/backup/backend/dozzle).

## Deploy

```bash
# fluxo: commit → push → auto-deploy na VPS
cd /opt/zapai && bash deploy/auto-deploy.sh
```
Faz: pull → deps → migrations → build (tsc+vite) → PM2 reload → nginx reload → health check (12 tentativas em /api/health) → **rollback automático** (trap ERR) → snapshot em `releases/`. Flags: `--skip-build`, `--skip-migrate`, `--dry-run`.

- **Rollback:** `deploy/rollback.sh` (`--list`, ou volta pro `releases/previous`).
- **Backup:** `scripts/backup.sh` (pg_dump + sessions + uploads, retém 7).
- **Healthcheck:** `curl http://209.50.241.22/api/health` (status/db/whatsapp).
- **CI/CD:** `.github/workflows/` (tests.yml, deploy.yml, release.yml, lovable-sync-guard).

## Regra

Sempre validar build local (`../node.exe node_modules/vite/bin/vite.js build`) antes de deployar. Health check pós-deploy é obrigatório — se falhar, o rollback é automático mas confirmar.
