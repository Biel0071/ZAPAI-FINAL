# AI Agent Architecture Audit (`ZAI Enterprise`)

**Date:** 2026-11-18  
**Scope:** Canonical configuration, personalities, objectives, runtime LLM pipeline, versioning, cache invalidation, and Sandbox vs. production parity.

---

## 1. Canonical Tables & Source of Truth

| Storage | Migration / Location | Authority & Usage | Identified Gaps |
|---|---|---|---|
| `system_settings` (`ai_agents_config_v2:<companyId>`) | `backend/migrations/001_initial_schema.js` / `aiAgentService.js:9-19,232-248,331-334` | Canonical runtime array read by `listAgents()`, `automationEngine.processMessage()`, `processAI()`, and `testAIConnection()`. | Monolithic JSON array without strongly typed per-column constraints or per-agent `providerId`/`modelId`/`routingMode`. |
| `digital_attendants` | `backend/migrations/053_create_attendants_multi_tenant_tables.js:9-33`, `057:7-12` | Relational write-through mirror synced via `attendantRepository.syncAgent()` (`attendantRepository.js:146-172`). | Missing columns: `objective`, `tone`, `response_style`, `max_tokens`, `routing_mode`, `system_prompt_version`, `knowledge_configuration`, `enabled_features`, `whatsapp_connection_id`, `updated_by`. |
| `store_attendant_assignments` & `connection_attendant_assignments` | `053:44-89` | Relational bindings with `uq_store_one_principal` and `uq_connection_one_principal`. | Properly isolated per `company_id`. |
| `session_ai_profiles` & `ai_stores` | `035:20-30`, `037:30-36`, `038:6-12` | Canonical store commercial knowledge per WhatsApp connection (`aiAgentService.getStoreKnowledge`). | `ai_stores.attendant_*` metadata is not synchronized back into runtime `processAI()`. |
| `ai_agent_versions` | `035:37-42` | Append-only version snapshot table per `(company_id, session_id, agent_key)`. | Missing `version_number`, `change_scope`, `created_by`; unassigned agents (`sessionIds = []`) generated `0` version rows. |
| `ai_session_agent_styles` | `035:43-47` | Runtime `{ tone, responseStyle }` overrides merged by `withSessionStyle()`. | Can silently override manual `tone` / `responseStyle` settings without visible indication. |

---

## 2. End-to-End Configuration Disposition (`UI -> DB -> Runtime`)

| Field | UI (`AttendantsPage.tsx`) | Saved (`aiAgentService.normalizeAgent`) | Reaches LLM Call (`ai.service.js:processAI`)? | Root Cause / Distortion |
|---|---|---|---|---|
| `personality` / `prompt` | Yes | Yes | Yes (`ai.service.js:418-420`) | Combined into prompt section `[IDENTIDADE DO ATENDENTE E CONHECIMENTO ENSINADO]`. |
| `personalityPreset` | Partial (`NewAgentWizardModal` only) | Stripped/partial | **No** | Canonical 4 personalities (`Executivo e Direto`, `Analítico e Orientado a Dados`, `Consultivo e Amigável`, `Operacional e Diagnóstico`) did not exist. |
| `objective` | Yes (`fechamento`, `suporte`, `qualificacao`, `agendamento`) | Yes (`aiAgentService.js:131`) | **Partial (ID string only)** (`417`) | Interpolated raw as `- Objetivo: fechamento`; behavioral strategy is not compiled. |
| `tone` | Yes (`AgentTab.tsx:103-108`) | Yes (`aiAgentService.js:130`) | **DROPPED** | `compileSystemPrompt()` (`ai.service.js:345-627`) never reads `agent.tone`. |
| `response_style` | Yes (`short_natural`, `balanced`, `detailed`) | Yes (`129`) | **OVERRIDDEN & CAPPED** (`168-363`) | Both `balanced` and `detailed` fell into `else` ("35 a 50 palavras"), and `enforceResponseWordLimit()` hard-capped all replies to 50 words. |
| `temperature` | Yes | Yes (`132-134`) | **Yes in `processAI`; CLAMPED in Sandbox** | `testAIConnection()` clamped `Math.min(temp, 0.4)` on VPS/Ollama (`998-1000`). |
| `max_tokens` | Missing | Missing | **Hardcoded (`600` / `200` test)** | Not configurable per agent nor validated against model capability. |
| `providerId` / `modelId` | Yes (`AttendantsPage.tsx:1059-1060`) | **DROPPED ON SAVE** (`49-183`) | **IGNORED** (`1181-1229`) | `normalizeAgent()` stripped `provider`/`model`; `processAI()` read only `provider_keys ORDER BY id ASC`. |
| `routing_mode` | Missing | Missing | **No** | No Model Router integration (`AUTO`, `FAST`, `QUALITY`, `LOCAL`, `SPECIFIC`). |
| `knowledge_configuration` & `enabled_features` | Missing | Missing | **Contaminated by hardcode** | `compileSystemPrompt()` (`399-410, 485-492`) injected `"Arte Concreto"`, `"Camila"`, and hardcoded material prices into every tenant. |

---

## 3. Caching, Versioning, Rollback & Sandbox Parity Gaps

1. **Stale Response Cache on Save:** `aiAgentService.mutateAgents()` clears `hydratedTenants`/`agentsByTenant`, **but never calls `aiService.clearResponseCache()` or `aiLocalBrainService` invalidation**, causing `temperature` or provider edits to serve stale cached replies for up to 60s.
2. **Rollback Sync Gap & Missing UI:** `restoreSessionStyle()` (`aiAgentService.js:615-648`) requires a `sessionId`, omits `attendantRepository.syncAgent()`, and has **no UI** in `AttendantsPage.tsx`.
3. **Sandbox vs. Production Divergence:** `AttendantsPage.tsx:1339-1357` omits `selectedObjective` and `selectedTone` when calling `POST /api/ai/test`, while `testAIConnection()` runs a stripped prompt (`memorySettings: { enabled: false }`, clamped temp `<= 0.4`, clamped `maxTokens <= 200`), and no multi-personality side-by-side comparison mode exists.

---

## 4. Target Remediation Summary

- Build canonical `agentBehaviorCompiler.js` mapping all **4 personalities** (`executivo_direto`, `analitico_dados`, `consultivo_amigavel`, `operacional_diagnostico`), **4 objectives**, tones, response styles, temperature, `max_tokens`, and model-capability warnings in both `processAI()` and `testAIConnection()`.
- Persist full `AgentConfiguration` in `system_settings` + `digital_attendants`, record `version_number` + `created_by` on every save (even without sessions), invalidate response caches immediately, and expose 1-click rollback + real multi-personality comparison (`POST /api/ai/test/compare`).
- Eliminate all hardcoded company/product/price literals from `ai.service.js`, `conversationMemoryEngine.js`, and `orchestrator.js`.
