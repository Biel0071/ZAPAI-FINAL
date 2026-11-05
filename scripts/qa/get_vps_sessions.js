const https = require('https');

async function main() {
  const loginBody = JSON.stringify({ username: 'zapadmin', password: 'zapadmin1010' });
  const loginRes = await new Promise((resolve, reject) => {
    const req = https.request('https://209.50.241.22:1000/api/auth/login', {
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginBody),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error('Failed to parse login response:', data);
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(loginBody);
    req.end();
  });

  const token = loginRes.token || loginRes.data?.token;
  console.log('Got token:', token ? 'YES' : 'NO');

  const sessionsRes = await new Promise((resolve, reject) => {
    const req = https.request('https://209.50.241.22:1000/api/sessions', {
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error('Failed to parse sessions response:', data);
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });

  console.log('Sessions response:', JSON.stringify(sessionsRes, null, 2));
}

main().catch(console.error);
