---
name: database
description: Use ao mexer em schema, queries ou migrations do ZAPFLOW (PostgreSQL via pg) — índices, PK/FK, views, functions, triggers, EXPLAIN e performance. Aciona em nova migration, query nova, ou investigação de lentidão de banco.
---

# Database Skill

Banco: **PostgreSQL via `pg`** (NÃO Supabase). Pool em `backend/config/database.js`. 31 migrations em `backend/migrations/` (runner sequencial `scripts/run-migrations.js`, idempotentes com `IF NOT EXISTS`).

## Verificar

- **Índices** — migrations 011 (production_indexes), 028 (inbox), 031 (turbo) são de performance. Toda query nova em caminho quente precisa de índice adequado.
- **PK / FK** — respeitar chaves; `conversations.lead_id → leads.id`, `messages.conversation_id → conversations.id (ON DELETE CASCADE)`.
- **Functions** — `get_phone_aliases(text)` (migration 025) para normalização de telefone.
- **Migrations novas** — próximo número sequencial, idempotente, testável. Nunca editar migration já aplicada; criar nova.
- **EXPLAIN** — usar em query lenta (log de slow query >500ms já existe). 
- **Multi-tenant** — filtrar por `company_id` sempre.

## Tabelas-chave

`leads`, `conversations` (temperatura/funil/tags/remote_jid/agent_name), `messages` (from_me/phone/conversation_id/created_at), `campaigns` (selected_contacts JSONB), `system_settings` (config IA + agentes), `provider_keys` (chaves IA cripto), `agent_memory_nodes/edges` (grafo de memória, migration 030), `ai_memory_long/short` (010), `whatsapp_lid_mappings` (021).

## Regra

Antes de rodar migration em produção: backup (`scripts/backup.sh`) e testar. O deploy roda migrations automaticamente (`DB_RUN_MIGRATIONS_ON_BOOT` ou passo do auto-deploy).
