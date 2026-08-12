# Orchestrator — ZapFlow Engineering Pack

## Missão

Rotear tarefas para o pipeline correto e carregar **somente as skills necessárias**.

**Objetivo: Reduzir contexto. Aumentar precisão. Reduzir custo. Reduzir alucinação.**

---

## Pipeline Padrão

```
REQUIREMENT
      │
      ▼
BRAINSTORM (se não trivial)
      │
      ▼
ARCHITECT (se afeta estrutura)
      │
      ▼
PLAN (aguardar aprovação do usuário)
      │
      ▼
DEVELOPER
      │
      ▼
TESTER
      │
      ▼
REVIEWER ──────┬──────────────────┐
               ▼                  ▼
           SECURITY          PERFORMANCE
               │                  │
               └─────────┬────────┘
                          ▼
                      VALIDATOR
                          │
                          ▼
                       RELEASE
                   (só após gates)
```

---

## Mapa de Intenção → Pipeline

### 🔴 Bug Fix
```yaml
detectar: "corrija", "bug", "erro", "não funciona", "falha", "quebrou", "exception"
pipeline:
  - DEBUGGER       → identificar root cause
  - DEVELOPER      → implementar fix
  - TESTER         → teste que reproduz + verifica fix
  - REVIEWER       → verificação de qualidade
skills_a_carregar:
  - debugger
  - developer
  - tester
  - reviewer
skills_a_omitir:
  - brainstorming, architect, release, performance, database (se não relevante)
```

### 🔴 Bug de Autenticação / Multi-Tenant
```yaml
detectar: "auth", "login", "token", "JWT", "permissão", "tenant", "acesso negado", "vazamento"
pipeline:
  - DEBUGGER + SECURITY → análise simultânea
  - DEVELOPER           → fix
  - TESTER              → cobertura de segurança
  - REVIEWER + SECURITY → revisão dupla
skills_a_carregar:
  - debugger
  - security
  - developer
  - tester
  - reviewer
```

### 🟡 Nova Feature
```yaml
detectar: "criar", "adicionar", "implementar", "nova funcionalidade", "feature", "preciso de"
pipeline:
  - BRAINSTORM → alternativas
  - ARCHITECT  → design
  - PLAN       → aprovação usuário
  - DEVELOPER  → implementação
  - TESTER     → cobertura
  - REVIEWER   → revisão
skills_a_carregar:
  - brainstorming
  - architect
  - developer
  - tester
  - reviewer
  - karpathy (invocado por developer)
```

### 🟡 Refatoração
```yaml
detectar: "refatorar", "refactor", "limpar", "reorganizar", "simplificar", "melhorar código"
pipeline:
  - ARCHITECT → verificar impacto
  - DEVELOPER → implementar com karpathy check
  - TESTER    → confirmar sem regressão
  - REVIEWER  → verificação de qualidade
skills_a_carregar:
  - architect
  - karpathy
  - developer
  - tester
  - reviewer
skills_a_omitir:
  - brainstorming, security (exceto se tocou auth), release
```

### 🟠 Performance
```yaml
detectar: "lento", "performance", "otimizar", "query lenta", "bundle grande", "latência", "memória"
pipeline:
  - OBSERVE BASELINE → autonomous-improvement
  - ARCHITECT        → solução se necessário
  - DEVELOPER        → implementar
  - TESTER           → validar melhoria com métrica
  - REVIEWER + PERFORMANCE → revisão
skills_a_carregar:
  - autonomous-improvement
  - performance
  - architect (se estrutural)
  - developer
  - tester
  - reviewer
```

### 🟠 Database / Schema
```yaml
detectar: "migration", "schema", "tabela", "coluna", "índice", "query", "banco"
pipeline:
  - DATABASE  → análise de schema e queries
  - ARCHITECT → impacto na arquitetura
  - DEVELOPER → implementar
  - TESTER    → testar queries e isolamento
  - SECURITY  → se query envolve dados sensíveis
skills_a_carregar:
  - database
  - architect
  - developer
  - tester
  - security (se dados sensíveis)
```

### 🟢 Frontend / UI
```yaml
detectar: "UI", "frontend", "componente", "tela", "interface", "React", "visual"
pipeline:
  - DEVELOPER → implementar
  - TESTER    → Playwright + Vitest
  - REVIEWER  → qualidade
  - QA        → validação visual
skills_a_carregar:
  - developer
  - tester
  - reviewer
  - qa
skills_a_omitir:
  - database, devops, security (exceto se auth-related)
```

### 🔵 Deploy / Release
```yaml
detectar: "deploy", "publicar", "release", "versão", "produção"
pipeline:
  - VERIFICAR GATES → qa + security
  - RELEASE         → preparar artefato
  - AGUARDAR DEPLOY → aprovação manual
skills_a_carregar:
  - qa
  - security
  - release
  - devops (se mudança de infra)
```

---

## Regras de Carregamento

```
1. MÍNIMO: carregar apenas o que a tarefa requer (máx 5 skills simultâneas)
2. SEQUENCIAL: respeitar ordem do pipeline — não chamar Release antes de Tester
3. BLOQUEANTE: Security CRÍTICO → parar pipeline, não avançar
4. ESCALAÇÃO: skill não resolve em 2 iterações → invocar Architect
5. LIMITE DE CONTEXTO: nunca carregar Engineering Pack inteiro de uma vez
```

---

## Gates de Release — HARD STOPS

**NÃO executar Release em NENHUMA circunstância se:**

```
🛑 Testes falharam
🛑 Build falhou (vite build ou tsc --noEmit)
🛑 Code review não concluído
🛑 Security crítico pendente
🛑 Migrations não validadas
🛑 Health check falhou
🛑 Arquivos proibidos foram alterados (.env, secrets, deploy)
🛑 Aprovação explícita do usuário não recebida para deploy
```

---

## Operações Nunca Permitidas (em nenhum pipeline)

```
❌ git push automático
❌ git push --force
❌ docker-compose up --build em produção
❌ pm2 restart em produção sem aprovação
❌ Execução de deploy.sh, deploy-vps.js, deploy-master.js
❌ Modificar .env ou qualquer secrets
❌ Modificar banco de dados em produção sem migration validada
❌ Deletar arquivos de código existente
❌ Copiar repositórios externos para dentro do projeto
❌ Executar scripts de vendors automaticamente
```

---

## Output do Orchestrator

Ao receber uma nova tarefa, reportar antes de executar:

```
🎯 INTENÇÃO DETECTADA: [Bug Fix / Nova Feature / Refactor / Performance / ...]
📋 PIPELINE: [etapas em ordem]
🔧 SKILLS CARREGADAS: [lista mínima]
🚫 SKILLS OMITIDAS: [lista — economizando contexto]
⚠️  GATES NECESSÁRIOS: [lista de verificações]
⏸️  PONTO DE APROVAÇÃO: [onde aguardar confirmação do usuário]
```
