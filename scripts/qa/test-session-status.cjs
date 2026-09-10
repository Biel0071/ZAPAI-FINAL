const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const code = fs.readFileSync(path.join(root, 'frontend-official/tests/ui/visual-full-e2e.spec.ts'), 'utf8');
  const username = code.match(/const USERNAME = "([^"]+)"/)[1];
  const password = code.match(/const PASSWORD = "([^"]+)"/)[1];

  console.log('Logging in as:', username);
  const loginRes = await fetch('http://209.50.241.22/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await loginRes.json();
  const token = data.data?.token || data.token;
  console.log('Login result:', { success: data.success, role: (data.data?.user || data.user)?.role });
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  console.log('Decoded token payload:', payload);

  const rSession = await fetch('http://209.50.241.22/api/session-status', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('/api/session-status status:', rSession.status, 'body:', (await rSession.text()).slice(0, 300));

  const rPending1 = await fetch('http://209.50.241.22/api/messages/outbound-queue/pending?limit=50', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('/api/messages/outbound-queue/pending status:', rPending1.status);

  const rPending2 = await fetch('http://209.50.241.22/api/outbound-queue/pending?limit=50', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('/api/outbound-queue/pending status:', rPending2.status, 'body:', (await rPending2.text()).slice(0, 200));

  const rSessions = await fetch('http://209.50.241.22/api/sessions', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const sessionsData = await rSessions.json();
  console.log('Sessions list:', JSON.stringify(sessionsData, null, 2));
}

main().catch(console.error);
