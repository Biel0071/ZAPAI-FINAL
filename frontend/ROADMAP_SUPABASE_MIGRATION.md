# ROADMAP: Migração para Supabase (24h)

## STATUS ATUAL

### Frontend (swift-wa-assist)
- React + TypeScript + Vite
- Supabase SDK instalado mas INATIVO
- Comunica via HTTP com backend legado
- Socket.IO para real-time
- Cache local em memória

### Backend (ZAPAI-CRM)
- Express.js (JavaScript legado)
- PostgreSQL direto (via pg)
- Socket.IO server
- JWT auth custom
- Modo degradado sem DB

---

## ESTRATÉGIA DE MIGRAÇÃO

### Abordagem Híbrida (Mínimo Risco)
1. **Backend continua usando PostgreSQL** (via connection string Supabase)
2. **Frontend conecta direto ao Supabase** para:
   - Real-time inbox (Supabase Realtime)
   - File storage (Supabase Storage)
   - Auth multiempresa (Supabase Auth)
3. **Backend atua como proxy** para:
   - WhatsApp Baileys (não roda no browser)
   - AI processing
   - Processamento pesado

---

## ROADMAP 24 HORAS

### HORAS 1-3: Fundação Supabase
- [ ] Criar projeto Supabase
- [ ] Executar migrations (001_initial_schema.sql)
- [ ] Criar storage buckets (media, avatars, documents)
- [ ] Configurar RLS policies
- [ ] Testar conexão frontend ↔ Supabase

**Entregável**: Supabase configurado e acessível

### HORAS 4-6: Auth Multiempresa
- [ ] Implementar auth.ts (já criado)
- [ ] Criar tela de login Supabase
- [ ] Criar tela de registro com company selection
- [ ] Implementar company context
- [ ] Migrar JWT → Supabase Auth

**Entregável**: Sistema de autenticação Supabase funcionando

### HORAS 7-9: Realtime Inbox
- [ ] Implementar realtime.ts (já criado)
- [ ] Substituir Socket.IO → Supabase Realtime para conversations
- [ ] Substituir Socket.IO → Supabase Realtime para messages
- [ ] Implementar subscription manager
- [ ] Testar real-time updates

**Entregável**: Inbox real-time via Supabase

### HORAS 10-12: Storage de Arquivos
- [ ] Implementar storage.ts (já criado)
- [ ] Migrar upload de media para Supabase Storage
- [ ] Migrar avatars para Supabase Storage
- [ ] Implementar CDN URLs
- [ ] Testar upload/download

**Entregável**: Sistema de arquivos via Supabase Storage

### HORAS 13-15: Backend → Supabase Connection
- [ ] Atualizar backend para usar DATABASE_URL do Supabase
- [ ] Testar conexão PostgreSQL → Supabase
- [ ] Migrar dados existentes (se houver)
- [ ] Validar queries funcionam
- [ ] Testar endpoints

**Entregável**: Backend conectado ao Supabase

### HORAS 16-18: Frontend → Supabase Direct
- [ ] Criar Supabase data layer
- [ ] Migrar apiService → Supabase queries
- [ ] Implementar React Query com Supabase
- [ ] Migrar conversations list
- [ ] Migrar messages list

**Entregável**: Frontend usando Supabase diretamente

### HORAS 19-21: Real-time Integration
- [ ] Conectar frontend real-time aos events do backend
- [ ] Backend emits → Supabase triggers (via Edge Functions)
- [ ] Sincronizar Socket.IO → Supabase Realtime
- [ ] Testar fluxo completo
- [ ] Performance tuning

**Entregável**: Sistema real-time unificado

### HORAS 22-24: Testes & Deploy
- [ ] Testes end-to-end
- [ ] Load testing
- [ ] Bug fixes
- [ ] Documentação
- [ ] Deploy produção

**Entregável**: Sistema migrado e em produção

---

## ARQUITETURA FINAL

```
┌─────────────────┐
│   Frontend      │
│  (React + TS)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    │         │
┌───▼───┐ ┌──▼──────────┐
│Supabase│ │  Backend    │
│ Auth   │ │ (Express)   │
├────────┤ ├─────────────┤
│Realtime│ │WhatsApp     │
├────────┤ │Baileys      │
│Storage │ │AI Engine    │
└────────┘ │Queue        │
           └──────┬──────┘
                  │
           ┌──────▼──────┐
           │  Supabase   │
           │ PostgreSQL  │
           └─────────────┘
```

---

## MIGRAÇÃO DE DADOS

### Se houver dados existentes:
1. Exportar dados do PostgreSQL atual
2. Importar para Supabase via pg_dump
3. Validar integridade
4. Testar queries

### Se não houver dados:
- Criar schema fresh no Supabase
- Executar migrations
- Sistema começa do zero

---

## RISCOS E MITIGAÇÃO

### Risco 1: Baileys não roda em Edge Functions
**Mitigação**: Manter backend Node.js como proxy para WhatsApp

### Risco 2: Socket.IO → Supabase Realtime breaking changes
**Mitigação**: Implementar adapter layer para compatibilidade

### Risco 3: Performance degradation
**Mitigação**: Usar Supabase CDN, implementar caching local

### Risco 4: Auth migration downtime
**Mitigação**: Implementar dual auth durante transição

---

## CHECKLIST DE VALIDAÇÃO

### Pós-Migração:
- [ ] Login funciona com Supabase Auth
- [ ] Conversations carregam do Supabase
- [ ] Messages carregam do Supabase
- [ ] Real-time updates funcionam
- [ ] Upload/download de arquivos funciona
- [ ] Backend conectado ao Supabase
- [ ] WhatsApp Baileys funciona
- [ ] AI processing funciona
- [ ] Analytics funcionam
- [ ] Sistema performático

---

## PRÓXIMOS PASSOS

1. **IMEDIATO**: Criar projeto Supabase
2. **PRIORIDADE 1**: Executar migrations
3. **PRIORIDADE 2**: Implementar auth
4. **PRIORIDADE 3**: Migrar real-time
5. **PRIORIDADE 4**: Migrar storage
