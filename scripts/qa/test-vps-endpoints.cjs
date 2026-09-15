const crypto = require('crypto');
const http = require('http');
const fs = require('fs');

function loadEnv(path) {
  try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (err) {}
}

loadEnv('/opt/zapai/.env.production');
loadEnv('/opt/zapai/backend/.env');

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sig}`;
}

const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || 'secret';
const token = signToken({ id: 'admin-test', username: 'admin', role: 'admin', tenantId: 'default' }, secret);

function request(path) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 80,
      path,
      method: 'GET',
      headers: {
        Host: '209.50.241.22',
        Authorization: 'Bearer ' + token,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.end();
  });
}

async function run() {
  console.log('=== VERIFYING POST-DEPLOY ENDPOINTS ON VPS ===');
  const r1 = await request('/api/outbound-queue/pending');
  console.log('1. /api/outbound-queue/pending -> status:', r1.status, 'body:', r1.body.slice(0, 150));

  const r2 = await request('/api/outbound-queue/dlq');
  console.log('2. /api/outbound-queue/dlq -> status:', r2.status, 'body:', r2.body.slice(0, 150));

  const r3 = await request('/api/messages/outbound-queue/pending');
  console.log('3. /api/messages/outbound-queue/pending -> status:', r3.status, 'body:', r3.body.slice(0, 150));

  const r4 = await request('/api/session-status');
  console.log('4. /api/session-status -> status:', r4.status, 'body:', r4.body.slice(0, 150));
}

run();
