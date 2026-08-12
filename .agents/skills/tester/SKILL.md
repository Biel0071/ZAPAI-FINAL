---
name: tester
description: Use para escrever, executar e validar testes no ZAPFLOW — TDD, unitários (Vitest), integração (backend), E2E (Playwright), regressão e cobertura. Aciona ao implementar features novas, corrigir bugs, ou antes de qualquer merge/deploy.
---

# Tester Skill

Responsável por garantir cobertura de testes no ZAPFLOW AI, integrando-se ao pipeline existente.

## Hierarquia de Testes

```
1. UNIT (Vitest — frontend-official/)
   → funções puras, hooks, utils, componentes isolados
   → rodar: ../node.exe node_modules/vitest/bin/vitest.js run

2. INTEGRATION (Node.js — backend/)
   → rotas + serviços com banco real (test DB)
   → APIs REST com dados reais de tenant

3. E2E (Playwright — frontend-official/tests/ui/)
   → fluxos completos: login → dashboard → ação → resultado
   → suites disponíveis:
      - discovery-crawler.spec.ts    (mapeamento completo)
      - complete-audit.spec.ts       (auditoria de UI)
      - hardening-stress.spec.ts     (stress e performance)
      - test-inbox-send.spec.ts      (envio de mensagens)
      - zapai-crm.e2e.spec.ts        (fluxo CRM completo)

4. SMOKE (scripts/run-e2e-smoke.js)
   → verificação rápida pós-deploy
   → npm run test:e2e (aprovação ≥ 80%)

5. QA SUITE (scripts/qa/run-qa.js)
   → npm run qa → qa-report.md + qa-report.json
```

## TDD — Ordem Obrigatória

```
RED   → escrever teste que falha (comportamento esperado)
GREEN → implementar código mínimo para passar
REFACTOR → melhorar sem quebrar
```

**Para bugs:** escrever teste que reproduz o bug ANTES de corrigir.

## Contexto ZapFlow

```javascript
// Frontend (Vitest)
// - Testar componentes com múltiplos tenants
// - Verificar que dados de tenant A nunca aparecem para tenant B
// - Mocks de WebSocket (Socket.IO)

// Backend (integration)
// - Cada request precisa de x-tenant-id header
// - Usar banco de teste separado (não produção)
// - Limpar dados após cada teste
```

## Checklist de Cobertura

- [ ] Caminho feliz (entrada válida → resultado esperado)
- [ ] Caminho de erro (entrada inválida → erro correto)
- [ ] Isolamento multi-tenant (tenant A não vê dados do B)
- [ ] Autenticação (request sem token → 401)
- [ ] Limites (paginação, max items, tamanho de upload)
- [ ] Regressão (cenários de bugs anteriores cobertos)

## Saída

- Relatório de testes em `outros/reports/qa/`
- Cobertura documentada
- Falhas registradas com evidência
- Nunca marcar como concluído com teste falhando
