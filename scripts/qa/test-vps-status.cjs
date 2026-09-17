const { spawn } = require('child_process');

const VPS_HOST = 'root@209.50.241.22';

const remoteScript = `
echo "=== 1. PM2 PROCESS STATUS ==="
pm2 status

echo ""
echo "=== 2. LISTENING PORTS ==="
ss -tulpn | grep -E '4025|80|443|5432' || netstat -tulpn | grep -E '4025|80|443|5432'

echo ""
echo "=== 3. BACKEND API HEALTH ==="
curl -s -w "\\nHTTP Status: %{http_code}\\n" http://127.0.0.1:4025/api/session-status

echo ""
echo "=== 4. OPENRESTY FRONTEND HTTP ==="
curl -s -w "\\nHTTP Status: %{http_code}\\n" http://127.0.0.1:80/ | head -n 5

echo ""
echo "=== 5. POSTGRESQL & AGENT MEMORIES ==="
cd /opt/zapai/backend && node -e "
const { Pool } = require('pg');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
let conn = '';
env.split('\\n').forEach(l => {
  if (l.startsWith('DATABASE_URL=')) conn = l.split('=')[1].trim().replace(/^['\\"]|['\\"]$/g, '');
});
const pool = new Pool({ connectionString: conn });
(async () => {
  const k = await pool.query('SELECT count(*) FROM company_official_knowledge');
  const p = await pool.query('SELECT count(*) FROM ai_playbooks');
  const c = await pool.query('SELECT count(*) FROM ai_context');
  const m = await pool.query('SELECT count(*) FROM ai_conversation_memory');
  const e = await pool.query('SELECT count(*) FROM ai_experience_events');
  const s = await pool.query('SELECT count(*) FROM ai_learning_suggestions');
  console.log('PostgreSQL Conectado com Sucesso!');
  console.log(' - Verdade Oficial (Catálogo/Regras):', k.rows[0].count);
  console.log(' - Playbooks Comerciais Ativos:', p.rows[0].count);
  console.log(' - Contextos de Clientes:', c.rows[0].count);
  console.log(' - Memórias Estruturadas:', m.rows[0].count);
  console.log(' - Experiências Registradas:', e.rows[0].count);
  console.log(' - Sugestões Evolutivas:', s.rows[0].count);
  await pool.end();
})();
"

echo ""
echo "=== 6. LIVE AI STATUS API CHECK (/api/ai/status) ==="
cd /opt/zapai/backend && node -e "
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
let secret = '';
env.split('\\n').forEach(l => {
  if (l.startsWith('JWT_SECRET=')) secret = l.split('=')[1].trim().replace(/^['\\"]|['\\"]$/g, '');
});

function b64(s) { return Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_'); }
const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const exp = Math.floor(Date.now() / 1000) + 3600;
const p = b64(JSON.stringify({ sub: 'admin', username: 'admin', role: 'admin', tenantId: 'default', companyId: 'default', exp }));
const sig = crypto.createHmac('sha256', secret).update(h + '.' + p).digest('base64').replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
const token = h + '.' + p + '.' + sig;

const req = http.request({
  hostname: '127.0.0.1', port: 4025, path: '/api/ai/status', method: 'GET',
  headers: { 'Authorization': 'Bearer ' + token, 'x-tenant-id': 'default' }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => console.log('HTTP', res.statusCode, '-> /api/ai/status:', d));
});
req.end();
"

echo ""
echo "=== 6. VPS MEMORY & UPTIME ==="
free -h
uptime
`;

const proc = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ConnectTimeout=15',
  VPS_HOST,
  remoteScript
], { stdio: 'inherit', shell: false });

proc.on('close', (code) => {
  process.exit(code);
});
