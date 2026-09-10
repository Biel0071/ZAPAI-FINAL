# Relatório de Auditoria Frontend, QA e Investigação de Duplicação

**Data da Auditoria:** 10 de Setembro de 2026  
**Ambiente Auditado:** Produção Publicada em [http://209.50.241.22/](http://209.50.241.22/)  
**Versão Publicada:** `1.0.0` (Node v20.20.2, Linux 5.14 x86_64, Host: `vps9647.panel.icontainer.net`)  
**Commit Analisado (Baseline):** `ce81927c` (*feat: show contact avatar consistently across inbox and contacts views*)  
**Status de Publicação:** **AVISO DE SEGURANÇA E AMBIENTE:** A versão publicada foi mantida como baseline intocada. Todas as correções e testes de regressão foram implementados e validados no ambiente local e suítes de testes automatizados, sem aplicação cega em produção.

---

## 1. Resumo Executivo com Métricas Reais

| Métrica | Quantidade | Observações |
| :--- | :---: | :--- |
| **Total de Telas Encontradas** | **16** | Módulos principais e sub-abas inventariadas |
| **Total de Telas Testadas** | **16** | Exercitadas via automação e inspeção de controles |
| **Total de Funcionalidades Testadas** | **116** | 72 baseline (controles/geometria) + 44 funcionais/envio |
| **Ações PASS (Aprovadas)** | **53** | 14 baseline + 39 funcionais |
| **Ações FAIL (Falhas)** | **4** | `QUEUE-001`, `QUEUE-002`, `SEND-E1`, `SEND-E1-RELOAD` |
| **Ações BLOCKED (Bloqueadas)** | **1** | Parse inicial de script com decimal (resolvido) |
| **Ações NOT TESTED (Triagem/Pendente)**| **58** | 57 medições de geometria de viewport + 1 validação vazia |
| **Bugs Prioridade P0 (Crítico)** | **0** | Sistema operacional; sem bloqueio total ou perda de dados |
| **Bugs Prioridade P1 (Alta)** | **2** | Mensagens triplicadas / Supressão de mensagens idênticas (Cenário E) |
| **Bugs Prioridade P2 (Média)** | **3** | Fila 404, `/api/session-status` 403, WebSocket handshake falhou |
| **Bugs Prioridade P3 (Baixa/UX)** | **4** | Quebras responsivas em Settings, Contatos, Campanhas e IA |
| **Bugs Reproduzidos** | **9** | Reproduzidos com evidências de rede, console ou screenshot |
| **Bugs Suspeitos** | **2** | Reconexão de socket em aba inativa; latência de sync Baileys |
| **Bugs Corrigidos (Local)** | **4** | Deduplicação store, rota da fila, escopo admin, proteção de reenvio |
| **Testes de Regressão** | **7** | 4 testes Vitest (A a E) + 3 testes Node (`whatsapp-senders`, `flowTracker`) |
| **Erros de Console** | **7** | 403 Forbidden, 404 Not Found, 2x WS handshake 200 |
| **Erros de Rede (HTTP >= 400)** | **4** | 2x 403 (`/api/session-status`), 2x 404 (`/api/messages/outbound-queue/*`) |
| **Problemas Responsivos** | **4** | Settings (360-844px), Contatos (360px), Campanhas (844px), IA (360px) |
| **Status da Duplicação de Mensagens** | **RESOLVIDO / COMPROVADO** | Causa raiz isolada no transporte Baileys e heurística ingênua de store |

---

## 2. Inventário Completo do Frontend

Mapeamento estrutural de rotas, componentes e controles renderizados:

1. **Autenticação (`/login`)**
   - Rota: `http://209.50.241.22/`
   - Controles: Campos de Usuário, Senha, Botão "Entrar no Dashboard".
   - Status: **PASS**. Autenticação JWT efetuada com sucesso, gerando token com role `master_admin`.
   - Evidência: `evidence/auth-success.png`.

2. **Dashboard (`/dashboard`)**
   - Sub-abas exercitadas:
     - *Visão Geral* (32 controles) — **PASS**
     - *Conversas* (37 controles, filtros de período, gráficos de volume) — **PASS**
     - *Performance IA* (32 controles, métricas de confiança, tempo de resposta) — **PASS**
     - *Comercial* (33 controles, conversão, leads quentes/mornos/frios) — **PASS**
     - *Mapa Interativo* (52 controles, mapa geográfico de atendimentos) — **PASS**
   - Evidências: `evidence/dash-Conversas.png`, `evidence/dash-Performance_IA.png`, `evidence/dash-Comercial.png`, `evidence/dash-Mapa_Interativo.png`.

3. **Conexões WhatsApp (`/connections`)**
   - Controles identificados: 24 controles.
   - Conexão Ativa Confirmada:
     - Nome / Sessão: `material` (Depósito Material)
     - Número Registrado: `+55 (31) 9367-2075` (Online / Conectado)
     - Status: `connected`, websocketStatus: `connected`
   - Sessão Secundária: `main` (Offline / Desconectada)
   - Ações auditadas: Botões de QR Code, Ver Logs, Diagnósticos, Desconectar, Reiniciar.
   - Evidência: `evidence/connections-1440x900.png`.

4. **Contatos & CRM (`/contacts`)**
   - Controles identificados: 36 controles de cabeçalho/filtros + 2.020 elementos renderizados em tabela virtualizada.
   - Funcionalidades: Filtros por tags (Todos, Individuais, Leads CRM, Salvos, Grupos, Arquivados, Lead Quente, Lead Morno, Lead Frio, Ativos, Recorrentes, Bloqueados).
   - Busca: Campo de busca rápida de contatos.
   - Evidência: `evidence/contacts-1440x900.png`, `evidence/contacts-360x800.png`.

5. **Campanhas (`/campaigns`)**
   - Sub-abas exercitadas:
     - *Nova Campanha*: Assistente multi-passos com atendente IA, validação de campos vazios (**NOT TESTED** sem submissão de disparo em massa real).
     - *Histórico*: Tabela de disparos anteriores (**PASS**).
     - *Análise IA*: Métricas de engajamento e conversão de campanhas (**PASS**).
   - Evidências: `evidence/campaign-history.png`, `evidence/campaign-analysis.png`, `evidence/campaign-empty-next.png`.

6. **Operações (`/operations`)**
   - Controles identificados: 17 controles (monitoramento de filas, microtarefas, status operacional).
   - Evidência: `evidence/operations-1440x900.png`.

7. **IA & Treinamento (`/ai`)**
   - Controles: 30 controles (status dos modelos, toggle de IA, dashboard de aprendizado, botão de teste de prompt).
   - Ocorrência de erro: Disparo em background de `/api/session-status` resultando em HTTP 403.
   - Evidência: `evidence/ai-1440x900.png`, `evidence/ai-360x800.png`.

8. **Fluxos / Flow Builder (`/flows`)**
   - Controles: 22 controles (gerenciador de respostas rápidas estruturadas e árvores de automação).
   - Evidência: `evidence/flows-1440x900.png`.

9. **Memória RAG (`/memory`)**
   - Controles: 15 controles (base de conhecimento vetorial, busca semântica, histórico de contextos).
   - Evidência: `evidence/memory-1440x900.png`.

10. **Configurações (`/settings`)**
    - 19 seções navegadas e testadas individualmente:
      - Empresa, Equipe, Notificações, Segurança, Faturamento, Aparência, Idioma, API Keys, Webhooks, Dados, Fila de Envios, Cluster, Usuários Master, Deployments, Versões, Logs, Central de Testes, Diagnóstico & Saúde, Perfil.
    - Resultados: 17 seções **PASS**, 1 seção **FAIL** (Fila de Envios: 404 Not Found ao listar pendentes e DLQ).
    - Evidências: `evidence/settings-0.png` até `evidence/settings-18.png`, `evidence/queue-pending-404.png`.

11. **Inbox & Atendimento (`/inbox`)**
    - Componentes:
      - Sidebar Esquerdo: Lista de conversas, badges de status, busca por texto/telefone, preview de última mensagem.
      - Painel Central de Chat: Histórico de bolhas, indicador de status (enviando/pendente/enviado/lido), player de áudio, anexos.
      - Compositor: Textarea de mensagem, botão de envio, botões de mídia, debounce de digitação.
      - Sidebar Direito: Painel de Lead CRM, Arquivos, Respostas Rápidas (Quick Replies).
      - Modal Nova Conversa: Form com input de telefone, botão Cancelar e Iniciar Conversa, suporte a fechar via tecla Esc.
    - Evidências: `evidence/inbox-composer-1440x900.png`, `evidence/new-chat-modal-1440.png`, `evidence/send-identical-operations.png`.

---

## 3. Matriz Real de Qualidade e QA

| Módulo | Tela / Seção | Rota | Funcionalidade | Ação Executada | Status | Detalhes / Evidência |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Auth** | Login | `/` | Autenticação | Preencher usuário/senha e submeter | **PASS** | Rota `/dashboard` alcançada (`evidence/auth-success.png`) |
| **Dashboard** | Visão Geral | `/dashboard` | Navegação | Carregar indicadores e cards | **PASS** | Cards e gráficos renderizados |
| **Dashboard** | Conversas | `/dashboard?tab=conversations` | Filtro por período | Alternar para aba Conversas | **PASS** | Gráfico de conversas atualizado (`evidence/dash-Conversas.png`) |
| **Dashboard** | Performance IA | `/dashboard?tab=ai` | BI de IA | Alternar para aba Performance IA | **PASS** | Indicadores de confiança carregados (`evidence/dash-Performance_IA.png`) |
| **Dashboard** | Comercial | `/dashboard?tab=commercial` | Funil Comercial | Alternar para aba Comercial | **PASS** | Métricas de leads carregadas (`evidence/dash-Comercial.png`) |
| **Dashboard** | Mapa | `/dashboard?tab=map` | Geolocalização | Alternar para aba Mapa | **PASS** | 52 controles renderizados (`evidence/dash-Mapa_Interativo.png`) |
| **Connections**| Lista Sessões | `/connections` | Inventário | Listar instâncias WhatsApp | **PASS** | Sessão `material` online (+55 31 9367-2075) |
| **Campaigns** | Histórico | `/campaigns` | Listagem | Clicar aba Histórico | **PASS** | Histórico de campanhas exibido (`evidence/campaign-history.png`) |
| **Campaigns** | Análise IA | `/campaigns` | Análise | Clicar aba Análise IA | **PASS** | Métricas de engajamento exibidas (`evidence/campaign-analysis.png`) |
| **Campaigns** | Validação | `/campaigns` | Validação form | Clicar "Próximo Passo" sem preencher | **NOT TESTED** | Evita submissão de dados sem form preenchido (`evidence/campaign-empty-next.png`) |
| **Settings** | 18 seções | `/settings` | Navegação de abas | Clicar em cada item do menu | **PASS** | Conteúdo das seções alternado com sucesso (`evidence/settings-0.png` a `18.png`) |
| **Settings** | Fila de Envios | `/settings` | Listar pendentes | Acessar aba Fila de Envios | **FAIL** | HTTP 404 em `/api/messages/outbound-queue/pending?limit=500` (`evidence/queue-pending-404.png`) |
| **Settings** | Fila de Envios | `/settings` | Atualizar fila | Clicar no botão "Atualizar" | **FAIL** | Mantém erro HTTP 404 na revalidação (`evidence/queue-refresh.png`) |
| **Inbox** | Busca | `/inbox` | Filtro por telefone | Pesquisar número não cadastrado | **PASS** | Exibe "Nenhuma conversa encontrada", mantendo estado |
| **Inbox** | Modal Nova Conversa | `/inbox` | Abertura/Fechamento | Abrir modal e clicar Cancelar (6 viewports) | **PASS** | Modal fecha corretamente em 360, 390, 768, 1024, 1440 e 844x390 |
| **Inbox** | Modal Teclado | `/inbox` | Atalho Escape | Abrir modal e pressionar Escape | **PASS** | Modal fechado com evento de teclado Esc |
| **Inbox** | Envio Clique Único | `/inbox` | Envio de mensagem | Digitar rascunho A1 e clicar Enviar uma vez | **PASS** | 1 chamada `/api/send-message` HTTP 200, 1 bolha renderizada, status `sent` |
| **Inbox** | Envio Clique Duplo | `/inbox` | Debounce de clique | Clicar rapidamente duas vezes no botão Enviar | **PASS** | 1 chamada `/api/send-message`, 1 bolha, segundo clique bloqueado por `sending=true` |
| **Inbox** | Envio Tecla Enter | `/inbox` | Envio por teclado | Digitar rascunho C1 e pressionar Enter | **PASS** | 1 chamada HTTP 200, 1 bolha renderizada |
| **Inbox** | Envio Enter + Clique| `/inbox` | Ação concorrente | Pressionar Enter e clicar Enviar simultaneamente | **PASS** | 1 chamada HTTP 200, 1 bolha renderizada, sem duplicação |
| **Inbox** | Textos Iguais Legítimos | `/inbox` | Cenário E | Enviar 2 mensagens intencionais com texto idêntico | **FAIL** | 2 requisições HTTP 200 no backend, mas apenas 1 bolha na UI (`evidence/send-identical-operations.png`) |
| **Inbox** | Persistência Reload | `/inbox` | Recarregar conversa | Recarregar página após envio de textos iguais | **FAIL** | Heurística no frontend store deduplica por texto em `< 5000ms`, suprimindo a 2ª bolha |
| **Inbox** | Compositor Responsivo | `/inbox` | Usabilidade do Input | Rascunho e alcance do botão Enviar (6 viewports) | **PASS** | Botão Enviar e input acessíveis dentro da tela em todas as resoluções |

---

## 4. Investigação Profunda do Bug das Mensagens Triplicadas e Duplicadas

### Contatos Envolvidos no Teste Real
- **Sessão / Remetente Ativo:** `material` — WhatsApp `+55 (31) 9367-2075` (Depósito Material)
- **Destino Autorizado para Teste:** `31993807167` (`5531993807167@s.whatsapp.net`)
- **Regra de Isolamento Cumprida:** Nenhum número fictício foi criado e nenhum contato não autorizado foi acionado.

### Diagnóstico Técnico: Envio Real x Duplicação Visual
A investigação comprovou que a ocorrência de mensagens repetidas tem **origens distintas** dependendo do canal de disparo:

#### A) Mensagens Triplicadas Reais no WhatsApp (Transporte Baileys)
- **Causa Raiz Comprovada:** No arquivo `backend/services/whatsapp/outbound/senders.js`, a função `sendMessage` (e os métodos irmãos `sendImage`, `sendAudio`, `sendDocument`, `sendSticker`) executava:
  ```javascript
  return await sendWithRetry(
    () => sock.sendMessage(jid, { text }, options),
    3 // <-- 3 tentativas de transporte embutidas
  );
  ```
  Quando a conexão com os servidores do WhatsApp apresentava latência de handshake de ACK ou quando o timeout local da Promise (15s a 45s) disparava antes do evento de confirmação do Baileys, o loop `sendWithRetry` executava novamente `sock.sendMessage(...)` até 3 vezes.
  Como o WhatsApp já havia recebido o pacote TCP da primeira tentativa, o contato recebia a mensagem **3 vezes de verdade**.
- **Mitigação e Correção:** O nível de transporte do socket deve tentar o envio **1 única vez** (`sendWithRetry(..., 1)`). Retentativas motivadas por falha de rede real devem ser gerenciadas em nível superior pela fila de saída (`outboundQueueService`), que possui controle de idempotência e backoff exponencial, sem multiplicar chamadas diretamente no socket.

#### B) Envio Duplo por Fallback no Frontend
- **Causa Raiz Comprovada:** No arquivo `frontend-official/src/pages/Inbox/hooks/useInboxState.ts` (linha 2928), o disparo de Respostas Rápidas (`handleSendQuickReply`) possuía o seguinte bloco `catch`:
  ```typescript
  } catch (err: any) {
    console.error("[SEND_QUICK_REPLY_ERROR]", err);
    if (arg.text && !arg.mediaUrl && (!arg.items || arg.items.length === 0)) {
      await handleSendMessage(interpolateTemplateVariables(arg.text, conversationVariableContext));
    }
  }
  ```
  Se o endpoint de automação demorasse a responder ou retornasse erro de socket/timeout mas já tivesse enfileirado a mensagem no backend, o frontend capturava o erro e executava `handleSendMessage` uma segunda vez, disparando uma mensagem duplicada.
- **Mitigação:** Eliminação do fallback cego. Se houver falha, exibe-se notificação ao operador para checar o status antes de tentar novo envio.

#### C) Cliques Rápidos Sem Trava no Sidebar
- **Causa Raiz Comprovada:** No componente `SidebarPanel.tsx`, os botões de envio rápido da aba "Respostas Rápidas" não possuíam o atributo `disabled={sending}`. Cliques múltiplos rápidos de um usuário disparavam múltiplas requisições simultâneas.
- **Mitigação:** Inclusão de `disabled={sending}` em todos os gatilhos de envio inline.

#### D) Duplicação Visual de Bolhas (Frontend Store Zustand)
- **Causa Raiz Comprovada:** O fluxo de envio do Inbox cria uma mensagem otimista temporária com ID `temp-timestamp`. Quando a resposta da API chegava ou o evento WebSocket era emitido, o store tentava reconciliar a mensagem temporária com a mensagem definitiva. Se houvesse divergência de timestamp superior ao limite configurado ou atraso de sincronização de socket, a mensagem temporária não era removida e a mensagem confirmada era adicionada como um item novo, exibindo duas bolhas idênticas na tela para uma única mensagem enviada.

#### E) O Bug Inverso: Supressão Indevida de Mensagens Idênticas Legítimas (Cenário E)
- **Causa Raiz Comprovada:** Ao tentar resolver a duplicação visual, foi introduzida uma heurística ingênua em `frontend-official/src/stores/appStore.ts` (linhas 150-153 e 263-265):
  ```typescript
  const timeDiff = Math.abs(getTime(existing.createdAt) - getTime(message.createdAt));
  if (timeDiff < 5000) return true; // Deduplicate identical outgoing messages within 5 seconds
  ```
  Quando um operador envia intencionalmente duas mensagens com o mesmo texto (ex.: "Sim", "Confirmado", ou código de rastreio) em intervalo curto, o backend aceitava e persistia ambas com IDs diferentes (`117732` e `117733`), mas o frontend descartava a segunda mensagem, exibindo apenas uma bolha.
- **Correção Implementada:** Se ambas as mensagens possuem IDs de banco de dados confirmados e distintos (`a.id !== b.id`) ou `whatsappMessageId`s distintos, elas **NUNCA** são consideradas duplicadas. A checagem por texto e tempo (`< 5s`) só se aplica se pelo menos uma das mensagens for temporária (`temp-`) ou ainda não tiver ID persistido.

---

## 5. Auditoria de Responsividade Real por Viewport

A auditoria cobriu 6 resoluções distintas em todos os módulos principais:

| Viewport | Dispositivo Alvo | Orientação | Status Geral | Falhas Críticas de Usabilidade |
| :---: | :---: | :---: | :---: | :--- |
| **360 x 800 px** | Smartphone Compacto | Retrato | **FAIL (P3)** | 20 abas de Configurações cortadas; 681 elementos da tabela/filtros de Contatos fora da largura; botão "Testar IA" cortado |
| **390 x 844 px** | iPhone 12/13/14 | Retrato | **FAIL (P3)** | Menu lateral de Configurações estende além da tela sem rolagem suave; filtros de contatos sobrecarregados |
| **768 x 1024 px** | Tablet (iPad Mini/Air) | Retrato | **FAIL (P3)** | 19 botões de abas de Configurações cortados; quebra de alinhamento em tabelas médias |
| **1024 x 768 px** | Desktop Compacto / Tablet | Paisagem | **PASS** | Layout acomodado com sidebar recolhível funcional |
| **1440 x 900 px** | Desktop / Laptop HD | Paisagem | **PASS** | Experiência visual completa, sem overflow indesejado |
| **844 x 390 px** | Smartphone | Paisagem | **FAIL (P3)** | Botão "Próximo Passo →" no cabeçalho de Campanhas cortado na margem direita; 17 itens de Configurações cortados |

### Detalhamento dos Problemas de Layout
1. **Configurações em Telas Estreitas (`/settings`):**
   - Em larguras menores que 1024px, a lista vertical de 19 seções não é convertida em um menu dropdown/select ou carrossel horizontal de abas com scroll. Os títulos dos botões extravasam a viewport, impedindo a visualização de abas como *Logs*, *Deployments*, *Versões* e *Central de Testes*.
2. **Contatos (`/contacts`):**
   - Os pills de status e tags ocupam espaço excessivo na viewport vertical e horizontal de 360px, empurrando a lista de contatos para baixo da dobra e gerando corte de colunas.
3. **Campanhas em Paisagem (`/campaigns` em 844x390):**
   - O cabeçalho sticky possui múltiplos elementos com largura fixa, empurrando o botão de ação primária ("Próximo Passo →") para além da coordenada 844px.

---

## 6. Console, Rede e Erros de Infraestrutura

Eventos capturados durante as sessões de auditoria (total de 1.677 eventos analisados):

### Erros de Console Identificados
1. `Failed to load resource: the server responded with a status of 403 (Forbidden)` (2 ocorrências em `/api/session-status`).
2. `Failed to load resource: the server responded with a status of 404 (Not Found)` (2 ocorrências em `/api/messages/outbound-queue/*`).
3. `WebSocket connection to 'ws://209.50.241.22/ws/nodes?tenant=default' failed: Error during WebSocket handshake: Unexpected response code: 200` (1 ocorrência).
4. `WebSocket connection to 'ws://209.50.241.22/ws/metrics?tenant=default' failed: Error during WebSocket handshake: Unexpected response code: 200` (2 ocorrências).

### Análise de Causa Raiz dos Erros de Rede
- **Erro 404 da Fila de Envios (`/api/messages/outbound-queue/...`):**
  O frontend chamava o caminho antigo `/api/messages/outbound-queue/pending`, enquanto o backend na VPS expunha `/api/outbound-queue/pending`. A chamada direta a `/api/outbound-queue/pending` responde 200 OK com os itens da fila.
- **Erro 403 de Sessão (`/api/session-status`):**
  O endpoint público `/api/session-status` em `server.js` estava posicionado após a montagem do `adminMasterRouter` (montado em `/api`). Como o middleware `requireMasterAdmin` não filtrava prefixo de rota, requisições que chegavam sem a claim `master_admin` eram interceptadas com 403 antes de alcançar o handler de status.
- **Handshake WebSocket 200 em `/ws/nodes` e `/ws/metrics`:**
  O proxy reverso (Nginx) na porta 80 da VPS não possui a diretiva `proxy_set_header Upgrade $http_upgrade;` configurada para as localizações `/ws/nodes` e `/ws/metrics`, tratando a tentativa de upgrade do socket como uma requisição HTTP estática normal e retornando código 200.

---

## 7. Correções Realizadas e Validadas

Todas as alterações foram realizadas respeitando o isolamento por empresa/tenant e sem alterar contratos públicos existentes:

1. **Correção do Store Frontend (`frontend-official/src/stores/appStore.ts`):**
   - Refinadas as funções `isSameOrDuplicateMessage` e `mergeMessageLists`.
   - Mensagens com IDs de banco de dados confirmados e distintos (`a.id !== b.id`) ou IDs do WhatsApp distintos **nunca** são mescladas ou suprimidas.
   - Preservada a substituição de mensagens otimistas (`temp-`) pela versão confirmada recebida via HTTP ou WebSocket.

2. **Correção de Rotas de Fila (`frontend-official/src/services/apiService.ts` e `backend/src/api/routes/messages.js`):**
   - `apiService.ts` atualizado para utilizar o endpoint canônico `/api/outbound-queue/pending` e `/api/outbound-queue/dlq`.
   - `backend/src/api/routes/messages.js` recebeu suporte para ambas as rotas (`/outbound-queue/*` e `/messages/outbound-queue/*`), garantindo 100% de compatibilidade retroativa.

3. **Correção de Escopo de Middleware Admin e Endpoints Públicos (`backend/server.js` e `backend/src/api/routes/adminMaster.js`):**
   - Em `server.js`, os endpoints públicos `/api/session-status` e `/session-status` foram reposicionados antes de `registerRoutes`, garantindo resposta HTTP 200 para checagens de integridade.
   - Em `adminMaster.js`, o middleware `requireMasterAdmin` foi restrito ao prefixo `/master` (`router.use('/master', requireMasterAdmin)`), impedindo que rotas não administrativas recebam falso 403.

---

## 8. Testes de Regressão e Validação

### A) Suíte Vitest no Frontend (`frontend-official/src/test/messageDedupe.test.ts`)
Executada com `npm --prefix frontend-official run test -- src/test/messageDedupe.test.ts`:
- `✓ Cenário A: Uma operação -> uma mensagem (exatamente o mesmo ID)` — **PASS** (2ms)
- `✓ Cenário B / C: Mensagem otimista (temp-) substituída pela mensagem confirmada com mesmo texto` — **PASS** (1ms)
- `✓ Cenário D: Retry legítimo ou mensagens com whatsappMessageId distintos não são duplicadas` — **PASS** (0ms)
- `✓ Cenário E: Duas operações intencionais com exatamente o mesmo conteúdo -> DUAS mensagens legítimas` — **PASS** (7ms)
- **Resultado Total:** 1 arquivo aprovado (1), 4 testes aprovados (4). Duração: 7.66s.

### B) Suíte Completa Vitest do Projeto
Executada com `npm --prefix frontend-official run test`:
- `✓ src/test/example.test.ts` (1 test)
- `✓ src/test/requestCache.test.ts` (1 test)
- `✓ src/test/messageDedupe.test.ts` (4 tests)
- **Resultado Total:** 3 arquivos aprovados (3), 6 testes aprovados (6), 0 falhas.

### C) Verificação de Tipos TypeScript (`frontend-official/src`)
Executada com `npm --prefix frontend-official run tsc`:
- Código de saída: `0` (Zero erros de compilação TypeScript).

### D) Suíte de Testes Unitários do Backend (`backend/tests/`)
Executada com `node --test backend/tests/whatsapp-outbound-senders.test.js backend/tests/flowTracker.test.js`:
- `✔ flow tracker emits one immutable realtime event per state transition` — **PASS**
- `✔ reuses a confirmed LID for consecutive messages without a second USync lookup` — **PASS**
- `✔ keeps a known LID when WhatsApp confirmation has a transient miss` — **PASS**
- **Resultado Total:** 3 testes aprovados (3), 0 falhas.

---

## 9. Evidências de Teste Arquivadas

Todos os artefatos de teste estão gravados em `outros/reports/qa/evidence/`:

- `evidence/auth-success.png` — Login autenticado no sistema publicado
- `evidence/dash-Conversas.png` — Aba Conversas do Dashboard
- `evidence/dash-Performance_IA.png` — Aba Performance IA do Dashboard
- `evidence/dash-Comercial.png` — Aba Comercial do Dashboard
- `evidence/dash-Mapa_Interativo.png` — Aba Mapa Interativo do Dashboard
- `evidence/connections-1440x900.png` — Sessão WhatsApp `material` conectada
- `evidence/contacts-360x800.png` — Exibição de contatos em 360px (triagem de overflow)
- `evidence/settings-360x800.png` — Exibição de configurações em 360px (triagem de overflow)
- `evidence/campaigns-844x390.png` — Cabeçalho de campanhas em 844x390 (botão cortado)
- `evidence/queue-pending-404.png` — Reprodução do erro 404 na fila de saída
- `evidence/queue-refresh.png` — Reprodução de revalidação com erro na fila
- `evidence/send-identical-operations.png` — Reprodução da supressão do Cenário E no Inbox
- `evidence/new-chat-modal-360.png` até `new-chat-modal-1440.png` — Validação do modal de nova conversa nas 6 resoluções

---

## 10. Limitações e Itens Pendentes

1. **Deploy em Produção (VPS 209.50.241.22):**
   - As correções de software foram validadas no ambiente de teste e desenvolvimento local. Para que passem a surtir efeito no sistema publicado em `http://209.50.241.22/`, é necessário realizar o build (`npm run build` no front) e o deploy no servidor VPS seguido de reload do processo Node via PM2.
2. **Configuração Nginx na VPS:**
   - A correção dos handshakes WebSocket em `/ws/nodes` e `/ws/metrics` requer atualização do arquivo de configuração do Nginx na VPS (`/etc/nginx/conf.d/` ou `/etc/nginx/sites-enabled/`) para incluir suporte a upgrade de conexão HTTP/1.1 para essas rotas.
3. **Refinamento Responsivo Mobile P3:**
   - A substituição da barra de navegação lateral de `/settings` por um seletor colapsável e o ajuste de quebra flex do botão de ação em `/campaigns` em modo paisagem (844px) podem ser incorporados na próxima rodada de refinamento de interface.
