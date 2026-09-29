# Backend Audit — ZapAI CRM

**Branch**: `STABLE_BACKEND`
**Date**: 2026-04-20
**Scope**: Phase 1+2+3 stabilization pass (logs, healthcheck, rollback, Baileys, API hardening). No layout / structural / architectural changes.

---

## 1. Route map

All paths listed are the final post-mount URLs (after `registerRoutes` in `routes/index.js`). Paths in **bold** are new / changed by this pass.

### Public (no JWT required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | **New JSON healthcheck** (server/database/api/whatsapp/uptime) |
| GET | `/api/health` | Same payload as `/health` (aliased) |
| GET | `/api` | Service ping |
| GET | `/api/test` | Liveness probe |
| GET | `/diagnostics` | Dev-only (404 in prod) |
| GET | `/api/diagnostics` | Dev-only (404 in prod) |
| GET | **`/status-whatsapp`** | **New public Baileys status (incl. `sessions[]`)** |
| GET | `/session-status` | Default-session snapshot |
| GET | `/api/session-status` | Alias for `/session-status` |
| POST | `/auth/login` | Token issuance (rate-limited by `authRateLimiter`) |
| * | `/auth/*` | Prefix match, rate-limited |

### System (`/system`, `/api/system`)

| Method | Path | Controller |
|---|---|---|
| POST | `/system/activate` | `systemController.activate` |
| GET | `/system/activation-logs` | `getActivationLogs` |
| GET | `/system/runtime/status` | `getRuntimeStatus` |
| GET | `/system/runtime/debug` | dev-only |
| POST | `/system/runtime/restart-ngrok` | `restartNgrok` |
| GET | `/system/runtime/logs` | `getRuntimeLogs` |
| DELETE | `/system/runtime/logs` | `clearRuntimeLogs` |
| GET | `/system/ai-diagnostics` | dev-only |
| GET | `/system/error-log` | `errorLog` |
| POST | `/system/start` | `start` |
| POST | `/system/stop` | `stop` |
| GET | `/system/status` | `status` |

### Messages / media / conversations (JWT required)

| Method | Path |
|---|---|
| GET | `/messages`, `/api/messages` |
| GET | `/chats`, `/chats/:chatId/messages` |
| GET | `/messages/by-phone/:phone`, `/messages/:chatId` |
| GET | `/conversations/:conversationId/messages` |
| POST | `/messages`, `/send-message`, `/api/send-message` (rate-limited) |
| POST | `/send-media`, `/api/send-media` (rate-limited) |
| POST | `/receive-message` (dev-only) |
| POST/GET | `/outbound-queue/enqueue`, `/pending`, `/dlq`, `/dlq/:id/reprocess` |
| * | `/conversations/*` (CRUD, drafts, insights, handoff, billing) |
| POST | `/media/upload`; GET `/media/:mediaId/(metadata|stream)` |

### Sessions (`/session/*`, `/sessions/*`) — JWT required

Full CRUD: `start`, `create`, `logout`, `restart`, `disconnect-system`, `connect-system`, `list`, `status`, `qr`, `reconnect`, `remove`. Both singular and plural forms registered for compatibility.

### AI / contacts / leads / analytics / automation / quickReplies / integrations

Mounted under both `/` and `/api` (where applicable). `/api/integrations/*` rate-limited. `/api/contacts` currently read-only.

---

## 2. Middleware chain (order matters)

```
cors + preflight
request-timeout guard       (NEW — 30s default, upload paths exempt)
createRequestLogger         (writes logs/requests.log)
requestContextMiddleware    (assigns req.requestId)
tenantContextMiddleware
apiEnvelopeMiddleware
corsBlockMiddleware
static (/media /upload /uploads)
devOnlyRoute guards (/diagnostics, /receive-message, ...)
---
/system router                 (no auth)
authRateLimiter on /auth, /api/auth  (NEW)
authRouter (/, /api)           (no auth)
requireJwtAuth                 (whitelist expanded this pass)
writeHeavyRateLimiter on writes
/messages, /conversations, /sessions, ...  routers
/status-whatsapp               (public, below JWT wall via whitelist)
404 handler
global error handler           (NEW — 4xx vs 5xx split + errorLog)
```

---

## 3. Integrations

- **Baileys / WhatsApp**: `services/whatsapp/*` (Phase 2c refactor). Drivers in `connection/stableSession.js`. Auth state lives in `backend/crm/sessions/<sessionName>/` (git-ignored).
- **PostgreSQL**: `config/database.js` + versioned migrations in `migrations/`. Boot gated by `config/runtimeEnv.js`.
- **Socket.IO**: registered on the same HTTP server, tenant-scoped rooms via `services/realtime/tenantRooms.js`.
- **AI providers**: `services/ai.service.js`, `services/aiIntelligenceService.js`, `services/aiEngineeringAnalyzer.js`.
- **Outbound queue**: JSON-file persistence, retry with exponential backoff, DLQ (`data/outbound_queue.json`).
- **Enterprise queues** (`services/enterprise/queue-service.js`): cache/media/message/realtime/ai helpers.

---

## 4. Silent failure points identified

