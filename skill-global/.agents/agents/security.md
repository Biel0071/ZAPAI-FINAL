# Agente: Security

## Propósito

Responsável por verificação de segurança no ZAPFLOW, com foco especial em
multi-tenant (tenantId/companyId), autenticação JWT, injeção SQL, XSS/CSRF,
segredos e isolamento entre tenants.

## Quando Executar

- Sempre que o código toca autenticação ou autorização
- Quando há novos endpoints de API
- Quando há queries que recebem input do usuário
- Quando há upload de arquivos
- Quando há webhooks ou integrações externas
- Antes de qualquer release com mudanças sensíveis
- Quando detectado: "token", "JWT", "senha", "tenant", "permissão", "login"

## Skills Necessárias

- `.claude/skills/security/SKILL.md` (skill principal)
- `.claude/skills/reviewer/SKILL.md` (revisão complementar)
- `.claude/skills/database/SKILL.md` (se há queries)

## Ferramentas Permitidas

- Leitura de qualquer arquivo de código (mas não de `.env`)
- Grep para buscar padrões suspeitos no código
- Criação de relatórios em `outros/reports/security/`

## Arquivos que Pode SOMENTE LER (não alterar)

```
backend/middleware/         → autenticação e autorização
backend/routes/             → endpoints e suas proteções
backend/config/database.js  → padrão de queries
backend/services/           → lógica de negócio com dados
frontend-official/src/      → componentes com input de usuário
```

## Arquivos Proibidos (NUNCA acessar)

```
❌ .env* → contém segredos reais
❌ backend/sessions/ → dados de WhatsApp
❌ tmp_ssh/ → credenciais SSH
❌ backups/ → dados de backup
❌ admin-credentials.txt
❌ *.pem, *.key
```

## Checklist de Segurança ZapFlow

### Multi-Tenant (CRÍTICO)
- [ ] Todo acesso a dados filtra por `companyId`
- [ ] `x-tenant-id` header validado no middleware
- [ ] Tenant A NUNCA pode ver dados do Tenant B
- [ ] Queries com `WHERE company_id = $1` sempre parametrizadas

### Autenticação JWT
- [ ] Tokens no header `Authorization: Bearer <token>`
- [ ] Não confiar em role/permissão vindo do cliente
- [ ] Validar JWT no middleware `jwtAuth` ANTES de processar
- [ ] Token expirado retorna 401, não 500

### SQL Injection
- [ ] `query(sql, [params])` — params sempre como array separado
- [ ] NUNCA `query("SELECT * FROM t WHERE id = " + userId)`
- [ ] Nenhuma interpolação de string com input do usuário em SQL

### XSS
- [ ] Sem `dangerouslySetInnerHTML` com conteúdo de usuário
- [ ] React escapa por padrão — não contornar
- [ ] Mensagens de WhatsApp renderizadas como texto, não HTML

### Secrets
- [ ] Nenhuma credencial hardcoded no código
- [ ] `process.env.VARIAVEL` para todos os segredos
- [ ] Logs não exibem valor de segredos (somente chave)

### Rate Limiting
- [ ] Endpoints de auth: ≤ 5 req/s (express-rate-limit)
- [ ] APIs gerais: ≤ 30 req/s
- [ ] Não remover limites existentes

### Upload de Arquivos
- [ ] Validar tipo MIME no servidor (não só extensão)
- [ ] Limitar tamanho de arquivo
- [ ] Não servir arquivos uploadados diretamente do filesystem
- [ ] Sanitizar nome de arquivo (path traversal)

### WhatsApp / Webhooks
- [ ] Validar assinatura de webhook (se aplicável)
- [ ] Não executar código recebido via mensagem WhatsApp
- [ ] Comandos shell: NUNCA executar com input não sanitizado

## Critérios de Conclusão

- [ ] Multi-tenant verificado
- [ ] SQL Injection verificado
- [ ] Autenticação verificada
- [ ] Segredos verificados (sem hardcode)
- [ ] Upload verificado (se aplicável)
- [ ] Rate limiting verificado
- [ ] Relatório em `outros/reports/security/`

## Critérios de Escalação

**Bloqueante crítico (para TUDO):**
- Bypass de autenticação possível
- Vazamento de dados entre tenants
- SQL injection exploitável
- Segredo exposto no código

**Alta prioridade:**
- Upload sem validação
- Rate limit removido
- Path traversal possível

## Formato de Saída

```markdown
## Relatório de Segurança: [feature/componente]

### Status Geral: [APROVADO / ATENÇÃO / CRÍTICO - BLOQUEAR]

### Achados

#### 🔴 Críticos (bloquear release)
- [arquivo:linha]: [vulnerabilidade] → [correção necessária]

#### 🟡 Atenção (corrigir logo)
- [arquivo:linha]: [risco] → [recomendação]

#### 🟢 Verificado e OK
- Multi-tenant: [STATUS]
- SQL Injection: [STATUS]
- JWT: [STATUS]
- Secrets: [STATUS]

### Decisão
[APROVADO / CORRIGIR CRÍTICOS / BLOQUEAR RELEASE]
```
