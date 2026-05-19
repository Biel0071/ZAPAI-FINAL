# frontend-official

Frontend oficial ativo do ZAPFLOW AI.

## Runtime oficial
- Esta pasta (`frontend-official/`) é a única fonte de verdade do frontend.
- Dev server: `npm run dev`
- Porta local: `8080`
- Backend esperado em desenvolvimento: `http://127.0.0.1:4025`
- Em produção, o frontend deve preferir same-origin via Nginx/proxy
- O visual/UX vindo do Lovable deve ser absorvido aqui, nunca executado como app paralelo.
- A fonte visual oficial deve entrar pela branch `lovable-sync` e pela superfície `src/lovable/**`, com integração via adapters e wrappers protegidos.

## Fluxo local recomendado
```sh
npm install
npm run dev
```

Ou, a partir da raiz do repositório, use os scripts de runtime único:
```sh
npm run stop
npm run start:official
# ou: npm run dev:clean
```

Abra:
- `http://localhost:8080/login`

## Observações importantes
- Esta pasta é a fonte de verdade do frontend.
- Não usar `frontend/`, clones do Lovable ou conteúdo em `archive/` como runtime principal.
- A autenticação oficial é via backend JWT.
- `apiService`, `socketService`, `RuntimeProvider` e os guards de rota desta pasta são a integração oficial com o backend real.
- O fallback Supabase não deve ser o caminho principal do sistema.

## Testes e validação
```sh
npm run build
npm run test
npm run test-ui
```

## Rotas principais esperadas
- `/login`
- `/dashboard`
- `/connections`
- `/inbox`
- `/settings`
- `/campaigns`
- `/analytics`
- `/diagnostics`
- `/memory`
