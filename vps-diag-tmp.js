const { Client } = require('ssh2');
const conn = new Client();

const cmd = [
  'echo "=== PM2 Status ==="',
  'pm2 status',
  'echo "\\n=== PM2 Logs ==="',
  'pm2 logs --nostream --lines 20',
  'echo "\\n=== API Health Check ==="',
  'curl -s http://localhost:4025/health',
  'echo "\\n\\n=== E2E Smoke Test ==="',
  'curl -s -X POST http://localhost:4025/api/system/e2e-smoke | grep -o \'"healthScore":[0-9]*\'',
  'echo "\\n\\n=== AI Provider Keys in DB ==="',
  'su - postgres -c "psql -d zapai_crm -c \\"SELECT provider, enabled, model FROM provider_keys;\\""'
].join(' && ');

conn.on('ready', () => {
  console.log('SSH connection established.');
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error('exec error:', err); conn.end(); return; }
    stream.on('close', (code) => {
      console.log('\\n--- exit code: ' + code + ' ---');
      conn.end();
    }).on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).on('error', (err) => {
  console.error('SSH Connection Error:', err.message);
}).connect({
  host: '209.50.241.22',
  port: 22,
  username: 'root',
  password: 'S53yi4RYq8j4DCGp',
  readyTimeout: 30000,
});
