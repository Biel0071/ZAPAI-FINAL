.PHONY: up down restart rebuild logs ps health dev backup sessions-backup logs-backend shell-backend psql lint check validate deploy

# ── Development ──────────────────────────────────────────────────────
dev:
	docker compose -f docker-compose.yml up -d

# ── Production ──────────────────────────────────────────────────────
up:
	cd frontend && npm run build
	docker compose -f docker-compose.production.yml --env-file .env.production up -d

down:
	docker compose -f docker-compose.production.yml down

restart:
	docker compose -f docker-compose.production.yml restart

rebuild:
	cd frontend && npm run build
	docker compose -f docker-compose.production.yml --env-file .env.production up -d --build

logs:
	docker compose -f docker-compose.production.yml logs -f --tail=100

ps:
	docker compose -f docker-compose.production.yml ps

health:
	@echo "=== Health Checks ==="
	@curl -s http://localhost/health && echo " - Nginx OK"
	@docker exec zapai-backend wget -q -T 3 -O /dev/null http://localhost:4025/health && echo "Backend OK" || echo "Backend FAIL"

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

# ── Production validation ────────────────────────────────────────────
validate:
	@echo "=== Validating Production Configuration ==="
	@docker compose -f docker-compose.production.yml --env-file .env.production config > /dev/null && echo "[OK] docker-compose syntax"
	@grep -q "4025:4025" docker-compose.production.yml && echo "[FAIL] Backend port 4025 exposed to host" || echo "[OK] Backend port 4025 NOT exposed"
	@grep -q "5432" docker-compose.production.yml && echo "[FAIL] Postgres port exposed" || echo "[OK] Postgres port NOT exposed"
	@grep -q "6379" docker-compose.production.yml && echo "[FAIL] Redis port exposed" || echo "[OK] Redis port NOT exposed"
	@grep -qE "209\.50\.229\.68|127\.0\.0\.1:4025" docker-compose.production.yml && echo "[FAIL] Hardcoded IP found" || echo "[OK] No hardcoded IP"
	@grep -qE "209\.50\.229\.68" .env.production 2>/dev/null && echo "[WARN] Hardcoded IP in .env.production" || echo "[OK] .env.production clean"
	@echo "=== Done ==="
