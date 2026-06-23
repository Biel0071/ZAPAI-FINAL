# Guia de Atualização: Importando Alterações do Lovable sem Quebrar o Backend

Este guia fornece o passo a passo seguro para integrar novas exportações visuais do Lovable no ZAPFLOW AI / ZAPAI consolidado, preservando a lógica de tempo real e a integridade do backend.

---

## 🛠️ Fluxo de Trabalho de Atualização

Sempre que novas telas, estilos ou alterações de design forem criados e exportados do Lovable:

### Passo 1: Backup e Isolamento
Antes de copiar os arquivos para o repositório local, garanta que suas alterações locais estão comitadas no Git ou faça um backup rápido das pastas de adapters e stores:
- `src/adapters/lovable/`
- `src/stores/`
- `src/pages/`

### Passo 2: Copiar os Arquivos do Lovable
Substitua ou adicione os novos arquivos exportados do Lovable diretamente na pasta de visualização dedicada:
- **Destino Visual**: `src/lovable/`
  - Substitua a pasta inteira ou os arquivos específicos sob `src/lovable/pages/`, `src/lovable/components/` e `src/lovable/layout/`.
  - **Atenção**: Nunca modifique ou adicione lógica de requisição nestes arquivos. Eles devem ser mantidos como views puras de renderização.

### Passo 3: Atualizar os Adapters
Se o Lovable adicionou novos cards de métricas, novos gráficos, ou novos campos visuais em alguma tela:
1. Abra o respectivo adapter em `src/adapters/lovable/` (ex: `dashboardAdapter.ts` ou `analyticsAdapter.ts`).
2. Adicione os novos campos à assinatura do `ViewModel` esperado pela View do Lovable.
3. Obtenha esses dados reais da store global do Zustand (`useAppStore`) e mapeie-os para o `ViewModel` de forma dinâmica.

### Passo 4: Atualizar os Controladores de Páginas
Se uma nova View do Lovable foi importada e ela possui eventos/callbacks (ex: cliques em botões, abas, filtros):
1. Abra o arquivo controlador sob `src/pages/` (ex: `src/pages/Dashboard.tsx` ou `src/pages/Inbox.tsx`).
2. Mapeie os callbacks da View para disparar chamadas do `apiService` real ou para atualizar a store Zustand global.
3. Garanta que o controlador leia as variáveis reativas da store do Zustand e as envie atualizadas para a View por meio do adapter.

### Passo 5: Executar Testes de Validação
Após importar e re-vincular os componentes, execute a suíte de verificação integrada para garantir a compilação:
```bash
# Executa a compilação do TypeScript e empacotamento do Vite
npm run build

# Executa testes unitários de estabilidade
npm run test
```

---

## 🚫 Práticas Proibidas (Quebras Frequentes)

* **NÃO** insira chamadas de `apiService.sendMessage`, `fetch`, `axios` ou `io()` de WebSockets dentro da pasta `src/lovable/*`.
* **NÃO** instancie novos `Zustand store` locais nas views do Lovable. Todo estado deve residir na store unificada `src/stores/appStore.ts`.
* **NÃO** modifique os estilos de reset ou o `index.css` de forma que afete o design master fornecido pelo Lovable published.
* **NÃO** duplique os arquivos controladores (como criar `DashboardLegacy.tsx` coexistindo com `Dashboard.tsx`). Remova códigos mortos.
