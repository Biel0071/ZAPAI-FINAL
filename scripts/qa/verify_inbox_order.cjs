const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const http = require('http');

// Load environment from /opt/zapai/backend/.env
dotenv.config({ path: '/opt/zapai/backend/.env' });

function createJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${signature}`;
}

async function run() {
  console.log('=== 1. Direct MessageRepository Test ===');
  const messageRepository = require('/opt/zapai/backend/src/data/repositories/messageRepository.js');
  const messages = await messageRepository.getMessagesByConversation('10943', { limit: 15 });
  console.log(`Retrieved ${messages.length} messages directly from repository for conversation 10943:`);
  messages.forEach(m => {
    console.log(`  [ID ${m.id}] timestamp: ${m.timestamp} | createdAt: ${m.createdAt} | body: "${(m.content || m.body || '').slice(0, 45).replace(/\n/g, ' ')}"`);
  });

  console.log('\n=== 2. HTTP Endpoint Test with JWT ===');
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '';
  const now = Math.floor(Date.now() / 1000);
  const token = createJwt({
    sub: 'admin',
    role: 'admin',
    tenantId: 'default',
    companyId: 'default',
    iat: now,
    exp: now + 3600
  }, secret);

  const req = http.request({
    host: '127.0.0.1',
    port: 4025,
    path: '/api/conversations/10943/messages?limit=15',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      try {
        const json = JSON.parse(data);
        const list = Array.isArray(json) ? json : (json.messages || json.data || []);
        console.log(`Endpoint returned ${list.length} messages:`);
        list.forEach(m => {
          console.log(`  [ID ${m.id}] timestamp: ${m.timestamp} | createdAt: ${m.createdAt} | body: "${(m.content || m.body || '').slice(0, 45).replace(/\n/g, ' ')}"`);
        });
      } catch (err) {
        console.log('Parse error:', err.message, data.slice(0, 200));
      }
      process.exit(0);
    });
  });

  req.on('error', err => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });
  req.end();
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
