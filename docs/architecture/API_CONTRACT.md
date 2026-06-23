# ZAPFLOW AI — API Contract

## Padrão de Respostas

### Sucesso (lista)
```json
{ "ok": true, "data": [], "total": 0 }
```

### Sucesso (objeto)
```json
{ "ok": true, "data": {} }
```

### Erro
```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Mensagem amigável em português"
  }
}
```

### Códigos HTTP
| Código | Uso |
|--------|-----|
| `200` | Sucesso (incluindo empty state) |
| `201` | Criado com sucesso |
| `400` | Dados inválidos / campos faltando |
| `401` | Não autenticado |
| `403` | Sem permissão |
| `404` | Recurso não encontrado |
| `500` | Erro interno (sempre contém `{ ok: false, error: {...} }`) |

> **REGRA**: Banco vazio NUNCA retorna 500. Retorna `{ ok: true, data: [], total: 0 }`.

---

## Sistema

### GET /api/health
Healthcheck — público, sem autenticação.

**Response 200:**
```json
{
  "ok": true,
  "success": true,
  "status": "online",
  "service": "zapflow-api",
  "db": true,
  "uptime": "2h 30m",
  "uptimeSeconds": 9000,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "system": {
      "sessions": { "total": 1, "connected": 1 },
      "websocket": { "status": "online", "connections": 3 },
      "database": { "status": "online", "error": null }
    }
  }
}
```

### GET /api/system/info
Informações do servidor.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "hostname": "vps-prod-01",
    "platform": "linux 5.15.0",
    "arch": "x64",
    "uptime": 9000,
    "uptimeFormatted": "2h 30m",
    "version": "1.0.0",
    "environment": "production",
    "nodeVersion": "v20.11.0",
    "pid": 1234
  }
}
```

### GET /api/system/resources
Uso de recursos do servidor.

**Response 200:**
```json
{
  "ok": true,
  "data": {
    "cpu": { "percent": 15, "loadAvg": [0.5, 0.3, 0.2], "cores": 4 },
    "memory": { "total": 8589934592, "used": 2147483648, "free": 6442450944, "usedPercent": 25, "totalMb": 8192, "usedMb": 2048, "freeMb": 6144 },
    "disk": { "total": 107374182400, "used": 21474836480, "free": 85899345920, "usedPercent": 20 },
    "process": { "heapUsedMb": 180, "heapTotalMb": 256, "rssMb": 320 }
  }
}
```

### GET /api/system/nodes
Lista de nodes do cluster.

**Response 200 (sem nodes):**
```json
{ "ok": true, "data": [], "total": 0 }
```

### POST /api/system/refresh
Sinaliza refresh de sistema.

**Response 200:**
```json
{ "ok": true, "data": { "refreshed": true, "timestamp": "..." } }
```

### GET /api/version
Versão do sistema.

**Response 200:**
```json
{ "version": "1.0.0", "env": "production", "uptime": "2h 30m", "uptimeSeconds": 9000 }
```

---

## Autenticação

### POST /api/auth/login
Login com usuário e senha.

**Body:**
```json
{ "username": "zapadmin", "password": "SUA_SENHA" }
```

**Response 200:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "user": {
    "username": "zapadmin",
    "role": "master_admin",
    "tenantId": "default"
  }
}
```

### POST /api/auth/refresh
Renova token JWT.

**Headers:** `Authorization: Bearer <token>`

### POST /api/auth/logout
Invalida sessão.

---

## Contatos

### GET /api/contacts
Lista contatos.

**Query params:**
- `?region=` — Filtra por região
- `?state=` — Filtra por estado (SP, RJ, etc.)
- `?ddd=` — Filtra por DDD
- `?search=` — Busca por nome ou telefone
- `?limit=500` — Limite de resultados
- `?companyId=default`

**Response 200:**
```json
{ "ok": true, "data": [{ "name": "João", "phone": "5511999999999", "state": "SP", "ddd": "11" }], "total": 1 }
```

### POST /api/contacts
**Body:** `{ "name": "...", "phone": "55119...", "email": "...", "region": "Sudeste", "state": "SP", "ddd": "11" }`

### PATCH /api/contacts/:id
**Body:** Campos para atualizar (parcial).

### DELETE /api/contacts/:id

### POST /api/contacts/import
**Body:** `{ "contacts": [{...}, {...}] }`

### GET /api/contacts/export
Download JSON com todos os contatos.

---

## Campanhas

> **⚠️ PENDÊNCIA**: A tabela `campaigns` no PostgreSQL ainda não foi criada via migration.
> Os endpoints retornam empty state seguro até a migration ser aplicada.

