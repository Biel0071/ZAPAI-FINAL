# Prontidão operacional ZAI — plano de implementação

## Objetivo

Deixar operacionais as sete telas principais do ZAI na VPS, com mensagens WhatsApp reais, dados coerentes, equipe autorizada por número e módulo, Avatar Studio consistente, copiloto interno e notificações persistentes.

## Restrições e decisões

- Preservar alterações locais existentes; implementar sobre o checkout atual e publicar depois somente commits revisados em checkout limpo.
- Isolar todas as leituras, gravações, sockets e mídias por tenant; permissões de usuário e sessão também são verificadas no servidor.
- A Inbox publica inbound após persistência e não espera IA/webhooks. Histórico e snapshots nunca substituem mensagens realtime mais novas.
- Dashboard usa filtros comuns de tenant, número, intervalo e fuso; métricas desconhecidas são `—`, nunca fallback fictício.
- O Avatar Studio usa composição única em camadas com aparência pixel art para edição e vistas; PNGs integrais servem como prévia/referência. Abas: Cabelo, Rosto, Roupa e Acessórios; título `Avatar Studio`.
- Loja DNA é acessível para leitura e edição somente por `master_admin` da empresa identificada por configuração explícita do tenant ZAI.
- Copiloto é interno; ferramentas podem buscar dados e propor mudanças. Envio de mensagens, edição de contatos, atribuição e campanhas exigem prévia, confirmação e auditoria. Atendentes WhatsApp continuam separados.
- Admin pode convidar por conta pré-criada ou autoinscrição. Token de convite é de uso único; concessão dura 1 dia, 1 semana, 1 mês ou 1 ano. Número, contato e permissões por módulo/ação são aplicados em API e socket.
- Primeiro IP é vinculado à conta. Login por IP novo fica pendente até aprovação do admin. Sessão/JWT é curta e não substitui checagem de expiração/revogação.
- Relatórios distinguem tokens e custo de IA estimado por tarifa registrada do custo interno por dia/mês. Dados históricos sem autor ficam sem atribuição; atividade humana é registrada prospectivamente.
- Notificações do painel são persistentes e por usuário; notificações do navegador são opcionais. Ocultar módulos sem função operacional publicada.
- Homologação WhatsApp usa somente o contato informado: `31993807167`.

## Fatias

1. **Inbox e identidade:** testes de regressão para tenant/sessão, retry, mensagem duplicada, snapshot atrasado e reconexão; propagar empresa/sessão/JID; deduplicar após sucesso durável; publicar por sala autorizada; mesclar histórico sem apagar eventos recentes; mover efeitos secundários lentos para execução limitada. Estados de envio refletem fila, entrega, leitura e falha.
2. **Equipe, autorização e métricas:** endurecer rotas de usuário por tenant e papel; criar convites, concessões, aprovação de IP e revogação; permissões view/action para Dashboard, Inbox, Campanhas e Contatos; seleção de números e contato atribuído; capturar autor em mensagens, IA, campanhas e atribuições. Registrar atividade, tempo de resposta, tokens e tarifas; exibir custos interno e estimado em BRL.
3. **Notificações:** substituir lista fixa do sino por armazenamento e API por usuário; criar para inbound atribuído, transferência, desconexão, campanha concluída/falha e acesso/IP; atualizar em realtime; persistir leitura e preferências; browser notification somente após consentimento.
4. **Dashboard e demo:** agregar do backend com período/fuso/sessão comuns; corrigir a semântica da fila e dos gráficos; geografia por endereço real e DDD apenas agregado; remover fallback de agente/modelo; manter exemplos apenas na galeria e remover sua execução pelo sandbox de produção.
5. **Avatar e vínculos:** normalizar campos de slots legados; atualizar somente o slot escolhido; mesmo renderizador em frente, movimento e giro; salvar/reabrir sem drift; título e quatro categorias; controlar Loja DNA no cliente e servidor; expor prévia nos vínculos.
6. **Copiloto e conclusão das telas:** adicionar ferramentas autenticadas de leitura e proposta/execução, com confirmação e idempotência; revisar rotas e controles das telas Dashboard, Inbox, Conexões, Atendente IA, Campanhas, Contatos e Configurações; ocultar páginas e opções incompletas e aplicar role gate a rotas diretas.
7. **Release:** Graphify manual após alterações estruturais; corrigir TypeScript baseline; suíte backend, Vitest, lint, build e E2E; publicar SHA limpo via deploy revisado, com snapshot/migrações aditivas e rollback; verificar saúde, API e Socket.IO; teste bidirecional no contato autorizado.

## Interfaces e persistência

- Estender métricas existentes com período, fuso e sessão permitida; manter compatibilidade de resposta.
- Estender rotas de usuário existentes com convites, permissões, aprovação de IP e métricas; adicionar rotas autenticadas de notificações e turnos/confirmação do copiloto.
- Migrações aditivas para convites/acesso/sessões/IP, atribuição de conversas e atividade, eventos/notificações, autoria de mensagens/uso de IA e tarifas versionadas. IDs de usuário em JWT são complementares; autorização consulta estado revogável.
- Preservar payload de avatar; aceitar aliases legados e formatar campos na fronteira antes do renderer.

## Aceitação

- Em conexão saudável, p95 do evento inbound persistido até a Inbox visível ≤2 s; inbound/outbound, mídia, grupos, reconexão e reload não perdem nem duplicam mensagens.
- Testar duas empresas e múltiplos números, mesmo telefone/ID, webhooks lentos, retry, token expirado/revogado, IP não aprovado, módulos/ações não autorizados, mídia e salas socket.
- Cada slot do avatar muda isoladamente; giro, prévia, salvar e reabrir preservam composição; opções antigas continuam visíveis; exemplos não persistem.
- Dashboard e copiloto usam respostas reais com carregando/vazio/erro/indisponível; nenhuma tela operacional mostra dataset de demo, placeholder ou sucesso fictício.
- Administrador ZAI acessa Loja DNA; qualquer usuário comum ou tenant diferente recebe 403, inclusive no GET.
- Testar notificações e aceite/rejeição de ações do copiloto; campanhas mostram contagem/destinatários antes da confirmação.
- A linha de base verificada tem 35 testes backend e 28 frontend direcionados aprovados; `npm run tsc` falha em oito incompatibilidades atuais de catálogo/prévia de avatar. O gate final exige correção, testes completos, typecheck e build aprovados.
