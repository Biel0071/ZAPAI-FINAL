'use strict';

const fs = require('fs');
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

async function run() {
  const token = generateAdminToken();

  const req = http.request({
    hostname: '127.0.0.1',
    port: 4025,
    path: '/sessions/qr',
    headers: { 'Authorization': 'Bearer ' + token }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', async () => {
      try {
        const json = JSON.parse(data);
        const qrData = json.qr || json.data?.qr;
        if (qrData) {
          const b64 = qrData.replace(/^data:image\/\w+;base64,/, '');
          const outPath = '/opt/zapai/backend/assets/live_baileys_qr.png';
          fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
          console.log('SUCCESS_SAVED_BAILEYS_QR to', outPath);
        } else {
          console.log('No QR code yet:', json);
        }
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    });
  });

  req.on('error', err => console.error('HTTP error:', err.message));
  req.end();
}

run();
