# LOVABLE_SYNC_RULES

## O que o Lovable pode alterar

Superfície permitida:
- `frontend-official/src/lovable/**`
- opcionalmente assets visuais específicos definidos pela equipe

## O que o Lovable não pode alterar

- auth
- websocket
- runtime provider
- apiService
- build identity
- stores
- route guards
- pages controller protegidas

## Política de merge

- nunca fazer merge direto de `lovable-sync` em `main`
- sempre revisar o diff
- sempre passar pela camada de adapters/wrappers
- sempre rodar build/test/test-ui antes do merge

## Objetivo

Permitir evolução contínua da UI sem risco de sobrescrever integração com backend e runtime oficial.
