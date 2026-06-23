# ZAPAI-FINAL — Real Runtime Map
Generated: 2026-05-13 12:15

## BACKEND RUNTIME (backend/)
- server.js — entrypoint (1760 lines)
- ecosystem.config.js — PM2 OFFICIAL (zapflow-api, port 4025)
- docker-entrypoint.sh — Docker boot sequence
- autoBootstrap.js — auto .env generator

## BACKEND ROUTES (backend/routes/) — ALL ACTIVE
- auth.js → /auth + /api/auth (login, register, verify)
- sessions.js → /api/sessions (QR, status, connect)
- conversations.js → /api/conversations (inbox list)
- messages.js → /api/messages (send, receive)
- system.js → /api/system (health, error-log)
- metrics.js → /api/metrics
- contacts.js → /api/contacts
- leads.js → /api/leads
- analytics.js → /api/analytics
- ai.js → /api/ai
- aiConfig.js → /api/ai-config
- aiIntelligence.js → /api/ai-intelligence
- campaignDispatch.js → /api/campaigns
- adminMaster.js → /api/admin (master only)
- nodeMaster.js → /api/master (node registration)
- cluster.js → /api/cluster
- automation.js, quickReplies.js, integrations.js, media.js

## BACKEND SCRIPTS (backend/scripts/) — ALL ACTIVE
- healthcheck.js — OFFICIAL (13 checks)
- recovery.sh — OFFICIAL (auto-recovery)
- run-migrations.js — official migration runner
- seed-admin.js — admin user seed
- init-database.js — schema init
- audit-production-data.js — data audit
- db-performance-maintenance.js — weekly maintenance
- protect-whatsapp-sessions.js — session protection

## BACKEND SERVICES (backend/services/) — ALL ACTIVE
- sessionManager (+ sessionManager.legacy.js) — WhatsApp sessions
- whatsappService / whatsapp/* — Baileys runtime
- aiMemoryEngine.js — AI memory persistence
- aiIntelligenceService.js — AI processing
- messageAckPipeline.js — ACK tracking
- campaignDispatchEngine.js — Campaign dispatch
- outboundQueueService.js — Message queue
- sessionRegistry.js — Dual-persistence registry
- runtimeEngine.js — Heartbeat + workers
- websocketGateway.js — WS event routing
- workerSupervisor.js — Background workers
- backpressureController.js — Flow control
- systemManager.js — Boot orchestrator
- migrationRunner.js — DB migration engine
- sessionWatchdog.js — Session audit

## FRONTEND RUNTIME (frontend-official/src/) — ALL ACTIVE
Pages (18 total, all mapped in App.tsx):
- Dashboard.tsx, Inbox.tsx, Connections.tsx, Contacts.tsx
- AI.tsx, Analytics.tsx, Campaigns.tsx, Settings.tsx
- Flows.tsx, Login.tsx, Memory.tsx, Diagnostics.tsx
- MasterNodes.tsx, NodeDetails.tsx, MasterDeployments.tsx
- MasterLogs.tsx, MasterAdmins.tsx

Providers: RuntimeProvider.tsx (WebSocket + Zustand)
Hooks: useAdminAuth, useUserRole, useApiRuntimeStatus,
       useMasterSnapshot (60s), useFrontendHealthWatcher
Services: apiService, socketService, errorLogService (circuit breaker)

## DEPLOY (deploy/) — OFFICIAL ONLY
- auto-deploy.sh — OFFICIAL deploy (git pull → build → pm2 → nginx → health)
- vps-setup.sh — OFFICIAL VPS setup (once, as root)
- nginx.conf — OFFICIAL nginx (WS 3600s, rate limits, gzip)

## INFRA
- docker-compose.production.yml — ONLY docker compose file

## ARCHIVED (archive/legacy/) — DO NOT USE IN PRODUCTION
- 22 legacy deploy scripts from deploy/
- 4 legacy scripts from scripts/
- 6 legacy root scripts
- 2 legacy nginx configs
- Frontend legado (Supabase-based, replaced by frontend-official/)
