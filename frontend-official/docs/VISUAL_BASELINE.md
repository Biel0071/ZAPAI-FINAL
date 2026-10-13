# Visual Baseline

## Fonte visual oficial

A referência visual oficial do frontend é a UI publicada no Lovable.

Baseline usado nesta fase de sync:
- `swift-wa-assist.lovable.app`

## Rotas comparadas

As referências visuais desta rodada foram comparadas manualmente com screenshots/publicação para:
- `/dashboard`
- `/inbox`
- `/connections`
- `/contacts`
- `/campaigns`

## Regras de sync

Quando houver diferença entre localhost e a UI publicada:
- a UI publicada vence
- o ajuste deve ser absorvido em `frontend-official/`
- não criar fork visual local
- não “reinterpretar” layout
- não manter versão apenas “parecida”

## Ajustes visuais consolidados nesta fase

### Shell
- sidebar com ordem CRM alinhada ao baseline publicado
- remoção de badges visuais locais extras que não existiam na referência
- busca do header reduzida e simplificada para `Buscar`
- topo mantido como shell único

### Dashboard
- inclusão de primeira linha com cards de status operacional inspirados no publicado:
  - fila operacional
  - status do runtime
  - saúde do websocket
- manutenção do restante da página no shell oficial

### Connections
- hero/toolbar ajustados para aproximar da composição publicada
- redução do grid superior para 3 cards
- CTA principal e bloco de sessão ativa aproximados do baseline

### Contacts
- página alinhada visualmente ao baseline de `Leads CRM / Contatos`
- remoção da faixa superior de métricas que não aparecia na referência enviada
- busca/filtros simplificados para a organização publicada
- foco em segmentos e lista principal

### Campaigns
- wizard reestruturado visualmente para aproximar da modal publicada:
  - título principal
  - steps mais próximos do baseline
  - bloco `Definir Público-Alvo`
  - cards `Filtro Atual`, `Importar Lista`, `Por Etiquetas`
  - `Lista de Disparo`
  - CTA `Próximo Passo`

### Inbox
- largura do painel direito ajustada
- remoção de resize manual no painel esquerdo
- tabs do painel lateral aproximadas da referência (`IA`, `Lead`, `Respostas`, `Tags`)
- cabeçalho da conversa mantido no shell oficial sem competir com o topo global

## Guardrails obrigatórios

Sempre validar após mudança visual:
- `npm --prefix frontend-official run build`
- `npm --prefix frontend-official run test`
- `npm --prefix frontend-official run test-ui`
- `npm run restart`

## Sinais de regressão visual

A mudança deve ser revertida ou corrigida se causar:
- sidebar com ordem diferente da publicada
- header duplicado
- espaçamentos claramente divergentes
- cards principais com hierarchy diferente da referência
- clipping no primeiro viewport
- scroll invisível
- diferenças perceptíveis entre localhost e screenshots oficiais

## Auditoria visual contínua

Atualizado em **2026-10-13**. A rodada revisou as 46 rotas e abas canônicas em **tema escuro e claro** e nas larguras **1440, 1024, 768 e 390 px**. As 46 folhas de contato estão em [visual-evidence/after/](visual-evidence/after/); cada uma reúne os oito estados responsivos. O resumo detalhado por rota e largura está em [visual-evidence/after/audit.json](visual-evidence/after/audit.json).

A linha de base anterior tem 41 rotas; a rodada atual acrescenta cinco rotas/casos. As capturas usam APIs vazias e fixtures sintéticas, isoladas de clientes, para atendente/avatar, grafo de evolução e uma conversa de QA. Escritas externas são bloqueadas; a geração de rascunho da Inbox recebe uma resposta sintética sem envio.

### Critérios e cobertura

- **368 estados capturados** (46 rotas × 2 temas × 4 larguras); sem falhas de renderização, imagens, chamadas interceptadas ou rolagem horizontal nas capturas finais.
- **35 arquivos de teste e 212 testes passaram**, junto com typecheck e build de produção. A auditoria Playwright passou para as 46 rotas; `/` foi recapturada depois de confirmar seu redirecionamento para `/dashboard`.
- Todas as folhas foram revisadas visualmente. O estado registrado é o que a captura realmente cobre: vazio/API indisponível em geral; grafo de memória com fixture de QA e erro; Avatar Studio com fixture de QA; conversa da Inbox com fixture de QA.
- Navegação por teclado verificada no catálogo do Avatar Studio (setas entre abas) e na seleção de nó do grafo (Enter). Isso não substitui uma auditoria completa de acessibilidade de cada formulário.
- As telas sem fixture de dados reais permanecem documentadas como vazias; as capturas não representam dados de produção.
- Estados aceitos: **Não auditada**, **Aberta**, **Em correção**, **Corrigida** e **Verificada**. Verificada vale para o tema, largura e estado listados; não implica validação de integração em produção.

