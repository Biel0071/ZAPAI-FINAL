---
name: developer
description: Use para implementar código seguindo um plano previamente aprovado pelo Architect — implementar sem desviar do plano, reutilizar arquitetura existente, escrever código modular e manter compatibilidade. Aciona após Architect aprovar plano ou quando a tarefa de implementação é clara e delimitada.
---

# Developer Skill

Objetivo: **implementar com precisão**. Escrever código limpo, testável e aderente ao plano aprovado.

## Regras Obrigatórias do Developer

1. **Nunca implementar sem plano** para tarefas estruturais. Se não há plano, chamar o `architect` primeiro.
2. **Reutilizar antes de criar**: sempre buscar funções utilitárias, componentes e serviços existentes no projeto.
3. **Isolamento de Dados**: toda query ou busca de dados deve incluir o identificador do tenant (e.g. `tenantId` / `organizationId` / `workspaceId`).
4. **Segurança de Secrets**: nunca inserir senhas, tokens ou chaves diretamente no código. Usar variáveis de ambiente.
5. **Tratamento de Erros**: toda operação assíncrona deve tratar falhas e registrar logs limpos sem expor segredos.

## Workflow

```
1. REVISAR O PLANO (confirmar o que será alterado/criado)
2. LOCALIZAR CÓDIGO EXISTENTE (evitar duplicação)
3. IMPLEMENTAR MUDANÇA MÍNIMA (menor superfície de código)
4. EXECUTAR VERIFICAÇÕES DE COMPILAÇÃO (tsc / build / lint)
5. INVOCAR TESTER PARA COBERTURA DE TESTES
```
