const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function runBootstrap() {
  const localEnv = path.join(__dirname, '.env');
  const targetEnv = fs.existsSync('/workspace') ? '/workspace/.env' : localEnv;

  if (fs.existsSync(targetEnv)) {
    return;
  }

  console.log('====================================================');
  console.log('[AUTO-BOOTSTRAP] Iniciando autoconfiguração ZAPFLOW AI...');
  console.log('====================================================');
  console.log('[AUTO-BOOTSTRAP] .env não encontrado. Gerando novo ambiente...');

  const dbPassword = process.env.POSTGRES_PASSWORD || 'zapadmin123';
  const dbHost = process.env.POSTGRES_HOST || process.env.DB_HOST || (fs.existsSync('/workspace') ? 'postgres' : 'localhost');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const nodeToken = crypto.randomBytes(16).toString('hex');

  const envContent = `
# ============================================================================
# ZAPFLOW AI - AUTO GENERATED PRODUCTION ENV
# ============================================================================
NODE_ENV=production
PORT=4025
HOST=0.0.0.0

# ── CORS / Frontend URL ──────────────────────────────────────
FRONTEND_URL=${frontendUrl}
CORS_ALLOWED_ORIGINS=${frontendUrl}

# ── Database (PostgreSQL) ───────────────────────────────────
POSTGRES_HOST=${dbHost}
POSTGRES_USER=zapai
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=zapai_crm
DATABASE_URL=postgresql://zapai:${dbPassword}@${dbHost}:5432/zapai_crm
PGSSLMODE=disable

# ── Authentication ──────────────────────────────────────────
JWT_SECRET=${jwtSecret}
AUTH_JWT_SECRET=${jwtSecret}

AUTH_DEFAULT_USERNAME=zapadmin
AUTH_DEFAULT_PASSWORD=zapadmin123
AUTH_DEFAULT_TENANT_ID=default

# ── Redis ──────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Master Node Registration ─────────────────────────────────
MASTER=true
NODE_ROLE=master
MASTER_HOSTNAME=ZAP-AICRM
MASTER_VPS_IP=127.0.0.1
MASTER_API_URL=http://127.0.0.1:4025
NODE_TOKEN=${nodeToken}
FEATURE_ADMIN_MASTER=true

LOG_LEVEL=info
CRASH_EXIT_ON_UNHANDLED=true
`;

  try {
    fs.writeFileSync(targetEnv, envContent.trim());
    console.log('[AUTO-BOOTSTRAP] Arquivo .env criado com sucesso!');
    console.log(`[AUTO-BOOTSTRAP] Banco de Dados configurado para host: ${dbHost}`);
    console.log('[AUTO-BOOTSTRAP] Admin Default: zapadmin / zapadmin123');
    console.log('[AUTO-BOOTSTRAP] Sistema pronto para uso imediato.');
    console.log('====================================================');
  } catch (err) {
    console.error('[AUTO-BOOTSTRAP] Falha ao criar .env:', err);
  }
}

module.exports = runBootstrap;
