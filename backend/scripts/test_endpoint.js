const http = require('http');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function createToken(payload, secret) {
  const encHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${sig}`;
}

const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || 'zapflow-secret-key-change-in-production';
const token = createToken({
  id: 'admin-1',
  role: 'admin',
  tenantId: 'default',
  exp: Math.floor(Date.now() / 1000) + 3600,
}, secret);

console.log('Testing endpoint /api/ai/agent-evolution/camila ...');

const req = http.request({
  hostname: '127.0.0.1',
  port: 4025,
  path: '/api/ai/agent-evolution/camila',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token,
  },
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status 1 (Agent Evolution):', res.statusCode);
    const parsed = JSON.parse(data);
    console.log('AGENT-EVOLUTION KEYS:', Object.keys(parsed));
    if (parsed.data) console.log('INNER DATA KEYS:', Object.keys(parsed.data));
    console.log('HUMAN STATS in parsed:', JSON.stringify(parsed.humanStats || parsed.data?.humanStats, null, 2));

    const req2 = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path: '/api/ai/agent-evolve/learned-patterns',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
    }, (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log('HTTP Status 2 (Learned Patterns):', res2.statusCode);
        const parsed2 = JSON.parse(data2);
        console.log('PATTERNS COUNT:', parsed2.data?.length);
        process.exit(0);
      });
    });
    req2.end();
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
  process.exit(1);
});

req.end();
