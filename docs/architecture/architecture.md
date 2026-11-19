# Arquitetura do Sistema: Single Source of Truth e Integração Realtime

Este documento define a arquitetura técnica e o fluxo de dados consolidado do ZAPFLOW AI / ZAPAI, detalhando como a interface do Lovable foi acoplada ao backend real de forma blindada.

---

## 🏛️ Camadas Arquiteturais

A arquitetura do sistema é estruturada em 4 camadas independentes de responsabilidade única:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Lovable View Layer (src/lovable/*) [Read-Only]           │
└──────────────┬──────────────────────────────▲───────────────┘
               │ (Props / Ações)              │ (ViewModels)
┌──────────────▼──────────────────────────────┴───────────────┐
│ 2. Adapter Layer (src/adapters/lovable/*)                  │
└──────────────┬──────────────────────────────▲───────────────┘
               │ (Chamadas de Ações)          │ (Leitura Reativa)
┌──────────────▼──────────────────────────────┴───────────────┐
│ 3. State Layer (Zustand Global Store - src/stores/*)       │
└──────────────┬──────────────────────────────▲───────────────┘
               │ (Hydration / Dispatch)       │ (Mensagens / Status)
┌──────────────▼──────────────────────────────┴───────────────┐
│ 4. Runtime Layer (src/runtime/* & API - src/services/*)     │
└──────────────┬──────────────────────────────────────────────┘
               │ (TCP WebSockets / HTTP REST)
┌──────────────▼──────────────────────────────────────────────┐
│ 5. Backend Service (Express + Socket.io - Porta 4025)       │
└─────────────────────────────────────────────────────────────┘
```

### 1. View Layer (`src/lovable/*`)
- **Papel**: Detém toda a estrutura visual, spacing, padding, layouts, cores e componentes de UI do Lovable.
- **Regra**: **Estritamente Read-Only**. Nenhuma lógica operacional do backend local pode ser injetada de forma acoplada nestas views.
- **Integração**: Consome interfaces de `ViewModel` estritamente tipadas geradas pelos adapters.

### 2. Adapter Layer (`src/adapters/lovable/*`)
- **Papel**: Traduz os estados operacionais reais do banco de dados e do socket (Zustand) nos modelos de dados esperados pelas views do Lovable.
- **Regra**: Mapeia as volumetrias, densidades geográficas de DDDs e distribuições de leads em tempo real de forma que as telas renderizem dados dinâmicos do backend real sem divergência visual.

### 3. State Layer (`src/stores/*`)
- **Papel**: Centraliza o estado global da aplicação em uma store Zustand (`useAppStore`), atuando como a **Única Fonte da Verdade (Single Source of Truth)**.
- **Responsabilidade**: Sincroniza a lista de conversas, mensagens do Inbox, sessões ativas do WhatsApp, QRCodes e a latência/saúde do ecossistema local.

### 4. Runtime Layer (`src/runtime/*`)
- **Papel**: Gerencia o ciclo de vida do WebSocket (Socket.io) compartilhado, logs estruturados do sistema, persistência de diagnóstico e as checagens periódicas de conectividade de rede.
- **Sincronização**: Realiza pings HTTP silenciosos e escuta os eventos em tempo real do gateway do backend, despachando atualizações instantâneas para a store global do Zustand.

---

## 🔒 Regras de Blindagem Operacional

### Contexto canônico de empresa e licenciamento

`companies.id` reutiliza os identificadores legados de `users.tenant_id` e `ai_stores.company_id`. A migração 055 faz backfill aditivo e grava um resumo de vínculos em `company_migration_reports`; os dados operacionais não são reescritos. Empresas novas aguardam aprovação antes da criação de login. Links têm hash SHA-256 no banco, validade e consumo único; senhas de solicitação usam bcrypt.

O JWT continua sendo a identidade do usuário. Apenas papéis master podem solicitar `x-admin-company-context`; o middleware resolve a empresa ativa antes das rotas tenant-scoped. Admins comuns seguem presos ao tenant do JWT. Entitlements combinam licença ativa da empresa, módulos permitidos e permissões individuais; tenants legados mantêm o acesso até resgatar um novo pacote.

### Instância persistente do Assistente ZAI

`MainLayout` monta uma instância do mascote e do copiloto. Configurações dispara um evento para abrir essa instância, sem duplicar o componente. A preferência de interação por usuário e as ativações global/empresa ocultam ou liberam o painel, mas não interrompem o observador contínuo das sessões WhatsApp.

1. **Isolamento de Views**: Nenhum componente ou página de `src/lovable/*` pode chamar o `apiService` ou importar o `useAppStore` diretamente. Todo o acesso a APIs e estados deve ser encapsulado nas páginas controladoras de `src/pages/*` e repassado através de adapters.
2. **Ciclo de Vida Único de Conexão**: Não são permitidas conexões ou conexões duplicadas de WebSocket iniciadas de forma fragmentada pelas páginas. A única conexão ativa é aberta e gerida centralizadamente pelo `RuntimeProvider` a partir do `socketManager`.
3. **Escrita Unificada no Zustand**: Qualquer alteração de dados obtida via HTTP ou WebSocket deve atualizar a store global do Zustand. As páginas devem ouvir as propriedades da store de forma reativa, sem gerenciar estados locais (`useState`) redundantes de dados operacionais.
