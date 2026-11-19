# AI Provider Registry, Model Router & Credential Vault Audit (`ZAI Enterprise`)

**Date:** 2026-11-18  
**Scope:** `backend/services/ai.service.js`, `aiConfigController.js`, `zaiUsageService.js`, `adminMaster.js`, `provider_keys`, and Master Panel UI (`Settings.tsx`, `AdminHub.tsx`, `AgentTab.tsx`, `AttendantsPage.tsx`).

---

## 1. Integrated Providers & Live Infrastructure Inventory

### Code Paths (`backend/services/ai.service.js`)
- **OpenAI-compatible & Native Providers:** `openai` (`api.openai.com/v1`), `gemini`/`google` (`generativelanguage.googleapis.com/v1beta/openai`), `groq` (`api.groq.com/openai/v1`), `deepseek` (`api.deepseek.com/v1`), `openrouter` (`openrouter.ai/api/v1`), `anthropic`/`claude` (`api.anthropic.com/v1/messages`), `zai`/`ollama`/`vps_engine`/`api_platform` (`process.env.OLLAMA_BASE_URL || process.env.VPS_AI_BASE_URL || http://127.0.0.1:11434/v1`).
- **Audio & Vision:** STT via VPS API Platform (`POST /v1/audio`) with OpenAI/Groq Whisper fallback; TTS via ElevenLabs / `edge-tts-universal`; Vision via `provider_keys` (`openai`, `google`, `gemini`, `openrouter`).
- **Missing Cost Accounting:** `aiLogService.js:256, 308` hardcodes `estimatedCostToday: null`; no per-model token pricing table exists.

### Live VPS Runtime Probe (`209.50.241.22`, verified 2026-11-18)
- **Ollama (`127.0.0.1:11434`) active models:** `granite3.1-moe:3b`, `qwen2.5:3b`, `qwen2.5-coder:3b`, `qwen2.5-coder:1.5b`, `deepseek-r1:1.5b`, `qwen3.5:0.8b`, `qwen2.5:0.5b`, `all-minilm:latest`.
- **Database `provider_keys`:** 1 row (`id=1`, `tenant_id='default'`, `provider='openai'`, `model='gpt-4o-mini'`, `enabled=true`), which fails external billing checks (HTTP 429 quota exhausted).
- **Environment Flags:** `ENCRYPTION_KEY=true`, `VPS_AI_BASE_URL=http://127.0.0.1:11434/v1`, `VPS_AI_API_KEY=true`; no cloud keys (`OPENAI_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN`) set in `.env`.

---

## 2. Critical Bugs & Security Findings

1. **Keyless Accounts Blocked in Production (`PROVEDOR ZAI` Gap):**
   - In `/ai/test`, `testAIConnection()` auto-constructs `vps_engine` without a `provider_keys` row.
   - However, in **production WhatsApp replies**, `getAIIntegrationStatus()` (`ai.service.js:687-743`) returns `aiOn: false` when `provider_keys` has no enabled row for the tenant, causing `processAI()` (`1171-1175`) and `automationEngine.js` (`352-362`) to **abort before reaching `vpsEngineCandidate` (`1216`)**.
2. **Hardcoded Fallback Keys in Source (`ai.service.js`):**
   - Lines `50`, `784`, `1009`, `1218`, `1544`, `2068` embed fallback API key literals (`ap_live_...`, `ap_1999...`) directly in source code instead of reading strictly from `process.env.*`.
3. **Fragmented Encryption & Plaintext Fallback:**
   - AES-256-CBC encryption helper is duplicated across 6 backend files (`aiConfigController.js`, `ai.service.js`, `audioGenerationService.js`, `stableSession.js`, `agentEvolutionService.js`, `aiCompressionService.js`), assumes strings without `:` are plaintext, and throws/returns raw ciphertext inconsistently on error.
4. **No Credential Hierarchy or Audit Trail:**
   - `provider_keys` mixes `UNIQUE(user_id, provider)` with `WHERE tenant_id = $1` reads; no separation exists between **Master**, **Company**, and **Agent** credentials, no rotation/revocation tracking, and no credential audit log.
5. **Quota / Role Gaps (`zaiUsageService.js`):**
   - `isAdminRole()` omits `'master_admin'`, and `consumeUsage()` is only enforced on `/ai/test`, never on production `processAI()`.
6. **No Model Router & Orphaned UI Navigation:**
   - No routing modes (`AUTO`, `FAST`, `QUALITY`, `LOCAL`, `SPECIFIC`) or circuit-breaker health tracking exist.
   - In the frontend, `AdminHub.tsx` is orphaned (redirects to `/settings`), and the live Master Enterprise Panel inside `Settings.tsx` (`isMasterIndex` `8..19`) has a placeholder `api-keys` card (`Settings.tsx:917-925`) with no `PROVEDORES & MODELOS DE IA` management screen.

---

## 3. Target Remediation Summary

- Implement `aiCredentialVault.js` using AES-256-GCM + AAD isolation (`scope:companyId:agentKey:providerId`), zero hardcoded keys, masked frontend DTOs, rotation/revocation, strict precedence (`Agent -> Company -> Master / PROVEDOR ZAI`), and non-secret `ai_credential_audit_log`.
- Implement `aiModelRouter.js` with live Ollama model discovery, real health/circuit-breaker states (`available`, `degraded`, `quota_exceeded`), token cost estimation, automatic `PROVEDOR ZAI` support without personal keys, and modes `AUTO`, `FAST`, `QUALITY`, `LOCAL`, `SPECIFIC`.
- Deliver `MasterAIProviders.tsx` inside the Master Enterprise Panel (`/settings?tab=ai-providers` and `/master/ai-providers`).
