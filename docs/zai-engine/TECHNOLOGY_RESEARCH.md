# ZAI Communication Engine — Technology Research & Ecosystem Audit
**Documento de Engenharia: FASE 1 — Pesquisa e Auditoria de Tecnologias**
*Data: 30 de Outubro de 2026 | Ecossistema: Fênix OS + ZAI + ZAPFLOW*

---

## 1. Visão Geral e Propósito

O objetivo desta pesquisa é consolidar o estado da arte das tecnologias de comunicação WhatsApp e comércio conversacional para fundamentar o **ZAI Communication Engine**. 

Em vez de criar uma simples casca sobre bibliotecas de terceiros (como Baileys, Evolution API ou WAHA), o ZAI estabelece uma tecnologia de comunicação própria, modular e desacoplada, orientada a capacidades reais, inteligência de protocolos binários e suporte profundo ao WhatsApp Native Commerce.

---

## 2. Auditoria Individual das Tecnologias

### 2.1. Baileys (`@whiskeysockets/baileys`)
- **Arquitetura**: Implementação em TypeScript/Node.js do protocolo Multi-Device WebSocket da Meta (protocolo binário Noise Protocol + Protocol Buffers / Protobuf).
- **Mecanismos de Conexão**: Conexão WebSocket direta aos servidores de borda do WhatsApp (`wss://web.whatsapp.com/ws/chat`). Não depende de navegador.
- **Autenticação**: Handshake criptográfico Curve25519 (Noise_XX_25519) persistido via chaves em disco (`creds.json`, `app-state-sync`, `pre-keys`).
- **Envio e Recebimento**: Serialização binária em protobufs (`WAMessage`, `Message`, `WebMessageInfo`).
- **Recursos Comerciais**:
  - `productMessage` (Protobuf ID 17): Suporte completo para envio de produto nativo com foto, preço (`priceAmount1000`), título, código varejista (`retailerId`) e link comercial.
  - `orderMessage` (Protobuf ID 34): Recepção de pacotes de carrinho e pedidos enviados pelo cliente.
  - Consultas IQ (`sock.query`): Consulta de detalhes do pedido via Thrift/IQ (`action="get"`, `type="order"`).
  - Consulta de Catálogo: A consulta de catálogo via binary query node (`iq` com namespace `w:biz:catalog`) sofre restrições frequentes nos nós públicos do Baileys para nós de terceiros.
- **Vantagens**: Altíssima performance, latência de sub-milissegundos (< 5ms), consumo mínimo de memória (~30MB a 60MB por sessão), ideal para disparos em alta escala e recepção em tempo real.
- **Limitações**: Instabilidade em mudanças repentinas de nós de catálogo pela Meta; ausência de motor visual de renderização.
- **Licença**: MIT. Reutilização legal: Total.

---

### 2.2. WhatsApp Web & Web Bridge (Playwright / Chromium)
- **Arquitetura**: Execução automatizada do cliente web oficial da Meta (`web.whatsapp.com`) em um navegador headless (Chromium).
- **Mecanismos de Conexão**: Sessão web completa executada pelo motor V8 do Chromium com WebSockets, Service Workers e IndexedDB nativos.
- **Autenticação**: QR Code gerado pelo canvas do WhatsApp Web, associado a um perfil de usuário persistente do Chromium (`launchPersistentContext`).
- **Envio e Recebimento**: Manipulação do DOM ou injeção em módulos internos do WhatsApp Web (`window.Store`).
- **Recursos Comerciais**:
  - Acesso 100% nativo ao catálogo comercial oficial da Meta (`window.Store.Catalog`, `window.Store.Product`).
  - Renderização idêntica ao aplicativo WhatsApp Business no celular.
  - Interação direta com o carrinho de compras do cliente e pedidos no painel lateral.
- **Vantagens**: Fidelidade total à experiência oficial da Meta; o WhatsApp Web nunca sofre bloqueios de protocolo porque roda a aplicação oficial.
- **Limitações**: Alto consumo de recursos (300MB a 600MB de RAM por instância do navegador); suscetível a congelamento de aba se não houver watchdog ativo.
- **Licença**: Código do WhatsApp Web é proprietário da Meta; a automação via Playwright é licenciada sob Apache 2.0. Reutilização legal: Permitida como automação de cliente próprio.

---

