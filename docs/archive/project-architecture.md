# Documentação Técnica da Arquitetura — ZAPFLOW AI

Este documento serve como blueprint técnico oficial do ecossistema do **Zapflow CRM** (ZAPAI). Ele foi gerado a partir do mapeamento dinâmico de código e auditoria E2E em tempo de execução.

## Histórico e criação supervisionada de atendentes

O listener canônico `stableSession` encaminha histórico para `services/whatsapp/historySync`.
O `workerSupervisor` executa a fila PostgreSQL de `historyRepository`, separada do
pipeline de mensagens novas para preservar não lidas e não disparar automações.
`src/ai/evolutionary/historyLearning` produz versões por empresa/sessão; a publicação
revisada é transacional no `aiAgentService`. O painel compartilhado aparece em Conexões
e no Evolution Center. Não é um segundo motor de atendimento: o agente publicado
continua usando o runtime existente. [Contratos, limites e rollout](runtime/whatsapp-history-bootstrap.md).

## Memória por conexão WhatsApp e evolução de atendentes (22/09/2026)

A arquitetura isola o histórico e memória no PostgreSQL pela tripla `(company_id, session_id, contact_id)`.
- **Persistência desacoplada:** A tabela de mensagens é a fila durável (`aiMemoryEngine.projectPending()`), garantindo deduplicação atômica com recibos (`ai_memory_receipts`) e integridade mesmo em falhas transitórias do banco.
- **Vínculos com lojas:** Uma conexão pode vincular-se opcionalmente a uma loja cadastrada na mesma conta (`session_ai_profiles.store_id`), herdando conhecimentos oficiais atuais (`ai_stores.knowledge`) sem misturar histórico de mensagens. Ao desvincular, o acesso é revogado imediatamente mantendo a memória própria do número.
- **Criação de atendentes:** Disponível nas telas de Conexões e Atendentes via 3 modalidades: manual, por prompt e por histórico de conversas. Em todas, o usuário define segmento, tipo de atendimento e conexões atendidas, com prévia editável e ativação obrigatória e explícita.
- **Evolução supervisionada e segura:** Ajustes automáticos são restritos exclusivamente ao estilo estruturado (tom e tamanho da resposta). Alterações comerciais geram propostas para revisão. Versões são armazenadas em `ai_agent_versions` com suporte à reversão imediata e pausa da evolução.

---


## 🛠️ 1. Stack de Tecnologias

### Frontend
- **Framework Core:** React (v18.3.1)
- **Bundler & Dev Server:** Vite (v5.4.19)
- **Linguagem:** TypeScript (v5.8.3)
- **Roteamento:** React Router Dom (v6.30.1)
- **Estilização:** Tailwind CSS + Radix UI + Lucide React
- **Gerenciamento de Estado:** Zustand (ZSession, ZRuntime, ZInbox) + TanStack React Query
- **Testes & QA:** Vitest + Playwright

### Backend & Integrações
- **Runtime:** Node.js (Express framework)
- **Banco de Dados:** PostgreSQL
- **Conectividade WhatsApp:** Biblioteca Baileys (integração direta via WebSocket/QR Code com o WhatsApp Web)
- **Comunicação em Tempo Real:** Socket.io (WebSockets) para envio de eventos de status do WhatsApp e sincronização do Inbox.

---

## 📂 2. Estrutura de Diretórios & Camadas

```
ZAPAI-FINAL/
├── backend/                  # Backend Node/Express & Conexão Baileys
│   ├── src/
│   │   ├── controllers/      # Controladores REST API
│   │   ├── services/         # Integrações do WhatsApp, Baileys & Regras
│   │   ├── models/           # Schemas e persistência PostgreSQL
│   │   └── server.js         # Inicialização do servidor socket.io na porta 4025
│   └── sessions/             # Armazenamento das credenciais do WhatsApp
├── frontend-official/        # Frontend React & Interface do Usuário
│   ├── src/
│   │   ├── components/       # Componentes Shadcn/UI reusáveis
│   │   ├── pages/            # Módulos de telas do sistema
│   │   ├── providers/        # Provedores de contexto (Runtime, WebSocket)
│   │   ├── stores/           # Zustand Stores (Estado global da aplicação)
│   │   └── App.tsx           # Ponto de entrada do React Router
│   ├── playwright.config.ts  # Configuração E2E
│   └── tests/ui/             # Testes de auditoria completa e stress
└── reports/                  # Relatórios de auditoria gerados dinamicamente
```

---

## 🔐 3. Roteamento, Permissões e Segurança

O sistema adota um roteador baseado no **React Router Dom (v6)** estruturado da seguinte forma:

1. **Rotas Públicas:**
   - `/login`: Tela de autenticação baseada em JWT e persistida em localStorage (`zapai_admin_auth_session`).
2. **Rotas Privadas Admin (Mínimo: Admin):**
   - `/diagnostics`: Painel de telemetria, logs estruturados do sistema e checagem de integridade das APIs.
3. **Rotas Privadas Master (Mínimo: Master Admin):**
   - `/users`: Gestão de administradores e tenants adicionais.
   - `/nodes`: Controle de instâncias de microsserviços.
   - `/deployments`: Registros de atualizações do ecossistema.
   - `/logs`: Centralizadora de auditoria de eventos e depuração do backend.
4. **Rotas Gerais Privadas:**
   - `/dashboard`, `/inbox` (chat em tempo real), `/connections` (painel QR code), `/contacts`, `/flows`, `/ai`, `/analytics`, `/campaigns`, `/memory`, `/settings`.

---

## 📈 4. Telemetria e Ciclo de Vida E2E

### Fluxo de Inicialização
1. O usuário efetua login -> Retorna token JWT.
2. O frontend armazena a sessão e conecta um socket em tempo real na porta `4025`.
3. O `RuntimeProvider` monitora a saúde das conexões em segundo plano.
4. Se o WhatsApp estiver desconectado, o painel `/connections` gera e transmite a string base64 do QR code via socket para renderização instantânea na tela.

---
*Relatório de engenharia gerado em tempo de execução pela suíte de auditoria completa.*