### GET /api/campaigns
**Query params:** `?limit=100&offset=0&status=draft`

**Response 200 (banco vazio ou tabela ausente):**
```json
{ "ok": true, "data": [], "total": 0 }
```

### POST /api/campaigns
**Body:** `{ "name": "...", "message": "...", "targetAudience": {...}, "scheduledAt": "ISO_DATE" }`

### PATCH /api/campaigns/:id
### DELETE /api/campaigns/:id

### POST /api/campaigns/:id/launch
**Response 200:** `{ "ok": true, "data": { "id": "...", "status": "running", "launchedAt": "..." } }`

### POST /api/campaigns/:id/pause
**Response 200:** `{ "ok": true, "data": { "id": "...", "status": "paused", "pausedAt": "..." } }`

---

## WhatsApp / Sessões

### GET /api/session-status
Status da sessão principal (sem auth).

**Response 200:**
```json
{
  "connected": true,
  "phone": "5511999999999",
  "sessionId": "main",
  "status": "CONNECTED",
  "timestamp": 1700000000000
}
```

Possíveis status: `CONNECTED`, `QR`, `CONNECTING`, `DISCONNECTED`

### GET /api/whatsapp/sessions
Lista todas as sessões WhatsApp.

**Response 200:**
```json
{ "ok": true, "data": [{ "sessionId": "main", "status": "connected", "phone": "5511..." }], "total": 1 }
```

### POST /api/whatsapp/sessions
Cria nova sessão.

### POST /api/whatsapp/sessions/:id/reconnect
Reconecta sessão.

### POST /api/whatsapp/sessions/:id/disconnect
Desconecta sessão.

### DELETE /api/whatsapp/sessions/:id
Remove sessão.

### GET /api/whatsapp/sessions/:id/qr
Retorna QR code para escanear.

---

## Admin / SaaS

> Requer role `master_admin`.

### GET /api/admin/users
**Response 200:**
```json
{ "ok": true, "data": [{ "id": 1, "username": "zapadmin", "role": "master_admin" }], "total": 1 }
```

### POST /api/admin/users
**Body:** `{ "username": "...", "password": "...", "email": "...", "role": "user" }`

### PATCH /api/admin/users/:id
### DELETE /api/admin/users/:id
### POST /api/admin/users/:id/invite
### PATCH /api/admin/users/:id/role — **Body:** `{ "role": "master_admin" }`

---

## Métricas

### GET /api/metrics
**Response 200:**
```json
{
  "ok": true,
  "success": true,
  "data": {
    "messagesToday": 0,
    "activeChats": 0,
    "aiResponses": 0,
    "newLeads": 0,
    "uptime": { "seconds": 9000, "formatted": "2h 30m" },
    "memory": { "used": 180, "total": 256, "percentage": 70 }
  }
}
```

### GET /api/analytics/overview
Visão geral analítica.

---

## Logs

### GET /api/logs
**Query params:** `?limit=100&offset=0&level=error&source=backend`

**Response 200:**
```json
{ "ok": true, "data": [{ "id": 1, "level": "info", "message": "Server started", "timestamp": "..." }], "total": 0, "limit": 100, "offset": 0 }
```

### POST /api/logs/export
Download JSON dos logs.

### DELETE /api/logs
Limpa buffer de logs. Requer `master_admin`.

---

## Códigos de Erro Padronizados

| Código | Significado |
|--------|-------------|
| `MISSING_FIELDS` | Campos obrigatórios faltando |
| `INVALID_ID` | ID inválido |
| `NOT_FOUND` | Recurso não encontrado |
| `FORBIDDEN` | Sem permissão |
| `DB_UNAVAILABLE` | Banco de dados indisponível |
| `INTERNAL_ERROR` | Erro interno do servidor |
| `EMPTY_IMPORT` | Import sem dados |
| `MISSING_PHONE` | Telefone obrigatório faltando |
| `MISSING_ROLE` | Role obrigatório faltando |

---

## Pendências Reais de Backend

| Endpoint | Status | Pendência |
|----------|--------|-----------|
| `GET /api/campaigns` | ⚠️ Parcial | Migration da tabela `campaigns` pendente |
| `POST /api/contacts/import` | ⚠️ Parcial | Import em massa — retorna placeholder |
| `POST /api/admin/users/:id/invite` | ⚠️ Parcial | Email de convite — retorna placeholder |
| `GET /api/analytics/funnel` | ❌ Ausente | Não implementado |
| `GET /api/analytics/messages` | ❌ Ausente | Não implementado |
| `GET /api/analytics/leads` | ❌ Ausente | Não implementado |
