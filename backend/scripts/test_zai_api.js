'use strict';

const http = require('http');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';

function generateAdminToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId: 1,
    role: 'admin',
    tenantId: 'default',
    companyId: 'default',
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function request(path) {
  return new Promise((resolve, reject) => {
    const token = generateAdminToken();
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path,
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('--- SESSIONS STATUS ---');
  const sess = await request('/sessions/status');
  console.log('Sessions status:', sess.body);

  console.log('\n--- TEST 1: /zai/health ---');
  const health = await request('/zai/health');
  console.log('Health status:', health.status, 'Connected:', health.body?.data?.connected);

  console.log('\n--- TEST 2: /zai/capabilities ---');
  const caps = await request('/zai/capabilities');
  console.log('Capabilities status:', caps.status, 'Engines:', caps.body?.data?.engines);

  console.log('\n--- TEST 3: /zai/catalog ---');
  const catalog = await request('/zai/catalog');
  console.log('Catalog status:', catalog.status, 'Keys:', Object.keys(catalog.body || {}), 'Raw:', JSON.stringify(catalog.body).slice(0, 250));

  console.log('\n--- TEST 4: /zai/orders ---');
  const orders = await request('/zai/orders');
  console.log('Orders status:', orders.status, 'Orders count:', orders.body?.data?.length);

  console.log('\n--- TEST 5: /zai/catalog/products/send (Disparo Nativo do Tijolo 12 Furos) ---');
  const sendRes = await new Promise((resolve, reject) => {
    const token = generateAdminToken();
    const data = JSON.stringify({
      phone: '553193672075',
      productId: 'prod_tijolo_12_furos',
      caption: '⚡ Teste de Certificação ZAI Native Commerce'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path: '/zai/catalog/products/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': 'Bearer ' + token
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  console.log('Send Product Status:', sendRes.status, 'Response:', JSON.stringify(sendRes.body));
}

main().catch(err => {
  console.error('Test error:', err.message);
  process.exit(1);
});
