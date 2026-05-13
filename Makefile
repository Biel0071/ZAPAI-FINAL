.PHONY: up down restart rebuild logs ps health dev deploy validate doctor ssl backup rollback emergency

# ── Quick Reference ──────────────────────────────────────────────────
# make deploy     → deploy.sh (git pull, build, restart, healthcheck)
# make validate   → validate-vps.sh (25+ production checks)
# make doctor     → runtime-doctor.sh (diagnose issues)
# make ssl        → enable-ssl.sh (needs DOMAIN= and EMAIL=)
# make emergency  → emergency-restart.sh (nuclear restart)
# make rollback   → rollback.sh

# ── Production ──────────────────────────────────────────────────────
up:
	docker compose -f docker-compose.production.yml --env-file .env.production up -d

down:
	docker compose -f docker-compose.production.yml --env-file .env.production down

restart:
	docker compose -f docker-compose.production.yml --env-file .env.production restart

rebuild:
	docker compose -f docker-compose.production.yml --env-file .env.production up -d --build

logs:
	docker compose -f docker-compose.production.yml logs -f --tail=100

logs-backend:
	docker compose -f docker-compose.production.yml logs -f zapai-backend --tail=100

ps:
	docker compose -f docker-compose.production.yml --env-file .env.production ps

# ── Deploy Scripts ───────────────────────────────────────────────────
deploy:
	bash deploy.sh

validate:
	bash validate-vps.sh

doctor:
	bash runtime-doctor.sh

emergency:
	bash emergency-restart.sh

rollback:
	bash rollback.sh

ssl:
	@test -n "$(DOMAIN)" || (echo "Usage: make ssl DOMAIN=your-domain.com EMAIL=admin@domain.com" && exit 1)
	bash enable-ssl.sh $(DOMAIN) $(EMAIL)

# ── Health ───────────────────────────────────────────────────────────
health:
	@echo "=== Health Checks ==="
	@curl -s -o /dev/null -w "Frontend: %{http_code}\n" http://localhost:3000 || echo "Frontend: FAIL"
	@curl -s -o /dev/null -w "API: %{http_code}\n" http://localhost:3000/api/health || echo "API: FAIL"
	@curl -s -o /dev/null -w "WS: %{http_code}\n" http://localhost:3000/socket.io/?EIO=4\&transport=polling || echo "WS: FAIL"

# ── Database ─────────────────────────────────────────────────────────
backup:
	docker exec zapai-postgres pg_dumpall -U zapai > backups/postgres/manual_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup saved to backups/postgres/"

sessions-backup:
	docker run --rm -v zapai-production_zapai_sessions:/data -v $(PWD)/backups:/backup alpine \
		tar czf /backup/sessions-$(shell date +%Y%m%d-%H%M%S).tar.gz -C /data .
	@echo "Sessions backup saved to backups/"

psql:
	docker exec -it zapai-postgres psql -U zapai -d zapai_crm

shell-backend:
	docker exec -it zapai-backend sh

# ── Frontend ─────────────────────────────────────────────────────────
build-frontend:
	cd frontend-official && NODE_ENV=development npm ci --legacy-peer-deps && npx vite build

lint-frontend:
	cd frontend-official && npx tsc --noEmit

# ── Backend Lint ─────────────────────────────────────────────────────
lint-backend:
	node --check backend/server.js
	@echo "Backend syntax OK"
