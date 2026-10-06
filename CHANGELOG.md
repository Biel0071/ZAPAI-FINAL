# Changelog — ZAPAI

All notable changes to this project will be documented in this file.

## Unreleased — 2026-10-06: Inbox, sincronização e Atendente IA

- Abas do atendimento com nomes e emojis, Histórico no lugar de Logs e aparência editável das categorias de respostas rápidas, isolada por empresa e com salvamento confirmado.
- Horário original do WhatsApp separado da chegada ao servidor, ordenação compatível com timestamps numéricos e atualização de mensagens alteradas sem trocar o ID. Menu e horário compartilham o rodapé da bolha.
- Persistência em tempo real preserva identidade WhatsApp e JID. Avaliação e correção da resposta da IA usam autenticação, confirmam o registro e alimentam o campo consumido pelo aprendizado.
- Atendente IA expõe configuração, memória e evolução existentes. Edição de aparência usa os visuais reais do catálogo; métricas e exemplos de evolução deixam de apresentar resultados fictícios.
- Contagem e mineração de atendimento humano são limitadas à empresa autenticada; falhas do banco não retornam progresso inventado.

## Unreleased — 2026-10-06: loja integrada ao atendimento

- Dados comerciais completos dentro de Atendentes & Assistente ZAI, por WhatsApp; loja compartilhada ou cadastro próprio vazio/copiado, com recuperação de vínculo sem duplicar cadastro. Rotas antigas de Lojas redirecionam para essa configuração e a navegação mantém todas as demais áreas.
- Troca do responsável preserva ativação, histórico, memória e conhecimento do número. Criação/edição/atribuição garantem vínculo exclusivo; conflitos legados exigem escolha explícita e não selecionam arbitrariamente agente ou loja.
- Atualizações comerciais e de perfil preservam campos omitidos e retornam falhas reais. Assistente flutuante reutiliza o copiloto canônico e possui uma única montagem no shell.
- Corrigidos agrupamento de contatos entre números, localização aleatória no mapa e controles que simulavam funções indisponíveis; revisão de contratos e apresentação nas páginas do sistema.

## Unreleased — 2026-10-05: atendentes, assistente e lojas

- Atendentes e Assistente ZAI reunidos na mesma tela, preservando as configurações, fluxos e evolução da IA. Cards compactos mostram loja, WhatsApp e estado real, com personagem maior e fechamento de pop-ups em verde.
- Removidos simuladores de estado, telemetria e informações comerciais de exemplo. Respostas de teste vêm do provedor; falhas não confirmam salvamento nem inventam sucesso.
- Loja e conhecimento seguem o vínculo do WhatsApp, inclusive quando um atendente atende números de lojas diferentes. Trocar atendente preserva a loja da sessão; remover o último número pausa o perfil e cópias começam sem vínculos.
- Configuração rápida conserva as instruções textuais de memória e usa os campos consumidos pelo atendimento. A página de configurações compartilha os perfis reais e descarta respostas atrasadas após trocar de agente.
- Corrigidos carregamento do controlador de sessões, criação de lojas, rascunhos atrasados no Inbox e status das mensagens pendentes/falhas. Métricas de operação, listagens de fila e perfis de voz respeitam a empresa autenticada.

## Unreleased — 2026-10-01: correções da aceitação na VPS

- Busca de conversas no servidor por empresa e conexão, com cancelamento de resultados antigos, pesquisa nas arquivadas e filtro real de todas as conexões.
- Identificadores de envio compatíveis com navegadores que não expõem `crypto.randomUUID`, preservando a geração segura e os rascunhos em caso de erro.
- Ajustes de botões em telas pequenas, ajuda do Inbox integrada ao cabeçalho e informações corretas quando a IA global está pausada.
- Migração aditiva `039_create_quick_replies`, sem seeds, e erros recuperáveis de persistência nas respostas rápidas.
- Alcance configurável da automação por conexão e telefone, mantendo a pausa global e a validação do destino antes de responder.
- Publicação preserva todos os arquivos de ambiente e faz backup do banco efetivamente usado pelo processo. O gate do frontend acompanha o redirecionamento para HTTPS com validação do certificado.

