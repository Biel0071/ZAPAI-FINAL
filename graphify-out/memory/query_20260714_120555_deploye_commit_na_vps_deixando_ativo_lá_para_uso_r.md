---
type: "query"
date: "2026-07-14T12:05:55.013354+00:00"
question: "deploye commit na VPS deixando ativo lá para uso real"
contributor: "graphify"
outcome: "useful"
source_nodes: ["deploy", "healthcheck.js", "nginx.sh", "RuntimeProvider.tsx", "apiService.ts"]
---

# Q: deploye commit na VPS deixando ativo lá para uso real

## Answer

Expanded from original query via graph vocab: [deploy, production, health, docker, nginx, runtime, server, update, restart, backend, frontend]. Deployment path confirmed through deploy/auto-deploy.sh: push main, VPS git reset to origin/main, migrations, TypeScript, Vite build, PM2 restart, Nginx/OpenResty reload, backend health, PostgreSQL and Redis checks. Commit 5265b62 deployed successfully. Public root and /inbox both return HTTP 200 with the production host; backend health success=true, db=true, WhatsApp connected.

## Outcome

- Signal: useful

## Source Nodes

- deploy
- healthcheck.js
- nginx.sh
- RuntimeProvider.tsx
- apiService.ts