### 2.3. WPPConnect / WA-JS
- **Arquitetura**: Camada de injeção JavaScript no runtime do WhatsApp Web (`@wppconnect/wa-js`).
- **Mecanismos de Conexão**: Conecta-se às instâncias de webpack do WhatsApp Web injetando métodos sob `window.WPP`.
- **Autenticação**: Requer sessão WhatsApp Web autenticada via Chromium.
- **Recursos Comerciais**: Módulos maduros para catálogo (`WPP.catalog.getProducts`, `WPP.catalog.sendProductMessage`).
- **Vantagens**: Expõe APIs ricas para catálogo e carrinho sem necessidade de ler protobufs diretamente.
- **Limitações**: Quebras frequentes a cada release de versão minificada do WhatsApp Web (exige manutenção constante de parsers de webpack).
- **Licença**: Apache 2.0. Reutilização legal: Pode ser incorporado como módulo de extração no Web Bridge.

---

### 2.4. Evolution API
- **Arquitetura**: Wrapper HTTP/REST em Node.js/NestJS construído primariamente sobre Baileys, com extensões recentes para WhatsApp Cloud API e Chatwoot.
- **Análise Crítica**: Não é um protocolo novo; é uma API intermediária que encapsula Baileys. Depender da Evolution API apenas adicionaria uma camada de latência HTTP e consumo extra de rede sem resolver o problema central de independência.
- **Reutilização legal**: GPL-3.0. Não deve ser acoplada ao core proprietário do ZAI para evitar contaminação de licença copyleft.

---

### 2.5. WAHA (WhatsApp HTTP API)
- **Arquitetura**: API REST em TypeScript que suporta múltiplos motores (NOWEB via Baileys, WEBJS via whatsapp-web.js e GOWS).
- **Lição Arquitetural**: A arquitetura de WAHA separa adaptadores de transporte de controladores de rota. Essa estratégia de abstração de transporte é exatamente a que o ZAI deve adotar, mas implementada de forma nativa e integrada ao PostgreSQL e Redis do ZAPFLOW.
- **Licença**: Core open source sob Apache 2.0 / versão comercial proprietária.

---

### 2.6. GOWS / whatsmeow (Go)
- **Arquitetura**: Biblioteca completa em Golang que implementa o protocolo WhatsApp Multi-Device.
- **Vantagens**: Performance extrema e uso mínimo de memória (< 15MB de RAM por sessão).
- **Recursos Comerciais**: Suporte a protobufs de produtos e pedidos através de geradores protoc em Go.
- **Posicionamento no ZAI**: Excelente candidato para o futuro ZAI GOWS Adapter em microsserviço de alta densidade na VPS.
- **Licença**: MPL 2.0. Permite consumo e comunicação como serviço isolado.

---

### 2.7. WhatsApp Cloud API (Oficial da Meta)
- **Arquitetura**: API REST oficial da Meta sob Graph API (`graph.facebook.com/v20.0`).
- **Mecanismos de Conexão**: Webhooks HTTPS recebidos e chamadas HTTP POST enviadas.
- **Autenticação**: Tokens permanentes do Meta Business Manager (WABA).
- **Recursos Comerciais**:
  - Envio de Mensagens de Produto Único (`type: "interactive", action: { name: "product_list" }` ou `product`).
  - Catálogo nativo hospedado no Gerenciador de Comércio do Facebook/Meta (Meta Commerce Manager).
  - Webhook oficial para recebimento de pedidos (`messages.order`).
- **Vantagens**: Risco zero de banimento; garantia total de entrega e SLA.
- **Limitações**: Cobrança por conversa (modelo de preços da Meta); exige aprovação comercial e vinculação com Catálogo Meta.
- **Licença**: API proprietária pública da Meta. Reutilização legal: Total mediante credenciais da empresa.

---

## 3. Síntese do Inventário de Reutilização para o ZAI

| Tecnologia | O que Reutilizar no ZAI | O que Descartar / Evitar |
| :--- | :--- | :--- |
| **Baileys** | Transporte WebSocket, criptografia Noise, serialização Protobuf, handshake rápido. | Dependência exclusiva para dados de catálogo complexos de terceiros. |
| **WhatsApp Web / Playwright** | Sincronização profunda de catálogo, leitura de produtos com variantes, auditoria visual. | Manter navegadores abertos para todas as conversas (esgotaria RAM da VPS). |
| **WA-JS** | Mapeamento de coleções e catálogo no DOM do WhatsApp Web. | Não usar como motor primário de envio de texto ou arquivos comuns. |
| **Cloud API** | Adaptador corporativo para clientes enterprise com WABA própria. | Não exigir como pré-requisito para pequenos lojistas. |
| **ZAPFLOW Existente** | `customer_orders`, `products`, `messages`, `conversations`, pipelines de IA e Inbox. | Código duplicado, chamadas HTTP sem tratamento de erro e fallbacks cegos. |

---
*Assinado: Arquitetura de Comunicação e Inteligência Fênix OS / ZAI*