## Unreleased — 2026-09-30: IA e Inbox para atendimento real

- Entrada única da IA no menu, agente como tela inicial e navegação interna em Agente, Conhecimento e Operação. Criação guiada reutiliza o painel existente com revisão antes de salvar.
- Inbox com painel Atendimento, Cliente e Arquivos, estado real do WhatsApp/provedor e seleção do agente persistido. Respostas de texto entram no rascunho; mídias e fluxos têm prévia e confirmação.
- Correções de rascunhos, sugestões e banners ao trocar de conversa. Consulta e cancelamento de fluxo usam empresa, sessão e conversa.
- Aceitação HTTP somente após persistência da fila, deduplicação por intenção e etapa, erro recuperável e validação do destino e dos recursos da empresa autenticada.
- Acesso temporário a arquivos por caminho e empresa, sem JWT em URL; armazenamento durável e compatibilidade com arquivos antigos que tenham propriedade comprovada.
- Provedores, conhecimento, métricas e evolução sem dados comerciais de exemplo ou fallback para outra empresa. Logs legados sem propriedade comprovável não são expostos.
- Publicação da VPS por versão e artefato revisados, com snapshot de banco, autenticação e arquivos, gates de saúde e rollback. Nenhuma migração ou seed nesta atualização.
- O comando de TypeScript agora verifica os arquivos reais da aplicação.

## Unreleased — 2026-09-22: Memória por WhatsApp e criação de atendentes

- Memória persistente própria e isolada por WhatsApp: recuperação pós-reconexão no PostgreSQL vinculada por empresa proprietária, conexão e cliente.
- Vínculo opcional com lojas da mesma conta: concessão de conhecimento oficial sem transferência ou mescla do histórico de conversas da conexão. Ao desvincular, o acesso é revogado preservando a memória própria do número.
- Criação supervisionada de atendentes em três vias nas telas de Conexões e Atendentes: Manual, IA por prompt e Leitura de conversas anteriores.
- Configuração de segmento da loja, tipo de atendimento e conexões atendidas com prévia editável e ativação explícita.
- Evolução de estilo estruturada e versionada: propostas automáticas limitadas a estilo (tom, extensão), mantendo regras comerciais, preços e políticas sob revisão manual, com capacidade de restauração e pausa da evolução.
- Migração versionada `035_session_agent_memory` para isolamento de memórias por conexão, lojas e versionamento de agentes.

## Unreleased — 2026-09-18


- Histórico WhatsApp com fila PostgreSQL, retomada, deduplicação por empresa/sessão/conversa e recuperação de mídias, sem disparar atendimento ou alterar não lidas.
- Novas conexões autenticadas geram um atendente em rascunho a partir do histórico; números existentes podem habilitar o aprendizado em IA → Evolução.
- Revisão de autoria, evidências anonimizadas, comparação em conversas reservadas, publicação versionada e preservação da configuração ativa até a revisão.
- Visão de imagens real no lugar do retorno simulado. Mídias indisponíveis e limites de cobertura ficam explícitos.
- Migração aditiva `034_whatsapp_history_bootstrap`; implantação e contratos em [docs/runtime/whatsapp-history-bootstrap.md](docs/runtime/whatsapp-history-bootstrap.md).

## [1.1.1] - 2026-07-02

