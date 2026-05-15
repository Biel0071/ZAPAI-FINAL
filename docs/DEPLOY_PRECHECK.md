# DEPLOY PRECHECK

## Runtime targets
- Frontend build artifact: `frontend-official/dist`
- Backend runtime: `backend/server.js`
- Backend process port: `4025`
- Public frontend in VPS: typically behind Nginx on `80/443`

## Variáveis obrigatórias
### Backend
- `NODE_ENV=production`
- `PORT=4025`
- `DATABASE_URL` or equivalent DB host/user/name/password set
- `JWT_SECRET`
- `AUTH_JWT_SECRET`
- `AUTH_DEFAULT_USERNAME`
- `AUTH_DEFAULT_PASSWORD`
- `AUTH_DEFAULT_TENANT_ID`
- `DEFAULT_COMPANY_ID`
- `FRONTEND_URL`
- `CORS_ALLOWED_ORIGINS`
- `DB_RUN_MIGRATIONS_ON_BOOT=true` (if using boot-time migrations)
- `CRASH_EXIT_ON_UNHANDLED=true`

### Optional but important
- `REDIS_URL`
- `MASTER_PANEL_TOKEN`
- `NODE_REGISTRATION_TOKEN`
- `OPENAI_API_KEY`
- `LOG_LEVEL`
- email/password recovery vars if used

## Portas
### Local / internal
- Backend: `4025`
- PostgreSQL: `5432`
- Redis: `6379`

### Public
- Nginx: `80` / `443`
- If using compose production in this repo, public frontend mapping is tied to Nginx/container config, not direct backend exposure.

## PM2
- Official ecosystem file: `backend/ecosystem.config.js`
- Process name: `zapflow-api`

Checklist:
- [ ] PM2 installed on VPS
- [ ] `pm2 start backend/ecosystem.config.js --env production` works
- [ ] `pm2 logs zapflow-api` shows healthy startup
- [ ] PM2 save/startup configured if needed

## Nginx
Checklist:
- [ ] `deploy/nginx.conf` reviewed with real domain/origin
- [ ] frontend serves `frontend-official/dist`
- [ ] `/api` proxy points to backend on `4025`
- [ ] `/socket.io` proxy supports websocket upgrade headers
- [ ] `nginx -t` passes
- [ ] reload works without syntax errors

## WebSocket
Checklist:
- [ ] `/socket.io` proxied correctly in Nginx
- [ ] backend socket auth works with backend JWT
- [ ] session persists after login in staging
- [ ] reconnect behavior tested after backend restart

## SSL
Checklist:
- [ ] DNS/domain points to VPS
- [ ] `FRONTEND_URL` uses final HTTPS origin
- [ ] Certbot/SSL certificate issued
- [ ] HTTPS frontend loads without mixed content
- [ ] websocket works over secure origin if applicable

## PostgreSQL
Checklist:
- [ ] database exists
- [ ] app role exists
- [ ] role owns or can fully use schema/tables/sequences
- [ ] `DATABASE_URL` points to the correct host for the runtime mode
- [ ] if backend runs on host: DB host should usually be `localhost`
- [ ] if backend runs inside compose: DB host can be `postgres`
- [ ] migrations run successfully
- [ ] health endpoint reports `db: true`

## VPS checklist
- [ ] backend env file filled with real production values
- [ ] frontend env/build values aligned with public origin
- [ ] no local/dev `.env` committed
- [ ] `CORS_ALLOWED_ORIGINS` only includes real frontend origins
- [ ] no stale hardcoded VPS IPs/origins left in backend allowlists
- [ ] frontend build passes before upload/deploy
- [ ] backend health passes after deploy
- [ ] route smoke or equivalent sanity check passes after deploy
- [ ] UI login works in staging
- [ ] QR/session flow tested in staging
- [ ] realtime message updates tested in staging

## Final go/no-go
Go only if:
- [ ] frontend build passes
- [ ] backend health passes
- [ ] DB online in health output
- [ ] login works
- [ ] key pages work (`/dashboard`, `/connections`, `/inbox`, `/contacts`, `/analytics`, `/settings`)
- [ ] no sensitive `.env` file is included in commit/push
