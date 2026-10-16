# Auditoria de Production Readiness — ZAPFLOW AI / ZAPAI

**Data:** 17/06/2026
**Escopo:** Inbox, WhatsApp, Baileys, WebSocket, Mensagens, Upload de mídia, CRM, IA, Fluxos + infraestrutura, segurança, testes e build.
**Natureza:** Auditoria somente. Nada foi implementado. Este documento é o backlog priorizado e o mapa de execução.

---

## 1. Sumário executivo

O projeto está **arquiteturalmente maduro e funcional em desenvolvimento** — backend Express + Socket.IO + PostgreSQL + Baileys, frontend React/Vite. O QA local passa (frontend :8080, backend :4025, Postgres com 41 tabelas, WebSocket online). A camada de conexão WhatsApp (`stableSession.js`) é robusta: backoff exponencial, detecção de ban/conflito (409), tratamento de disconnect terminal.

Os bloqueios para produção **não são de funcionalidade básica**, e sim de **hardening, durabilidade e segurança operacional**: mídia de clientes exposta publicamente, validação de ambiente que não aborta o boot, dependência de Redis ausente (fila/cache em memória), armazenamento de mídia só em disco local, e drift de tipos no frontend mascarado pelo build.

**Estado atual de runtime relevante:**
- Sessão WhatsApp `main`: **sem credenciais** (linha principal desconectada). `teste1010`: pré-autenticada.
- **Redis não configurado** → cache e fila operam em modo memória (degradado, single-node).
- **PM2 não está rodando** → sem auto-restart fora de Docker.
- **22 arquivos de migration, 20 aplicadas** → 2 migrations possivelmente pendentes.

**Contagem por severidade:** P0: 3 · P1: 6 · P2: 7 · P3: 5.

---

## 2. Critérios de classificação

| Nível | Significado | Critério prático |
|---|---|---|
| **P0** | Crítico | Bloqueia go-live: sistema quebrado, perda/exposição de dados, ou deploy inseguro. |
| **P1** | Alto | Funcionalidade crítica comprometida ou risco real em produção sob carga/restart. |
| **P2** | Médio | Performance, robustez, observabilidade e manutenibilidade. |
| **P3** | Baixo | UX, acessibilidade, ruído de logs, polish. |

---

## 3. Backlog completo (priorizado)

### 🔴 P0 — Crítico (bloqueia produção)

#### P0-1 · Mídia de clientes servida publicamente, sem autenticação, com CORS `*`
- **O quê:** `/media` e `/upload` são servidos como estáticos com `Access-Control-Allow-Origin: *` e são montados **antes** do middleware de autenticação JWT. Qualquer pessoa com a URL (ou que a adivinhe) baixa fotos, áudios e documentos de conversas de clientes, de qualquer origem.
- **Impacto:** Vazamento de dados de clientes / exposição LGPD. Alto risco legal e reputacional.
- **Arquivos:** `backend/server.js` (≈linhas 541-550, `staticOptions` + `app.use('/media', ...)`, `app.use('/upload', ...)`); ordem vs `registerRoutes`/`requireJwtAuth`.
- **Direção de correção:** URLs assinadas com expiração, ou proxy autenticado de mídia, ou no mínimo tokens não-adivinháveis + restringir CORS à origem do app.
- **Riscos da correção:** Quebrar exibição de mídia já referenciada por URL relativa; exige ajustar `buildMediaUrl` e o front.

#### P0-2 · Validação de ambiente não aborta o boot
- **O quê:** `envValidator.validateEnvironment()` é chamado no boot mas **o retorno não é checado** — erros críticos (DATABASE_URL/JWT ausentes) são apenas logados; o servidor continua subindo. Além disso o validador só rejeita o placeholder literal `your-secret-key`, então **o segredo de desenvolvimento reusado em produção passa despercebido**.
- **Impacto:** Deploy sobe mal configurado e falha de formas silenciosas/imprevisíveis; reuso de segredo de dev compromete toda a autenticação.
- **Arquivos:** `backend/server.js` (≈linha 1649); `backend/services/envValidator.js`.
- **Direção:** Abortar (`process.exit(1)`) quando `errors.length > 0` em produção; adicionar lista de segredos proibidos (dev defaults conhecidos) e exigir comprimento mínimo real.
- **Riscos:** Boot mais rígido pode travar ambientes intermediários mal configurados (desejável, mas exige checklist de env claro).