### Added
- **Database Bootstrap & Migration Stabilization**:
  - Added dynamic PostgreSQL configuration of `pg_hba.conf` and `postgresql.conf` (listen_addresses) on any Linux distribution (Ubuntu, Debian, AlmaLinux, Rocky Linux, CentOS).
  - Prepend TCP local trust rules in `pg_hba.conf` to allow seamless local TCP loopback authorization.
  - Safe verification and creation of role `zapai` and database `zapai_crm`, updating the password if they exist.
  - Generates complete `.env.production` including all Standard `POSTGRES_*` variables and legacy `DB_*` aliases to prevent empty fields.
  - Created a robust `wait-for-postgres` check loop prior to migrations.
  - Created a real query connection test using `psql` and the final `DATABASE_URL` (running `SELECT 1`) to guarantee connection before running migrations.
  - Added a final verification step checking PostgreSQL, Redis, Nginx, PM2, psql connection, and backend health before finishing.
  - Fixed Nginx HTTP-to-HTTPS redirect loop (`ERR_TOO_MANY_REDIRECTS`) in `deploy/install.sh`.
  - Added a smart redirect rule in the port 80 block that checks `$http_x_forwarded_proto` to support SSL termination under reverse proxies like Cloudflare Flexible SSL, bypasses redirect for direct IP accesses, and ignores ACME challenges.
  - Used `certbot certonly --webroot` to request Let's Encrypt certificates without letting Certbot inject buggy auto-redirect rules into the configuration.
  - The installer now generates an HTTP-only Nginx configuration initially, ensuring Nginx starts cleanly without missing SSL files, and dynamically upgrades it to full SSL/HTTPS configuration with smart redirects once the certificates exist on disk.
  - Disabled RHEL default port 80 server block inside `/etc/nginx/nginx.conf` by renaming its `default_server` directives, avoiding port 80 conflicts.
  - Refactored the entire deployment script into a fully modular layout with dedicated modules in `deploy/lib/` (`common.sh`, `os.sh`, `packages.sh`, `node.sh`, `postgres.sh`, `redis.sh`, `nginx.sh`, `pm2.sh`, `firewall.sh`, `env.sh`, `health.sh`, `utils.sh`, `validate.sh`).
  - Added a validation script `deploy/lib/validate.sh` that checks for the existence of all expected functions before running `main()` to guarantee a fail-fast, clean execution.
  - Created an automated test suite script `deploy/test-install.sh` that checks module syntax and imports to verify layout integrity before deployment.

## [1.1.0] - 2026-07-02

### Added
- **Universal Linux OS Deploy Support**:
  - Auto-detection of RHEL-based systems (AlmaLinux, Rocky Linux, RHEL, CentOS) alongside Debian-based systems (Ubuntu, Debian) inside `deploy/install.sh` using `/etc/os-release`.
  - Added auto-enabling of the **EPEL** repository on RHEL-based systems.
  - Added package manager wrappers (`install_packages`, `update_packages`, `enable_service`, `start_service`, `restart_service`) to automatically choose the correct command (`apt-get` or `dnf`).
  - Added support for AlmaLinux Node.js v20 module registration.
  - Added PostgreSQL automatic initialization (`postgresql-setup --initdb`) and database user/db creation on RHEL-based OS.
  - Added Redis RHEL/AlmaLinux service wrapper configuration.
  - Created Nginx compatibility layer directories (`/etc/nginx/sites-available`, `/etc/nginx/sites-enabled`) on RHEL-based installations and linked them automatically to `nginx.conf`.
  - Added Firewalld firewall configuration support using `firewall-cmd` alongside UFW support.
- **Cross-platform Deploy Script**:
  - Replaced the batch script (`ZAPAI-DEPLOY.bat`) with `scripts/deploy-vps.js`, a cross-platform Node.js script.
- **Web UI & REST API Deploy Controls**:
  - Added `POST /config/ai/deploy-vps` endpoint in `backend/routes/aiConfig.js`.
  - Added `deployVPS` API method in frontend `apiService.ts`.
  - Integrated the **Deploy VPS** button in `AIView.tsx` under the System Health status card.

### Fixed
- Fixed backend temperature resolving logic in `ai.service.js` to correctly support temperature `0` instead of falling back to default `0.6`.
- Fixed prompt system guidelines to make AI responses more natural, varied, and conversational.
