const { Client } = require('ssh2');
const conn = new Client();
const cmd = process.argv[2] || 'pm2 list';

conn.on('ready', () => {
  console.log(`Running on VPS: "${cmd}"`);
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Error executing command:', err);
      conn.end();
      return;
    }
    stream.on('close', (code, signal) => {
      console.log('\n--- exit code: ' + code + ' ---');
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection Error:', err);
}).connect({
  host: '209.50.241.22',
  port: 22,
  username: 'root',
  password: 'S53yi4RYq8j4DCGp',
  readyTimeout: 30000
});
