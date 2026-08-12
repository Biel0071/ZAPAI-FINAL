---
name: autonomous-improvement
description: Use para melhorar aspectos específicos e mensuráveis do ZAPFLOW de forma experimental — sempre com baseline, hipótese, métrica e capacidade de rollback. Aciona quando há evidência de problema de performance, qualidade de código ou processo que pode ser melhorado sistematicamente.
---

# Autonomous Improvement Skill

Implementa o ciclo de melhoria contínua inspirado na metodologia de ratchet loop do Karpathy autoresearch.

**Princípio central: Nenhuma melhoria é válida sem métrica. Sem evidência = sem mudança.**

## O Ciclo

```
OBSERVE
  → identificar o que pode melhorar (com dados, não opinião)
  → exemplos: tempo de resposta da API, tamanho do bundle,
    complexidade ciclomática, cobertura de testes, queries lentas

BASELINE
  → medir o estado atual ANTES de qualquer mudança
  → registrar: métrica, timestamp, ambiente, método de medição
  → sem baseline = não pode provar que melhorou

HYPOTHESIS
  → formular hipótese específica e testável
  → "Se X, então Y vai melhorar em Z%"
  → definir critério de sucesso antecipadamente

CHANGE
  → implementar SOMENTE a mudança hipotética
  → mudança mínima para testar a hipótese
  → não fazer refactor geral junto — isolar variável
  → invocar skill `developer`

RUN
  → executar testes e medições no mesmo ambiente do baseline
  → invocar skill `tester`
  → registrar resultado

MEASURE
  → calcular a diferença: antes vs. depois
  → usar mesma metodologia do baseline
  → ser honesto: se não melhorou, registrar isso

COMPARE
  → comparar com baseline e critério de sucesso
  → a melhoria é estatisticamente significativa?
  → há regressão em outra métrica?

KEEP or REVERT
  → KEEP se: métrica melhorou + sem regressão + critério atingido
  → REVERT se: métrica não melhorou, ou causou regressão, ou falhou
  → registrar decisão e aprendizado
```

## Limites de Iteração

```
max_iterations: 5 (por sessão, conforme policy.json)
max_iterations_per_day: 10

Após atingir limite:
  → parar
  → reportar progresso
  → aguardar aprovação para continuar
```

## Critérios de Aprovação para Mudanças

| Tipo de mudança | Aprovação necessária |
|-----------------|---------------------|
| Otimização de query | Automático (se melhora ≥10%) |
| Refactor de função | Automático (se testes passam) |
| Mudança de arquitetura | Manual obrigatória |
| Mudança de schema DB | Manual obrigatória |
| Qualquer coisa destrutiva | Manual obrigatória |
| Mudança em arquivos de produção | Manual obrigatória |

## Métricas Suportadas no ZAPFLOW

```javascript
// Performance de API
const before = { p50: 45, p95: 120, p99: 350 }; // ms

// Tamanho de bundle frontend
const before = { gzip: '245KB', total: '890KB' };

// Cobertura de testes
const before = { lines: '62%', branches: '45%' };

// Queries lentas (pg_stat_statements)
const before = { avg_time_ms: 145, calls_per_min: 230 };

// Complexidade ciclomática (por arquivo)
const before = { max: 28, avg: 8.4 };
```

## Artefatos

Registrar CADA experimento em `outros/ai/experiments/`:

```markdown
# Experimento: <nome>
Data: YYYY-MM-DD HH:MM
Hipótese: <hipótese>
Métrica: <o que foi medido>
Baseline: <valor antes>
Resultado: <valor depois>
Delta: <% de mudança>
Decisão: KEEP / REVERT
Motivo: <justificativa>
Aprendizado: <o que aprendemos>
```

## O que NÃO fazer

- Melhorar sem medir (é opinião, não melhoria)
- Comparar medições de ambientes diferentes
- Fazer múltiplas mudanças ao mesmo tempo (isolar variáveis)
- Considerar melhoria sem teste de regressão
- Reverter sem registrar por quê
- Ultrapassar limite de iterações sem aprovação
