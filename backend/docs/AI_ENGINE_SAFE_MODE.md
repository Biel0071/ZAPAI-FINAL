# AI Engine Control Layer (SAFE MODE)

Esta camada ativa um fluxo de evolucao continua, segura e rastreavel para o projeto.

## Principios

- SAFE MODE permanente
- Evolucao incremental por bloco
- Sem alteracao de contrato backend
- Sem delecao de arquivos criticos
- Validacao obrigatoria apos cada mudanca relevante
- Log obrigatorio no formato [ENGINE LOG]

## Scripts

No diretorio raiz do projeto:

- `npm run engine:safe`
- `npm run engine:analyze`
- `npm run engine:validate`
- `npm run engine:monitor`
- `npm run engine:pull-source`
- `npm run engine:commit-msg -- <MODULE> <descricao> <alteracao> <motivo> <impacto>`

## Como usar no dia a dia

1. Antes de mudar codigo
   - Rode `npm run engine:safe`
   - Rode `npm run engine:analyze` (se `AI_ENGINE_CMD` estiver configurado)
   - Rode `npm run engine:pull-source` para sincronizar a engine separada

2. Durante alteracoes
   - Trabalhe por blocos pequenos
   - Priorize inbox, sessions, contacts conforme fase atual

3. Depois de cada bloco
   - Rode `npm run engine:validate`
   - Verifique `crm/backend/logs/engine_control.log`
   - Sempre executar checagem visual: verificar no localhost agora

4. Commit rastreavel
   - Gere mensagem base com `npm run engine:commit-msg -- ...`
   - Organize commit por contexto: inbox, adapter, ui

## Formato de commit

`[MODULE] descricao curta`

Detalhes:

- alteracao:
- motivo:
- impacto:

## Variaveis opcionais de ambiente

- `AI_ENGINE_CMD`: comando real da sua engine para analise.
   - Exemplo local separado: `AI_ENGINE_CMD=node C:/projetos/ai-whatsapp-saas/ai-engine/cli/index.js analyze .`
- `ENGINE_MONITOR_INTERVAL_MS`: intervalo do monitor em ms.
  - Padrao: `30000`

## Estrutura recomendada (separada)

- Projeto principal: `C:/projetos/ai-whatsapp-saas/backend/baileys-server`
- AI Engine separado: `C:/projetos/ai-whatsapp-saas/ai-engine`

Com essa estrutura, a engine ajuda o projeto sem acoplar codigo fonte dentro do CRM.

## Logs gerados

- `crm/backend/logs/engine_control.log`
- `crm/backend/logs/engine_commit_suggestions.md`

## Nota sobre GitHub

Se o diretorio ainda nao estiver versionado com git, inicialize:

1. `git init`
2. `git branch -M main`
3. `git remote add origin https://github.com/Biel0071/AI-ENGINE.git`

Depois use commits incrementais e push continuo por contexto.
