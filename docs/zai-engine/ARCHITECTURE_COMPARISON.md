# ZAI Communication Engine — Architecture Comparison
**Documento de Engenharia: FASE 1 — Comparação Arquitetural de Motores**
*Data: 30 de Outubro de 2026 | Ecossistema: Fênix OS + ZAI + ZAPFLOW*

---

## 1. Matriz Comparativa de Arquiteturas

| Dimensão Técnica | Baileys (Socket Nativo) | WhatsApp Web Bridge (Chromium) | WhatsApp Cloud API (Oficial) | WAHA / Evolution (Wrappers) | **ZAI Communication Engine (Proposta)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Abordagem** | Reversão binária Noise/Protobuf | Automação Headless do Web App | REST / Webhook oficial Meta | API intermediária sobre Baileys | **Orquestrador Soberano Multi-Motor** |
| **Consumo de Memória (por sessão)** | 35 MB – 65 MB | 350 MB – 550 MB | < 5 MB (Stateless HTTP) | 80 MB – 150 MB | **Dinâmico (35 MB padrão, Chromium sob demanda)** |
| **Latência de Envio** | < 10 ms | 150 ms – 500 ms | 200 ms – 800 ms (rede externa) | 50 ms – 150 ms | **< 10 ms (roteado pelo motor mais veloz)** |
| **Conexão Simultânea** | Sim (Multi-Dispositivo) | Sim (Multi-Dispositivo) | N/A (Server-to-Server) | Depende do motor subjacente | **Sim, unificada por tenant e sessão** |
| **Catálogo Nativo Oficial** | Suporta envio `ProductMessage` | Suporta sincronização completa | Suporta Catálogo Meta Catalog ID | Reencaminha para Baileys | **Sincronização híbrida + Envio nativo** |
| **Recepção de Carrinho** | Recebe `orderMessage` binário | Visualiza gaveta de pedido | Recebe Webhook JSON estruturado | Repassa JSON simples | **Parser binário + Consulta IQ + Persistência CRM** |
| **Resiliência a Quedas** | Reconexão de socket com backoff | Reinicialização de contexto | Redelivery automático de Webhooks | Depende de reinicialização do daemon | **Circuit Breaker + Recovery Manager em 3 camadas** |
| **Isolamento Multi-Tenant** | Por sessão em disco e Map | Por perfil de diretório no Chromium | Por WABA ID e Token | Por chave de API | **Isolamento estrito por `company_id` no DB e memória** |

---

## 2. Padrões de Projeto e Separação de Camadas no ZAI

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ZAPFLOW CRM & FRONTEND                          │
│     (Inbox Central, Disparos, Kanban, Catálogo Popover, Agente IA)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Chama unicamente APIs /zai/*
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       ZAI COMMUNICATION ENGINE                         │
│                                                                        │
│  ┌───────────────────────────┐      ┌───────────────────────────────┐  │
│  │       API Gateway         │      │     Protocol Intelligence     │  │
│  │   (/zai/connections, etc) │      │   (Protobuf / IQ Analyzer)    │  │
│  └─────────────┬─────────────┘      └───────────────┬───────────────┘  │
│                │                                    │                  │
│                ▼                                    ▼                  │
│  ┌───────────────────────────┐      ┌───────────────────────────────┐  │
│  │     Operation Router      │◄────►│      Capability Registry      │  │
│  │ (Idempotency & Circuit)   │      │   (Descoberta e Certificação) │  │
│  └─────────────┬─────────────┘      └───────────────────────────────┘  │
│                │                                    ▲                  │
│                ▼                                    │                  │
│  ┌───────────────────────────┐      ┌───────────────┴───────────────┐  │
│  │    Transport Registry     │◄────►│       Commerce Engine         │  │
│  │ (Multi-Sessão & Estado)   │      │ (Catálogo, Carrinho, Pedidos) │  │
│  └─────────────┬─────────────┘      └───────────────────────────────┘  │
│                │                                                       │
└────────────────┼───────────────────────────────────────────────────────┘
                 │ Despacha para o adaptador adequado
     ┌───────────┼───────────┬──────────────┬─────────────┐
     ▼           ▼           ▼              ▼             ▼
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐
│ Baileys │ │ WhatsApp│ │  Cloud   │ │    WAHA    │ │   GOWS    │
│ Adapter │ │WebBridge│ │   API    │ │  Adapter   │ │  Adapter  │
│ (Core)  │ │(Catalog)│ │ (Meta)   │ │ (Fallback) │ │  (High-Q) │
└─────────┘ └─────────┘ └──────────┘ └────────────┘ └───────────┘
```

---

## 3. Diretrizes de Não-Duplicação e Reutilização

1. **Aproveitamento Integral do Banco de Dados**:
   - `customer_orders`: Já possui os 17 campos necessários para pedidos, tokens, itens e status. Nenhuma migração destrutiva será feita.
   - `products`: Mantém o catálogo de 19 produtos reais com fotos, preços em R$ e códigos varejistas.
   - `messages`: Mantém a coluna `analysis_json` e `media_type: 'order'` já ativas.

2. **Desacoplamento do Frontend**:
   - O frontend React (`frontend-official`) continua consumindo endpoints estáveis, agora alimentados pelo núcleo do ZAI.
   - Nenhuma tela será quebrada; a experiência do operador no Inbox permanece preservada.

3. **Arquitetura de Adaptadores Plugáveis**:
   - Todo motor implementa o contrato comum: `connect`, `disconnect`, `getStatus`, `sendText`, `sendMedia`, `sendProduct`, `getCatalog`, `receiveEvents`, `receiveOrders`, `healthCheck`.
   - Se um novo motor surgir no ecossistema (ex: whatsmeow em Go), apenas seu adaptador é adicionado, sem tocar no CRM.

---
*Assinado: Arquitetura de Comunicação e Inteligência Fênix OS / ZAI*
