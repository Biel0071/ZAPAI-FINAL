const { spawn } = require('child_process');

const VPS_HOST = 'root@209.50.241.22';

function runRemoteCommand(cmdDescription, bashCommand) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> [START] ${cmdDescription}...`);
    const proc = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=15',
      VPS_HOST,
      bashCommand
    ], { stdio: 'inherit', shell: false });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`>>> [SUCCESS] ${cmdDescription}`);
        resolve();
      } else {
        console.error(`>>> [FAILED] ${cmdDescription} (Exit Code: ${code})`);
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      console.error(`>>> [ERROR] Failed to start SSH process:`, err);
      reject(err);
    });
  });
}

async function main() {
  try {
    // 0. Update repo on VPS and reload PM2
    await runRemoteCommand(
      'Atualizar código na VPS e recarregar PM2',
      'cd /opt/zapai && git fetch origin main && git reset --hard origin/main && pm2 reload zapflow-api --update-env'
    );

    // 1. Verify database tables and rows on VPS
    await runRemoteCommand(
      'Verificar contagem de tabelas evolutivas no PostgreSQL da VPS',
      `cd /opt/zapai/backend && node -e "
const { Pool } = require('pg');
const fs = require('fs');
const env = fs.readFileSync('/opt/zapai/backend/.env', 'utf8');
let conn = '';
env.split('\\n').forEach(l => {
  if (l.startsWith('DATABASE_URL=')) conn = l.split('=')[1].trim().replace(/^['\\"]|['\\"]$/g, '');
});
const pool = new Pool({ connectionString: conn });
(async () => {
  const k = await pool.query('SELECT count(*) FROM company_official_knowledge');
  const p = await pool.query('SELECT count(*) FROM ai_playbooks');
  const e = await pool.query('SELECT count(*) FROM ai_experience_events');
  const s = await pool.query('SELECT count(*) FROM ai_learning_suggestions');
  const c = await pool.query('SELECT count(*) FROM ai_context');
  const m = await pool.query('SELECT count(*) FROM ai_conversation_memory');
  console.log('--- POSTGRESQL DATA COUNTS ON VPS ---');
  console.log('company_official_knowledge:', k.rows[0].count);
  console.log('ai_playbooks:', p.rows[0].count);
  console.log('ai_experience_events:', e.rows[0].count);
  console.log('ai_learning_suggestions:', s.rows[0].count);
  console.log('ai_context:', c.rows[0].count);
  console.log('ai_conversation_memory:', m.rows[0].count);
  await pool.end();
})();
"`
    );

    // 2. Test API endpoints on VPS using internal JWT token generated with the VPS secret
    await runRemoteCommand(
      'Testar Endpoints da API Evolutiva (/api/ai/evolution/*) com autenticação',
      `cd /opt/zapai/backend && node -e "
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');

function loadEnv(path) {
  try {
    const lines = fs.readFileSync(path, 'utf8').split('\\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['\\"]|['\\"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (err) {}
}

loadEnv('/opt/zapai/backend/.env');
loadEnv('/opt/zapai/.env.production');

const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET;
console.log('JWT Secret configured:', !!secret);

function b64(s) {
  return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
}

function makeToken() {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const p = b64(JSON.stringify({ sub: 'admin', username: 'admin', role: 'admin', tenantId: 'default', companyId: 'default', exp }));
  const d = h + '.' + p;
  const s = crypto.createHmac('sha256', secret).update(d).digest('base64').replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
  return d + '.' + s;
}

const token = makeToken();

function apiGet(path) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'x-tenant-id': 'default'
      }
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, raw }); }
      });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

(async () => {
  console.log('--- TESTING EVOLUTION API ENDPOINTS ---');
  const metrics = await apiGet('/api/ai/evolution/metrics');
  console.log('1. /api/ai/evolution/metrics -> HTTP', metrics.status);
  if (metrics.data?.data) {
    console.log('   Metrics:', JSON.stringify(metrics.data.data));
  }

  const knowledgeOfficial = await apiGet('/api/ai/evolution/official-knowledge');
  console.log('2a. /api/ai/evolution/official-knowledge -> HTTP', knowledgeOfficial.status, 'items:', knowledgeOfficial.data?.data?.length);

  const knowledge = await apiGet('/api/ai/evolution/knowledge');
  console.log('2b. /api/ai/evolution/knowledge (alias) -> HTTP', knowledge.status, 'items:', knowledge.data?.data?.length);

  const playbooks = await apiGet('/api/ai/evolution/playbooks');
  console.log('3. /api/ai/evolution/playbooks -> HTTP', playbooks.status, 'items:', playbooks.data?.data?.length);

  const suggestions = await apiGet('/api/ai/evolution/suggestions');
  console.log('4. /api/ai/evolution/suggestions -> HTTP', suggestions.status, 'items:', suggestions.data?.data?.length);

  const testMatch = await apiGet('/api/ai/evolution/playbooks/match?query=quanto+custa+o+milheiro');
  console.log('5. /api/ai/evolution/playbooks/match -> HTTP', testMatch.status, 'matched:', !!testMatch.data?.data);
  if (testMatch.data?.data) {
    console.log('   Matched Playbook:', testMatch.data.data.name, '| CTA:', testMatch.data.data.recommended_cta);
  }

  const contextTest = await apiGet('/api/ai/evolution/context/test-conv-001');
  console.log('6. /api/ai/evolution/context/test-conv-001 -> HTTP', contextTest.status, 'context ok:', !!contextTest.data?.data?.customerContext);
})();
"`
    );

    // 3. Verify Frontend build assets
    await runRemoteCommand(
      'Verificar arquivos do Frontend compilados no OpenResty',
      'ls -lh /opt/zapai/frontend-official/dist/index.html'
    );

    // 4. Run full 8-scenario E2E test suite on VPS PostgreSQL
    await runRemoteCommand(
      'Executar Suíte E2E Completa de 8 Cenários no PostgreSQL da VPS',
      'cd /opt/zapai/backend && node tests/evolutionaryE2EFullCycle.test.js'
    );

  } catch (err) {
    console.error('Remote verification error:', err);
    process.exit(1);
  }
}

main();
