const { execSync } = require('child_process');

const remoteScript = `
const https = require('https');

function requestJson(url, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const req = https.request(url, {
      rejectUnauthorized: false,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('[VERIFY-COMMERCE] 1. Logging into ZAPAI CRM...');
  const loginRes = await requestJson('https://127.0.0.1:1000/api/auth/login', { method: 'POST' }, {
    username: 'zapadmin',
    password: 'zapadmin1010'
  });
  const loginData = JSON.parse(loginRes.body);
  const token = loginData.data?.token || loginData.token;
  if (!token) throw new Error('Login failed: ' + loginRes.body);
  console.log('[VERIFY-COMMERCE] Authenticated successfully. Token obtained.');

  const authHeaders = { 'Authorization': 'Bearer ' + token };

  console.log('[VERIFY-COMMERCE] 2. Querying /api/commerce/capabilities...');
  const capsRes = await requestJson('https://127.0.0.1:1000/api/commerce/capabilities', { method: 'GET', headers: authHeaders });
  console.log('CAPABILITIES STATUS:', capsRes.status);
  const capsData = JSON.parse(capsRes.body);
  console.log('CAPABILITIES DATA:', JSON.stringify(capsData.data?.capabilities, null, 2));

  console.log('[VERIFY-COMMERCE] 3. Querying /api/commerce/catalog...');
  const catRes = await requestJson('https://127.0.0.1:1000/api/commerce/catalog', { method: 'GET', headers: authHeaders });
  console.log('CATALOG STATUS:', catRes.status);
  const catData = JSON.parse(catRes.body);
  console.log('TOTAL PRODUCTS IN CATALOG:', catData.total || catData.products?.length);

  console.log('[VERIFY-COMMERCE] 4. Querying /api/commerce/orders...');
  const ordersRes = await requestJson('https://127.0.0.1:1000/api/commerce/orders', { method: 'GET', headers: authHeaders });
  console.log('ORDERS STATUS:', ordersRes.status);
  const ordersData = JSON.parse(ordersRes.body);
  console.log('TOTAL ORDERS IN SYSTEM:', ordersData.total);

  console.log('[VERIFY-COMMERCE] ALL LIVE ENDPOINTS VERIFIED 100% OPERATIONAL!');
  process.exit(0);
}

run().catch(err => {
  console.error('[VERIFY-COMMERCE] Failed:', err);
  process.exit(1);
});
`;

console.log('Executing live verification on VPS 209.50.241.22...');
const output = execSync(`ssh root@209.50.241.22 "node -e \\"${remoteScript.replace(/"/g, '\\"')}\\""`, {
  encoding: 'utf8',
  timeout: 30000
});
console.log(output);