### Situação da publicação

O commit da auditoria e das correções (`VIS-003`, `DASH-001`, `COPILOT-001`) foi enviado ao branch `codex/professional-inbox-ai` e publicado diretamente na VPS de produção (`209.50.241.22` · `/opt/zapai` → `/etc/icontainer/apps/openresty/openresty/www/zapai/`, PM2 `zapflow-api`). Todas as rotas canônicas foram validadas em produção nas resoluções desktop (`1440×900`), notebook (`1366×768`) e mobile (`390×844`).

### Inventário de rotas e abas

| Grupo | Tela/estado | Rota canônica | Estado visual | Bugs abertos | Evidência |
|---|---|---|---|---:|---|
| Acesso | Redirecionamento autenticado | / → /dashboard | Verificada | 0 | [captura](visual-evidence/after/root-redirect.webp) |
| Acesso | Login sem sessão | /login | Verificada | 0 | [captura](visual-evidence/after/login.webp) |
| Diário | Dashboard · visão geral | /dashboard | Verificada · API vazia | 0 | [captura](visual-evidence/after/dashboard-overview.webp) |
| Diário | Dashboard · mapa | /dashboard?tab=map | Verificada · API vazia | 0 | [captura](visual-evidence/after/dashboard-map.webp) |
| Diário | Inbox · lista vazia | /inbox | Verificada · API vazia | 0 | [captura](visual-evidence/after/inbox.webp) |
| Diário | Inbox · conversa QA selecionada | /inbox | Verificada · fixture QA e produção | 0 | [captura](visual-evidence/after/inbox-conversation.webp) |
| Operação | Conexões | /connections | Verificada · API vazia | 0 | [captura](visual-evidence/after/connections.webp) |
| Diário | Atendentes · seletor e configuração | /attendants | Verificada · API vazia | 0 | [captura](visual-evidence/after/attendants.webp) |
| Diário | Atendentes · Avatar Studio | /attendants · modal | Verificada · 30 sprites reconstruídos inteiros | 0 | [captura](visual-evidence/after/attendants-avatar-editor.webp) |
| Diário | Atendentes · Copiloto ZAI | /attendants?tab=copilot | Verificada · API vazia | 0 | [captura](visual-evidence/after/attendants-copilot.webp) |
| Diário | Atendentes · Memória | /attendants?tab=memory | Verificada · API vazia | 0 | [captura](visual-evidence/after/attendants-memory.webp) |
| Diário | Atendentes · Evolução vazia | /attendants?tab=evolution | Verificada · sem atendente/dados | 0 | [captura](visual-evidence/after/attendants-evolution.webp) |
| Diário | Atendentes · Evolução com grafo QA | /attendants?tab=evolution | Verificada · fixture QA e teclado | 0 | [captura](visual-evidence/after/attendants-evolution-data.webp) |
| Diário | Atendentes · erro da API de evolução | /attendants?tab=evolution | Verificada · erro simulado | 0 | [captura](visual-evidence/after/attendants-evolution-error.webp) |
| Operação | Contatos | /contacts | Verificada · API vazia | 0 | [captura](visual-evidence/after/contacts.webp) |
| IA | Atendentes | /ai?tab=agent | Verificada · API vazia | 0 | [captura](visual-evidence/after/ai-agents.webp) |
| IA | Fluxos e conhecimento | /ai?tab=flows | Verificada · API vazia; playbooks sem registros | 0 | [captura](visual-evidence/after/ai-flows.webp) |
| IA | Operação | /ai?tab=operations | Verificada · API vazia | 0 | [captura](visual-evidence/after/ai-operations.webp) |
| IA | Evolução | /ai?tab=evolution | Verificada · API vazia | 0 | [captura](visual-evidence/after/ai-evolution.webp) |
| Operação | Campanhas · novo disparo | /campaigns · aba Novo Disparo | Verificada · API vazia | 0 | [captura](visual-evidence/after/campaigns-compose.webp) |
| Operação | Campanhas · histórico | /campaigns · aba Histórico | Verificada · API vazia | 0 | [captura](visual-evidence/after/campaigns-history.webp) |
| Operação | Campanhas · análise IA | /campaigns · aba Análise IA | Verificada · API vazia | 0 | [captura](visual-evidence/after/campaigns-analysis.webp) |
| Operação | Memória · visão geral | /memory | Verificada · API vazia | 0 | [captura](visual-evidence/after/memory-overview.webp) |
| Operação | Memória · grafo | /memory · aba Grafo Ativo de Memória | Verificada · API vazia | 0 | [captura](visual-evidence/after/memory-graph.webp) |
| Operação | Memória · evolução | /memory · aba Evolução do Atendente | Verificada · API vazia | 0 | [captura](visual-evidence/after/memory-evolution.webp) |
| Operação | Memória · contatos | /memory · aba Registros de Contatos | Verificada · API vazia | 0 | [captura](visual-evidence/after/memory-contacts.webp) |
| Configuração | Perfil | /settings?tab=perfil | Verificada · API vazia | 0 | [captura](visual-evidence/after/settings-perfil.webp) |
| Configuração | Empresa | /settings?tab=empresa | Verificada · indisponível informado | 0 | [captura](visual-evidence/after/settings-empresa.webp) |
| Configuração | Equipe | /settings?tab=equipe | Verificada · indisponível informado | 0 | [captura](visual-evidence/after/settings-equipe.webp) |
| Configuração | Notificações | /settings?tab=notificacoes | Verificada · indisponível informado | 0 | [captura](visual-evidence/after/settings-notificacoes.webp) |
| Configuração | Segurança | /settings?tab=seguranca | Verificada · indisponível informado | 0 | [captura](visual-evidence/after/settings-seguranca.webp) |
| Configuração | Faturamento | /settings?tab=faturamento | Verificada · indisponível informado | 0 | [captura](visual-evidence/after/settings-faturamento.webp) |
| Configuração | Aparência | /settings?tab=aparencia | Verificada | 0 | [captura](visual-evidence/after/settings-aparencia.webp) |
| Configuração | Idioma | /settings?tab=idioma | Verificada | 0 | [captura](visual-evidence/after/settings-idioma.webp) |
| Configuração | API Keys | /settings?tab=api-keys | Verificada · indisponível informado | 0 | [captura](visual-evidence/after/settings-api-keys.webp) |
| Configuração | Webhooks | /settings?tab=webhooks | Verificada · indisponível informado | 0 | [captura](visual-evidence/after/settings-webhooks.webp) |
| Configuração | Dados | /settings?tab=dados | Verificada · indisponível informado | 0 | [captura](visual-evidence/after/settings-dados.webp) |
| Administração | Fila | /settings?tab=queue | Verificada · API vazia | 0 | [captura](visual-evidence/after/admin-queue.webp) |
| Administração | Cluster/nós | /settings?tab=nodes | Verificada · API vazia | 0 | [captura](visual-evidence/after/admin-nodes.webp) |
| Administração | Usuários | /settings?tab=users | Verificada · API vazia | 0 | [captura](visual-evidence/after/admin-users.webp) |
| Administração | Deployments | /settings?tab=deployments | Verificada · API vazia | 0 | [captura](visual-evidence/after/admin-deployments.webp) |
| Administração | Versões | /settings?tab=versions | Verificada · API vazia | 0 | [captura](visual-evidence/after/admin-versions.webp) |
| Administração | Logs | /settings?tab=logs | Verificada · API vazia | 0 | [captura](visual-evidence/after/admin-logs.webp) |
| Administração | Testes | /settings?tab=tests | Verificada · métricas ausentes como “—” | 0 | [captura](visual-evidence/after/admin-tests.webp) |
| Administração | Diagnóstico | /settings?tab=diagnostics | Verificada · API vazia | 0 | [captura](visual-evidence/after/admin-diagnostics.webp) |
| Administração | Detalhes do nó QA | /nodes/visual-audit-fixture | Verificada · fixture QA | 0 | [captura](visual-evidence/after/admin-node-details.webp) |

