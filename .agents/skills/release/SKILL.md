---
name: release
description: Use somente quando todos os gates de qualidade passaram — testes aprovados, build aprovado, review aprovado, security aprovado — para preparar CHANGELOG, version bump e gate de deploy. NUNCA fazer deploy automático. Aciona explicitamente após ciclo completo Architect→Developer→Tester→Reviewer→Security.
---

# Release Skill

Gate final do pipeline ZapFlow. **Bloqueado se qualquer gate anterior falhou.**

## Gates Obrigatórios (todos devem estar VERDE)

```
[ ] Testes unitários passaram       (npm run test no frontend)
[ ] Build de produção compilou      (vite build)
[ ] TypeScript sem erros            (tsc --noEmit)
[ ] QA suite aprovada               (npm run qa)
[ ] Smoke E2E aprovado              (npm run test:e2e ≥80%)
[ ] Code review concluído           (skill reviewer)
[ ] Security check realizado        (skill security)
[ ] Migrations validadas            (se houver alteração de schema)
[ ] Health check do backend passou  (backend/scripts/healthcheck.js)
[ ] Nenhum arquivo proibido alterado (.env*, secrets, produção)
```

## Se qualquer gate falhar

**PARAR.** Não avançar. Reportar o gate que falhou e retornar ao responsável.

## Processo de Release

```
1. VERIFICAR GATES (acima)

2. CHANGELOG
   → atualizar CHANGELOG.md
   → formato: ## [versão] - YYYY-MM-DD
   → listar: Added, Changed, Fixed, Security

3. VERSION BUMP
   → atualizar version em package.json (semver)
   → patch: bugfix
   → minor: nova feature
   → major: breaking change

4. DOCUMENTAR
   → descrever o que foi feito em outros/reports/
   → registrar decisões importantes

5. PREPARAR (mas NÃO executar deploy)
   → gerar artefato de release em outros/reports/
   → aguardar aprovação explícita do usuário para deploy
```

## Deploy — Requer Autorização Explícita

```
NUNCA executar automaticamente:
  - git push
  - docker-compose up --build
  - pm2 restart
  - deploy.sh
  - qualquer comando de produção

Aguardar aprovação explícita do usuário antes de qualquer operação
de produção. O usuário pode usar ZAPFLOW-CONTROL.bat ou scripts
de deploy manuais quando decidir fazer o deploy.
```

## Saída

- `CHANGELOG.md` atualizado
- `package.json` com nova versão
- Relatório de release em `outros/reports/release-<versão>.md`
- **Nenhum deploy automático**
