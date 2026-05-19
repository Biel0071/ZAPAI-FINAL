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
