# ZAI Communication Engine — Protocol Capabilities & Commerce Specs
**Documento de Engenharia: FASE 1 — Inteligência de Protocolos e Capacidades Comerciais**
*Data: 30 de Outubro de 2026 | Ecossistema: Fênix OS + ZAI + ZAPFLOW*

---

## 1. Classificação Rigorosa de Capacidades

O ZAI Communication Engine estabelece uma taxonomia estrita para cada capacidade operacional:

1. **`CAPACIDADE DOCUMENTADA`**: Prevista na especificação da Meta ou biblioteca, mas ainda não mapeada no ecossistema local.
2. **`CAPACIDADE IDENTIFICADA`**: Código ou endpoint existe, mas depende de runtime ou credencial não validada em execução real.
3. **`CAPACIDADE IMPLEMENTADA`**: Código completo, compilando e estruturado com classes e rotas.
4. **`CAPACIDADE TESTADA`**: Coberta por suíte automatizada unitária ou de integração.
5. **`CAPACIDADE CONFIRMADA EM PRODUÇÃO`**: Executada com evidência em tráfego real de rede ou dispositivo físico.

---

## 2. Matriz de Auditoria de Capacidades do ZAI Engine

| Operação Comercial / Protocolo | Baileys Adapter | WhatsApp Web Bridge | Cloud API Adapter | Status ZAI Atual |
| :--- | :--- | :--- | :--- | :--- |
| **Envio de Texto (`SEND_TEXT`)** | Suportado nativo | Suportado via DOM/Store | Suportado via Graph REST | `CAPACIDADE CONFIRMADA EM PRODUÇÃO` |
| **Envio de Mídia (`SEND_MEDIA`)** | Suportado (Audio/Img/Doc) | Suportado via DOM | Suportado via Media Upload | `CAPACIDADE CONFIRMADA EM PRODUÇÃO` |
| **Envio de Produto Nativo (`SEND_PRODUCT`)** | Suportado via `ProductMessage` | Suportado via Store.Product | Suportado via Interactive Catalog | `CAPACIDADE CONFIRMADA EM PRODUÇÃO` |
| **Sincronização de Catálogo (`GET_CATALOG`)** | Suportado via DB Cache + IQ | Suportado via WPP.catalog | Suportado via Commerce API | `CAPACIDADE CONFIRMADA EM PRODUÇÃO` |
| **Recebimento de Pedido de Carrinho (`RECEIVE_ORDER`)** | Suportado via `orderMessage` | Suportado via DOM Drawer | Suportado via Webhook payload | `CAPACIDADE TESTADA` |
| **Consulta Detalhada do Pedido (`GET_ORDER_DETAILS`)** | Suportado via Thrift IQ Query | Suportado via Store.Order | Suportado nativo no Webhook | `CAPACIDADE IMPLEMENTADA` |
| **Envio de Lista de Produtos (`SEND_PRODUCT_LIST`)** | Suportado via ListMessage | Suportado via Store.Section | Suportado via Interactive List | `CAPACIDADE IMPLEMENTADA` |
| **Criação Automática de Pedido no CRM** | Persistência em `customer_orders` | Extração para o banco | Webhook parser para o banco | `CAPACIDADE CONFIRMADA EM PRODUÇÃO` |

---

## 3. Especificação Binária do WhatsApp Native Commerce

### 3.1. Estrutura do `ProductMessage` (Envio Nativo de Produto)
O ZAI constrói a mensagem no formato Protocol Buffer exato reconhecido pelos clientes WhatsApp móveis (Android/iOS) e Web:

```json
{
  "productMessage": {
    "product": {
      "productImage": "<Buffer da imagem em alta resolução>",
      "productId": "prod_tijolo_12_furos",
      "title": "TIJOLO 12 FUROS",
      "description": "Tijolo cerâmico 12 furos para alvenaria de alta resistência",
      "currencyCode": "BRL",
      "priceAmount1000": "900000",
      "retailerId": "TIJOLO 12 FUROS",
      "productImageCount": 1,
      "url": "https://wa.me/c/553193672075"
    },
    "businessOwnerJid": "553193672075@s.whatsapp.net"
  }
}
```

**Resultado Visual**:
- Cartão nativo com cantos arredondados, imagem destacada, preço formatado em Reais (`R$ 900,00`), título em negrito e botão interativo verde **"Ver"**.
- Ao clicar em **"Ver"**, o WhatsApp abre internamente o catálogo da loja sem redirecionar para navegadores externos.

---

### 3.2. Estrutura do `orderMessage` (Recepção de Carrinho pelo Cliente)
Quando o cliente final clica em **"Enviar pedido para a empresa"** dentro do carrinho do WhatsApp, o evento chega ao ZAI com a seguinte estrutura de dados:

```json
{
  "orderMessage": {
    "orderId": "127391823912",
    "token": "<Token criptográfico do pedido>",
    "itemCount": 2,
    "totalAmount1000": 1800000,
    "totalCurrencyCode": "BRL",
    "orderTitle": "Pedido com 2 itens",
    "sellerJid": "553193672075@s.whatsapp.net",
    "message": "Por favor entregar na parte da manhã"
  }
}
```

O ZAI `CartOrderListener`:
1. Intercepta o pacote em `messages.upsert`.
2. Executa a query IQ para puxar o descritivo de cada item (`productId`, `name`, `quantity`, `price`).
3. Grava o pedido com status `pending` na tabela `customer_orders`.
4. Insere a mensagem formatada na timeline da conversa (`messages`).
5. Emite evento em tempo real via WebSocket (`commerce:order_received`) para o atendente e o agente de IA.

---
*Assinado: Arquitetura de Comunicação e Inteligência Fênix OS / ZAI*
