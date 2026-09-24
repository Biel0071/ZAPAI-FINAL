# Histórico do WhatsApp e atendente inicial

## Comportamento

Uma nova conexão criada por usuário autenticado fica vinculada à empresa do JWT
antes de abrir o socket. O Baileys solicita histórico completo e o worker tenta
paginar para trás a partir da mensagem mais antiga com chave WhatsApp conhecida.
Não há garantia de recuperar todo o passado da conta. O painel informa datas,
contagens, falhas e pedidos sem resposta, sem usar `isLatest` como prova de completude.

O sync importa conversas individuais (inclusive arquivadas), mensagens enviadas e
recebidas. Grupos, newsletters e eventos de protocolo não entram no aprendizado.
Uma sessão existente também aproveita mensagens já armazenadas: registros sem
chave WhatsApp recebem identidade local `stored:<id>` e não viram cursores remotos.
LIDs não resolvidos permanecem distintos de números de telefone.

Histórico usa persistência própria no repositório canônico de dados. Não passa por
automação, envio, reativação ou eventos de novas mensagens. Mantém não lidas,
estado da conversa e configuração de IA existentes. Conversas novas importadas
começam com IA desligada. A retenção automática de mensagens individuais preserva
as fontes do histórico. Repetições são deduplicadas pela chave composta; mídia e
análise têm checkpoints persistentes. Falhas são retomáveis pelo painel.

## Análise e revisão

- Conexão nova: análise habilitada e destino Camila quando ela existe; senão o
  primeiro agente ativo da empresa ou um novo atendente. Reconectar não desfaz uma pausa.
- Sessão já cadastrada: habilitar em **IA → Evolução → Analisar histórico e gerar atendente**.
  Esse controle permite iniciar o piloto apenas no número da Vista Alegre.
- O primeiro rascunho aguarda a importação/mídias e a redução do fluxo inicial.
  Em uma conta movimentada, a espera por silêncio é limitada a cinco minutos.
- Textos e transcrições longos são processados por janelas retomáveis, sem descartar
  o final da mensagem. Aproximadamente 10% das conversas são reservadas por hash e
  ficam fora da modelagem, disponíveis para a comparação textual.
- Novas mensagens geram versões incrementais no máximo a cada dez minutos.
  Relatórios já processados são reutilizados. Correções de autoria ou recuperação
  de mídia anterior exigem reanálise, porque alteram a evidência de origem.
- `fromMe` não comprova autoria humana. A origem comprovada pelo envio do sistema
  distingue humano, IA e campanha; nas demais situações fica não confirmada.
  O administrador pode corrigir a autoria na revisão de evidências.
- Preços, prazos, estoque, descontos e políticas históricos ficam como propostas
  a confirmar, separados das instruções de linguagem. Informação oficial da loja
  tem prioridade. Não há promoção automática para conhecimento oficial.
- Poucas evidências humanas, falhas de importação ou mídias sem interpretação
  produzem uma proposta parcial, com lacunas explícitas.
- A comparação usa uma pergunta reservada e apenas seu contexto anterior. É uma
  simulação textual, sem envio, ferramentas de venda ou alteração do atendimento.
- Publicar exige administrador, revisão explícita e a revisão criptográfica exata
  do candidato. A transação guarda o agente anterior, o revisor e a versão publicada.
  Não liga o toggle global de IA nem reativa conversas. Para um agente existente,
  preserva sua ativação e os demais campos comerciais.

## Mídias e privacidade

Imagens são interpretadas por um provedor habilitado da empresa com suporte a visão;
áudio usa OpenAI/Groq já configurado no sistema. Sem provedor compatível, a mídia
fica com falha visível. Não é gerada uma descrição simulada. O download de histórico
é limitado a 25 MB e 60 segundos; imagens para visão têm limite de 15 MB. Arquivos
maiores, expirados ou outros anexos são reportados como não interpretados.

A análise usa armazenamento local de mídia vinculado à empresa. Se S3 estiver
habilitado e não houver cópia local, a mídia permanece como falha de interpretação;
não há download arbitrário de URL fornecida por cliente. Conteúdo bruto e chaves
necessárias ao download ficam no banco por empresa/sessão, nunca nos endpoints de
evidência. Nomes de contatos e identificadores são removidos das amostras reutilizáveis;
o prompt exige reescrita sem dados pessoais e a revisão humana continua necessária.

