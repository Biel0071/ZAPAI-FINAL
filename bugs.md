# Relatório de Auditoria Frontend, QA e Investigação de Duplicação

> O relatório oficial completo com todas as evidências, capturas de tela e dados brutos encontra-se arquivado em:  
> [`outros/reports/qa/bugs.md`](file:///c:/projetos/ZAPAI-FINAL/outros/reports/qa/bugs.md)

---

## Resumo Executivo da Auditoria

**Data da Auditoria:** 10 de Setembro de 2026  
**Ambiente Auditado:** Produção Publicada em [http://209.50.241.22/](http://209.50.241.22/)  
**Versão Publicada:** `1.0.0` (Node v20.20.2, Linux x86_64, Host: `vps9647.panel.icontainer.net`)  
**Commit Analisado (Baseline):** `ce81927c` (*feat: show contact avatar consistently across inbox and contacts views*)  

### Métricas Reais da Auditoria

| Indicador | Total Real |
| :--- | :---: |
| **Total de Telas Encontradas** | **16** |
| **Total de Telas Testadas** | **16** |
| **Total de Funcionalidades Testadas** | **116** |
| **Ações PASS (Aprovadas)** | **53** |
| **Ações FAIL (Falhas)** | **4** |
| **Ações BLOCKED (Bloqueadas)** | **1** |
| **Ações NOT TESTED (Triagem/Pendente)** | **58** |
| **Bugs Prioridade P0 (Crítico)** | **0** |
| **Bugs Prioridade P1 (Alta)** | **2** |
| **Bugs Prioridade P2 (Média)** | **3** |
| **Bugs Prioridade P3 (Baixa/UX)** | **4** |
| **Bugs Reproduzidos** | **9** |
| **Bugs Suspeitos** | **2** |
| **Bugs Corrigidos (Local)** | **4** |
| **Testes de Regressão Automatizados** | **7** |
| **Erros de Console** | **7** |
| **Erros de Rede (HTTP >= 400)** | **4** |
| **Problemas Responsivos Mapeados** | **4** |
| **Status da Duplicação de Mensagens** | **Causa Raiz Isolada e Corrigida** |

---

## Classificação dos Bugs Encontrados

### P1 — Funcionalidade Principal Quebrada / Risco de Envio
1. **BUG-P1-01: Mensagens Triplicadas no WhatsApp (Envio Duplicado/Triplicado)**
   - **Localização:** [`senders.js`](file:///c:/projetos/ZAPAI-FINAL/backend/services/whatsapp/outbound/senders.js), [`useInboxState.ts`](file:///c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/Inbox/hooks/useInboxState.ts), [`SidebarPanel.tsx`](file:///c:/projetos/ZAPAI-FINAL/frontend-official/src/pages/Inbox/components/SidebarPanel.tsx).
   - **Causa Raiz Comprovada:**
     1. O método `sendMessage` no backend usava `sendWithRetry(..., 3)`. Em conexões lentas ou com demora de confirmação de entrega do Baileys, o socket disparava até 3 vezes a mensagem diretamente na rede do WhatsApp.
     2. No frontend (`useInboxState.ts`), o catch de quick reply chamava `handleSendMessage` cegamente como fallback caso houvesse timeout ou erro, gerando reenvio de uma mensagem já enfileirada.
     3. Botões de resposta rápida no SidebarPanel não tinham trava `disabled={sending}`, permitindo cliques rápidos em sequência.
     4. No store (`appStore.ts`), mensagens temporárias otimistas (`temp-`) persistiam ao lado da mensagem definitiva se o ID/timestamp não colidissem exatamente, gerando duplicação visual de 2 bolhas.
   - **Status:** **REPRODUCED** no baseline / **FIXED + REGRESSION PASS** no ambiente local.

2. **BUG-P1-02: Supressão Indevida de Mensagens Idênticas Legítimas (Cenário E)**
   - **Localização:** [`appStore.ts`](file:///c:/projetos/ZAPAI-FINAL/frontend-official/src/stores/appStore.ts).
   - **Causa Raiz Comprovada:** Ao tentar filtrar duplicações, foi incluída uma regra ingênua de que mensagens com o mesmo texto em menos de 5 segundos eram duplicadas. Isso descartava envios legítimos intencionais com o mesmo texto.
   - **Status:** **REPRODUCED** (`SEND-E1`) / **FIXED + REGRESSION PASS** (aprovado na suíte Vitest).

---

### P2 — Funcionalidade Parcialmente Quebrada / Importante
3. **BUG-P2-01: HTTP 404 em Configurações > Fila de Envios**
   - **Localização:** [`apiService.ts`](file:///c:/projetos/ZAPAI-FINAL/frontend-official/src/services/apiService.ts) vs [`messages.js`](file:///c:/projetos/ZAPAI-FINAL/backend/src/api/routes/messages.js).
   - **Causa Raiz:** O frontend chamava `/api/messages/outbound-queue/pending?limit=500`, enquanto o backend expunha `/api/outbound-queue/pending`.
   - **Status:** **REPRODUCED** (`QUEUE-001`, `QUEUE-002`) / **FIXED + REGRESSION PASS**.

4. **BUG-P2-02: HTTP 403 Forbidden em `/api/session-status`**
   - **Localização:** [`server.js`](file:///c:/projetos/ZAPAI-FINAL/backend/server.js) e [`adminMaster.js`](file:///c:/projetos/ZAPAI-FINAL/backend/src/api/routes/adminMaster.js).
   - **Causa Raiz:** Middleware `requireMasterAdmin` não filtrava prefixo de rota e interceptava rotas públicas declaradas após `registerRoutes`.
   - **Status:** **REPRODUCED** / **FIXED + REGRESSION PASS**.

5. **BUG-P2-03: Falha de Handshake WebSocket em `/ws/nodes` e `/ws/metrics`**
   - **Localização:** Proxy reverso Nginx na VPS (`http://209.50.241.22/`).
   - **Causa Raiz:** Nginx responde HTTP 200 em vez de 101 Switching Protocols por falta de cabeçalho `Upgrade` para essas rotas.
   - **Status:** **REPRODUCED**.

---

### P3 — Problemas Visuais e de Responsividade
6. **BUG-P3-01: Overflow e Truncamento de Abas em Configurações (360px a 844px)**
   - 20 seções da barra lateral de `/settings` são cortadas para fora da viewport em telas móveis.
7. **BUG-P3-02: Quebra Horizontal e Sobrecarga de Filtros em Contatos (360px)**
   - 681 controles/elementos fora da largura útil em 360px.
8. **BUG-P3-03: Botão de Ação Primária Cortado em Campanhas Paisagem (844x390)**
   - Botão "Próximo Passo →" no cabeçalho sticky fica cortado na margem direita em celulares na horizontal.
9. **BUG-P3-04: Botão "Testar IA" Cortado em Mobile (360px)**
   - Botão de teste e seletores sofrem corte lateral em telas pequenas.

---

## Testes de Regressão Executados

1. **Vitest Frontend (`frontend-official/src/test/messageDedupe.test.ts`):**
   - Cenário A: Uma operação → uma mensagem (`PASS`)
   - Cenário B: Clique rápido com mensagem otimista substituída pela confirmada (`PASS`)
   - Cenário C: Enter com confirmação sem duplicação (`PASS`)
   - Cenário D: Retry legítimo ou mensagens com IDs WhatsApp distintos preservadas (`PASS`)
   - Cenário E: Duas operações intencionais com texto idêntico → DUAS mensagens legítimas preservadas (`PASS`)
2. **Node Test Backend (`backend/tests/`):**
   - `whatsapp-outbound-senders.test.js`: Preservação de LID e resolução direta sem overhead (`PASS`)
   - `flowTracker.test.js`: Emissão de eventos imutáveis em tempo real (`PASS`)
3. **TypeScript Typecheck:**
   - `tsc --noEmit`: 0 erros encontrados (`PASS`).

> Consulte o relatório detalhado em [`outros/reports/qa/bugs.md`](file:///c:/projetos/ZAPAI-FINAL/outros/reports/qa/bugs.md) para a lista de todas as capturas de tela e evidências registradas.
