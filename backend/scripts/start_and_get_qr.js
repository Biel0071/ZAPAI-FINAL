'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

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

function post(path, body) {
  return new Promise((resolve, reject) => {
    const token = generateAdminToken();
    const data = JSON.stringify(body || {});
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path,
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
}

function get(path) {
  return new Promise((resolve, reject) => {
    const token = generateAdminToken();
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path,
      headers: { 'Authorization': 'Bearer ' + token }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Calling POST /sessions/start...');
  const start = await post('/sessions/start', { sessionId: 'main' });
  console.log('Start result:', start.body);

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const qrRes = await get('/sessions/qr');
    const qr = qrRes.body?.qr || qrRes.body?.data?.qr;
    if (qr) {
      console.log('QR Code ready length:', qr.length);
      const b64 = qr.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync('/opt/zapai/backend/assets/live_baileys_qr.png', Buffer.from(b64, 'base64'));
      console.log('Saved to /opt/zapai/backend/assets/live_baileys_qr.png');
      break;
    } else {
      console.log(`Polling QR... attempt ${i + 1} status: ${qrRes.body?.data?.status || qrRes.body?.status}`);
    }
  }
}

main().catch(console.error);
