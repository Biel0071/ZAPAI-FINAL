---
name: debugger
description: Use ao investigar qualquer bug, erro, falha ou comportamento inesperado no ZAPFLOW — seguir o fluxo REPRODUCE→TRACE→HYPOTHESIS→ROOT CAUSE→FIX→TEST→VERIFY. Aciona quando há erro relatado, stacktrace, falha de teste, comportamento incorreto ou regressão detectada.
---

# Debugger Skill

Responsável por análise sistemática de falhas no ZAPFLOW AI. Nunca pular etapas para "ir logo para a solução".

## Fluxo Obrigatório

```
REPRODUCE
  → confirmar que o erro é reproduzível
  → documentar: input exato, ambiente, versão, timestamp

OBSERVE
  → ler logs completos (backend/logs/, pm2 logs, browser console)
  → identificar stacktrace exato
  → nunca confiar em memória — verificar o erro real agora

TRACE
  → seguir o fluxo de execução pelo código
  → identificar onde o comportamento diverge do esperado
  → usar grep/find para localizar o ponto de falha

HYPOTHESIS
  → formular hipótese específica e testável
  → "O erro ocorre porque X faz Y quando deveria fazer Z"
  → listar hipóteses alternativas se não for óbvio

ROOT CAUSE
  → confirmar hipótese com evidência do código/logs
  → nunca assumir root cause sem evidência

FIX
  → implementar correção mínima que resolve o root cause
  → não fazer refactor junto com fix de bug (separar commits)
  → invocar skill `developer` para implementação

TEST
  → adicionar teste que reproduz o bug antes da correção
  → confirmar que o teste falha sem o fix, passa com o fix
  → invocar skill `tester`

VERIFY
  → re-testar em ambiente real
  → verificar que não causou regressão
  → invocar skill `reviewer`
```

## Regras

- **Nunca mascarar erro** para fazer teste passar (ex: `try { } catch { return null }`).
- **Nunca remover assertion** que falha — investigar por que falha.
- **Nunca suprimir log de erro** sem entender a causa.
- Se o erro é intermitente, registrar condição de reprodução em `outros/diagnostics/`.
- Se não conseguir reproduzir em 3 tentativas, documentar o que foi testado e escalar.

## Onde buscar evidências no ZAPFLOW

```
backend/logs/          — logs do Express/WhatsApp/PM2
pm2 logs               — processo em produção
browser DevTools       — erros de frontend
.env / config          — configuração errada?
backend/config/database.js — queries com problema?
graphify-out/graph.json    — dependência circular?
```

## Saída

Documentar em `outros/diagnostics/<issue>-debug.md`:
- Root cause identificado
- Evidências encontradas
- Fix aplicado
- Teste adicionado
- Verificação realizada
