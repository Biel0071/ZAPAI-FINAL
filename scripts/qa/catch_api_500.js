const fs = require('fs');

async function checkError() {
  const logFile = '/opt/zapai/backend/logs/pm2-error.log';
  const initialSize = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0;

  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zapadmin', password: 'zapadmin1010' })
  });
  const { token } = await loginRes.json();

  const res = await fetch('http://127.0.0.1:3000/api/conversations/12574/messages?limit=50', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('HTTP Status:', res.status);
  const data = await res.text();
  console.log('HTTP Body:', data);

  // Wait a moment for logs to flush
  await new Promise(r => setTimeout(r, 1000));

  if (fs.existsSync(logFile)) {
    const finalSize = fs.statSync(logFile).size;
    if (finalSize > initialSize) {
      const fd = fs.openSync(logFile, 'r');
      const buf = Buffer.alloc(finalSize - initialSize);
      fs.readSync(fd, buf, 0, finalSize - initialSize, initialSize);
      fs.closeSync(fd);
      console.log('--- ERROR LOG APPENDED ---\n', buf.toString('utf8'));
    } else {
      console.log('No new error logged in pm2-error.log');
    }
  }

  // Also check pm2-out.log
  const outFile = '/opt/zapai/backend/logs/pm2-out.log';
  if (fs.existsSync(outFile)) {
    const outLines = fs.readFileSync(outFile, 'utf8').split('\n').slice(-30).join('\n');
    console.log('--- LAST 30 LINES OF PM2-OUT.LOG ---\n', outLines);
  }
}

checkError().catch(console.error);

