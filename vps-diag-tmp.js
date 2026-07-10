const { Client } = require('ssh2');
const conn = new Client();

const cmd = [
  'echo "=== /usr/local listing ==="',
  'ls -la /usr/local/ 2>&1',
  'echo "=== root listing ==="',
  'ls -la / 2>&1',
  'echo "=== www listing ==="',
  'ls -la /www/ 2>&1',
  'echo "=== www/server listing ==="',
  'ls -la /www/server/ 2>&1',
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
