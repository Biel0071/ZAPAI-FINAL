---
name: brainstorming
description: Use no início de qualquer tarefa complexa, antes de planejar — gerar alternativas, questionar premissas, explorar abordagens divergentes antes de convergir para um plano. Aciona ao receber requisito novo, problema complexo, ou quando o caminho não é óbvio.
---

# Brainstorming Skill

Exploração divergente antes de planejar. **Gerar opções antes de escolher.**

## Quando Usar

- Antes de invocar skill `architect` em problemas não triviais
- Quando há múltiplas abordagens possíveis
- Quando o problema tem ambiguidade
- Quando a solução "óbvia" pode não ser a melhor

## Fluxo

```
1. ENTENDER O PROBLEMA
   → Qual é o problema real? (não o sintoma)
   → Quem é afetado? Qual o impacto?
   → Quais são as restrições reais (não assumidas)?

2. GERAR ALTERNATIVAS (mínimo 3)
   → Solução conservadora (menor risco, menor mudança)
   → Solução ideal (melhor resultado técnico)
   → Solução criativa (abordagem não óbvia)
   → Registrar cada uma com prós/contras

3. QUESTIONAR PREMISSAS
   → A solução precisa existir? (skill karpathy)
   → Há algo já pronto no ZAPFLOW que resolve isso?
   → Estamos resolvendo o problema certo?
   → Qual solução é mais fácil de reverter se errar?

4. AVALIAR TRADE-OFFS
   → Complexidade vs. benefício
   → Velocidade de implementação vs. qualidade
   → Impacto em outras partes do sistema
   → Manutenibilidade futura

5. CONVERGIR
   → Escolher abordagem com justificativa explícita
   → Documentar alternativas descartadas e por quê
   → Passar para skill `architect`
```

## Contexto ZapFlow

Ao brainstormar no ZAPFLOW, sempre considerar:
- **Multi-tenant:** a solução funciona para múltiplas empresas?
- **WhatsApp stateful:** Baileys mantém estado — evitar mudanças que reiniciem conexões
- **Performance:** sistema de mensagens requer latência baixa
- **Deploy incremental:** mudanças devem ser deployáveis sem downtime

## Saída

Registrar resultado do brainstorming em `outros/plans/<feature>-brainstorm.md`:
- Problema original
- Alternativas consideradas
- Abordagem escolhida
- Justificativa
