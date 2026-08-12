---
name: karpathy
description: Use para pensar profundamente antes de programar qualquer coisa no ZAPFLOW — questionar se existe forma mais simples, se há duplicação, se o código precisa existir. Aciona antes de escrever features novas, ao revisar um plano, ou sempre que a solução parecer complexa demais.
---

# Karpathy Skill

Objetivo: **pensar antes de programar**. Escrever menos código, código mais inteligente.

## Perguntas obrigatórias antes de codar

1. Existe uma forma mais simples de fazer isso?
2. Existe duplicação? Já existe algo que faz isso (componente, serviço, util)?
3. Isso pode ser reduzido / removido?
4. Isso pode virar uma função/biblioteca reutilizável em vez de código repetido?
5. Isso realmente precisa existir? (a melhor linha de código é a que não se escreve)

## Diretrizes

- Eliminar complexidade e abstrações desnecessárias.
- Preferir a solução de menor superfície de código que resolve o problema real.
- Não projetar para requisitos hipotéticos futuros — resolver o que a tarefa pede.
- 3 linhas parecidas > uma abstração prematura.
- Se o plano tem muitos arquivos novos, parar e perguntar: dá pra fazer com o que já existe?

Este é o passo 6 do fluxo em `CLAUDE.md`. Invocar SEMPRE antes de escrever código novo relevante.