#### P0-3 · Mídia persistida só em disco local, sem object storage; URL depende de `PUBLIC_URL`
- **O quê:** Mídia é gravada via `fsp.writeFile(absolutePath, buffer)` no disco do container. `buildMediaUrl` retorna caminho **relativo** quando `PUBLIC_URL` é localhost/ausente.
- **Impacto:** Em container/multi-node a mídia **some no restart** (a menos que haja volume persistente) e **não é compartilhada entre nós**; URLs quebram se `PUBLIC_URL` não estiver setado corretamente em produção.
- **Arquivos:** `backend/services/enterprise/media-service.js` (≈linha 197); `backend/services/whatsapp/media/url.js`.
- **Direção:** Object storage (S3/compatível) ou volume persistente garantido + `PUBLIC_URL` obrigatório validado no boot.
- **Riscos:** Migração de mídia já gravada; custo de storage.

---

### 🟠 P1 — Alto

#### P1-1 · APIs de cluster retornam 404 e quebram telas Master
- **O quê:** `/api/cluster/nodes`, `/api/cluster/overview` etc. só são montadas quando `FEATURE_NODE_MASTER_API=true` (default só em modo master), mas o usuário opera como `master_admin` em máquina única. Telas `/nodes` e `/deployments` recebem 404; `loadNodesControlPlane` não tratava o 404 da rota `nodes`.
- **Impacto:** Área Master inutilizável; erros de console.
- **Arquivos:** `backend/routes/index.js` (≈linha 83), `backend/config/runtimeEnv.js` (≈linha 49); `frontend-official/src/services/masterNodeService.ts` (≈linha 233), `adminMasterService.ts`.
- **Direção:** Habilitar flags no `.env` para deploy single-box **e** degradar o front com `.catch`. *(Itens já endereçados em sessão anterior; manter no backlog para validação pós-restart.)*
- **Riscos:** Habilitar rotas Master expõe ações sensíveis — proteger por `requireMasterAdmin` (já presente).

#### P1-2 · Redis ausente → fila e cache em memória (não-durável, single-node)
- **O quê:** `REDIS_URL` não configurado; `queue-service`/`cache-service` caem em modo degradado. A fila de saída tem persistência em arquivo/DB parcial, mas o caminho enterprise depende de Redis.
- **Impacto:** Jobs de envio podem ser perdidos em restart; sem locks distribuídos não há multi-node seguro; cache não compartilhado.
- **Arquivos:** `backend/services/enterprise/queue-service.js` (≈65), `cache-service.js` (≈12), `backend/services/outboundQueueService.js`.
- **Direção:** Provisionar Redis em produção; tornar `REDIS_URL` recomendado→obrigatório no modo enterprise.
- **Riscos:** Dependência operacional adicional.

#### P1-3 · Sessão WhatsApp principal (`main`) sem credenciais
- **O quê:** A linha `main` está `No credentials` (não autenticada). Apenas `teste1010` está pré-autenticada.
- **Impacto:** Sem a linha principal conectada, o produto não envia/recebe na conta de produção.
- **Arquivos:** `backend/sessions/` (estado de auth Baileys); fluxo de QR em `services/whatsapp/connection/`.
- **Direção:** Operacional — reconectar/parear a linha de produção e validar restore.
- **Riscos:** Re-pareamento gera novo QR; garantir `WHATSAPP_RESTORE_*` e allowlist corretos.

#### P1-4 · `ENCRYPTION_KEY` com fallback hardcoded
- **O quê:** `crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'ZAPFLOW_SECURE_SALT_KEY_2026')` — se nenhuma var estiver setada, cifra dados de IA com uma **constante conhecida no código**.
- **Impacto:** Segredos de provedores de IA cifrados com chave pública-no-repo são efetivamente texto plano para quem tem o código.
- **Arquivos:** `backend/controllers/aiConfigController.js` (≈238); `backend/services/ai.service.js` (≈249).
- **Direção:** Exigir `ENCRYPTION_KEY` no boot (sem fallback); rotacionar dados já cifrados.
- **Riscos:** Migração/rotação de dados cifrados existentes.

