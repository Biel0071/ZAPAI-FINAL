---
name: security
description: Use ao tocar autenticação, autorização, entrada de usuário, SQL, headers ou segredos no ZAPFLOW — verificar JWT, SQL injection, XSS/CSRF, rate limit, headers e vazamento de secrets. Aciona em mudanças de auth, endpoints novos, queries com input de usuário, ou antes de finalizar mudanças sensíveis.
---

# Security Skill

## Verificar

- **JWT** — HS256 nativo (`middleware/jwtAuth`). Tokens no header Bearer + `x-tenant-id`. Não confiar em role vindo do cliente; validar no backend.
- **RLS / multi-tenant** — todo acesso a dados filtra por `companyId`/`tenantId`. Nunca vazar dados entre tenants.
- **SQL Injection** — sempre queries parametrizadas (`query(text, params)`), NUNCA interpolar input em SQL. Já é o padrão em `config/database.js`.
- **XSS** — não usar `dangerouslySetInnerHTML` com conteúdo de usuário; React escapa por padrão.
- **CSRF** — APIs stateless com Bearer token (não cookie de sessão), risco baixo; manter assim.
- **Headers** — `helmet` ativo no Express; nginx adiciona CSP/X-Frame-Options. Não remover.
- **Secrets** — nunca commitar `.env*`, tokens, senhas. Scripts em `tmp_ssh/` têm a senha da VPS: já gitignorados, nunca versionar. Não logar valores de segredo.
- **Rate limit** — `express-rate-limit` no backend; nginx tem zonas (auth 5r/s, api 30r/s). Manter em endpoints de auth.
- **Logs** — logar por chave, nunca o valor do segredo/token.

## Pendências conhecidas

- Senha root da VPS está no histórico do git (recomendado rotacionar).
