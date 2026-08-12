---
name: orchestrator
description: Use para determinar quais skills carregar para uma tarefa específica no ZAPFLOW — detectar a intenção, selecionar o conjunto mínimo de skills necessárias e definir o pipeline de agentes. Aciona ao receber qualquer tarefa nova para garantir que o contexto seja mínimo e preciso.
---

# Orchestrator Skill

Responsável por rotear tarefas para o pipeline correto e carregar **somente as skills necessárias**.

**Objetivo: Reduzir contexto. Aumentar precisão. Reduzir custo. Reduzir alucinação.**

## Pipeline Padrão

```
REQUIREMENT
      ↓
BRAINSTORM (se não trivial)
      ↓
ARCHITECT (se afeta estrutura)
      ↓
PLAN (aprovação do usuário)
      ↓
DEVELOPER
      ↓
TESTER
      ↓
REVIEWER ──→ SECURITY (se tocou auth/secrets)
         └──→ PERFORMANCE (se tocou queries/bundle)
      ↓
VALIDATOR
      ↓
RELEASE (somente após todos os gates)
```

## Mapa de Intenção → Skills

### Bug Fix
```
Detectar: "corrija", "bug", "erro", "não funciona", "falha", "quebrou"
Carregar:
  - debugger      (análise root cause)
  - developer     (implementação do fix)
  - tester        (teste que reproduz o bug)
  - reviewer      (verificação)

NÃO carregar: brainstorming, release, performance, database (se não relevante)
```

### Bug de Autenticação / Segurança
```
Detectar: "auth", "login", "token", "JWT", "permissão", "acesso negado",
          "tenant", "segurança", "vazamento", "injection"
Carregar:
  - debugger
  - security      (verificação de segurança)
  - developer
  - tester
  - reviewer
```

### Nova Feature
```
Detectar: "criar", "adicionar", "implementar", "nova funcionalidade", "feature"
Carregar:
  - brainstorming (exploração de alternativas)
  - architect     (design da solução)
  - developer     (implementação)
  - tester        (cobertura)
  - reviewer      (revisão)
```

### Refatoração
```
Detectar: "refatorar", "refactor", "limpar", "reorganizar", "simplificar"
Carregar:
  - architect     (verificar impacto)
  - karpathy      (questionar necessidade)
  - developer     (implementação)
  - reviewer      (verificação de regressão)
  - tester        (confirmar que nada quebrou)
```

### Performance
```
Detectar: "lento", "performance", "otimizar", "query lenta", "bundle grande",
          "tempo de resposta", "latência", "memória"
Carregar:
  - autonomous-improvement (ciclo de melhoria com métricas)
  - performance   (análise de performance)
  - architect     (solução arquitetural se necessário)
  - developer
  - tester
  - reviewer
```

### Database / Schema
```
Detectar: "migration", "schema", "tabela", "coluna", "índice", "query"
Carregar:
  - database      (análise de schema e queries)
  - architect     (impacto na arquitetura)
  - developer
  - tester
  - security      (se query envolve dados sensíveis)
```

### Deploy / Release
```
Detectar: "deploy", "publicar", "release", "versão", "produção"
Carregar:
  - qa            (verificação completa)
  - security      (verificação final)
  - release       (processo de release)
  - devops        (se há mudança de infra)

GATE: verificar TODOS os critérios antes de release
```

### Frontend / UI
```
Detectar: "UI", "frontend", "componente", "tela", "interface", "React"
Carregar:
  - developer     (implementação)
  - tester        (Playwright/Vitest)
  - reviewer      (qualidade)
  - qa            (validação visual)
```

## Regras de Carregamento

```
1. MÍNIMO: carregar apenas o que a tarefa requer
2. SEQUENCIAL: não chamar release antes de tester
3. BLOQUEANTE: security falha → não avançar para release
4. ESCALAÇÃO: se skill não resolve → invocar architect
5. LIMITE: máximo 5 skills simultâneas em contexto
```

## Gate de Release

**NÃO executar Release se:**

```
[ ] Testes falharam
[ ] Build falhou
[ ] Review crítico pendente
[ ] Security crítico pendente
[ ] Migrations não validadas
[ ] Health check falhou
[ ] Arquivos proibidos foram alterados (.env, secrets)
[ ] Aprovação explícita do usuário não recebida
```

## Formato de Output do Orchestrator

Ao receber uma tarefa, reportar:

```
🎯 INTENÇÃO DETECTADA: [tipo]
📋 PIPELINE: [lista de etapas]
🔧 SKILLS A CARREGAR: [lista]
⚠️  GATES NECESSÁRIOS: [lista]
🚫 SKILLS NÃO NECESSÁRIAS: [lista - economizando contexto]
```