#### P1-5 · Drift de tipos no frontend mascarado pelo build
- **O quê:** O `tsc` falha com dezenas de erros (`Conversation` sem `isBlocked`/`assigned_to`; `RealtimeMessage` sem `mimeType`/`fileName`/`filename`; `RawMessageEnvelope` sem `phone`; ícone AI sem `$$typeof`). O build de produção usa Vite/esbuild, que **ignora erros de tipo** — por isso o build "passa".
- **Impacto:** Bugs de runtime potenciais não detectados (campos lidos que não existem no tipo → `undefined` silencioso); refactors arriscados.
- **Arquivos:** `frontend-official/src/stores/appStore.ts`, `src/pages/Inbox/components/ActiveChatPane.tsx` e `SidebarPanel.tsx`, `src/runtime/socket/socketManager.ts`, `src/pages/Connections.tsx` (≈251, `PromiseSettledResult`).
- **Direção:** Reconciliar as definições de tipo com o uso real; adicionar `tsc --noEmit` ao CI como gate.
- **Riscos:** Alto volume de ajustes; fazer por módulo.

#### P1-6 · Migrations possivelmente pendentes (22 arquivos vs 20 aplicadas)
- **O quê:** Diretório `migrations/` tem 22 arquivos; o QA reporta 20 aplicadas.
- **Impacto:** Possível drift de schema entre código e banco; features que dependem das 2 migrations podem falhar.
- **Arquivos:** `backend/migrations/`.
- **Direção:** Auditar quais migrations faltam e aplicar de forma controlada (`DB_RUN_MIGRATIONS_ON_BOOT` já existe).
- **Riscos:** Migration destrutiva sem backup; rodar com backup prévio.

---

### 🟡 P2 — Médio

| ID | Item | Impacto | Arquivos |
|---|---|---|---|
| **P2-1** | **Sem APM / error tracking** (Sentry/OpenTelemetry/Datadog) | Observabilidade cega em produção; incidentes difíceis de diagnosticar | `backend/package.json`, bootstrap do servidor |
| **P2-2** | **Dois loggers** (pino **e** winston) coexistindo | Logs inconsistentes, overhead, confusão | `backend/package.json`, serviços de log |
| **P2-3** | **Código legacy presente** (`sessionManager.legacy.js` 955L, `connectionService.legacy.js`, `whatsappService.legacy.js`) | Dead code, risco de import errado, confusão | `backend/services/*.legacy.js` |
| **P2-4** | **Arquivos monolíticos** (`server.js` 1823L, `stableSession.js` 1645L, `messagesController.js` 1063L) | Manutenibilidade, risco de regressão | `backend/server.js`, `services/whatsapp/connection/stableSession.js` |
| **P2-5** | **Fluxos: só GET/POST no backend** (sem update/delete persistente) enquanto a UI tem edição | Edição de fluxo pode não persistir | `backend/routes/automation.js`, `frontend-official/src/pages/Flows.tsx` |
| **P2-6** | **PM2 não roda** em produção | Sem auto-restart fora de Docker/systemd | `ecosystem.config.js`, deploy |
| **P2-7** | **Build com binários nativos travados por plataforma** (rollup/esbuild) | CI/cross-platform frágil; build falha fora do SO de instalação | `frontend-official/node_modules`, pipeline CI |

---

### 🟢 P3 — Baixo

| ID | Item | Impacto | Arquivos |
|---|---|---|---|
| **P3-1** | `DialogContent` sem `Description`/`aria-describedby` em Connections | Aviso a11y do Radix | `frontend-official/src/pages/Connections.tsx` *(já endereçado)* |
| **P3-2** | Warning de `key` em `/diagnostics` | **Obsoleto** — varredura da árvore não encontrou `.map` sem `key` | `frontend-official/src/runtime/diagnostics/Diagnostics.tsx` |
| **P3-3** | Warnings React Router v7 future-flags | Ruído de console | configuração do Router |
| **P3-4** | Fallback `"Camila"` exibido como agente em conversas sem atribuição | Dado fake na UI | `frontend-official/src/stores/appStore.ts` (≈206-226) |
| **P3-5** | Crawler usa `networkidle` em páginas com polling/WS → falso "rota quebrada" no `/inbox` | Falso-positivo de QA | `frontend-official/tests/ui/discovery-crawler.spec.ts` *(já endereçado)* |

---

## 4. Ordem correta de execução

A sequência respeita dependências (segurança e config antes de durabilidade; durabilidade antes de polish) e maximiza redução de risco por esforço.

