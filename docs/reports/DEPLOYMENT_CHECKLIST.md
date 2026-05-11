# ⚡ CHECKLIST EXECUTIVO - ZAPAI VPS DEPLOYMENT

## 📋 PRÉ-DEPLOYMENT (Antes de ligar)

### 1️⃣ Preparar Infraestrutura VPS
- [ ] VPS Ubuntu 22.04 LTS provisionada
- [ ] SSH acesso confirmado (root@209.50.229.68)
- [ ] 50GB+ disco disponível
- [ ] 4GB+ RAM (recomendado 8GB)
- [ ] Fibra 100Mbps+ conectada

### 2️⃣ Clonar Projeto
```bash
cd /tmp
git clone https://github.com/SEU-REPO/zapai-final.git
cd zapai-final
```

### 3️⃣ Gerar Secrets
```bash
# JWT Secret (64 bytes)
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
echo "JWT_SECRET=$JWT_SECRET"

# Admin password
ADMIN_PASS=$(openssl rand -base64 24)
echo "ADMIN_PASS=$ADMIN_PASS"

# DB password
DB_PASS=$(openssl rand -base64 24)
echo "DB_PASS=$DB_PASS"
```

### 4️⃣ Criar .env.production
```bash
cp backend/.env.production.example .env.production

# Editar com valores:
nano .env.production
```

**Valores Críticos:**
```env
NODE_ENV=production
PORT=4025
DATABASE_URL=postgresql://zapai:${DB_PASS}@postgres:5432/zapai_crm
JWT_SECRET=${JWT_SECRET}
AUTH_DEFAULT_PASSWORD=${ADMIN_PASS}
MASTER_API_URL=http://localhost:4025
PUBLIC_API_URL=https://seu-dominio.com
FRONTEND_URL=https://seu-dominio.com
POSTGRES_PASSWORD=${DB_PASS}
```

---

## 🚀 DEPLOYMENT (Execução)

### 5️⃣ Instalar com Script Automático
```bash
# Execute como root
sudo bash deploy/install.sh master

# Aguarde ~2-3 minutos

# Resultado esperado:
# ✅ INSTALAÇÃO CONCLUÍDA!
# http://[IP]:3000
```

### 6️⃣ Verificar Status
```bash
# Ver containers
docker ps -a

# Esperado (5 containers):
# zapai-postgres ✅
# zapai-redis ✅
# zapai-postgres-backup ✅
# zapai-backend ✅
# zapai-frontend ✅

# Healthcheck backend
curl http://127.0.0.1:4025/api/health

# Esperado: {"status":"online","db":true,"whatsapp":{"status":"offline"},...}
```

### 7️⃣ Configurar Nginx + SSL
```bash
# Instalar Let's Encrypt
sudo bash deploy/ssl-certbot.sh

# Configurar nginx
sudo bash deploy/nginx-setup.sh

# Restart nginx
sudo systemctl restart nginx

# Verificar status
sudo certbot certificates
```

### 8️⃣ Inicializar Banco de Dados
```bash
# Executar migrations
docker compose -f docker-compose.production.yml exec backend \
  node scripts/init-database.js

# Seed admin user
docker compose -f docker-compose.production.yml exec backend \
  node scripts/seed-admin.js

# Esperado:
# [DB] PostgreSQL connected
# [SEED] Admin user created
```

---

## ✅ PÓS-DEPLOYMENT (Validações)

### 9️⃣ Acessar Frontend
```
Browser: https://seu-dominio.com
Login:
  - Username: admin
  - Password: ${ADMIN_PASS}
```

### 🔟 Conectar WhatsApp
```
1. Settings → "WhatsApp Connection"
2. Clique "Gerar QR Code"
3. Aguarde QR aparecer (máx 120s)
4. Celular: WhatsApp → Dispositivos Ligados → Scan QR
5. Aguarde status "Conectado"
6. ✅ Sistema pronto para uso
```

### 1️⃣1️⃣ Teste de Mensagens
```
1. Inbox → Selecione conversa existente
2. Digite mensagem de teste
3. Envie
4. Verifique entrega no WhatsApp
5. Receba resposta
6. Aparece em tempo real no Inbox
```

### 1️⃣2️⃣ Verificar Backups
```bash
# Ver backups criados
ls -lah backups/postgres/

# Teste restauração (opcional)
cd backups/postgres
ls -la *.sql.gz | head -1  # arquivo mais recente

# Restauração em caso de emergency:
# docker exec zapai-postgres \
#   pg_restore -U zapai -d zapai_crm /backups/backup.sql.gz
```

### 1️⃣3️⃣ Monitorar Recursos
```bash
# CPU + Memory
docker stats zapai-backend --no-stream

# Logs em tempo real
docker compose -f docker-compose.production.yml logs -f zapai-backend

# Disco
df -h

# Esperado:
# Memory: 200-300MB
# CPU: <10%
# Disco: <30GB usado
```

---

## 🆘 TROUBLESHOOTING RÁPIDO

| Problema | Solução |
|----------|---------|
| **Backend não inicia** | `docker compose logs zapai-backend` → Fix .env → Restart |
| **DB não conecta** | Aguarde postgres container ~30s → Restart backend |
| **WhatsApp desconecta** | Rescan QR → Verificar internet → Aumentar timeouts |
| **Nginx 502** | Verificar backend rodando: `docker ps` |
| **SSL erro** | `sudo certbot renew --dry-run` → Fix → Restart nginx |
| **Disco cheio** | `docker system prune -a` → Limpar volumes antigos |

---

## 📞 CONTATOS DE EMERGÊNCIA

### Backend Down
```bash
sudo systemctl restart docker
docker compose -f docker-compose.production.yml restart
```

### Database Down
```bash
docker compose -f docker-compose.production.yml restart zapai-postgres
# Se não voltar, restaurar de backup
```

### Rollback Completo
```bash
cd /path/to/zapai-final
git checkout main
git pull
docker compose -f docker-compose.production.yml down -v
sudo bash deploy/install.sh master
```

---

## 📊 COMANDOS ÚTEIS

```bash
# Logs
docker compose -f docker-compose.production.yml logs -f zapai-backend | tail -100

# SSH para container
docker exec -it zapai-backend sh

# SSH para database
docker exec -it zapai-postgres psql -U zapai -d zapai_crm

# Restart limpo (preserva dados)
docker compose -f docker-compose.production.yml restart

# Stop (sem perder dados)
docker compose -f docker-compose.production.yml stop

# Backup manual (agora)
docker exec zapai-postgres pg_dump -U zapai zapai_crm > backup-$(date +%Y%m%d-%H%M%S).sql

# Atualizar código
git pull && docker compose -f docker-compose.production.yml up -d --build
```

---

## 🎯 PRÓXIMAS FASES (Opcional)

**Fase 2 - Depois de 1 mês estável:**
- [ ] Setup Prometheus + Grafana para metrics
- [ ] Configurar alertas (PagerDuty, Slack)
- [ ] Testes de carga (K6, JMeter)
- [ ] Plano de disaster recovery (backup S3)

**Fase 3 - Multi-region (Futuro):**
- [ ] Replicação DB em secondary VPS
- [ ] Load balancer (Nginx upstream)
- [ ] Redis cluster para cache distribuído

---

**Versão:** 1.0 | **Data:** 4 de Maio de 2026  
**Duração esperada:** 10-15 minutos
