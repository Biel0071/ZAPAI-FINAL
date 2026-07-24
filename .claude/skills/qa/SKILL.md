---
name: qa
description: Use para testar e validar o ZAPFLOW — smoke, unitário, integração, Playwright, regressão e validação de logs. Aciona ao finalizar features, antes de deploy, ou ao investigar regressões.
---

# QA Skill

## Executar

- **Type-check:** `../node.exe node_modules/typescript/bin/tsc --noEmit` (de dentro de frontend-official).
- **Build:** `../node.exe node_modules/vite/bin/vite.js build` — pega erros que o tsc não pega (viewModel é `any` em pontos).
- **Unitário:** `vitest run` (frontend).
- **Playwright / UI:** `frontend-official/tests/ui/*` (`playwright test`), baseURL localhost:8080. Suites: complete-audit, discovery-crawler, hardening-stress, test-inbox-send, zapai-crm.e2e.
- **Smoke E2E:** `npm run test:e2e` → `scripts/run-e2e-smoke.js` (aprova ≥80%).
- **QA suite:** `npm run qa` → gera `qa-report.md`/`.json`.
- **Validação no browser:** usar ferramentas `preview_*` (MCP Claude Browser) — testar rotas e abas reais contra a VPS (via `.env.local` proxy).

## Padrão de validação de UI (aprendido)

- Testar TODAS as abas do dashboard e rotas principais após mudança (crashes recorrentes de hook/variável não-importada).
- Confirmar erro "X is not defined" com `vite build` real antes de crer — dev server acumula cache de chunk corrompido.
- Varredura estática: procurar hooks `use[A-Z]` chamados sem import em `src/lovable`, `src/pages`, `src/adapters`.

## Regra

Validar logs após rodar. Limpar arquivos temporários de teste. Não marcar tarefa como concluída com build/teste falhando.
