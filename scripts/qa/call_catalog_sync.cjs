const { execSync } = require('child_process');

const script = `
const https = require('https');

function postJson(url, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = https.request(url, {
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  // 1. Login
  const loginRes = await postJson('https://127.0.0.1:1000/api/auth/login', {
    username: 'zapadmin',
    password: 'zapadmin1010'
  });
  console.log('LOGIN STATUS:', loginRes.status);
  const loginData = JSON.parse(loginRes.body);
  const token = loginData.data?.token || loginData.token;
  console.log('TOKEN OBTAINED:', Boolean(token));

  // 2. Call /api/catalog/sync
  const syncRes = await postJson('https://127.0.0.1:1000/api/catalog/sync', {
    sessionId: 'main'
  }, {
    'Authorization': 'Bearer ' + token
  });
  console.log('SYNC STATUS:', syncRes.status);
  console.log('SYNC RESPONSE:', syncRes.body);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
`;

const b64 = Buffer.from(script).toString('base64');
execSync(`ssh -o StrictHostKeyChecking=no root@209.50.241.22 "NODE_PATH=/opt/zapai/backend/node_modules node -e \\"eval(Buffer.from('${b64}', 'base64').toString('utf8'))\\""`, { stdio: 'inherit' });

