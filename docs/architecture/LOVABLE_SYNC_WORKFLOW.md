# LOVABLE_SYNC_WORKFLOW

## Objetivo

Definir o fluxo oficial para usar o Lovable como fonte visual de verdade sem transformar a branch do Lovable em runtime executável.

## Fluxo oficial

1. A UI é alterada no Lovable.
2. O Lovable publica commits reais na branch `lovable-sync`.
3. O diff é revisado por humanos.
4. Apenas a superfície permitida (`frontend-official/src/lovable/**`) é absorvida.
5. Adapters/wrappers atualizam a integração no `frontend-official/`.
6. Build, testes, Playwright e restart oficial validam o merge.
7. O merge final vai para `main`.

## Branches

- `main`
  - runtime oficial
  - deployável
- `lovable-sync`
  - ingestão visual
  - não deploya
- branches de integração
  - usadas para reconciliar diffs do Lovable com runtime oficial

## Regra estrutural

O Lovable não publica diretamente em:
- `src/App.tsx`
- `src/main.tsx`
- `src/providers/**`
- `src/services/**`
- `src/stores/**`
- páginas runtime-aware protegidas

A branch `lovable-sync` deve abastecer somente a camada visual controlada.
