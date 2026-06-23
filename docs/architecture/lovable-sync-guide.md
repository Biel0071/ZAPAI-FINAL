# Guia de Sincronização do Lovable: Evitando Divergências no Localhost

Este guia detalha o fluxo e as diretrizes necessárias para sincronizar novas versões do frontend Lovable no ambiente de desenvolvimento localhost do ZAPFLOW AI / ZAPAI de maneira automatizada e limpa.

---

## 🎯 Objetivo de Alinhamento
Garantir que o frontend rodando localmente na porta `8080` seja **visualmente idêntico** à versão publicada em `https://swift-wa-assist.lovable.app/`, mas consumindo a lógica de tempo real e os bancos de dados reais.

---

## 🔄 Fluxo de Trabalho de Sincronização (Lovable Sync)

Para puxar novas atualizações visuais de forma limpa, siga estas etapas:

### 1. Preparação da Exportação
Ao exportar os novos arquivos do painel do Lovable, o pacote incluirá arquivos CSS, componentes React, ativos na pasta `public/` e views sob `src/`.

### 2. Substituição Segura de Assets e CSS
1. **Assets e Imagens**: Copie as novas imagens e fontes do Lovable para `frontend-official/public/`.
2. **CSS Global**: Se o Lovable alterou variáveis de cores, animações Tailwind ou estilos de reset:
   - Abra o novo `index.css` fornecido.
   - Atualize apenas as variáveis e tokens sob `:root` ou `@layer utilities` no nosso `frontend-official/src/index.css`.
   - **Nota**: Evite substituir o `index.css` inteiro caso contenha correções locais para bibliotecas de terceiros (como Leaflet ou react-window).

### 3. Distribuição de Views vs Controladores
* **Views Puras**: Copie as novas páginas de UI fornecidas do Lovable diretamente para a pasta de renderização dedicada:
  `frontend-official/src/lovable/pages/`
  *(Exemplo: copie `DashboardView.tsx` para substituir o arquivo correspondente).*
* **Páginas Ativas (Controllers)**: Mantenha as páginas originais localizadas em `frontend-official/src/pages/` (como `Dashboard.tsx`, `Inbox.tsx`, `Connections.tsx`). Elas atuam como os controladores que:
  - Leem os dados da store Zustand.
  - Chamam os adapters para gerar os ViewModels formatados.
  - Repassam as variáveis para as Views do Lovable.
  - Gerenciam os callbacks das Views para invocar as APIs HTTP reais.

---

## 🚦 Tabela de Conformidade Arquitetural

| Pasta no Workspace | Papel no Projeto | Ação na Sincronização |
| :--- | :--- | :--- |
| `src/lovable/pages/` | Views Visuais de Páginas | **Substituir integralmente** pela nova versão do Lovable. |
| `src/lovable/components/` | Componentes Visuais Puros | **Substituir integralmente** pela nova versão do Lovable. |
| `src/lovable/layout/` | Shell Visual da Aplicação | **Substituir integralmente** pela nova versão do Lovable. |
| `src/adapters/lovable/` | Adapters de Dados Reais | **Preservar / Estender** para mapear novas variáveis se necessário. |
| `src/pages/` | Controladores de Páginas | **Preservar** (contém lógica de cliques, rotas e APIs). |
| `src/stores/` | Zustand Store | **Preservar** (Single Source of Truth). |
| `src/runtime/` | Websocket e Health checks | **Preservar** (infraestrutura de comunicação de rede). |
