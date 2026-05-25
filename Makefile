.PHONY: up down restart rebuild logs ps health dev deploy validate doctor recovery backup rollback local-stop local-clean local-start local-restart

# ── Local single-runtime helpers ─────────────────────────────────────────────
local-stop:
	npm run stop

local-clean:
	npm run clean

local-start:
	npm run start:official

local-restart:
	npm run restart


# ── Quick Reference ──────────────────────────────────────────────────────────
# make deploy     → deploy/auto-deploy.sh   (git pull → build → pm2 → nginx → health)
# make health     → backend/scripts/healthcheck.js (13 system checks)
# make recovery   → backend/scripts/recovery.sh (auto-recover crashed backend)
# make validate   → tsc + build validation
# make doctor     → pm2 status + health JSON
# make rollback   → git reset to previous commit + pm2 restart

# ── Production Docker ────────────────────────────────────────────────────────
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

# ── Deploy (OFFICIAL) ────────────────────────────────────────────────────────
deploy:
	bash deploy/auto-deploy.sh

deploy-skip-build:
	bash deploy/auto-deploy.sh --skip-build

deploy-dry:
	bash deploy/auto-deploy.sh --dry-run

# ── Health & Recovery (OFFICIAL) ─────────────────────────────────────────────
health:
	node backend/scripts/healthcheck.js

health-json:
	node backend/scripts/healthcheck.js --json

recovery:
	bash backend/scripts/recovery.sh

doctor:
	@echo "=== PM2 Status ==="
	@pm2 status 2>/dev/null || echo "PM2 not running"
	@echo "\n=== Health Check ==="
	@node backend/scripts/healthcheck.js --json 2>/dev/null | node -e \
		"const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);console.log('Passed:',j.summary.passed,'Failed:',j.summary.failed,'Warned:',j.summary.warned)" \
		2>/dev/null || curl -s http://localhost:4025/health 2>/dev/null | head -c 200

# ── Validation ───────────────────────────────────────────────────────────────
validate:
	@echo "=== TypeScript ==="
	cd frontend-official && npx tsc --noEmit
	@echo "=== Backend syntax ==="
	node --check backend/server.js
	@echo "=== ALL VALID ==="

build-frontend:
	cd frontend-official && NODE_ENV=development npm ci --legacy-peer-deps && npx vite build

lint-frontend:
	cd frontend-official && npx tsc --noEmit

lint-backend:
	node --check backend/server.js
	@echo "Backend syntax OK"

# ── Rollback ──────────────────────────────────────────────────────────────────
rollback:
	@echo "Rolling back to previous git commit..."
	git log --oneline -5
	@read -p "Enter commit hash to rollback to: " hash; git reset --hard $$hash
	@pm2 restart backend/ecosystem.config.js --env production --update-env 2>/dev/null || true
	@echo "Rollback complete. Run: node backend/scripts/healthcheck.js"

# ── Database ─────────────────────────────────────────────────────────────────
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

migrate:
	cd backend && node scripts/run-migrations.js
