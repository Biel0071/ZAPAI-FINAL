# Bug Tracking — Auditoria geral (produção) — 16/11/2026

Auditoria em produção (`https://209.50.241.22:1000`, usuário master) por Atendentes, Memória & Evolução, Inbox, Dashboard, Conexões, Campanhas, Contatos e Configurações, alternando atendentes (Camila Santos, João Silva) e instâncias WhatsApp (`main`, `rh`).

Status: **Corrigido** = no código local, verificado (tsc + build + testes), **ainda não deployado** · **Operacional** = ação de configuração no sistema · **Limitação** = exige novo conteúdo/arte ou decisão de produto.

## Resumo

| Severidade | Total | Corrigidos | Operacional / Limitação |
|---|---|---|---|
| Crítico | 5 | 4 | 1 |
| Alto | 8 | 8 | 0 |
| Médio | 10 | 8 | 2 |
| Baixo | 7 | 6 | 1 |

## Crítico

| ID | Área | Bug | Correção | Status |
|---|---|---|---|---|
| BUG-001 | Inbox · PIX | Atalho PIX inseria chave/favorecido fixos de uma loja para qualquer empresa. | Atalho busca o PIX cadastrado da loja do WhatsApp ativo (`GET /api/stores/payment/pix`) e insere chave + PIX copia e cola; sem cadastro, avisa onde cadastrar. | Corrigido |
| BUG-002 | Backend · Pagamentos | `PaymentEngine` gerava PIX com chave fixa e CRC aleatório (código inválido) e link fictício. | Gerador BR Code padrão BACEN (`services/payments/pixBrCode.js`, CRC16 validado com o exemplo do manual) usando o PIX da loja; sem cadastro, recusa com 400. `paymentUrl` fictício removido; `companyId` vem da autenticação, não do corpo. | Corrigido |
| BUG-003 | Inbox · troca de instância | Contadores da instância anterior permaneciam ao trocar `rh` ↔ `main`. | Reset na troca + descarte de respostas de outra sessão. | Corrigido |
| BUG-030 | Backend · Conversas | Operações por conversa (cobrança, handoff, ficha, finalização) buscavam a conversa só pelo id, sem empresa (acesso entre empresas). | `loadConversationForOperation` exige a empresa autenticada. Cobrança da conversa envia PIX copia e cola real em vez de "PIX-XXXX". | Corrigido |
| BUG-004 | Atendentes | Os dois atendentes estão Pausados; João sem loja e sem WhatsApp. | Ativar/vincular em Atendente IA. | Operacional |

## Alto

| ID | Bug | Correção | Status |
|---|---|---|---|
| BUG-005 | Atalho "Contato" com loja fixa. | Usa nome/telefone da sessão ativa. | Corrigido |
| BUG-006 | Card "WhatsApp do atendimento" sempre na 1ª sessão; telefone fixo. | Segue a sessão filtrada/ativa. | Corrigido |
| BUG-007 | João aparecia Feminino. | Heurística ignora acento; avatar salvo sem `body` recebe o gênero padrão. | Corrigido (re-salvar avatar do João) |
| BUG-008 | Evolução mostrava "IA ATIVA / Operando" com atendente pausado. | Status real via `isActive`. | Corrigido |
| BUG-009 | Métricas iguais para todos os atendentes. | XP, conversas pontuadas e fechamentos filtrados por `agent_key`/`agent_name`; métricas de aprendizado da loja rotuladas "(loja)" e marcadas em `metricScope`. | Corrigido |
| BUG-010 | "Nível 13 · 97.905 XP" vs "+0 XP". | XP do atendente = XP das próprias conversas (amostras/playbooks da loja não inflam mais o nível); lista de pontuação filtrada por atendente; naturalidade calculada sem piso artificial de 76–98%. | Corrigido |
| BUG-011 | Conexões mostrava Camila em `rh` e `main`. | Removido fallback "único atendente conhecido" e Camila/telefone fixos do WebBridge; só vínculo explícito aparece. | Corrigido |
| BUG-012 | Nenhum card de objetivo marcado. | Texto livre aparece como "Objetivo Personalizado" e não é sobrescrito. | Corrigido |

## Médio

