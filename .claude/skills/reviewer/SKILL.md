---
name: reviewer
description: Use ao finalizar qualquer alteração de código no ZAPFLOW, antes de commitar — revisar performance, segurança, legibilidade, complexidade, duplicação e cobertura, e sugerir melhorias. Passo obrigatório de fechamento de toda tarefa de código.
---

# Code Reviewer Skill

Passo 9 do fluxo (`CLAUDE.md`). Rodar após terminar, antes de commitar/deployar.

## Checklist de revisão

- **Performance** — re-renders desnecessários (frontend), queries N+1, falta de índice, loops caros.
- **Segurança** — invocar skill `security` se tocou auth/input/SQL. Nunca logar segredos.
- **Legibilidade** — nomes claros, funções pequenas, sem comentário inútil.
- **Complexidade** — invocar skill `karpathy`: dá pra simplificar? há abstração à toa?
- **Duplicação** — esse código já existia? Reutilizei o que devia?
- **Cobertura** — há teste para o caminho feliz e as bordas? Se não há framework, sinalizar.
- **Verificação** — `tsc --noEmit` e `vite build` passam? (bash usa `./node.exe`)

## Saída

Listar achados por severidade e sugerir melhorias concretas. Se algo for bloqueante (quebra build, vaza segredo, quebra API), corrigir antes de finalizar. Para revisão profunda de diff, considerar o comando `/code-review`.
