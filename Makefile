.PHONY: up down restart rebuild logs ps health dev backup sessions-backup logs-backend shell-backend psql lint check

# ── Development ──────────────────────────────────────────────────────
dev:
	docker compose -f docker-compose.yml up -d

# ── Production (legacy path) ─────────────────────────────────────────
up:
	docker compose -f docker-compose.production.yml --env-file .env.production up -d

down:
	docker compose -f docker-compose.production.yml down

restart:
	docker compose -f docker-compose.production.yml restart

rebuild:
	docker compose -f docker-compose.production.yml --env-file .env.production up -d --build

logs:
	docker compose -f docker-compose.production.yml logs -f --tail=100

ps:
	docker compose -f docker-compose.production.yml ps

health:
	@curl -s http://localhost:4025/health | echo "Backend: $$(cat)"

# ── Database ─────────────────────────────────────────────────────────
backup:
	bash deploy/backup.sh

sessions-backup:
	docker run --rm -v zapai_sessions:/data -v $(PWD)/backups:/backup alpine \
		tar czf /backup/sessions-$(shell date +%Y%m%d-%H%M%S).tar.gz -C /data .

logs-backend:
	docker compose -f docker-compose.production.yml logs -f zapai-backend

shell-backend:
	docker exec -it zapai-backend sh

psql:
	docker exec -it zapai-postgres psql -U zapai -d zapai_crm

# ── Lint / validation ──────────────────────────────────────────────
lint-backend:
	node --check backend/server.js
	node --check backend/routes/auth.js
	node --check backend/config/database.js

lint-frontend:
	cd frontend && npx tsc --noEmit

build-frontend:
	cd frontend && npm run build
