# Fluxo do Runtime: WebSocket, Reconnect e Hidratação em Tempo Real

Este documento detalha o ciclo de vida das conexões WebSocket (Socket.io) e REST no ZAPFLOW AI / ZAPAI consolidado, apresentando o relatório do teste de estresse contra falhas de rede, reconexão e recomposição de estado.

---

## 🔄 Fluxo do Ciclo de Vida do WebSocket

```
 ┌───────────────┐
 │ Inicialização │
 └───────┬───────┘
         │ (connectInboxSocket)
 ┌───────▼───────┐
 │  Conectando   ├───────────────────────────────┐
 └───────┬───────┘                               │ (Falha)
         │ (onSocketConnected)                   │
 ┌───────▼───────┐                       ┌───────▼───────┐
 │    Online     │                       │ Reconnecting  │
 └───────┬───────┘                       └───────▲───────┘
         │ (onSocketDisconnected)                │ (Tentativa < 30s)
 ┌───────▼───────┐                               │
 │ Desconectado  ├───────────────────────────────┘
 └───────┬───────┘
         │ (Tempo offline > 30s)
 ┌───────▼───────┐
 │    Offline    │
 └───────────────┘
```

### 1. Inicialização e Conexão Centralizada
- No boot da aplicação, o [RuntimeProvider.tsx](file:///c:/projetos/ZAPAI-FINAL/frontend-official/src/providers/RuntimeProvider.tsx) invoca `connectInboxSocket` passando a URL resolvida de `API_ORIGIN`.
- Uma única instância do Socket.io Client é criada (`ensureSharedSocket()`).
- O callback `onSocketConnected` é disparado:
  - O status `runtimeStatus` e `websocketHealth` na store Zustand (`useAppStore`) são definidos como `"online"`.
  - O snapshot de diagnóstico é persistido localmente (`persistRuntimeCoherenceSnapshot`).

### 2. Reconexão Controlada (Reconnection Flow)
- Ao ocorrer uma desconexão (ex: queda de internet ou backend reiniciando):
  - O callback `onSocketDisconnected` calcula o tempo transcorrido offline.
  - Se o tempo for inferior a 30 segundos, o status no Zustand é definido como `"reconnecting"`.
  - Se o tempo exceder 30 segundos, o status vira `"offline"`, alterando o cabeçalho de status da aplicação.
  - O `socket.io-client` nativo tenta reconectar silenciosamente em background seguindo recuo exponencial.

### 3. Re-hidratação de Dados (Hydration Flow)
- Quando a conexão WebSocket é restabelecida com sucesso:
  - O status na store Zustand volta instantaneamente para `"online"`.
  - O `RuntimeProvider` aguarda um debounce de 3 segundos (`debouncedRefresh()`) para evitar inundar o backend com requisições HTTP e executa o `loadFromApi()`.
  - O `loadFromApi` recarrega em lote as sessões do WhatsApp, a contagem de mensagens do Inbox e as métricas de tráfego, garantindo que qualquer perda de dados que ocorreu durante o período offline seja recomposta reativamente.

---

## ⚡ Relatório do Teste de Estresse do Runtime

Submetemos o runtime do ZAPFLOW AI a testes de estresse simulando condições severas de instabilidade de rede e concorrência:

### 1. Reinicialização do Backend (`backend restart`)
- **Simulação**: O servidor do Express na porta `4025` foi derrubado e reiniciado enquanto o frontend permanecia aberto.
- **Resultado**:
  - O frontend detectou a desconexão no mesmo instante. O status do WebSocket na store Zustand mudou para `"reconnecting"` (indicado pela cor amarela pulsante no cabeçalho).
  - O hook `useApiRuntimeStatus` mudou a integridade da API para `"RECONNECTING"` e depois `"OFFLINE"`.
  - No segundo em que o backend foi reativado, o socket reconectou com sucesso, as ações do Zustand mudaram o cabeçalho para **Online** (cor verde estável) e a hidratação (`loadFromApi()`) foi executada em background sem travar a interface e sem duplicar listeners.

### 2. Alternância de Abas (`tab restore / visibilitychange`)
- **Simulação**: Deixamos o frontend em uma aba oculta por 2 minutos enquanto enviamos mensagens na base, e depois retornamos a ela.
- **Resultado**:
  - O listener de `visibilitychange` detectou a volta à aba ativa.
  - O `RuntimeProvider` disparou imediatamente a hidratação silenciosa `loadFromApi()`, sincronizando as novas conversas e métricas na store global instantaneamente, prevenindo dados obsoletos na tela de Dashboard e Inbox.

### 3. Múltiplas Conexões /QRCode Refresh
- **Simulação**: Criamos múltiplas sessões do WhatsApp em paralelo no Connections e disparamos requisições de QRCode concorrentes.
- **Resultado**:
  - A store do Zustand organizou cada QRCode associando-o ao ID de sessão correspondente.
  - O recebimento dos QRCodes via WebSocket ocorreu sem misturar imagens entre as instâncias e a exclusão/reconexão de sessões atualizou a listagem de forma totalmente reativa sem necessidade de recarga da página.

### 4. Múltiplas Mensagens Simultâneas (Deduplicação de IDs)
- **Simulação**: Enviamos dezenas de mensagens simultâneas na Inbox e simulamos atrasos no retorno do socket para induzir race conditions.
- **Resultado**:
  - As mensagens foram renderizadas instantaneamente na interface com status de pendente usando IDs temporários `"temp-"`.
  - Assim que a resposta HTTP de sucesso ou o evento `onNewMessage` do WebSocket chegou, a action `addMessage` executou a correspondência de IDs e substituiu os itens temporários pelas mensagens consolidadas de forma limpa e síncrona.
  - Não ocorreram mensagens duplicadas na interface graças à deduplicação por chave (`messagesByConversationId`) e ID na store Zustand.
  - Nenhum vazamento de memória ou travamento de UI foi detectado. A renderização virtualizada com `react-window` garantiu rolagem suave e uso mínimo de memória.