Redirecionamentos legados agrupados pela tela de destino: /atendentes → /attendants; /assistant e /assistente-zai → /attendants?tab=copilot; /stores e /lojas → configuração comercial em Atendentes; /operations, /flows, /evolution, /evolucao e /automation → abas de /ai; /analytics → /dashboard?tab=analytics; /integrations → /connections; rotas de fila, usuários, cluster, deployments, versões, logs, testes e /system/* → configurações/diagnóstico.

### Registro de bugs e pendências

| ID | Tela | Severidade | Passos para reproduzir | Esperado | Observado | Evidência | Estado |
|---|---|---:|---|---|---|---|---|
| VIS-001 | Avatar Studio | P1 | Abrir o editor do avatar no perfil selecionado. | Ilustração detalhada visível como prévia principal, com salvar acessível. | A versão anterior escondia o sprite e mostrava apenas a silhueta SVG. O catálogo detalhado agora é a prévia padrão; teclado e layout móvel foram revisados. | [1440 px](visual-evidence/after/attendants-avatar-editor-dark-1440.jpg) · [390 px](visual-evidence/after/attendants-avatar-editor-dark-390.jpg) | Verificada |
| VIS-002 | Memória & Evolução | P1 | Abrir o grafo em largura de tablet e selecionar um nó. | Categorias, grafo e detalhes legíveis, sem cortes; painel rolável em celular. | Colunas comprimidas em 1024 px; pilha responsiva, canvas medido pelo elemento e nós reposicionados. Quatro larguras, dois temas, foram revisadas. | [grafo 1024 px](visual-evidence/after/attendants-evolution-data-dark-1024.jpg) · [detalhes 390 px](visual-evidence/after/attendants-evolution-data-details-dark-390.jpg) | Verificada |
| DATA-001 | Administração · Testes | P1 | Abrir Configurações → Testes antes de executar uma suíte. | Indicadores ausentes como “—”; zero apenas depois de resposta real que confirme zero. | O painel apresentava 100% e 0 ms sem execução. Agora exibe “—”; o teste visual bloqueia regressão. | [painel](visual-evidence/after/admin-tests.webp) | Verificada |
| DATA-002 | IA · Playbooks | P2 | Abrir IA → Fluxos sem registros de playbook na API. | Mostrar apenas itens retornados pela API ou estado vazio; ações não devem simular persistência local. | Havia três roteiros locais marcados ativos e alternáveis sem persistência. A lista duplicada foi removida; o gerenciador canônico agora informa quando não há registros. | [estado vazio](visual-evidence/after/ai-flows.webp) | Verificada |
| VIS-003 | Avatar Studio · catálogo completo (`r1..r3`, `c1..c10`) | P1 | Abrir Estúdio Avançado → Cabelo/Roupas → escolher Cabelo 03..10 ou modelos da linha 2. | Sprite detalhada inteira, centralizada, sem sapatos da linha superior nem furos transparentes em roupas/cabelos escuros. | A folha original `1023×681` (3×10) havia sido fatiada em 11 colunas (`93×227`) com threshold global de RGB, cortando `c3..c10` ao meio e vazando pixels pretos internos. As 33 peças brutas foram remontadas e re-fatiadas com seam carving 2D + flood-fill externo 4-conectado nos 30 modelos. | [Cabelo 03](visual-evidence/after/attendants-avatar-variant-hair03-dark-1440.jpg) · [claro](visual-evidence/after/attendants-avatar-variant-hair03-light-1440.jpg) · [folha](visual-evidence/after/attendants-avatar-editor.webp) | Verificada |
| DASH-001 | Dashboard · filtro temporal (`Hoje` / `7d` / `30d`) | P2 | Selecionar filtro `Hoje` no Dashboard quando conversas antigas sofreram atualização em massa de `updatedAt`. | Filtrar pela atividade real da conversa (`lastMessageAt \|\| updatedAt`). | O filtro usava apenas `conversation.updatedAt`, incluindo conversas sem mensagens no dia. Corrigido em `Dashboard.tsx` com teste unitário em `dashboardTwoHubs.test.tsx`. | [Dashboard](visual-evidence/after/dashboard-overview.webp) | Verificada |
| COPILOT-001 | Assistente ZAI flutuante · navegação e mobile | P2 | Abrir modal flutuante do Assistente ZAI, pedir ação com link (ex.: `/inbox`) e clicar no link. | Modal fecha ao navegar para a rota de destino e respeita largura `390px` sem overflow. | O modal permanecia aberto sobre a nova rota; adicionado callback `onNavigate={() => setOpen(false)}` e contenção `w-[calc(100vw-1rem)] overflow-x-hidden`. | [Copiloto](visual-evidence/after/attendants-copilot.webp) | Verificada |
| SYNC-001 | Inbox · sincronização em tempo real | P1 | Manter uma conversa aberta e receber/sincronizar eventos em tempo real. | Lista e conversa ativa atualizam sem recarregar. | Sincronização de `RuntimeProvider` e `appStore` verificada por testes automatizados (`runtimeProviderRealtimeMessage.test.tsx`, `inboxRealtimeSync.test.ts`) e validada no ambiente publicado. | [Inbox QA](visual-evidence/after/inbox-conversation.webp) | Verificada |

Todos os bugs registrados na auditoria visual e funcional encontram-se **Verificados**.

### Como repetir a auditoria

1. Gere a linha de base com npm --prefix frontend-official run test-ui -- tests/ui/visual-audit.spec.ts.
2. Para capturas pós-correção, defina a variável VISUAL_AUDIT_SET como after e execute o mesmo comando.
3. Para executar uma rota, defina VISUAL_AUDIT_ROUTE_FILTER com o ID; IDs e medidas aparecem em audit.json.
4. Revise a folha de contato e os estados afetados; anote ID, reprodução, esperado/observado, severidade e evidência.
5. Só marque como Verificada após capturar e revisar todos os temas, larguras e estados afetados. Redirecionamentos usam a tela canônica.
