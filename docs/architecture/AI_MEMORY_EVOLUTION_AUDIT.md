# AI Neural Memory, Controlled Evolution & Real Metrics Audit (`ZAI Enterprise`)

**Date:** 2026-11-18  
**Scope:** Memory tables & services (`aiMemoryEngine`, `conversationMemoryEngine`, `agentMemoryGraphService`), Evolution pipelines (`humanAttendanceLearner`, `conversationEvolutionService`, `learningEngine`, `agentEvolutionService`), and UI (`EvolutionTab.tsx`, `AttendantEvolutionHub.tsx`, `Memory.tsx`).

---

## 1. Root Causes of Inconsistent UI Numbers & Confusion

1. **Contradictory Conversation Counters (`31377` vs `611` vs `50`):**
   - `humanAttendanceLearner.js:345-350` counts **messages** (`SELECT COUNT(*) FROM messages WHERE company_id = $1 AND from_me = TRUE AND (sender = 'agent' OR sender IS NULL)` -> `31.377`) and exports it as `totalAnalyzed`, labeled in `EvolutionTab.tsx:881-886` as `"Msgs de Operadores (loja)"` even though it includes bot messages.
   - `aiController.js:1098-1124` counts `conversations` (`611`) and overrides it with `Math.max(dbQualifiedCount, episodeCount, Math.round(totalHumanMessages / 25))` (`1.255`).
   - `ConversationScoresSection.tsx` counts only scored rows in `conversation_evolution_scores` (batch limit `30..50`).
   - `EvolutionTab.tsx:1196, 1530` renders `humanStats.evolutionScore` (`0..100`) above the label **`Registros`**.
2. **Duplicate UI Panels & Fabricated Fallbacks:**
   - `EvolutionTab.tsx` duplicates "Progresso por registros de atendimento", "Pilares da Inteligência Cognitiva", and an empty "Central de Aprendizado" box across sub-tabs `brain` and `timeline`, while rendering `AttendantEvolutionHub` in `hub`.
   - `AttendantEvolutionHub.tsx` falls back to hardcoded constants (`|| 18` memories, `|| 20` XP, `"5% no PIX"`, `"Atendente Especialista"`) when data is absent.
3. **Non-Functional Memory Actions & Unfiltered Date Bar:**
   - `MemoryDetailDrawer` buttons (`Editar`, `Virar Regra`, `Arquivar Memória`) in `EvolutionTab.tsx:1154-1164, 1449-1459` only show `toast(...)` and close the modal—zero database persistence.
   - Date filter (`Geral`, `Hoje`, `7D`, `30D`, `Personalizado`) filters only capped client-side slices (`limit=80`) without re-querying PostgreSQL or scoping KPIs.
4. **Graph Noise Mixing Structural & Semantic Nodes:**
   - Live `agent_memory_nodes` holds `52.458` `conversation` and `45.512` `contact` structural nodes alongside `12.432` `episode`, `110` `topic`, `104` `evolution_insight`, `13` `preference`, `13` `product`, and `0` soft-status/provenance columns.

---

## 2. Controlled Evolution & Security Vulnerabilities

1. **Unreviewed Commercial Playbook & Prompt Mutations:**
   - `humanAttendanceLearner.js:279-327` directly upserts `ai_playbooks` with `status = 'approved'` without operator approval.
   - `conversationEvolutionService.js:836-884` parses customer + bot text with hardcoded regexes and writes `evolution_insight` nodes directly into `agent_memory_nodes`, which `ai.service.js:1411-1420` injects into every system prompt.
   - `conversationMemoryEngine.extractFactsFromContext` and `customerMemoryEngine.extractFactsLocally` persist single unvalidated customer messages with `confidence: 1.0`.
2. **Prompt Injection Vector via Cross-Conversation Episodes:**
   - `agentMemoryGraphService.learnFromInteraction` stores raw customer utterances and `recallRelevantMemory` injects top episodes into prompts of *other* customers without filtering directive-injection strings.
3. **Tenant / Session Scoping Bugs:**
   - `ai_context` (`010:54`) enforces `UNIQUE(chat_id)` globally without `company_id`; `ai_logs` lacks a `company_id` column (relying on `JOIN conversations`); `bootstrapAgentMemoryGraph` omits `properties.sessionId`, causing session filters to hide bootstrapped memories while `recallRelevantMemory` ignores `sessionId`.
4. **Missing Rollback UI & Conversation Explainability:**
   - `ai_agent_versions` snapshots are hidden in `historyRoutes.js` (`GET/POST /versions`), completely omitted when `sessionIds = []`, and not rendered in `EvolutionTab.tsx`.
   - `ai_experience_events.metadata` does not save the exact `recalledMemoryIds` and `effectiveConfig` needed to explain why an agent produced a specific reply.

---

## 3. Target Remediation Summary

- Reorganize `Memória & Evolução` into **4 clear, zero-mock areas**: **Visão Geral**, **Cérebro & Memória** (7 categories + real CRUD/disable/delete + `agent | session | company_shared` scope), **Evolução Cognitiva** (`identified -> pending_approval -> applied -> rollback` with before/after & evidence), and **Resultados & Conversas** (real SQL KPIs + Conversation Explainability Drawer).
- Harden all ingestion against prompt injection and forbid automatic commercial rule creation from single untrusted customer messages.
