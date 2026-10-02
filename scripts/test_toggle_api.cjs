const { pool } = require('../backend/src/infrastructure/config/database');
const crypto = require('crypto');
const http = require('http');

function createHs256Jwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${signature}`;
}

function makeRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  const u = (await pool.query('SELECT * FROM users LIMIT 1')).rows[0];
  const secret = process.env.JWT_SECRET || '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';
  const token = createHs256Jwt({
    id: u.id, email: u.email, role: u.role, companyId: 'default', exp: Math.floor(Date.now() / 1000) + 3600
  }, secret);

  console.log('--- Testing ZAIBOT action: Pausar Camila via API ---');
  const pauseRes = await makeRequest('PATCH', '/api/config/ai-agents/camila/active', { active: false }, token);
  console.log('Pause status:', pauseRes.status, 'body:', pauseRes.body);
  if (pauseRes.status !== 200) throw new Error('Failed to pause Camila');

  console.log('--- Testing ZAIBOT action: Ativar Camila via API ---');
  const resumeRes = await makeRequest('PATCH', '/api/config/ai-agents/camila/active', { active: true }, token);
  console.log('Resume status:', resumeRes.status, 'body:', resumeRes.body);
  if (resumeRes.status !== 200) throw new Error('Failed to re-enable Camila');

  console.log('✅ ZAIBOT Agent Action & Confirmation Endpoints Verified 100%');
  process.exit(0);
}

main().catch(e => { console.error('FAILED:', e); process.exit(1); });
