# Checklist do Teste Realtime de WhatsApp (Manual)

Siga este passo-a-passo estruturado para homologar a comunicação em tempo real entre o Baileys (backend) e o Zustand/UI (frontend) no seu ambiente local.

---

## Pré-requisitos
1. [ ] A stack do Zapflow está rodando (`npm run dev:clean` ou `node scripts/dev/start.js`).
2. [ ] Pelo menos uma sessão do WhatsApp está conectada (verifique em `http://localhost:8080/connections`).
3. [ ] Você tem acesso a um segundo celular/número de WhatsApp para enviar mensagens de teste ao número conectado no Zapflow.

---

## Roteiro de Teste Realtime

### Passo 1: Validação do Pareamento (Connections)
- [ ] Abra a página **Conexões** (`/connections`).
- [ ] Verifique se o status do card da sessão está marcado como **🟢 Conectado**.
- [ ] O badge no canto superior direito deve refletir o mesmo status (Baileys conectado).

### Passo 2: Recebimento de Mensagem (Inbound Realtime)
- [ ] Com a aba do **Inbox** aberta (`/inbox`), use o segundo aparelho de WhatsApp para enviar uma mensagem de texto (ex: `"Olá Zapflow!"`) para o número da sua sessão ativa.
- [ ] **Validar:**
  - [ ] A conversa com o novo contato ou contato existente deve subir para o topo da lista de conversas reativamente.
  - [ ] O balão de notificação (badge de não lidas) deve subir para `1` na lista de conversas.
  - [ ] Se você estiver em outra conversa, a contagem não lida do contato que enviou a mensagem deve incrementar.
  - [ ] O som ou notificação toast deve aparecer informando a nova mensagem.

### Passo 3: Sincronização do Estado de Não Lida (Unread State)
- [ ] Clique sobre a conversa que acabou de receber a mensagem.
- [ ] **Validar:**
  - [ ] A conversa deve abrir na tela central carregando todo o histórico.
  - [ ] O contador de não lidas (badge de unread) na lista lateral deve zerar **imediatamente**.
  - [ ] O contador global de mensagens não lidas no cabeçalho ou menu lateral também deve atualizar de forma sincronizada na store do Zustand.

### Passo 4: Envio de Mensagem (Outbound Realtime)
- [ ] No painel do chat central, digite uma resposta (ex: `"Resposta de teste operacional local"`) e clique no botão **Enviar** (ícone de avião).
- [ ] **Validar:**
  - [ ] A mensagem entra instantaneamente na tela com o status `sending` (enviando) ou com um ícone de relógio/check simples.
  - [ ] Em segundos, ela deve ser entregue e o status deve atualizar para o check duplo (entregue/lida) reativamente a partir dos eventos do WebSocket do backend.
  - [ ] Verifique no celular do segundo aparelho se a resposta chegou corretamente.

### Passo 5: Teste de Mídia (Imagens e Arquivos)
- [ ] Use o segundo celular para enviar uma foto ou imagem para o WhatsApp do Zapflow.
- [ ] **Validar:**
  - [ ] A imagem aparece no chat e carrega o preview na bolha da mensagem.
  - [ ] Clique na imagem para abrir a modal de visualização em tela cheia (preview).
  - [ ] A modal deve abrir com a imagem ampliada e fechar corretamente ao clicar fora.

---

Se todos os passos passarem com check (✅), a integração de tempo real do WhatsApp está 100% estável e pronta para deploy!