## Implantação

1. Aplicar as migrações pelo runner existente, no diretório `backend`:
   `node scripts/run-migrations.js`. Não usar alterações SQL manuais na produção.
2. Publicar backend e frontend juntos, após a migração. O backend depende das
   novas tabelas e de `messages.message_origin` / `history_item_id`.
3. No piloto Vista Alegre, verificar o número e a empresa autenticada; para uma
   sessão existente, habilitar apenas essa sessão em IA → Evolução.
4. Conferir o worker `whatsapp_history`, pendências, período recuperado e configuração
   dos provedores. Revisar/simular o rascunho antes de publicar.
5. Para interromper aprendizado: **Pausar análise contínua**. Para rejeitar uma
   proposta: **Descartar rascunho**. Ambos preservam o atendente ativo. Reverter o
   código não exige apagar as tabelas aditivas; mantenha o snapshot para auditoria.

Não é necessário desconectar números para migrar o banco. A solicitação de histórico
completo passa a valer quando o socket for criado pelo código novo. Não reconectar
à força apenas para tentar contornar limitações do histórico do WhatsApp.

## API

Prefixo `/api/ai/history`. Todas as operações exigem JWT; empresa vem de
`req.authTenantId`, nunca do corpo. A sessão deve pertencer à empresa. Mutações
exigem papel `admin`, `owner`, `superadmin`, `super_admin` ou `manager`.
Respostas usam o envelope geral `{success,data,error}` do servidor.

| Método / rota | Entrada | Resultado |
| --- | --- | --- |
| GET `/` | — | Sessões e atendentes da empresa |
| GET `/:sessionId/status` | — | Contagens, período, lacunas e dez versões recentes com `revision` |
| POST `/:sessionId/resume` | `{}` | Retoma falhas e libera novas tentativas de histórico anterior |
| POST `/:sessionId/learning` | `{enabled:boolean,targetAgentKey:string|null}` | Habilita/pausa a análise por número |
| GET `/:sessionId/evidence?after=0` | Cursor de item | Até 50 evidências anonimizadas e próximo cursor |
| POST `/:sessionId/evidence/:id/author` | `{origin:"human"|"campaign"|"automation"|"unknown"}` | Corrige autoria de mensagem enviada |
| PATCH `/:sessionId/drafts/:id` | `{name,personality}` | Salva revisão de um rascunho |
| POST `/:sessionId/drafts/:id/simulate` | `{}` | Pergunta reservada, resposta atual e proposta |
| POST `/:sessionId/drafts/:id/publish` | `{reviewed:true,expectedRevision}` | Publica exatamente a versão revisada; conflito retorna 409 |
| POST `/:sessionId/drafts/:id/discard` | `{}` | Descarta proposta, sem alterar agente ativo |

401: autenticação ausente/expirada. 403: papel insuficiente ou tenant divergente.
404: sessão/rascunho não pertencente à empresa. 409: estado ou revisão incompatível.
503: dependência indisponível. A API limita requisições e não retorna mensagens brutas de erro do provedor.

## Validação reproduzível

- Unitários: `node --test backend/tests/historyBootstrap.test.js`.
- Integração: definir `HISTORY_TEST_DATABASE_URL` para PostgreSQL local, banco
  descartável chamado **history_bootstrap_test**, e executar
  `node --test backend/tests/historyBootstrap.integration.test.js`.
  O teste recusa outros nomes/hosts e recria o schema público desse banco de teste.
- Frontend: em `frontend-official`,
  `node node_modules/vitest/vitest.mjs run src/test/historyBootstrap.test.tsx`.
- Build: em `frontend-official`, `node node_modules/vite/bin/vite.js build`.

Testes de integração usam PostgreSQL real, JWT real e serialização Baileys real.
Chamadas pagas de IA e tráfego WhatsApp são substituídos nos testes; a coleta real
depende do telefone conectado e dos provedores configurados no ambiente de implantação.
