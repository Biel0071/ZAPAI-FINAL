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
- **35 arquivos de teste e 210 testes passaram**, junto com typecheck e build de produção. A auditoria Playwright passou para as 46 rotas; `/` foi recapturada depois de confirmar seu redirecionamento para `/dashboard`.
- Todas as folhas foram revisadas visualmente. O estado registrado é o que a captura realmente cobre: vazio/API indisponível em geral; grafo de memória com fixture de QA e erro; Avatar Studio com fixture de QA; conversa da Inbox com fixture de QA.
- Navegação por teclado verificada no catálogo do Avatar Studio (setas entre abas) e na seleção de nó do grafo (Enter). Isso não substitui uma auditoria completa de acessibilidade de cada formulário.
- As telas sem fixture de dados reais permanecem documentadas como vazias; as capturas não representam dados de produção.
- Estados aceitos: **Não auditada**, **Aberta**, **Em correção**, **Corrigida** e **Verificada**. Verificada vale para o tema, largura e estado listados; não implica validação de integração em produção.

### Inventário de rotas e abas

| Grupo | Tela/estado | Rota canônica | Estado visual | Bugs abertos | Evidência |
|---|---|---|---|---:|---|
| Acesso | Redirecionamento autenticado | / → /dashboard | Verificada | 0 | [captura](visual-evidence/after/root-redirect.webp) |
| Acesso | Login sem sessão | /login | Verificada | 0 | [captura](visual-evidence/after/login.webp) |
| Diário | Dashboard · visão geral | /dashboard | Verificada · API vazia | 0 | [captura](visual-evidence/after/dashboard-overview.webp) |
| Diário | Dashboard · mapa | /dashboard?tab=map | Verificada · API vazia | 0 | [captura](visual-evidence/after/dashboard-map.webp) |
| Diário | Inbox · lista vazia | /inbox | Verificada · API vazia | 1 | [captura](visual-evidence/after/inbox.webp) |
| Diário | Inbox · conversa QA selecionada | /inbox | Verificada · fixture QA; E2E real pendente | 1 | [captura](visual-evidence/after/inbox-conversation.webp) |
| Operação | Conexões | /connections | Verificada · API vazia | 0 | [captura](visual-evidence/after/connections.webp) |
| Diário | Atendentes · seletor e configuração | /attendants | Verificada · API vazia | 0 | [captura](visual-evidence/after/attendants.webp) |
| Diário | Atendentes · Avatar Studio | /attendants · modal | Aberta · sprites 03/04 cortadas na origem | 1 | [captura](visual-evidence/after/attendants-avatar-editor.webp) |
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
| VIS-003 | Avatar Studio · cabelos 03/04 | P2 | Abrir Estúdio Avançado → Cabelo → escolher Cabelo 03 ou 04. | Sprite detalhada inteira e centralizada. | Os arquivos-fonte dessas variações já têm rosto/corpo cortados; focalização não recupera pixels inexistentes. A prévia por camadas permanece completa, mas não substitui a arte detalhada desejada. | [Cabelo 03](visual-evidence/after/attendants-avatar-variant-hair03-dark-1440.jpg) · [camadas](visual-evidence/after/attendants-avatar-variant-hair03-layers-dark-1440.jpg) | Aberta |
| SYNC-001 | Inbox · sincronização em tempo real | P1 | Manter uma conversa de QA aberta e receber uma mensagem inbound pelo WhatsApp vinculado. | Lista e conversa ativa atualizam sem recarregar. | A regressão local do RuntimeProvider/estado compartilhado recebe o evento sintético e atualiza lista e mensagens; não foi produzido evento WhatsApp real na VPS para confirmar o caminho ponta a ponta. | [Inbox QA](visual-evidence/after/inbox-conversation.webp) | Aberta · validação publicada pendente |

Os dois bugs ainda abertos são **VIS-003** e **SYNC-001**. A captura da variação c3 foi preservada para orientar substituição dos assets. A integração real da Inbox requer receber uma mensagem em número de QA na versão publicada; não use conversa de cliente para esse teste.

### Como repetir a auditoria

1. Gere a linha de base com npm --prefix frontend-official run test-ui -- tests/ui/visual-audit.spec.ts.
2. Para capturas pós-correção, defina a variável VISUAL_AUDIT_SET como after e execute o mesmo comando.
3. Para executar uma rota, defina VISUAL_AUDIT_ROUTE_FILTER com o ID; IDs e medidas aparecem em audit.json.
4. Revise a folha de contato e os estados afetados; anote ID, reprodução, esperado/observado, severidade e evidência.
5. Só marque como Verificada após capturar e revisar todos os temas, larguras e estados afetados. Redirecionamentos usam a tela canônica.