| ID | Bug | Correção | Status |
|---|---|---|---|
| BUG-013 | Trocar roupa troca cabelo (sprite de corpo inteiro). | — | Limitação (exige arte em camadas) |
| BUG-014 | "Blazer Alfaiataria" renderizava moletom/camisa. | Não existe sprite de blazer; item renomeado para "Look Comercial Casual". | Corrigido |
| BUG-015 | `GET /api/company/entitlements` 403 para master. | Já corrigido no código local (fallback master); sai no próximo deploy. | Corrigido |
| BUG-016 | `POST /api/ai/compose` 409 ao abrir conversa. | Pré-aquecimento envia `prewarm: true`; sem agente responde 200 vazio. | Corrigido |
| BUG-017 | Rajadas de `/api/health`, `zai-assistant-config` e `agent-evolution`. | Deduplicação de requisições em andamento (3–15 s). | Corrigido |
| BUG-018 | Inbox recarregava conversas a cada refresh de sessões. | Recarrega só quando muda a sessão ou sua disponibilidade. | Corrigido |
| BUG-019 | Evolução ~10 s em "Carregando". | Coberto pela deduplicação (3 chamadas → 1). | Corrigido (validar em produção) |
| BUG-020 | 100% dos contatos "Frio". | Contatos importados sem conversa nunca passam pelo pipeline de CRM. | Limitação (precisa job de classificação retroativa) |
| BUG-021 | Iniciais com emoji quebrado e LID como telefone. | Iniciais por letra/número Unicode; LID exibido como "Número oculto pelo WhatsApp". | Corrigido |
| BUG-022 | Web Bridge desconectado com "Sincronização contínua ativa" e número fixo. | Texto e número seguem o estado real. | Corrigido |

## Baixo (UI)

| ID | Bug | Status |
|---|---|---|
| BUG-023 | Abas truncadas ("A…", "Mem…"). | Corrigido (quebra de linha abaixo de xl) |
| BUG-024 | Card "Novo Atendente" cortado. | Limitação — é carrossel com rolagem horizontal |
| BUG-025 | Seções começavam em "2.". | Corrigido ("1. Avatar Studio") |
| BUG-026 | Título "Provedores" duplicado. | Corrigido ("Motor de IA deste atendente") |
| BUG-027 | Campo de chave `sk-proj-…` com Provedor ZAI. | Corrigido (oculto para ZAI) |
| BUG-028 | "Nova Conexão" sobre o seletor de instância. | Corrigido (seletor encolhe) |
| BUG-029 | Perfil master sem permissão exibida. | Corrigido (mostra papel + explicação) |

## Conteúdo fixo de uma loja (multi-tenant)

Removido do que aparece para todas as empresas: perguntas rápidas do Sandbox (cimento/obra), textos das Diretrizes por nível, descrições das medalhas, medalhas "desbloqueadas" falsas no fallback, cabeçalho do catálogo, fallbacks de nome de loja.

**Ainda existe (Melhoria MEL-006):** agentes-semente `julia/pedro/rafael`, catálogo de demonstração em `productsController.js` e heurísticas de produto (caixa d'água, churrasqueira, cimento) em `aiConfig.js`/`conversationEvolutionService.js`. Devem virar dados da loja.

## PIX da loja (novo)

- Cadastro em **Atendente IA › WhatsApp › Loja e dados comerciais › PIX da loja** (admin/master): tipo de chave (CPF, CNPJ, celular, e-mail, aleatória), chave, favorecido (25), cidade (15), ativo.
- Salvo em `ai_stores.settings.payment.pix` (sem migration). `PUT /api/stores/:id` não apaga mais `settings`/`attendant_config` quando omitidos.
- Endpoints: `GET|PUT /api/stores/:id/payment-settings`, `DELETE /api/stores/:id/payment-settings/pix`, `GET /api/stores/payment/pix?sessionId=&storeId=&amount=`.
- Usado por: atalho PIX do Inbox, cobrança da conversa, `PaymentEngine`.

## Verificação

- Frontend: `tsc` OK · `vite build` OK · vitest 309/310 (o restante é timeout do teste de estresse sob carga; passa 3/3 isolado).
- Backend: `pixBrCode` 4/4 · `humanLearningMetrics` 6/6 · `unifiedWhatsAppOrchestrator` 10/10 · `agentMemoryGraphService` 5/5 · `aiAgentAssignments` 30/30.
- Smoke PIX no Postgres local: salva preservando settings, resolve loja pelo WhatsApp, CRC válido, isolamento entre empresas, remoção.