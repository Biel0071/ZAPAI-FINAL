const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function main() {
  const loginRes = await fetch('https://209.50.241.22:1000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zapadmin', password: 'zapadmin1010' }),
    dispatcher: undefined,
  });

  // Use raw https request for self-signed cert
  const loginData = await new Promise((resolve, reject) => {
    const req = https.request('https://209.50.241.22:1000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ username: 'zapadmin', password: 'zapadmin1010' }));
    req.end();
  });

  const token = loginData.token || (loginData.data && loginData.data.token);
  console.log('Logged in, token:', token ? token.slice(0, 20) + '...' : 'NONE');

  const sessionsData = await new Promise((resolve, reject) => {
    const req = https.request('https://209.50.241.22:1000/api/sessions', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });

  console.log('SESSIONS RESPONSE:', JSON.stringify(sessionsData, null, 2));

  // Also check /api/session/status
  const connStatus = await new Promise((resolve) => {
    const req = https.request('https://209.50.241.22:1000/api/session/status', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
  console.log('SESSION STATUS (/api/session/status):', JSON.stringify(connStatus, null, 2));
}

main().catch(console.error);
