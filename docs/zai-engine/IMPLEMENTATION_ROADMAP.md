# ZAI Communication Engine — Implementation Roadmap
**Documento de Engenharia: FASE 1 — Roteiro de Implementação e Certificação**
*Data: 30 de Outubro de 2026 | Ecossistema: Fênix OS + ZAI + ZAPFLOW*

---

## 1. O Primeiro Marco Concreto (Meta Imediata)

> **MARCO 1 — PROVA DE VIDA REAL DO COMÉRCIO NATIVO**:
> *O ZAI deve conseguir conectar a conta comercial, carregar os produtos reais do catálogo, despachar um produto no formato nativo oficial (foto + preço + botão "Ver"), receber o carrinho enviado pelo cliente e criar automaticamente o pedido correspondente na tabela `customer_orders` e na timeline da conversa no ZAPFLOW.*

---

## 2. Fases de Execução do ZAI Engine

### Fase 1 — Auditoria e Inteligência (Concluída)
- Mapeamento de todos os arquivos de orquestração e comércio existentes.
- Resolução da dependência do Playwright na VPS (`/usr/bin/chromium-browser` disponível, versão 1.64.1).
- Geração dos 4 documentos estruturantes em `/docs/zai-engine/`.

### Fase 2 — Consolidação do Core ZAI (`/services/zai/`)
- Estruturação do núcleo `ZAI Communication Engine` sob um namespace canônico (`backend/services/zai/`).
- Reutilização dos 15 módulos já validados no Orchestrator, evitando qualquer duplicação ou código órfão.
- Estabelecimento do contrato de interface `ZAIAdapter` para todos os motores.

### Fase 3 — API Própria Unificada (`/zai/...`)
- Criação dos endpoints próprios do ZAI no API Gateway do backend:
  - `POST /zai/connections` — Gestão de conexões.
  - `GET /zai/connections/:sessionId/status` — Status unificado.
  - `POST /zai/messages/send` — Envio de mensagens de texto e mídia.
  - `GET /zai/catalog` — Consulta de produtos do catálogo.
  - `POST /zai/catalog/products/send` — Envio do cartão nativo oficial de produto.
  - `GET /zai/orders` — Consulta de pedidos recebidos via carrinho.
  - `GET /zai/capabilities` — Descoberta dinâmica de capacidades registradas.
  - `GET /zai/health` — Métricas e telemetria de latência e circuit breaker.

### Fase 4 — Testes Automatizados e Certificação E2E
- Implementação de suíte de testes de certificação completa cobrindo:
  1. Handshake e ciclo de vida de conexão.
  2. Construção e integridade de protobuf `productMessage`.
  3. Interceptação e parsing de `orderMessage` com injeção na tabela `customer_orders`.
  4. Validação de idempotência e proteção contra duplicação de disparos.
  5. Teste de fallback de transporte resiliente.

### Fase 5 — Implantação e Validação em Produção (VPS)
- Sincronização do código validado para o repositório e deploy cirúrgico na VPS.
- Recarregamento sem downtime (`pm2 reload zapflow-api`).
- Verificação de logs em tempo real (`pm2 logs zapflow-api`).

---
*Assinado: Arquitetura de Comunicação e Inteligência Fênix OS / ZAI*
