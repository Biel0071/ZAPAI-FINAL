const axios = require('axios');
const { exec } = require('child_process');
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
const BASE_URL = process.env.API_URL || 'http://localhost:4025';
const FRONT_URL = 'http://localhost:80'; // Ou IP da VPS localmente (pode ser o Vite/Nginx na porta 80 ou 5173)

let pool = null;
if (process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_NAME)) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 5432,
    });
}

function log(msg) {
    console.log(`[${new Date().toISOString()}] [AUTO-HEALER] ${msg}`);
}

async function restartPM2(serviceName) {
    return new Promise((resolve) => {
        log(`🚨 Reiniciando serviço ${serviceName} via PM2...`);
        exec(`pm2 restart ${serviceName}`, (err, stdout, stderr) => {
            if (err) {
                log(`❌ Erro ao reiniciar ${serviceName}: ${err.message}`);
                return resolve(false);
            }
            log(`✅ Serviço ${serviceName} reiniciado com sucesso.`);
            resolve(true);
        });
    });
}

async function checkBackend() {
    try {
        const start = Date.now();
        // Um ping rápido no login para checar se a API não está em deadlock
        await axios.post(`${BASE_URL}/api/auth/login`, { username: 'ping', password: 'ping' }, { timeout: 10000 });
        log(`✅ Backend OK (${Date.now() - start}ms)`);
        return true;
    } catch (e) {
        // 401/403 significa que a API está viva, só recusou as credenciais. Erro bom.
        if (e.response && [401, 403, 404, 400].includes(e.response.status)) {
            log(`✅ Backend OK (API viva, respondeu com status ${e.response.status})`);
            return true;
        }
        log(`❌ Backend Falhou: ${e.message}`);
        return false;
    }
}

async function checkFrontend() {
    try {
        // Tenta porta 80 (Produção Nginx) e porta 5173 (Preview Vite)
        let ok = false;
        try {
            await axios.get('http://localhost:80', { timeout: 5000 });
            ok = true;
        } catch(e) {}
        
        if (!ok) {
            try {
                await axios.get('http://localhost:5173', { timeout: 5000 });
                ok = true;
            } catch(e) {}
        }

        if (ok) {
            log(`✅ Frontend OK`);
            return true;
        } else {
            log(`❌ Frontend não respondeu em HTTP portas 80/5173`);
            return false;
        }
    } catch (e) {
        return false;
    }
}

async function fixStuckQueue() {
    if (!pool) {
        log(`⚠️ Banco de dados não configurado no .env, pulando verificação de fila.`);
        return;
    }
    
    try {
        const query = `
            UPDATE outbound_queue 
            SET state = 'dead_letter', 
                dead_letter_at = NOW(), 
                last_failure = '{"message": "Auto-healer: Stuck in processing for > 15 mins", "code": "AUTO_HEAL_TIMEOUT"}'::jsonb 
            WHERE state IN ('processing', 'queued') 
              AND updated_at < NOW() - INTERVAL '15 minutes'
            RETURNING id;
        `;
        const res = await pool.query(query);
        if (res.rowCount > 0) {
            log(`🩹 Auto-Cura: ${res.rowCount} mensagens presas foram desativadas (dead_letter) para desobstruir a fila.`);
        } else {
            log(`✅ Fila de envio saudável (Nenhuma mensagem fantasma presa).`);
        }
    } catch (e) {
        log(`❌ Erro ao limpar fila fantasma: ${e.message}`);
    }
}

async function runHealer() {
    log('Iniciando ciclo de verificação de sistema...');
    
    let backendFails = 0;
    
    // 1. Backend API Check
    const apiAlive = await checkBackend();
    if (!apiAlive) {
        log(`⚠️ Backend parece indisponível. Tentando novamente em 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        const apiAliveRetry = await checkBackend();
        if (!apiAliveRetry) {
            await restartPM2('zapflow-api');
        }
    }

    // 2. Queue Fix
    await fixStuckQueue();

    // 3. Frontend Check (se NGINX travar)
    // Frontends Nginx raramente travam ao nível do Node, mas se travam podemos dar um nginx restart.
    const frontAlive = await checkFrontend();
    if (!frontAlive) {
        log(`⚠️ Frontend parece indisponível (Porta 80 e 5173 down).`);
        // O PM2 que gerencia o front (caso seja node/vite) ou nginx.
        // Vamos dar um reload no nginx, ou no PM2.
        exec(`systemctl restart nginx || pm2 restart fenix-frontend`, () => {});
    }

    log(`Ciclo concluído. Próxima checagem em ${INTERVAL_MS / 60000} minutos.\n`);
}

log('=======================================');
log('🤖 Auto-Healer inicializado em background');
log(`⏰ Intervalo: ${INTERVAL_MS / 60000} minutos`);
log('=======================================');

// Roda a primeira vez logo no início
runHealer();

// Agendador
setInterval(runHealer, INTERVAL_MS);