| Location | Symptom | Status |
|---|---|---|
| `stableSession.js:499` — QR generated without lifecycle timer | QR could hang forever, memory leak on abandoned pairings | ✅ **Fixed**: `WHATSAPP_QR_TIMEOUT_MS` (default 120s), auth folder preserved |
| `stableSession.js:735` — reconnect with fixed 3s delay | No backoff; 5 tries in ~15s then session frozen as `disconnected` | ✅ **Fixed**: `computeReconnectDelay` (3s→6s→12s→24s→48s capped at 60s) |
| `stableSession.js` reconnect catch | Raw `console.error` — not piped to errors.log | ✅ **Fixed**: goes through `logSessionEvent` → `whatsapp.log` |
| `requestLogger.js` | `console.log` only; nothing persisted | ✅ **Fixed**: writes to `logs/requests.log` |
| server global error handler | All errors → 500 + noisy `console.error` | ✅ **Fixed**: 400/413 for body-parser, 5xx → `errors.log` |
| JWT middleware | Boot-time requests from frontend returned 401 (tight whitelist) | ✅ **Fixed**: whitelist expanded + `publicPrefixes` added |
| `server.js` `/health` | Returned plain `"OK"` text | ✅ **Fixed**: structured JSON (`server/database/api/whatsapp/uptime`) |
| Crash handlers | Errors only went to console, never persisted | ✅ **Fixed**: `errorLog()` on `uncaughtException` + `unhandledRejection` |

---

## 5. Bottlenecks observed (not fixed here — noted for Phase 4)

- `useExecutiveOverview` (frontend) fires 9 parallel fetches on boot. Consider a consolidated `/api/overview` endpoint on backend.
- `outboundQueueService` persists full queue to a single JSON file on each update — fine for hundreds of items, will need a proper store (Redis / DB) for thousands.
- `sessions/` folder can accumulate abandoned session directories (QA scripts created 30+). Needs a sweeper or cleanup job.
- Heartbeat `setInterval(10s)` in `server.js` writes to console even in prod. Already gated in Phase 2c but verify `DEBUG_HEARTBEAT` behavior.

---

## 6. Rate-limiting / security status

| Control | Before | After |
|---|---|---|
| Login brute-force protection | ❌ | ✅ `authRateLimiter` 20/min default |
| Write-heavy ops | ✅ already in place | unchanged (120/min) |
| Request timeout | ❌ none (default Node 2min) | ✅ 30s, exempts uploads |
| Payload limits | ✅ (1MB default, 25MB media) | unchanged |
| Token masking in logs | ❌ | ✅ Bearer/JWT/sensitive keys masked by `redactFormat` |
| Crash → supervisor | partial | ✅ preserved, now also writes `errors.log` |
| CORS | ✅ allow-list in prod | unchanged |

---

## 7. Logs infrastructure

New high-level streams under `logs/`:

| File | Written via | Content |
|---|---|---|
| `backend.log` | `backendLog()` | server lifecycle, misc |
| `errors.log` | `errorLog()` | `uncaughtException`, `unhandledRejection`, 5xx |
| `requests.log` | `requestLog()` | every HTTP request with latency + status + requestId |
| `whatsapp.log` | `whatsappLog()` | every Baileys session event (JSON) |

Each file:
- JSON Lines format
- Rotated at 10 MB, keeps 5 previous files (`tailable: true`)
- Automatic secret masking (`Bearer xxx`, JWT tokens, headers like `authorization`, `cookie`, `x-api-key`)

Legacy `getLogger('system'|'database'|'messages'|...)` still works.

Env overrides: `LOG_LEVEL` (default `info`), `LOG_CONSOLE_QUIET=true` to silence stdout.

---

## 8. Baileys / WhatsApp health

- ✅ Auth state persistent in `sessions/<name>/` via `useMultiFileAuthState`.
- ✅ Auth folder preserved on restart (`disposeSession` does NOT delete unless `deleteFolder:true`).
- ✅ Auth folder cleared only on explicit `DisconnectReason.loggedOut`.
- ✅ QR timeout (2 min default) — closes socket but keeps auth.
- ✅ Reconnect with exponential backoff (3s→60s max), 5 attempts default.
- ✅ Structured logs to `logs/whatsapp.log`.
- ✅ Multiple sessions via `activeSessions[sessionName]` map — enumerated in `/status-whatsapp` response.
- ✅ `GET /status-whatsapp` public healthcheck.

Env knobs:
- `WHATSAPP_QR_TIMEOUT_MS` (default 120000)
- `WHATSAPP_RECONNECT_BACKOFF_BASE_MS` (default 3000)
- `WHATSAPP_RECONNECT_BACKOFF_MAX_MS` (default 60000)
- `WHATSAPP_MAX_RECONNECT_REQUESTS` (default 5)
- `WHATSAPP_RESTORE_ACTIVE_ONLY` (default true)

---

## 9. Outbound message queue

Implemented in `services/outboundQueueService.js`:

- States: `QUEUED → PROCESSING → SENT | FAILED → DEAD_LETTER`
- Persistence: `data/outbound_queue.json` (atomic via `persistLock`)
- Retry: exponential backoff `baseDelayMs * 2^attempt` + jitter, capped at `maxDelayMs`
- Max attempts: 3 (configurable via `OUTBOUND_QUEUE_MAX_ATTEMPTS`)
- Poll loop: 1s default
- DLQ endpoints: `/outbound-queue/pending`, `/dlq`, `/dlq/:id/reprocess`

Status: **robust and stable**. No changes needed in this pass.

---

## 10. Rollback

| Branch | Commit | State |
|---|---|---|
| `stabilize/p0-p1-2026-04-06` | `526a135` | pre-stabilization (P1.2 migrations) |
| `STABLE` | `cd0e003` | Baileys fixes only (Fase 2c pós refactor) |
| `STABLE_BACKEND` | (in progress) | + logs/healthcheck/hardening/multi-session |

To roll back:
```
git checkout STABLE
```

---

## 11. Next (Phase 4, pending approval)

- Memory/CPU snapshot endpoint (`/status-whatsapp?verbose=1` or new `/metrics/system`)
- Slow-query logger in `config/database.js` (>500ms)
- Consolidated `STABILIZATION_REPORT.md` with before/after numbers
- Optional sweeper for abandoned `sessions/<qa_...>/` dirs