**Onda 1 — Segurança e configuração de boot (bloqueadores de go-live)**
1. **P0-2** validar env e abortar boot + proibir segredos de dev → base segura.
2. **P1-4** exigir `ENCRYPTION_KEY` (depende de P0-2 estar abortando boot).
3. **P0-1** proteger mídia (auth/URL assinada) — definir antes de mexer em storage.

**Onda 2 — Durabilidade de dados e mídia**
4. **P0-3** object storage / volume + `PUBLIC_URL` obrigatório (consome a decisão de P0-1).
5. **P1-2** provisionar Redis (fila/cache durável, multi-node).
6. **P1-6** reconciliar e aplicar migrations pendentes (com backup).

**Onda 3 — Funcionalidade e qualidade**
7. **P1-1** validar Master/cluster pós-flags + restart.
8. **P1-3** reconectar linha WhatsApp `main` e validar restore.
9. **P1-5** reconciliar tipos do frontend + `tsc` no CI.
10. **P2-5** completar CRUD de Fluxos no backend.

**Onda 4 — Observabilidade e manutenibilidade**
11. **P2-1** APM/error tracking. 12. **P2-2** unificar logger. 13. **P2-6** PM2/supervisão. 14. **P2-7** corrigir build de CI. 15. **P2-3 / P2-4** remover legacy / quebrar monólitos.

**Onda 5 — Polish**
16. **P3-3, P3-4** e validação final de **P3-1, P3-2, P3-5** (já endereçados).

---

## 5. Estimativa de impacto (esforço × risco)

| ID | Severidade | Esforço | Risco se ignorado | Ganho |
|---|---|---|---|---|
| P0-1 | Crítico | Médio | Vazamento de dados de clientes (LGPD) | Conformidade legal |
| P0-2 | Crítico | Baixo | Deploy inseguro/silenciosamente quebrado | Boot seguro |
| P0-3 | Crítico | Alto | Perda de mídia em restart / multi-node | Durabilidade |
| P1-1 | Alto | Baixo | Área Master inoperante | Telas Master OK |
| P1-2 | Alto | Médio | Jobs perdidos, sem multi-node | Escalabilidade |
| P1-3 | Alto | Baixo (operacional) | Produto não opera na linha real | Operação |
| P1-4 | Alto | Baixo | Segredos de IA expostos | Segurança |
| P1-5 | Alto | Alto | Bugs runtime ocultos | Confiabilidade |
| P1-6 | Alto | Baixo | Drift de schema | Integridade |
| P2-1..7 | Médio | Variado | Cegueira operacional / dívida técnica | Operabilidade |
| P3-1..5 | Baixo | Baixo | Ruído / UX | Polish |

---

## 6. Riscos transversais

- **Risco de processo:** o `tsc` falha hoje; o build "verde" via esbuild **mascara** regressões de tipo. Sem gate de tipos no CI, P1-5 tende a crescer.
- **Risco de ambiente:** `node_modules` instalado no SO host trava binários nativos (rollup/esbuild) — builds em CI/Linux falham até reinstalar dependências na plataforma alvo.
- **Risco de dados:** qualquer correção que toque mídia (P0-1, P0-3) ou migrations (P1-6) exige **backup prévio** e janela controlada.
- **Risco de git:** o índice local do git apresentou corrupção (`bad signature`) durante manutenção — recomenda-se reconstruir o índice (`del .git\index` + `git reset` no Windows) antes de commitar este backlog.
- **Nota de método:** esta auditoria é estática/por leitura de código + QA existente. Recomenda-se validação dinâmica (carga, restart, failover) antes do go-live.

---

## 7. Observações positivas (o que já está bom)

- Camada de conexão WhatsApp madura: backoff, ban/conflito (409), disconnect terminal, restore configurável.
- JWT próprio **seguro**: valida `alg=HS256` (sem alg-confusion), usa `timingSafeEqual`, valida `exp`/`nbf`.
- `.env` corretamente no `.gitignore` (segredos não versionados).
- Dedupe de mensagens, contexto de tenant, envelope de API padronizado e `GlobalErrorBoundary`/`SafeRender` no front.
- IA rica em endpoints (status, logs, métricas, prompt, learning/análise) e Baileys/Socket.IO/Express/pg em versões modernas.
- Base de testes existe (smoke backend + Playwright E2E no front).
